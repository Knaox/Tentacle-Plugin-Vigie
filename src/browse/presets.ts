/* ------------------------------------------------------------------ */
/*  Vigie — Les parcours du catalogue                                  */
/* ------------------------------------------------------------------ */

/*
 * Chaque « Tout voir » ouvre le même écran — la grille du catalogue — avec un
 * préréglage : un tri, un type, un genre, une plateforme. Les définir ici
 * garde les rangées de l'accueil et les pastilles de la recherche d'accord
 * sur ce qu'elles montrent.
 */

import type { BrowsePreset } from "../hub/HubContext";
import { DEFAULT_FILTERS } from "../hooks/useDiscoverFilters";

type Translate = (key: string, opts?: Record<string, unknown>) => string;

export const ANIME_KEYWORD = 210024;

export function trendingPreset(t: Translate): BrowsePreset {
  return { id: "trending", kind: "trending", title: t("seer:railTrending"), mediaType: "movies", source: "trending" };
}

export function popularPreset(t: Translate, mediaType: "movies" | "tv" | "anime"): BrowsePreset {
  const title = mediaType === "movies" ? t("seer:railPopularMovies")
    : mediaType === "tv" ? t("seer:railPopularSeries") : t("seer:railPopularAnime");
  return { id: `popular:${mediaType}`, kind: "popular", title, mediaType, filters: { sortBy: "popularity", sortOrder: "desc" } };
}

export function topRatedPreset(t: Translate, mediaType: "movies" | "tv"): BrowsePreset {
  return {
    id: `top:${mediaType}`,
    kind: "top",
    title: mediaType === "movies" ? t("seer:railTopMovies") : t("seer:railTopSeries"),
    mediaType,
    filters: { sortBy: "vote_average", sortOrder: "desc", ratingMin: 7 },
  };
}

export function upcomingPreset(t: Translate, mediaType: "movies" | "tv"): BrowsePreset {
  return {
    id: `upcoming:${mediaType}`,
    kind: "upcoming",
    title: mediaType === "movies" ? t("seer:railUpcomingMovies") : t("seer:railUpcomingSeries"),
    mediaType,
    upcoming: true,
    filters: { sortBy: "popularity", sortOrder: "desc" },
  };
}

export function genrePreset(id: number, mediaType: "movie" | "tv", label: string): BrowsePreset {
  return {
    id: `genre:${mediaType}:${id}`,
    kind: "genre",
    title: label,
    mediaType: mediaType === "movie" ? "movies" : "tv",
    filters: { genres: [id], sortBy: "popularity", sortOrder: "desc" },
  };
}

export function providerPreset(id: number, label: string, mediaType: "movies" | "tv" = "movies"): BrowsePreset {
  return {
    id: `provider:${mediaType}:${id}`,
    kind: "provider",
    label,
    title: label,
    mediaType,
    filters: { watchProviders: [id], sortBy: "popularity", sortOrder: "desc" },
  };
}

/** Le catalogue entier, sans préréglage. */
export function catalogPreset(t: Translate, mediaType: "movies" | "tv" | "anime" = "movies"): BrowsePreset {
  return { id: `all:${mediaType}`, kind: "all", title: t("seer:browseAll"), mediaType, filters: { ...DEFAULT_FILTERS } };
}
