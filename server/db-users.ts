/* ------------------------------------------------------------------ */
/*  Seer Plugin — Database layer : comptes (permissions, quotas)        */
/* ------------------------------------------------------------------ */

/* Extrait de db.ts pour tenir sous 300 lignes, ré-exporté par lui : les
 * appelants n'ont rien à changer. Les deux listes de comptes qui vivaient
 * ici ont disparu avec la nouvelle synchro (users-overview.ts). */

import type { PrismaClient } from "@prisma/client";
import type { SeerUserSettings } from "./types";
import { rowToUserSettings } from "./db-helpers";

type Prisma = PrismaClient;

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
