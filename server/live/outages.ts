/* ------------------------------------------------------------------ */
/*  Vigie — Les pannes des dossiers de Jellyfin, retenues               */
/* ------------------------------------------------------------------ */

/*
 * Une panne vue (storage-health.ts) rend suspect tout ce qui est parti
 * autour d'elle, jusqu'à ce que Jellyfin ait relu sa bibliothèque APRÈS son
 * retour. Retenue en base (`seer_search_meta`) : un redémarrage de Tentacle
 * pendant ou juste après la panne n'en fait pas des suppressions.
 */

import type { PrismaClient } from "@prisma/client";
import { readMeta, writeMeta } from "../search/title-store";
import type { StorageState } from "./storage-health";
import type { WaveWindow } from "./auto-forget-plan";

const META_KEY = "live:storage-outages";
/** Au-delà, les départs qu'elle couvrait ne sont plus gardés par le serveur. */
const KEEP_MS = 31 * 86_400_000;
const MAX_KEPT = 8;

export interface Outage {
  start: number;
  /** `null` : elle dure. */
  end: number | null;
}

/** Ce que devient la liste des pannes après une observation. `null` : rien ne change. */
export function nextOutages(outages: readonly Outage[], state: StorageState, now: number): Outage[] | null {
  const open = outages.find((o) => o.end === null);
  if (state === "down" && !open) {
    return [...outages, { start: now, end: null }].filter((o) => o.end === null || now - o.end < KEEP_MS).slice(-MAX_KEPT);
  }
  if (state === "ok" && open) return outages.map((o) => (o === open ? { ...o, end: now } : o));
  return null;
}

/** Les pannes en fenêtres : celle qui dure va jusqu'à maintenant. */
export function outageWindows(outages: readonly Outage[], now: number): WaveWindow[] {
  return outages.map((o) => ({ start: o.start, end: o.end ?? now }));
}

function parse(raw: string | null): Outage[] {
  try {
    const list = JSON.parse(raw ?? "[]") as unknown;
    if (!Array.isArray(list)) return [];
    return list.flatMap((o) => (Array.isArray(o) && Number.isFinite(o[0]) && (o[1] === null || Number.isFinite(o[1]))
      ? [{ start: Number(o[0]), end: o[1] === null ? null : Number(o[1]) }]
      : []));
  } catch {
    return [];
  }
}

/** Les pannes, lues une fois puis tenues en mémoire ; chaque changement est écrit. */
export function createOutageLog(db: PrismaClient) {
  let outages: Outage[] | null = null;
  return {
    async observe(state: StorageState, now: number): Promise<Outage[]> {
      if (outages === null) outages = parse(await readMeta(db, META_KEY).catch(() => null));
      const next = nextOutages(outages, state, now);
      if (next) {
        outages = next;
        // Compact : [début, fin] — la valeur de la table est bornée à 500 caractères.
        await writeMeta(db, META_KEY, JSON.stringify(next.map((o) => [o.start, o.end]))).catch(() => undefined);
      }
      return outages;
    },
  };
}
