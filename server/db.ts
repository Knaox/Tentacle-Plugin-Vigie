/* ------------------------------------------------------------------ */
/*  Seer Plugin — Database layer (core CRUD ; schéma : storage/)       */
/* ------------------------------------------------------------------ */

import type { VigieDb } from "./storage/vigie-db";
import type { SeerRequest, RequestStatus } from "./types";
import { uuid, rowToRequest } from "./db-helpers";
import { recordRequestOrigin } from "./db-origin";
import type { RequestOrigin } from "./titles/request-origin";

// Re-export everything from sub-modules for backward compatibility
export { rowToRequest, rowToUserSettings, toIso, uuid } from "./db-helpers";
export { getUserRequests, getAllRequests, getQueueStatus, getUserStats, getGlobalStats } from "./db-queries";
export {
  enqueueCleanup, getPendingCleanups, updateCleanupJob,
  clearPendingCleanup, setPendingCleanup, cancelCleanupsForRequest,
  type CleanupJob,
} from "./db-cleanup";
export { upsertContentClaim, purgeExpiredContentClaims } from "./db-claims";
export { getOrCreateUserSettings, getUserSettings, updateUserSettings, countRequestsToday } from "./db-users";

/* ── Request CRUD ──────────────────────────────────────────────────── */

export async function createRequest(
  db: VigieDb,
  data: {
    jellyfinUserId: string; username: string; mediaType: "movie" | "tv";
    tmdbId: number; title: string; posterPath?: string | null;
    backdropPath?: string | null; overview?: string | null;
    year?: string | null; seasons?: number[] | null; priority?: number;
    profileId?: string | null; isAnime?: boolean;
    /** D'où part la demande ; gardée au mieux, à part (db-origin.ts). */
    origin?: RequestOrigin | null;
  },
): Promise<SeerRequest> {
  const id = uuid();
  await db.execute(
    `INSERT INTO seer_requests
      (id, jellyfin_user_id, username, media_type, tmdb_id, title, poster_path,
       backdrop_path, overview, year, seasons, status, priority, profile_id, is_anime,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ${db.sql.now()}, ${db.sql.now()})`,
    id, data.jellyfinUserId, data.username, data.mediaType, data.tmdbId, data.title,
    data.posterPath || null, data.backdropPath || null, data.overview || null,
    data.year || null, data.seasons ? JSON.stringify(data.seasons) : null, data.priority || 0,
    data.profileId || null, data.isAnime ? 1 : 0,
  );
  if (data.origin) await recordRequestOrigin(db, id, data.origin);
  const rows = await db.query(
    `SELECT * FROM seer_requests WHERE id = ?`, id,
  );
  return rowToRequest(rows[0]);
}

export async function getRequestById(db: VigieDb, id: string): Promise<SeerRequest | null> {
  const rows = await db.query(
    `SELECT * FROM seer_requests WHERE id = ?`, id,
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}

export async function updateRequestStatus(
  db: VigieDb, id: string, status: RequestStatus,
  extra?: Partial<{
    seerrRequestId: number; seerrMediaId: number; seerrMediaStatus: number;
    lastError: string; retryCount: number; sentAt: Date; completedAt: Date;
  }>,
): Promise<void> {
  const sets: string[] = ["status = ?"];
  const params: unknown[] = [status];
  if (extra?.seerrRequestId !== undefined) { sets.push("seerr_request_id = ?"); params.push(extra.seerrRequestId); }
  if (extra?.seerrMediaId !== undefined) { sets.push("seerr_media_id = ?"); params.push(extra.seerrMediaId); }
  if (extra?.seerrMediaStatus !== undefined) { sets.push("seerr_media_status = ?"); params.push(extra.seerrMediaStatus); }
  if (extra?.lastError !== undefined) { sets.push("last_error = ?"); params.push(extra.lastError); }
  if (extra?.retryCount !== undefined) { sets.push("retry_count = ?"); params.push(extra.retryCount); }
  if (extra?.sentAt !== undefined) { sets.push("sent_at = ?"); params.push(extra.sentAt); }
  if (extra?.completedAt !== undefined) { sets.push("completed_at = ?"); params.push(extra.completedAt); }
  params.push(id);
  await db.execute(`UPDATE seer_requests SET updated_at = ${db.sql.now()}, ${sets.join(", ")} WHERE id = ?`, ...params);
}

export async function deleteRequestById(db: VigieDb, id: string): Promise<void> {
  await db.execute(`DELETE FROM seer_requests WHERE id = ?`, id);
}

export async function findDuplicate(
  db: VigieDb, jellyfinUserId: string, tmdbId: number,
  mediaType: string, seasons?: number[] | null,
): Promise<SeerRequest | null> {
  const rows = await db.query(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = ?
       AND status NOT IN ('deleted', 'failed', 'available', 'deleting', 'delete_failed')`,
    jellyfinUserId, tmdbId, mediaType,
  );
  if (rows.length === 0) return null;
  if (mediaType === "movie") return rowToRequest(rows[0]);

  const requestedSeasons = new Set(seasons ?? []);
  if (requestedSeasons.size === 0) return rowToRequest(rows[0]);

  for (const row of rows) {
    const existing = rowToRequest(row);
    const existingSeasons = new Set(existing.seasons ?? []);
    if (existingSeasons.size === 0) return existing;
    for (const s of requestedSeasons) {
      if (existingSeasons.has(s)) return existing;
    }
  }
  return null;
}

/**
 * Trouver une demande TV active existante pour le même tmdbId (pour fusion de
 * saisons). Ni une demande arrivée (« disponible ») ni une demande en échec :
 * leurs saisons ne se fusionnent plus — une saison supprimée de Jellyfin puis
 * redemandée était refusée (« toutes les saisons déjà demandées ») par la
 * ligne de sa première arrivée, pour toujours.
 */
export async function findExistingTvRequest(
  db: VigieDb, jellyfinUserId: string, tmdbId: number,
): Promise<SeerRequest | null> {
  const rows = await db.query(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = 'tv'
       AND status NOT IN ('deleted', 'deleting', 'delete_failed', 'available', 'failed')
     ORDER BY created_at DESC, id ASC LIMIT 1`,
    jellyfinUserId, tmdbId,
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}

/** Mettre à jour les saisons affichées d'une demande (sans changer le status ni les IDs Seerr) */
export async function addSeasonsToRequest(
  db: VigieDb, id: string, seasons: number[],
): Promise<void> {
  await db.execute(
    `UPDATE seer_requests SET updated_at = ${db.sql.now()}, seasons = ? WHERE id = ?`,
    JSON.stringify(seasons), id,
  );
}

/** Mémorise les saisons déjà notifiées comme disponibles (delta anti-doublon). */
export async function setNotifiedSeasons(
  db: VigieDb, id: string, seasons: number[],
): Promise<void> {
  await db.execute(
    `UPDATE seer_requests SET updated_at = ${db.sql.now()}, notified_seasons = ? WHERE id = ?`,
    JSON.stringify(seasons), id,
  );
}

/**
 * La prochaine demande à envoyer. `exclude` : celles déjà vues à cette passe,
 * ou qui attendent Jellyseerr (live/seerr-unblock.ts) — sans quoi la plus
 * ancienne, si elle doit repasser, bloquait toute la file jusqu'à la passe
 * suivante.
 */
export async function getNextQueued(db: VigieDb, exclude: readonly string[] = []): Promise<SeerRequest | null> {
  const skip = exclude.slice(0, 500);
  const rows = await db.query(
    `SELECT * FROM seer_requests
     WHERE status IN ('queued', 'retry_pending')
       AND (pending_cleanup_id IS NULL)
       ${skip.length > 0 ? `AND id NOT IN (${skip.map(() => "?").join(", ")})` : ""}
     ORDER BY priority DESC, created_at ASC, id ASC
     LIMIT 1`,
    ...skip,
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}

export async function getRequestsToSync(db: VigieDb): Promise<SeerRequest[]> {
  const rows = await db.query(
    `SELECT * FROM seer_requests
     WHERE seerr_request_id IS NOT NULL
       AND status NOT IN ('available', 'failed', 'deleted', 'deleting', 'delete_failed')`,
  );
  return rows.map(rowToRequest);
}
