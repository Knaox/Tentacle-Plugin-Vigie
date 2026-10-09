/* ------------------------------------------------------------------ */
/*  Vigie — La boucle en direct : Jellyfin et Jellyseerr, tenus à jour  */
/* ------------------------------------------------------------------ */

/*
 * Ce qui fait qu'un titre supprimé de Jellyfin cesse aussitôt d'être
 * « Disponible », et qu'une demande supprimée dans Jellyseerr disparaît de
 * Vigie dans la foulée — sans attendre la synchronisation nocturne de
 * Jellyseerr, et sans mitrailler personne :
 *
 *   1. l'empreinte de la liste du serveur Tentacle (trois agrégats SQL, dans
 *      sa base) ; si elle a bougé, la liste regroupée par film et saison ;
 *   2. pour un départ tout récent, la question à Jellyfin (titre par titre) ;
 *   3. l'empreinte des demandes de Jellyseerr (une ligne) ; si elle a bougé,
 *      la page des dernières modifications, ou une relecture complète quand
 *      des demandes ont disparu ;
 *   4. ce qui en découle : la file locale purgée des demandes supprimées,
 *      les listes en cache oubliées, l'option « supprimer la demande avec
 *      le titre » appliquée.
 *
 * Le rythme suit l'usage : toutes les dix secondes tant que quelqu'un se
 * sert de Vigie (ou de ses cartes dans Tentacle), toutes les minutes sinon.
 */

import type { VigieDb } from "../storage/vigie-db";
import type { WorkerCfg } from "../seerr-unified";
import { invalidate, invalidateRequestCaches } from "../cache";
import { refreshLocalPending } from "../search/pending";
import { refreshStatusMap, statusMapStale } from "../search/status-map";
import { checkInJellyfin, type CheckTarget } from "./jellyfin-check";
import { sameLibrarySignature, type LibrarySignature, type LibraryStore } from "./library-store";
import { liveState, SETTLE_MS } from "./live-state";
import { requestIndex, type IndexChange } from "./request-index";
import { forgetLocalRequests } from "./local-requests";

const TICK_MS = 5_000;
const ACTIVE_EVERY_MS = 10_000;
const IDLE_EVERY_MS = 60_000;
/** Quelqu'un s'est servi de Vigie il y a moins que ça : rythme rapide. */
const ACTIVE_WINDOW_MS = 5 * 60_000;
/** Un départ récent se redemande à Jellyfin à ce rythme, le temps qu'il soit acquis. */
const RECHECK_MS = 2 * 60_000;
/** Au plus autant de titres demandés à Jellyfin par passe. */
const CHECKS_PER_PASS = 8;

export interface LiveSyncDeps {
  db: VigieDb;
  store: LibraryStore;
  getWorkerConfig: () => Promise<WorkerCfg | null>;
  /** L'option « supprimer la demande avec le titre » et ce qu'elle fait (auto-forget.ts). */
  afterPass?: (cfg: WorkerCfg, now: number) => Promise<void>;
}

let timer: ReturnType<typeof setInterval> | null = null;
let deps: LiveSyncDeps | null = null;
let lastActivity = 0;
let lastRun = 0;
let busy = false;
let librarySig: LibrarySignature | null = null;
let seerrUrl: string | null = null;

/** Une route de Vigie vient d'être appelée : on passe au rythme rapide. */
export function markActivity(now = Date.now()): void {
  const idle = now - lastActivity >= ACTIVE_WINDOW_MS;
  lastActivity = now;
  // Retour après un long silence : une passe tout de suite plutôt qu'à la minute.
  if (idle && deps && !busy) lastRun = 0;
}

export function liveGeneration(): number {
  return liveState.generation;
}

export function startLiveSync(d: LiveSyncDeps): void {
  if (timer) return;
  deps = d;
  timer = setInterval(() => { void tick(); }, TICK_MS);
  timer.unref?.();
  setTimeout(() => { void tick(true); }, 3_000).unref?.();
}

export function stopLiveSync(): void {
  if (timer) clearInterval(timer);
  timer = null;
  deps = null;
}

/** Pour les tests : la boucle repart de zéro. */
export function resetLiveSync(): void {
  stopLiveSync();
  librarySig = null;
  seerrUrl = null;
  lastActivity = 0;
  lastRun = 0;
}

async function tick(force = false): Promise<void> {
  const d = deps;
  if (!d || busy) return;
  const now = Date.now();
  const every = now - lastActivity < ACTIVE_WINDOW_MS ? ACTIVE_EVERY_MS : IDLE_EVERY_MS;
  if (!force && now - lastRun < every) return;
  busy = true;
  lastRun = now;
  try {
    await runPass(d, now);
  } catch (err) {
    console.warn("[VigieLive] Passe interrompue :", err);
  } finally {
    busy = false;
  }
}

/** Une passe complète — exportée pour les tests et les bancs. */
export async function runPass(d: LiveSyncDeps, now = Date.now()): Promise<void> {
  const libraryChanged = await refreshLibrary(d.store);
  const checked = await confirmDepartures(d.db, now);
  const cfg = await d.getWorkerConfig();
  if (!cfg) return;
  if (cfg.seerrUrl !== seerrUrl) {
    if (seerrUrl !== null) requestIndex.reset();
    seerrUrl = cfg.seerrUrl;
  }
  const change = await requestIndex.poll(cfg, now);
  if (change) await applyIndexChange(d.db, cfg, change);
  // Ce que Jellyfin ou les demandes ont changé se voit tout de suite dans les listes,
  // et les marques des affiches (« dans la bibliothèque ») se relisent chez Jellyfin.
  if (libraryChanged || checked) {
    invalidate("vigie:marks");
    if (!change) invalidateRequestCaches();
  }
  if (d.afterPass) await d.afterPass(cfg, now);
}

async function refreshLibrary(store: LibraryStore): Promise<boolean> {
  const sig = await store.signature();
  if (sig === null) return liveState.setLibrary(null);
  if (sameLibrarySignature(sig, librarySig) && liveState.libraryReadable) return false;
  const rows = await store.rows();
  if (rows === null) return liveState.setLibrary(null);
  librarySig = sig;
  return liveState.setLibrary(rows);
}

/** Les départs récents qu'il faut (re)demander à Jellyfin. */
export function departuresToCheck(now: number): CheckTarget[] {
  const out: CheckTarget[] = [];
  for (const dep of liveState.departures()) {
    if (now - dep.at >= SETTLE_MS) continue;
    const key = `${dep.mediaType}:${dep.tmdbId}`;
    const check = liveState.checks.get(key);
    if (check && check.at >= dep.at && now - check.at < RECHECK_MS) continue;
    out.push({ mediaType: dep.mediaType, tmdbId: dep.tmdbId, seasons: dep.mediaType === "tv" ? dep.seasons : undefined });
  }
  return out.slice(0, CHECKS_PER_PASS);
}

async function confirmDepartures(db: VigieDb, now: number): Promise<boolean> {
  const targets = departuresToCheck(now);
  if (targets.length === 0) return false;
  const results = await checkInJellyfin(db, targets);
  let changed = false;
  for (const [key, result] of results) {
    if (!result) continue;
    changed = liveState.setCheck(key, { at: Date.now(), present: result.present, presentSeasons: result.presentSeasons }) || changed;
  }
  return changed;
}

async function applyIndexChange(db: VigieDb, cfg: WorkerCfg, change: IndexChange): Promise<void> {
  if (change.deleted.length > 0) {
    const forgotten = await forgetLocalRequests(db, change.deleted.map((r) => r.id), "Demande supprimée côté Jellyseerr");
    if (forgotten > 0) refreshLocalPending(db, true);
    const titles = change.deleted.map((r) => `${r.mediaType}:${r.tmdbId}#${r.id}`).join(", ");
    console.log(`[VigieLive] Demande(s) supprimée(s) dans Jellyseerr : ${titles} — ${forgotten} ligne(s) de la file close(s)`);
  }
  // Les listes de tout le monde : une demande a pu changer de main, de statut, disparaître.
  invalidateRequestCaches();
  // Le statut des médias a pu bouger avec la demande : relu tout de suite.
  statusMapStale();
  refreshStatusMap(cfg);
}
