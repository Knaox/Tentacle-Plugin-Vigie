/* ------------------------------------------------------------------ */
/*  Vigie — Les demandes pas encore arrivées chez Jellyseerr           */
/* ------------------------------------------------------------------ */

/*
 * Une demande part d'abord dans la file du plugin ; le worker la transmet à
 * Jellyseerr dans la minute. Entre les deux, Jellyseerr n'en sait rien — la
 * recherche proposerait donc de redemander ce qu'on vient de demander. On
 * relit la file locale (dix secondes au plus de retard, jamais attendue).
 */

import type { PrismaClient } from "@prisma/client";

const REFRESH_MS = 10_000;

let keys = new Set<string>();
let readAt = 0;
let reading = false;

export function isLocallyPending(key: string): boolean {
  return keys.has(key);
}

/** Relit la file si elle date — sans jamais faire attendre la recherche. */
export function refreshLocalPending(prisma: PrismaClient): void {
  if (reading || Date.now() - readAt < REFRESH_MS) return;
  reading = true;
  prisma.$queryRawUnsafe<Array<{ media_type: string; tmdb_id: number }>>(
    `SELECT DISTINCT media_type, tmdb_id FROM seer_requests
     WHERE status IN ('queued', 'processing', 'retry_pending', 'sent_to_seer', 'approved')`,
  )
    .then((rows) => {
      keys = new Set(rows.map((r) => `${r.media_type}:${Number(r.tmdb_id)}`));
    })
    .catch(() => undefined)
    .finally(() => {
      readAt = Date.now();
      reading = false;
    });
}

/** Une demande vient d'être faite : elle compte tout de suite. */
export function markLocallyPending(mediaType: "movie" | "tv", tmdbId: number): void {
  keys.add(`${mediaType}:${tmdbId}`);
}
