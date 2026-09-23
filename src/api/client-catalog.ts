/* ------------------------------------------------------------------ */
/*  Vigie API — catalogue (recherche, découverte, fiches)              */
/* ------------------------------------------------------------------ */

/* Extrait de seer-client.ts pour tenir sous 300 lignes. Tous ces appels
 * passent par le proxy Jellyseerr du plugin : la clé d'API reste au serveur. */

import { proxyFetch } from "./endpoints";
import { getCurrentLanguage, langParam } from "../utils/media-helpers";
import type {
  DiscoverFilters, DiscoverMediaType, SeerrPagedResponse,
  SeerrMovieDetail, SeerrTvDetail,
} from "./types";

function getWatchRegion(): string {
  const lang = getCurrentLanguage();
  const map: Record<string, string> = { fr: "FR", en: "US", de: "DE", es: "ES", it: "IT", pt: "BR", ja: "JP" };
  return map[lang] ?? "US";
}

/* ── Search (Seerr proxy) ────────────────────────────────────────── */

export async function searchMedia(
  query: string,
  page = 1,
  showBlocked = false,
): Promise<SeerrPagedResponse> {
  const sb = showBlocked ? "&_showBlocked=1" : "";
  return proxyFetch(`/api/v1/search?query=${encodeURIComponent(query)}&page=${page}${sb}`);
}

/* ── Discover (Seerr proxy) ──────────────────────────────────────── */

/**
 * Build discover URL params matching Seerr's exact API contract.
 *
 * IMPORTANT: We do NOT send `language` as a query param because Seerr's
 * backend maps it to BOTH display language AND `originalLanguage` filter
 * on TMDB. Sending language=fr would filter for French-original content
 * only, hiding all Japanese anime, English movies, etc.
 *
 * Display language is handled via the Accept-Language header in proxyFetch.
 * Original language filter is only sent when the user explicitly sets it.
 */
export async function discoverMedia(
  mediaType: DiscoverMediaType,
  page: number,
  filters: DiscoverFilters,
  showBlocked = false,
  /** Seulement ce qui sort à partir de cette date ('YYYY-MM-DD') — « À venir ». */
  releasedFrom?: string,
): Promise<SeerrPagedResponse> {
  // Anime utilise l'endpoint TV avec le keyword TMDB "anime" (210024)
  const seerrType = mediaType === "anime" ? "tv" : mediaType;

  // Build params exactly like Seerr frontend does (key=value pairs)
  const params: Record<string, string> = {};
  params.page = String(page);

  // Sort — Seerr sends the full "field.order" string as sortBy
  const sortField = (() => {
    if (filters.sortBy === "release_date") {
      return seerrType === "movies" ? "primary_release_date" : "first_air_date";
    }
    if (filters.sortBy === "title") return "original_title";
    return filters.sortBy;
  })();
  params.sortBy = `${sortField}.${filters.sortOrder}`;

  // Genres — comma separated
  if (filters.genres.length > 0) {
    params.genre = filters.genres.join(",");
  }

  // Watch providers — pipe separated, with region
  if (filters.watchProviders.length > 0) {
    params.watchProviders = filters.watchProviders.join("|");
    params.watchRegion = getWatchRegion();
  }

  // Year range — date strings
  if (filters.yearFrom != null) {
    const key = seerrType === "movies" ? "primaryReleaseDateGte" : "firstAirDateGte";
    params[key] = `${filters.yearFrom}-01-01`;
  }
  if (filters.yearTo != null) {
    const key = seerrType === "movies" ? "primaryReleaseDateLte" : "firstAirDateLte";
    params[key] = `${filters.yearTo}-12-31`;
  }

  // « À venir » : prime sur l'année de début, qui n'a plus de sens.
  if (releasedFrom) {
    const key = seerrType === "movies" ? "primaryReleaseDateGte" : "firstAirDateGte";
    params[key] = releasedFrom;
  }

  // Rating minimum
  if (filters.ratingMin != null) {
    params.voteAverageGte = String(filters.ratingMin);
    params.voteCountGte = "50";
  }

  // Original language
  if (filters.originalLanguage) {
    params.language = filters.originalLanguage;
  }

  // TV status
  if (seerrType === "tv" && filters.tvStatus.length > 0) {
    params.status = String(filters.tvStatus[0]);
  }

  // Keyword anime
  if (mediaType === "anime") {
    params.keywords = "210024";
  }

  // Bouton « Afficher quand même » : désactive le blocage par tags côté proxy.
  if (showBlocked) {
    params._showBlocked = "1";
  }

  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const endpoint = seerrType === "movies" ? "movies" : "tv";
  return proxyFetch(`/api/v1/discover/${endpoint}?${qs}`);
}

/** Fetch trending for HeroCarousel */
export async function discoverTrending(page = 1, showBlocked = false): Promise<SeerrPagedResponse> {
  const sb = showBlocked ? "&_showBlocked=1" : "";
  return proxyFetch(`/api/v1/discover/trending?page=${page}${sb}`);
}

/* ── Media details (Seerr proxy) ─────────────────────────────────── */

export async function getMovieDetail(id: number): Promise<SeerrMovieDetail> {
  return proxyFetch(`/api/v1/movie/${id}?${langParam()}`);
}

export async function getTvDetail(id: number): Promise<SeerrTvDetail> {
  return proxyFetch(`/api/v1/tv/${id}?${langParam()}`);
}
