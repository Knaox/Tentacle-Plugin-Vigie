/* ------------------------------------------------------------------ */
/*  Vigie — Les dossiers de Jellyfin répondent-ils ? (et sa relecture)  */
/* ------------------------------------------------------------------ */

/*
 * Un titre parti de Jellyfin n'est pas forcément supprimé : un NAS qui ne
 * répond plus, un partage réseau perdu, un disque en panne font aussi
 * disparaître des titres. Tentacle ne voit pas ces dossiers — Jellyfin, si.
 * Vigie lui demande donc :
 *
 *   - ses bibliothèques et leurs dossiers (`/Library/VirtualFolders`) ;
 *   - le contenu de chaque dossier (`/Environment/DirectoryContents`) : un
 *     dossier déjà vu rempli qui ne répond plus, ou se retrouve VIDE, c'est
 *     une panne. Un dossier jamais vu rempli (un vieux disque resté dans la
 *     liste) ne bloque rien. Les dossiers vus remplis sont retenus en base :
 *     un redémarrage pendant une panne ne l'efface pas ;
 *   - sa tâche « Analyser la médiathèque » (`RefreshLibrary`) : quand elle
 *     a fini pour la dernière fois, et la lancer — une relecture complète
 *     faite APRÈS une panne ou une vague dit ce qui est vraiment parti.
 *
 * Jellyfin muet : on ne sait pas (`unknown`) — rien n'est retiré.
 */

import { createHash } from "node:crypto";
import type { VigieDb } from "../storage/vigie-db";
import { readMeta, writeMeta } from "../search/title-store";
import { jellyfinSession, type Session } from "./jellyfin-check";

export type StorageState = "ok" | "down" | "unknown";

export interface StorageReport {
  state: StorageState;
  /** Les dossiers en panne (pour le journal). */
  down: string[];
}

export interface ScanState {
  taskId: string;
  running: boolean;
  /** Fin de la dernière analyse aboutie (ms), `null` : jamais. */
  lastEnd: number | null;
}

const CHECK_TTL_MS = 60_000;
const SEEN_KEY = "live:storage-seen";
/** Empreintes courtes : la valeur de la table est bornée à 500 caractères. */
const MAX_SEEN = 40;
const fingerprint = (path: string) => createHash("sha1").update(path).digest("hex").slice(0, 8);
const LIBRARY_SCAN_KEY = "RefreshLibrary";

async function getJson(s: Session, path: string, timeoutMs = 15_000): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${s.base}${path}`, { headers: s.headers, signal: AbortSignal.timeout(timeoutMs) });
  const data = res.ok ? await res.json().catch(() => null) : null;
  return { status: res.status, data };
}

/** Les dossiers de toutes les bibliothèques ; `null` : illisible. */
async function libraryLocations(s: Session): Promise<string[] | null> {
  const { status, data } = await getJson(s, "/Library/VirtualFolders");
  if (status !== 200 || !Array.isArray(data)) return null;
  const out = new Set<string>();
  for (const lib of data as Array<{ Locations?: unknown }>) {
    for (const loc of Array.isArray(lib?.Locations) ? lib.Locations : []) if (typeof loc === "string" && loc) out.add(loc);
  }
  return [...out];
}

type Location = "filled" | "empty" | "unreachable" | "unknown";

async function locationState(s: Session, path: string): Promise<Location> {
  const query = new URLSearchParams({ path, includeDirectories: "true", includeFiles: "true" });
  try {
    const { status, data } = await getJson(s, `/Environment/DirectoryContents?${query}`, 20_000);
    // 401/403 : un refus, pas une panne. Autre 4xx : Jellyfin ne trouve pas le dossier
    // (mesuré par l'assistant du serveur).
    if (status === 401 || status === 403) return "unknown";
    if (status >= 400 && status < 500) return "unreachable";
    if (status !== 200 || !Array.isArray(data)) return "unknown";
    return data.length > 0 ? "filled" : "empty";
  } catch {
    return "unknown";
  }
}

/** Ce que Vigie sait des dossiers : relu au plus une fois par minute. */
export function createStorageWatch(db: VigieDb) {
  /** Les dossiers déjà vus remplis (empreintes) : injoignables ou vides ensuite, c'est une panne. */
  let seen: string[] | null = null;
  let last: { at: number; report: StorageReport } | null = null;

  return async function storage(now = Date.now()): Promise<StorageReport> {
    if (last && now - last.at < CHECK_TTL_MS) return last.report;
    if (seen === null) seen = parseSeen(await readMeta(db, SEEN_KEY).catch(() => null));
    const before = seen.length;
    const report = await readStorage(db, seen).catch((): StorageReport => ({ state: "unknown", down: [] }));
    if (seen.length !== before) {
      seen = seen.slice(-MAX_SEEN);
      await writeMeta(db, SEEN_KEY, JSON.stringify(seen)).catch(() => undefined);
    }
    last = { at: now, report };
    return report;
  };
}

function parseSeen(raw: string | null): string[] {
  try {
    const list = JSON.parse(raw ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

async function readStorage(db: VigieDb, seen: string[]): Promise<StorageReport> {
  const s = await jellyfinSession(db);
  if (!s) return { state: "unknown", down: [] };
  const locations = await libraryLocations(s);
  if (locations === null) return { state: "unknown", down: [] };
  const down: string[] = [];
  let unknown = false;
  for (const path of locations) {
    const state = await locationState(s, path);
    const id = fingerprint(path);
    if (state === "filled") {
      if (!seen.includes(id)) seen.push(id);
    } else if ((state === "unreachable" || state === "empty") && seen.includes(id)) down.push(path);
    else if (state === "unknown") unknown = true;
  }
  if (down.length > 0) return { state: "down", down };
  return { state: unknown ? "unknown" : "ok", down };
}

/** La tâche « Analyser la médiathèque » ; `null` : Jellyfin muet ou tâche introuvable. */
export async function libraryScanState(db: VigieDb): Promise<ScanState | null> {
  const s = await jellyfinSession(db).catch(() => null);
  if (!s) return null;
  const { status, data } = await getJson(s, "/ScheduledTasks?isHidden=false").catch(() => ({ status: 0, data: null }));
  if (status !== 200 || !Array.isArray(data)) return null;
  const task = (data as Array<Record<string, unknown>>).find((t) => t?.Key === LIBRARY_SCAN_KEY);
  if (!task || typeof task.Id !== "string") return null;
  const result = task.LastExecutionResult as { EndTimeUtc?: string; Status?: string } | undefined;
  const end = result?.Status === "Completed" && result.EndTimeUtc ? Date.parse(result.EndTimeUtc) : NaN;
  return { taskId: task.Id, running: task.State === "Running", lastEnd: Number.isFinite(end) ? end : null };
}

/** Lance « Analyser la médiathèque ». Vrai si Jellyfin l'a acceptée. */
export async function startLibraryScan(db: VigieDb, taskId: string): Promise<boolean> {
  const s = await jellyfinSession(db).catch(() => null);
  if (!s) return false;
  const res = await fetch(`${s.base}/ScheduledTasks/Running/${encodeURIComponent(taskId)}`, {
    method: "POST",
    headers: s.headers,
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return !!res && res.ok;
}
