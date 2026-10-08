import { bindable, openTestDatabase, type TestDatabase } from "./sqlite";

/*
 * Un faux client Prisma sur une VRAIE SQLite, pour figer le comportement
 * d'AVANT le portage : le SQL de Vigie y passe tel quel, à la seule
 * traduction des quelques tournures MySQL du chemin de suppression
 * (`NOW()`, `DATE_ADD(NOW(), INTERVAL ? SECOND)`). Les dates y sont gardées
 * comme `datetime('now')` les écrit : 'AAAA-MM-JJ HH:MM:SS', en UTC.
 *
 * Les tables sont posées ici à la main, dans leur forme actuelle — le temps
 * que les migrations de Vigie les créent elles-mêmes.
 */

const SCHEMA = `
CREATE TABLE seer_requests (
  id TEXT PRIMARY KEY, jellyfin_user_id TEXT NOT NULL, username TEXT NOT NULL,
  media_type TEXT NOT NULL, tmdb_id INTEGER NOT NULL, title TEXT NOT NULL,
  poster_path TEXT, backdrop_path TEXT, overview TEXT, year TEXT, seasons TEXT,
  status TEXT NOT NULL DEFAULT 'queued', seerr_request_id INTEGER, seerr_media_id INTEGER,
  seerr_media_status INTEGER, retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 10, last_error TEXT, priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT, completed_at TEXT, pending_cleanup_id TEXT, profile_id TEXT,
  is_anime INTEGER NOT NULL DEFAULT 0, notified_seasons TEXT, origin TEXT, platform TEXT
);
CREATE TABLE seer_cleanup_queue (
  id TEXT PRIMARY KEY, action TEXT NOT NULL, media_type TEXT NOT NULL, tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL, seerr_request_id INTEGER, seerr_media_id INTEGER,
  delete_files INTEGER NOT NULL DEFAULT 1, retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 20, last_error TEXT, status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), next_retry_at TEXT NOT NULL DEFAULT (datetime('now')),
  request_id TEXT, seasons TEXT, jellyfin_user_id TEXT
);
CREATE TABLE seer_user_settings (
  jellyfin_user_id TEXT PRIMARY KEY, username TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER, allow_movies INTEGER NOT NULL DEFAULT 1, allow_tv INTEGER NOT NULL DEFAULT 1,
  allow_anime INTEGER NOT NULL DEFAULT 1, jellyseerr_user_id INTEGER, jellyseerr_last_sync TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

function translate(sql: string): string {
  return sql
    .replace(/DATE_ADD\(NOW\(\), INTERVAL \? SECOND\)/g, "datetime('now', printf('%+d seconds', ?))")
    .replace(/NOW\(\d?\)/g, "datetime('now')");
}

const sqliteDate = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

export interface LegacyPrisma {
  $queryRawUnsafe<T = unknown>(sql: string, ...params: unknown[]): Promise<T>;
  $executeRawUnsafe(sql: string, ...params: unknown[]): Promise<number>;
  db: TestDatabase;
}

export function legacyPrisma(): LegacyPrisma {
  const db = openTestDatabase();
  db.exec(SCHEMA);
  return {
    db,
    $queryRawUnsafe: async <T>(sql: string, ...params: unknown[]) =>
      db.prepare(translate(sql)).all(...bindable(params, sqliteDate)) as T,
    $executeRawUnsafe: async (sql: string, ...params: unknown[]) =>
      Number(db.prepare(translate(sql)).run(...bindable(params, sqliteDate)).changes),
  };
}
