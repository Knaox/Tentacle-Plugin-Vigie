/* ------------------------------------------------------------------ */
/*  Seer Plugin — Mémoire durable des fiches TMDB (table SQL)          */
/* ------------------------------------------------------------------ */

/*
 * Pourquoi une table et pas seulement le cache mémoire :
 *
 * `GET /api/v1/request` ne renvoie ni titre, ni affiche, ni résumé — seulement
 * des identifiants. Il fallait donc un `GET /api/v1/{type}/{tmdbId}` par
 * demande, soit ~430 appels par chargement de la liste sur cette instance, et
 * autant à refaire après chaque redémarrage du serveur.
 *
 * Une fiche TMDB ne bouge quasiment jamais. On la garde donc en base, avec un
 * TTL adaptatif (cf. tmdb-fetch.ts) : une série terminée est valable 30 jours,
 * un film qui sort la semaine prochaine 12 heures.
 *
 * La même table sert aux trois chantiers : liste des demandes (titres/affiches),
 * disponibilité réelle (dates de sortie typées) et calendrier (prochain épisode).
 */

import type { VigieDb } from "./storage/vigie-db";
import { chunk } from "./concurrency";
import { readStoredDate } from "./db-helpers";


export interface TmdbRef {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

export interface TmdbMeta extends TmdbRef {
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  /** `releaseDate` (film) ou `firstAirDate` (série), toujours 'YYYY-MM-DD'. */
  releaseDate: string | null;
  /** Statut TMDB brut : Released, Post Production, Returning Series, Ended… */
  tmdbStatus: string | null;

  /* Dates de sortie typées (films) — cf. pickReleaseDates. */
  digitalDate: string | null;
  theatricalDate: string | null;
  physicalDate: string | null;
  releaseRegion: string | null;

  /* Séries. */
  nextAirDate: string | null;
  nextSeason: number | null;
  nextEpisode: number | null;
  lastAirDate: string | null;

  networks: string | null;
  providerIds: number[];

  /* Ce qu'il faut pour trier et filtrer un agenda. Tous FACULTATIFS : une fiche
   * enregistrée avant l'ajout de ces colonnes n'en a aucun, et un critère
   * inconnu ne doit jamais exclure — sans quoi les filtres videraient la page
   * en attendant que le worker ait tout repassé. */
  voteAverage?: number | null;
  popularity?: number | null;
  originalLanguage?: string | null;
  genreIds?: number[];
  isAnime?: boolean;

  expiresAt: string;
}

/** Clé canonique de Map — « movie:603 ». */
export function tmdbKey(ref: TmdbRef): string {
  return `${ref.mediaType}:${ref.tmdbId}`;
}

/** Les dates sont manipulées en 'YYYY-MM-DD' : `new Date(str)` décalerait d'un jour. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asDate(v: unknown): string | null {
  if (typeof v === "string" && DATE_RE.test(v)) return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}

function asNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Comme `asNum`, mais un NULL reste un NULL.
 *
 * `Number(null)` vaut zéro, et `Number.isFinite(0)` est vrai : `asNum` rend donc
 * 0 pour une colonne vide. Inoffensif pour un numéro de saison, où une date
 * garde la porte — mais une note à zéro fausserait aussi bien le filtre
 * « 7 et plus » que le tri, et rien ne le signalerait.
 */
function asNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Liste d'entiers séparés par des virgules, comme `provider_ids`. */
function asIdList(v: unknown): number[] {
  return String(v ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function rowToMeta(row: Record<string, unknown>): TmdbMeta {
  const ids = asIdList(row.provider_ids);
  return {
    mediaType: row.media_type === "tv" ? "tv" : "movie",
    tmdbId: Number(row.tmdb_id),
    title: String(row.title ?? ""),
    posterPath: (row.poster_path as string) ?? null,
    backdropPath: (row.backdrop_path as string) ?? null,
    overview: (row.overview as string) ?? null,
    releaseDate: asDate(row.release_date),
    tmdbStatus: (row.tmdb_status as string) ?? null,
    digitalDate: asDate(row.digital_date),
    theatricalDate: asDate(row.theatrical_date),
    physicalDate: asDate(row.physical_date),
    releaseRegion: (row.release_region as string) ?? null,
    nextAirDate: asDate(row.next_air_date),
    nextSeason: asNum(row.next_season),
    nextEpisode: asNum(row.next_episode),
    lastAirDate: asDate(row.last_air_date),
    networks: (row.networks as string) ?? null,
    providerIds: ids,
    voteAverage: asNumOrNull(row.vote_average),
    popularity: asNumOrNull(row.popularity),
    originalLanguage: (row.original_language as string) || null,
    genreIds: asIdList(row.genre_ids),
    isAnime: row.is_anime === 1 || row.is_anime === true,
    // Millisecondes entières, ou `Date` quand Prisma relit la colonne DATETIME.
    expiresAt: readStoredDate(row.expires_at)?.toISOString() ?? "",
  };
}

/**
 * Lecture groupée. `includeExpired` : true pour l'AFFICHAGE (mieux vaut un
 * titre un peu vieux qu'un « #1972 »), false pour décider quoi rafraîchir.
 *
 * Le filtre est découpé par type plutôt qu'en `WHERE (media_type, tmdb_id) IN
 * ((?,?),…)` : le row-constructor n'attaque pas la clé primaire en range scan
 * sur toutes les versions de MariaDB.
 */
export async function getTmdbMetaBulk(
  db: VigieDb,
  refs: readonly TmdbRef[],
  includeExpired = true,
): Promise<Map<string, TmdbMeta>> {
  const out = new Map<string, TmdbMeta>();
  if (refs.length === 0) return out;

  const byType: Record<"movie" | "tv", number[]> = { movie: [], tv: [] };
  for (const r of refs) {
    if (Number.isFinite(r.tmdbId) && r.tmdbId > 0) byType[r.mediaType].push(r.tmdbId);
  }

  const freshOnly = includeExpired ? "" : ` AND expires_at > ${db.sql.now()}`;

  for (const type of ["movie", "tv"] as const) {
    const ids = Array.from(new Set(byType[type]));
    for (const slice of chunk(ids, 500)) {
      if (slice.length === 0) continue;
      const placeholders = slice.map(() => "?").join(",");
      const rows = await db.query(
        `SELECT * FROM seer_tmdb_cache
         WHERE media_type = ? AND tmdb_id IN (${placeholders})${freshOnly}`,
        type,
        ...slice,
      );
      for (const row of rows) {
        const meta = rowToMeta(row);
        out.set(tmdbKey(meta), meta);
      }
    }
  }

  return out;
}

/*
 * L'ORDRE de cette liste est celui des valeurs poussées plus bas, et rien ne
 * vérifie la correspondance : un décalage d'un cran écrirait le résumé dans la
 * date de sortie sans que rien ne le signale — le code serveur n'a aucune
 * vérification de types. Toute colonne ajoutée ici doit l'être au même rang
 * dans `values.push`.
 */
const UPSERT_COLS = [
  "media_type", "tmdb_id", "title", "poster_path", "backdrop_path", "overview",
  "release_date", "tmdb_status", "digital_date", "theatrical_date", "physical_date",
  "release_region", "next_air_date", "next_season", "next_episode", "last_air_date",
  "networks", "provider_ids",
  "vote_average", "popularity", "original_language", "genre_ids", "is_anime",
  "expires_at",
];

function roundOrNull(n: number | null | undefined, digits: number): number | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Écriture groupée, par paquets de 100 : `fetched_at` posé à chaque écriture. */
export async function upsertTmdbMetaBulk(
  db: VigieDb,
  rows: readonly TmdbMeta[],
): Promise<void> {
  if (rows.length === 0) return;

  const columns = [...UPSERT_COLS, "fetched_at"];
  const update = columns.filter((c) => c !== "media_type" && c !== "tmdb_id");
  const fetchedAt = db.sql.dateParam(new Date());

  for (const slice of chunk(rows, 100)) {
    const values: unknown[] = [];
    for (const m of slice) {
      values.push(
        m.mediaType, m.tmdbId, m.title.slice(0, 500),
        m.posterPath, m.backdropPath, m.overview,
        m.releaseDate, m.tmdbStatus, m.digitalDate, m.theatricalDate, m.physicalDate,
        m.releaseRegion, m.nextAirDate, m.nextSeason, m.nextEpisode, m.lastAirDate,
        m.networks, m.providerIds.join(","),
        // Les arrondis que faisaient DECIMAL(3,1) et DECIMAL(8,3) sous MariaDB.
        roundOrNull(m.voteAverage, 1), roundOrNull(m.popularity, 3),
        m.originalLanguage ?? null, (m.genreIds ?? []).join(",") || null, m.isAnime ? 1 : 0,
        db.sql.dateParam(new Date(m.expiresAt)), fetchedAt,
      );
    }
    await db.execute(
      db.sql.upsert({ table: "seer_tmdb_cache", columns, rows: slice.length, conflict: ["media_type", "tmdb_id"], update }),
      ...values,
    );
  }
}

/**
 * Amorçage gratuit : les demandes passées par le plugin portent déjà titre,
 * affiche, résumé et année en base. `expires_at` = maintenant → affichable tout de
 * suite, mais considéré périmé, donc enrichi par le worker (dates de sortie).
 */
export async function seedTmdbCacheFromLocalRequests(db: VigieDb): Promise<number> {
  const affected = await db.execute(`
    ${db.sql.insertIgnore()} INTO seer_tmdb_cache
      (media_type, tmdb_id, title, poster_path, backdrop_path, overview, release_date, fetched_at, expires_at)
    SELECT r.media_type, r.tmdb_id,
           MAX(r.title), MAX(r.poster_path), MAX(r.backdrop_path), MAX(r.overview),
           NULL, ${db.sql.now()}, ${db.sql.now()}
    FROM seer_requests r
    WHERE r.tmdb_id > 0 AND r.title <> ''
    GROUP BY r.media_type, r.tmdb_id
  `);
  return Number(affected) || 0;
}

/** Fiches à rafraîchir en priorité (les plus anciennement expirées d'abord). */
export async function listStaleTmdbRefs(
  db: VigieDb,
  limit: number,
): Promise<TmdbRef[]> {
  const rows = await db.query<{ media_type: string; tmdb_id: number }>(
    `SELECT media_type, tmdb_id FROM seer_tmdb_cache
     WHERE expires_at <= ${db.sql.now()} ORDER BY expires_at ASC, tmdb_id ASC LIMIT ${Math.max(1, Math.floor(limit))}`,
  );
  return rows.map((r) => ({
    mediaType: r.media_type === "tv" ? "tv" : "movie",
    tmdbId: Number(r.tmdb_id),
  }));
}

/** Purge des fiches non rafraîchies depuis N jours (anti-gonflement). */
export async function pruneTmdbCache(
  db: VigieDb,
  olderThanDays: number,
): Promise<number> {
  const days = Math.max(1, Math.floor(olderThanDays));
  const n = await db.execute(`DELETE FROM seer_tmdb_cache WHERE fetched_at < ${db.sql.shiftedNow(-days, "day")}`);
  return Number(n) || 0;
}
