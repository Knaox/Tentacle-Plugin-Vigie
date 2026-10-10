/* ------------------------------------------------------------------ */
/*  Vigie — Les demandes pas encore arrivées chez Jellyseerr           */
/* ------------------------------------------------------------------ */

/*
 * Une demande part d'abord dans la file du plugin ; le worker la transmet à
 * Jellyseerr dans la minute. Entre les deux, Jellyseerr n'en sait rien — la
 * recherche proposerait donc de redemander ce qu'on vient de demander. On
 * relit la file locale (dix secondes au plus de retard, jamais attendue).
 *
 * Deux lectures de la même file :
 *   - `isLocallyPending` : tout ce qui attend encore (en file, envoyé, validé)
 *     — ce que la recherche disait déjà « Demandé » ;
 *   - `locallyQueued` : seulement ce que Jellyseerr n'a PAS encore (en file,
 *     en cours d'envoi, à retenter — ou envoyé il y a moins de deux minutes,
 *     le temps que l'index des demandes le lise), saisons comprises — la
 *     seule part de la file que Jellyseerr ne peut pas contredire (cf.
 *     live/title-truth.ts). Sans ce délai, un titre parti de Jellyfin et
 *     redemandé repassait « Demander » quelques secondes après l'envoi.
 */

import type { VigieDb } from "../storage/vigie-db";
import { readStoredDate } from "../db-helpers";

const REFRESH_MS = 10_000;
const WAITING = ["queued", "processing", "retry_pending", "sent_to_seer", "approved"];
const NOT_SENT = new Set(["queued", "processing", "retry_pending"]);
/** Une demande envoyée compte encore comme en file, le temps que l'index des demandes la lise. */
const JUST_SENT_MS = 2 * 60_000;

let keys = new Set<string>();
/** « movie:603 » → saisons en file (vide : le titre entier, ou un film). */
let queued = new Map<string, Set<number>>();
let readAt = 0;
let reading = false;

export function isLocallyPending(key: string): boolean {
  return keys.has(key);
}

/** Les saisons d'un titre qui attendent dans la file, pas encore chez Jellyseerr — `null` : rien. */
export function locallyQueued(key: string): ReadonlySet<number> | null {
  return queued.get(key) ?? null;
}

function seasonsOf(raw: unknown): number[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

/** Relit la file si elle date (ou tout de suite si `force`) — sans jamais faire attendre la recherche. */
export function refreshLocalPending(db: VigieDb, force = false): void {
  if (reading || (!force && Date.now() - readAt < REFRESH_MS)) return;
  reading = true;
  db.query<{ media_type: string; tmdb_id: number; status: string; seasons: unknown; sent_at: unknown }>(
    `SELECT media_type, tmdb_id, status, seasons, sent_at FROM seer_requests
     WHERE status IN (${WAITING.map(() => "?").join(", ")})`,
    ...WAITING,
  )
    .then((rows) => {
      const nextKeys = new Set<string>();
      const nextQueued = new Map<string, Set<number>>();
      for (const r of rows) {
        const key = `${r.media_type}:${Number(r.tmdb_id)}`;
        nextKeys.add(key);
        const justSent = r.status === "sent_to_seer" && Date.now() - (readStoredDate(r.sent_at)?.getTime() ?? 0) < JUST_SENT_MS;
        if (!NOT_SENT.has(r.status) && !justSent) continue;
        const set = nextQueued.get(key) ?? new Set<number>();
        for (const s of seasonsOf(r.seasons)) set.add(s);
        nextQueued.set(key, set);
      }
      keys = nextKeys;
      queued = nextQueued;
    })
    .catch(() => undefined)
    .finally(() => {
      readAt = Date.now();
      reading = false;
    });
}

/** Une demande vient d'être faite : elle compte tout de suite. */
export function markLocallyPending(mediaType: "movie" | "tv", tmdbId: number, seasons?: readonly number[] | null): void {
  const key = `${mediaType}:${tmdbId}`;
  keys.add(key);
  const set = queued.get(key) ?? new Set<number>();
  for (const s of seasons ?? []) set.add(s);
  queued.set(key, set);
}
