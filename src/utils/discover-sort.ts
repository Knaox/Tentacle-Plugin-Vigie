/* ------------------------------------------------------------------ */
/*  Vigie — Le tri d'une page Découvrir, tel que Jellyseerr l'attend   */
/* ------------------------------------------------------------------ */

/*
 * Les champs de tri de TMDB ne sont pas les mêmes pour les films et les
 * séries : une série n'a pas d'`original_title` mais un `original_name`.
 * Envoyé à `/discover/tv`, `original_title` était ignoré en silence — mesuré
 * sur Jellyseerr 3.4.1, l'ordre restait celui de la popularité — et Seerr 3.5
 * le rejette de sa liste (TvSortOptionsIterable) avec le même effet. Le tri
 * « par titre » des séries et des animés n'a donc jamais trié.
 */

import type { SortOption, SortOrder } from "../api/types";

export function discoverSortBy(seerrType: "movies" | "tv", sortBy: SortOption, order: SortOrder): string {
  const movies = seerrType === "movies";
  const field = sortBy === "release_date" ? (movies ? "primary_release_date" : "first_air_date")
    : sortBy === "title" ? (movies ? "original_title" : "original_name")
      : sortBy;
  return `${field}.${order}`;
}
