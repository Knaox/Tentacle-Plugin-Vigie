/* ------------------------------------------------------------------ */
/*  Seer Plugin — Database layer (schema + core CRUD)                  */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import type { SeerRequest, RequestStatus, SeerUserSettings, AdminUserRow } from "./types";
import { uuid, rowToRequest, rowToUserSettings } from "./db-helpers";
import { ensureTmdbCacheTable } from "./tmdb-cache";

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

/* ── Schema initialisation ─────────────────────────────────────────── */

export async function ensureTables(prisma: Prisma): Promise<void> {
  let existingCount = 0;
  try {
    // Vérifier que la table a le bon schéma (colonne jellyfin_user_id)
    await prisma.$queryRawUnsafe(`SELECT jellyfin_user_id FROM seer_requests LIMIT 1`);
    const rows = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
      `SELECT COUNT(*) as cnt FROM seer_requests`,
    );
    existingCount = Number(rows[0].cnt);
    console.log(`[SeerDB] Table seer_requests exists with ${existingCount} rows — preserving data`);
  } catch {
    // Table inexistante ou schéma incompatible → recréer
    console.log("[SeerDB] Table seer_requests missing or incompatible — recreating");
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS seer_requests`).catch(() => {});
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

  // Vérifier schéma cleanup queue
  try {
    await prisma.$queryRawUnsafe(`SELECT next_retry_at FROM seer_cleanup_queue LIMIT 1`);
  } catch {
    console.log("[SeerDB] Table seer_cleanup_queue missing or incompatible — recreating");
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS seer_cleanup_queue`).catch(() => {});
  }

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

  const rows = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
    `SELECT COUNT(*) as cnt FROM seer_requests`,
  );
  const finalCount = Number(rows[0].cnt);
  if (existingCount > 0 && finalCount === 0) {
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
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests WHERE id = ?`, id,
  );
  return rowToRequest(rows[0]);
}

/* ── User settings CRUD ───────────────────────────────────────────── */

export async function getOrCreateUserSettings(
  prisma: Prisma,
  jellyfinUserId: string,
  username: string,
): Promise<SeerUserSettings> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId,
  );
  if (rows.length > 0) {
    if (username && rows[0].username !== username) {
      await prisma.$executeRawUnsafe(
        `UPDATE seer_user_settings SET username = ? WHERE jellyfin_user_id = ?`,
        username, jellyfinUserId,
      );
      rows[0].username = username;
    }
    return rowToUserSettings(rows[0]);
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_user_settings
      (jellyfin_user_id, username, blocked, daily_limit, allow_movies, allow_tv, allow_anime)
     VALUES (?, ?, 0, NULL, 1, 1, 1)`,
    jellyfinUserId, username || jellyfinUserId,
  );
  const created = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId,
  );
  return rowToUserSettings(created[0]);
}

export async function getUserSettings(
  prisma: Prisma,
  jellyfinUserId: string,
): Promise<SeerUserSettings | null> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId,
  );
  return rows.length > 0 ? rowToUserSettings(rows[0]) : null;
}

export async function updateUserSettings(
  prisma: Prisma,
  jellyfinUserId: string,
  patch: Partial<{
    blocked: boolean;
    dailyLimit: number | null;
    allowMovies: boolean;
    allowTv: boolean;
    allowAnime: boolean;
    jellyseerrUserId: number | null;
    jellyseerrLastSync: Date | null;
    username: string;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.blocked !== undefined) { sets.push("blocked = ?"); params.push(patch.blocked ? 1 : 0); }
  if (patch.dailyLimit !== undefined) { sets.push("daily_limit = ?"); params.push(patch.dailyLimit); }
  if (patch.allowMovies !== undefined) { sets.push("allow_movies = ?"); params.push(patch.allowMovies ? 1 : 0); }
  if (patch.allowTv !== undefined) { sets.push("allow_tv = ?"); params.push(patch.allowTv ? 1 : 0); }
  if (patch.allowAnime !== undefined) { sets.push("allow_anime = ?"); params.push(patch.allowAnime ? 1 : 0); }
  if (patch.jellyseerrUserId !== undefined) { sets.push("jellyseerr_user_id = ?"); params.push(patch.jellyseerrUserId); }
  if (patch.jellyseerrLastSync !== undefined) { sets.push("jellyseerr_last_sync = ?"); params.push(patch.jellyseerrLastSync); }
  if (patch.username !== undefined) { sets.push("username = ?"); params.push(patch.username); }
  if (sets.length === 0) return;
  params.push(jellyfinUserId);
  await prisma.$executeRawUnsafe(
    `UPDATE seer_user_settings SET ${sets.join(", ")} WHERE jellyfin_user_id = ?`,
    ...params,
  );
}

export async function countRequestsToday(
  prisma: Prisma,
  jellyfinUserId: string,
): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
    `SELECT COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ?
       AND created_at >= CURDATE()
       AND status NOT IN ('failed', 'deleted')`,
    jellyfinUserId,
  );
  return Number(rows[0].cnt);
}

export async function listUsersWithStats(prisma: Prisma): Promise<AdminUserRow[]> {
  // Union de seer_user_settings + users distincts de seer_requests qui n'ont pas encore de settings
  const settingsRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT s.*,
       (SELECT COUNT(*) FROM seer_requests r
          WHERE r.jellyfin_user_id = s.jellyfin_user_id
            AND r.created_at >= CURDATE()
            AND r.status NOT IN ('failed', 'deleted')) AS requests_today,
       (SELECT COUNT(*) FROM seer_requests r
          WHERE r.jellyfin_user_id = s.jellyfin_user_id
            AND r.status != 'deleted') AS requests_total
     FROM seer_user_settings s
     ORDER BY s.username ASC`,
  );

  const known = new Set(settingsRows.map((r) => r.jellyfin_user_id));
  const orphanRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT
       r.jellyfin_user_id,
       MAX(r.username) AS username,
       SUM(CASE WHEN r.created_at >= CURDATE() AND r.status NOT IN ('failed','deleted') THEN 1 ELSE 0 END) AS requests_today,
       SUM(CASE WHEN r.status != 'deleted' THEN 1 ELSE 0 END) AS requests_total
     FROM seer_requests r
     GROUP BY r.jellyfin_user_id`,
  );

  const result: AdminUserRow[] = settingsRows.map((r) => ({
    ...rowToUserSettings(r),
    requestsToday: Number(r.requests_today) || 0,
    requestsTotal: Number(r.requests_total) || 0,
  }));

  for (const o of orphanRows) {
    if (known.has(o.jellyfin_user_id)) continue;
    const userId = o.jellyfin_user_id as string;
    const username = (o.username as string) || userId;
    result.push({
      jellyfinUserId: userId,
      username,
      blocked: false,
      dailyLimit: null,
      allowMovies: true,
      allowTv: true,
      allowAnime: true,
      jellyseerrUserId: null,
      jellyseerrLastSync: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requestsToday: Number(o.requests_today) || 0,
      requestsTotal: Number(o.requests_total) || 0,
    });
  }

  return result.sort((a, b) => a.username.localeCompare(b.username));
}

/**
 * Variante stricte : ne renvoie QUE les users passés en input (= vrais users Jellyfin).
 * Charge ou crée les settings, calcule les stats, ignore les rows locales orphelines.
 */
export async function listJellyfinUsersWithStats(
  prisma: Prisma,
  jellyfinUsers: Array<{ id: string; name: string }>,
): Promise<AdminUserRow[]> {
  if (jellyfinUsers.length === 0) return [];

  // 1) Charge en masse les settings existants
  const ids = jellyfinUsers.map((u) => u.id);
  const placeholders = ids.map(() => "?").join(",");
  const settingsRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id IN (${placeholders})`,
    ...ids,
  );
  const settingsByUserId = new Map<string, SeerUserSettings>();
  for (const row of settingsRows) {
    const s = rowToUserSettings(row);
    settingsByUserId.set(s.jellyfinUserId, s);
  }

  // 2) Stats agrégées (par user)
  const statsRows = await prisma.$queryRawUnsafe<Array<{
    jellyfin_user_id: string; requests_today: bigint | number; requests_total: bigint | number;
  }>>(
    `SELECT
       jellyfin_user_id,
       SUM(CASE WHEN created_at >= CURDATE() AND status NOT IN ('failed','deleted') THEN 1 ELSE 0 END) AS requests_today,
       SUM(CASE WHEN status != 'deleted' THEN 1 ELSE 0 END) AS requests_total
     FROM seer_requests
     WHERE jellyfin_user_id IN (${placeholders})
     GROUP BY jellyfin_user_id`,
    ...ids,
  );
  const statsByUserId = new Map<string, { today: number; total: number }>();
  for (const r of statsRows) {
    statsByUserId.set(r.jellyfin_user_id, {
      today: Number(r.requests_today) || 0,
      total: Number(r.requests_total) || 0,
    });
  }

  // 3) Compose le résultat — crée à la volée les settings manquants (lazy)
  const result: AdminUserRow[] = [];
  for (const u of jellyfinUsers) {
    let settings = settingsByUserId.get(u.id);
    if (!settings) {
      settings = await getOrCreateUserSettings(prisma, u.id, u.name);
    } else if (u.name && u.name !== u.id && settings.username !== u.name) {
      // Met à jour le username si la source autoritative en a un meilleur
      const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
      if (isUuid.test(settings.username) || settings.username === u.id) {
        await updateUserSettings(prisma, u.id, { username: u.name });
        settings = { ...settings, username: u.name };
      }
    }
    const s = statsByUserId.get(u.id) ?? { today: 0, total: 0 };
    result.push({ ...settings, requestsToday: s.today, requestsTotal: s.total });
  }
  return result.sort((a, b) => a.username.localeCompare(b.username));
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
     ORDER BY created_at DESC LIMIT 1`,
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
     ORDER BY priority DESC, created_at ASC
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
