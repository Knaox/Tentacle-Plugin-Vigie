/* ------------------------------------------------------------------ */
/*  Vigie — Ce que la recherche renvoie                                */
/* ------------------------------------------------------------------ */

/*
 * Deux publics, deux formes :
 *
 *   - le catalogue de Vigie reçoit des fiches au format Jellyseerr (`title` /
 *     `name`, `posterPath`, `mediaInfo.status`…) — les cartes du plugin les
 *     affichent telles quelles ;
 *   - la recherche de Tentacle (barre globale, bibliothèques) reçoit le
 *     contrat GÉNÉRIQUE des extensions de recherche : un titre, une image, un
 *     lien, une pastille. Elle ne sait rien de Jellyseerr, et c'est voulu.
 */

import { MEDIA_STATUS } from "./status-map";
import type { Facet } from "./facets";

export interface Candidate {
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  names: string[];
  releaseDate: string | null;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genreIds: number[];
  originalLanguage: string | null;
  isAnime: boolean;
  /** Statut lu dans la réponse TMDB, quand il y en a une. */
  remoteStatus: number | undefined;
  /** Rang dans la réponse TMDB ; `null` pour un titre venu de l'index seul. */
  remoteRank: number | null;
  /** Correspondance du texte (0 à 1000) avec la requête — tapée ou corrigée. */
  text: number;
  score: number;
}

export interface PersonCandidate {
  id: number;
  name: string;
  profilePath: string | null;
  popularity: number;
  department: string | null;
  knownFor: Candidate[];
  score: number;
}

/** Une fiche au format des cartes du plugin (celui de Jellyseerr). */
export interface SearchItem {
  id: number;
  mediaType: "movie" | "tv";
  title?: string;
  name?: string;
  originalTitle?: string;
  originalName?: string;
  releaseDate?: string;
  firstAirDate?: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  genreIds?: number[];
  originalLanguage?: string;
  mediaInfo?: { status: number };
}

export interface SearchPerson {
  id: number;
  mediaType: "person";
  name: string;
  profilePath?: string;
  knownForDepartment?: string;
  popularity: number;
  knownFor: SearchItem[];
}

export interface HubSearchResponse {
  query: string;
  /** Ce qui a réellement été cherché (fautes corrigées, année et type retirés). */
  searched: string;
  correction: string | null;
  year: number | null;
  type: "movie" | "tv" | null;
  /** Faux : réponse de l'index seul — la réponse complète suit. */
  complete: boolean;
  top: { kind: "media"; item: SearchItem } | { kind: "person"; person: SearchPerson } | null;
  movies: SearchItem[];
  series: SearchItem[];
  people: SearchPerson[];
  facets: Facet[];
  page: number;
  hasMore: boolean;
  blockedCount: number;
  blockedActive: boolean;
  /** Vrai tant que l'index local se construit — les résultats instantanés sont alors partiels. */
  indexing: boolean;
  tookMs: number;
}

export function toSearchItem(c: Candidate, status: number | undefined): SearchItem {
  const movie = c.mediaType === "movie";
  const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);
  return {
    id: c.tmdbId,
    mediaType: c.mediaType,
    ...(movie
      ? { title: c.title, originalTitle: opt(c.originalTitle), releaseDate: opt(c.releaseDate) }
      : { name: c.title, originalName: opt(c.originalTitle), firstAirDate: opt(c.releaseDate) }),
    posterPath: opt(c.posterPath),
    backdropPath: opt(c.backdropPath),
    overview: opt(c.overview),
    voteAverage: c.voteAverage || undefined,
    voteCount: c.voteCount || undefined,
    popularity: c.popularity || undefined,
    genreIds: c.genreIds,
    originalLanguage: opt(c.originalLanguage),
    ...(status !== undefined ? { mediaInfo: { status } } : {}),
  };
}

/* ── Le contrat générique de la recherche de Tentacle ─────────────── */

export interface ProviderItem {
  id: string;
  kind: "movie" | "series";
  title: string;
  year: number | null;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
  badge: { label: string; tone: "neutral" | "info" | "success" | "warning" } | null;
}

export interface ProviderResponse {
  query: string;
  correction: string | null;
  complete: boolean;
  items: ProviderItem[];
  moreHref: string | null;
}

const LABELS = {
  fr: { movie: "Film", series: "Série", requested: "Demandé", processing: "En cours", release: "sortie le" },
  en: { movie: "Movie", series: "Series", requested: "Requested", processing: "In progress", release: "out" },
};

/** Déjà dans la bibliothèque, ou bloqué : rien à proposer hors bibliothèque. */
export function inLibraryOrBlocked(status: number | undefined): boolean {
  return status === MEDIA_STATUS.PARTIALLY_AVAILABLE
    || status === MEDIA_STATUS.AVAILABLE
    || status === MEDIA_STATUS.BLOCKLISTED;
}

function shortDate(iso: string, lang: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}

export function toProviderItem(c: Candidate, status: number | undefined, lang: string, today: string): ProviderItem {
  const l = lang === "fr" ? LABELS.fr : LABELS.en;
  const kind = c.mediaType === "movie" ? "movie" : "series";
  const upcoming = c.releaseDate !== null && c.releaseDate > today;
  const kindLabel = kind === "movie" ? l.movie : l.series;
  const subtitle = upcoming && c.releaseDate
    ? `${kindLabel} · ${l.release} ${shortDate(c.releaseDate, lang)}`
    : c.year !== null ? `${kindLabel} · ${c.year}` : kindLabel;
  const badge = status === MEDIA_STATUS.PENDING
    ? { label: l.requested, tone: "info" as const }
    : status === MEDIA_STATUS.PROCESSING
      ? { label: l.processing, tone: "warning" as const }
      : null;
  return {
    id: c.key,
    kind,
    title: c.title,
    year: c.year,
    subtitle,
    imageUrl: c.posterPath ? `https://image.tmdb.org/t/p/w185${c.posterPath}` : null,
    href: `/discover?media=${c.mediaType}:${c.tmdbId}`,
    badge,
  };
}
