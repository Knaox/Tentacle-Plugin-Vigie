/* ------------------------------------------------------------------ */
/*  Vigie — Les saisons qu'on peut choisir                             */
/* ------------------------------------------------------------------ */

/*
 * Les saisons numérotées, et la saison 0 — les épisodes spéciaux — quand
 * Jellyseerr la laisse demander. Elle vient EN DERNIER : TMDB la range en
 * tête, mais on cherche d'abord « Saison 1 », comme dans la bibliothèque.
 * Une saison 0 sans épisode n'a rien à demander.
 */

interface SeasonLike {
  seasonNumber: number;
  episodeCount?: number;
}

export function requestableSeasons<T extends SeasonLike>(seasons: readonly T[], specials: boolean): T[] {
  const regular = seasons.filter((s) => s.seasonNumber > 0);
  if (!specials) return regular;
  return [...regular, ...seasons.filter((s) => s.seasonNumber === 0 && (s.episodeCount ?? 0) > 0)];
}
