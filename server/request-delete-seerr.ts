/* ------------------------------------------------------------------ */
/*  Vigie — Supprimer une demande venue directement de Jellyseerr       */
/* ------------------------------------------------------------------ */

/*
 * Une demande faite dans Jellyseerr (ou avant Vigie) n'a pas de ligne locale :
 * elle se supprime par son identifiant Jellyseerr, par la même file de
 * nettoyage que les autres (Radarr, Sonarr, puis la demande — cf.
 * cleanup-arr.ts). Partagé par la suppression d'une demande et la suppression
 * groupée, où ces demandes tombaient jusqu'ici en erreur.
 */

import type { VigieDb } from "./storage/vigie-db";
import { enqueueCleanup } from "./db";
import { fetchSeerrRequestById, type WorkerCfg } from "./seerr-unified";

interface Actor {
  userId: string;
  isAdmin: boolean;
}

export type SeerrDeletion =
  | { ok: true; status: "deleting" | "updated" }
  | { ok: false; code: 404 | 403; message: string };

export async function deleteSeerrOnlyRequest(
  db: VigieDb,
  config: WorkerCfg,
  user: Actor,
  seerrId: number,
  opts: { seasons?: number[]; deleteFiles: boolean },
): Promise<SeerrDeletion> {
  const seerrReq = await fetchSeerrRequestById(config, seerrId);
  if (!seerrReq) return { ok: false, code: 404, message: "Seerr request not found" };

  // Verrou ownership : on compare via seer_user_settings.jellyseerr_user_id
  if (!user.isAdmin) {
    const settingsRows = await db.query<{ jellyseerr_user_id: number | null }>(
      `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
      user.userId,
    );
    const myId = settingsRows[0]?.jellyseerr_user_id ?? null;
    if (!myId || seerrReq.requestedBy?.id !== myId) {
      return { ok: false, code: 403, message: "Not your request" };
    }
  }

  // Même logique de partiel que la branche locale : retirer certaines
  // saisons d'une demande Jellyseerr n'efface PAS la demande entière —
  // la réconciliation du worker l'édite (PUT saisons restantes).
  const seerrMediaType = seerrReq.media?.mediaType ?? "movie";
  const seerrSeasons = (seerrReq.seasons ?? [])
    .map((s) => s.seasonNumber)
    .filter((n) => typeof n === "number");
  const isSeasonSpecific = seerrMediaType === "tv" && !!opts.seasons && opts.seasons.length > 0;
  const removing = isSeasonSpecific
    ? opts.seasons!
    : (seerrMediaType === "tv" && seerrSeasons.length > 0 ? seerrSeasons : null);
  const remaining = isSeasonSpecific ? seerrSeasons.filter((s) => !removing!.includes(s)) : [];
  const partial = isSeasonSpecific && remaining.length > 0;

  await enqueueCleanup(db, {
    action: "delete",
    mediaType: seerrMediaType,
    tmdbId: seerrReq.media?.tmdbId ?? 0,
    title: `#${seerrReq.id}`,
    seerrRequestId: partial ? null : seerrReq.id,
    seerrMediaId: seerrReq.media?.id ?? null,
    deleteFiles: opts.deleteFiles,
    seasons: removing,
    requestId: null,
    jellyfinUserId: user.userId,
  });
  return { ok: true, status: partial ? "updated" : "deleting" };
}
