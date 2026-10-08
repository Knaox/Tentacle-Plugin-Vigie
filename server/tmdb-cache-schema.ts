/* ------------------------------------------------------------------ */
/*  Seer Plugin — Schéma de la mémoire des fiches TMDB                 */
/* ------------------------------------------------------------------ */

/*
 * Séparé des lectures et des écritures pour tenir sous la limite de trois
 * cents lignes : ce fichier ne décrit QUE la forme de la table et son
 * évolution, l'autre ne fait que s'en servir.
 */

import type { PrismaClient } from "@prisma/client";

export async function ensureTmdbCacheTable(prisma: PrismaClient): Promise<void> {
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

  /* `CREATE TABLE IF NOT EXISTS` n'ajoute rien à une table déjà là, et celle-ci
   * ne passe pas par les migrations Prisma : les colonnes de tri et de filtre
   * doivent donc être posées à part. Décimal plutôt que flottant pour la note —
   * un `FLOAT` rendrait 7,699999 là où TMDB annonce 7,7.
   *
   * Aucun index : ces colonnes ne servent jamais dans un WHERE, le tri et le
   * filtrage se font en mémoire après la lecture groupée. Un index de plus, ce
   * serait une écriture de plus à chaque enregistrement, pour rien. */
  const addColumn = async (col: string, def: string) => {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE seer_tmdb_cache ADD COLUMN ${col} ${def}`);
      console.log(`[SeerTmdb] Colonne ajoutée : ${col}`);
    } catch { /* déjà présente */ }
  };

  await addColumn("vote_average", "DECIMAL(3,1) DEFAULT NULL");
  await addColumn("popularity", "DECIMAL(8,3) DEFAULT NULL");
  await addColumn("original_language", "CHAR(2) DEFAULT NULL");
  await addColumn("genre_ids", "VARCHAR(120) DEFAULT NULL");
  await addColumn("is_anime", "TINYINT(1) NOT NULL DEFAULT 0");
}
