/* ------------------------------------------------------------------ */
/*  Vigie — La mémoire durable de l'index des titres                   */
/* ------------------------------------------------------------------ */

/*
 * L'index se construit en interrogeant Jellyseerr quelques centaines de fois :
 * le refaire à chaque redémarrage du serveur serait un gâchis. Il vit donc
 * aussi en base, relu d'une traite au premier usage (quelques milliers de
 * lignes, une requête), et chaque titre appris en cherchant y est ajouté par
 * petits paquets.
 */

import type { PrismaClient } from "@prisma/client";
import { chunk } from "../concurrency";
import type { TitleIndex, TitleRecord } from "./title-index";

const FLUSH_EVERY_MS = 30_000;
const FLUSH_AT = 400;
const BATCH = 200;

let pending: TitleRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export async function ensureSearchTables(prisma: PrismaClient): Promise<void> {
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

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rowToRecord(row: Record<string, unknown>): TitleRecord {
  return {
    mediaType: row.media_type === "tv" ? "tv" : "movie",
    tmdbId: num(row.tmdb_id),
    lang: String(row.lang ?? "en"),
    title: String(row.title ?? ""),
    originalTitle: (row.original_title as string | null) ?? null,
    releaseDate: (row.release_date as string | null) ?? null,
    popularity: num(row.popularity),
    voteCount: num(row.vote_count),
    voteAverage: num(row.vote_average),
    posterPath: (row.poster_path as string | null) ?? null,
    backdropPath: (row.backdrop_path as string | null) ?? null,
    originalLanguage: (row.original_language as string | null) ?? null,
    genreIds: String(row.genre_ids ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0),
  };
}

/** Relit toute la table dans l'index. Rend le nombre de lignes lues. */
export async function loadTitles(prisma: PrismaClient, index: TitleIndex): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM seer_search_titles`);
  for (const row of rows) index.upsert(rowToRecord(row));
  return rows.length;
}

async function writeBatch(prisma: PrismaClient, records: TitleRecord[]): Promise<void> {
  for (const part of chunk(records, BATCH)) {
    const placeholders = part.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
    const values = part.flatMap((r) => [
      r.mediaType, r.tmdbId, r.lang.slice(0, 8), r.title.slice(0, 500), r.originalTitle?.slice(0, 500) ?? null,
      r.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate) ? r.releaseDate : null,
      Math.min(r.popularity, 9_999_999), r.voteCount, Math.min(r.voteAverage, 10),
      r.posterPath, r.backdropPath, r.originalLanguage?.slice(0, 10) ?? null, r.genreIds.join(",").slice(0, 120) || null,
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
      ...values,
    );
  }
}

/** Écrit tout ce qui attend. Ne rejette jamais : un index qui ne s'écrit pas reste un index qui cherche. */
export async function flushTitles(prisma: PrismaClient): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (pending.length === 0) return;
  const batch = pending;
  pending = [];
  try {
    await writeBatch(prisma, batch);
  } catch (err) {
    console.warn(`[Vigie] Index de recherche non enregistré : ${err instanceof Error ? err.message : err}`);
  }
}

/** Met des titres de côté pour la prochaine écriture groupée. */
export function queueTitles(prisma: PrismaClient, records: TitleRecord[]): void {
  pending.push(...records);
  if (pending.length >= FLUSH_AT) { void flushTitles(prisma); return; }
  if (!flushTimer) flushTimer = setTimeout(() => { void flushTitles(prisma); }, FLUSH_EVERY_MS);
}

export async function readMeta(prisma: PrismaClient, key: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ meta_value: string }>>(
    `SELECT meta_value FROM seer_search_meta WHERE meta_key = ?`, key,
  );
  return rows[0]?.meta_value ?? null;
}

export async function writeMeta(prisma: PrismaClient, key: string, value: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_search_meta (meta_key, meta_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
    key, value.slice(0, 500),
  );
}

/** Une liste de blocage a changé : tout ce qui a été appris avant peut être interdit. */
export async function clearTitles(prisma: PrismaClient): Promise<void> {
  pending = [];
  await prisma.$executeRawUnsafe(`DELETE FROM seer_search_titles`);
}
