/* ------------------------------------------------------------------ */
/*  Seer Plugin — Database queries (lists, stats)                      */
/* ------------------------------------------------------------------ */

import type { VigieDb } from "./storage/vigie-db";
import type { SeerRequest } from "./types";
import { rowToRequest } from "./db-helpers";

/* ── User / All requests (paginated) ─────────────────────────────── */

export async function getUserRequests(
  db: VigieDb,
  jellyfinUserId: string,
  opts: { page?: number; limit?: number; status?: string; mediaType?: string },
): Promise<{ results: SeerRequest[]; total: number; page: number; pages: number }> {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;

  let where = `WHERE jellyfin_user_id = ? AND status != 'deleted'`;
  const params: unknown[] = [jellyfinUserId];

  if (opts.status) {
    const statuses = opts.status.split(",").map((s) => s.trim());
    where += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (opts.mediaType) {
    where += ` AND media_type = ?`;
    params.push(opts.mediaType);
  }

  const countRows = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM seer_requests ${where}`,
    ...params,
  );
  const total = Number(countRows[0].cnt);

  const rows = await db.query(
    `SELECT * FROM seer_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  return { results: rows.map(rowToRequest), total, page, pages: Math.ceil(total / limit) || 1 };
}

export async function getAllRequests(
  db: VigieDb,
  opts: { page?: number; limit?: number; status?: string; mediaType?: string },
): Promise<{ results: SeerRequest[]; total: number; page: number; pages: number }> {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;

  let where = `WHERE status != 'deleted'`;
  const params: unknown[] = [];

  if (opts.status) {
    const statuses = opts.status.split(",").map((s) => s.trim());
    where += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (opts.mediaType) {
    where += ` AND media_type = ?`;
    params.push(opts.mediaType);
  }

  const countRows = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM seer_requests ${where}`,
    ...params,
  );
  const total = Number(countRows[0].cnt);

  const rows = await db.query(
    `SELECT * FROM seer_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  return { results: rows.map(rowToRequest), total, page, pages: Math.ceil(total / limit) || 1 };
}

/* ── Queue status ────────────────────────────────────────────────── */

export async function getQueueStatus(
  db: VigieDb,
  jellyfinUserId?: string,
): Promise<{ processing: SeerRequest | null; queued: number; retryPending: number; deleting: number }> {
  const userFilter = jellyfinUserId ? ` AND jellyfin_user_id = ?` : "";
  const userParams = jellyfinUserId ? [jellyfinUserId] : [];

  const processingRows = await db.query(
    `SELECT * FROM seer_requests WHERE status = 'processing'${userFilter} LIMIT 1`,
    ...userParams,
  );

  const countRows = await db.query<{ queued: number; retry_pending: number; deleting: number }>(
    `SELECT
       SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
       SUM(CASE WHEN status = 'retry_pending' THEN 1 ELSE 0 END) as retry_pending,
       SUM(CASE WHEN status = 'deleting' THEN 1 ELSE 0 END) as deleting
     FROM seer_requests WHERE status IN ('queued', 'retry_pending', 'deleting')${userFilter}`,
    ...userParams,
  );

  return {
    processing: processingRows.length > 0 ? rowToRequest(processingRows[0]) : null,
    queued: Number(countRows[0].queued) || 0,
    retryPending: Number(countRows[0].retry_pending) || 0,
    deleting: Number(countRows[0].deleting) || 0,
  };
}

/* ── Stats ────────────────────────────────────────────────────────── */

export async function getUserStats(db: VigieDb, jellyfinUserId: string) {
  const byStatus = await db.query<{ status: string; cnt: number }>(
    `SELECT status, COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ? AND status != 'deleted'
     GROUP BY status`,
    jellyfinUserId,
  );
  const byType = await db.query<{ media_type: string; cnt: number }>(
    `SELECT media_type, COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ? AND status != 'deleted'
     GROUP BY media_type`,
    jellyfinUserId,
  );
  const total = byStatus.reduce((n, r) => n + Number(r.cnt), 0);

  return {
    totalRequests: total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.cnt)])),
    byType: Object.fromEntries(byType.map((r) => [r.media_type, Number(r.cnt)])),
  };
}

export async function getGlobalStats(db: VigieDb) {
  const byStatus = await db.query<{ status: string; cnt: number }>(
    `SELECT status, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY status`,
  );
  const byType = await db.query<{ media_type: string; cnt: number }>(
    `SELECT media_type, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY media_type`,
  );
  const topRequested = await db.query<{ title: string; tmdb_id: number; cnt: number }>(
    `SELECT title, tmdb_id, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY title, tmdb_id ORDER BY cnt DESC, title ASC LIMIT 10`,
  );
  // Par COMPTE, pas par nom (SQLite compare les noms à la casse près) : le nom
  // affiché est celui de sa demande la plus récente (colonne nue + MAX, SQLite).
  const topUsers = await db.query<{ username: string; cnt: number }>(
    `SELECT username, MAX(created_at) AS last_at, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY jellyfin_user_id ORDER BY cnt DESC, username ASC LIMIT 10`,
  );
  const total = byStatus.reduce((n, r) => n + Number(r.cnt), 0);
  const available = Number(byStatus.find((r) => r.status === "available")?.cnt || 0);

  return {
    totalRequests: total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.cnt)])),
    byType: Object.fromEntries(byType.map((r) => [r.media_type, Number(r.cnt)])),
    topRequested: topRequested.map((r) => ({ title: r.title, tmdbId: r.tmdb_id, count: Number(r.cnt) })),
    topUsers: topUsers.map((r) => ({ username: r.username, count: Number(r.cnt) })),
    successRate: total > 0 ? Math.round((available / total) * 100) : 0,
  };
}
