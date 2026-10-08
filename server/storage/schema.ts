/* ------------------------------------------------------------------ */
/*  Vigie — La forme des tables, en SQLite                             */
/* ------------------------------------------------------------------ */

/*
 * Ce que Vigie attend de chaque table : ses colonnes, sa clé, ses index. La
 * migration 1 (`migrations.ts`) en tire la création d'une table absente, et
 * les colonnes à AJOUTER à une table déjà là — venue d'une copie depuis
 * MariaDB ou d'une version d'avant —, sans jamais la recréer.
 *
 * Les dates sont déclarées `DATETIME` (Prisma les relit en `Date`) et
 * contiennent des millisecondes entières. Aucun défaut de date : chaque
 * écriture nomme ses colonnes de date. `add` est la définition d'une colonne
 * ajoutée après coup — SQLite n'y accepte qu'un défaut constant.
 */

export interface ColumnSpec {
  name: string;
  /** Définition à la création de la table. */
  create: string;
  /** Définition pour l'ajouter à une table existante (défaut constant). */
  add: string;
}

export interface TableSpec {
  name: string;
  columns: readonly ColumnSpec[];
  primaryKey: readonly string[];
  indexes: ReadonlyArray<{ name: string; columns: string }>;
}

function col(name: string, create: string, add: string = create.replace(/\bNOT NULL\b(?!.*DEFAULT)/, "")): ColumnSpec {
  return { name, create, add: add.trim() };
}

export const TABLES: readonly TableSpec[] = [
  {
    name: "seer_requests",
    columns: [
      col("id", "TEXT NOT NULL"), col("jellyfin_user_id", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT ''"),
      col("username", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT ''"), col("media_type", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT 'movie'"),
      col("tmdb_id", "INTEGER NOT NULL", "INTEGER NOT NULL DEFAULT 0"), col("title", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT ''"),
      col("poster_path", "TEXT"), col("backdrop_path", "TEXT"), col("overview", "TEXT"), col("year", "TEXT"),
      col("seasons", "TEXT"), col("status", "TEXT NOT NULL DEFAULT 'queued'"),
      col("seerr_request_id", "INTEGER"), col("seerr_media_id", "INTEGER"), col("seerr_media_status", "INTEGER"),
      col("retry_count", "INTEGER NOT NULL DEFAULT 0"), col("max_retries", "INTEGER NOT NULL DEFAULT 10"),
      col("last_error", "TEXT"), col("priority", "INTEGER NOT NULL DEFAULT 0"),
      col("created_at", "DATETIME NOT NULL", "DATETIME"), col("updated_at", "DATETIME NOT NULL", "DATETIME"),
      col("sent_at", "DATETIME"), col("completed_at", "DATETIME"),
      col("pending_cleanup_id", "TEXT"), col("profile_id", "TEXT"),
      col("is_anime", "INTEGER NOT NULL DEFAULT 0"), col("notified_seasons", "TEXT"),
      col("origin", "TEXT"), col("platform", "TEXT"),
    ],
    primaryKey: ["id"],
    indexes: [
      { name: "idx_seer_req_user", columns: "jellyfin_user_id" },
      { name: "idx_seer_req_status", columns: "status" },
      { name: "idx_seer_req_queue", columns: "status, priority DESC, created_at ASC" },
    ],
  },
  {
    name: "seer_cleanup_queue",
    columns: [
      col("id", "TEXT NOT NULL"), col("action", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT 'delete'"),
      col("media_type", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT 'movie'"), col("tmdb_id", "INTEGER NOT NULL", "INTEGER NOT NULL DEFAULT 0"),
      col("title", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT ''"),
      col("seerr_request_id", "INTEGER"), col("seerr_media_id", "INTEGER"),
      col("delete_files", "INTEGER NOT NULL DEFAULT 1"), col("retry_count", "INTEGER NOT NULL DEFAULT 0"),
      col("max_retries", "INTEGER NOT NULL DEFAULT 20"), col("last_error", "TEXT"),
      col("status", "TEXT NOT NULL DEFAULT 'pending'"),
      col("created_at", "DATETIME NOT NULL", "DATETIME"), col("next_retry_at", "DATETIME NOT NULL", "DATETIME"),
      col("request_id", "TEXT"), col("seasons", "TEXT"), col("jellyfin_user_id", "TEXT"),
    ],
    primaryKey: ["id"],
    indexes: [{ name: "idx_cleanup_status", columns: "status, next_retry_at" }],
  },
  {
    name: "seer_user_settings",
    columns: [
      col("jellyfin_user_id", "TEXT NOT NULL"), col("username", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT ''"),
      col("blocked", "INTEGER NOT NULL DEFAULT 0"), col("daily_limit", "INTEGER"),
      col("allow_movies", "INTEGER NOT NULL DEFAULT 1"), col("allow_tv", "INTEGER NOT NULL DEFAULT 1"),
      col("allow_anime", "INTEGER NOT NULL DEFAULT 1"), col("jellyseerr_user_id", "INTEGER"),
      col("jellyseerr_last_sync", "DATETIME"),
      col("created_at", "DATETIME NOT NULL", "DATETIME"), col("updated_at", "DATETIME NOT NULL", "DATETIME"),
    ],
    primaryKey: ["jellyfin_user_id"],
    indexes: [{ name: "idx_seer_user_seerrid", columns: "jellyseerr_user_id" }],
  },
  {
    name: "seer_tmdb_cache",
    columns: [
      col("media_type", "TEXT NOT NULL"), col("tmdb_id", "INTEGER NOT NULL"),
      col("title", "TEXT NOT NULL DEFAULT ''"), col("poster_path", "TEXT"), col("backdrop_path", "TEXT"),
      col("overview", "TEXT"), col("release_date", "TEXT"), col("tmdb_status", "TEXT"),
      col("digital_date", "TEXT"), col("theatrical_date", "TEXT"), col("physical_date", "TEXT"),
      col("release_region", "TEXT"), col("next_air_date", "TEXT"), col("next_season", "INTEGER"),
      col("next_episode", "INTEGER"), col("last_air_date", "TEXT"), col("networks", "TEXT"),
      col("provider_ids", "TEXT"), col("vote_average", "REAL"), col("popularity", "REAL"),
      col("original_language", "TEXT"), col("genre_ids", "TEXT"), col("is_anime", "INTEGER NOT NULL DEFAULT 0"),
      col("fetched_at", "DATETIME NOT NULL", "DATETIME"), col("expires_at", "DATETIME NOT NULL", "DATETIME"),
    ],
    primaryKey: ["media_type", "tmdb_id"],
    indexes: [
      { name: "idx_tmdbc_expires", columns: "expires_at" },
      { name: "idx_tmdbc_next_air", columns: "next_air_date" },
      { name: "idx_tmdbc_digital", columns: "digital_date" },
    ],
  },
  {
    name: "seer_search_titles",
    columns: [
      col("media_type", "TEXT NOT NULL"), col("tmdb_id", "INTEGER NOT NULL"), col("lang", "TEXT NOT NULL"),
      col("title", "TEXT NOT NULL DEFAULT ''"), col("original_title", "TEXT"), col("release_date", "TEXT"),
      col("popularity", "REAL"), col("vote_count", "INTEGER"), col("vote_average", "REAL"),
      col("poster_path", "TEXT"), col("backdrop_path", "TEXT"), col("original_language", "TEXT"),
      col("genre_ids", "TEXT"), col("updated_at", "DATETIME NOT NULL", "DATETIME"),
    ],
    primaryKey: ["media_type", "tmdb_id", "lang"],
    indexes: [],
  },
  {
    name: "seer_search_meta",
    columns: [
      col("meta_key", "TEXT NOT NULL"), col("meta_value", "TEXT NOT NULL DEFAULT ''"),
      col("updated_at", "DATETIME NOT NULL", "DATETIME"),
    ],
    primaryKey: ["meta_key"],
    indexes: [],
  },
];

export function createTableSql(table: TableSpec): string {
  const columns = table.columns.map((c) => `${c.name} ${c.create}`);
  return `CREATE TABLE IF NOT EXISTS ${table.name} (${[...columns, `PRIMARY KEY (${table.primaryKey.join(", ")})`].join(", ")})`;
}
