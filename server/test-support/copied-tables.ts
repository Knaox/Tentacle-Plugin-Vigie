import type { TestDatabase } from "./sqlite";

/*
 * Des tables seer_* telles que la copie générique de la migration MariaDB →
 * SQLite les produit (docs/sqlite/GENERIC-COPY.md) : types TEXT / INTEGER /
 * REAL / DATETIME, dates en millisecondes entières, clé en contrainte de table,
 * index sous leur nom MariaDB — et déjà remplies.
 */

export const NOW = Date.now();
export const TWO_DAYS = 2 * 86_400_000;

/** Ce que la copie générique produit pour seer_requests (forme d'une Vigie 1.20 : sans origin ni platform). */
export function copiedTables(raw: TestDatabase, now: number = NOW): void {
  raw.exec(`
    CREATE TABLE "seer_requests" ("id" TEXT NOT NULL, "jellyfin_user_id" TEXT NOT NULL, "username" TEXT NOT NULL,
      "media_type" TEXT NOT NULL, "tmdb_id" INTEGER NOT NULL, "title" TEXT NOT NULL, "poster_path" TEXT,
      "backdrop_path" TEXT, "overview" TEXT, "year" TEXT, "seasons" TEXT, "status" TEXT NOT NULL DEFAULT 'queued',
      "seerr_request_id" INTEGER, "seerr_media_id" INTEGER, "seerr_media_status" INTEGER,
      "retry_count" INTEGER NOT NULL DEFAULT 0, "max_retries" INTEGER NOT NULL DEFAULT 10, "last_error" TEXT,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "created_at" DATETIME NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
      "updated_at" DATETIME NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
      "sent_at" DATETIME, "completed_at" DATETIME, "pending_cleanup_id" TEXT, "profile_id" TEXT,
      "is_anime" INTEGER NOT NULL DEFAULT 0, "notified_seasons" TEXT,
      PRIMARY KEY ("id"));
    CREATE INDEX "idx_seer_req_user" ON "seer_requests" ("jellyfin_user_id");
    CREATE INDEX "idx_seer_req_status" ON "seer_requests" ("status");
    CREATE INDEX "idx_seer_req_queue" ON "seer_requests" ("status", "priority", "created_at");
    CREATE TABLE "seer_tmdb_cache" ("media_type" TEXT NOT NULL, "tmdb_id" INTEGER NOT NULL,
      "title" TEXT NOT NULL DEFAULT '', "vote_average" REAL, "popularity" REAL,
      "fetched_at" DATETIME NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
      "expires_at" DATETIME NOT NULL, PRIMARY KEY ("media_type", "tmdb_id"));
    CREATE INDEX "idx_tmdbc_expires" ON "seer_tmdb_cache" ("expires_at");
  `);
  raw.prepare(`INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, created_at, updated_at)
    VALUES ('r1', 'u1', 'alice', 'movie', 603, 'Un film', 'queued', ?, ?)`).run(now - TWO_DAYS, now - TWO_DAYS);
  raw.prepare(`INSERT INTO seer_tmdb_cache (media_type, tmdb_id, title, vote_average, fetched_at, expires_at)
    VALUES ('movie', 603, 'Un film', 7.7, ?, ?)`).run(now, now + 86_400_000);
}
