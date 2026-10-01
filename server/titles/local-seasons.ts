/* ------------------------------------------------------------------ */
/*  Vigie — Les saisons qu'un compte a demandées, dans notre file       */
/* ------------------------------------------------------------------ */

/*
 * Source de vérité locale : la ligne existe dès la demande, avant que le
 * worker ne la transmette — une saison demandée se verrouille aussitôt et
 * durablement, sans attendre que Jellyseerr la connaisse. On UNIT les saisons
 * de TOUTES les lignes actives (une demande éclate ses saisons sur plusieurs
 * lignes). Statuts exclus alignés sur `findDuplicate` : on verrouille
 * exactement ce qu'une nouvelle demande bloquerait. Lu par la fiche du hub
 * (`/requests/lookup`) et par la feuille des saisons de Tentacle.
 */

import type { PrismaClient } from "@prisma/client";

export async function localRequestedSeasons(prisma: PrismaClient, userId: string, tmdbId: number): Promise<number[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ seasons: unknown }>>(
    `SELECT seasons FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = 'tv'
       AND status NOT IN ('deleted', 'failed', 'available', 'deleting', 'delete_failed')`,
    userId, tmdbId,
  );
  const seasons = new Set<number>();
  for (const r of rows) {
    if (!r.seasons) continue;
    try {
      const arr = typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons;
      if (Array.isArray(arr)) {
        for (const s of arr) { const n = Number(s); if (Number.isFinite(n)) seasons.add(n); }
      }
    } catch { /* ligne seasons illisible → ignorée */ }
  }
  return [...seasons].sort((a, b) => a - b);
}
