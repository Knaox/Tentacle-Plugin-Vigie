/* ------------------------------------------------------------------ */
/*  Seer Plugin — Database layer : comptes (permissions, quotas)        */
/* ------------------------------------------------------------------ */

/* Extrait de db.ts pour tenir sous 300 lignes, ré-exporté par lui : les
 * appelants n'ont rien à changer. Les deux listes de comptes qui vivaient
 * ici ont disparu avec la nouvelle synchro (users-overview.ts). */

import type { VigieDb } from "./storage/vigie-db";
import type { SeerUserSettings } from "./types";
import { rowToUserSettings } from "./db-helpers";

export async function getOrCreateUserSettings(
  db: VigieDb,
  jellyfinUserId: string,
  username: string,
): Promise<SeerUserSettings> {
  const rows = await db.query(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId,
  );
  if (rows.length > 0) {
    if (username && rows[0].username !== username) {
      await db.execute(
        `UPDATE seer_user_settings SET updated_at = ${db.sql.now()}, username = ? WHERE jellyfin_user_id = ?`,
        username, jellyfinUserId,
      );
      rows[0].username = username;
    }
    return rowToUserSettings(rows[0]);
  }
  await db.execute(
    `INSERT INTO seer_user_settings
      (jellyfin_user_id, username, blocked, daily_limit, allow_movies, allow_tv, allow_anime, created_at, updated_at)
     VALUES (?, ?, 0, NULL, 1, 1, 1, ${db.sql.now()}, ${db.sql.now()})`,
    jellyfinUserId, username || jellyfinUserId,
  );
  const created = await db.query(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId,
  );
  return rowToUserSettings(created[0]);
}

export async function getUserSettings(
  db: VigieDb,
  jellyfinUserId: string,
): Promise<SeerUserSettings | null> {
  const rows = await db.query(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId,
  );
  return rows.length > 0 ? rowToUserSettings(rows[0]) : null;
}

export async function updateUserSettings(
  db: VigieDb,
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
  await db.execute(
    `UPDATE seer_user_settings SET updated_at = ${db.sql.now()}, ${sets.join(", ")} WHERE jellyfin_user_id = ?`,
    ...params,
  );
}

export async function countRequestsToday(
  db: VigieDb,
  jellyfinUserId: string,
): Promise<number> {
  const rows = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ?
       AND created_at >= ${db.sql.startOfToday()}
       AND status NOT IN ('failed', 'deleted')`,
    jellyfinUserId,
  );
  return Number(rows[0].cnt);
}
