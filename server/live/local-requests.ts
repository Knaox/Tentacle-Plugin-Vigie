/* ------------------------------------------------------------------ */
/*  Vigie — Ce que la boucle en direct écrit dans la file locale        */
/* ------------------------------------------------------------------ */

/*
 * Une demande supprimée dans Jellyseerr ne doit plus rien bloquer dans Vigie :
 * sa ligne locale, quel que soit son statut (« disponible » compris, que la
 * synchro ne relisait jamais), est close aussitôt — plus de doublon refusé, plus
 * de saison verrouillée, plus de « Demandé » fantôme dans la recherche. Les
 * lignes en cours de suppression gardent leur file de nettoyage.
 */

import type { PrismaClient } from "@prisma/client";
import type { SeerRequest } from "../types";
import { rowToRequest } from "../db-helpers";

const CLOSED = ["deleted", "deleting", "delete_failed"];

/** Clôt les lignes locales de ces demandes Jellyseerr. Rend combien l'ont été. */
export async function forgetLocalRequests(prisma: PrismaClient, seerrRequestIds: readonly number[], reason: string): Promise<number> {
  const ids = [...new Set(seerrRequestIds.filter((n) => Number.isSafeInteger(n) && n > 0))];
  if (ids.length === 0) return 0;
  let closed = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    closed += await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET status = 'deleted', last_error = ?
       WHERE seerr_request_id IN (${chunk.map(() => "?").join(", ")})
         AND status NOT IN (${CLOSED.map(() => "?").join(", ")})`,
      reason, ...chunk, ...CLOSED,
    );
  }
  return closed;
}

/** Les lignes encore ouvertes d'un titre, tous comptes confondus. */
export async function openLocalRequestsFor(prisma: PrismaClient, mediaType: "movie" | "tv", tmdbId: number): Promise<SeerRequest[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests WHERE media_type = ? AND tmdb_id = ?
       AND status NOT IN (${CLOSED.map(() => "?").join(", ")})
     ORDER BY created_at ASC, id ASC`,
    mediaType, tmdbId, ...CLOSED,
  );
  return rows.map(rowToRequest);
}
