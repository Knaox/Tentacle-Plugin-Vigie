// Seer Plugin — Server module (auto-generated, do not edit)

// server/index.ts
import { resolve, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { fileURLToPath } from "url";

// server/db-helpers.ts
function uuid() {
  return crypto.randomUUID();
}
function rowToRequest(r) {
  return {
    id: r.id,
    jellyfinUserId: r.jellyfin_user_id,
    username: r.username,
    mediaType: r.media_type,
    tmdbId: r.tmdb_id,
    title: r.title,
    posterPath: r.poster_path || null,
    backdropPath: r.backdrop_path || null,
    overview: r.overview || null,
    year: r.year || null,
    seasons: r.seasons ? typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons : null,
    notifiedSeasons: r.notified_seasons ? typeof r.notified_seasons === "string" ? JSON.parse(r.notified_seasons) : r.notified_seasons : null,
    status: r.status,
    seerrRequestId: r.seerr_request_id || null,
    seerrMediaId: r.seerr_media_id || null,
    seerrMediaStatus: r.seerr_media_status || null,
    retryCount: r.retry_count || 0,
    maxRetries: r.max_retries || 10,
    lastError: r.last_error || null,
    priority: r.priority || 0,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    sentAt: r.sent_at ? toIso(r.sent_at) : null,
    completedAt: r.completed_at ? toIso(r.completed_at) : null,
    pendingCleanupId: r.pending_cleanup_id || null,
    profileId: r.profile_id || null,
    isAnime: Boolean(r.is_anime)
  };
}
function rowToUserSettings(r) {
  return {
    jellyfinUserId: r.jellyfin_user_id,
    username: r.username,
    blocked: Boolean(r.blocked),
    dailyLimit: r.daily_limit === null || r.daily_limit === void 0 ? null : Number(r.daily_limit),
    allowMovies: Boolean(r.allow_movies),
    allowTv: Boolean(r.allow_tv),
    allowAnime: Boolean(r.allow_anime),
    jellyseerrUserId: r.jellyseerr_user_id === null || r.jellyseerr_user_id === void 0 ? null : Number(r.jellyseerr_user_id),
    jellyseerrLastSync: r.jellyseerr_last_sync ? toIso(r.jellyseerr_last_sync) : null,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at)
  };
}
function toIso(v) {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return (/* @__PURE__ */ new Date()).toISOString();
}

// server/concurrency.ts
var DEFAULT_CONCURRENCY = 6;
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length).fill(null);
  if (items.length === 0) return out;
  const workers = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (; ; ) {
        const i = cursor++;
        if (i >= items.length) return;
        try {
          out[i] = await fn(items[i], i);
        } catch {
          out[i] = null;
        }
      }
    })
  );
  return out;
}
async function mapLimitStrict(items, limit, fn) {
  const out = new Array(items.length);
  if (items.length === 0) return out;
  const workers = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (; ; ) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}
function chunk(items, size) {
  if (size <= 0) return [items.slice()];
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// server/tmdb-cache-schema.ts
async function ensureTmdbCacheTable(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_tmdb_cache (
      media_type      VARCHAR(10)  NOT NULL,
      tmdb_id         INT          NOT NULL,
      title           VARCHAR(500) NOT NULL DEFAULT '',
      poster_path     VARCHAR(500) DEFAULT NULL,
      backdrop_path   VARCHAR(500) DEFAULT NULL,
      overview        TEXT         DEFAULT NULL,
      release_date    CHAR(10)     DEFAULT NULL,
      tmdb_status     VARCHAR(40)  DEFAULT NULL,
      digital_date    CHAR(10)     DEFAULT NULL,
      theatrical_date CHAR(10)     DEFAULT NULL,
      physical_date   CHAR(10)     DEFAULT NULL,
      release_region  CHAR(2)      DEFAULT NULL,
      next_air_date   CHAR(10)     DEFAULT NULL,
      next_season     SMALLINT     DEFAULT NULL,
      next_episode    SMALLINT     DEFAULT NULL,
      last_air_date   CHAR(10)     DEFAULT NULL,
      networks        VARCHAR(255) DEFAULT NULL,
      provider_ids    VARCHAR(255) DEFAULT NULL,
      vote_average      DECIMAL(3,1) DEFAULT NULL,
      popularity        DECIMAL(8,3) DEFAULT NULL,
      original_language CHAR(2)      DEFAULT NULL,
      genre_ids         VARCHAR(120) DEFAULT NULL,
      is_anime          TINYINT(1)   NOT NULL DEFAULT 0,
      fetched_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at      DATETIME     NOT NULL,
      PRIMARY KEY (media_type, tmdb_id),
      INDEX idx_tmdbc_expires  (expires_at),
      INDEX idx_tmdbc_next_air (next_air_date),
      INDEX idx_tmdbc_digital  (digital_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const addColumn = async (col, def) => {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE seer_tmdb_cache ADD COLUMN ${col} ${def}`);
      console.log(`[SeerTmdb] Colonne ajout\xE9e : ${col}`);
    } catch {
    }
  };
  await addColumn("vote_average", "DECIMAL(3,1) DEFAULT NULL");
  await addColumn("popularity", "DECIMAL(8,3) DEFAULT NULL");
  await addColumn("original_language", "CHAR(2) DEFAULT NULL");
  await addColumn("genre_ids", "VARCHAR(120) DEFAULT NULL");
  await addColumn("is_anime", "TINYINT(1) NOT NULL DEFAULT 0");
}

// server/tmdb-cache.ts
function tmdbKey(ref) {
  return `${ref.mediaType}:${ref.tmdbId}`;
}
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function asDate(v) {
  if (typeof v === "string" && DATE_RE.test(v)) return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}
function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function asNumOrNull(v) {
  if (v === null || v === void 0 || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function asIdList(v) {
  return String(v ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
}
function rowToMeta(row) {
  const ids = asIdList(row.provider_ids);
  return {
    mediaType: row.media_type === "tv" ? "tv" : "movie",
    tmdbId: Number(row.tmdb_id),
    title: String(row.title ?? ""),
    posterPath: row.poster_path ?? null,
    backdropPath: row.backdrop_path ?? null,
    overview: row.overview ?? null,
    releaseDate: asDate(row.release_date),
    tmdbStatus: row.tmdb_status ?? null,
    digitalDate: asDate(row.digital_date),
    theatricalDate: asDate(row.theatrical_date),
    physicalDate: asDate(row.physical_date),
    releaseRegion: row.release_region ?? null,
    nextAirDate: asDate(row.next_air_date),
    nextSeason: asNum(row.next_season),
    nextEpisode: asNum(row.next_episode),
    lastAirDate: asDate(row.last_air_date),
    networks: row.networks ?? null,
    providerIds: ids,
    voteAverage: asNumOrNull(row.vote_average),
    popularity: asNumOrNull(row.popularity),
    originalLanguage: row.original_language || null,
    genreIds: asIdList(row.genre_ids),
    isAnime: row.is_anime === 1 || row.is_anime === true,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at ?? "")
  };
}
async function getTmdbMetaBulk(prisma, refs, includeExpired = true) {
  const out = /* @__PURE__ */ new Map();
  if (refs.length === 0) return out;
  const byType = { movie: [], tv: [] };
  for (const r of refs) {
    if (Number.isFinite(r.tmdbId) && r.tmdbId > 0) byType[r.mediaType].push(r.tmdbId);
  }
  const freshOnly = includeExpired ? "" : " AND expires_at > NOW()";
  for (const type of ["movie", "tv"]) {
    const ids = Array.from(new Set(byType[type]));
    for (const slice of chunk(ids, 500)) {
      if (slice.length === 0) continue;
      const placeholders = slice.map(() => "?").join(",");
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM seer_tmdb_cache
         WHERE media_type = ? AND tmdb_id IN (${placeholders})${freshOnly}`,
        type,
        ...slice
      );
      for (const row of rows) {
        const meta = rowToMeta(row);
        out.set(tmdbKey(meta), meta);
      }
    }
  }
  return out;
}
var UPSERT_COLS = [
  "media_type",
  "tmdb_id",
  "title",
  "poster_path",
  "backdrop_path",
  "overview",
  "release_date",
  "tmdb_status",
  "digital_date",
  "theatrical_date",
  "physical_date",
  "release_region",
  "next_air_date",
  "next_season",
  "next_episode",
  "last_air_date",
  "networks",
  "provider_ids",
  "vote_average",
  "popularity",
  "original_language",
  "genre_ids",
  "is_anime",
  "expires_at"
];
async function upsertTmdbMetaBulk(prisma, rows) {
  if (rows.length === 0) return;
  const updates = UPSERT_COLS.filter((c) => c !== "media_type" && c !== "tmdb_id").map((c) => `${c} = VALUES(${c})`).join(", ");
  for (const slice of chunk(rows, 100)) {
    const tuple = `(${UPSERT_COLS.map(() => "?").join(",")})`;
    const values = [];
    for (const m of slice) {
      values.push(
        m.mediaType,
        m.tmdbId,
        m.title.slice(0, 500),
        m.posterPath,
        m.backdropPath,
        m.overview,
        m.releaseDate,
        m.tmdbStatus,
        m.digitalDate,
        m.theatricalDate,
        m.physicalDate,
        m.releaseRegion,
        m.nextAirDate,
        m.nextSeason,
        m.nextEpisode,
        m.lastAirDate,
        m.networks,
        m.providerIds.join(","),
        m.voteAverage ?? null,
        m.popularity ?? null,
        m.originalLanguage ?? null,
        (m.genreIds ?? []).join(",") || null,
        m.isAnime ? 1 : 0,
        new Date(m.expiresAt)
      );
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO seer_tmdb_cache (${UPSERT_COLS.join(",")})
       VALUES ${slice.map(() => tuple).join(",")}
       ON DUPLICATE KEY UPDATE ${updates}, fetched_at = CURRENT_TIMESTAMP`,
      ...values
    );
  }
}
async function seedTmdbCacheFromLocalRequests(prisma) {
  const affected = await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO seer_tmdb_cache
      (media_type, tmdb_id, title, poster_path, backdrop_path, overview, release_date, expires_at)
    SELECT r.media_type, r.tmdb_id,
           MAX(r.title), MAX(r.poster_path), MAX(r.backdrop_path), MAX(r.overview),
           NULL, NOW()
    FROM seer_requests r
    WHERE r.tmdb_id > 0 AND r.title <> ''
    GROUP BY r.media_type, r.tmdb_id
  `);
  return Number(affected) || 0;
}
async function listStaleTmdbRefs(prisma, limit) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT media_type, tmdb_id FROM seer_tmdb_cache
     WHERE expires_at <= NOW() ORDER BY expires_at ASC LIMIT ${Math.max(1, Math.floor(limit))}`
  );
  return rows.map((r) => ({
    mediaType: r.media_type === "tv" ? "tv" : "movie",
    tmdbId: Number(r.tmdb_id)
  }));
}
async function pruneTmdbCache(prisma, olderThanDays) {
  const n = await prisma.$executeRawUnsafe(
    `DELETE FROM seer_tmdb_cache WHERE fetched_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    Math.max(1, Math.floor(olderThanDays))
  );
  return Number(n) || 0;
}

// server/db-queries.ts
async function getUserRequests(prisma, jellyfinUserId, opts) {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;
  let where = `WHERE jellyfin_user_id = ? AND status != 'deleted'`;
  const params = [jellyfinUserId];
  if (opts.status) {
    const statuses2 = opts.status.split(",").map((s) => s.trim());
    where += ` AND status IN (${statuses2.map(() => "?").join(",")})`;
    params.push(...statuses2);
  }
  if (opts.mediaType) {
    where += ` AND media_type = ?`;
    params.push(opts.mediaType);
  }
  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM seer_requests ${where}`,
    ...params
  );
  const total = Number(countRows[0].cnt);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return { results: rows.map(rowToRequest), total, page, pages: Math.ceil(total / limit) || 1 };
}
async function getAllRequests(prisma, opts) {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;
  let where = `WHERE status != 'deleted'`;
  const params = [];
  if (opts.status) {
    const statuses2 = opts.status.split(",").map((s) => s.trim());
    where += ` AND status IN (${statuses2.map(() => "?").join(",")})`;
    params.push(...statuses2);
  }
  if (opts.mediaType) {
    where += ` AND media_type = ?`;
    params.push(opts.mediaType);
  }
  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM seer_requests ${where}`,
    ...params
  );
  const total = Number(countRows[0].cnt);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return { results: rows.map(rowToRequest), total, page, pages: Math.ceil(total / limit) || 1 };
}
async function getQueueStatus(prisma, jellyfinUserId) {
  const userFilter = jellyfinUserId ? ` AND jellyfin_user_id = ?` : "";
  const userParams = jellyfinUserId ? [jellyfinUserId] : [];
  const processingRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE status = 'processing'${userFilter} LIMIT 1`,
    ...userParams
  );
  const countRows = await prisma.$queryRawUnsafe(
    `SELECT
       SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
       SUM(CASE WHEN status = 'retry_pending' THEN 1 ELSE 0 END) as retry_pending,
       SUM(CASE WHEN status = 'deleting' THEN 1 ELSE 0 END) as deleting
     FROM seer_requests WHERE status IN ('queued', 'retry_pending', 'deleting')${userFilter}`,
    ...userParams
  );
  return {
    processing: processingRows.length > 0 ? rowToRequest(processingRows[0]) : null,
    queued: Number(countRows[0].queued) || 0,
    retryPending: Number(countRows[0].retry_pending) || 0,
    deleting: Number(countRows[0].deleting) || 0
  };
}
async function getUserStats(prisma, jellyfinUserId) {
  const byStatus = await prisma.$queryRawUnsafe(
    `SELECT status, COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ? AND status != 'deleted'
     GROUP BY status`,
    jellyfinUserId
  );
  const byType = await prisma.$queryRawUnsafe(
    `SELECT media_type, COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ? AND status != 'deleted'
     GROUP BY media_type`,
    jellyfinUserId
  );
  const total = byStatus.reduce((n, r) => n + Number(r.cnt), 0);
  return {
    totalRequests: total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.cnt)])),
    byType: Object.fromEntries(byType.map((r) => [r.media_type, Number(r.cnt)]))
  };
}
async function getGlobalStats(prisma) {
  const byStatus = await prisma.$queryRawUnsafe(
    `SELECT status, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY status`
  );
  const byType = await prisma.$queryRawUnsafe(
    `SELECT media_type, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY media_type`
  );
  const topRequested = await prisma.$queryRawUnsafe(
    `SELECT title, tmdb_id, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY title, tmdb_id ORDER BY cnt DESC LIMIT 10`
  );
  const topUsers = await prisma.$queryRawUnsafe(
    `SELECT username, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY username ORDER BY cnt DESC LIMIT 10`
  );
  const total = byStatus.reduce((n, r) => n + Number(r.cnt), 0);
  const available = Number(byStatus.find((r) => r.status === "available")?.cnt || 0);
  return {
    totalRequests: total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.cnt)])),
    byType: Object.fromEntries(byType.map((r) => [r.media_type, Number(r.cnt)])),
    topRequested: topRequested.map((r) => ({ title: r.title, tmdbId: r.tmdb_id, count: Number(r.cnt) })),
    topUsers: topUsers.map((r) => ({ username: r.username, count: Number(r.cnt) })),
    successRate: total > 0 ? Math.round(available / total * 100) : 0
  };
}

// server/db-cleanup.ts
function parseSeasons(raw) {
  if (raw == null) return null;
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) {
      const nums = arr.map(Number).filter((n) => Number.isFinite(n));
      return nums.length > 0 ? nums : null;
    }
  } catch {
  }
  return null;
}
async function enqueueCleanup(prisma, job) {
  const id = uuid();
  const delay = Math.max(0, Math.floor(job.delaySeconds ?? 0));
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_cleanup_queue (id, action, media_type, tmdb_id, title, seerr_request_id, seerr_media_id, delete_files, seasons, request_id, jellyfin_user_id, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    id,
    job.action,
    job.mediaType,
    job.tmdbId,
    job.title,
    job.seerrRequestId ?? null,
    job.seerrMediaId ?? null,
    job.deleteFiles ? 1 : 0,
    job.seasons && job.seasons.length > 0 ? JSON.stringify(job.seasons) : null,
    job.requestId ?? null,
    job.jellyfinUserId ?? null,
    delay
  );
  return id;
}
async function getPendingCleanups(prisma, limit = 25) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_cleanup_queue
     WHERE status = 'pending' AND next_retry_at <= NOW()
     ORDER BY created_at ASC LIMIT ${Math.max(1, Math.min(100, limit))}`
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    mediaType: r.media_type,
    tmdbId: r.tmdb_id,
    title: r.title,
    seerrRequestId: r.seerr_request_id || null,
    seerrMediaId: r.seerr_media_id || null,
    deleteFiles: Boolean(r.delete_files),
    seasons: parseSeasons(r.seasons),
    retryCount: r.retry_count || 0,
    maxRetries: r.max_retries || 20,
    lastError: r.last_error || null,
    status: r.status,
    nextRetryAt: toIso(r.next_retry_at),
    requestId: r.request_id || null,
    jellyfinUserId: r.jellyfin_user_id || null
  }));
}
async function updateCleanupJob(prisma, id, status, extra) {
  const sets = ["status = ?"];
  const params = [status];
  if (extra?.lastError !== void 0) {
    sets.push("last_error = ?");
    params.push(extra.lastError);
  }
  if (extra?.retryCount !== void 0) {
    sets.push("retry_count = ?");
    params.push(extra.retryCount);
  }
  if (extra?.nextRetryAt !== void 0) {
    sets.push("next_retry_at = ?");
    params.push(extra.nextRetryAt);
  }
  params.push(id);
  await prisma.$executeRawUnsafe(`UPDATE seer_cleanup_queue SET ${sets.join(", ")} WHERE id = ?`, ...params);
}
async function clearPendingCleanup(prisma, cleanupId) {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET pending_cleanup_id = NULL WHERE pending_cleanup_id = ?`,
    cleanupId
  );
}

// server/db-claims.ts
async function upsertContentClaim(prisma, tmdbId, jellyfinUserId, mediaType, title, ttlSeconds) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO content_claims (tmdbId, jellyfinUserId, mediaType, title, expiresAt)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(3), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE mediaType = VALUES(mediaType), title = VALUES(title), expiresAt = VALUES(expiresAt)`,
    tmdbId,
    jellyfinUserId,
    mediaType,
    title,
    ttlSeconds
  );
}
async function purgeExpiredContentClaims(prisma) {
  await prisma.$executeRawUnsafe(`DELETE FROM content_claims WHERE expiresAt < NOW(3)`);
}

// server/db.ts
async function ensureTables(prisma) {
  let existingCount = 0;
  try {
    await prisma.$queryRawUnsafe(`SELECT jellyfin_user_id FROM seer_requests LIMIT 1`);
    const rows2 = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM seer_requests`
    );
    existingCount = Number(rows2[0].cnt);
    console.log(`[SeerDB] Table seer_requests exists with ${existingCount} rows \u2014 preserving data`);
  } catch {
    console.log("[SeerDB] Table seer_requests missing or incompatible \u2014 recreating");
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS seer_requests`).catch(() => {
    });
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
  try {
    await prisma.$queryRawUnsafe(`SELECT next_retry_at FROM seer_cleanup_queue LIMIT 1`);
  } catch {
    console.log("[SeerDB] Table seer_cleanup_queue missing or incompatible \u2014 recreating");
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS seer_cleanup_queue`).catch(() => {
    });
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
  const addColumn = async (table, col, def) => {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      console.log(`[SeerDB] Added column ${table}.${col}`);
    } catch {
    }
  };
  await addColumn("seer_cleanup_queue", "request_id", "VARCHAR(36) DEFAULT NULL");
  await addColumn("seer_cleanup_queue", "seasons", "TEXT DEFAULT NULL");
  await addColumn("seer_cleanup_queue", "jellyfin_user_id", "VARCHAR(255) DEFAULT NULL");
  await addColumn("seer_requests", "pending_cleanup_id", "VARCHAR(36) DEFAULT NULL");
  await addColumn("seer_requests", "profile_id", "VARCHAR(36) DEFAULT NULL");
  await addColumn("seer_requests", "is_anime", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumn("seer_requests", "notified_seasons", "JSON DEFAULT NULL");
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
  await ensureTmdbCacheTable(prisma);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM seer_requests`
  );
  const finalCount = Number(rows[0].cnt);
  if (existingCount > 0 && finalCount === 0) {
    console.error(`[SeerDB] CRITICAL: ${existingCount} rows were lost!`);
  }
}
async function createRequest(prisma, data) {
  const id = uuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_requests
      (id, jellyfin_user_id, username, media_type, tmdb_id, title, poster_path,
       backdrop_path, overview, year, seasons, status, priority, profile_id, is_anime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`,
    id,
    data.jellyfinUserId,
    data.username,
    data.mediaType,
    data.tmdbId,
    data.title,
    data.posterPath || null,
    data.backdropPath || null,
    data.overview || null,
    data.year || null,
    data.seasons ? JSON.stringify(data.seasons) : null,
    data.priority || 0,
    data.profileId || null,
    data.isAnime ? 1 : 0
  );
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE id = ?`,
    id
  );
  return rowToRequest(rows[0]);
}
async function getOrCreateUserSettings(prisma, jellyfinUserId, username) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId
  );
  if (rows.length > 0) {
    if (username && rows[0].username !== username) {
      await prisma.$executeRawUnsafe(
        `UPDATE seer_user_settings SET username = ? WHERE jellyfin_user_id = ?`,
        username,
        jellyfinUserId
      );
      rows[0].username = username;
    }
    return rowToUserSettings(rows[0]);
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_user_settings
      (jellyfin_user_id, username, blocked, daily_limit, allow_movies, allow_tv, allow_anime)
     VALUES (?, ?, 0, NULL, 1, 1, 1)`,
    jellyfinUserId,
    username || jellyfinUserId
  );
  const created = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId
  );
  return rowToUserSettings(created[0]);
}
async function getUserSettings(prisma, jellyfinUserId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId
  );
  return rows.length > 0 ? rowToUserSettings(rows[0]) : null;
}
async function updateUserSettings(prisma, jellyfinUserId, patch) {
  const sets = [];
  const params = [];
  if (patch.blocked !== void 0) {
    sets.push("blocked = ?");
    params.push(patch.blocked ? 1 : 0);
  }
  if (patch.dailyLimit !== void 0) {
    sets.push("daily_limit = ?");
    params.push(patch.dailyLimit);
  }
  if (patch.allowMovies !== void 0) {
    sets.push("allow_movies = ?");
    params.push(patch.allowMovies ? 1 : 0);
  }
  if (patch.allowTv !== void 0) {
    sets.push("allow_tv = ?");
    params.push(patch.allowTv ? 1 : 0);
  }
  if (patch.allowAnime !== void 0) {
    sets.push("allow_anime = ?");
    params.push(patch.allowAnime ? 1 : 0);
  }
  if (patch.jellyseerrUserId !== void 0) {
    sets.push("jellyseerr_user_id = ?");
    params.push(patch.jellyseerrUserId);
  }
  if (patch.jellyseerrLastSync !== void 0) {
    sets.push("jellyseerr_last_sync = ?");
    params.push(patch.jellyseerrLastSync);
  }
  if (patch.username !== void 0) {
    sets.push("username = ?");
    params.push(patch.username);
  }
  if (sets.length === 0) return;
  params.push(jellyfinUserId);
  await prisma.$executeRawUnsafe(
    `UPDATE seer_user_settings SET ${sets.join(", ")} WHERE jellyfin_user_id = ?`,
    ...params
  );
}
async function countRequestsToday(prisma, jellyfinUserId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ?
       AND created_at >= CURDATE()
       AND status NOT IN ('failed', 'deleted')`,
    jellyfinUserId
  );
  return Number(rows[0].cnt);
}
async function listUsersWithStats(prisma) {
  const settingsRows = await prisma.$queryRawUnsafe(
    `SELECT s.*,
       (SELECT COUNT(*) FROM seer_requests r
          WHERE r.jellyfin_user_id = s.jellyfin_user_id
            AND r.created_at >= CURDATE()
            AND r.status NOT IN ('failed', 'deleted')) AS requests_today,
       (SELECT COUNT(*) FROM seer_requests r
          WHERE r.jellyfin_user_id = s.jellyfin_user_id
            AND r.status != 'deleted') AS requests_total
     FROM seer_user_settings s
     ORDER BY s.username ASC`
  );
  const known = new Set(settingsRows.map((r) => r.jellyfin_user_id));
  const orphanRows = await prisma.$queryRawUnsafe(
    `SELECT
       r.jellyfin_user_id,
       MAX(r.username) AS username,
       SUM(CASE WHEN r.created_at >= CURDATE() AND r.status NOT IN ('failed','deleted') THEN 1 ELSE 0 END) AS requests_today,
       SUM(CASE WHEN r.status != 'deleted' THEN 1 ELSE 0 END) AS requests_total
     FROM seer_requests r
     GROUP BY r.jellyfin_user_id`
  );
  const result = settingsRows.map((r) => ({
    ...rowToUserSettings(r),
    requestsToday: Number(r.requests_today) || 0,
    requestsTotal: Number(r.requests_total) || 0
  }));
  for (const o of orphanRows) {
    if (known.has(o.jellyfin_user_id)) continue;
    const userId = o.jellyfin_user_id;
    const username = o.username || userId;
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      requestsToday: Number(o.requests_today) || 0,
      requestsTotal: Number(o.requests_total) || 0
    });
  }
  return result.sort((a, b) => a.username.localeCompare(b.username));
}
async function listJellyfinUsersWithStats(prisma, jellyfinUsers) {
  if (jellyfinUsers.length === 0) return [];
  const ids = jellyfinUsers.map((u) => u.id);
  const placeholders = ids.map(() => "?").join(",");
  const settingsRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id IN (${placeholders})`,
    ...ids
  );
  const settingsByUserId = /* @__PURE__ */ new Map();
  for (const row of settingsRows) {
    const s = rowToUserSettings(row);
    settingsByUserId.set(s.jellyfinUserId, s);
  }
  const statsRows = await prisma.$queryRawUnsafe(
    `SELECT
       jellyfin_user_id,
       SUM(CASE WHEN created_at >= CURDATE() AND status NOT IN ('failed','deleted') THEN 1 ELSE 0 END) AS requests_today,
       SUM(CASE WHEN status != 'deleted' THEN 1 ELSE 0 END) AS requests_total
     FROM seer_requests
     WHERE jellyfin_user_id IN (${placeholders})
     GROUP BY jellyfin_user_id`,
    ...ids
  );
  const statsByUserId = /* @__PURE__ */ new Map();
  for (const r of statsRows) {
    statsByUserId.set(r.jellyfin_user_id, {
      today: Number(r.requests_today) || 0,
      total: Number(r.requests_total) || 0
    });
  }
  const result = [];
  for (const u of jellyfinUsers) {
    let settings = settingsByUserId.get(u.id);
    if (!settings) {
      settings = await getOrCreateUserSettings(prisma, u.id, u.name);
    } else if (u.name && u.name !== u.id && settings.username !== u.name) {
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
async function getRequestById(prisma, id) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE id = ?`,
    id
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function updateRequestStatus(prisma, id, status, extra) {
  const sets = ["status = ?"];
  const params = [status];
  if (extra?.seerrRequestId !== void 0) {
    sets.push("seerr_request_id = ?");
    params.push(extra.seerrRequestId);
  }
  if (extra?.seerrMediaId !== void 0) {
    sets.push("seerr_media_id = ?");
    params.push(extra.seerrMediaId);
  }
  if (extra?.seerrMediaStatus !== void 0) {
    sets.push("seerr_media_status = ?");
    params.push(extra.seerrMediaStatus);
  }
  if (extra?.lastError !== void 0) {
    sets.push("last_error = ?");
    params.push(extra.lastError);
  }
  if (extra?.retryCount !== void 0) {
    sets.push("retry_count = ?");
    params.push(extra.retryCount);
  }
  if (extra?.sentAt !== void 0) {
    sets.push("sent_at = ?");
    params.push(extra.sentAt);
  }
  if (extra?.completedAt !== void 0) {
    sets.push("completed_at = ?");
    params.push(extra.completedAt);
  }
  params.push(id);
  await prisma.$executeRawUnsafe(`UPDATE seer_requests SET ${sets.join(", ")} WHERE id = ?`, ...params);
}
async function deleteRequestById(prisma, id) {
  await prisma.$executeRawUnsafe(`DELETE FROM seer_requests WHERE id = ?`, id);
}
async function findDuplicate(prisma, jellyfinUserId, tmdbId, mediaType, seasons) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = ?
       AND status NOT IN ('deleted', 'failed', 'available', 'deleting', 'delete_failed')`,
    jellyfinUserId,
    tmdbId,
    mediaType
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
async function findExistingTvRequest(prisma, jellyfinUserId, tmdbId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = 'tv'
       AND status NOT IN ('deleted', 'deleting', 'delete_failed')
     ORDER BY created_at DESC LIMIT 1`,
    jellyfinUserId,
    tmdbId
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function addSeasonsToRequest(prisma, id, seasons) {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET seasons = ? WHERE id = ?`,
    JSON.stringify(seasons),
    id
  );
}
async function setNotifiedSeasons(prisma, id, seasons) {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET notified_seasons = ? WHERE id = ?`,
    JSON.stringify(seasons),
    id
  );
}
async function getNextQueued(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE status IN ('queued', 'retry_pending')
       AND (pending_cleanup_id IS NULL)
     ORDER BY priority DESC, created_at ASC
     LIMIT 1`
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function getRequestsToSync(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE seerr_request_id IS NOT NULL
       AND status NOT IN ('available', 'failed', 'deleted', 'deleting', 'delete_failed')`
  );
  return rows.map(rowToRequest);
}

// server/anime.ts
var overridesCache = null;
async function fetchMediaDetail(seerrUrl, apiKey, mediaType, tmdbId) {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
function isAnimeFromKeywords(detail) {
  if (!detail.keywords || !Array.isArray(detail.keywords)) return false;
  return detail.keywords.some((k) => k.name?.toLowerCase().includes("anime"));
}
async function fetchAnimeOverrides(seerrUrl, apiKey) {
  if (overridesCache && Date.now() < overridesCache.expires) {
    return overridesCache.data;
  }
  try {
    const res = await fetch(`${seerrUrl}/api/v1/settings/sonarr`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      overridesCache = { data: null, expires: Date.now() + 6e5 };
      return null;
    }
    const servers = await res.json();
    const defaultServer = servers.find((s) => s.isDefault);
    if (!defaultServer?.activeAnimeProfileId) {
      overridesCache = { data: null, expires: Date.now() + 6e5 };
      return null;
    }
    const data = {
      profileId: defaultServer.activeAnimeProfileId,
      rootFolder: defaultServer.activeAnimeDirectory,
      tags: defaultServer.animeTags || [],
      languageProfileId: defaultServer.activeAnimeLanguageProfileId
    };
    overridesCache = { data, expires: Date.now() + 6e5 };
    return data;
  } catch {
    overridesCache = { data: null, expires: Date.now() + 6e5 };
    return null;
  }
}

// server/season-availability.ts
var AVAILABLE = 5;
function releasedSuffix(gender, plural) {
  const v = plural ? gender === "f" ? "sont sorties" : "sont sortis" : gender === "f" ? "est sortie" : "est sorti";
  return `${v} sur Tentacle TV`;
}
var DELETED = 7;
function goneSeasons(requested, mediaSeasons) {
  const deleted = new Set(
    (mediaSeasons ?? []).filter((s) => s.status === DELETED).map((s) => s.seasonNumber)
  );
  return (requested ?? []).filter((s) => deleted.has(s)).sort((a, b) => a - b);
}
function evaluateSeasons(requested, mediaSeasons) {
  const req = requested ?? [];
  const availSet = new Set(
    (mediaSeasons ?? []).filter((s) => s.status === AVAILABLE).map((s) => s.seasonNumber)
  );
  const available = req.filter((s) => availSet.has(s)).sort((a, b) => a - b);
  return {
    requested: req,
    available,
    allAvailable: req.length > 0 && available.length === req.length
  };
}
function seasonNotification(request, newly, totalAvailable) {
  const sorted = [...newly].sort((a, b) => a - b);
  const multi = sorted.length > 1;
  const label = multi ? `Saisons ${sorted.join(", ")}` : `Saison ${sorted[0]}`;
  const requestedCount = request.seasons?.length ?? 0;
  const partial = requestedCount > 1 && totalAvailable < requestedCount ? ` (${totalAvailable}/${requestedCount} saisons)` : "";
  return {
    title: request.title,
    message: `${label} ${releasedSuffix("f", multi)}${partial}`
  };
}

// server/cache.ts
var store = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
var REFRESH_BACKOFF_MS = 3e4;
async function cached(key, ttlMs, loader, opts) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value;
  if (hit && hit.stale > now) {
    const backoffOver = !hit.failedAt || now - hit.failedAt > REFRESH_BACKOFF_MS;
    if (backoffOver && !inflight.has(key)) {
      void refresh(key, ttlMs, loader, opts).catch(() => {
      });
    }
    return hit.value;
  }
  const pending2 = inflight.get(key);
  if (pending2) return pending2;
  return refresh(key, ttlMs, loader, opts);
}
function refresh(key, ttlMs, loader, opts) {
  const p = (async () => {
    try {
      const value = await loader();
      put(key, value, opts?.ttlFor?.(value) ?? ttlMs, opts?.staleMs ?? 0);
      return value;
    } catch (err) {
      const prev = store.get(key);
      if (prev) prev.failedAt = Date.now();
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
function put(key, value, ttlMs, staleMs = 0) {
  const expires = Date.now() + ttlMs;
  store.set(key, { value, expires, stale: expires + staleMs });
}
function peek(key, allowStale = false) {
  const hit = store.get(key);
  if (!hit) return void 0;
  const now = Date.now();
  if (hit.expires > now) return hit.value;
  if (allowStale && hit.stale > now) return hit.value;
  return void 0;
}
function invalidate(prefix) {
  for (const key of Array.from(store.keys())) {
    if (key === prefix || key.startsWith(prefix + ":")) {
      store.delete(key);
    }
  }
}
function invalidateRequestCaches(userId) {
  invalidate(userId ? `seer-cache:${userId}` : "seer-cache");
  invalidate("seer:rows:everyone");
  invalidate("seer:cal:everyone");
  invalidate("seer:requested:index");
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.stale <= now) store.delete(key);
  }
}, 6e4).unref?.();

// server/seer-availability-notify.ts
async function notifyAvailableSeasons(prisma, request, mediaSeasons) {
  const ev = evaluateSeasons(request.seasons, mediaSeasons);
  if (ev.available.length === 0) return null;
  const notified = new Set(request.notifiedSeasons ?? []);
  const newly = ev.available.filter((s) => !notified.has(s));
  if (newly.length > 0) {
    const n = seasonNotification(request, newly, ev.available.length);
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: n.title,
        body: n.message,
        refId: request.id
      }
    });
    await setNotifiedSeasons(prisma, request.id, ev.available);
    console.log(`[SeerWorker] "${request.title}" saisons dispo [${newly.join(",")}] \u2192 notif`);
  }
  return ev.allAvailable ? "available" : "partially_available";
}
async function notifyMovieAvailable(prisma, request) {
  if ((request.notifiedSeasons ?? []).length > 0) return;
  await prisma.notification.create({
    data: {
      jellyfinUserId: request.jellyfinUserId,
      type: "request_status",
      title: request.title,
      body: `\xAB ${request.title} \xBB ${releasedSuffix("m", false)}`,
      refId: request.id
    }
  });
  await setNotifiedSeasons(prisma, request.id, [0]);
  console.log(`[SeerWorker] "${request.title}" (film) dispo \u2192 notif`);
}
async function releaseGoneSeasons(prisma, request, mediaSeasons) {
  const gone = goneSeasons(request.seasons, mediaSeasons);
  if (gone.length === 0) return request;
  const remaining = (request.seasons ?? []).filter((s) => !gone.includes(s));
  if (remaining.length === 0) {
    await updateRequestStatus(prisma, request.id, "deleted", {
      lastError: "Saisons supprim\xE9es c\xF4t\xE9 Jellyseerr"
    });
    invalidateRequestCaches(request.jellyfinUserId);
    console.log(`[SeerWorker] "${request.title}" : S${gone.join(", S")} supprim\xE9e(s) c\xF4t\xE9 Jellyseerr \u2192 demande close`);
    return null;
  }
  await addSeasonsToRequest(prisma, request.id, remaining);
  invalidateRequestCaches(request.jellyfinUserId);
  console.log(`[SeerWorker] "${request.title}" : S${gone.join(", S")} supprim\xE9e(s) c\xF4t\xE9 Jellyseerr \u2192 reste S${remaining.join(", S")}`);
  return { ...request, seasons: remaining };
}

// server/arr-service.ts
var sonarrCache = null;
var radarrCache = null;
async function getArrServerConfig(seerrUrl, apiKey, type) {
  const cache = type === "sonarr" ? sonarrCache : radarrCache;
  if (cache && Date.now() < cache.expires) return cache.data;
  try {
    const res = await fetch(`${seerrUrl}/api/v1/settings/${type}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      setCacheForType(type, null, FAIL_TTL_MS);
      return null;
    }
    const servers = await res.json();
    const defaultServer = servers.find((s) => s.isDefault);
    if (!defaultServer) {
      setCacheForType(type, null, OK_TTL_MS);
      return null;
    }
    const data = {
      hostname: defaultServer.hostname,
      port: defaultServer.port,
      apiKey: defaultServer.apiKey,
      useSsl: !!defaultServer.useSsl,
      baseUrl: defaultServer.baseUrl || ""
    };
    setCacheForType(type, data, OK_TTL_MS);
    return data;
  } catch {
    setCacheForType(type, null, FAIL_TTL_MS);
    return null;
  }
}
var OK_TTL_MS = 6e5;
var FAIL_TTL_MS = 3e4;
function setCacheForType(type, data, ttlMs) {
  const entry = { data, expires: Date.now() + ttlMs };
  if (type === "sonarr") sonarrCache = entry;
  else radarrCache = entry;
}
function buildArrUrl(server) {
  const protocol = server.useSsl ? "https" : "http";
  const base = server.baseUrl ? `/${server.baseUrl.replace(/^\/|\/$/g, "")}` : "";
  return `${protocol}://${server.hostname}:${server.port}${base}`;
}
async function getMediaExternalId(seerrUrl, apiKey, mediaType, tmdbId) {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.mediaInfo?.externalServiceId) return null;
    return {
      externalServiceId: data.mediaInfo.externalServiceId,
      serviceId: data.mediaInfo.serviceId ?? 0
    };
  } catch {
    return null;
  }
}
async function arrFetch(server, path, init) {
  return fetch(`${buildArrUrl(server)}${path}`, {
    ...init,
    headers: { "X-Api-Key": server.apiKey, ...init?.headers ?? {} },
    signal: AbortSignal.timeout(15e3)
  });
}
function isTargetedSeason(seasonNumber, seasons) {
  if (!seasons || seasons.length === 0) return true;
  return seasons.includes(seasonNumber);
}
async function unmonitorSonarrSeasons(server, seriesId, seasons) {
  try {
    const getRes = await arrFetch(server, `/api/v3/series/${seriesId}`);
    if (getRes.status === 404) return true;
    if (!getRes.ok) return false;
    const series = await getRes.json();
    for (const s of series.seasons ?? []) {
      if (isTargetedSeason(s.seasonNumber, seasons)) s.monitored = false;
    }
    if ((series.seasons ?? []).every((s) => !s.monitored)) series.monitored = false;
    const putRes = await arrFetch(server, `/api/v3/series/${seriesId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(series)
    });
    return putRes.ok || putRes.status === 404;
  } catch (err) {
    console.warn(`[ArrService] unmonitorSonarrSeasons #${seriesId} failed:`, err);
    return false;
  }
}
async function deleteSonarrSeasonFiles(server, seriesId, seasons) {
  try {
    const res = await arrFetch(server, `/api/v3/episodefile?seriesId=${seriesId}`);
    if (res.status === 404) return true;
    if (!res.ok) return false;
    const files = await res.json();
    const targets = files.filter((f) => isTargetedSeason(f.seasonNumber, seasons));
    if (targets.length === 0) return true;
    const bulk = await arrFetch(server, `/api/v3/episodefile/bulk`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeFileIds: targets.map((f) => f.id) })
    });
    if (bulk.ok) return true;
    let ok = true;
    for (const f of targets) {
      const del = await arrFetch(server, `/api/v3/episodefile/${f.id}`, { method: "DELETE" });
      if (!del.ok && del.status !== 404) ok = false;
    }
    return ok;
  } catch (err) {
    console.warn(`[ArrService] deleteSonarrSeasonFiles #${seriesId} failed:`, err);
    return false;
  }
}
async function cancelSonarrQueue(server, seriesId, seasons) {
  try {
    const res = await arrFetch(server, `/api/v3/queue?pageSize=1000&includeSeries=false`);
    if (!res.ok) return;
    const data = await res.json();
    const records = data.records ?? [];
    for (const r of records) {
      if (r.seriesId !== seriesId) continue;
      if (r.seasonNumber !== void 0 && !isTargetedSeason(r.seasonNumber, seasons)) continue;
      await arrFetch(server, `/api/v3/queue/${r.id}?removeFromClient=true&blocklist=false`, {
        method: "DELETE"
      }).catch(() => {
      });
    }
  } catch (err) {
    console.warn(`[ArrService] cancelSonarrQueue #${seriesId} failed:`, err);
  }
}
async function unmonitorRadarrMovie(server, movieId) {
  try {
    const getRes = await arrFetch(server, `/api/v3/movie/${movieId}`);
    if (getRes.status === 404) return true;
    if (!getRes.ok) return false;
    const movie = await getRes.json();
    movie.monitored = false;
    const putRes = await arrFetch(server, `/api/v3/movie/${movieId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(movie)
    });
    return putRes.ok || putRes.status === 404;
  } catch (err) {
    console.warn(`[ArrService] unmonitorRadarrMovie #${movieId} failed:`, err);
    return false;
  }
}
async function deleteRadarrMovieFile(server, movieId) {
  try {
    const res = await arrFetch(server, `/api/v3/moviefile?movieId=${movieId}`);
    if (res.status === 404) return true;
    if (!res.ok) return false;
    const files = await res.json();
    if (files.length === 0) return true;
    let ok = true;
    for (const f of files) {
      const del = await arrFetch(server, `/api/v3/moviefile/${f.id}`, { method: "DELETE" });
      if (!del.ok && del.status !== 404) ok = false;
    }
    return ok;
  } catch (err) {
    console.warn(`[ArrService] deleteRadarrMovieFile #${movieId} failed:`, err);
    return false;
  }
}
async function cancelRadarrQueue(server, movieId) {
  try {
    const res = await arrFetch(server, `/api/v3/queue?pageSize=1000&includeMovie=false`);
    if (!res.ok) return;
    const data = await res.json();
    for (const r of data.records ?? []) {
      if (r.movieId !== movieId) continue;
      await arrFetch(server, `/api/v3/queue/${r.id}?removeFromClient=true&blocklist=false`, {
        method: "DELETE"
      }).catch(() => {
      });
    }
  } catch (err) {
    console.warn(`[ArrService] cancelRadarrQueue #${movieId} failed:`, err);
  }
}
async function triggerSeerrJob(seerrUrl, apiKey, jobId) {
  try {
    await fetch(`${seerrUrl}/api/v1/settings/jobs/${jobId}/run`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
  } catch (err) {
    console.warn(`[ArrService] triggerSeerrJob ${jobId} failed:`, err);
  }
}

// server/worker-sync.ts
var CLAIM_TTL_SECONDS = 1800;
async function syncStatuses(prisma, config) {
  const requests = await getRequestsToSync(prisma);
  await purgeExpiredContentClaims(prisma).catch(() => {
  });
  if (requests.length === 0) return;
  let availabilitySyncDone = false;
  for (const request of requests) {
    if (!request.seerrRequestId) continue;
    await upsertContentClaim(
      prisma,
      request.tmdbId,
      request.jellyfinUserId,
      request.mediaType,
      request.title,
      CLAIM_TTL_SECONDS
    ).catch(() => {
    });
    try {
      const res = await fetch(
        `${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`,
        { headers: { "X-Api-Key": config.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
      );
      if (!res.ok) {
        if (res.status === 404) {
          await updateRequestStatus(prisma, request.id, "deleted", {
            lastError: "Demande supprim\xE9e c\xF4t\xE9 Jellyseerr"
          });
          invalidateRequestCaches(request.jellyfinUserId);
        }
        continue;
      }
      const data = await res.json();
      const globalStatus = mapSeerrStatus(data.status, data.media?.status, data.media?.downloadStatus);
      if (globalStatus === "failed" && request.status !== "failed") {
        await handleFailedSync(prisma, config, request, data);
        invalidateRequestCaches(request.jellyfinUserId);
        continue;
      }
      if (request.mediaType === "tv" && (request.seasons?.length ?? 0) > 0) {
        await syncTvSeasons(prisma, config, request, globalStatus, data.media?.status);
      } else {
        await syncGlobal(prisma, request, globalStatus, data.media?.status);
      }
      if (!availabilitySyncDone && request.mediaType === "tv" && (globalStatus === "partially_available" || globalStatus === "downloading")) {
        availabilitySyncDone = true;
        await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      }
    } catch (err) {
      console.warn(`[SeerWorker] Failed to sync request #${request.seerrRequestId}:`, err);
    }
  }
}
async function syncGlobal(prisma, request, newStatus, mediaStatus) {
  if (newStatus === request.status) return;
  const extra = { seerrMediaStatus: mediaStatus };
  if (newStatus === "available") extra.completedAt = /* @__PURE__ */ new Date();
  await updateRequestStatus(prisma, request.id, newStatus, extra);
  invalidateRequestCaches(request.jellyfinUserId);
  const notif = statusNotification(request, newStatus);
  if (notif) {
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: notif.title,
        body: notif.message,
        refId: request.id
      }
    });
  }
  console.log(`[SeerWorker] "${request.title}" status: ${request.status} \u2192 ${newStatus}`);
}
async function syncTvSeasons(prisma, config, request, fallbackStatus, mediaStatus) {
  const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, "tv", request.tmdbId);
  const mediaSeasons = detail?.mediaInfo?.seasons;
  const kept = await releaseGoneSeasons(prisma, request, mediaSeasons);
  if (!kept) return;
  request = kept;
  const newStatus = await notifyAvailableSeasons(prisma, request, mediaSeasons);
  if (newStatus === null) {
    await syncGlobal(prisma, request, fallbackStatus, mediaStatus);
    return;
  }
  if (newStatus !== request.status) {
    const extra = { seerrMediaStatus: mediaStatus };
    if (newStatus === "available") extra.completedAt = /* @__PURE__ */ new Date();
    await updateRequestStatus(prisma, request.id, newStatus, extra);
    invalidateRequestCaches(request.jellyfinUserId);
    console.log(`[SeerWorker] "${request.title}" status: ${request.status} \u2192 ${newStatus}`);
  }
}
async function handleFailedSync(prisma, config, request, data) {
  const retryN = request.retryCount + 1;
  if (retryN < request.maxRetries) {
    await fetch(`${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`, {
      method: "DELETE",
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    }).catch(() => {
    });
    if (request.seerrMediaId) {
      await fetch(`${config.seerrUrl}/api/v1/media/${request.seerrMediaId}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(1e4)
      }).catch(() => {
      });
    }
    await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      retryN,
      request.id
    );
    console.log(`[SeerWorker] Auto-retry "${request.title}" (attempt ${retryN}/${request.maxRetries})`);
  } else {
    await updateRequestStatus(prisma, request.id, "failed", {
      seerrMediaStatus: data.media?.status,
      retryCount: retryN
    });
    await prisma.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: request.title,
        body: `\xC9chec d\xE9finitif pour \xAB ${request.title} \xBB apr\xE8s ${request.maxRetries} tentatives`,
        refId: request.id
      }
    });
    console.log(`[SeerWorker] "${request.title}" PERMANENTLY FAILED after ${request.maxRetries} retries`);
  }
}
async function retryFailedRequests(prisma) {
  const failed = await prisma.$queryRawUnsafe(
    // Les lignes héritées de l'ancien classement (404 → « failed ») ne sont
    // plus recréées non plus : une suppression côté Jellyseerr est acquise.
    `SELECT id, title, retry_count, max_retries FROM seer_requests
     WHERE status = 'failed' AND retry_count < max_retries
       AND (last_error IS NULL OR last_error != 'Request no longer exists on Seerr') LIMIT 3`
  );
  for (const req of failed) {
    const newRetry = req.retry_count + 1;
    await prisma.$executeRawUnsafe(
      `UPDATE seer_requests SET status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      newRetry,
      req.id
    );
    console.log(`[SeerWorker] Auto-retry "${req.title}" (attempt ${newRetry}/${req.max_retries})`);
  }
}
function mapSeerrStatus(requestStatus, mediaStatus, downloadStatus) {
  if (requestStatus === 3) return "failed";
  if (requestStatus === 4) return "failed";
  if (mediaStatus === 5) return "available";
  if (mediaStatus === 4) return "partially_available";
  if (mediaStatus === 7) return "deleted";
  if (mediaStatus === 1) return "unavailable";
  if (mediaStatus === 3) {
    return downloadStatus && downloadStatus.length > 0 ? "downloading" : "unavailable";
  }
  if (requestStatus === 1) return "sent_to_seer";
  return "approved";
}
function statusNotification(request, newStatus) {
  switch (newStatus) {
    case "downloading":
      return { type: "request_downloading", title: request.title, message: `\xAB ${request.title} \xBB est en cours de t\xE9l\xE9chargement` };
    case "available": {
      const suffix = releasedSuffix(request.mediaType === "movie" ? "m" : "f", false);
      return { type: "request_available", title: request.title, message: `\xAB ${request.title} \xBB ${suffix}` };
    }
    case "failed":
      return { type: "request_declined", title: request.title, message: `Votre demande pour \xAB ${request.title} \xBB a \xE9t\xE9 refus\xE9e` };
    default:
      return null;
  }
}

// server/seerr-reconcile.ts
async function reconcileSeerrSeasons(prisma, config, tmdbId, removedSeasons) {
  if (removedSeasons.length === 0) return;
  const removed = new Set(removedSeasons);
  const headers = { "X-Api-Key": config.seerrApiKey };
  const res = await fetch(`${config.seerrUrl}/api/v1/tv/${tmdbId}`, {
    headers,
    signal: AbortSignal.timeout(1e4)
  });
  if (res.status === 404) return;
  if (!res.ok) {
    throw new Error(`Jellyseerr GET /tv/${tmdbId} returned ${res.status}`);
  }
  const detail = await res.json();
  for (const req of detail.mediaInfo?.requests ?? []) {
    const seasons = (req.seasons ?? []).map((s) => s.seasonNumber).filter((n) => typeof n === "number");
    if (seasons.length === 0) continue;
    const remaining = seasons.filter((n) => !removed.has(n));
    if (remaining.length === seasons.length) continue;
    if (remaining.length === 0) {
      const del = await fetch(`${config.seerrUrl}/api/v1/request/${req.id}`, {
        method: "DELETE",
        headers,
        signal: AbortSignal.timeout(1e4)
      });
      if (!del.ok && del.status !== 404) {
        throw new Error(`Jellyseerr DELETE /request/${req.id} returned ${del.status}`);
      }
      await prisma.$executeRawUnsafe(
        `DELETE FROM seer_requests WHERE seerr_request_id = ?`,
        req.id
      );
      console.log(
        `[SeerReconcile] tv#${tmdbId} : demande Jellyseerr #${req.id} supprim\xE9e (S${seasons.join(", S")} retir\xE9es)`
      );
    } else {
      const put2 = await fetch(`${config.seerrUrl}/api/v1/request/${req.id}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType: "tv", seasons: remaining }),
        signal: AbortSignal.timeout(1e4)
      });
      if (!put2.ok && put2.status !== 404) {
        const text = await put2.text().catch(() => "");
        throw new Error(
          `Jellyseerr PUT /request/${req.id} returned ${put2.status} ${text.slice(0, 200)}`
        );
      }
      await prisma.$executeRawUnsafe(
        `UPDATE seer_requests SET seasons = ? WHERE seerr_request_id = ?`,
        JSON.stringify(remaining),
        req.id
      );
      console.log(
        `[SeerReconcile] tv#${tmdbId} : demande Jellyseerr #${req.id} r\xE9duite aux saisons S${remaining.join(", S")}`
      );
    }
  }
}

// server/worker-cleanup.ts
var CLEANUP_BATCH = 25;
async function processCleanupQueue(prisma, config) {
  for (let pass = 0; pass < 4; pass++) {
    const jobs = await getPendingCleanups(prisma, CLEANUP_BATCH);
    if (jobs.length === 0) return;
    for (const job of jobs) {
      await processCleanupJob(prisma, config, job);
    }
    if (jobs.length < CLEANUP_BATCH) return;
  }
}
function invalidateForJob(job) {
  invalidateRequestCaches(job.jellyfinUserId);
}
async function processCleanupJob(prisma, config, job) {
  const headers = { "X-Api-Key": config.seerrApiKey };
  try {
    if (job.action === "sync") {
      await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      await updateCleanupJob(prisma, job.id, "completed");
      invalidateForJob(job);
      console.log(`[SeerWorker] availability-sync re-d\xE9clench\xE9e pour "${job.title}"`);
      return;
    }
    const arrType = job.mediaType === "movie" ? "radarr" : "sonarr";
    const [server, ext] = await Promise.all([
      getArrServerConfig(config.seerrUrl, config.seerrApiKey, arrType),
      getMediaExternalId(config.seerrUrl, config.seerrApiKey, job.mediaType, job.tmdbId)
    ]);
    if (server && ext?.externalServiceId) {
      const arrId = ext.externalServiceId;
      if (job.mediaType === "movie") {
        await cancelRadarrQueue(server, arrId);
        const unmon = await unmonitorRadarrMovie(server, arrId);
        if (!unmon) throw new Error("Radarr unmonitor failed");
        if (job.deleteFiles) {
          const del = await deleteRadarrMovieFile(server, arrId);
          if (!del) throw new Error("Radarr delete file failed");
        }
      } else {
        await cancelSonarrQueue(server, arrId, job.seasons);
        const unmon = await unmonitorSonarrSeasons(server, arrId, job.seasons);
        if (!unmon) throw new Error("Sonarr unmonitor failed");
        if (job.deleteFiles) {
          const del = await deleteSonarrSeasonFiles(server, arrId, job.seasons);
          if (!del) throw new Error("Sonarr delete season files failed");
        }
      }
      console.log(
        `[SeerWorker] *arr cleanup for "${job.title}" (${arrType} #${arrId}, seasons=${job.seasons ? JSON.stringify(job.seasons) : "all"}, deleteFiles=${job.deleteFiles})`
      );
    } else {
      console.log(`[SeerWorker] "${job.title}" : pas de cible *arr (jamais grab\xE9) \u2014 skip ops *arr`);
    }
    if (job.seerrRequestId) {
      const delRes = await fetch(
        `${config.seerrUrl}/api/v1/request/${job.seerrRequestId}`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(1e4) }
      );
      if (!delRes.ok && delRes.status !== 404) {
        throw new Error(`Jellyseerr request delete returned ${delRes.status}`);
      }
    }
    if (job.mediaType === "tv" && job.seasons && job.seasons.length > 0) {
      await reconcileSeerrSeasons(prisma, config, job.tmdbId, job.seasons);
    }
    await updateCleanupJob(prisma, job.id, "completed");
    if (job.requestId) {
      await deleteRequestById(prisma, job.requestId);
      console.log(`[SeerWorker] Deleted local request ${job.requestId}`);
    }
    await clearPendingCleanup(prisma, job.id);
    if (job.deleteFiles) {
      await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      for (const delay of [120, 600]) {
        await enqueueCleanup(prisma, {
          action: "sync",
          mediaType: job.mediaType,
          tmdbId: job.tmdbId,
          title: job.title,
          deleteFiles: false,
          seasons: null,
          delaySeconds: delay,
          // Propagation obligatoire : sans elle, ces jobs enfants naîtraient
          // sans propriétaire et retomberaient sur l'invalidation globale.
          jellyfinUserId: job.jellyfinUserId
        });
      }
    }
    invalidateForJob(job);
    console.log(`[SeerWorker] Cleanup completed for "${job.title}"`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const newRetry = job.retryCount + 1;
    if (newRetry >= job.maxRetries) {
      await updateCleanupJob(prisma, job.id, "failed", { lastError: errMsg, retryCount: newRetry });
      if (job.requestId) {
        await updateRequestStatus(prisma, job.requestId, "delete_failed", {
          lastError: `\xC9chec suppression: ${errMsg}`
        });
      }
      await clearPendingCleanup(prisma, job.id);
      console.warn(`[SeerWorker] Cleanup FAILED permanently for "${job.title}" after ${newRetry} retries`);
    } else {
      const delaySec = Math.min(30 * Math.pow(2, newRetry - 1), 1800);
      const nextRetry = new Date(Date.now() + delaySec * 1e3);
      await updateCleanupJob(prisma, job.id, "pending", {
        lastError: errMsg,
        retryCount: newRetry,
        nextRetryAt: nextRetry
      });
      console.log(`[SeerWorker] Cleanup retry ${newRetry}/${job.maxRetries} for "${job.title}" in ${delaySec}s`);
    }
  }
}

// server/jellyseerr-user.ts
async function resolveJellyseerrUserId(config, prisma, jellyfinUserId, username) {
  const settings = await getOrCreateUserSettings(prisma, jellyfinUserId, username);
  if (settings.jellyseerrUserId) return settings.jellyseerrUserId;
  const found = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (found) {
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: found.id,
      jellyseerrLastSync: /* @__PURE__ */ new Date()
    });
    return found.id;
  }
  if (username) {
    const placeholder = await findOrphanPlaceholderByUsername(config, username);
    if (placeholder) {
      await relinkJellyseerrUserToJellyfin(config, placeholder.id, jellyfinUserId);
      await updateUserSettings(prisma, jellyfinUserId, {
        jellyseerrUserId: placeholder.id,
        jellyseerrLastSync: /* @__PURE__ */ new Date()
      });
      return placeholder.id;
    }
  }
  try {
    const imported = await importJellyseerrUserFromJellyfin(config, jellyfinUserId);
    if (imported) {
      await updateUserSettings(prisma, jellyfinUserId, {
        jellyseerrUserId: imported.id,
        jellyseerrLastSync: /* @__PURE__ */ new Date()
      });
      return imported.id;
    }
  } catch {
  }
  const refreshed = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (refreshed) {
    await updateUserSettings(prisma, jellyfinUserId, {
      jellyseerrUserId: refreshed.id,
      jellyseerrLastSync: /* @__PURE__ */ new Date()
    });
    return refreshed.id;
  }
  throw new Error(`Unable to resolve Jellyseerr user for jellyfinUserId=${jellyfinUserId}`);
}
async function findOrphanPlaceholderByUsername(config, username) {
  const all = await listAllJellyseerrUsers(config);
  const target = username.trim().toLowerCase();
  return all.find(
    (u) => !u.jellyfinUserId && (u.username && u.username.trim().toLowerCase() === target || u.jellyfinUsername && u.jellyfinUsername.trim().toLowerCase() === target)
  ) ?? null;
}
async function createPlaceholderJellyseerrUser(config, username) {
  const existing = await findOrphanPlaceholderByUsername(config, username);
  if (existing) return existing;
  const email = `${username.toLowerCase().replace(/[^a-z0-9._-]+/g, "")}@tentacle.local`;
  const res = await fetch(`${config.seerrUrl}/api/v1/user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ email, username }),
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr POST /user failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return await res.json();
}
async function invalidateStaleJellyseerrCache(config, prisma) {
  const seerUsers = await listAllJellyseerrUsers(config);
  const validIds = new Set(seerUsers.map((u) => u.id));
  const rows = await prisma.$queryRawUnsafe(
    `SELECT jellyfin_user_id, jellyseerr_user_id FROM seer_user_settings WHERE jellyseerr_user_id IS NOT NULL`
  );
  let invalidated = 0;
  for (const row of rows) {
    if (!validIds.has(row.jellyseerr_user_id)) {
      await prisma.$executeRawUnsafe(
        `UPDATE seer_user_settings SET jellyseerr_user_id = NULL, jellyseerr_last_sync = NULL WHERE jellyfin_user_id = ?`,
        row.jellyfin_user_id
      );
      invalidated++;
    }
  }
  return invalidated;
}
async function relinkJellyseerrUserToJellyfin(config, jellyseerrUserId, jellyfinUserId) {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/${jellyseerrUserId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ jellyfinUserId }),
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr PUT /user/${jellyseerrUserId} failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
async function findJellyseerrUserByJellyfinId(config, jellyfinUserId) {
  const all = await listAllJellyseerrUsers(config);
  const normalized = (id) => (id || "").toLowerCase().replace(/-/g, "");
  const target = normalized(jellyfinUserId);
  return all.find((u) => normalized(u.jellyfinUserId) === target) ?? null;
}
async function listAllJellyseerrUsers(config) {
  const out = [];
  let skip = 0;
  const take = 100;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${config.seerrUrl}/api/v1/user?take=${take}&skip=${skip}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      throw new Error(`Jellyseerr GET /user failed: ${res.status}`);
    }
    const data = await res.json();
    const page = data.results ?? [];
    out.push(...page);
    if (page.length < take) break;
    skip += take;
  }
  return out;
}
async function importJellyseerrUserFromJellyfin(config, jellyfinUserId) {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/import-from-jellyfin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ jellyfinUserIds: [jellyfinUserId] }),
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyseerr import-from-jellyfin failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) return data[0];
  if (!Array.isArray(data) && data && typeof data === "object") return data;
  return null;
}

// server/tmdb-traits.ts
var KEYWORD_ANIME = 210024;
var GENRE_ANIMATION = 16;
var ORIGINES = /* @__PURE__ */ new Set(["JP", "KR"]);
var LANGUES = /* @__PURE__ */ new Set(["ja", "ko"]);
function lireMotsCles(brut) {
  if (Array.isArray(brut)) return brut;
  const enveloppe = brut;
  return Array.isArray(enveloppe?.results) ? enveloppe.results : [];
}
function lireGenres(raw) {
  if (Array.isArray(raw.genreIds)) return raw.genreIds;
  return (raw.genres ?? []).map((g) => g?.id).filter((id) => typeof id === "number");
}
function detectAnime(raw) {
  if (lireMotsCles(raw.keywords).some((k) => k?.id === KEYWORD_ANIME)) return true;
  const asiatique = LANGUES.has(raw.originalLanguage ?? "") || (raw.originCountry ?? []).some((c) => ORIGINES.has((c ?? "").toUpperCase()));
  return asiatique && lireGenres(raw).includes(GENRE_ANIMATION);
}
function detectAnimeLoose(m) {
  if (m.isAnime === true) return true;
  return detectAnime({
    genreIds: m.genreIds,
    originalLanguage: m.originalLanguage ?? void 0,
    originCountry: m.originCountry
  });
}

// server/tmdb-fetch.ts
var RELEASE_TYPE = {
  PREMIERE: 1,
  THEATRICAL_LIMITED: 2,
  THEATRICAL: 3,
  DIGITAL: 4,
  PHYSICAL: 5,
  TV: 6
};
function toDayString(raw) {
  if (!raw || typeof raw !== "string") return null;
  const day = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}
function todayString(now = /* @__PURE__ */ new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
function pickReleaseDates(groups, region) {
  const empty = { digital: null, theatrical: null, physical: null, region: null };
  if (!Array.isArray(groups) || groups.length === 0) return empty;
  const wanted = region.toUpperCase();
  const group = groups.find((g) => g.iso_3166_1?.toUpperCase() === wanted) ?? groups.find((g) => g.iso_3166_1?.toUpperCase() === "US") ?? groups[0];
  if (!group?.release_dates?.length) return empty;
  const earliest = (types) => {
    let best = null;
    for (const r of group.release_dates ?? []) {
      if (typeof r.type !== "number" || !types.includes(r.type)) continue;
      const day = toDayString(r.release_date);
      if (day && (best === null || day < best)) best = day;
    }
    return best;
  };
  return {
    digital: earliest([RELEASE_TYPE.DIGITAL]),
    // Une sortie salle limitée ou une avant-première comptent comme « au cinéma ».
    theatrical: earliest([
      RELEASE_TYPE.THEATRICAL,
      RELEASE_TYPE.THEATRICAL_LIMITED,
      RELEASE_TYPE.PREMIERE
    ]),
    physical: earliest([RELEASE_TYPE.PHYSICAL, RELEASE_TYPE.TV]),
    region: group.iso_3166_1?.toUpperCase() ?? null
  };
}
var DAY = 864e5;
function computeTtlMs(meta, now = Date.now()) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const today = todayString(new Date(now));
  if (meta.mediaType === "tv") {
    const status = (meta.tmdbStatus ?? "").toLowerCase();
    if (status === "ended" || status === "canceled" || status === "cancelled") return 30 * DAY;
    if (meta.nextAirDate) {
      if (meta.nextAirDate <= today) return 6 * 36e5;
      const diff = (/* @__PURE__ */ new Date(`${meta.nextAirDate}T00:00:00`)).getTime() - now;
      return clamp(diff + DAY, 6 * 36e5, 7 * DAY);
    }
    return 2 * DAY;
  }
  if (meta.digitalDate && meta.digitalDate <= today) return 30 * DAY;
  if (meta.theatricalDate && meta.theatricalDate <= today) return 3 * DAY;
  if (meta.releaseDate && meta.releaseDate < today) return 30 * DAY;
  return 12 * 36e5;
}
function parseDetailToMeta(raw, ref, region) {
  const isTv = ref.mediaType === "tv";
  const rel = isTv ? { digital: null, theatrical: null, physical: null, region: null } : pickReleaseDates(raw.releases?.results, region);
  const providerIds = [];
  for (const wp of raw.watchProviders ?? []) {
    if (wp.iso_3166_1?.toUpperCase() !== region.toUpperCase()) continue;
    for (const p of wp.flatrate ?? []) {
      const id = p.id ?? p.providerId;
      if (typeof id === "number" && id > 0) providerIds.push(id);
    }
  }
  const meta = {
    mediaType: ref.mediaType,
    tmdbId: ref.tmdbId,
    title: raw.title ?? raw.name ?? "",
    posterPath: raw.posterPath ?? null,
    backdropPath: raw.backdropPath ?? null,
    overview: raw.overview ?? null,
    releaseDate: toDayString(raw.releaseDate ?? raw.firstAirDate),
    tmdbStatus: raw.status ?? null,
    digitalDate: rel.digital,
    theatricalDate: rel.theatrical,
    physicalDate: rel.physical,
    releaseRegion: rel.region,
    nextAirDate: toDayString(raw.nextEpisodeToAir?.airDate),
    nextSeason: raw.nextEpisodeToAir?.seasonNumber ?? null,
    nextEpisode: raw.nextEpisodeToAir?.episodeNumber ?? null,
    lastAirDate: toDayString(raw.lastEpisodeToAir?.airDate),
    networks: (raw.networks ?? []).map((n) => n?.name).filter((n) => !!n).slice(0, 3).join(", ") || null,
    providerIds: Array.from(new Set(providerIds)),
    voteAverage: typeof raw.voteAverage === "number" ? raw.voteAverage : null,
    popularity: typeof raw.popularity === "number" ? raw.popularity : null,
    originalLanguage: raw.originalLanguage ?? null,
    genreIds: (raw.genres ?? []).map((g) => g?.id).filter((id) => typeof id === "number"),
    isAnime: detectAnime(raw),
    expiresAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  meta.expiresAt = new Date(Date.now() + computeTtlMs(meta)).toISOString();
  return meta;
}
async function fetchTmdbMeta(cfg, ref, region) {
  try {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/${ref.mediaType}/${ref.tmdbId}`, {
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return null;
    return parseDetailToMeta(await res.json(), ref, region);
  } catch {
    return null;
  }
}

// server/tmdb-resolver.ts
var DEFAULT_REGION = "FR";
var inflightMeta = /* @__PURE__ */ new Map();
function fetchOnce(cfg, ref, region) {
  const key = tmdbKey(ref);
  const pending2 = inflightMeta.get(key);
  if (pending2) return pending2;
  const p = fetchTmdbMeta(cfg, ref, region).finally(() => {
    inflightMeta.delete(key);
  });
  inflightMeta.set(key, p);
  return p;
}
function dedupeRefs(refs) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const r of refs) {
    if (!r || !Number.isFinite(r.tmdbId) || r.tmdbId <= 0) continue;
    const k = tmdbKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
async function resolveTmdbMeta(prisma, cfg, refs, opts = {}) {
  const unique = dedupeRefs(refs);
  if (unique.length === 0) return { meta: /* @__PURE__ */ new Map(), missing: [] };
  const meta = await getTmdbMetaBulk(prisma, unique, opts.includeExpired ?? true);
  const missing = unique.filter((r) => !meta.has(tmdbKey(r)));
  const budget = opts.maxFetch ?? 0;
  if (budget <= 0 || !cfg || missing.length === 0) return { meta, missing };
  const toFetch = missing.slice(0, budget);
  const region = opts.region ?? DEFAULT_REGION;
  const fetched = await mapLimit(
    toFetch,
    opts.concurrency ?? DEFAULT_CONCURRENCY,
    (ref) => fetchOnce(cfg, ref, region)
  );
  const ok = fetched.filter((m) => m !== null);
  if (ok.length > 0) {
    await upsertTmdbMetaBulk(prisma, ok).catch(() => {
    });
    for (const m of ok) meta.set(tmdbKey(m), m);
  }
  return { meta, missing: unique.filter((r) => !meta.has(tmdbKey(r))) };
}
var backfillQueue = /* @__PURE__ */ new Set();
var backfillRefs = /* @__PURE__ */ new Map();
var backfillRunning = false;
function pendingBackfillCount() {
  return backfillQueue.size;
}
function scheduleTmdbBackfill(prisma, cfg, refs, region = DEFAULT_REGION) {
  if (!cfg) return;
  for (const ref of dedupeRefs(refs)) {
    const k = tmdbKey(ref);
    if (backfillQueue.has(k)) continue;
    backfillQueue.add(k);
    backfillRefs.set(k, ref);
  }
  if (backfillRunning || backfillQueue.size === 0) return;
  backfillRunning = true;
  void drainBackfill(prisma, cfg, region).catch(() => {
  }).finally(() => {
    backfillRunning = false;
  });
}
async function drainBackfill(prisma, cfg, region) {
  while (backfillQueue.size > 0) {
    const batch = Array.from(backfillQueue).slice(0, 40);
    const refs = batch.map((k) => backfillRefs.get(k)).filter((r) => !!r);
    const fetched = await mapLimit(refs, 4, (ref) => fetchOnce(cfg, ref, region));
    const ok = fetched.filter((m) => m !== null);
    if (ok.length > 0) await upsertTmdbMetaBulk(prisma, ok).catch(() => {
    });
    for (const k of batch) {
      backfillQueue.delete(k);
      backfillRefs.delete(k);
    }
  }
}

// server/seerr-requests-fetch.ts
var PAGE_CONCURRENCY = 4;
async function fetchSeerrRequestsPage(cfg, seerUserId, take, skip, filter = "all") {
  const who = seerUserId == null ? "" : `&requestedBy=${seerUserId}`;
  const url = `${cfg.seerrUrl}/api/v1/request?take=${take}&skip=${skip}&filter=${encodeURIComponent(filter)}&sort=added${who}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": cfg.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Jellyseerr GET /request${who || " (tous)"} failed: ${res.status} ${body.slice(0, 200)}`
    );
  }
  const data = await res.json();
  return {
    rows: data.results ?? [],
    total: data.pageInfo?.results ?? data.results?.length ?? 0
  };
}
async function fetchAllSeerrRequests(cfg, seerUserId, opts = {}) {
  const take = opts.take ?? 100;
  const maxPages = opts.maxPages ?? 25;
  const filter = opts.filter ?? "all";
  const first = await fetchSeerrRequestsPage(cfg, seerUserId, take, 0, filter);
  if (first.rows.length < take || first.total <= take) {
    return { rows: first.rows, total: first.total || first.rows.length, truncated: false };
  }
  const totalPages = Math.ceil(first.total / take);
  const wanted = Math.min(totalPages, maxPages);
  const skips = Array.from({ length: wanted - 1 }, (_, i) => (i + 1) * take);
  const pages = await mapLimit(
    skips,
    PAGE_CONCURRENCY,
    (skip) => fetchSeerrRequestsPage(cfg, seerUserId, take, skip, filter)
  );
  const rows = [...first.rows];
  for (const page of pages) if (page) rows.push(...page.rows);
  return { rows, total: first.total, truncated: totalPages > maxPages };
}

// server/worker-tmdb.ts
var WARM_BUDGET = 40;
var WARM_CONCURRENCY = 4;
var PRUNE_AFTER_DAYS = 180;
var DISCOVER_MAX_PAGES = 10;
var lastPruneDay = "";
var seeded = false;
async function seedTmdbCacheOnce(prisma) {
  if (seeded) return;
  seeded = true;
  try {
    const n = await seedTmdbCacheFromLocalRequests(prisma);
    if (n > 0) console.log(`[SeerTmdb] Seeded ${n} fiches depuis les demandes locales`);
  } catch (err) {
    console.warn("[SeerTmdb] Seed \xE9chou\xE9", err);
  }
}
async function discoverSeerrRefs(prisma, cfg) {
  const { rows } = await fetchAllSeerrRequests(cfg, null, { maxPages: DISCOVER_MAX_PAGES });
  const refs = [];
  for (const r of rows) {
    if (!r.media?.tmdbId) continue;
    refs.push({ mediaType: r.media.mediaType, tmdbId: r.media.tmdbId });
  }
  const unique = dedupeRefs(refs);
  if (unique.length === 0) return 0;
  const known = await getTmdbMetaBulk(prisma, unique, true);
  const unknown = unique.filter((r) => !known.has(tmdbKey(r)));
  if (unknown.length > 0) scheduleTmdbBackfill(prisma, cfg, unknown);
  return unknown.length;
}
async function warmTmdbCache(prisma, cfg, opts = {}) {
  const budget = opts.budget ?? WARM_BUDGET;
  const region = opts.region ?? DEFAULT_REGION;
  const refs = await listStaleTmdbRefs(prisma, budget);
  if (refs.length === 0) {
    await pruneOncePerDay(prisma);
    return { fetched: 0, remaining: 0 };
  }
  const fetched = await mapLimit(refs, WARM_CONCURRENCY, (ref) => fetchTmdbMeta(cfg, ref, region));
  const ok = fetched.filter((m) => m !== null);
  if (ok.length > 0) await upsertTmdbMetaBulk(prisma, ok);
  await pruneOncePerDay(prisma);
  return { fetched: ok.length, remaining: Math.max(0, refs.length - ok.length) };
}
async function pruneOncePerDay(prisma) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (lastPruneDay === today) return;
  lastPruneDay = today;
  try {
    const n = await pruneTmdbCache(prisma, PRUNE_AFTER_DAYS);
    if (n > 0) console.log(`[SeerTmdb] Purge de ${n} fiches inutilis\xE9es`);
  } catch {
  }
}

// server/worker.ts
var timer = null;
var cycleCount = 0;
var prismaRef = null;
var getConfigRef = null;
var requestQueueBusy = false;
var cleanupQueueBusy = false;
async function runRequestQueue(prisma, config) {
  if (requestQueueBusy) return;
  requestQueueBusy = true;
  try {
    const seen = /* @__PURE__ */ new Set();
    for (let i = 0; i < 10; i++) {
      const processedId = await processNextRequest(prisma, config, seen);
      if (!processedId) return;
      seen.add(processedId);
    }
  } finally {
    requestQueueBusy = false;
  }
}
async function runCleanupQueue(prisma, config) {
  if (cleanupQueueBusy) return;
  cleanupQueueBusy = true;
  try {
    await processCleanupQueue(prisma, config);
  } finally {
    cleanupQueueBusy = false;
  }
}
function startWorker(prisma, getConfig) {
  if (timer) return;
  prismaRef = prisma;
  getConfigRef = getConfig;
  async function tick() {
    const config = await getConfig();
    if (!config || !config.seerrUrl || !config.seerrApiKey) return;
    cycleCount++;
    try {
      await runRequestQueue(prisma, config);
    } catch (err) {
      console.error("[SeerWorker] Error processing request:", err);
    }
    if (cycleCount % config.syncEvery === 0) {
      try {
        await syncStatuses(prisma, config);
      } catch (err) {
        console.error("[SeerWorker] Error syncing statuses:", err);
      }
    }
    try {
      await retryFailedRequests(prisma);
    } catch (err) {
      console.error("[SeerWorker] Error retrying failed requests:", err);
    }
    try {
      await runCleanupQueue(prisma, config);
    } catch (err) {
      console.error("[SeerWorker] Error processing cleanup queue:", err);
    }
    if (cycleCount % 5 === 0) {
      try {
        await warmTmdbCache(prisma, config);
      } catch (err) {
        console.error("[SeerWorker] Error warming TMDB cache:", err);
      }
    }
    if (cycleCount % 30 === 0) {
      try {
        const n = await discoverSeerrRefs(prisma, config);
        if (n > 0) console.log(`[SeerWorker] ${n} fiches d\xE9couvertes hors du plugin`);
      } catch (err) {
        console.error("[SeerWorker] Error discovering Seerr refs:", err);
      }
    }
  }
  setTimeout(() => {
    void seedTmdbCacheOnce(prisma);
    tick();
  }, 5e3);
  timer = setInterval(() => {
    tick();
  }, 6e4);
  console.log("[SeerWorker] Started");
}
function kickWorkerNow() {
  const prisma = prismaRef;
  const getConfig = getConfigRef;
  if (!prisma || !getConfig) return;
  setTimeout(async () => {
    try {
      const config = await getConfig();
      if (!config || !config.seerrUrl || !config.seerrApiKey) return;
      await Promise.all([
        runRequestQueue(prisma, config).catch((err) => console.error("[SeerWorker] Kick request queue failed:", err)),
        runCleanupQueue(prisma, config).catch((err) => console.error("[SeerWorker] Kick cleanup queue failed:", err))
      ]);
    } catch (err) {
      console.error("[SeerWorker] Kick failed:", err);
    }
  }, 50);
}
function stopWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[SeerWorker] Stopped");
  }
}
function isWorkerRunning() {
  return timer !== null;
}
async function processNextRequest(prisma, config, skipIds) {
  const request = await getNextQueued(prisma);
  if (!request || skipIds.has(request.id)) return null;
  const fresh = await getRequestById(prisma, request.id);
  if (!fresh || fresh.status !== "queued" && fresh.status !== "retry_pending") return request.id;
  await updateRequestStatus(prisma, request.id, "processing");
  try {
    const seerrBody = {
      mediaType: request.mediaType,
      mediaId: request.tmdbId
    };
    if (request.mediaType === "tv" && request.seasons) {
      seerrBody.seasons = request.seasons.map(Number);
    }
    const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, request.mediaType, request.tmdbId);
    if (detail?.mediaInfo?.requests) {
      for (const r of detail.mediaInfo.requests) {
        if (r.status === 3 || r.status === 4) {
          await fetch(`${config.seerrUrl}/api/v1/request/${r.id}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
      }
    }
    if (request.mediaType === "tv" && detail && isAnimeFromKeywords(detail)) {
      const overrides = await fetchAnimeOverrides(config.seerrUrl, config.seerrApiKey);
      if (overrides) {
        Object.assign(seerrBody, {
          profileId: overrides.profileId,
          rootFolder: overrides.rootFolder,
          tags: overrides.tags
        });
        if (overrides.languageProfileId) seerrBody.languageProfileId = overrides.languageProfileId;
        console.log(`[SeerWorker] Anime detected for "${request.title}", applying overrides`);
      }
    }
    if (request.profileId && config.profiles?.length) {
      const profile = config.profiles.find((p) => p.id === request.profileId);
      if (profile) {
        if (request.mediaType === "movie") {
          if (profile.radarrServerId != null) seerrBody.serverId = profile.radarrServerId;
          if (profile.radarrProfileId != null) seerrBody.profileId = profile.radarrProfileId;
          if (profile.radarrRootFolder) seerrBody.rootFolder = profile.radarrRootFolder;
        } else {
          if (profile.sonarrServerId != null) seerrBody.serverId = profile.sonarrServerId;
          if (profile.sonarrProfileId != null) seerrBody.profileId = profile.sonarrProfileId;
          if (profile.sonarrRootFolder) seerrBody.rootFolder = profile.sonarrRootFolder;
          if (profile.sonarrLanguageProfileId != null) seerrBody.languageProfileId = profile.sonarrLanguageProfileId;
        }
        if (profile.tags !== void 0) {
          seerrBody.tags = profile.tags.length > 0 ? profile.tags : [];
        }
        console.log(`[SeerWorker] Applied profile "${profile.name}" for "${request.title}" (tags: ${JSON.stringify(profile.tags ?? "default")})`);
      }
    }
    const seerUserId = await resolveJellyseerrUserId(
      config,
      prisma,
      request.jellyfinUserId,
      request.username
    );
    seerrBody.userId = seerUserId;
    const res = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
      body: JSON.stringify(seerrBody),
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (text.includes("No seasons available to request")) {
        const mediaStatus = detail?.mediaInfo?.status;
        const localStatus = mediaStatus === 5 ? "available" : mediaStatus === 4 ? "partially_available" : "sent_to_seer";
        await updateRequestStatus(prisma, request.id, localStatus, {
          seerrMediaId: detail?.mediaInfo?.id,
          seerrMediaStatus: mediaStatus,
          sentAt: /* @__PURE__ */ new Date()
        });
        invalidateRequestCaches(request.jellyfinUserId);
        if (request.mediaType === "tv") {
          await notifyAvailableSeasons(prisma, request, detail?.mediaInfo?.seasons);
        } else if (mediaStatus === 5) {
          await notifyMovieAvailable(prisma, request);
        }
        console.log(`[SeerWorker] "${request.title}" : saisons d\xE9j\xE0 pr\xE9sentes c\xF4t\xE9 Jellyseerr \u2014 marqu\xE9 ${localStatus}`);
        return request.id;
      }
      throw new Error(`Seerr returned ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    await updateRequestStatus(prisma, request.id, "sent_to_seer", {
      seerrRequestId: data.id,
      seerrMediaId: data.media?.id,
      seerrMediaStatus: data.media?.status,
      sentAt: /* @__PURE__ */ new Date()
    });
    invalidateRequestCaches(request.jellyfinUserId);
    await upsertContentClaim(
      prisma,
      request.tmdbId,
      request.jellyfinUserId,
      request.mediaType,
      request.title,
      1800
    ).catch(() => {
    });
    console.log(`[SeerWorker] Sent request for "${request.title}" (seerr #${data.id})`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const newRetryCount = request.retryCount + 1;
    if (newRetryCount >= request.maxRetries) {
      await updateRequestStatus(prisma, request.id, "failed", {
        lastError: errMsg,
        retryCount: newRetryCount
      });
      await prisma.notification.create({
        data: {
          jellyfinUserId: request.jellyfinUserId,
          type: "request_status",
          title: request.title,
          body: `Votre demande pour \xAB ${request.title} \xBB a \xE9chou\xE9 apr\xE8s ${newRetryCount} tentatives`,
          refId: request.id
        }
      });
      console.warn(`[SeerWorker] Request for "${request.title}" FAILED after ${newRetryCount} retries: ${errMsg}`);
    } else {
      await updateRequestStatus(prisma, request.id, "retry_pending", {
        lastError: errMsg,
        retryCount: newRetryCount
      });
      console.warn(`[SeerWorker] Request for "${request.title}" retry ${newRetryCount}/${request.maxRetries}: ${errMsg}`);
    }
  }
  return request.id;
}

// server/request-status.ts
var AVAILABLE2 = 5;
var COMPLETED = 5;
var PARTIAL = 4;
function requestedSeasonsHere(row, seasonStates) {
  const requested = (row.seasons ?? []).filter((s) => typeof s.seasonNumber === "number");
  if (requested.length === 0) return "unknown";
  const states = new Map(seasonStates ?? []);
  for (const s of row.media?.seasons ?? []) {
    if (typeof s.status === "number") states.set(s.seasonNumber, s.status);
  }
  let here = 0;
  let some = 0;
  let known = 0;
  for (const s of requested) {
    const state2 = states.get(s.seasonNumber);
    if (state2 === AVAILABLE2 || s.status === COMPLETED) here++;
    else if (state2 === PARTIAL) some++;
    if (state2 !== void 0 || s.status === COMPLETED) known++;
  }
  if (here === requested.length) return "all";
  if (here + some > 0) return "some";
  return known === requested.length ? "none" : "unknown";
}
function resolveRequestStatus(row, local, seasonStates) {
  let status = mapSeerrStatus(row.status, row.media?.status, row.media?.downloadStatus);
  if (status === "partially_available") {
    const here = requestedSeasonsHere(row, seasonStates);
    if (here === "all") status = "available";
    else if (here === "none") {
      const downloads = row.media?.downloadStatus;
      status = mapSeerrStatus(row.status, downloads && downloads.length > 0 ? 3 : 2, downloads);
    }
  }
  if (local?.status === "available" && (status === "approved" || status === "unavailable" || status === "deleted")) {
    status = "available";
  }
  return status;
}

// server/download-progress.ts
var STALLED_STATUSES = /* @__PURE__ */ new Set(["warning", "failed", "paused", "downloadClientUnavailable"]);
function isStalledStatus(status) {
  return typeof status === "string" && STALLED_STATUSES.has(status);
}
function parseTimeSpan(raw) {
  if (!raw || typeof raw !== "string") return null;
  let rest = raw.trim();
  let days = 0;
  const dot = rest.indexOf(".");
  if (dot > 0 && dot < rest.indexOf(":")) {
    days = Number(rest.slice(0, dot));
    rest = rest.slice(dot + 1);
    if (!Number.isFinite(days)) return null;
  }
  const parts = rest.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  const total = days * 86400 + h * 3600 + m * 60 + s;
  return total >= 0 ? Math.round(total) : null;
}
function etaFrom(item) {
  const fromSpan = parseTimeSpan(item.timeLeft);
  const at = item.estimatedCompletionTime ?? null;
  if (fromSpan != null) return { seconds: fromSpan, at };
  if (at) {
    const ms = new Date(at).getTime() - Date.now();
    if (Number.isFinite(ms) && ms > 0) return { seconds: Math.round(ms / 1e3), at };
  }
  return { seconds: null, at };
}
function isValidating(size, sizeLeft, status) {
  if (status === "completed" || status === "importPending" || status === "importing") return true;
  return sizeLeft === 0 && size != null && size > 0;
}
function toDownloadProgress(item) {
  if (!item || typeof item !== "object") return null;
  const size = Number.isFinite(item.size) && item.size > 0 ? item.size : null;
  const sizeLeft = Number.isFinite(item.sizeLeft) ? Math.max(0, item.sizeLeft) : null;
  let percent = null;
  if (size != null && sizeLeft != null) {
    percent = Math.min(100, Math.max(0, (size - sizeLeft) / size * 100));
  }
  const eta = etaFrom(item);
  const status = typeof item.status === "string" ? item.status : "downloading";
  return {
    percent,
    size,
    sizeLeft,
    etaSeconds: eta.seconds,
    estimatedCompletionAt: eta.at,
    status,
    validating: isValidating(size, sizeLeft, status),
    stalled: isStalledStatus(status),
    title: item.title ?? item.episode?.title ?? null,
    seasonNumber: item.episode?.seasonNumber ?? null,
    episodeNumber: item.episode?.episodeNumber ?? null
  };
}
var MAX_DETAIL_ITEMS = 24;
function aggregateDownloads(items, isBlocked) {
  if (!Array.isArray(items) || items.length === 0) return { summary: null, items: [] };
  const parsed = [];
  for (const raw of items) {
    const p = toDownloadProgress(raw);
    if (!p) continue;
    if (!p.stalled && raw.downloadId && isBlocked?.(raw.downloadId)) {
      p.stalled = true;
      p.validating = false;
    }
    parsed.push(p);
  }
  if (parsed.length === 0) return { summary: null, items: [] };
  let totalSize = 0;
  let totalLeft = 0;
  let sized = 0;
  let maxEta = null;
  let latestAt = null;
  for (const p of parsed) {
    if (p.size != null && p.sizeLeft != null) {
      totalSize += p.size;
      totalLeft += p.sizeLeft;
      sized++;
    }
    if (p.etaSeconds != null && (maxEta === null || p.etaSeconds > maxEta)) maxEta = p.etaSeconds;
    if (p.estimatedCompletionAt && (!latestAt || p.estimatedCompletionAt > latestAt)) {
      latestAt = p.estimatedCompletionAt;
    }
  }
  const active = parsed.find((p) => p.status === "downloading") ?? parsed[0];
  const stalledCount = parsed.filter((p) => p.stalled).length;
  const percent = sized > 0 && totalSize > 0 ? Math.min(100, Math.max(0, (totalSize - totalLeft) / totalSize * 100)) : null;
  const summary = {
    percent,
    size: sized > 0 ? totalSize : null,
    sizeLeft: sized > 0 ? totalLeft : null,
    etaSeconds: maxEta,
    estimatedCompletionAt: latestAt,
    status: parsed.some((p) => p.status === "downloading") ? "downloading" : active.status,
    // `every` et non `some` : tant qu'un seul épisode descend encore, la
    // demande télécharge réellement — ce n'est pas de la validation.
    validating: parsed.every((p) => p.validating),
    // Un épisode bloqué parmi d'autres qui avancent : la demande avance.
    stalled: stalledCount > 0 && parsed.every((p) => p.stalled || p.validating),
    stalledCount,
    title: parsed.length === 1 ? active.title : null,
    seasonNumber: parsed.length === 1 ? active.seasonNumber : null,
    episodeNumber: parsed.length === 1 ? active.episodeNumber : null
  };
  const detail = parsed.slice().sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)).slice(0, MAX_DETAIL_ITEMS);
  return { summary, items: detail };
}

// server/seerr-unified.ts
function getUser(request) {
  return request.user;
}
function seerrRequestToUnified(sr, detail, localById, fallbackUser, seasonStates) {
  const local = localById.get(sr.id);
  const status = resolveRequestStatus(sr, local, seasonStates);
  const seasons = sr.seasons?.map((s) => s.seasonNumber).filter((n) => typeof n === "number") ?? null;
  const mediaType = sr.media?.mediaType ?? "movie";
  const title = detail?.title ?? detail?.name ?? local?.title ?? `#${sr.id}`;
  const year = (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null;
  const { summary, items } = aggregateDownloads(sr.media?.downloadStatus);
  return {
    download: summary,
    downloads: items.length > 1 ? items : void 0,
    id: local?.id ?? `seerr-${sr.id}`,
    source: "seerr",
    jellyfinUserId: sr.requestedBy?.jellyfinUserId ?? fallbackUser.jellyfinUserId,
    username: sr.requestedBy?.jellyfinUsername ?? fallbackUser.username,
    mediaType,
    tmdbId: sr.media?.tmdbId ?? 0,
    title,
    posterPath: detail?.posterPath ?? local?.posterPath ?? null,
    backdropPath: detail?.backdropPath ?? local?.backdropPath ?? null,
    overview: detail?.overview ?? local?.overview ?? null,
    year: year || local?.year || null,
    seasons: seasons && seasons.length > 0 ? seasons : local?.seasons ?? null,
    status,
    seerrRequestId: sr.id,
    seerrMediaId: sr.media?.id ?? null,
    seerrMediaStatus: sr.media?.status ?? null,
    retryCount: local?.retryCount ?? 0,
    maxRetries: local?.maxRetries ?? 10,
    lastError: local?.lastError ?? null,
    priority: local?.priority ?? 0,
    createdAt: sr.createdAt ?? local?.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: sr.updatedAt ?? local?.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    sentAt: local?.sentAt ?? null,
    completedAt: local?.completedAt ?? null,
    profileId: local?.profileId ?? null,
    isAnime: local?.isAnime ?? false
  };
}
function localToUnified(r) {
  return {
    id: r.id,
    source: "local",
    jellyfinUserId: r.jellyfinUserId,
    username: r.username,
    mediaType: r.mediaType,
    tmdbId: r.tmdbId,
    title: r.title,
    posterPath: r.posterPath,
    backdropPath: r.backdropPath,
    overview: r.overview,
    year: r.year,
    seasons: r.seasons,
    status: r.status,
    seerrRequestId: r.seerrRequestId,
    seerrMediaId: r.seerrMediaId,
    seerrMediaStatus: r.seerrMediaStatus,
    retryCount: r.retryCount,
    maxRetries: r.maxRetries,
    lastError: r.lastError,
    priority: r.priority,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    sentAt: r.sentAt,
    completedAt: r.completedAt,
    profileId: r.profileId,
    isAnime: r.isAnime
  };
}
async function fetchSeerrTmdbDetail(config, mediaType, tmdbId) {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function fetchSeerrRequestById(config, seerrId) {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/request/${seerrId}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
function parseRequestId(id) {
  if (id.startsWith("seerr-")) {
    const n = Number(id.slice(6));
    if (Number.isFinite(n)) return { kind: "seerr", seerrId: n };
  }
  return { kind: "local", id };
}

// server/series-gaps.ts
var AVAILABLE3 = 5;
var PARTIAL2 = 4;
var PAGE = 100;
var MAX_PAGES = 10;
async function loadIndex(cfg) {
  const out = /* @__PURE__ */ new Map();
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${cfg.seerrUrl}/api/v1/media?filter=partial&take=${PAGE}&skip=${page * PAGE}&sort=mediaAdded`;
    const res = await fetch(url, { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(1e4) });
    if (!res.ok) throw new Error(`Jellyseerr GET /media?filter=partial : ${res.status}`);
    const body = await res.json();
    for (const media of body.results ?? []) {
      if (media.mediaType !== "tv" || typeof media.tmdbId !== "number") continue;
      const seasons = /* @__PURE__ */ new Map();
      for (const s of media.seasons ?? []) {
        if (typeof s.seasonNumber === "number" && s.seasonNumber > 0 && typeof s.status === "number") {
          seasons.set(s.seasonNumber, s.status);
        }
      }
      out.set(media.tmdbId, seasons);
    }
    if ((body.pageInfo?.pages ?? 1) <= page + 1) break;
  }
  return out;
}
async function partialSeriesSeasons(cfg) {
  if (!cfg) return /* @__PURE__ */ new Map();
  try {
    return await cached(`series-gaps:${cfg.seerrUrl}`, 6e4, () => loadIndex(cfg), { staleMs: 10 * 6e4 });
  } catch {
    return /* @__PURE__ */ new Map();
  }
}
function gapsOf(seasons) {
  if (!seasons || seasons.size === 0) return null;
  const missing = [];
  const partial = [];
  for (const [season, status] of seasons) {
    if (status === PARTIAL2) partial.push(season);
    else if (status !== AVAILABLE3) missing.push(season);
  }
  if (missing.length === 0 && partial.length === 0) return null;
  return { missing: missing.sort((a, b) => a - b), partial: partial.sort((a, b) => a - b) };
}

// server/requests-list.ts
var LOCAL_PENDING_STATUSES = [
  "queued",
  "processing",
  "retry_pending",
  "failed",
  "deleting",
  "delete_failed"
];
async function buildMergedRows(prisma, cfg, user, log) {
  const localPendingRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ?
       AND status IN (${LOCAL_PENDING_STATUSES.map(() => "?").join(",")})
     ORDER BY created_at DESC`,
    user.userId,
    ...LOCAL_PENDING_STATUSES
  );
  const localPending = localPendingRows.map(rowToRequest);
  const localBySeerrId = /* @__PURE__ */ new Map();
  const allLocalRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE jellyfin_user_id = ? AND seerr_request_id IS NOT NULL`,
    user.userId
  );
  for (const row of allLocalRows) {
    const r = rowToRequest(row);
    if (r.seerrRequestId) localBySeerrId.set(r.seerrRequestId, r);
  }
  let seerrRows = [];
  let seerrUnreachable = false;
  const seasonStatesP = partialSeriesSeasons(cfg);
  try {
    const seerUserId = await resolveJellyseerrUserId(cfg, prisma, user.userId, user.username);
    const all = await fetchAllSeerrRequests(cfg, seerUserId);
    seerrRows = all.rows;
  } catch (err) {
    seerrUnreachable = true;
    log?.(err, "Seerr fetch failed, falling back to local only");
  }
  const seerrSeenIds = new Set(seerrRows.map((r) => r.id));
  const localOnly = localPending.filter(
    (l) => !l.seerrRequestId || !seerrSeenIds.has(l.seerrRequestId)
  );
  const deletingIds = /* @__PURE__ */ new Set();
  try {
    const pending2 = await prisma.$queryRawUnsafe(
      `SELECT seerr_request_id FROM seer_cleanup_queue
       WHERE status = 'pending' AND action = 'delete' AND seerr_request_id IS NOT NULL`
    );
    for (const r of pending2) deletingIds.add(Number(r.seerr_request_id));
  } catch {
  }
  const seasonStates = await seasonStatesP;
  return {
    seerrRows,
    localBySeerrId,
    localOnly,
    deletingIds,
    stats: computeStats(seerrRows, localOnly, localBySeerrId, deletingIds, seasonStates),
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    seasonStates,
    seerrUnreachable
  };
}
function computeStats(seerrRows, localOnly, localBySeerrId, deletingIds, seasonStates) {
  const byStatus = {};
  const byType = { movie: 0, tv: 0 };
  let total = 0;
  const bump = (status, mediaType) => {
    total++;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (mediaType === "movie") byType.movie++;
    else if (mediaType === "tv") byType.tv++;
  };
  for (const sr of seerrRows) {
    bump(effectiveStatus(sr, localBySeerrId, deletingIds, seasonStates), sr.media?.mediaType);
  }
  for (const l of localOnly) bump(l.status, l.mediaType);
  return { total, byStatus, byType };
}
function effectiveStatus(sr, localBySeerrId, deletingIds, seasonStates) {
  if (deletingIds.has(sr.id)) return "deleting";
  return resolveRequestStatus(sr, localBySeerrId.get(sr.id), seasonStates.get(sr.media?.tmdbId ?? 0));
}
function collectTmdbRefs(rows) {
  const out = [];
  for (const sr of rows.seerrRows) {
    if (sr.media?.tmdbId) out.push({ mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId });
  }
  for (const l of rows.localOnly) {
    if (l.tmdbId) out.push({ mediaType: l.mediaType, tmdbId: l.tmdbId });
  }
  return out;
}
function metaToDetail(meta) {
  if (!meta) return null;
  return {
    id: meta.tmdbId,
    title: meta.mediaType === "movie" ? meta.title : void 0,
    name: meta.mediaType === "tv" ? meta.title : void 0,
    posterPath: meta.posterPath ?? void 0,
    backdropPath: meta.backdropPath ?? void 0,
    overview: meta.overview ?? void 0,
    releaseDate: meta.mediaType === "movie" ? meta.releaseDate ?? void 0 : void 0,
    firstAirDate: meta.mediaType === "tv" ? meta.releaseDate ?? void 0 : void 0
  };
}
function hydrateRows(rows, meta, user) {
  const out = rows.localOnly.map(localToUnified);
  for (const sr of rows.seerrRows) {
    if (!sr.media) continue;
    const detail = metaToDetail(meta.get(tmdbKey({ mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId })));
    const unified = seerrRequestToUnified(sr, detail, rows.localBySeerrId, {
      jellyfinUserId: user.userId,
      username: user.username
    }, rows.seasonStates?.get(sr.media.tmdbId));
    if (rows.deletingIds.has(sr.id)) unified.status = "deleting";
    out.push(unified);
  }
  out.sort((a, b) => b.createdAt > a.createdAt ? 1 : -1);
  return out;
}
function filterAndPaginate(items, query) {
  let filtered = items;
  if (query.type) filtered = filtered.filter((r) => r.mediaType === query.type);
  if (query.status) {
    const wanted = new Set(query.status.split(",").map((s) => s.trim()));
    filtered = filtered.filter((r) => wanted.has(r.status));
  }
  if (query.q) {
    const q = query.q.trim().toLowerCase();
    if (q) filtered = filtered.filter((r) => (r.title ?? "").toLowerCase().includes(q));
  }
  const total = filtered.length;
  const offset = (query.page - 1) * query.limit;
  return {
    results: filtered.slice(offset, offset + query.limit),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit))
  };
}

// server/sonarr-schedule.ts
var SERIES_TTL_MS = 30 * 6e4;
var SERIES_STALE_MS = 6 * 36e5;
var CALENDAR_TTL_MS = 30 * 6e4;
var CALENDAR_STALE_MS = 6 * 36e5;
var EPISODES_TTL_MS = 36e5;
var EPISODES_STALE_MS = 12 * 36e5;
function airTimeKey(season, episode) {
  return `S${season}E${episode}`;
}
async function sonarr(cfg) {
  return getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "sonarr");
}
async function arrGet(server, path) {
  try {
    const res = await fetch(`${buildArrUrl(server)}${path}`, {
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
var SERIES_INDEX_KEY = "seer:sonarr:series";
var INDEX_RETRY_MS = 6e4;
var indexRereadAt = 0;
async function readSeriesIndex(cfg) {
  const server = await sonarr(cfg);
  if (!server) return /* @__PURE__ */ new Map();
  const rows = await arrGet(server, "/api/v3/series");
  if (rows === null) throw new Error("Sonarr injoignable (index des s\xE9ries)");
  const index = /* @__PURE__ */ new Map();
  for (const s of rows) {
    if (s.tmdbId && s.id) index.set(s.tmdbId, s.id);
  }
  return index;
}
async function sonarrSeriesIndex(cfg) {
  return cached(SERIES_INDEX_KEY, SERIES_TTL_MS, () => readSeriesIndex(cfg), { staleMs: SERIES_STALE_MS });
}
async function sonarrSeriesId(cfg, tmdbId) {
  const known = (await sonarrSeriesIndex(cfg)).get(tmdbId);
  if (known || Date.now() - indexRereadAt < INDEX_RETRY_MS) return known ?? null;
  indexRereadAt = Date.now();
  const fresh = await readSeriesIndex(cfg).catch(() => null);
  if (!fresh) return null;
  put(SERIES_INDEX_KEY, fresh, SERIES_TTL_MS, SERIES_STALE_MS);
  return fresh.get(tmdbId) ?? null;
}
async function sonarrCalendarRaw(cfg, from, to) {
  return cached(
    `seer:sonarr:calraw:${from}:${to}`,
    CALENDAR_TTL_MS,
    async () => {
      const server = await sonarr(cfg);
      if (!server) return [];
      const rows = await arrGet(
        server,
        `/api/v3/calendar?start=${from}&end=${to}&includeSeries=false`
      );
      if (rows === null) throw new Error("Sonarr injoignable (calendrier)");
      return rows;
    },
    { staleMs: CALENDAR_STALE_MS }
  );
}
async function sonarrWindowAirTimes(cfg, from, to) {
  const rows = await sonarrCalendarRaw(cfg, from, to);
  const times = /* @__PURE__ */ new Map();
  for (const e of rows) {
    if (!e.airDateUtc || e.seriesId == null || e.seasonNumber == null || e.episodeNumber == null) continue;
    times.set(`${e.seriesId}:${airTimeKey(e.seasonNumber, e.episodeNumber)}`, e.airDateUtc);
  }
  return times;
}
async function sonarrWindowEpisodes(cfg, from, to) {
  const [rows, index] = await Promise.all([
    sonarrCalendarRaw(cfg, from, to),
    sonarrSeriesIndex(cfg)
  ]);
  if (rows.length === 0 || index.size === 0) return [];
  const tmdbBySeriesId = /* @__PURE__ */ new Map();
  for (const [tmdbId, seriesId] of index) tmdbBySeriesId.set(seriesId, tmdbId);
  const out = [];
  for (const e of rows) {
    if (!e.airDateUtc || e.seriesId == null || e.seasonNumber == null || e.episodeNumber == null) continue;
    const tmdbId = tmdbBySeriesId.get(e.seriesId);
    if (!tmdbId) continue;
    out.push({
      tmdbId,
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      airDateUtc: e.airDateUtc,
      airDate: e.airDate && /^\d{4}-\d{2}-\d{2}$/.test(e.airDate) ? e.airDate : null
    });
  }
  return out;
}
async function attachAirTimes(cfg, res) {
  const episodes = res.items.filter((i) => i.kind === "episode");
  if (episodes.length === 0) return res;
  try {
    const [index, times] = await Promise.all([
      sonarrSeriesIndex(cfg),
      // Fenêtre élargie d'un jour : un épisode peut basculer d'une journée à
      // l'autre une fois ramené à l'heure locale, dans un sens comme dans l'autre.
      sonarrWindowAirTimes(cfg, shiftDay(res.from, -1), shiftDay(res.to, 1))
    ]);
    if (index.size === 0 || times.size === 0) return res;
    for (const item of episodes) {
      const seriesId = index.get(item.tmdbId);
      if (!seriesId || item.seasonNumber == null || item.episodeNumber == null) continue;
      const at = times.get(`${seriesId}:${airTimeKey(item.seasonNumber, item.episodeNumber)}`);
      if (at) item.airDateUtc = at;
    }
  } catch {
  }
  return res;
}
function shiftDay(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
async function sonarrSeriesAirTimes(cfg, tmdbId) {
  return cached(
    `seer:sonarr:eps:${tmdbId}`,
    EPISODES_TTL_MS,
    async () => {
      const [server, index] = await Promise.all([sonarr(cfg), sonarrSeriesIndex(cfg)]);
      const seriesId = index.get(tmdbId);
      if (!server || !seriesId) return /* @__PURE__ */ new Map();
      const rows = await arrGet(server, `/api/v3/episode?seriesId=${seriesId}`);
      if (rows === null) throw new Error("Sonarr injoignable (\xE9pisodes)");
      const times = /* @__PURE__ */ new Map();
      for (const e of rows) {
        if (!e.airDateUtc || e.seasonNumber == null || e.episodeNumber == null) continue;
        times.set(airTimeKey(e.seasonNumber, e.episodeNumber), e.airDateUtc);
      }
      return times;
    },
    { staleMs: EPISODES_STALE_MS }
  );
}

// server/sonarr-episodes.ts
var FACTS_TTL_MS = 6e4;
var SERIES_FACTS_TTL_MS = 45e3;
var FACTS_STALE_MS = 10 * 6e4;
var seriesFactsKey = (tmdbId) => `seer:sonarr:facts:series:${tmdbId}`;
function episodeKey(tmdbId, season, episode) {
  return `${tmdbId}:${airTimeKey(season, episode)}`;
}
function factOf(row) {
  const fact = { hasFile: row.hasFile === true, monitored: row.monitored === true };
  if (row.airDate && /^\d{4}-\d{2}-\d{2}$/.test(row.airDate)) fact.airDate = row.airDate;
  return fact;
}
async function sonarrWindowFacts(cfg, from, to) {
  return cached(
    `seer:sonarr:facts:${from}:${to}`,
    FACTS_TTL_MS,
    async () => {
      const facts = { byEpisode: /* @__PURE__ */ new Map(), byDay: /* @__PURE__ */ new Map() };
      const [server, index] = await Promise.all([sonarr(cfg), sonarrSeriesIndex(cfg)]);
      if (!server || index.size === 0) return facts;
      const rows = await arrGet(
        server,
        `/api/v3/calendar?start=${from}&end=${to}&unmonitored=true&includeSeries=false`
      );
      if (rows === null) throw new Error("Sonarr injoignable (\xE9tat des \xE9pisodes)");
      const tmdbBySeries = /* @__PURE__ */ new Map();
      for (const [tmdbId, seriesId] of index) tmdbBySeries.set(seriesId, tmdbId);
      for (const row of rows) {
        const tmdbId = row.seriesId != null ? tmdbBySeries.get(row.seriesId) : void 0;
        if (!tmdbId || row.seasonNumber == null || row.episodeNumber == null) continue;
        const fact = factOf(row);
        facts.byEpisode.set(episodeKey(tmdbId, row.seasonNumber, row.episodeNumber), fact);
        if (row.airDate) {
          const day = `${tmdbId}:${row.airDate}`;
          facts.byDay.set(day, [...facts.byDay.get(day) ?? [], fact]);
        }
      }
      return facts;
    },
    { staleMs: FACTS_STALE_MS }
  );
}
async function sonarrSeriesFacts(cfg, tmdbId) {
  return cached(
    seriesFactsKey(tmdbId),
    SERIES_FACTS_TTL_MS,
    async () => {
      const [server, seriesId] = await Promise.all([sonarr(cfg), sonarrSeriesId(cfg, tmdbId)]);
      if (!server || !seriesId) return /* @__PURE__ */ new Map();
      const rows = await arrGet(server, `/api/v3/episode?seriesId=${seriesId}`);
      if (rows === null) throw new Error("Sonarr injoignable (\xE9pisodes de la s\xE9rie)");
      const facts = /* @__PURE__ */ new Map();
      for (const row of rows) {
        if (row.seasonNumber == null || row.episodeNumber == null) continue;
        facts.set(airTimeKey(row.seasonNumber, row.episodeNumber), factOf(row));
      }
      return facts;
    },
    { staleMs: FACTS_STALE_MS }
  );
}

// server/radarr-movies.ts
var MOVIE_TTL_MS = 3e4;
var movieFactsKey = (tmdbId) => `seer:radarr:movie:${tmdbId}`;
async function radarrHasFile(cfg, tmdbId) {
  const server = await getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "radarr");
  if (!server) return null;
  return cached(movieFactsKey(tmdbId), MOVIE_TTL_MS, async () => {
    const movies = await arrGet(server, `/api/v3/movie?tmdbId=${tmdbId}`);
    if (movies === null) throw new Error("Radarr injoignable (fichier d'un film)");
    return movies.some((m) => m.hasFile === true);
  }).catch(() => null);
}

// server/arr-queue.ts
var MAX_ITEMS = 60;
var QUEUE_TTL_MS = 8e3;
var PAGE_SIZE = 250;
async function fetchQueue(server, path) {
  try {
    const res = await fetch(`${buildArrUrl(server)}${path}`, {
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { records: data.records ?? [], total: data.totalRecords ?? 0 };
  } catch {
    return null;
  }
}
function isValidating2(r) {
  const state2 = r.trackedDownloadState ?? "";
  if (state2 === "importPending" || state2 === "importing") return true;
  if (r.status === "completed") return true;
  return r.sizeleft === 0 && typeof r.size === "number" && r.size > 0;
}
var BLOCKED_STATES = /* @__PURE__ */ new Set(["importBlocked", "importFailed", "failedPending", "failed"]);
function isStalledRecord(r) {
  return isStalledStatus(r.status) || BLOCKED_STATES.has(r.trackedDownloadState ?? "") || r.trackedDownloadStatus === "error";
}
function firstMessage(r) {
  if (r.errorMessage) return r.errorMessage;
  for (const m of r.statusMessages ?? []) {
    const text = m.messages?.[0] ?? m.title;
    if (text) return text;
  }
  return null;
}
function toEntry(r, source) {
  if (r.id == null) return null;
  const size = typeof r.size === "number" && r.size > 0 ? r.size : null;
  const left = typeof r.sizeleft === "number" ? Math.max(0, r.sizeleft) : null;
  const percent = size != null && left != null ? Math.min(100, Math.max(0, (size - left) / size * 100)) : null;
  const media = source === "sonarr" ? r.series : r.movie;
  const stalled = isStalledRecord(r);
  return {
    id: `${source}-${r.id}`,
    source,
    mediaType: source === "sonarr" ? "tv" : "movie",
    title: media?.title ?? r.title ?? "",
    seasonNumber: r.seasonNumber ?? null,
    episodeNumber: r.episode?.episodeNumber ?? null,
    episodeTitle: r.episode?.title ?? null,
    tmdbId: media?.tmdbId ?? null,
    percent,
    size,
    sizeLeft: size != null ? left : null,
    etaSeconds: parseTimeSpan(r.timeleft),
    validating: isValidating2(r) && !stalled,
    paused: r.status === "paused" || r.status === "delay",
    stalled,
    warning: stalled || r.status === "warning" || r.status === "failed" ? firstMessage(r) : null,
    downloadId: typeof r.downloadId === "string" && r.downloadId !== "" ? r.downloadId : null
  };
}
var lastInQueue = /* @__PURE__ */ new Set();
function forgetFilesOfLeavers(items, unreachable) {
  const now = new Set(items.filter((e) => e.tmdbId != null).map((e) => `${e.source}:${e.tmdbId}`));
  for (const key of lastInQueue) {
    const [source, id] = key.split(":");
    if (now.has(key) || unreachable.includes(source)) continue;
    invalidate(source === "radarr" ? movieFactsKey(Number(id)) : seriesFactsKey(Number(id)));
  }
  const kept = [...lastInQueue].filter((key) => unreachable.includes(key.split(":")[0]));
  lastInQueue = /* @__PURE__ */ new Set([...now, ...kept]);
}
async function readQueues(cfg) {
  const [sonarr2, radarr] = await Promise.all([
    getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "sonarr"),
    getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "radarr")
  ]);
  const [sq, rq] = await Promise.all([
    sonarr2 ? fetchQueue(sonarr2, `/api/v3/queue?pageSize=${PAGE_SIZE}&includeSeries=true&includeEpisode=true`) : Promise.resolve(null),
    radarr ? fetchQueue(radarr, `/api/v3/queue?pageSize=${PAGE_SIZE}&includeMovie=true`) : Promise.resolve(null)
  ]);
  const unreachable = [];
  if (!sq) unreachable.push("sonarr");
  if (!rq) unreachable.push("radarr");
  const items = [
    ...(sq?.records ?? []).map((r) => toEntry(r, "sonarr")),
    ...(rq?.records ?? []).map((r) => toEntry(r, "radarr"))
  ].filter((e) => e !== null);
  items.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.title.localeCompare(b.title));
  forgetFilesOfLeavers(items, unreachable);
  return {
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    items,
    total: (sq?.total ?? 0) + (rq?.total ?? 0),
    unreachable
  };
}
function queueSnapshot(cfg) {
  return cached("seer:arr:queue:all", QUEUE_TTL_MS, () => readQueues(cfg));
}
async function fetchServerQueue(cfg) {
  const snapshot = await queueSnapshot(cfg);
  return { ...snapshot, items: snapshot.items.slice(0, MAX_ITEMS) };
}

// server/arr-truth.ts
var IN_FLIGHT = /* @__PURE__ */ new Set([
  "approved",
  "unavailable",
  "downloading",
  "partially_available"
]);
var MAX_DETAIL = 24;
var CONCURRENCY = 4;
function matchQueue(req, items) {
  const source = req.mediaType === "movie" ? "radarr" : "sonarr";
  return items.filter((e) => e.source === source && e.tmdbId === req.tmdbId && (req.mediaType === "movie" || !req.seasons?.length || e.seasonNumber != null && req.seasons.includes(e.seasonNumber)));
}
function entryProgress(e) {
  return {
    percent: e.validating ? 100 : e.percent,
    size: e.size,
    sizeLeft: e.sizeLeft,
    etaSeconds: e.validating ? null : e.etaSeconds,
    estimatedCompletionAt: null,
    status: e.validating ? "completed" : e.paused ? "paused" : e.stalled ? "warning" : "downloading",
    validating: e.validating,
    stalled: e.stalled,
    title: e.episodeTitle,
    seasonNumber: e.seasonNumber,
    episodeNumber: e.episodeNumber
  };
}
function summarizeQueue(entries) {
  if (entries.length === 0) return null;
  const downloads = /* @__PURE__ */ new Map();
  for (const e of entries) downloads.set(e.downloadId ?? e.id, e);
  let size = 0;
  let left = 0;
  let sized = 0;
  let eta = null;
  for (const e of downloads.values()) {
    if (e.size != null && e.sizeLeft != null) {
      size += e.size;
      left += e.sizeLeft;
      sized++;
    }
    if (!e.validating && e.etaSeconds != null && (eta === null || e.etaSeconds > eta)) eta = e.etaSeconds;
  }
  const importing = entries.every((e) => e.validating);
  const stalledCount = entries.filter((e) => e.stalled).length;
  const moving = entries.some((e) => !e.validating && !e.stalled && !e.paused);
  const single = entries.length === 1 ? entries[0] : null;
  const summary = {
    percent: importing ? 100 : sized > 0 && size > 0 ? Math.min(100, Math.max(0, (size - left) / size * 100)) : null,
    size: sized > 0 ? size : null,
    sizeLeft: sized > 0 ? left : null,
    etaSeconds: importing ? null : eta,
    estimatedCompletionAt: null,
    status: importing ? "completed" : moving ? "downloading" : entries.some((e) => e.paused) ? "paused" : "warning",
    validating: importing,
    // Bloquée : tout ce qui n'est pas arrivé est bloqué (même règle que Jellyseerr).
    stalled: stalledCount > 0 && entries.every((e) => e.stalled || e.validating),
    stalledCount,
    title: single?.episodeTitle ?? null,
    seasonNumber: single?.seasonNumber ?? null,
    episodeNumber: single?.episodeNumber ?? null
  };
  const items = entries.map(entryProgress).sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)).slice(0, MAX_DETAIL);
  return { summary, items };
}
function seriesFiles(seasons, facts) {
  if (!seasons?.length || facts.size === 0) return null;
  let total = 0;
  let here = 0;
  for (const [key, fact] of facts) {
    const season = Number(/^S(\d+)E/.exec(key)?.[1]);
    if (!seasons.includes(season)) continue;
    total++;
    if (fact.hasFile) here++;
  }
  if (total === 0) return null;
  return here === total ? "all" : here > 0 ? "some" : "none";
}
function verdictFor(req, queue, files) {
  const source = req.mediaType === "movie" ? "radarr" : "sonarr";
  if (queue.unreachable.includes(source)) return null;
  const arriving = summarizeQueue(matchQueue(req, queue.items));
  if (arriving) {
    const status = req.status === "partially_available" ? "partially_available" : "downloading";
    return { status, download: arriving.summary, downloads: arriving.items.length > 1 ? arriving.items : void 0 };
  }
  if (files === "all") return { status: "available", download: null };
  if (files === "some" && req.status !== "partially_available") return { status: "partially_available", download: null };
  if (files === "none" && req.status === "downloading") return { status: "unavailable", download: null };
  return null;
}
async function filesOf(cfg, req) {
  if (req.mediaType === "movie") {
    const hasFile = await radarrHasFile(cfg, req.tmdbId);
    return hasFile === null ? null : hasFile ? "all" : "none";
  }
  const facts = await sonarrSeriesFacts(cfg, req.tmdbId).catch(() => null);
  return facts ? seriesFiles(req.seasons, facts) : null;
}
async function arrVerdicts(cfg, requests) {
  const out = /* @__PURE__ */ new Map();
  const waiting = requests.filter((r) => IN_FLIGHT.has(r.status) && r.tmdbId > 0);
  if (waiting.length === 0) return out;
  const queue = await queueSnapshot(cfg).catch(() => null);
  if (!queue) return out;
  await mapLimit(waiting, CONCURRENCY, async (req) => {
    const files = matchQueue(req, queue.items).length > 0 ? null : await filesOf(cfg, req);
    const verdict = verdictFor(req, queue, files);
    if (verdict) out.set(req.id, verdict);
  });
  return out;
}
function withArrStatus(items, verdicts) {
  if (verdicts.size === 0) return items;
  return items.map((i) => {
    const v = verdicts.get(i.id);
    return v && v.status !== i.status ? { ...i, status: v.status } : i;
  });
}
function restat(stats, items, verdicts) {
  if (verdicts.size === 0) return stats;
  const byStatus = { ...stats.byStatus };
  for (const i of items) {
    const v = verdicts.get(i.id);
    if (!v || v.status === i.status) continue;
    byStatus[i.status] = Math.max(0, (byStatus[i.status] ?? 0) - 1);
    byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
  }
  return { ...stats, byStatus };
}

// server/routes-requests-read.ts
var ROWS_TTL_MS = 6e4;
var ROWS_STALE_MS = 6e5;
var PAGE_META_BUDGET = 20;
var rowsCacheKey = (userId) => `seer-cache:${userId}:rows`;
function loadMergedRows(prisma, cfg, user, log) {
  return cached(rowsCacheKey(user.userId), ROWS_TTL_MS, () => buildMergedRows(prisma, cfg, user, log), { staleMs: ROWS_STALE_MS });
}
function registerRequestReadRoutes(app, prisma, getWorkerConfig2) {
  const loadRows = (cfg, user) => loadMergedRows(prisma, cfg, user, (err, msg) => app.log?.warn?.({ err }, msg));
  app.get("/requests", async (request) => {
    const user = getUser(request);
    const query = request.query;
    if (user.isAdmin && query.status === "all_users") {
      const list = await getAllRequests(prisma, {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        mediaType: query.type
      });
      return { ...list, results: list.results.map(localToUnified) };
    }
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const config = await getWorkerConfig2();
    if (!config) {
      const local = await getUserRequests(prisma, user.userId, { page, limit, mediaType: query.type });
      return { ...local, results: local.results.map(localToUnified) };
    }
    const rows = await loadRows(config, user);
    const refs = collectTmdbRefs(rows);
    const { meta, missing } = await resolveTmdbMeta(prisma, config, refs, { maxFetch: 0 });
    const hydrated = hydrateRows(rows, meta, user);
    const verdicts = await arrVerdicts(config, hydrated).catch(() => /* @__PURE__ */ new Map());
    let items = withArrStatus(hydrated, verdicts);
    let result = filterAndPaginate(items, { page, limit, status: query.status, type: query.type, q: query.q });
    if (missing.length > 0) {
      const visible2 = new Set(
        result.results.map((r) => tmdbKey({ mediaType: r.mediaType, tmdbId: r.tmdbId }))
      );
      const onPage = missing.filter((r) => visible2.has(tmdbKey(r)));
      if (onPage.length > 0) {
        const filled = await resolveTmdbMeta(prisma, config, onPage, { maxFetch: PAGE_META_BUDGET });
        for (const [k, v] of filled.meta) meta.set(k, v);
        items = withArrStatus(hydrateRows(rows, meta, user), verdicts);
        result = filterAndPaginate(items, { page, limit, status: query.status, type: query.type, q: query.q });
      }
      scheduleTmdbBackfill(prisma, config, missing);
    }
    return {
      ...result,
      stats: restat(rows.stats, hydrated, verdicts),
      // > 0 : des titres manquent encore, le front repasse plus vite.
      metaPending: pendingBackfillCount()
    };
  });
  app.get("/requests/stats", async (request) => {
    const user = getUser(request);
    const config = await getWorkerConfig2();
    const empty = { total: 0, byStatus: {}, byType: { movie: 0, tv: 0 } };
    if (!config) return empty;
    const hit = peek(rowsCacheKey(user.userId), true);
    if (hit) return hit.stats;
    const rows = await loadRows(config, user);
    return rows.stats;
  });
  app.get("/requests/lookup", async (request) => {
    const user = getUser(request);
    const q = request.query;
    const tmdbId = Number(q.tmdbId);
    if (q.mediaType !== "tv" || !Number.isFinite(tmdbId) || tmdbId <= 0) return { seasons: [] };
    const rows = await prisma.$queryRawUnsafe(
      `SELECT seasons FROM seer_requests
       WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = 'tv'
         AND status NOT IN ('deleted', 'failed', 'available', 'deleting', 'delete_failed')`,
      user.userId,
      tmdbId
    );
    const seasons = /* @__PURE__ */ new Set();
    for (const r of rows) {
      if (!r.seasons) continue;
      try {
        const arr = typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons;
        if (Array.isArray(arr)) {
          for (const s of arr) {
            const n = Number(s);
            if (Number.isFinite(n)) seasons.add(n);
          }
        }
      } catch {
      }
    }
    return { seasons: [...seasons].sort((a, b) => a - b) };
  });
}

// server/routes-requests-actions.ts
function registerRequestActionRoutes(app, prisma, getWorkerConfig2) {
  app.post("/requests/:id/retry", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const forceRedownload = body.forceRedownload === true;
    const parsed = parseRequestId(id);
    const config = await getWorkerConfig2();
    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }
      const newProfileId = body.profileId !== void 0 ? body.profileId : req.profileId;
      if (config) {
        if (req.seerrRequestId) {
          await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
        if (forceRedownload && req.seerrMediaId) {
          await fetch(`${config.seerrUrl}/api/v1/media/${req.seerrMediaId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
      }
      await deleteRequestById(prisma, parsed.id);
      const retrySeasons2 = body.seasons && body.seasons.length > 0 ? body.seasons : req.seasons;
      const newReq2 = await createRequest(prisma, {
        jellyfinUserId: req.jellyfinUserId,
        username: req.username,
        mediaType: req.mediaType,
        tmdbId: req.tmdbId,
        title: req.title,
        posterPath: req.posterPath,
        backdropPath: req.backdropPath,
        overview: req.overview,
        year: req.year,
        seasons: retrySeasons2,
        priority: 1,
        profileId: newProfileId,
        isAnime: req.isAnime
      });
      invalidateRequestCaches(user.userId);
      kickWorkerNow();
      return reply.status(201).send(newReq2);
    }
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
    if (!seerrReq) {
      invalidateRequestCaches(user.userId);
      return reply.status(404).send({ errorKey: "seer:errRequestGone", message: "Request no longer exists in Jellyseerr" });
    }
    if (!user.isAdmin) {
      const settingsRows = await prisma.$queryRawUnsafe(
        `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
        user.userId
      );
      const myId = settingsRows[0]?.jellyseerr_user_id ?? null;
      if (!myId || seerrReq.requestedBy?.id !== myId) {
        return reply.status(403).send({ message: "Not your request" });
      }
    }
    const mediaType = seerrReq.media?.mediaType ?? "movie";
    const tmdbId = seerrReq.media?.tmdbId ?? 0;
    if (!tmdbId) return reply.status(400).send({ message: "Cannot retry: missing TMDB id" });
    const detail = await fetchSeerrTmdbDetail(config, mediaType, tmdbId);
    const title = detail?.title ?? detail?.name ?? `#${seerrReq.id}`;
    await fetch(`${config.seerrUrl}/api/v1/request/${seerrReq.id}`, {
      method: "DELETE",
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    }).catch(() => {
    });
    if (forceRedownload && seerrReq.media?.id) {
      await fetch(`${config.seerrUrl}/api/v1/media/${seerrReq.media.id}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(1e4)
      }).catch(() => {
      });
    }
    const retrySeasons = body.seasons && body.seasons.length > 0 ? body.seasons : seerrReq.seasons?.map((s) => s.seasonNumber) ?? null;
    const newReq = await createRequest(prisma, {
      jellyfinUserId: user.userId,
      username: user.username,
      mediaType,
      tmdbId,
      title,
      posterPath: detail?.posterPath ?? null,
      backdropPath: detail?.backdropPath ?? null,
      overview: detail?.overview ?? null,
      year: (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null,
      seasons: retrySeasons,
      priority: 1,
      profileId: body.profileId ?? null,
      isAnime: false
    });
    invalidateRequestCaches(user.userId);
    kickWorkerNow();
    return reply.status(201).send(newReq);
  });
  app.post("/requests/:id/mark", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const target = body.status;
    if (!target || !["available", "partial", "processing", "unknown"].includes(target)) {
      return reply.status(400).send({ message: "status must be 'available', 'partial', 'processing' or 'unknown'" });
    }
    const config = await getWorkerConfig2();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const parsed = parseRequestId(id);
    let seerrMediaId = null;
    let ownerJellyfinUserId = null;
    let ownerUsername = null;
    let seerrReq = null;
    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      seerrMediaId = req.seerrMediaId;
      ownerJellyfinUserId = req.jellyfinUserId;
    } else {
      seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
      if (!seerrReq) {
        invalidateRequestCaches(user.userId);
        return reply.status(404).send({ errorKey: "seer:errRequestGone", message: "Request no longer exists in Jellyseerr" });
      }
      seerrMediaId = seerrReq.media?.id ?? null;
      if (seerrReq.requestedBy?.id) {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT jellyfin_user_id, username FROM seer_user_settings WHERE jellyseerr_user_id = ? LIMIT 1`,
          seerrReq.requestedBy.id
        );
        ownerJellyfinUserId = rows[0]?.jellyfin_user_id ?? null;
        ownerUsername = rows[0]?.username ?? null;
      }
    }
    if (!seerrMediaId) return reply.status(400).send({ message: "No Jellyseerr media linked" });
    if (!user.isAdmin && ownerJellyfinUserId && ownerJellyfinUserId !== user.userId) {
      return reply.status(403).send({ message: "Not your request" });
    }
    const res = await fetch(`${config.seerrUrl}/api/v1/media/${seerrMediaId}/${target}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
      body: JSON.stringify({ is4k: false }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return reply.status(502).send({
        message: `Jellyseerr mark ${target} failed: ${res.status} ${text.slice(0, 200)}`
      });
    }
    const localStatus = target === "available" ? "available" : target === "partial" ? "partially_available" : "unavailable";
    const extra = target === "available" ? { completedAt: /* @__PURE__ */ new Date() } : void 0;
    if (parsed.kind === "local") {
      await updateRequestStatus(prisma, parsed.id, localStatus, extra);
    } else if (seerrReq?.media && ownerJellyfinUserId) {
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM seer_requests WHERE seerr_request_id = ? LIMIT 1`,
        seerrReq.id
      );
      if (existing.length > 0) {
        await updateRequestStatus(prisma, existing[0].id, localStatus, extra);
      } else if (target === "available") {
        await insertAvailablePin(prisma, config, seerrReq, {
          jellyfinUserId: ownerJellyfinUserId,
          username: ownerUsername ?? user.username
        });
      }
    }
    invalidateRequestCaches(user.userId);
    return { success: true, target };
  });
  app.post("/requests/:id/retry-delete", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const req = await getRequestById(prisma, id);
    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }
    if (req.status !== "delete_failed" && req.status !== "deleting") {
      return reply.status(400).send({ message: "Request is not in a deletable state" });
    }
    await updateRequestStatus(prisma, id, "deleting", { lastError: "" });
    await enqueueCleanup(prisma, {
      action: "delete",
      mediaType: req.mediaType,
      tmdbId: req.tmdbId,
      title: req.title,
      seerrRequestId: req.seerrRequestId,
      seerrMediaId: req.seerrMediaId,
      deleteFiles: true,
      requestId: id,
      jellyfinUserId: req.jellyfinUserId
    });
    kickWorkerNow();
    return { success: true };
  });
}
async function insertAvailablePin(prisma, config, seerrReq, owner) {
  const media = seerrReq.media;
  if (!media) return;
  const detail = await fetchSeerrTmdbDetail(config, media.mediaType, media.tmdbId);
  const seasons = seerrReq.seasons?.map((s) => s.seasonNumber).filter((n) => typeof n === "number") ?? [];
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_requests
      (id, jellyfin_user_id, username, media_type, tmdb_id, title, poster_path,
       backdrop_path, overview, year, seasons, status, seerr_request_id,
       seerr_media_id, seerr_media_status, sent_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, NOW(), NOW())`,
    uuid(),
    owner.jellyfinUserId,
    owner.username,
    media.mediaType,
    media.tmdbId,
    detail?.title ?? detail?.name ?? `#${seerrReq.id}`,
    detail?.posterPath ?? null,
    detail?.backdropPath ?? null,
    detail?.overview ?? null,
    (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null,
    seasons.length > 0 ? JSON.stringify(seasons) : null,
    seerrReq.id,
    media.id,
    media.status ?? null
  );
}

// server/search/pending.ts
var REFRESH_MS = 1e4;
var keys = /* @__PURE__ */ new Set();
var readAt = 0;
var reading = false;
function isLocallyPending(key) {
  return keys.has(key);
}
function refreshLocalPending(prisma) {
  if (reading || Date.now() - readAt < REFRESH_MS) return;
  reading = true;
  prisma.$queryRawUnsafe(
    `SELECT DISTINCT media_type, tmdb_id FROM seer_requests
     WHERE status IN ('queued', 'processing', 'retry_pending', 'sent_to_seer', 'approved')`
  ).then((rows) => {
    keys = new Set(rows.map((r) => `${r.media_type}:${Number(r.tmdb_id)}`));
  }).catch(() => void 0).finally(() => {
    readAt = Date.now();
    reading = false;
  });
}
function markLocallyPending(mediaType, tmdbId) {
  keys.add(`${mediaType}:${tmdbId}`);
}

// server/routes-requests.ts
function registerRequestRoutes(app, prisma, getWorkerConfig2) {
  registerRequestReadRoutes(app, prisma, getWorkerConfig2);
  registerRequestActionRoutes(app, prisma, getWorkerConfig2);
  app.post("/requests", async (request, reply) => {
    const user = getUser(request);
    const body = request.body;
    if (!body.mediaType || !body.tmdbId || !body.title) {
      return reply.status(400).send({ message: "mediaType, tmdbId, and title are required" });
    }
    const settings = await getOrCreateUserSettings(prisma, user.userId, user.username);
    if (settings.blocked) {
      return reply.status(403).send({ errorKey: "seer:errUserBlocked", message: "User is blocked" });
    }
    let isAnime = false;
    const config = await getWorkerConfig2();
    if (body.mediaType === "tv" && config) {
      const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, "tv", body.tmdbId);
      if (detail && isAnimeFromKeywords(detail)) isAnime = true;
    }
    if (body.mediaType === "movie" && !settings.allowMovies) {
      return reply.status(403).send({ errorKey: "seer:errMoviesDenied", message: "Movies denied" });
    }
    if (body.mediaType === "tv" && isAnime && !settings.allowAnime) {
      return reply.status(403).send({ errorKey: "seer:errAnimeDenied", message: "Anime denied" });
    }
    if (body.mediaType === "tv" && !isAnime && !settings.allowTv) {
      return reply.status(403).send({ errorKey: "seer:errTvDenied", message: "TV denied" });
    }
    if (settings.dailyLimit !== null && settings.dailyLimit !== void 0) {
      const todayCount = await countRequestsToday(prisma, user.userId);
      if (todayCount >= settings.dailyLimit) {
        return reply.status(429).send({
          errorKey: "seer:errQuotaReached",
          limit: settings.dailyLimit,
          message: `Daily quota reached (${settings.dailyLimit})`
        });
      }
    }
    if (body.mediaType === "tv" && body.seasons?.length) {
      const existing = await findExistingTvRequest(prisma, user.userId, body.tmdbId);
      if (existing) {
        const existingSeasons = new Set(existing.seasons ?? []);
        const newSeasons = body.seasons.filter((s) => !existingSeasons.has(s));
        if (newSeasons.length === 0) {
          return reply.status(409).send({ message: "All seasons already requested", existing });
        }
        const merged = [...existing.seasons ?? [], ...newSeasons].sort((a, b) => a - b);
        await addSeasonsToRequest(prisma, existing.id, merged);
        await createRequest(prisma, {
          jellyfinUserId: user.userId,
          username: user.username,
          mediaType: body.mediaType,
          tmdbId: body.tmdbId,
          title: body.title,
          posterPath: body.posterPath,
          backdropPath: body.backdropPath,
          overview: body.overview,
          year: body.year,
          seasons: newSeasons,
          profileId: body.profileId ?? existing.profileId,
          isAnime
        });
        const updated = await getRequestById(prisma, existing.id);
        invalidateRequestCaches(user.userId);
        markLocallyPending(body.mediaType, body.tmdbId);
        kickWorkerNow();
        return reply.status(201).send(updated);
      }
    }
    const dup = await findDuplicate(prisma, user.userId, body.tmdbId, body.mediaType, body.seasons);
    if (dup) {
      return reply.status(409).send({ message: "A request for this media is already active", existing: dup });
    }
    const req = await createRequest(prisma, {
      jellyfinUserId: user.userId,
      username: user.username,
      mediaType: body.mediaType,
      tmdbId: body.tmdbId,
      title: body.title,
      posterPath: body.posterPath,
      backdropPath: body.backdropPath,
      overview: body.overview,
      year: body.year,
      seasons: body.seasons,
      profileId: body.profileId,
      isAnime
    });
    invalidateRequestCaches(user.userId);
    markLocallyPending(body.mediaType, body.tmdbId);
    kickWorkerNow();
    return reply.status(201).send(req);
  });
  app.delete("/requests/:id", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const deleteFiles = body.deleteFiles === true;
    const parsed = parseRequestId(id);
    if (parsed.kind === "local") {
      const req = await getRequestById(prisma, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }
      const reqSeasons = req.seasons ?? [];
      const isSeasonSpecific2 = req.mediaType === "tv" && !!body.seasons && body.seasons.length > 0;
      const removing2 = isSeasonSpecific2 ? body.seasons : req.mediaType === "tv" && reqSeasons.length > 0 ? reqSeasons : null;
      const remaining2 = isSeasonSpecific2 ? reqSeasons.filter((s) => !removing2.includes(s)) : [];
      const partial2 = isSeasonSpecific2 && remaining2.length > 0;
      await enqueueCleanup(prisma, {
        action: "delete",
        mediaType: req.mediaType,
        tmdbId: req.tmdbId,
        title: req.title,
        // En partiel on préserve la demande Jellyseerr et la ligne locale
        // (les saisons conservées restent suivies) ; on agit uniquement sur *arr.
        seerrRequestId: partial2 ? null : req.seerrRequestId,
        seerrMediaId: req.seerrMediaId,
        deleteFiles,
        seasons: removing2,
        requestId: partial2 ? null : parsed.id,
        // Propriétaire réel : un admin peut supprimer la demande d'un tiers,
        // et c'est SON cache à lui qu'il faut invalider, pas celui de tout le monde.
        jellyfinUserId: req.jellyfinUserId
      });
      if (partial2) {
        await addSeasonsToRequest(prisma, parsed.id, remaining2);
      } else {
        await updateRequestStatus(prisma, parsed.id, "deleting");
      }
      invalidateRequestCaches(user.userId);
      kickWorkerNow();
      return { success: true, status: partial2 ? "updated" : "deleting" };
    }
    const config = await getWorkerConfig2();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
    if (!seerrReq) return reply.status(404).send({ message: "Seerr request not found" });
    if (!user.isAdmin) {
      const settingsRows = await prisma.$queryRawUnsafe(
        `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
        user.userId
      );
      const myId = settingsRows[0]?.jellyseerr_user_id ?? null;
      if (!myId || seerrReq.requestedBy?.id !== myId) {
        return reply.status(403).send({ message: "Not your request" });
      }
    }
    const seerrMediaType = seerrReq.media?.mediaType ?? "movie";
    const seerrSeasons = (seerrReq.seasons ?? []).map((s) => s.seasonNumber).filter((n) => typeof n === "number");
    const isSeasonSpecific = seerrMediaType === "tv" && !!body.seasons && body.seasons.length > 0;
    const removing = isSeasonSpecific ? body.seasons : seerrMediaType === "tv" && seerrSeasons.length > 0 ? seerrSeasons : null;
    const remaining = isSeasonSpecific ? seerrSeasons.filter((s) => !removing.includes(s)) : [];
    const partial = isSeasonSpecific && remaining.length > 0;
    await enqueueCleanup(prisma, {
      action: "delete",
      mediaType: seerrMediaType,
      tmdbId: seerrReq.media?.tmdbId ?? 0,
      title: `#${seerrReq.id}`,
      seerrRequestId: partial ? null : seerrReq.id,
      seerrMediaId: seerrReq.media?.id ?? null,
      deleteFiles,
      seasons: removing,
      requestId: null,
      jellyfinUserId: user.userId
    });
    invalidateRequestCaches(user.userId);
    kickWorkerNow();
    return { success: true, status: partial ? "updated" : "deleting" };
  });
}

// server/routes-bulk.ts
function getUser2(request) {
  return request.user;
}
function registerBulkRoutes(app, prisma, getWorkerConfig2) {
  app.post("/requests/bulk-delete", async (request, reply) => {
    const user = getUser2(request);
    const body = request.body;
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return reply.status(400).send({ message: "ids array required" });
    }
    let deleted = 0;
    let errors = 0;
    for (const id of body.ids.slice(0, 50)) {
      try {
        const req = await getRequestById(prisma, id);
        if (!req) {
          errors++;
          continue;
        }
        if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
          errors++;
          continue;
        }
        if (req.status === "deleting" || req.status === "processing") {
          errors++;
          continue;
        }
        await updateRequestStatus(prisma, id, "deleting");
        await enqueueCleanup(prisma, {
          action: "delete",
          mediaType: req.mediaType,
          tmdbId: req.tmdbId,
          title: req.title,
          seerrRequestId: req.seerrRequestId,
          seerrMediaId: req.seerrMediaId,
          // Cohérent avec la suppression unitaire : on arrête le suivi sans
          // supprimer les fichiers (lib partagée). Scopé aux saisons de la demande
          // pour ne jamais toucher d'autres saisons de la série.
          deleteFiles: false,
          seasons: req.mediaType === "tv" && req.seasons && req.seasons.length > 0 ? req.seasons : null,
          requestId: id,
          jellyfinUserId: req.jellyfinUserId
        });
        deleted++;
      } catch {
        errors++;
      }
    }
    if (deleted > 0) kickWorkerNow();
    return { success: true, deleted, errors };
  });
  app.post("/requests/bulk-retry", async (request, reply) => {
    const user = getUser2(request);
    const body = request.body;
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return reply.status(400).send({ message: "ids array required" });
    }
    const newProfileId = body.profileId;
    const config = await getWorkerConfig2();
    let retried = 0;
    let errors = 0;
    for (const id of body.ids.slice(0, 50)) {
      try {
        const req = await getRequestById(prisma, id);
        if (!req) {
          errors++;
          continue;
        }
        if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
          errors++;
          continue;
        }
        if (["deleting", "processing", "available"].includes(req.status)) {
          errors++;
          continue;
        }
        if (config) {
          if (req.seerrRequestId) {
            await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
              method: "DELETE",
              headers: { "X-Api-Key": config.seerrApiKey },
              signal: AbortSignal.timeout(1e4)
            }).catch(() => {
            });
          }
          if (req.seerrMediaId) {
            await fetch(`${config.seerrUrl}/api/v1/media/${req.seerrMediaId}`, {
              method: "DELETE",
              headers: { "X-Api-Key": config.seerrApiKey },
              signal: AbortSignal.timeout(1e4)
            }).catch(() => {
            });
          }
        }
        await deleteRequestById(prisma, id);
        const newReq = await createRequest(prisma, {
          jellyfinUserId: req.jellyfinUserId,
          username: req.username,
          mediaType: req.mediaType,
          tmdbId: req.tmdbId,
          title: req.title,
          posterPath: req.posterPath,
          backdropPath: req.backdropPath,
          overview: req.overview,
          year: req.year,
          seasons: req.seasons,
          priority: 1,
          profileId: newProfileId !== void 0 ? newProfileId : req.profileId
        });
        retried++;
      } catch {
        errors++;
      }
    }
    if (retried > 0) kickWorkerNow();
    return { success: true, retried, errors };
  });
}

// server/routes-profiles.ts
var TIMEOUT = 3e4;
function registerProfileRoutes(app, getPluginConfig2, getSeerrConfig) {
  app.get("/profiles", async () => {
    const config = getPluginConfig2();
    const profiles = config.profiles ?? [];
    return { profiles };
  });
  app.get("/profiles/options", async (_request, reply) => {
    const seerr = getSeerrConfig();
    if (!seerr) return reply.status(503).send({ message: "Seerr not configured" });
    try {
      const [radarr, sonarr2] = await Promise.all([
        fetchArrOptions(seerr, "radarr"),
        fetchArrOptions(seerr, "sonarr")
      ]);
      console.log(`[SeerProfiles] Found ${radarr.length} Radarr, ${sonarr2.length} Sonarr`);
      return { radarr, sonarr: sonarr2 };
    } catch (err) {
      console.error("[SeerProfiles] Failed to fetch options:", err);
      return reply.status(502).send({
        message: err instanceof Error ? err.message : "Failed to fetch quality options"
      });
    }
  });
}
async function fetchArrOptions(seerr, type) {
  const headers = { "X-Api-Key": seerr.seerrApiKey };
  let servers = [];
  try {
    const serviceRes = await fetch(`${seerr.seerrUrl}/api/v1/service/${type}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT)
    });
    if (serviceRes.ok) {
      servers = await serviceRes.json();
    } else {
      const settingsRes = await fetch(`${seerr.seerrUrl}/api/v1/settings/${type}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        servers = settings.map((s, i) => ({
          id: s.id ?? i,
          name: s.name ?? `${type} ${i}`,
          isDefault: s.isDefault ?? i === 0,
          is4k: s.is4k ?? false
        }));
      }
    }
  } catch (err) {
    console.warn(`[SeerProfiles] Failed to list ${type} servers:`, err instanceof Error ? err.message : err);
    return [];
  }
  const nonFourK = servers.filter((s) => !s.is4k);
  const results = await Promise.allSettled(
    nonFourK.map(async (s) => {
      const detailRes = await fetch(`${seerr.seerrUrl}/api/v1/service/${type}/${s.id}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (!detailRes.ok) return { ...s, profiles: [], rootFolders: [], tags: [] };
      const detail = await detailRes.json();
      const profiles = detail.profiles ?? [];
      const rootFolders = detail.rootFolders ?? [];
      const tags = detail.tags ?? [];
      console.log(`[SeerProfiles] ${type}/${s.id} "${s.name}": ${profiles.length} profiles, ${tags.length} tags`);
      return {
        id: s.id,
        name: s.name,
        isDefault: s.isDefault,
        profiles,
        tags,
        rootFolders: rootFolders.map((f) => ({ id: f.id, path: f.path }))
      };
    })
  );
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

// server/routes-users.ts
function registerUsersRoutes(app, prisma, getWorkerConfig2, requireAdmin) {
  app.get(
    "/admin/users",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig2();
      let jellyfinUsers = [];
      let jellyfinError = null;
      try {
        jellyfinUsers = await fetchJellyfinUsers();
      } catch (err) {
        jellyfinError = err instanceof Error ? err.message : "Jellyfin fetch failed";
      }
      if (config) {
        try {
          const seerUsers = await listAllJellyseerrUsers(config);
          const known = new Set(jellyfinUsers.map((u) => u.id));
          for (const su of seerUsers) {
            if (!su.jellyfinUserId || known.has(su.jellyfinUserId)) continue;
            jellyfinUsers.push({
              id: su.jellyfinUserId,
              name: su.jellyfinUsername || su.username || su.jellyfinUserId
            });
          }
        } catch {
        }
      }
      if (jellyfinUsers.length === 0) {
        return reply.status(503).send({
          message: jellyfinError ? `Cannot list Jellyfin users: ${jellyfinError}` : "No source available to list Jellyfin users"
        });
      }
      return await listJellyfinUsersWithStats(prisma, jellyfinUsers);
    }
  );
  app.put(
    "/admin/users/:jellyfinUserId",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { jellyfinUserId } = request.params;
      const body = request.body ?? {};
      const current = await getUserSettings(prisma, jellyfinUserId);
      const usernameForCreation = current?.username || jellyfinUserId;
      const existing = await getOrCreateUserSettings(prisma, jellyfinUserId, usernameForCreation);
      let dailyLimit = body.dailyLimit;
      if (dailyLimit === 0 || typeof dailyLimit === "string" && dailyLimit === "") {
        dailyLimit = null;
      }
      if (typeof dailyLimit === "number" && Number.isNaN(dailyLimit)) dailyLimit = null;
      await updateUserSettings(prisma, jellyfinUserId, {
        blocked: body.blocked,
        dailyLimit,
        allowMovies: body.allowMovies,
        allowTv: body.allowTv,
        allowAnime: body.allowAnime
      });
      const all = await listUsersWithStats(prisma);
      const updated = all.find((u) => u.jellyfinUserId === jellyfinUserId);
      return updated ?? existing;
    }
  );
  app.post(
    "/admin/users/sync",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig2();
      if (!config) return reply.status(503).send({ message: "Seerr not configured" });
      let invalidatedLinks = 0;
      try {
        invalidatedLinks = await invalidateStaleJellyseerrCache(config, prisma);
      } catch {
      }
      let users = [];
      let jellyfinError = null;
      try {
        users = await fetchJellyfinUsers();
      } catch (err) {
        jellyfinError = err instanceof Error ? err.message : "Jellyfin fetch failed";
      }
      try {
        const seerUsers = await listAllJellyseerrUsers(config);
        const known = new Set(users.map((u) => u.id));
        for (const su of seerUsers) {
          if (!su.jellyfinUserId || known.has(su.jellyfinUserId)) continue;
          users.push({
            id: su.jellyfinUserId,
            name: su.jellyfinUsername || su.username || su.jellyfinUserId
          });
        }
      } catch {
        if (jellyfinError && users.length === 0) {
          return reply.status(503).send({ message: `Sync failed: ${jellyfinError}` });
        }
      }
      let created = 0;
      const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
      for (const u of users) {
        const existing = await prisma.$queryRawUnsafe(
          `SELECT jellyfin_user_id, username FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
          u.id
        );
        if (existing.length === 0) {
          created++;
          await getOrCreateUserSettings(prisma, u.id, u.name);
        } else if (u.name && u.name !== u.id && (isUuid.test(existing[0].username) || existing[0].username === u.id)) {
          await updateUserSettings(prisma, u.id, { username: u.name });
        }
      }
      const all = await listUsersWithStats(prisma);
      let synced = 0;
      let failed = 0;
      for (const u of all) {
        try {
          await resolveJellyseerrUserId(config, prisma, u.jellyfinUserId, u.username);
          synced++;
        } catch {
          failed++;
        }
      }
      const aliveIds = new Set(users.map((u) => u.id));
      let removed = 0;
      const allSettings = await prisma.$queryRawUnsafe(
        `SELECT jellyfin_user_id FROM seer_user_settings`
      );
      for (const row of allSettings) {
        if (aliveIds.has(row.jellyfin_user_id)) continue;
        const hasReqs = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) AS cnt FROM seer_requests
           WHERE jellyfin_user_id = ?
             AND status NOT IN ('deleted','delete_failed')`,
          row.jellyfin_user_id
        );
        if (Number(hasReqs[0]?.cnt ?? 0) === 0) {
          await prisma.$executeRawUnsafe(
            `DELETE FROM seer_user_settings WHERE jellyfin_user_id = ?`,
            row.jellyfin_user_id
          );
          removed++;
        }
      }
      return {
        synced,
        failed,
        created,
        removed,
        invalidatedLinks,
        total: all.length,
        jellyfinAdminOk: jellyfinError === null
      };
    }
  );
  app.post(
    "/admin/sync-requests-ownership",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig2();
      if (!config) return reply.status(503).send({ message: "Seerr not configured" });
      try {
        await invalidateStaleJellyseerrCache(config, prisma);
      } catch {
      }
      let alreadyOk = 0;
      let reassigned = 0;
      let recreated = 0;
      let orphansCreated = 0;
      let failed = 0;
      const usersTouched = /* @__PURE__ */ new Set();
      const errors = [];
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, jellyfin_user_id, username, seerr_request_id, seerr_media_id, media_type, tmdb_id, seasons
         FROM seer_requests
         WHERE seerr_request_id IS NOT NULL
           AND status NOT IN ('deleted','deleting','delete_failed')`
      );
      const distinctUsers = /* @__PURE__ */ new Map();
      for (const r of rows) {
        if (distinctUsers.has(r.jellyfin_user_id)) continue;
        const best = await pickBestUsernameFor(prisma, r.jellyfin_user_id, r.username);
        distinctUsers.set(r.jellyfin_user_id, best);
      }
      const targetByJellyfin = /* @__PURE__ */ new Map();
      for (const [jfUserId, jfUsername] of distinctUsers) {
        try {
          const seerUserId = await resolveJellyseerrUserId(config, prisma, jfUserId, jfUsername);
          targetByJellyfin.set(jfUserId, seerUserId);
        } catch {
          try {
            const placeholder = await createPlaceholderJellyseerrUser(config, jfUsername);
            await updateUserSettings(prisma, jfUserId, {
              jellyseerrUserId: placeholder.id,
              jellyseerrLastSync: /* @__PURE__ */ new Date(),
              username: jfUsername
            });
            targetByJellyfin.set(jfUserId, placeholder.id);
            orphansCreated++;
          } catch (err) {
            errors.push({
              requestId: jfUserId,
              reason: err instanceof Error ? err.message : "placeholder creation failed"
            });
          }
        }
      }
      for (const r of rows) {
        if (!r.seerr_request_id) continue;
        const target = targetByJellyfin.get(r.jellyfin_user_id);
        if (!target) {
          failed++;
          continue;
        }
        let parsedSeasons = null;
        if (r.seasons) {
          try {
            parsedSeasons = typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons;
          } catch {
            parsedSeasons = null;
          }
        }
        try {
          const result = await reassignSeerrRequestOwnership(
            config,
            r.seerr_request_id,
            target,
            {
              mediaType: r.media_type,
              tmdbId: r.tmdb_id,
              seasons: parsedSeasons
            }
          );
          if (result.method === "skip") {
            alreadyOk++;
          } else if (result.method === "create-missing") {
            recreated++;
            usersTouched.add(r.jellyfin_user_id);
            if (result.newRequestId) {
              await prisma.$executeRawUnsafe(
                `UPDATE seer_requests SET seerr_request_id = ? WHERE id = ?`,
                result.newRequestId,
                r.id
              );
            }
          } else {
            reassigned++;
            usersTouched.add(r.jellyfin_user_id);
            if (result.method === "recreate" && result.newRequestId) {
              await prisma.$executeRawUnsafe(
                `UPDATE seer_requests SET seerr_request_id = ? WHERE id = ?`,
                result.newRequestId,
                r.id
              );
            }
          }
        } catch (err) {
          failed++;
          errors.push({
            requestId: r.id,
            reason: err instanceof Error ? err.message : "reassign failed"
          });
        }
      }
      for (const uid of usersTouched) invalidateRequestCaches(uid);
      return {
        total: rows.length,
        reassigned,
        recreated,
        alreadyOk,
        orphansCreated,
        failed,
        errors: errors.slice(0, 20)
        // limiter le payload
      };
    }
  );
}
async function pickBestUsernameFor(prisma, jellyfinUserId, fallback) {
  const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT username FROM seer_requests
     WHERE jellyfin_user_id = ? AND username IS NOT NULL AND username <> ''
     ORDER BY created_at DESC LIMIT 50`,
    jellyfinUserId
  );
  for (const r of rows) {
    if (r.username && !isUuid.test(r.username) && r.username !== jellyfinUserId) {
      return r.username;
    }
  }
  const settings = await prisma.$queryRawUnsafe(
    `SELECT username FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
    jellyfinUserId
  );
  if (settings[0]?.username && !isUuid.test(settings[0].username) && settings[0].username !== jellyfinUserId) {
    return settings[0].username;
  }
  return rows[0]?.username || fallback;
}
async function reassignSeerrRequestOwnership(config, seerrRequestId, targetUserId, localMedia) {
  const headers = { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey };
  const cur = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  });
  if (cur.status === 404) {
    if (!localMedia.tmdbId) throw new Error("missing local tmdbId for re-creation");
    const createBody2 = {
      mediaType: localMedia.mediaType,
      mediaId: localMedia.tmdbId,
      userId: targetUserId
    };
    if (localMedia.seasons?.length) createBody2.seasons = localMedia.seasons;
    const postRes2 = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST",
      headers,
      body: JSON.stringify(createBody2),
      signal: AbortSignal.timeout(15e3)
    });
    if (!postRes2.ok) {
      const text = await postRes2.text().catch(() => "");
      throw new Error(`re-create missing failed (${postRes2.status}): ${text.slice(0, 200)}`);
    }
    const created2 = await postRes2.json();
    return { method: "create-missing", newRequestId: created2.id };
  }
  if (!cur.ok) {
    throw new Error(`GET request ${seerrRequestId} failed: ${cur.status}`);
  }
  const req = await cur.json();
  if (req.requestedBy?.id === targetUserId) return { method: "skip" };
  const putBody = {
    mediaType: req.media?.mediaType,
    userId: targetUserId
  };
  if (req.serverId != null) putBody.serverId = req.serverId;
  if (req.profileId != null) putBody.profileId = req.profileId;
  if (req.rootFolder) putBody.rootFolder = req.rootFolder;
  if (req.languageProfileId != null) putBody.languageProfileId = req.languageProfileId;
  if (req.tags?.length) putBody.tags = req.tags;
  const putRes = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(putBody),
    signal: AbortSignal.timeout(15e3)
  });
  if (putRes.ok) {
    const updated = await putRes.json().catch(() => null);
    if (updated?.requestedBy?.id === targetUserId) {
      return { method: "put" };
    }
  }
  await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "DELETE",
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  }).catch(() => {
  });
  if (!req.media?.tmdbId || !req.media?.mediaType) {
    throw new Error("missing media info for recreate");
  }
  const createBody = {
    mediaType: req.media.mediaType,
    mediaId: req.media.tmdbId,
    userId: targetUserId
  };
  if (req.seasons?.length) createBody.seasons = req.seasons.map((s) => s.seasonNumber);
  if (req.serverId != null) createBody.serverId = req.serverId;
  if (req.profileId != null) createBody.profileId = req.profileId;
  if (req.rootFolder) createBody.rootFolder = req.rootFolder;
  if (req.languageProfileId != null) createBody.languageProfileId = req.languageProfileId;
  if (req.tags?.length) createBody.tags = req.tags;
  const postRes = await fetch(`${config.seerrUrl}/api/v1/request`, {
    method: "POST",
    headers,
    body: JSON.stringify(createBody),
    signal: AbortSignal.timeout(15e3)
  });
  if (!postRes.ok) {
    const text = await postRes.text().catch(() => "");
    throw new Error(`recreate failed (${postRes.status}): ${text.slice(0, 200)}`);
  }
  const created = await postRes.json();
  return { method: "recreate", newRequestId: created.id };
}
async function fetchJellyfinUsers() {
  const baseUrl = (process.env.JELLYFIN_URL || "").replace(/\/$/, "");
  const apiKey = process.env.JELLYFIN_ADMIN_API_KEY || "";
  if (!baseUrl || !apiKey) {
    throw new Error("Jellyfin not configured on Tentacle backend (JELLYFIN_URL or JELLYFIN_ADMIN_API_KEY missing)");
  }
  const res = await fetch(`${baseUrl}/Users`, {
    headers: { "X-Emby-Token": apiKey },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    throw new Error(`Jellyfin GET /Users failed: ${res.status}`);
  }
  const data = await res.json();
  return data.filter((u) => !u.Policy?.IsDisabled).map((u) => ({ id: u.Id, name: u.Name }));
}

// server/availability.ts
var THEATRICAL_WINDOW_DAYS = 180;
var RECENT_WINDOW_DAYS = 120;
function daysBetween(from, to) {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const a = new Date(ay, am - 1, ad).getTime();
  const b = new Date(by, bm - 1, bd).getTime();
  return Math.round((b - a) / 864e5);
}
var RANK = { physical: 0, digital: 1, streaming: 2, theatrical: 3 };
function buildChannels(meta, today) {
  const raw = [
    ["physical", meta.physicalDate],
    ["digital", meta.digitalDate],
    ["theatrical", meta.theatricalDate]
  ];
  const channels = [];
  for (const [id, date] of raw) {
    if (!date) continue;
    const released = date <= today;
    if (released) {
      const window = id === "theatrical" ? THEATRICAL_WINDOW_DAYS : RECENT_WINDOW_DAYS;
      if (daysBetween(date, today) > window) continue;
    }
    channels.push({ id, date, released });
  }
  const hasDigital = channels.some((c) => c.id === "digital" && c.released);
  if (!hasDigital && (meta.providerIds?.length ?? 0) > 0) {
    channels.push({ id: "streaming", date: null, released: true });
  }
  return channels.sort((a, b) => {
    if (a.released !== b.released) return a.released ? -1 : 1;
    if (a.released) return RANK[a.id] - RANK[b.id];
    return (a.date ?? "").localeCompare(b.date ?? "");
  });
}
function kindOf(channels, meta, today) {
  const first = channels[0];
  if (!first) {
    return meta.releaseDate && meta.releaseDate > today ? "upcoming" : "released";
  }
  if (first.released) return first.id === "theatrical" ? "theatrical" : "released";
  return first.id === "digital" ? "digital_soon" : "upcoming";
}
function outlookOf(meta, today, channels) {
  const outOfTheaters = meta.digitalDate != null && meta.digitalDate <= today || meta.physicalDate != null && meta.physicalDate <= today || (meta.providerIds?.length ?? 0) > 0;
  if (outOfTheaters) return "likely";
  if (channels.some((c) => c.released)) return "unlikely";
  return channels.length === 0 ? "likely" : "not_yet";
}
function classifyAvailability(meta, today = todayString()) {
  const base = {
    mediaType: meta.mediaType,
    tmdbId: meta.tmdbId,
    theatricalDate: meta.theatricalDate,
    digitalDate: meta.digitalDate,
    physicalDate: meta.physicalDate,
    providerIds: meta.providerIds ?? []
  };
  if (meta.mediaType === "tv") {
    const notAired = meta.releaseDate && meta.releaseDate > today || !meta.releaseDate && isPlanned(meta.tmdbStatus);
    return {
      ...base,
      // Rien qui ne soit pas encore diffusé ne peut être « en streaming ».
      channels: notAired ? [] : buildChannels(meta, today),
      outlook: notAired ? "not_yet" : "likely",
      kind: notAired ? "not_aired" : "released",
      date: notAired ? meta.releaseDate : null,
      obtainable: !notAired
    };
  }
  const channels = buildChannels(meta, today);
  const kind = kindOf(channels, meta, today);
  const outlook = outlookOf(meta, today, channels);
  const date = channels[0]?.date ?? (meta.releaseDate && meta.releaseDate > today ? meta.releaseDate : null);
  return {
    ...base,
    channels,
    outlook,
    kind,
    date: kind === "released" && channels.length === 0 ? null : date,
    obtainable: outlook === "likely"
  };
}
function isPlanned(tmdbStatus) {
  const status = (tmdbStatus ?? "").toLowerCase();
  return status === "planned" || status === "in production" || status === "rumored";
}

// server/routes-availability.ts
var MAX_ITEMS2 = 120;
var FETCH_BUDGET = 12;
function registerAvailabilityRoutes(app, prisma, getWorkerConfig2) {
  app.post("/availability", async (request) => {
    const body = request.body ?? {};
    const asked = Array.isArray(body.items) ? body.items : [];
    const raw = asked.slice(0, MAX_ITEMS2);
    if (asked.length > MAX_ITEMS2) {
      console.warn(`[Seer] /availability : ${asked.length} titres demand\xE9s, ${MAX_ITEMS2} trait\xE9s`);
    }
    const refs = [];
    for (const it of raw) {
      const tmdbId = Number(it?.tmdbId);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) continue;
      if (it?.mediaType !== "movie" && it?.mediaType !== "tv") continue;
      refs.push({ mediaType: it.mediaType, tmdbId });
    }
    if (refs.length === 0) return { results: [] };
    const config = await getWorkerConfig2();
    const region = typeof body.region === "string" && /^[a-z]{2}$/i.test(body.region) ? body.region.toUpperCase() : DEFAULT_REGION;
    const { meta, missing } = await resolveTmdbMeta(prisma, config, refs, {
      maxFetch: FETCH_BUDGET,
      region
    });
    if (missing.length > 0) scheduleTmdbBackfill(prisma, config, missing, region);
    const results = [];
    for (const ref of refs) {
      const m = meta.get(tmdbKey(ref));
      if (m) results.push(classifyAvailability(m));
    }
    return { results, pending: missing.length };
  });
  app.get("/series/gaps", async () => {
    const seasons = await partialSeriesSeasons(await getWorkerConfig2());
    const items = {};
    for (const [tmdbId, states] of seasons) {
      const gaps = gapsOf(states);
      if (gaps) items[tmdbId] = gaps;
    }
    return { items };
  });
}

// server/routes-progress.ts
var PROGRESS_TTL_MS = 1e4;
function registerProgressRoutes(app, prisma, getWorkerConfig2, requireAdmin) {
  app.get("/downloads", { preHandler: requireAdmin }, async () => {
    const config = await getWorkerConfig2();
    const empty = {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      items: [],
      total: 0,
      unreachable: []
    };
    if (!config) return empty;
    return fetchServerQueue(config);
  });
  app.get("/requests/progress", async (request) => {
    const user = getUser(request);
    const config = await getWorkerConfig2();
    if (!config) return { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), items: [] };
    return cached(`seer-cache:${user.userId}:progress`, PROGRESS_TTL_MS, async () => {
      const rows = await loadMergedRows(prisma, config, user, (err, msg) => app.log?.warn?.({ err }, msg));
      const requests = hydrateRows(rows, /* @__PURE__ */ new Map(), user).filter((r) => IN_FLIGHT.has(r.status));
      const verdicts = await arrVerdicts(config, requests);
      const items = [];
      for (const r of requests) {
        const verdict = verdicts.get(r.id);
        if (!verdict || !verdict.download && verdict.status === r.status) continue;
        items.push({
          id: r.id,
          tmdbId: r.tmdbId,
          mediaType: r.mediaType,
          status: verdict.status,
          download: verdict.download ?? void 0,
          downloads: verdict.downloads
        });
      }
      return { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), items };
    });
  });
}

// server/calendar-types.ts
var DATE_RE2 = /^\d{4}-\d{2}-\d{2}$/;
function isDayString(v) {
  return typeof v === "string" && DATE_RE2.test(v);
}
function addDays(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
function makeItemId(mediaType, tmdbId, kind, date) {
  return `${mediaType}:${tmdbId}:${kind}:${date}`;
}
function sortCalendarItems(items) {
  return items.sort((a, b) => a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1);
}
function capPerSeries(items, max) {
  const seen = /* @__PURE__ */ new Map();
  const out = [];
  for (const item of items) {
    if (item.mediaType !== "tv") {
      out.push(item);
      continue;
    }
    const n = (seen.get(item.tmdbId) ?? 0) + 1;
    seen.set(item.tmdbId, n);
    if (n <= max) out.push(item);
  }
  return out;
}
function capPerSeriesFuture(items, max, today) {
  const seen = /* @__PURE__ */ new Map();
  const out = [];
  for (const item of items) {
    if (item.mediaType !== "tv" || item.date < today) {
      out.push(item);
      continue;
    }
    const n = (seen.get(item.tmdbId) ?? 0) + 1;
    seen.set(item.tmdbId, n);
    if (n <= max) out.push(item);
  }
  return out;
}

// server/calendar-everyone.ts
var LOCAL_PENDING_STATUSES2 = [
  "queued",
  "processing",
  "retry_pending",
  "failed",
  "deleting",
  "delete_failed"
];
var NO_STATS = { total: 0, byStatus: {}, byType: { movie: 0, tv: 0 } };
async function buildEveryoneRows(prisma, cfg, log) {
  const localPendingRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests
     WHERE status IN (${LOCAL_PENDING_STATUSES2.map(() => "?").join(",")})
     ORDER BY created_at DESC`,
    ...LOCAL_PENDING_STATUSES2
  );
  const localPending = localPendingRows.map(rowToRequest);
  const localBySeerrId = /* @__PURE__ */ new Map();
  const allLocalRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM seer_requests WHERE seerr_request_id IS NOT NULL`
  );
  for (const row of allLocalRows) {
    const r = rowToRequest(row);
    if (r.seerrRequestId) localBySeerrId.set(r.seerrRequestId, r);
  }
  let seerrRows = [];
  let seerrUnreachable = false;
  try {
    const all = await fetchAllSeerrRequests(cfg, null);
    seerrRows = all.rows;
  } catch (err) {
    seerrUnreachable = true;
    log?.(err, "Seerr fetch (tous) failed, falling back to local only");
  }
  const seerrSeenIds = new Set(seerrRows.map((r) => r.id));
  const localOnly = localPending.filter(
    (l) => !l.seerrRequestId || !seerrSeenIds.has(l.seerrRequestId)
  );
  return {
    seerrRows,
    localBySeerrId,
    localOnly,
    deletingIds: /* @__PURE__ */ new Set(),
    stats: NO_STATS,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    seerrUnreachable
  };
}

// server/calendar-freshness.ts
function isDateless(m) {
  return !m.releaseDate && !m.digitalDate && !m.theatricalDate && !m.physicalDate && !m.nextAirDate;
}
function needsDateRefresh(m, now = Date.now()) {
  if (!isDateless(m)) return false;
  const expires = Date.parse(m.expiresAt);
  return !Number.isFinite(expires) || expires <= now;
}
function needsTraitsRefresh(m) {
  return !m.originalLanguage;
}

// server/calendar-personal.ts
var FETCH_BUDGET2 = 25;
var MAX_PER_SERIES = 3;
var SETTLED_MEDIA_STATUS = /* @__PURE__ */ new Set([5]);
function collectRequestRefs(rows, includeSettled) {
  const refs = /* @__PURE__ */ new Map();
  const statusByKey = /* @__PURE__ */ new Map();
  for (const sr of rows.seerrRows) {
    if (!sr.media?.tmdbId) continue;
    const ref = { mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId };
    const key = tmdbKey(ref);
    if (!includeSettled && sr.media.mediaType === "movie" && SETTLED_MEDIA_STATUS.has(sr.media.status ?? 0)) continue;
    refs.set(key, ref);
    if (!statusByKey.has(key)) {
      const local = rows.localBySeerrId.get(sr.id);
      statusByKey.set(key, {
        status: resolveRequestStatus(sr, local, rows.seasonStates?.get(sr.media.tmdbId)),
        requestId: local?.id ?? `seerr-${sr.id}`
      });
    }
  }
  for (const l of rows.localOnly) {
    if (!l.tmdbId) continue;
    const key = tmdbKey({ mediaType: l.mediaType, tmdbId: l.tmdbId });
    refs.set(key, { mediaType: l.mediaType, tmdbId: l.tmdbId });
    if (!statusByKey.has(key)) statusByKey.set(key, { status: l.status, requestId: l.id });
  }
  return { refs, statusByKey };
}
async function buildPersonalCalendar(prisma, cfg, rows, opts) {
  const region = opts.region ?? DEFAULT_REGION;
  const { refs, statusByKey } = collectRequestRefs(rows, opts.includeSettled ?? false);
  const list = Array.from(refs.values());
  const { meta, missing } = await resolveTmdbMeta(prisma, cfg, list, {
    maxFetch: opts.maxFetch ?? FETCH_BUDGET2,
    region
  });
  const undated = list.filter((ref) => {
    const m = meta.get(tmdbKey(ref));
    return !!m && needsDateRefresh(m);
  });
  const toFill = [...missing, ...undated];
  const untyped = list.filter((ref) => {
    const m = meta.get(tmdbKey(ref));
    return !!m && !needsDateRefresh(m) && needsTraitsRefresh(m);
  });
  if (toFill.length > 0 || untyped.length > 0) {
    scheduleTmdbBackfill(prisma, cfg, [...toFill, ...untyped], region);
  }
  const items = [];
  for (const ref of list) {
    const m = meta.get(tmdbKey(ref));
    if (!m) continue;
    const ctx = statusByKey.get(tmdbKey(ref));
    for (const item of metaToCalendarItems(m, opts.from, opts.to)) {
      items.push({
        ...item,
        requestId: ctx?.requestId ?? null,
        requestStatus: ctx?.status ?? null
      });
    }
  }
  return {
    from: opts.from,
    to: opts.to,
    items: capPerSeries(sortCalendarItems(items), MAX_PER_SERIES),
    /* Des lignes de repli (Jellyseerr muet) rendent le résultat incomplet au
     * même titre que des fiches manquantes : TTL court + sondage du client,
     * jusqu'à ce que la vraie liste revienne. */
    partial: toFill.length > 0 || rows.seerrUnreachable === true
  };
}
function metaToCalendarItems(m, from, to) {
  const out = [];
  const push = (date, kind, season, episode) => {
    if (!date || date < from || date > to) return;
    out.push({
      id: makeItemId(m.mediaType, m.tmdbId, kind, date),
      date,
      mediaType: m.mediaType,
      tmdbId: m.tmdbId,
      title: m.title,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      overview: m.overview,
      kind,
      seasonNumber: season ?? null,
      episodeNumber: episode ?? null,
      networks: m.networks,
      providerIds: m.providerIds,
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: m.isAnime ?? false
    });
  };
  if (m.mediaType === "movie") {
    push(m.digitalDate, "digital");
    push(m.theatricalDate, "theatrical");
    push(m.physicalDate, "physical");
    if (out.length === 0) push(m.releaseDate, "premiere");
  } else {
    push(m.nextAirDate, "episode", m.nextSeason, m.nextEpisode);
    if (m.releaseDate && (!m.nextAirDate || m.releaseDate !== m.nextAirDate)) {
      push(m.releaseDate, "premiere");
    }
  }
  return out;
}

// server/calendar-providers.ts
var EPISODE_FETCH_BUDGET = 30;
var MEDIA_STATUS_BLOCKLISTED = 6;
async function buildProviderEpisodes(prisma, cfg, rows, opts) {
  const refs = [];
  const posters = /* @__PURE__ */ new Map();
  for (const r of rows) {
    if (!r.id || r.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED) continue;
    refs.push({ mediaType: "tv", tmdbId: r.id });
    posters.set(r.id, r);
  }
  if (refs.length === 0) return { items: [], partial: false };
  const { meta, missing } = await resolveTmdbMeta(prisma, cfg, refs, {
    maxFetch: EPISODE_FETCH_BUDGET,
    region: opts.region
  });
  if (missing.length > 0) scheduleTmdbBackfill(prisma, cfg, missing, opts.region);
  const items = [];
  for (const ref of refs) {
    const m = meta.get(tmdbKey(ref));
    const date = m?.nextAirDate;
    if (!m || !date || date < opts.from || date > opts.to) continue;
    const src = posters.get(ref.tmdbId);
    items.push({
      id: makeItemId("tv", ref.tmdbId, "episode", date),
      date,
      mediaType: "tv",
      tmdbId: ref.tmdbId,
      title: m.title || src?.name || "",
      posterPath: m.posterPath ?? src?.posterPath ?? null,
      backdropPath: m.backdropPath ?? src?.backdropPath ?? null,
      overview: m.overview ?? src?.overview ?? null,
      kind: "episode",
      seasonNumber: m.nextSeason,
      episodeNumber: m.nextEpisode,
      networks: m.networks,
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: m.isAnime ?? false,
      // Les vraies plateformes de la série, pas celles qu'on a demandées.
      providerIds: m.providerIds ?? [],
      requestId: null,
      requestStatus: null
    });
  }
  return { items, partial: missing.length > 0 };
}

// server/calendar-store-sources.ts
var MEDIA_STATUS_BLOCKLISTED2 = 6;
var PAGES = 3;
var SRC_TTL_MS = 36e5;
var SRC_STALE_MS = 6 * 36e5;
var TMDB_STATUS_RETURNING = "0";
var UNION_CHUNK = 8;
var UNION_PROVIDERS_MAX = 16;
var PRIORITY_PROVIDER_IDS = [8, 119, 337, 283, 350, 381, 415, 1899];
async function discover(cfg, path, params, page) {
  const qs = new URLSearchParams({ ...params, page: String(page) });
  const res = await fetch(`${cfg.seerrUrl}/api/v1/discover/${path}?${qs}`, {
    headers: { "X-Api-Key": cfg.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) throw new Error(`discover/${path} \u2192 ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}
async function discoverPages(cfg, path, params) {
  const pages = await mapLimitStrict(
    Array.from({ length: PAGES }, (_, i) => i + 1),
    3,
    (page) => discover(cfg, path, params, page)
  );
  return pages.flat();
}
async function discoverUpcomingMovies(cfg) {
  return cached(
    "seer:src:mov-up",
    SRC_TTL_MS,
    () => discoverPages(cfg, "movies/upcoming", {}),
    { staleMs: SRC_STALE_MS }
  );
}
async function discoverRecentMovies(cfg, from, to) {
  return cached(
    `seer:src:mov-recent:${from}:${to}`,
    SRC_TTL_MS,
    () => discoverPages(cfg, "movies", {
      sortBy: "primary_release_date.desc",
      primaryReleaseDateGte: from,
      primaryReleaseDateLte: to
    }),
    { staleMs: SRC_STALE_MS }
  );
}
async function discoverTvFirsts(cfg, from) {
  return cached(
    `seer:src:tv-first:${from}`,
    SRC_TTL_MS,
    () => discoverPages(cfg, "tv", {
      sortBy: "first_air_date.asc",
      firstAirDateGte: from
    }),
    { staleMs: SRC_STALE_MS }
  );
}
async function discoverTvReturning(cfg) {
  return cached(
    "seer:src:tv-ret",
    SRC_TTL_MS,
    () => discoverPages(cfg, "tv", {
      sortBy: "popularity.desc",
      status: TMDB_STATUS_RETURNING
    }),
    { staleMs: SRC_STALE_MS }
  );
}
async function discoverTvReturningByProviders(cfg, ids, region) {
  if (ids.length === 0) return [];
  const key = [...ids].sort((a, b) => a - b).join("-");
  return cached(
    `seer:src:tv-prov:${key}:${region}`,
    SRC_TTL_MS,
    () => discoverPages(cfg, "tv", {
      watchProviders: ids.join("|"),
      watchRegion: region,
      sortBy: "first_air_date.desc",
      status: TMDB_STATUS_RETURNING
    }),
    { staleMs: SRC_STALE_MS }
  );
}
async function discoverTvTopProviders(cfg, region) {
  const ids = await topRegionProviderIds(cfg, region);
  const chunks = [];
  for (let i = 0; i < ids.length; i += UNION_CHUNK) chunks.push(ids.slice(i, i + UNION_CHUNK));
  const buckets = await mapLimitStrict(chunks, 2, (c) => discoverTvReturningByProviders(cfg, c, region));
  return buckets.flat();
}
function discoverRowsToItems(rows, type, from, to) {
  const out = [];
  for (const r of rows) {
    if (!r.id) continue;
    if (r.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED2) continue;
    const date = toDayString(r.releaseDate ?? r.firstAirDate);
    if (!date || date < from || date > to) continue;
    const mediaType = r.mediaType === "tv" || r.mediaType === "movie" ? r.mediaType : type;
    const kind = mediaType === "movie" ? "theatrical" : "premiere";
    out.push({
      id: makeItemId(mediaType, r.id, kind, date),
      date,
      mediaType,
      tmdbId: r.id,
      title: r.title ?? r.name ?? "",
      posterPath: r.posterPath ?? null,
      backdropPath: r.backdropPath ?? null,
      overview: r.overview ?? null,
      kind,
      seasonNumber: null,
      episodeNumber: null,
      networks: null,
      voteAverage: typeof r.voteAverage === "number" ? r.voteAverage : null,
      popularity: typeof r.popularity === "number" ? r.popularity : null,
      originalLanguage: r.originalLanguage ?? null,
      isAnime: detectAnime(r),
      // Complété par l'enrichissement final du build : recopier la plateforme
      // demandée jurerait qu'un film est sur toutes les plateformes cochées.
      providerIds: [],
      requestId: null,
      requestStatus: null
    });
  }
  return out;
}
async function topRegionProviderIds(cfg, region) {
  return cached(
    `seer:src:top-prov:${region}`,
    24 * 36e5,
    async () => {
      const catalog = [];
      let pannes = 0;
      for (const path of ["tv", "movies"]) {
        try {
          const res = await fetch(
            `${cfg.seerrUrl}/api/v1/watchproviders/${path}?watchRegion=${region}`,
            { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
          );
          if (!res.ok) throw new Error(`watchproviders/${path} \u2192 ${res.status}`);
          const data = await res.json();
          for (const p of Array.isArray(data) ? data : []) {
            if (typeof p.id === "number" && !catalog.includes(p.id)) catalog.push(p.id);
          }
        } catch {
          pannes++;
        }
      }
      if (pannes === 2) throw new Error("watchproviders : aucun catalogue ne r\xE9pond");
      const out = [];
      for (const id of PRIORITY_PROVIDER_IDS) {
        if (catalog.includes(id) && !out.includes(id)) out.push(id);
      }
      for (const id of catalog) {
        if (out.length >= UNION_PROVIDERS_MAX) break;
        if (!out.includes(id)) out.push(id);
      }
      return out.slice(0, UNION_PROVIDERS_MAX);
    }
  );
}

// server/calendar-store-build.ts
var REQUESTS_FETCH_BUDGET = 60;
var MAX_STORE_ITEMS = 4e3;
async function buildCalendarStore(prisma, cfg, region, from, to, warn) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  let degraded = false;
  const fail = (name) => (err) => {
    degraded = true;
    warn?.(err, `[seer] source \xAB ${name} \xBB en \xE9chec \u2014 calendrier ma\xEEtre incomplet`);
  };
  const [movUp, movRecent, tvFirsts, tvReturning, tvProviders, sonarrEps, rows] = await Promise.all([
    sourceOrFallback(discoverUpcomingMovies(cfg), [], fail("films \xE0 venir")),
    sourceOrFallback(discoverRecentMovies(cfg, from, today), [], fail("films r\xE9cents")),
    sourceOrFallback(discoverTvFirsts(cfg, from), [], fail("d\xE9buts de s\xE9ries")),
    sourceOrFallback(discoverTvReturning(cfg), [], fail("s\xE9ries en cours")),
    sourceOrFallback(discoverTvTopProviders(cfg, region), [], fail("plateformes")),
    sourceOrFallback(sonarrWindowEpisodes(cfg, from, to), [], fail("calendrier Sonarr")),
    // Ne lève jamais : repli local interne + drapeau seerrUnreachable.
    cached("seer:rows:everyone", 6e4, () => buildEveryoneRows(prisma, cfg, warn), {
      staleMs: 6e5
    })
  ]);
  if (rows.seerrUnreachable === true) degraded = true;
  const requests = await buildPersonalCalendar(prisma, cfg, rows, {
    from,
    to,
    includeSettled: true,
    maxFetch: REQUESTS_FETCH_BUDGET,
    region
  });
  const requestItems = requests.items.map((it) => ({
    ...it,
    requestId: null,
    requestStatus: null
  }));
  const { items: sonarrItems, missing: sonarrMissing } = await sonarrEpisodesToItems(prisma, sonarrEps, from, to);
  if (sonarrMissing.length > 0) scheduleTmdbBackfill(prisma, cfg, sonarrMissing, region);
  const seriesRows = dedupeRows([...tvReturning, ...tvProviders]);
  const episodes = await buildProviderEpisodes(prisma, cfg, seriesRows, { region, from, to });
  const discoverItems = [
    ...discoverRowsToItems(movUp, "movie", from, to),
    ...discoverRowsToItems(movRecent, "movie", from, to),
    ...discoverRowsToItems(tvFirsts, "tv", from, to)
  ];
  const merged = dedupeStoreItems([
    ...requestItems,
    ...sonarrItems,
    ...episodes.items,
    ...discoverItems
  ]);
  await enrichFromMeta(prisma, cfg, merged, region);
  let items = sortCalendarItems(merged);
  if (items.length > MAX_STORE_ITEMS) {
    warn?.(null, `[seer] store ${region} tronqu\xE9 : ${items.length} \u2192 ${MAX_STORE_ITEMS} entr\xE9es`);
    items = items.slice(0, MAX_STORE_ITEMS);
  }
  const res = await attachAirTimes(cfg, { from, to, items, partial: false });
  return {
    region,
    from,
    to,
    items: res.items,
    partial: requests.partial || episodes.partial || sonarrMissing.length > 0 || degraded,
    builtAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function sourceOrFallback(p, fallback, onFail) {
  try {
    return await p;
  } catch (err) {
    onFail(err);
    return fallback;
  }
}
function dedupeRows(rows) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const r of rows) {
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}
function dedupeStoreItems(items) {
  const byKey = /* @__PURE__ */ new Map();
  const identifiedDays = /* @__PURE__ */ new Set();
  const anonymous = [];
  for (const it of items) {
    if (it.kind === "episode" && (it.seasonNumber == null || it.episodeNumber == null)) {
      anonymous.push(it);
      continue;
    }
    const key = it.kind === "episode" ? `${it.mediaType}:${it.tmdbId}:S${it.seasonNumber}E${it.episodeNumber}` : `${it.mediaType}:${it.tmdbId}:${it.kind}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, it);
    else if (!prev.airDateUtc && it.airDateUtc) byKey.set(key, it);
  }
  for (const it of byKey.values()) {
    if (it.kind === "episode") identifiedDays.add(`${it.tmdbId}:${it.date}`);
  }
  for (const it of anonymous) {
    const key = `${it.mediaType}:${it.tmdbId}:episode:${it.date}`;
    if (identifiedDays.has(`${it.tmdbId}:${it.date}`) || byKey.has(key)) continue;
    byKey.set(key, it);
  }
  return Array.from(byKey.values());
}
async function sonarrEpisodesToItems(prisma, eps, from, to) {
  if (eps.length === 0) return { items: [], missing: [] };
  const refs = Array.from(new Set(eps.map((e) => e.tmdbId))).map((tmdbId) => ({ mediaType: "tv", tmdbId }));
  const { meta, missing } = await resolveTmdbMeta(prisma, null, refs, { maxFetch: 0 });
  const items = [];
  for (const e of eps) {
    const m = meta.get(tmdbKey({ mediaType: "tv", tmdbId: e.tmdbId }));
    if (!m || !m.title) continue;
    const date = e.airDate ?? e.airDateUtc.slice(0, 10);
    if (date < from || date > to) continue;
    items.push({
      id: makeItemId("tv", e.tmdbId, "episode", date),
      date,
      mediaType: "tv",
      tmdbId: e.tmdbId,
      title: m.title,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      overview: m.overview,
      kind: "episode",
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      airDateUtc: e.airDateUtc,
      networks: m.networks,
      providerIds: m.providerIds ?? [],
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: detectAnimeLoose(m),
      requestId: null,
      requestStatus: null
    });
  }
  return { items, missing };
}
async function enrichFromMeta(prisma, cfg, items, region) {
  const refs = items.map((i) => ({ mediaType: i.mediaType, tmdbId: i.tmdbId }));
  const { meta } = await resolveTmdbMeta(prisma, cfg, refs, { maxFetch: 0, region });
  for (const it of items) {
    const m = meta.get(tmdbKey({ mediaType: it.mediaType, tmdbId: it.tmdbId }));
    if (!m) continue;
    if (it.providerIds.length === 0 && m.providerIds?.length) it.providerIds = m.providerIds;
    if (it.voteAverage == null && m.voteAverage != null) it.voteAverage = m.voteAverage;
    if (it.popularity == null && m.popularity != null) it.popularity = m.popularity;
    if (!it.originalLanguage && m.originalLanguage) it.originalLanguage = m.originalLanguage;
    if (it.isAnime !== true && detectAnimeLoose(m)) it.isAnime = true;
  }
}

// server/calendar-store.ts
var STORE_TTL_MS = 6 * 36e5;
var STORE_STALE_MS = 24 * 36e5;
var STORE_PARTIAL_TTL_MS = 6e4;
var PAST_GRID_MARGIN_DAYS = 7;
var FUTURE_DAYS = 180;
var seenRegions = /* @__PURE__ */ new Set([DEFAULT_REGION]);
function calendarStoreHorizon(today) {
  const [y, m] = today.split("-").map(Number);
  const prevFirst = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  return { from: addDays(prevFirst, -PAST_GRID_MARGIN_DAYS), to: addDays(today, FUTURE_DAYS) };
}
async function getCalendarStore(prisma, cfg, region, warn) {
  const reg = /^[A-Z]{2}$/.test(region) ? region : DEFAULT_REGION;
  seenRegions.add(reg);
  const { from, to } = calendarStoreHorizon(todayString());
  return cached(
    `seer:store:${reg}:${from}`,
    STORE_TTL_MS,
    () => buildCalendarStore(prisma, cfg, reg, from, to, warn),
    {
      staleMs: STORE_STALE_MS,
      ttlFor: (s) => s.partial ? STORE_PARTIAL_TTL_MS : STORE_TTL_MS
    }
  );
}
function initCalendarStoreMaintenance(prisma, getCfg, warn) {
  let stopped = false;
  const warm = async () => {
    if (stopped) return;
    const cfg = await getCfg();
    if (!cfg) return;
    for (const region of seenRegions) {
      if (stopped) return;
      await getCalendarStore(prisma, cfg, region, warn).catch((err) => {
        warn?.(err, `[seer] \xE9chec du pr\xE9chauffage du calendrier (${region})`);
      });
    }
  };
  const boot2 = setTimeout(() => {
    void warm();
  }, 15e3);
  const tick = setInterval(() => {
    void warm();
  }, 30 * 6e4);
  boot2.unref?.();
  tick.unref?.();
  return () => {
    stopped = true;
    clearTimeout(boot2);
    clearInterval(tick);
  };
}

// server/calendar-requested.ts
async function requestedIds(prisma) {
  return cached(
    "seer:requested:index",
    6e4,
    async () => {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT media_type, tmdb_id FROM seer_requests WHERE tmdb_id > 0`
      );
      return new Set(rows.map((r) => `${r.media_type}:${Number(r.tmdb_id)}`));
    },
    { staleMs: 6e5 }
  );
}
async function markRequested(prisma, items) {
  if (items.length === 0) return;
  try {
    const demandes = await requestedIds(prisma);
    if (demandes.size === 0) return;
    for (const item of items) {
      if (demandes.has(`${item.mediaType}:${item.tmdbId}`)) {
        item.requestStatus = item.requestStatus ?? "processing";
      }
    }
  } catch {
  }
}

// server/calendar-service.ts
var GLOBAL_MAX_PER_SERIES = 2;
function sliceStore(store2, from, to) {
  const out = [];
  for (const it of store2.items) {
    if (it.date < from || it.date > to) continue;
    out.push({ ...it });
  }
  return out;
}
async function buildGlobalFromStore(prisma, cfg, opts, warn) {
  const store2 = await getCalendarStore(prisma, cfg, opts.region, warn);
  const from = opts.from < store2.from ? store2.from : opts.from;
  const to = opts.to > store2.to ? store2.to : opts.to;
  let items = from <= to ? sliceStore(store2, from, to) : [];
  if (opts.mediaType !== "both") {
    items = items.filter((i) => i.mediaType === opts.mediaType);
  }
  if (opts.providerIds.length > 0) {
    items = items.filter((i) => i.providerIds.some((id) => opts.providerIds.includes(id)));
  }
  items = capPerSeriesFuture(sortCalendarItems(items), GLOBAL_MAX_PER_SERIES, todayString());
  await markRequested(prisma, items);
  return { from: opts.from, to: opts.to, items, partial: store2.partial };
}

// server/calendar-personal-store.ts
var PERSONAL_MAX_PER_SERIES = 3;
async function buildPersonalFromStore(prisma, cfg, rows, opts, warn) {
  const region = opts.region ?? DEFAULT_REGION;
  const store2 = await getCalendarStore(prisma, cfg, region, warn);
  if (opts.from < store2.from || opts.to > store2.to) {
    const res = await buildPersonalCalendar(prisma, cfg, rows, opts);
    return attachAirTimes(cfg, res);
  }
  const { refs, statusByKey } = collectRequestRefs(rows, opts.includeSettled ?? false);
  const slice = sliceStore(store2, opts.from, opts.to).filter(
    (it) => refs.has(`${it.mediaType}:${it.tmdbId}`)
  );
  for (const it of slice) {
    const ctx = statusByKey.get(`${it.mediaType}:${it.tmdbId}`);
    if (ctx) {
      it.requestId = ctx.requestId;
      it.requestStatus = ctx.status;
    }
  }
  const covered2 = new Set(slice.map((it) => `${it.mediaType}:${it.tmdbId}`));
  const residual = new Set([...refs.keys()].filter((k) => !covered2.has(k)));
  let residualItems = [];
  let residualPartial = false;
  if (residual.size > 0) {
    const res = await buildPersonalCalendar(prisma, cfg, rowsSubset(rows, residual), opts);
    const timed = await attachAirTimes(cfg, res);
    residualItems = timed.items;
    residualPartial = timed.partial;
  }
  const items = capPerSeriesFuture(
    sortCalendarItems([...slice, ...residualItems]),
    PERSONAL_MAX_PER_SERIES,
    todayString()
  );
  return {
    from: opts.from,
    to: opts.to,
    items,
    partial: store2.partial || residualPartial
  };
}
function rowsSubset(rows, keep) {
  return {
    ...rows,
    seerrRows: rows.seerrRows.filter(
      (sr) => sr.media?.tmdbId && keep.has(`${sr.media.mediaType}:${sr.media.tmdbId}`)
    ),
    localOnly: rows.localOnly.filter(
      (l) => l.tmdbId && keep.has(`${l.mediaType}:${l.tmdbId}`)
    )
  };
}

// server/search/status-map.ts
var MEDIA_STATUS = {
  UNKNOWN: 1,
  PENDING: 2,
  PROCESSING: 3,
  PARTIALLY_AVAILABLE: 4,
  AVAILABLE: 5,
  BLOCKLISTED: 6,
  DELETED: 7
};
var PAGE_SIZE2 = 100;
var INCREMENTAL_EVERY_MS = 6e4;
var FULL_EVERY_MS = 6 * 36e5;
var FULL_CONCURRENCY = 3;
var statuses = /* @__PURE__ */ new Map();
var lastFull = 0;
var lastIncremental = 0;
var newestSeen = "";
var running = null;
var retryAfter = 0;
var RETRY_MS = 6e4;
function statusOf(mediaType, tmdbId) {
  return statuses.get(`${mediaType}:${tmdbId}`);
}
function noteStatus(mediaType, tmdbId, status) {
  if (typeof status === "number" && status > 0) statuses.set(`${mediaType}:${tmdbId}`, status);
}
function statusMapReady() {
  return lastFull > 0;
}
async function fetchPage(cfg, skip, take = PAGE_SIZE2) {
  const res = await fetch(
    `${cfg.seerrUrl}/api/v1/media?take=${take}&skip=${skip}&filter=all&sort=modified`,
    { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
  );
  if (!res.ok) throw new Error(`GET /media ${res.status}`);
  return await res.json();
}
function absorb(rows, into) {
  for (const row of rows ?? []) {
    if (typeof row.tmdbId !== "number" || row.mediaType !== "movie" && row.mediaType !== "tv") continue;
    if (typeof row.status === "number") into.set(`${row.mediaType}:${row.tmdbId}`, row.status);
    if (row.updatedAt && row.updatedAt > newestSeen) newestSeen = row.updatedAt;
  }
}
async function fullReload(cfg) {
  const first = await fetchPage(cfg, 0);
  const fresh = /* @__PURE__ */ new Map();
  absorb(first.results, fresh);
  const total = first.pageInfo?.results ?? 0;
  const skips = [];
  for (let skip = PAGE_SIZE2; skip < total; skip += PAGE_SIZE2) skips.push(skip);
  const pages = await mapLimit(skips, FULL_CONCURRENCY, (skip) => fetchPage(cfg, skip));
  for (const page of pages) absorb(page?.results, fresh);
  statuses.clear();
  for (const [k, v] of fresh) statuses.set(k, v);
  lastFull = Date.now();
  lastIncremental = lastFull;
}
async function incremental(cfg) {
  const since = newestSeen;
  const page = await fetchPage(cfg, 0, 50);
  absorb(page.results, statuses);
  lastIncremental = Date.now();
  const rows = page.results ?? [];
  if (rows.length === 50 && rows.every((r) => (r.updatedAt ?? "") > since)) lastFull = 0;
}
function refreshStatusMap(cfg) {
  if (running) return;
  const now = Date.now();
  if (now < retryAfter) return;
  const needFull = now - lastFull > FULL_EVERY_MS;
  if (!needFull && now - lastIncremental < INCREMENTAL_EVERY_MS) return;
  running = (needFull ? fullReload(cfg) : incremental(cfg)).catch((err) => {
    console.warn(`[Vigie] Statuts des m\xE9dias indisponibles : ${err instanceof Error ? err.message : err}`);
    retryAfter = Date.now() + RETRY_MS;
  }).finally(() => {
    running = null;
  });
}

// server/item-states.ts
var NO_FACTS = { byEpisode: /* @__PURE__ */ new Map(), byDay: /* @__PURE__ */ new Map() };
var NO_QUEUE = { episodes: /* @__PURE__ */ new Map(), movies: /* @__PURE__ */ new Map() };
function merge(prev, next) {
  if (!prev) return { stalled: next.stalled, percent: next.percent, validating: next.validating };
  return { stalled: prev.stalled && next.stalled, percent: prev.percent ?? next.percent, validating: prev.validating && next.validating };
}
function indexQueue(entries) {
  const index = { episodes: /* @__PURE__ */ new Map(), movies: /* @__PURE__ */ new Map() };
  for (const e of entries) {
    if (e.tmdbId == null) continue;
    if (e.source === "radarr") {
      index.movies.set(e.tmdbId, merge(index.movies.get(e.tmdbId), e));
    } else if (e.seasonNumber != null && e.episodeNumber != null) {
      const key = episodeKey(e.tmdbId, e.seasonNumber, e.episodeNumber);
      index.episodes.set(key, merge(index.episodes.get(key), e));
    }
  }
  return index;
}
var WAITING = /* @__PURE__ */ new Set([
  "queued",
  "processing",
  "sent_to_seer",
  "approved",
  "unavailable",
  "retry_pending",
  "downloading",
  "partially_available"
]);
function fromQueue(q) {
  if (!q) return null;
  return q.stalled ? "stalled" : q.validating ? "importing" : "downloading";
}
function fromRequest(status, seriesLevel = false) {
  if (!status || !WAITING.has(status)) return null;
  return seriesLevel && status === "partially_available" ? "partial" : "requested";
}
function episodeState(fact, queued, fallback) {
  if (fact?.hasFile) return "available";
  const inQueue = fromQueue(queued);
  if (inQueue) return inQueue;
  if (fact) return fact.monitored ? "requested" : null;
  return fallback;
}
function movieState(mediaStatus, queued, fallback) {
  if (mediaStatus === 5) return "available";
  const inQueue = fromQueue(queued);
  if (inQueue) return inQueue;
  if (mediaStatus === 2 || mediaStatus === 3) return "requested";
  return fallback;
}
function stateOfItem(item, facts, queue, today) {
  const request = fromRequest(item.requestStatus);
  if (item.mediaType === "movie") {
    const queued2 = queue.movies.get(item.tmdbId);
    const state3 = movieState(statusOf("movie", item.tmdbId), queued2, request);
    return { state: state3, percent: state3 === "downloading" ? queued2?.percent ?? null : null };
  }
  const media = statusOf("tv", item.tmdbId);
  const fallback = media === 5 ? item.date <= today ? "available" : null : media === 2 || media === 3 ? "requested" : request;
  if (item.kind !== "episode" || item.seasonNumber == null || item.episodeNumber == null) {
    const series = media === 4 ? "partial" : fallback === "requested" ? fromRequest(item.requestStatus, true) ?? fallback : fallback;
    return { state: series, percent: null };
  }
  const key = episodeKey(item.tmdbId, item.seasonNumber, item.episodeNumber);
  let fact = facts.byEpisode.get(key);
  if (!fact) {
    const sameDay = facts.byDay.get(`${item.tmdbId}:${item.date}`);
    if (sameDay?.length === 1) fact = sameDay[0];
  }
  const queued = queue.episodes.get(key);
  const state2 = episodeState(fact, queued, fallback);
  return { state: state2, percent: state2 === "downloading" ? queued?.percent ?? null : null };
}
async function attachItemStates(cfg, res, today) {
  if (res.items.length === 0) return res;
  const hasEpisodes = res.items.some((i) => i.kind === "episode");
  const [facts, queue] = await Promise.all([
    hasEpisodes ? sonarrWindowFacts(cfg, addDays(res.from, -1), addDays(res.to, 1)).catch(() => NO_FACTS) : Promise.resolve(NO_FACTS),
    queueSnapshot(cfg).then((s) => indexQueue(s.items)).catch(() => NO_QUEUE)
  ]);
  return {
    ...res,
    items: res.items.map((item) => ({ ...item, ...stateOfItem(item, facts, queue, today) }))
  };
}
async function seriesEpisodeStates(cfg, tmdbId) {
  const [facts, queue] = await Promise.all([
    sonarrSeriesFacts(cfg, tmdbId),
    queueSnapshot(cfg).then((s) => indexQueue(s.items)).catch(() => NO_QUEUE)
  ]);
  const states = {};
  const percents = {};
  const byDay = /* @__PURE__ */ new Map();
  const seasons = /* @__PURE__ */ new Set();
  for (const [key, fact] of facts) {
    const queued = queue.episodes.get(`${tmdbId}:${key}`);
    const state2 = episodeState(fact, queued, null);
    if (state2) states[key] = state2;
    if (state2 === "downloading" && queued?.percent != null) percents[key] = Math.round(queued.percent);
    if (fact.airDate) byDay.set(fact.airDate, [...byDay.get(fact.airDate) ?? [], key]);
    const season = Number(/^S(\d+)E/.exec(key)?.[1]);
    if (season > 0) seasons.add(season);
  }
  const dates = {};
  for (const [day, keys2] of byDay) if (keys2.length === 1) dates[day] = keys2[0];
  return { tracked: facts.size > 0, states, percents, dates, seasons: [...seasons].sort((a, b) => a - b) };
}

// server/routes-calendar.ts
var PERSONAL_TTL_MS = 15 * 6e4;
var PERSONAL_STALE_MS = 6 * 36e5;
var PARTIAL_TTL_MS = 1e4;
var EVERYONE_FETCH_BUDGET = 60;
var MAX_PROVIDERS = 8;
var DEFAULT_WINDOW_DAYS = 90;
var MAX_WINDOW_DAYS = 370;
function readWindow(q) {
  const today = todayString();
  const from = isDayString(q.from) ? q.from : today;
  const fallback = addDays(from, DEFAULT_WINDOW_DAYS);
  const to = isDayString(q.to) ? q.to : fallback;
  const hardMax = addDays(from, MAX_WINDOW_DAYS);
  return { from, to: to > hardMax ? hardMax : to < from ? from : to };
}
function readRegion(q) {
  return typeof q.region === "string" && /^[a-z]{2}$/i.test(q.region) ? q.region.toUpperCase() : DEFAULT_REGION;
}
var EMPTY = (from, to) => ({ from, to, items: [], partial: false });
function registerCalendarRoutes(app, prisma, getWorkerConfig2) {
  const warn = (err, msg) => app.log?.warn?.({ err }, msg);
  const stopMaintenance = initCalendarStoreMaintenance(prisma, getWorkerConfig2, warn);
  app.addHook("onClose", async () => stopMaintenance());
  app.get("/calendar/personal", async (request) => {
    const user = getUser(request);
    const q = request.query;
    const { from, to } = readWindow(q);
    const includeSettled = q.all === "1";
    const everyone = q.everyone === "1";
    const region = readRegion(q);
    const config = await getWorkerConfig2();
    if (!config) return EMPTY(from, to);
    const key = everyone ? `seer:cal:everyone:${region}:${from}:${to}:${includeSettled ? "all" : "up"}` : `seer-cache:${user.userId}:cal:${region}:${from}:${to}:${includeSettled ? "all" : "up"}`;
    const res = await cached(
      key,
      PERSONAL_TTL_MS,
      async () => {
        const rows = everyone ? await cached(
          "seer:rows:everyone",
          6e4,
          () => buildEveryoneRows(prisma, config, warn),
          { staleMs: 6e5 }
        ) : await cached(
          rowsCacheKey(user.userId),
          6e4,
          () => buildMergedRows(prisma, config, user, warn),
          { staleMs: 6e5 }
        );
        return buildPersonalFromStore(prisma, config, rows, {
          from,
          to,
          includeSettled,
          region,
          maxFetch: everyone ? EVERYONE_FETCH_BUDGET : void 0
        }, warn);
      },
      {
        staleMs: PERSONAL_STALE_MS,
        ttlFor: (value) => value.partial ? PARTIAL_TTL_MS : PERSONAL_TTL_MS
      }
    );
    return attachItemStates(config, res, todayString());
  });
  app.get("/calendar/global", async (request) => {
    const q = request.query;
    const { from, to } = readWindow(q);
    const config = await getWorkerConfig2();
    if (!config) return EMPTY(from, to);
    const providerIds = String(q.providerIds ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, MAX_PROVIDERS);
    const mediaType = q.mediaType === "movie" || q.mediaType === "tv" ? q.mediaType : "both";
    const res = await buildGlobalFromStore(prisma, config, {
      providerIds,
      mediaType,
      region: readRegion(q),
      from,
      to
    }, warn);
    return attachItemStates(config, res, todayString());
  });
  app.get("/calendar/airtimes", async (request) => {
    const q = request.query;
    const tmdbId = Number(q.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) return { times: {} };
    const config = await getWorkerConfig2();
    if (!config) return { times: {} };
    try {
      const times = await sonarrSeriesAirTimes(config, tmdbId);
      return { times: Object.fromEntries(times) };
    } catch {
      return { times: {} };
    }
  });
  app.get("/episodes/states", async (request) => {
    const tmdbId = Number(request.query.tmdbId);
    const empty = { tracked: false, states: {}, percents: {}, dates: {}, seasons: [] };
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) return empty;
    const config = await getWorkerConfig2();
    if (!config) return empty;
    try {
      return await seriesEpisodeStates(config, tmdbId);
    } catch {
      return empty;
    }
  });
  app.get("/calendar/providers", async (request) => {
    const q = request.query;
    const config = await getWorkerConfig2();
    if (!config) return { results: [] };
    const region = readRegion(q);
    try {
      return await cached(`seer:providers:all:${region}`, 24 * 36e5, async () => {
        const merged = /* @__PURE__ */ new Map();
        let pannes = 0;
        for (const path of ["tv", "movies"]) {
          try {
            const res = await fetch(
              `${config.seerrUrl}/api/v1/watchproviders/${path}?watchRegion=${region}`,
              { headers: { "X-Api-Key": config.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
            );
            if (!res.ok) throw new Error(`watchproviders/${path} \u2192 ${res.status}`);
            const data = await res.json();
            for (const p of Array.isArray(data) ? data : []) {
              if (typeof p.id !== "number" || !p.name || merged.has(p.id)) continue;
              merged.set(p.id, { id: p.id, name: p.name, logoPath: p.logoPath ?? null });
            }
          } catch {
            pannes++;
          }
        }
        if (pannes === 2) throw new Error("watchproviders : aucun catalogue ne r\xE9pond");
        return { results: Array.from(merged.values()) };
      });
    } catch {
      return { results: [] };
    }
  });
}

// server/routes-misc.ts
function registerMiscRoutes(app, prisma, getWorkerConfig2, requireAdmin) {
  const providerCache = /* @__PURE__ */ new Map();
  app.post("/check-providers", async (request, reply) => {
    const body = request.body;
    if (!body.items || !Array.isArray(body.items)) return reply.status(400).send({ message: "items array required" });
    const config = await getWorkerConfig2();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrUrl = config.seerrUrl;
    const apiKey = config.seerrApiKey;
    const result = {};
    const toFetch = [];
    for (const item of body.items.slice(0, 200)) {
      const key = `${item.mediaType}-${item.tmdbId}`;
      const cached2 = providerCache.get(key);
      if (cached2 && Date.now() < cached2.expires) {
        result[item.tmdbId] = cached2.providers;
      } else {
        toFetch.push(item);
      }
    }
    const BATCH2 = 5;
    for (let i = 0; i < toFetch.length; i += BATCH2) {
      const batch = toFetch.slice(i, i + BATCH2);
      const responses = await Promise.allSettled(
        batch.map(async (item) => {
          const res = await fetch(`${seerrUrl}/api/v1/${item.mediaType}/${item.tmdbId}`, {
            headers: { "X-Api-Key": apiKey },
            signal: AbortSignal.timeout(8e3)
          });
          if (!res.ok) return { tmdbId: item.tmdbId, mediaType: item.mediaType, providers: [] };
          const data = await res.json();
          const region = data.watchProviders?.find((w) => w.iso_3166_1 === "FR") ?? data.watchProviders?.find((w) => w.iso_3166_1 === "US");
          const ids = region?.flatrate?.map((p) => p.id ?? p.providerId ?? 0).filter(Boolean) ?? [];
          return { tmdbId: item.tmdbId, mediaType: item.mediaType, providers: ids };
        })
      );
      for (const r of responses) {
        if (r.status === "fulfilled" && r.value) {
          const { tmdbId, mediaType, providers } = r.value;
          result[tmdbId] = providers;
          providerCache.set(`${mediaType}-${tmdbId}`, { providers, expires: Date.now() + 7 * 864e5 });
        }
      }
    }
    return result;
  });
  app.get("/queue/status", async (request) => {
    const user = request.user;
    const status = await getQueueStatus(prisma, user.isAdmin ? void 0 : user.userId);
    return { ...status, workerRunning: isWorkerRunning() };
  });
  app.get("/stats", async (request) => {
    const user = request.user;
    if (user.isAdmin) {
      const [personal, global] = await Promise.all([getUserStats(prisma, user.userId), getGlobalStats(prisma)]);
      return { personal, global };
    }
    return { personal: await getUserStats(prisma, user.userId) };
  });
  app.post("/worker/trigger", { preHandler: requireAdmin }, async () => {
    const config = await getWorkerConfig2();
    if (!config) return { message: "Seerr not configured" };
    const next = await getQueueStatus(prisma);
    return { workerRunning: isWorkerRunning(), processing: next.processing, queued: next.queued, triggered: true };
  });
}

// server/routes-proxy.ts
import { Readable } from "stream";

// server/blocklist.ts
var MEDIA_STATUS_BLOCKLISTED3 = 6;
var KEYWORD_FETCH_CONCURRENCY = 8;
async function getBlocklistedTags(seerrUrl, apiKey) {
  return cached(`seerr:blocklistedTags:${seerrUrl}`, 5 * 6e4, async () => {
    try {
      const res = await fetch(`${seerrUrl}/api/v1/settings/main`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8e3)
      });
      if (!res.ok) return "";
      const data = await res.json();
      return (data.blocklistedTags ?? "").trim();
    } catch {
      return "";
    }
  });
}
function parseTagSet(csv) {
  const set = /* @__PURE__ */ new Set();
  for (const part of csv.split(",")) {
    const id = Number(part.trim());
    if (Number.isFinite(id) && id > 0) set.add(id);
  }
  return set;
}
async function getItemKeywordIds(seerrUrl, apiKey, mediaType, id) {
  return cached(`seerr:kw:${mediaType}:${id}`, 7 * 864e5, async () => {
    try {
      const res = await fetch(`${seerrUrl}/api/v1/${mediaType}/${id}`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8e3)
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.keywords) ? data.keywords.map((k) => k?.id).filter((x) => typeof x === "number") : [];
    } catch {
      return [];
    }
  });
}
async function filterResultsByTags(seerrUrl, apiKey, results, blockedSet) {
  const afterStatus = results.filter((r) => r?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED3);
  let blockedCount = results.length - afterStatus.length;
  const blockedFlags = new Array(afterStatus.length).fill(false);
  const checkable = afterStatus.map((item, idx) => ({ item, idx })).filter(({ item }) => (item.mediaType === "movie" || item.mediaType === "tv") && typeof item.id === "number");
  await mapLimit(checkable, KEYWORD_FETCH_CONCURRENCY, async ({ item, idx }) => {
    const kwIds = await getItemKeywordIds(
      seerrUrl,
      apiKey,
      item.mediaType,
      item.id
    );
    if (kwIds.some((id) => blockedSet.has(id))) blockedFlags[idx] = true;
  });
  const kept = afterStatus.filter((_, idx) => !blockedFlags[idx]);
  blockedCount += afterStatus.length - kept.length;
  return { kept, blockedCount };
}

// server/routes-proxy.ts
var PROXY_TTL_MS = 5 * 6e4;
function registerProxyRoutes(app, getConfig) {
  app.post("/proxy", async (request, reply) => {
    const body = request.body;
    if (!body.url) return reply.status(400).send({ message: "url is required" });
    const config = getConfig();
    const seerrUrl = config.url?.replace(/\/$/, "");
    if (!seerrUrl) return reply.status(503).send({ message: "Seerr not configured" });
    let parsed;
    try {
      parsed = new URL(body.url);
    } catch {
      return reply.status(400).send({ message: "Invalid URL" });
    }
    if (parsed.origin !== new URL(seerrUrl).origin) {
      return reply.status(403).send({ message: "Proxy restricted to configured Seerr instance" });
    }
    try {
      const res = await fetch(body.url, {
        method: body.method || "GET",
        headers: body.headers,
        body: body.body ? JSON.stringify(body.body) : void 0,
        signal: AbortSignal.timeout(1e4)
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return { status: res.status, ok: res.ok, data: json ?? text };
    } catch (err) {
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy failed" });
    }
  });
  app.all("/seerr/*", async (request, reply) => {
    const wildcard = request.params["*"];
    if (!wildcard || !wildcard.startsWith("api/v1/")) {
      return reply.status(400).send({ message: "Only api/v1/* paths are allowed" });
    }
    const config = getConfig();
    const seerrUrl = config.url?.replace(/\/$/, "");
    const apiKey = config.apiKey;
    if (!seerrUrl || !apiKey) return reply.status(503).send({ message: "Seerr not configured" });
    const query = request.query;
    const isDiscoverMovies = /^api\/v1\/discover\/movies(\/|$)/.test(wildcard);
    const isDiscoverTv = /^api\/v1\/discover\/tv(\/|$)/.test(wildcard);
    const isDiscover = isDiscoverMovies || isDiscoverTv;
    const isSearchLike = /^api\/v1\/discover\/trending/.test(wildcard) || /^api\/v1\/search/.test(wildcard);
    const isFilterable = isDiscover || isSearchLike;
    const showBlocked = query._showBlocked === "1" || query._showBlocked === "true";
    const blocklistedTags = isFilterable && request.method === "GET" ? await getBlocklistedTags(seerrUrl, apiKey) : "";
    const blockedSet = parseTagSet(blocklistedTags);
    const blockedActive = blockedSet.size > 0;
    const qsParts = [];
    let hasExcludeKeywords = false;
    for (const [k, v] of Object.entries(query)) {
      if (k === "_lang" || k === "_showBlocked") continue;
      if (k === "excludeKeywords") hasExcludeKeywords = true;
      qsParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    if (isDiscover && blockedActive && !showBlocked && !hasExcludeKeywords) {
      qsParts.push(`excludeKeywords=${encodeURIComponent(blocklistedTags)}`);
    }
    const qs = qsParts.join("&");
    const targetUrl = `${seerrUrl}/${wildcard}${qs ? `?${qs}` : ""}`;
    const headers = { "X-Api-Key": apiKey };
    if (query._lang) headers["Accept-Language"] = query._lang;
    let reqBody;
    if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
      headers["Content-Type"] = "application/json";
      reqBody = JSON.stringify(request.body);
    }
    const cacheable = request.method === "GET" && isFilterable;
    const cacheKey = cacheable ? `seer:proxy:${targetUrl}:${headers["Accept-Language"] ?? ""}` : null;
    if (cacheKey) {
      const hit = peek(cacheKey);
      if (hit) {
        reply.header("content-type", "application/json");
        return reply.send(hit);
      }
    }
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: reqBody,
        signal: AbortSignal.timeout(15e3)
      });
      const ct = response.headers.get("content-type");
      const shouldHandleJson = isFilterable && blockedActive && response.ok && (ct ?? "").includes("application/json");
      if (shouldHandleJson) {
        const data = await response.json().catch(() => null);
        if (data && Array.isArray(data.results)) {
          if (showBlocked) {
            const { blockedCount } = await filterResultsByTags(
              seerrUrl,
              apiKey,
              isDiscover ? [] : data.results,
              // discover déjà non-filtré ici → compteur via search-like
              blockedSet
            );
            data.blockedCount = isDiscover ? 0 : blockedCount;
          } else if (isSearchLike) {
            const { kept, blockedCount } = await filterResultsByTags(
              seerrUrl,
              apiKey,
              data.results,
              blockedSet
            );
            data.results = kept;
            data.blockedCount = blockedCount;
          } else {
            const before = data.results.length;
            data.results = data.results.filter(
              (item) => item?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED3
            );
            data.blockedCount = before - data.results.length;
          }
          data.blockedActive = blockedActive;
        }
        if (cacheKey && response.ok && data) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ?? {});
      }
      if (cacheKey && response.ok && (ct ?? "").includes("application/json")) {
        const data = await response.json().catch(() => null);
        if (data) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ?? {});
      }
      reply.status(response.status);
      if (ct) reply.header("content-type", ct);
      if (!response.body) return reply.send();
      return reply.send(Readable.fromWeb(response.body));
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return reply.status(504).send({ message: "Seerr timeout" });
      }
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy failed" });
    }
  });
}

// server/search/fold.ts
var LIGATURES = {
  "\u0153": "oe",
  "\xE6": "ae",
  "\xDF": "ss",
  "\xF8": "o",
  "\u0142": "l",
  "\u0111": "d"
};
function foldText(input) {
  return input.toLowerCase().replace(/[œæßøłđ]/g, (c) => LIGATURES[c] ?? c).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function tokenize(input) {
  const folded = foldText(input);
  return folded === "" ? [] : folded.split(" ");
}
var STOPWORDS = /* @__PURE__ */ new Set([
  "le",
  "la",
  "les",
  "l",
  "un",
  "une",
  "des",
  "du",
  "de",
  "d",
  "au",
  "aux",
  "et",
  "the",
  "a",
  "an",
  "of",
  "and",
  "in",
  "on"
]);
function significantTokens(tokens) {
  const kept = tokens.filter((t) => !STOPWORDS.has(t));
  return kept.length > 0 ? kept : [...tokens];
}
var ELIDED = /* @__PURE__ */ new Set(["d", "l", "j", "m", "n", "s", "t", "c", "qu"]);
function nameForms(folded) {
  const space = folded.indexOf(" ");
  if (space < 0 || !ELIDED.has(folded.slice(0, space))) return [folded];
  return [folded, folded.slice(0, space) + folded.slice(space + 1)];
}
function onlyThroughElision(names, tokens) {
  return names.some((name) => {
    const words = name.split(" ");
    for (let i = 1; i < words.length - 1; i++) {
      if (ELIDED.has(words[i]) && tokens.includes(words[i] + words[i + 1])) return true;
    }
    return false;
  });
}
function editDistance(a, b, max) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (la === 0 || lb === 0) return Math.max(la, lb) > max ? max + 1 : Math.max(la, lb);
  let before = new Array(lb + 1).fill(0);
  let previous = Array.from({ length: lb + 1 }, (_, j) => j);
  let current = new Array(lb + 1).fill(0);
  for (let i = 1; i <= la; i++) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    [before, previous, current] = [previous, current, before];
  }
  return previous[lb] > max ? max + 1 : previous[lb];
}

// server/search/query.ts
var MOVIE_HINTS = /* @__PURE__ */ new Set(["film", "films", "movie", "movies"]);
var TV_HINTS = /* @__PURE__ */ new Set(["serie", "series", "show", "shows", "tv", "feuilleton"]);
var ANIME_HINTS = /* @__PURE__ */ new Set(["anime", "animes", "manga", "mangas"]);
var SEASON_WORDS = /* @__PURE__ */ new Set(["saison", "season", "staffel", "temporada"]);
var SEASON_CODE = /^s\d{1,2}(e\d{1,3})?$/;
function yearOf(word, maxYear) {
  const m = /^\(?((?:19|20)\d\d)\)?$/.exec(word);
  if (!m) return null;
  const year = Number(m[1]);
  return year <= maxYear ? year : null;
}
function parseQuery(input, now = /* @__PURE__ */ new Date()) {
  const raw = input.replace(/\s+/g, " ").trim();
  const words = raw === "" ? [] : raw.split(" ");
  const maxYear = now.getFullYear() + 3;
  let year = null;
  let type = null;
  let anime = false;
  const inParens = words.findIndex((w) => /^\(\d{4}\)$/.test(w) && yearOf(w, maxYear) !== null);
  if (inParens >= 0 && words.length > 1) {
    year = yearOf(words[inParens], maxYear);
    words.splice(inParens, 1);
  }
  for (let changed = true; changed && words.length > 1; ) {
    changed = false;
    const first = foldText(words[0]);
    const last = foldText(words[words.length - 1]);
    const beforeLast = words.length > 2 ? foldText(words[words.length - 2]) : "";
    if (type === null && (MOVIE_HINTS.has(last) || TV_HINTS.has(last))) {
      type = MOVIE_HINTS.has(last) ? "movie" : "tv";
      words.pop();
    } else if (type === null && (MOVIE_HINTS.has(first) || TV_HINTS.has(first))) {
      type = MOVIE_HINTS.has(first) ? "movie" : "tv";
      words.shift();
    } else if (!anime && (ANIME_HINTS.has(last) || ANIME_HINTS.has(first))) {
      anime = true;
      if (ANIME_HINTS.has(last)) words.pop();
      else words.shift();
    } else if (year === null && yearOf(words[words.length - 1], maxYear) !== null) {
      year = yearOf(words.pop(), maxYear);
    } else if (SEASON_CODE.test(last)) {
      type = type ?? "tv";
      words.pop();
    } else if (words.length > 2 && SEASON_WORDS.has(beforeLast) && /^\d{1,2}$/.test(last)) {
      type = type ?? "tv";
      words.splice(words.length - 2, 2);
    } else {
      break;
    }
    changed = true;
  }
  const text = words.join(" ");
  return { raw, text, tokens: tokenize(text), year, type, anime };
}

// server/search/title-index.ts
var MAX_ENTRIES = 6e4;
var MAX_PREFIX_TOKENS = 300;
var MIN_PREFIX = 2;
var DOMINANCE = 6;
function entryWeight(e) {
  return Math.log10(1 + e.voteCount) * 3 + Math.log10(1 + e.popularity);
}
function isAnimeOf(genreIds, originalLanguage) {
  return genreIds.includes(16) && (originalLanguage === "ja" || originalLanguage === "ko" || originalLanguage === "zh");
}
var TitleIndex = class {
  list = [];
  byKey = /* @__PURE__ */ new Map();
  postings = /* @__PURE__ */ new Map();
  vocabWeight = /* @__PURE__ */ new Map();
  sorted = [];
  byInitial = /* @__PURE__ */ new Map();
  dirty = false;
  size() {
    return this.list.length;
  }
  get(key) {
    const i = this.byKey.get(key);
    return i === void 0 ? void 0 : this.list[i];
  }
  /** Ajoute ou complète un titre. Les noms déjà connus restent : un titre ne s'oublie pas. */
  upsert(r) {
    if (!r.title && !r.originalTitle) return;
    const key = `${r.mediaType}:${r.tmdbId}`;
    let index = this.byKey.get(key);
    let entry;
    if (index === void 0) {
      if (this.list.length >= MAX_ENTRIES) return;
      entry = {
        key,
        mediaType: r.mediaType,
        tmdbId: r.tmdbId,
        titles: /* @__PURE__ */ new Map(),
        originalTitle: null,
        releaseDate: null,
        year: null,
        popularity: 0,
        voteCount: 0,
        voteAverage: 0,
        posterPath: null,
        backdropPath: null,
        originalLanguage: null,
        genreIds: [],
        isAnime: false,
        names: [],
        tokens: /* @__PURE__ */ new Set()
      };
      index = this.list.length;
      this.list.push(entry);
      this.byKey.set(key, index);
    } else {
      entry = this.list[index];
    }
    if (r.title) entry.titles.set(r.lang, r.title);
    entry.originalTitle = r.originalTitle ?? entry.originalTitle;
    entry.releaseDate = r.releaseDate ?? entry.releaseDate;
    entry.year = entry.releaseDate ? Number(entry.releaseDate.slice(0, 4)) || null : entry.year;
    entry.popularity = r.popularity || entry.popularity;
    entry.voteCount = r.voteCount || entry.voteCount;
    entry.voteAverage = r.voteAverage || entry.voteAverage;
    entry.posterPath = r.posterPath ?? entry.posterPath;
    entry.backdropPath = r.backdropPath ?? entry.backdropPath;
    entry.originalLanguage = r.originalLanguage ?? entry.originalLanguage;
    if (r.genreIds.length > 0) entry.genreIds = r.genreIds;
    entry.isAnime = isAnimeOf(entry.genreIds, entry.originalLanguage);
    const weight = entryWeight(entry);
    const forms = [r.title, r.originalTitle].flatMap((name) => name ? nameForms(foldText(name)) : []);
    for (const folded of forms) {
      if (folded === "" || entry.names.includes(folded)) continue;
      entry.names.push(folded);
      for (const token of folded.split(" ")) {
        if ((this.vocabWeight.get(token) ?? -1) < weight) this.vocabWeight.set(token, weight);
        if (entry.tokens.has(token)) continue;
        entry.tokens.add(token);
        const list = this.postings.get(token);
        if (list === void 0) {
          this.postings.set(token, [index]);
          this.dirty = true;
        } else {
          list.push(index);
        }
      }
    }
  }
  rebuild() {
    if (!this.dirty) return;
    this.sorted = [...this.postings.keys()].sort();
    this.byInitial = /* @__PURE__ */ new Map();
    for (const token of this.sorted) {
      const initial = token[0];
      const bucket = this.byInitial.get(initial);
      if (bucket) bucket.push(token);
      else this.byInitial.set(initial, [token]);
    }
    this.dirty = false;
  }
  /** Les mots du vocabulaire qui commencent par `prefix`, les plus porteurs d'abord. */
  complete(prefix) {
    this.rebuild();
    if (prefix.length < MIN_PREFIX) return this.postings.has(prefix) ? [prefix] : [];
    let lo = 0;
    let hi = this.sorted.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (this.sorted[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    const out = [];
    for (let i = lo; i < this.sorted.length && this.sorted[i].startsWith(prefix); i++) out.push(this.sorted[i]);
    if (out.length <= MAX_PREFIX_TOKENS) return out;
    return out.sort((a, b) => (this.vocabWeight.get(b) ?? 0) - (this.vocabWeight.get(a) ?? 0)).slice(0, MAX_PREFIX_TOKENS);
  }
  /**
   * Le mot connu le plus proche d'un mot inconnu — mêmes garde-fous que le
   * moteur de la bibliothèque, calibrés sur du bruit réel : cinq lettres au
   * moins, première lettre juste, une faute jusqu'à sept lettres, deux au-delà.
   * Un mot collé (« spiderman ») se décolle s'il se coupe en deux mots connus.
   */
  correctToken(token) {
    this.rebuild();
    if (this.postings.has(token) || token.length < 5 || /\d/.test(token)) return null;
    const max = token.length >= 8 ? 2 : 1;
    let best = null;
    let bestDistance = max + 1;
    let bestWeight = -1;
    for (const candidate of this.byInitial.get(token[0]) ?? []) {
      if (Math.abs(candidate.length - token.length) > max) continue;
      const d = editDistance(token, candidate, max);
      const w = this.vocabWeight.get(candidate) ?? 0;
      if (d < bestDistance || d === bestDistance && d <= max && w > bestWeight) {
        best = candidate;
        bestDistance = d;
        bestWeight = w;
      }
    }
    if (best !== null && bestDistance <= max) return best;
    for (let cut = 3; cut <= token.length - 3; cut++) {
      const left = token.slice(0, cut);
      const right = token.slice(cut);
      if (this.postings.has(left) && this.postings.has(right)) return `${left} ${right}`;
    }
    return null;
  }
  /**
   * Un mot CONNU, mais seulement par des titres obscurs, à une lettre d'un mot
   * cent fois plus porteur : c'est presque toujours une faute. « interstelar »
   * est le titre d'un film de 2014 à deux votes — celui qui le tape cherche
   * « Interstellar ». Sans ce garde-fou, il suffisait qu'une recherche fasse
   * entrer ce titre obscur dans l'index pour que la faute cesse d'être corrigée.
   * Le titre tapé reste trouvable : la recherche complète interroge aussi la
   * requête telle quelle, et « Rechercher quand même » la rétablit.
   */
  dominantNeighbor(token) {
    this.rebuild();
    if (token.length < 5 || /\d/.test(token)) return null;
    let best = null;
    let bestWeight = (this.vocabWeight.get(token) ?? 0) + DOMINANCE;
    for (const candidate of this.byInitial.get(token[0]) ?? []) {
      if (candidate === token || Math.abs(candidate.length - token.length) > 1) continue;
      const weight = this.vocabWeight.get(candidate) ?? 0;
      if (weight < bestWeight || editDistance(token, candidate, 1) > 1) continue;
      best = candidate;
      bestWeight = weight;
    }
    return best;
  }
  postingsOf(token, isLast) {
    const out = new Set(this.postings.get(token) ?? []);
    if (isLast) {
      for (const word of this.complete(token)) {
        for (const i of this.postings.get(word) ?? []) out.add(i);
      }
    }
    return out;
  }
  /**
   * Les titres dont les noms contiennent les mots de la requête — le dernier
   * pouvant être un début de mot. `allowFix` à faux : pas de correction.
   */
  lookup(tokens, limit = 200, allowFix = true) {
    const words = significantTokens(tokens);
    if (words.length === 0) return { hits: [], corrected: null, replacements: [] };
    const direct = this.match(words, limit);
    if (!allowFix) return { hits: direct, corrected: null, replacements: [] };
    const whole = direct.length > 0 && direct[0].matched === words.length;
    const replacements = [];
    const fixed = words.flatMap((word, i) => {
      let fix = null;
      if (this.postings.has(word)) fix = this.dominantNeighbor(word);
      else if (!whole && !(i === words.length - 1 && this.complete(word).length > 0)) fix = this.correctToken(word);
      if (fix === null) return [word];
      replacements.push([word, fix]);
      return fix.split(" ");
    });
    if (replacements.length === 0) return { hits: direct, corrected: null, replacements: [] };
    const corrected = this.match(fixed, limit);
    if (corrected.length === 0 || corrected[0].matched < (direct[0]?.matched ?? 0)) {
      return { hits: direct, corrected: null, replacements: [] };
    }
    return { hits: corrected, corrected: fixed, replacements };
  }
  match(words, limit) {
    const sets = words.map((w, i) => this.postingsOf(w, i === words.length - 1));
    const counts = /* @__PURE__ */ new Map();
    for (const set of sets) for (const i of set) counts.set(i, (counts.get(i) ?? 0) + 1);
    const hits = [];
    const need = words.length === 1 ? 1 : Math.max(1, words.length - 1);
    for (const [i, matched] of counts) if (matched >= need) hits.push({ entry: this.list[i], matched });
    hits.sort((a, b) => b.matched - a.matched || entryWeight(b.entry) - entryWeight(a.entry));
    return hits.slice(0, limit);
  }
  /** Tout l'index — pour la persistance. */
  entries() {
    return this.list;
  }
  /** Repartir de zéro (la liste de blocage a changé). */
  clear() {
    this.list = [];
    this.byKey = /* @__PURE__ */ new Map();
    this.postings = /* @__PURE__ */ new Map();
    this.vocabWeight = /* @__PURE__ */ new Map();
    this.sorted = [];
    this.byInitial = /* @__PURE__ */ new Map();
    this.dirty = false;
  }
};

// server/search/remote.ts
var TTL_MS = 10 * 6e4;
var STALE_MS = 60 * 6e4;
var str = (v) => typeof v === "string" && v !== "" ? v : null;
var num = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
function toRemoteMedia(r, rank = 0) {
  const mediaType = r.mediaType === "movie" || r.mediaType === "tv" ? r.mediaType : null;
  const id = num(r.id);
  if (!mediaType || id <= 0) return null;
  const info = r.mediaInfo;
  return {
    mediaType,
    id,
    title: str(r.title) ?? str(r.name) ?? "",
    originalTitle: str(r.originalTitle) ?? str(r.originalName),
    releaseDate: str(r.releaseDate) ?? str(r.firstAirDate),
    posterPath: str(r.posterPath),
    backdropPath: str(r.backdropPath),
    overview: str(r.overview),
    voteAverage: num(r.voteAverage),
    voteCount: num(r.voteCount),
    popularity: num(r.popularity),
    genreIds: Array.isArray(r.genreIds) ? r.genreIds.filter((g) => typeof g === "number") : [],
    originalLanguage: str(r.originalLanguage),
    status: typeof info?.status === "number" ? info.status : void 0,
    rank
  };
}
function toRemotePerson(r, rank) {
  const id = num(r.id);
  const name = str(r.name);
  if (id <= 0 || !name) return null;
  const knownFor = Array.isArray(r.knownFor) ? r.knownFor.map((m) => toRemoteMedia(m)).filter((m) => m !== null) : [];
  return {
    id,
    name,
    profilePath: str(r.profilePath),
    popularity: num(r.popularity),
    department: str(r.knownForDepartment),
    knownFor,
    rank
  };
}
async function fetchSearchPage(cfg, text, page, lang) {
  const url = `${cfg.seerrUrl}/api/v1/search?query=${encodeURIComponent(text)}&page=${page}&language=${encodeURIComponent(lang)}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang },
    signal: AbortSignal.timeout(8e3)
  });
  if (!res.ok) throw new Error(`Jellyseerr /search ${res.status}`);
  return await res.json();
}
async function remoteSearch(cfg, text, page, lang, showBlocked, knownSafe = () => false) {
  const key = `vigie:remote:${lang}:${showBlocked ? 1 : 0}:${page}:${foldText(text)}`;
  const result = await cached(key, TTL_MS, async () => {
    const raw = await fetchSearchPage(cfg, text, page, lang);
    const results = (Array.isArray(raw.results) ? raw.results : []).map((r, rank) => ({ r, rank }));
    const tags = await getBlocklistedTags(cfg.seerrUrl, cfg.seerrApiKey);
    const blocked = parseTagSet(tags);
    let kept = results;
    let blockedCount = 0;
    if (blocked.size > 0 && !showBlocked) {
      const isSafe = ({ r }) => (r.mediaType === "movie" || r.mediaType === "tv") && typeof r.id === "number" && knownSafe(r.mediaType, r.id) && r.mediaInfo?.status !== 6;
      const unknown = results.filter((x) => !isSafe(x));
      const filtered = await filterResultsByTags(cfg.seerrUrl, cfg.seerrApiKey, unknown.map((x) => x.r), blocked);
      const survivors = new Set(filtered.kept);
      kept = results.filter((x) => isSafe(x) || survivors.has(x.r));
      blockedCount = filtered.blockedCount;
    }
    const media = [];
    const people = [];
    for (const { r, rank } of kept) {
      if (r.mediaType === "person") {
        const person = toRemotePerson(r, rank);
        if (person) people.push(person);
      } else {
        const m = toRemoteMedia(r, rank);
        if (m) media.push(m);
      }
    }
    for (const m of media) noteStatus(m.mediaType, m.id, m.status);
    return { media, people, totalPages: num(raw.totalPages), blockedCount, blockedActive: blocked.size > 0 };
  }, { staleMs: STALE_MS });
  return result;
}

// server/search/title-store.ts
var FLUSH_EVERY_MS = 3e4;
var FLUSH_AT = 400;
var BATCH = 200;
var pending = [];
var flushTimer = null;
async function ensureSearchTables(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_search_titles (
      media_type        VARCHAR(5)    NOT NULL,
      tmdb_id           INT           NOT NULL,
      lang              VARCHAR(8)    NOT NULL,
      title             VARCHAR(500)  NOT NULL DEFAULT '',
      original_title    VARCHAR(500)  DEFAULT NULL,
      release_date      CHAR(10)      DEFAULT NULL,
      popularity        DECIMAL(10,3) DEFAULT NULL,
      vote_count        INT           DEFAULT NULL,
      vote_average      DECIMAL(3,1)  DEFAULT NULL,
      poster_path       VARCHAR(255)  DEFAULT NULL,
      backdrop_path     VARCHAR(255)  DEFAULT NULL,
      original_language VARCHAR(10)   DEFAULT NULL,
      genre_ids         VARCHAR(120)  DEFAULT NULL,
      updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (media_type, tmdb_id, lang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seer_search_meta (
      meta_key   VARCHAR(64)  NOT NULL PRIMARY KEY,
      meta_value VARCHAR(500) NOT NULL DEFAULT '',
      updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
function num2(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function rowToRecord(row) {
  return {
    mediaType: row.media_type === "tv" ? "tv" : "movie",
    tmdbId: num2(row.tmdb_id),
    lang: String(row.lang ?? "en"),
    title: String(row.title ?? ""),
    originalTitle: row.original_title ?? null,
    releaseDate: row.release_date ?? null,
    popularity: num2(row.popularity),
    voteCount: num2(row.vote_count),
    voteAverage: num2(row.vote_average),
    posterPath: row.poster_path ?? null,
    backdropPath: row.backdrop_path ?? null,
    originalLanguage: row.original_language ?? null,
    genreIds: String(row.genre_ids ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0)
  };
}
async function loadTitles(prisma, index) {
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM seer_search_titles`);
  for (const row of rows) index.upsert(rowToRecord(row));
  return rows.length;
}
async function writeBatch(prisma, records) {
  for (const part of chunk(records, BATCH)) {
    const placeholders = part.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
    const values = part.flatMap((r) => [
      r.mediaType,
      r.tmdbId,
      r.lang.slice(0, 8),
      r.title.slice(0, 500),
      r.originalTitle?.slice(0, 500) ?? null,
      r.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate) ? r.releaseDate : null,
      Math.min(r.popularity, 9999999),
      r.voteCount,
      Math.min(r.voteAverage, 10),
      r.posterPath,
      r.backdropPath,
      r.originalLanguage?.slice(0, 10) ?? null,
      r.genreIds.join(",").slice(0, 120) || null
    ]);
    await prisma.$executeRawUnsafe(
      `INSERT INTO seer_search_titles
         (media_type, tmdb_id, lang, title, original_title, release_date, popularity, vote_count,
          vote_average, poster_path, backdrop_path, original_language, genre_ids)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE title = VALUES(title), original_title = VALUES(original_title),
         release_date = VALUES(release_date), popularity = VALUES(popularity), vote_count = VALUES(vote_count),
         vote_average = VALUES(vote_average), poster_path = VALUES(poster_path), backdrop_path = VALUES(backdrop_path),
         original_language = VALUES(original_language), genre_ids = VALUES(genre_ids)`,
      ...values
    );
  }
}
async function flushTitles(prisma) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pending.length === 0) return;
  const batch = pending;
  pending = [];
  try {
    await writeBatch(prisma, batch);
  } catch (err) {
    console.warn(`[Vigie] Index de recherche non enregistr\xE9 : ${err instanceof Error ? err.message : err}`);
  }
}
function queueTitles(prisma, records) {
  pending.push(...records);
  if (pending.length >= FLUSH_AT) {
    void flushTitles(prisma);
    return;
  }
  if (!flushTimer) flushTimer = setTimeout(() => {
    void flushTitles(prisma);
  }, FLUSH_EVERY_MS);
}
async function readMeta(prisma, key) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT meta_value FROM seer_search_meta WHERE meta_key = ?`,
    key
  );
  return rows[0]?.meta_value ?? null;
}
async function writeMeta(prisma, key, value) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_search_meta (meta_key, meta_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
    key,
    value.slice(0, 500)
  );
}
async function clearTitles(prisma) {
  pending = [];
  await prisma.$executeRawUnsafe(`DELETE FROM seer_search_titles`);
}

// server/search/title-crawl.ts
var ANIME_KEYWORD = "210024";
function sources(today) {
  return [
    { endpoint: "movies", query: "sortBy=popularity.desc", pages: 60, light: 10 },
    { endpoint: "movies", query: "sortBy=vote_count.desc", pages: 100 },
    { endpoint: "tv", query: "sortBy=popularity.desc", pages: 40, light: 10 },
    { endpoint: "tv", query: "sortBy=vote_count.desc", pages: 60 },
    { endpoint: "tv", query: `keywords=${ANIME_KEYWORD}&sortBy=vote_count.desc`, pages: 20, light: 3 },
    { endpoint: "movies", query: `keywords=${ANIME_KEYWORD}&sortBy=vote_count.desc`, pages: 8 },
    { endpoint: "movies", query: `primaryReleaseDateGte=${today}&sortBy=popularity.desc`, pages: 10, light: 10 },
    { endpoint: "tv", query: `firstAirDateGte=${today}&sortBy=popularity.desc`, pages: 5, light: 5 }
  ];
}
var CRAWL_LANGS = ["fr", "en"];
var FULL_EVERY_MS2 = 3 * 864e5;
var LIGHT_EVERY_MS = 864e5;
var CHECK_EVERY_MS = 36e5;
var CONCURRENCY2 = 2;
var MIN_BUILT = 1e3;
var state = "idle";
var crawling = false;
var nextCheck = 0;
var fullAt = 0;
var lightAt = 0;
var crawlTags = null;
function todayIso() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toRecord(raw, lang, fallbackType) {
  const media = toRemoteMedia({ ...raw, mediaType: raw.mediaType ?? fallbackType });
  if (!media || !media.title) return null;
  return {
    mediaType: media.mediaType,
    tmdbId: media.id,
    lang,
    title: media.title,
    originalTitle: media.originalTitle,
    releaseDate: media.releaseDate,
    popularity: media.popularity,
    voteCount: media.voteCount,
    voteAverage: media.voteAverage,
    posterPath: media.posterPath,
    backdropPath: media.backdropPath,
    originalLanguage: media.originalLanguage,
    genreIds: media.genreIds
  };
}
async function fetchDiscover(cfg, source, page, lang, tags) {
  const exclude = tags ? `&excludeKeywords=${encodeURIComponent(tags)}` : "";
  const res = await fetch(
    `${cfg.seerrUrl}/api/v1/discover/${source.endpoint}?page=${page}&${source.query}${exclude}`,
    { headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang }, signal: AbortSignal.timeout(1e4) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const type = source.endpoint === "movies" ? "movie" : "tv";
  return (data.results ?? []).map((r) => toRecord(r, lang, type)).filter((r) => r !== null);
}
async function crawl(prisma, cfg, index, mode, tags) {
  const jobs = [];
  for (const lang of CRAWL_LANGS) {
    for (const source of sources(todayIso())) {
      const pages = mode === "full" ? source.pages : source.light ?? 0;
      for (let page = 1; page <= pages; page++) jobs.push({ source, page, lang });
    }
  }
  const started = Date.now();
  let learned = 0;
  await mapLimit(jobs, CONCURRENCY2, async ({ source, page, lang }) => {
    const records = await fetchDiscover(cfg, source, page, lang, tags);
    for (const r of records) index.upsert(r);
    queueTitles(prisma, records);
    learned += records.length;
  });
  await flushTitles(prisma);
  const now = Date.now();
  if (mode === "full") {
    fullAt = now;
    await writeMeta(prisma, "crawl_full_at", String(now));
  }
  lightAt = now;
  await writeMeta(prisma, "crawl_light_at", String(now));
  await writeMeta(prisma, "crawl_tags", tags);
  crawlTags = tags;
  console.log(`[Vigie] Index de recherche : ${learned} fiches lues (${mode}) en ${Math.round((now - started) / 1e3)} s \u2014 ${index.size()} titres`);
}
function launch(prisma, cfg, index, mode, tags) {
  if (crawling) return;
  crawling = true;
  void crawl(prisma, cfg, index, mode, tags).catch((err) => console.warn(`[Vigie] Construction de l'index interrompue : ${err instanceof Error ? err.message : err}`)).finally(() => {
    crawling = false;
  });
}
async function boot(prisma, cfg, index) {
  const [count, full, light, tags] = await Promise.all([
    loadTitles(prisma, index),
    readMeta(prisma, "crawl_full_at"),
    readMeta(prisma, "crawl_light_at"),
    readMeta(prisma, "crawl_tags")
  ]);
  fullAt = Number(full) || 0;
  lightAt = Number(light) || 0;
  crawlTags = tags;
  if (count < MIN_BUILT) fullAt = 0;
}
async function check(prisma, cfg, index) {
  const tags = await getBlocklistedTags(cfg.seerrUrl, cfg.seerrApiKey);
  if (crawlTags !== null && tags !== crawlTags) {
    index.clear();
    await clearTitles(prisma);
    fullAt = 0;
  }
  const now = Date.now();
  if (now - fullAt > FULL_EVERY_MS2) launch(prisma, cfg, index, "full", tags);
  else if (now - lightAt > LIGHT_EVERY_MS) launch(prisma, cfg, index, "light", tags);
}
function ensureTitleIndex(prisma, cfg, index) {
  if (state === "booting") return;
  if (state === "idle") {
    state = "booting";
    void boot(prisma, cfg, index).catch((err) => console.warn(`[Vigie] Index de recherche illisible : ${err instanceof Error ? err.message : err}`)).finally(() => {
      state = "ready";
      nextCheck = 0;
      ensureTitleIndex(prisma, cfg, index);
    });
    return;
  }
  const now = Date.now();
  if (crawling || now < nextCheck) return;
  nextCheck = now + CHECK_EVERY_MS;
  void check(prisma, cfg, index).catch(() => {
    nextCheck = now + 6e4;
  });
}
function titleIndexBuilding() {
  return state !== "ready" || crawling;
}

// server/search/rank.ts
var TEXT_ALL_WORDS = 650;
var TEXT_KEY_WORDS = 560;
var FIX_PENALTY = 80;
var TEXT_EXACT_TITLE = 1e3 - FIX_PENALTY;
function covered(words, wanted, lastIsPrefix) {
  let found = 0;
  for (let i = 0; i < wanted.length; i++) {
    const w = wanted[i];
    const prefix = lastIsPrefix && i === wanted.length - 1;
    if (words.some((x) => x === w || prefix && x.startsWith(w))) found++;
  }
  return found;
}
function textScore(names, tokens) {
  if (tokens.length === 0) return 0;
  const phrase = tokens.join(" ");
  const key = significantTokens(tokens);
  const lastIsKey = key[key.length - 1] === tokens[tokens.length - 1];
  let best = 0;
  for (const name of names) {
    if (name === phrase) return 1e3;
    if (name.startsWith(phrase)) {
      best = Math.max(best, 880 - Math.min(80, name.length - phrase.length));
      continue;
    }
    const words = name.split(" ");
    const density = (n, span) => Math.round(span * n / Math.max(words.length, 1));
    if (covered(words, tokens, true) === tokens.length) {
      best = Math.max(best, TEXT_ALL_WORDS + density(tokens.length, 150));
      continue;
    }
    const found = covered(words, key, lastIsKey);
    if (found === key.length) best = Math.max(best, TEXT_KEY_WORDS + density(key.length, 80));
    else if (found > 0) best = Math.max(best, Math.round(399 * found / key.length));
  }
  return best;
}
function popularityScore(voteCount, popularity) {
  return Math.round(70 * Math.log10(1 + voteCount) + 25 * Math.log10(1 + popularity));
}
function remoteRankScore(rank) {
  return rank === null || rank === void 0 ? 0 : Math.max(0, 80 - 4 * rank);
}
function scoreMediaWithText(item, text, query) {
  let score2 = text === 0 && item.remoteRank !== null && item.remoteRank !== void 0 ? 150 : text;
  score2 += popularityScore(item.voteCount, item.popularity) + remoteRankScore(item.remoteRank);
  if (query.year !== null && item.year !== null) {
    const gap = Math.abs(query.year - item.year);
    score2 += gap === 0 ? 500 : gap === 1 ? 150 : -250;
  }
  if (query.type !== null) score2 += query.type === item.mediaType ? 300 : -400;
  if (query.anime && item.isAnime) score2 += 300;
  if (item.voteCount < 5 && text < 1e3) score2 -= 100;
  return score2;
}
function scorePerson(name, popularity, tokens, remoteRank) {
  const text = textScore([name], tokens);
  const normalized = text >= TEXT_KEY_WORDS ? 800 : text;
  return normalized + Math.round(150 * Math.log10(1 + popularity * 10)) + remoteRankScore(remoteRank) * 2;
}

// server/search/service.ts
var titleIndex = new TitleIndex();
var FULL_TTL_MS = 6e4;
var PARTIAL_TTL_MS2 = 5e3;
var LOCAL_LIMIT = 80;
function fromEntry(e, lang) {
  const title = e.titles.get(lang) ?? e.titles.get("en") ?? e.originalTitle ?? [...e.titles.values()][0] ?? "";
  return {
    key: e.key,
    mediaType: e.mediaType,
    tmdbId: e.tmdbId,
    title,
    originalTitle: e.originalTitle,
    names: e.names,
    releaseDate: e.releaseDate,
    year: e.year,
    posterPath: e.posterPath,
    backdropPath: e.backdropPath,
    overview: null,
    voteAverage: e.voteAverage,
    voteCount: e.voteCount,
    popularity: e.popularity,
    genreIds: e.genreIds,
    originalLanguage: e.originalLanguage,
    isAnime: e.isAnime,
    remoteStatus: void 0,
    remoteRank: null,
    text: 0,
    score: 0
  };
}
function fromRemote(m) {
  const names = [m.title, m.originalTitle].filter((n) => !!n).map(foldText).filter((n) => n !== "").flatMap(nameForms);
  const year = m.releaseDate ? Number(m.releaseDate.slice(0, 4)) || null : null;
  const isAnime = m.genreIds.includes(16) && ["ja", "ko", "zh"].includes(m.originalLanguage ?? "");
  return {
    key: `${m.mediaType}:${m.id}`,
    mediaType: m.mediaType,
    tmdbId: m.id,
    title: m.title,
    originalTitle: m.originalTitle,
    names: [...new Set(names)],
    releaseDate: m.releaseDate,
    year,
    posterPath: m.posterPath,
    backdropPath: m.backdropPath,
    overview: m.overview,
    voteAverage: m.voteAverage,
    voteCount: m.voteCount,
    popularity: m.popularity,
    genreIds: m.genreIds,
    originalLanguage: m.originalLanguage,
    isAnime,
    remoteStatus: m.status,
    remoteRank: m.rank,
    text: 0,
    score: 0
  };
}
function merge2(into, c) {
  const known = into.get(c.key);
  if (!known) {
    into.set(c.key, c);
    return;
  }
  const ranks = [known.remoteRank, c.remoteRank].filter((r) => r !== null);
  into.set(c.key, {
    ...known,
    ...c,
    names: [.../* @__PURE__ */ new Set([...known.names, ...c.names])],
    remoteRank: ranks.length > 0 ? Math.min(...ranks) : null
  });
}
function recordOf(m, lang) {
  return {
    mediaType: m.mediaType,
    tmdbId: m.id,
    lang,
    title: m.title,
    originalTitle: m.originalTitle,
    releaseDate: m.releaseDate,
    popularity: m.popularity,
    voteCount: m.voteCount,
    voteAverage: m.voteAverage,
    posterPath: m.posterPath,
    backdropPath: m.backdropPath,
    originalLanguage: m.originalLanguage,
    genreIds: m.genreIds
  };
}
function rewrite(parsed, replacements) {
  const map = new Map(replacements);
  return parsed.tokens.map((t) => map.get(t) ?? t).join(" ");
}
function score(candidates, parsed, fixed) {
  let fixWon = false;
  const scored = [...candidates].map((c) => {
    const typed = textScore(c.names, parsed.tokens);
    const viaFix = fixed ? textScore(c.names, fixed) - FIX_PENALTY : -1;
    const text = Math.max(typed, viaFix);
    return { c: { ...c, text, score: scoreMediaWithText(c, text, parsed) }, viaFix: viaFix > typed };
  });
  scored.sort((a, b) => b.c.score - a.c.score);
  if (scored.length > 0) fixWon = scored[0].viaFix;
  const anyFull = scored.some((s) => s.c.text >= TEXT_KEY_WORDS);
  const media = scored.map((s) => s.c).filter((c) => !(anyFull && c.text < TEXT_KEY_WORDS && c.remoteRank === null)).filter((c) => !(c.text === 0 && onlyThroughElision(c.names, parsed.tokens)));
  return { media, fixWon };
}
function warmSearch(ctx) {
  ensureTitleIndex(ctx.prisma, ctx.cfg, titleIndex);
  refreshStatusMap(ctx.cfg);
  refreshLocalPending(ctx.prisma);
}
var EMPTY2 = (parsed) => ({
  parsed,
  searched: parsed.text,
  correction: null,
  media: [],
  people: [],
  hasMore: false,
  blockedCount: 0,
  blockedActive: false,
  complete: true
});
function instantSearch(ctx, q, opts) {
  warmSearch(ctx);
  const parsed = parseQuery(q);
  if (parsed.tokens.length === 0) return EMPTY2(parsed);
  const lookup = titleIndex.lookup(parsed.tokens, LOCAL_LIMIT, !opts.exact);
  const fixedText = lookup.replacements.length > 0 ? rewrite(parsed, lookup.replacements) : null;
  const { media, fixWon } = score(lookup.hits.map((h) => fromEntry(h.entry, opts.lang)), parsed, fixedText ? tokenize(fixedText) : null);
  const correction = fixWon ? fixedText : null;
  return { ...EMPTY2(parsed), searched: correction ?? parsed.text, correction, media, complete: false };
}
async function tryRemote(ctx, text, opts) {
  if (text.trim() === "") return null;
  try {
    return await remoteSearch(
      ctx.cfg,
      text,
      opts.page,
      opts.lang,
      opts.showBlocked,
      (mediaType, id) => titleIndex.get(`${mediaType}:${id}`) !== void 0
    );
  } catch {
    return null;
  }
}
async function computeFull(ctx, q, opts) {
  const parsed = parseQuery(q);
  if (parsed.tokens.length === 0) return EMPTY2(parsed);
  const lookup = titleIndex.lookup(parsed.tokens, LOCAL_LIMIT, !opts.exact);
  const fixedText = lookup.replacements.length > 0 ? rewrite(parsed, lookup.replacements) : null;
  const [typed, fixed] = await Promise.all([
    tryRemote(ctx, parsed.text, opts),
    fixedText ? tryRemote(ctx, fixedText, opts) : Promise.resolve(null)
  ]);
  const pages = [typed, fixed].filter((p) => p !== null);
  const all = /* @__PURE__ */ new Map();
  if (opts.page === 1) for (const h of lookup.hits) merge2(all, fromEntry(h.entry, opts.lang));
  for (const page of pages) for (const m of page.media) merge2(all, fromRemote(m));
  if (parsed.year !== null && parsed.text !== parsed.raw && opts.page === 1) {
    const found = [...all.values()].some((c) => c.year === parsed.year && textScore(c.names, parsed.tokens) >= TEXT_KEY_WORDS);
    if (!found) {
      const raw = await tryRemote(ctx, parsed.raw, opts);
      if (raw) {
        pages.push(raw);
        for (const m of raw.media) merge2(all, fromRemote(m));
      }
    }
  }
  if (!opts.showBlocked) {
    const learned = pages.flatMap((p) => p.media).filter((m) => m.title).map((m) => recordOf(m, opts.lang));
    for (const r of learned) titleIndex.upsert(r);
    if (learned.length > 0) queueTitles(ctx.prisma, learned);
  }
  const fixedTokens = fixedText ? tokenize(fixedText) : null;
  const { media, fixWon } = score(all.values(), parsed, fixedTokens);
  const correction = fixWon ? fixedText : null;
  const tokens = correction ? fixedTokens : parsed.tokens;
  const people = /* @__PURE__ */ new Map();
  for (const page of pages) {
    for (const p of page.people) {
      if (people.has(p.id)) continue;
      people.set(p.id, {
        id: p.id,
        name: p.name,
        profilePath: p.profilePath,
        popularity: p.popularity,
        department: p.department,
        knownFor: p.knownFor.map(fromRemote),
        score: scorePerson(foldText(p.name), p.popularity, tokens, p.rank)
      });
    }
  }
  const main = (correction ? fixed : typed) ?? typed ?? fixed;
  return {
    parsed,
    searched: correction ?? parsed.text,
    correction,
    media,
    people: [...people.values()].sort((a, b) => b.score - a.score),
    hasMore: (main?.totalPages ?? 0) > opts.page,
    blockedCount: pages.reduce((n, p) => n + p.blockedCount, 0),
    blockedActive: pages.some((p) => p.blockedActive),
    complete: true
  };
}
function fullKey(q, opts) {
  return `vigie:full:${opts.lang}:${opts.showBlocked ? 1 : 0}:${opts.exact ? 1 : 0}:${opts.page}:${foldText(q)}`;
}
function fullSearch(ctx, q, opts) {
  warmSearch(ctx);
  const ttl = titleIndexBuilding() && titleIndex.size() === 0 ? PARTIAL_TTL_MS2 : FULL_TTL_MS;
  return cached(fullKey(q, opts), ttl, () => computeFull(ctx, q, opts));
}
function fullIfReady(ctx, q, opts) {
  const hit = peek(fullKey(q, opts));
  if (hit) return hit;
  void fullSearch(ctx, q, opts).catch(() => void 0);
  return void 0;
}

// server/search/present.ts
function toSearchItem(c, status) {
  const movie = c.mediaType === "movie";
  const opt = (v) => v === null ? void 0 : v;
  return {
    id: c.tmdbId,
    mediaType: c.mediaType,
    ...movie ? { title: c.title, originalTitle: opt(c.originalTitle), releaseDate: opt(c.releaseDate) } : { name: c.title, originalName: opt(c.originalTitle), firstAirDate: opt(c.releaseDate) },
    posterPath: opt(c.posterPath),
    backdropPath: opt(c.backdropPath),
    overview: opt(c.overview),
    voteAverage: c.voteAverage || void 0,
    voteCount: c.voteCount || void 0,
    popularity: c.popularity || void 0,
    genreIds: c.genreIds,
    originalLanguage: opt(c.originalLanguage),
    ...status !== void 0 ? { mediaInfo: { status } } : {}
  };
}
var LABELS = {
  fr: { movie: "Film", series: "S\xE9rie", requested: "Demand\xE9", processing: "En cours", release: "sortie le" },
  en: { movie: "Movie", series: "Series", requested: "Requested", processing: "In progress", release: "out" }
};
function inLibrary(status) {
  return status === MEDIA_STATUS.PARTIALLY_AVAILABLE || status === MEDIA_STATUS.AVAILABLE;
}
function inLibraryOrBlocked(status) {
  return status === MEDIA_STATUS.PARTIALLY_AVAILABLE || status === MEDIA_STATUS.AVAILABLE || status === MEDIA_STATUS.BLOCKLISTED;
}
function shortDate(iso, lang) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}
function toProviderItem(c, status, lang, today) {
  const l = lang === "fr" ? LABELS.fr : LABELS.en;
  const kind = c.mediaType === "movie" ? "movie" : "series";
  const upcoming = c.releaseDate !== null && c.releaseDate > today;
  const kindLabel = kind === "movie" ? l.movie : l.series;
  const subtitle = upcoming && c.releaseDate ? `${kindLabel} \xB7 ${l.release} ${shortDate(c.releaseDate, lang)}` : c.year !== null ? `${kindLabel} \xB7 ${c.year}` : kindLabel;
  const badge = status === MEDIA_STATUS.PENDING ? { label: l.requested, tone: "info" } : status === MEDIA_STATUS.PROCESSING ? { label: l.processing, tone: "warning" } : null;
  return {
    id: c.key,
    kind,
    title: c.title,
    year: c.year,
    subtitle,
    imageUrl: c.posterPath ? `https://image.tmdb.org/t/p/w185${c.posterPath}` : null,
    href: `/discover?media=${c.mediaType}:${c.tmdbId}`,
    badge
  };
}

// server/search/respond.ts
var TOP_SINGLE_WORD = 800;
var GROUP_LIMIT = 40;
var TMDB_FIRST_CHOICES = 5;
var PEOPLE_LIMIT = 10;
var NOTABLE_VOTES = 30;
var NOTABLE_POPULARITY = 3;
function statusFor(c) {
  const known = statusOf(c.mediaType, c.tmdbId) ?? c.remoteStatus;
  const settled = known !== void 0 && known !== MEDIA_STATUS.UNKNOWN && known !== MEDIA_STATUS.DELETED;
  if (!settled && isLocallyPending(c.key)) return MEDIA_STATUS.PENDING;
  return known;
}
function visible(media) {
  return media.filter((c) => statusFor(c) !== MEDIA_STATUS.BLOCKLISTED);
}
function toPerson(p) {
  return {
    id: p.id,
    mediaType: "person",
    name: p.name,
    profilePath: p.profilePath ?? void 0,
    knownForDepartment: p.department ?? void 0,
    popularity: p.popularity,
    knownFor: [...p.knownFor].sort((a, b) => b.voteCount - a.voteCount).filter((c) => statusFor(c) !== MEDIA_STATUS.BLOCKLISTED).map((c) => toSearchItem(c, statusFor(c)))
  };
}
function facetNamed(facets, query) {
  const q = foldText(query);
  return facets.some((f) => foldText(f.label) === q);
}
function presentHub(ranked, page, facets, indexing, startedAt) {
  const media = visible(ranked.media);
  const tokens = tokenize(ranked.searched);
  const facetQuery = facetNamed(facets, ranked.parsed.raw);
  const bestMedia = media[0];
  const bestPerson = ranked.people[0];
  const personText = bestPerson ? textScore([foldText(bestPerson.name)], tokens) : 0;
  const needed = significantTokens(tokens).length <= 1 ? TOP_SINGLE_WORD : TEXT_ALL_WORDS;
  let top = null;
  if (page !== 1 || facetQuery) {
    top = null;
  } else if (bestPerson && personText >= TEXT_KEY_WORDS && (!bestMedia || bestPerson.score > bestMedia.score)) {
    top = { kind: "person", person: toPerson(bestPerson) };
  } else if (bestMedia && bestMedia.text >= needed) {
    top = { kind: "media", item: toSearchItem(bestMedia, statusFor(bestMedia)) };
  } else if (!media.some((c) => c.text >= TEXT_KEY_WORDS)) {
    const first = media.filter((c) => c.remoteRank !== null && c.remoteRank < TMDB_FIRST_CHOICES).sort((a, b) => b.voteCount - a.voteCount)[0];
    if (first) top = { kind: "media", item: toSearchItem(first, statusFor(first)) };
  }
  const topKey = top?.kind === "media" ? `${top.item.mediaType}:${top.item.id}` : null;
  const rest = media.filter((c) => c.key !== topKey);
  return {
    query: ranked.parsed.raw,
    searched: ranked.searched,
    correction: ranked.correction,
    year: ranked.parsed.year,
    type: ranked.parsed.type,
    complete: ranked.complete,
    top,
    movies: rest.filter((c) => c.mediaType === "movie").slice(0, GROUP_LIMIT).map((c) => toSearchItem(c, statusFor(c))),
    series: rest.filter((c) => c.mediaType === "tv").slice(0, GROUP_LIMIT).map((c) => toSearchItem(c, statusFor(c))),
    people: ranked.people.filter((p) => top?.kind !== "person" || p.id !== top.person.id).slice(0, PEOPLE_LIMIT).map(toPerson),
    facets,
    page,
    hasMore: ranked.hasMore,
    blockedCount: ranked.blockedCount,
    blockedActive: ranked.blockedActive,
    indexing,
    tookMs: Date.now() - startedAt
  };
}
function presentProvider(ranked, type, limit, lang, today) {
  const media = visible(ranked.media);
  const best = media.reduce((m, c) => Math.max(m, c.text), 0);
  const threshold = best >= 1e3 ? TOP_SINGLE_WORD : TEXT_ALL_WORDS;
  const libraryHasIt = media.some((c) => c.text >= TEXT_EXACT_TITLE && inLibrary(statusFor(c)));
  const statusesKnown = statusMapReady();
  const items = media.filter((c) => statusesKnown || c.remoteRank !== null).filter((c) => c.text >= threshold).filter((c) => !libraryHasIt || c.voteCount >= NOTABLE_VOTES || c.popularity >= NOTABLE_POPULARITY).filter((c) => type === null || type === "movie" === (c.mediaType === "movie")).filter((c) => !inLibraryOrBlocked(statusFor(c))).slice(0, limit).map((c) => toProviderItem(c, statusFor(c), lang, today));
  const q = ranked.parsed.raw;
  return {
    query: q,
    correction: ranked.correction,
    complete: ranked.complete && statusesKnown,
    items,
    moreHref: q ? `/discover?q=${encodeURIComponent(q)}` : null
  };
}

// server/search/facets.ts
var GENRES = [
  { id: 28, movie: true, tv: false, fr: "Action", en: "Action" },
  { id: 12, movie: true, tv: false, fr: "Aventure", en: "Adventure" },
  { id: 10759, movie: false, tv: true, fr: "Action & Aventure", en: "Action & Adventure" },
  { id: 16, movie: true, tv: true, fr: "Animation", en: "Animation", also: ["dessin anime", "dessins animes", "cartoon"] },
  { id: 35, movie: true, tv: true, fr: "Com\xE9die", en: "Comedy", also: ["humour"] },
  { id: 80, movie: true, tv: true, fr: "Crime", en: "Crime", also: ["policier", "polar"] },
  { id: 99, movie: true, tv: true, fr: "Documentaire", en: "Documentary", also: ["docu"] },
  { id: 18, movie: true, tv: true, fr: "Drame", en: "Drama" },
  { id: 10751, movie: true, tv: true, fr: "Familial", en: "Family", also: ["famille"] },
  { id: 14, movie: true, tv: false, fr: "Fantastique", en: "Fantasy", also: ["fantasy"] },
  { id: 36, movie: true, tv: false, fr: "Histoire", en: "History", also: ["historique"] },
  { id: 27, movie: true, tv: false, fr: "Horreur", en: "Horror", also: ["epouvante"] },
  { id: 10762, movie: false, tv: true, fr: "Enfants", en: "Kids", also: ["jeunesse"] },
  { id: 10402, movie: true, tv: false, fr: "Musique", en: "Music", also: ["musical"] },
  { id: 9648, movie: true, tv: true, fr: "Myst\xE8re", en: "Mystery", also: ["enquete"] },
  { id: 10749, movie: true, tv: false, fr: "Romance", en: "Romance", also: ["romantique"] },
  { id: 878, movie: true, tv: false, fr: "Science-Fiction", en: "Science Fiction", also: ["sf", "scifi", "sci fi"] },
  { id: 10765, movie: false, tv: true, fr: "Science-Fiction & Fantastique", en: "Sci-Fi & Fantasy" },
  { id: 53, movie: true, tv: false, fr: "Thriller", en: "Thriller", also: ["suspense"] },
  { id: 10752, movie: true, tv: false, fr: "Guerre", en: "War" },
  { id: 10768, movie: false, tv: true, fr: "Guerre & Politique", en: "War & Politics" },
  { id: 37, movie: true, tv: true, fr: "Western", en: "Western" },
  { id: 10764, movie: false, tv: true, fr: "T\xE9l\xE9r\xE9alit\xE9", en: "Reality", also: ["tele realite", "realite"] },
  { id: 10767, movie: false, tv: true, fr: "Talk-show", en: "Talk" }
];
var MIN_PREFIX2 = 3;
var MAX_FACETS = 6;
function matches(name, query) {
  const folded = foldText(name);
  return folded === query || query.length >= MIN_PREFIX2 && folded.startsWith(query);
}
function genreFacets(query, lang) {
  const q = foldText(query);
  if (q.length < 2) return [];
  const out = [];
  for (const g of GENRES) {
    const names = [g.fr, g.en, ...g.also ?? []];
    if (!names.some((n) => matches(n, q))) continue;
    const label = lang === "fr" ? g.fr : g.en;
    if (g.movie) out.push({ kind: "genre", id: g.id, mediaType: "movie", label });
    if (g.tv) out.push({ kind: "genre", id: g.id, mediaType: "tv", label });
  }
  return out.slice(0, MAX_FACETS);
}
function regionOf(lang) {
  const map = { fr: "FR", en: "US", de: "DE", es: "ES", it: "IT", pt: "BR", ja: "JP" };
  return map[lang] ?? "US";
}
var providersKey = (region) => `vigie:providers:${region}`;
async function providerList(cfg, region) {
  return cached(providersKey(region), 864e5, async () => {
    const all = /* @__PURE__ */ new Map();
    for (const kind of ["movies", "tv"]) {
      const res = await fetch(`${cfg.seerrUrl}/api/v1/watchproviders/${kind}?watchRegion=${region}`, {
        headers: { "X-Api-Key": cfg.seerrApiKey },
        signal: AbortSignal.timeout(8e3)
      });
      if (!res.ok) continue;
      for (const p of await res.json()) {
        if (typeof p.id === "number" && p.name && !all.has(p.id)) all.set(p.id, p);
      }
    }
    return [...all.values()].sort((a, b) => (a.displayPriority ?? 999) - (b.displayPriority ?? 999));
  }, { staleMs: 7 * 864e5 });
}
async function providerFacets(cfg, query, lang, wait) {
  const q = foldText(query);
  if (q.length < MIN_PREFIX2) return [];
  try {
    const region = regionOf(lang);
    let list = peek(providersKey(region), true);
    if (list === void 0) {
      const loading = providerList(cfg, region);
      if (!wait) {
        void loading.catch(() => void 0);
        return [];
      }
      list = await loading;
    }
    return list.filter((p) => matches(p.name ?? "", q) || foldText(p.name ?? "").split(" ").some((w) => w.length >= 3 && w === q)).slice(0, 3).map((p) => ({ kind: "provider", id: p.id, label: p.name, logoPath: p.logoPath ?? null }));
  } catch {
    return [];
  }
}

// server/search/person-credits.ts
var CREDITS_TTL_MS = 30 * 6e4;
var CREDITS_STALE_MS = 6 * 36e5;
var SELF = /^(himself|herself|themselves|self|lui-même|elle-même|eux-mêmes)\b/i;
var CREW_JOBS = /* @__PURE__ */ new Set(["Director", "Screenplay", "Writer", "Creator", "Novel", "Story"]);
var TALK_OR_NEWS = /* @__PURE__ */ new Set([10767, 10763]);
var str2 = (v) => typeof v === "string" && v.trim() !== "" ? v : null;
var num3 = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
function toCredit(r, crew) {
  const mediaType = r.mediaType === "movie" || r.mediaType === "tv" ? r.mediaType : null;
  const id = num3(r.id);
  if (!mediaType || id <= 0) return null;
  const role = crew ? str2(r.job) : str2(r.character);
  if (!crew && role && SELF.test(role)) return null;
  if (crew && !CREW_JOBS.has(String(r.job ?? ""))) return null;
  const genres = Array.isArray(r.genreIds) ? r.genreIds : [];
  if (genres.some((g) => typeof g === "number" && TALK_OR_NEWS.has(g))) return null;
  const info = r.mediaInfo;
  return {
    mediaType,
    id,
    title: str2(r.title) ?? str2(r.name) ?? "",
    releaseDate: str2(r.releaseDate) ?? str2(r.firstAirDate),
    posterPath: str2(r.posterPath),
    voteCount: num3(r.voteCount),
    popularity: num3(r.popularity),
    role,
    status: typeof info?.status === "number" ? info.status : void 0
  };
}
async function seerrGet(cfg, path, lang) {
  const res = await fetch(`${cfg.seerrUrl}${path}`, {
    headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang },
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) throw new Error(`Jellyseerr ${path.split("?")[0]} ${res.status}`);
  return await res.json();
}
async function personCredits(cfg, personId, lang) {
  return cached(`vigie:person:${personId}:${lang}`, CREDITS_TTL_MS, async () => {
    const raw = await seerrGet(cfg, `/api/v1/person/${personId}/combined_credits?language=${lang}`, lang);
    const all = [
      ...Array.isArray(raw.cast) ? raw.cast.map((r) => toCredit(r, false)) : [],
      ...Array.isArray(raw.crew) ? raw.crew.map((r) => toCredit(r, true)) : []
    ];
    const byKey = /* @__PURE__ */ new Map();
    for (const credit of all) {
      if (!credit || !credit.title) continue;
      const key = `${credit.mediaType}:${credit.id}`;
      if (!byKey.has(key)) byKey.set(key, credit);
    }
    const credits = [...byKey.values()];
    for (const c of credits) noteStatus(c.mediaType, c.id, c.status);
    return credits;
  }, { staleMs: CREDITS_STALE_MS });
}
async function resolvePerson(cfg, name, tmdbId, lang) {
  if (tmdbId !== null) return tmdbId;
  const folded = foldText(name);
  if (!folded) return null;
  const page = await remoteSearch(cfg, name, 1, lang, true);
  const exact = page.people.filter((p) => foldText(p.name) === folded);
  const best = (exact.length > 0 ? exact : page.people.slice(0, 1)).sort((a, b) => b.popularity - a.popularity)[0];
  return best?.id ?? null;
}
var LABELS2 = {
  fr: { movie: "Film", series: "S\xE9rie", requested: "Demand\xE9", processing: "En cours" },
  en: { movie: "Movie", series: "Series", requested: "Requested", processing: "In progress" }
};
function toItem(c, status, lang) {
  const l = lang === "fr" ? LABELS2.fr : LABELS2.en;
  const kind = c.mediaType === "movie" ? "movie" : "series";
  const year = c.releaseDate ? Number(c.releaseDate.slice(0, 4)) || null : null;
  const subtitle = [kind === "movie" ? l.movie : l.series, year, c.role].filter(Boolean).join(" \xB7 ");
  return {
    id: `${c.mediaType}:${c.id}`,
    kind,
    title: c.title,
    year,
    subtitle: subtitle.slice(0, 120),
    imageUrl: c.posterPath ? `https://image.tmdb.org/t/p/w185${c.posterPath}` : null,
    href: `/discover?media=${c.mediaType}:${c.id}`,
    badge: status === MEDIA_STATUS.PENDING ? { label: l.requested, tone: "info" } : status === MEDIA_STATUS.PROCESSING ? { label: l.processing, tone: "warning" } : null
  };
}
async function personProvider(cfg, q) {
  const empty = { query: q.name, correction: null, complete: true, items: [], moreHref: null };
  const personId = await resolvePerson(cfg, q.name, q.tmdbId, q.lang);
  if (personId === null) return empty;
  const credits = await personCredits(cfg, personId, q.lang);
  const items = credits.filter((c) => q.type === null || q.type === "movie" === (c.mediaType === "movie")).map((c) => ({ c, status: statusOf(c.mediaType, c.id) ?? c.status })).filter(({ status }) => !inLibraryOrBlocked(status)).sort((a, b) => b.c.voteCount - a.c.voteCount || b.c.popularity - a.c.popularity).slice(0, q.limit).map(({ c, status }) => toItem(c, status, q.lang));
  return { ...empty, items, moreHref: `/discover?person=${personId}` };
}

// server/routes-search.ts
var MAX_QUERY = 120;
var MAX_PAGE = 20;
function readLang(raw) {
  return typeof raw === "string" && /^[a-z]{2}$/i.test(raw) ? raw.toLowerCase() : "en";
}
function todayIso2() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
async function registerSearchRoutes(app, prisma, getWorkerConfig2) {
  await ensureSearchTables(prisma);
  async function context() {
    const cfg = await getWorkerConfig2();
    return cfg ? { prisma, cfg } : null;
  }
  void context().then((ctx) => {
    if (ctx) warmSearch(ctx);
  }).catch(() => void 0);
  app.get("/search", async (request, reply) => {
    const startedAt = Date.now();
    const query = request.query;
    const q = (query.q ?? "").slice(0, MAX_QUERY);
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const opts = {
      lang: readLang(query.lang),
      page: Math.min(Math.max(1, Number(query.page) || 1), MAX_PAGE),
      showBlocked: query.showBlocked === "1",
      exact: query.exact === "1"
    };
    const instant = query.mode === "instant";
    const ranked = instant ? instantSearch(ctx, q, opts) : await fullSearch(ctx, q, opts);
    const facets = opts.page === 1 && q.trim().length >= 2 ? [...genreFacets(q, opts.lang), ...await providerFacets(ctx.cfg, q, opts.lang, !instant)] : [];
    return presentHub(ranked, opts.page, facets, titleIndexBuilding(), startedAt);
  });
  app.get("/search/provider", async (request, reply) => {
    const query = request.query;
    const q = (query.q ?? "").slice(0, MAX_QUERY);
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const lang = readLang(query.lang);
    const type = query.type === "movie" || query.type === "series" ? query.type : null;
    const limit = Math.min(Math.max(1, Number(query.limit) || 8), 20);
    const opts = { lang, page: 1, showBlocked: false };
    const ranked = fullIfReady(ctx, q, opts) ?? instantSearch(ctx, q, opts);
    return presentProvider(ranked, type, limit, lang, todayIso2());
  });
  app.get("/search/person", async (request, reply) => {
    const query = request.query;
    const name = (query.name ?? "").trim().slice(0, MAX_QUERY);
    const tmdb = Number(query.tmdb);
    const tmdbId = Number.isInteger(tmdb) && tmdb > 0 ? tmdb : null;
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const empty = { query: name, correction: null, complete: true, items: [], moreHref: null };
    if (!name && tmdbId === null) return empty;
    try {
      return await personProvider(ctx.cfg, {
        name,
        tmdbId,
        lang: readLang(query.lang),
        limit: Math.min(Math.max(1, Number(query.limit) || 20), 40),
        type: query.type === "movie" || query.type === "series" ? query.type : null
      });
    } catch {
      return empty;
    }
  });
}

// server/index.ts
var __pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));
var cfgCache = null;
function getPluginConfig(ctx) {
  try {
    const installedPath = resolve(__pluginDir, "..", "installed.json");
    if (!existsSync(installedPath)) return {};
    const mtimeMs = statSync(installedPath).mtimeMs;
    if (cfgCache && cfgCache.mtimeMs === mtimeMs) return cfgCache.value;
    const installed = JSON.parse(readFileSync(installedPath, "utf-8"));
    const plugin = installed.find(
      (p) => p.pluginId === ctx.pluginId || p.id === ctx.pluginId
    );
    const value = plugin?.config || {};
    cfgCache = { mtimeMs, value };
    return value;
  } catch {
    return {};
  }
}
async function getWorkerConfig(ctx) {
  const config = getPluginConfig(ctx);
  const url = config.url;
  const apiKey = config.apiKey;
  if (!url || !apiKey) return null;
  const profiles = config.profiles ?? [];
  return { seerrUrl: url.replace(/\/$/, ""), seerrApiKey: apiKey, interval: 6e4, syncEvery: 2, profiles };
}
async function seerBackend(app, ctx) {
  const prisma = ctx.getPrisma();
  await ensureTables(prisma);
  console.log("[SeerBackend] Database tables ready");
  startWorker(prisma, () => getWorkerConfig(ctx));
  app.addHook("onClose", async () => {
    stopWorker();
  });
  app.addHook("preHandler", ctx.requireAuth);
  app.get("/config", async (request) => {
    const config = getPluginConfig(ctx);
    const user = request.user;
    if (user?.isAdmin) {
      return { ...config, isAdmin: true };
    }
    return { url: config.url || "", enabled: !!config.enabled, hasApiKey: !!config.apiKey, isAdmin: false };
  });
  app.put("/config", { preHandler: ctx.requireAdmin }, async (request) => {
    const installedPath = resolve(__pluginDir, "..", "installed.json");
    if (!existsSync(installedPath)) return { error: "installed.json not found" };
    const installed = JSON.parse(readFileSync(installedPath, "utf-8"));
    const plugin = installed.find(
      (p) => p.pluginId === ctx.pluginId || p.id === ctx.pluginId
    );
    if (!plugin) return { error: "Plugin not found" };
    plugin.config = request.body;
    writeFileSync(installedPath, JSON.stringify(installed, null, 2));
    return plugin.config;
  });
  registerProxyRoutes(app, () => getPluginConfig(ctx));
  const gwc = () => getWorkerConfig(ctx);
  registerRequestRoutes(app, prisma, gwc);
  registerBulkRoutes(app, prisma, gwc);
  registerProfileRoutes(app, () => getPluginConfig(ctx), () => {
    const c = getPluginConfig(ctx);
    const url = c.url;
    const apiKey = c.apiKey;
    if (!url || !apiKey) return null;
    return { seerrUrl: url.replace(/\/$/, ""), seerrApiKey: apiKey };
  });
  registerUsersRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerAvailabilityRoutes(app, prisma, gwc);
  registerProgressRoutes(app, prisma, gwc, ctx.requireAdmin);
  registerCalendarRoutes(app, prisma, gwc);
  registerMiscRoutes(app, prisma, gwc, ctx.requireAdmin);
  await registerSearchRoutes(app, prisma, gwc);
  console.log("[SeerBackend] Routes registered");
}
export {
  seerBackend as default
};
