/* ------------------------------------------------------------------ */
/*  Seer Plugin — Database layer (schema + core CRUD)                  */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import type { SeerRequest, RequestStatus } from "./types";
import { uuid, rowToRequest } from "./db-helpers";
import { ensureTmdbCacheTable } from "./tmdb-cache";
import { ORIGIN_COLUMNS, recordRequestOrigin } from "./db-origin";
import type { RequestOrigin } from "./titles/request-origin";

type Prisma = PrismaClient;

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

/* ── Schema initialisation ─────────────────────────────────────────── */

/** Nombre de lignes d'une table, ou null si elle ne se lit pas (absente, base occupée…). */
async function countRows(prisma: Prisma, table: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<[{ cnt: bigint | number }]>(
      `SELECT COUNT(*) as cnt FROM ${table}`,
    );
    return Number(rows[0].cnt);
  } catch {
    return null;
  }
}

/**
 * Une colonne attendue manque-t-elle ? On le DIT, on ne supprime rien : l'ancienne
 * sonde faisait un DROP TABLE sur n'importe quelle erreur — une base occupée au
 * démarrage suffisait à effacer toutes les demandes.
 */
async function reportMissingColumn(prisma: Prisma, table: string, column: string): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(`SELECT ${column} FROM ${table} LIMIT 1`);
  } catch (err) {
    console.error(
      `[SeerDB] ${table}.${column} illisible — schéma inattendu ou base indisponible ; `
      + `aucune donnée supprimée :`, err instanceof Error ? err.message : err,
    );
  }
}

export async function ensureTables(prisma: Prisma): Promise<void> {
  // Une table absente se crée ci-dessous ; une table présente n'est jamais supprimée.
  const existingCount = await countRows(prisma, "seer_requests");
  if (existingCount !== null) {
    console.log(`[SeerDB] Table seer_requests exists with ${existingCount} rows — preserving data`);
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_requests (
      id               VARCHAR(36) NOT NULL PRIMARY KEY,
      jellyfin_user_id VARCHAR(255) NOT NULL,
      username         VARCHAR(255) NOT NULL,
      media_type       VARCHAR(10) NOT NULL,
      tmdb_id          INT NOT NULL,
      title            VARCHAR(500) NOT NULL,
      poster_path      VARCHAR(500),
      backdrop_path    VARCHAR(500),
      overview         TEXT,
      year             VARCHAR(10),
      seasons          JSON,
      status           VARCHAR(30) NOT NULL DEFAULT 'queued',
      seerr_request_id INT,
      seerr_media_id   INT,
      seerr_media_status INT,
      retry_count      INT NOT NULL DEFAULT 0,
      max_retries      INT NOT NULL DEFAULT 10,
      last_error       TEXT,
      priority         INT NOT NULL DEFAULT 0,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      sent_at          DATETIME,
      completed_at     DATETIME,
      INDEX idx_seer_req_user (jellyfin_user_id),
      INDEX idx_seer_req_status (status),
      INDEX idx_seer_req_queue (status, priority DESC, created_at ASC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_cleanup_queue (
      id               VARCHAR(36) NOT NULL PRIMARY KEY,
      action           VARCHAR(20) NOT NULL,
      media_type       VARCHAR(10) NOT NULL,
      tmdb_id          INT NOT NULL,
      title            VARCHAR(500) NOT NULL,
      seerr_request_id INT,
      seerr_media_id   INT,
      delete_files     TINYINT(1) NOT NULL DEFAULT 1,
      retry_count      INT NOT NULL DEFAULT 0,
      max_retries      INT NOT NULL DEFAULT 20,
      last_error       TEXT,
      status           VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      next_retry_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cleanup_status (status, next_retry_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migrations idempotentes
  const addColumn = async (table: string, col: string, def: string) => {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      console.log(`[SeerDB] Added column ${table}.${col}`);
    } catch { /* Column already exists */ }
  };

  await addColumn("seer_cleanup_queue", "request_id", "VARCHAR(36) DEFAULT NULL");
  await addColumn("seer_cleanup_queue", "seasons", "TEXT DEFAULT NULL");
  // Sans cette colonne, un cleanup vidait le cache de TOUS les utilisateurs :
  // une suppression par l'un faisait repayer le chargement complet aux autres.
  await addColumn("seer_cleanup_queue", "jellyfin_user_id", "VARCHAR(255) DEFAULT NULL");
  await addColumn("seer_requests", "pending_cleanup_id", "VARCHAR(36) DEFAULT NULL");
  await addColumn("seer_requests", "profile_id", "VARCHAR(36) DEFAULT NULL");
  await addColumn("seer_requests", "is_anime", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumn("seer_requests", "notified_seasons", "JSON DEFAULT NULL");
  // D'où part une demande (un téléviseur…) : vide pour tout ce qui ne le dit pas (db-origin.ts).
  for (const [col, def] of ORIGIN_COLUMNS) await addColumn("seer_requests", col, def);

  // Table seer_user_settings : permissions et quotas par utilisateur Jellyfin
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_user_settings (
      jellyfin_user_id     VARCHAR(255) NOT NULL PRIMARY KEY,
      username             VARCHAR(255) NOT NULL,
      blocked              TINYINT(1)   NOT NULL DEFAULT 0,
      daily_limit          INT          DEFAULT NULL,
      allow_movies         TINYINT(1)   NOT NULL DEFAULT 1,
      allow_tv             TINYINT(1)   NOT NULL DEFAULT 1,
      allow_anime          TINYINT(1)   NOT NULL DEFAULT 1,
      jellyseerr_user_id   INT          DEFAULT NULL,
      jellyseerr_last_sync DATETIME     DEFAULT NULL,
      created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_seer_user_seerrid (jellyseerr_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Mémoire durable des fiches TMDB (titres, affiches, dates de sortie).
  await ensureTmdbCacheTable(prisma);

  await reportMissingColumn(prisma, "seer_requests", "jellyfin_user_id");
  await reportMissingColumn(prisma, "seer_cleanup_queue", "next_retry_at");

  const finalCount = await countRows(prisma, "seer_requests");
  if (existingCount !== null && existingCount > 0 && finalCount === 0) {
    console.error(`[SeerDB] CRITICAL: ${existingCount} rows were lost!`);
  }
}

/* ── Request CRUD ──────────────────────────────────────────────────── */

export async function createRequest(
  prisma: Prisma,
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
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_requests
      (id, jellyfin_user_id, username, media_type, tmdb_id, title, poster_path,
       backdrop_path, overview, year, seasons, status, priority, profile_id, is_anime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`,
    id, data.jellyfinUserId, data.username, data.mediaType, data.tmdbId, data.title,
    data.posterPath || null, data.backdropPath || null, data.overview || null,
    data.year || null, data.seasons ? JSON.stringify(data.seasons) : null, data.priority || 0,
    data.profileId || null, data.isAnime ? 1 : 0,
  );
  if (data.origin) await recordRequestOrigin(prisma, id, data.origin);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests WHERE id = ?`, id,
  );
  return rowToRequest(rows[0]);
}

export async function getRequestById(prisma: Prisma, id: string): Promise<SeerRequest | null> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests WHERE id = ?`, id,
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}

export async function updateRequestStatus(
  prisma: Prisma, id: string, status: RequestStatus,
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
  await prisma.$executeRawUnsafe(`UPDATE seer_requests SET ${sets.join(", ")} WHERE id = ?`, ...params);
}

export async function deleteRequestById(prisma: Prisma, id: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM seer_requests WHERE id = ?`, id);
}

export async function findDuplicate(
  prisma: Prisma, jellyfinUserId: string, tmdbId: number,
  mediaType: string, seasons?: number[] | null,
): Promise<SeerRequest | null> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
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

/** Trouver une demande TV active existante pour le même tmdbId (pour fusion de saisons) */
export async function findExistingTvRequest(
  prisma: Prisma, jellyfinUserId: string, tmdbId: number,
): Promise<SeerRequest | null> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = 'tv'
       AND status NOT IN ('deleted', 'deleting', 'delete_failed')
     ORDER BY created_at DESC, id ASC LIMIT 1`,
    jellyfinUserId, tmdbId,
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}

/** Mettre à jour les saisons affichées d'une demande (sans changer le status ni les IDs Seerr) */
export async function addSeasonsToRequest(
  prisma: Prisma, id: string, seasons: number[],
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET seasons = ? WHERE id = ?`,
    JSON.stringify(seasons), id,
  );
}

/** Mémorise les saisons déjà notifiées comme disponibles (delta anti-doublon). */
export async function setNotifiedSeasons(
  prisma: Prisma, id: string, seasons: number[],
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET notified_seasons = ? WHERE id = ?`,
    JSON.stringify(seasons), id,
  );
}

export async function getNextQueued(prisma: Prisma): Promise<SeerRequest | null> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests
     WHERE status IN ('queued', 'retry_pending')
       AND (pending_cleanup_id IS NULL)
     ORDER BY priority DESC, created_at ASC, id ASC
     LIMIT 1`,
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}

export async function getRequestsToSync(prisma: Prisma): Promise<SeerRequest[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests
     WHERE seerr_request_id IS NOT NULL
       AND status NOT IN ('available', 'failed', 'deleted', 'deleting', 'delete_failed')`,
  );
  return rows.map(rowToRequest);
}
