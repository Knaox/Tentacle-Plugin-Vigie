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

import type { VigieDb } from "../storage/vigie-db";
import { chunk } from "../concurrency";
import type { TitleIndex, TitleRecord } from "./title-index";

const FLUSH_EVERY_MS = 30_000;
const FLUSH_AT = 400;
const BATCH = 200;

let pending: TitleRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

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
export async function loadTitles(db: VigieDb, index: TitleIndex): Promise<number> {
  const rows = await db.query(`SELECT * FROM seer_search_titles`);
  for (const row of rows) index.upsert(rowToRecord(row));
  return rows.length;
}

const TITLE_KEY = ["media_type", "tmdb_id", "lang"];
const TITLE_COLUMNS = [
  ...TITLE_KEY, "title", "original_title", "release_date", "popularity", "vote_count",
  "vote_average", "poster_path", "backdrop_path", "original_language", "genre_ids", "updated_at",
];
const TITLE_UPDATE = TITLE_COLUMNS.filter((c) => !TITLE_KEY.includes(c));

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

async function writeBatch(db: VigieDb, records: TitleRecord[]): Promise<void> {
  for (const part of chunk(records, BATCH)) {
    const now = db.sql.dateParam(new Date());
    const values = part.flatMap((r) => [
      r.mediaType, r.tmdbId, r.lang.slice(0, 8), r.title.slice(0, 500), r.originalTitle?.slice(0, 500) ?? null,
      r.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate) ? r.releaseDate : null,
      // Les arrondis que faisaient les colonnes DECIMAL(10,3) et DECIMAL(3,1) de MariaDB.
      round(Math.min(r.popularity, 9_999_999), 3), r.voteCount, round(Math.min(r.voteAverage, 10), 1),
      r.posterPath, r.backdropPath, r.originalLanguage?.slice(0, 10) ?? null, r.genreIds.join(",").slice(0, 120) || null,
      now,
    ]);
    await db.execute(db.sql.upsert({ table: "seer_search_titles", columns: TITLE_COLUMNS, rows: part.length, conflict: TITLE_KEY, update: TITLE_UPDATE }), ...values);
  }
}

/** Écrit tout ce qui attend. Ne rejette jamais : un index qui ne s'écrit pas reste un index qui cherche. */
export async function flushTitles(db: VigieDb): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (pending.length === 0) return;
  const batch = pending;
  pending = [];
  try {
    await writeBatch(db, batch);
  } catch (err) {
    console.warn(`[Vigie] Index de recherche non enregistré : ${err instanceof Error ? err.message : err}`);
  }
}

/** Met des titres de côté pour la prochaine écriture groupée. */
export function queueTitles(db: VigieDb, records: TitleRecord[]): void {
  pending.push(...records);
  if (pending.length >= FLUSH_AT) { void flushTitles(db); return; }
  if (!flushTimer) flushTimer = setTimeout(() => { void flushTitles(db); }, FLUSH_EVERY_MS);
}

export async function readMeta(db: VigieDb, key: string): Promise<string | null> {
  const rows = await db.query<{ meta_value: string }>(
    `SELECT meta_value FROM seer_search_meta WHERE meta_key = ?`, key,
  );
  return rows[0]?.meta_value ?? null;
}

export async function writeMeta(db: VigieDb, key: string, value: string): Promise<void> {
  await db.execute(
    db.sql.upsert({
      table: "seer_search_meta", columns: ["meta_key", "meta_value", "updated_at"],
      conflict: ["meta_key"], update: ["meta_value", "updated_at"],
    }),
    key, value.slice(0, 500), db.sql.dateParam(new Date()),
  );
}

/** Une liste de blocage a changé : tout ce qui a été appris avant peut être interdit. */
export async function clearTitles(db: VigieDb): Promise<void> {
  pending = [];
  await db.execute(`DELETE FROM seer_search_titles`);
}
