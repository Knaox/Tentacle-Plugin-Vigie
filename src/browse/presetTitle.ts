/* ------------------------------------------------------------------ */
/*  Vigie — Le titre d'un parcours suit ce qu'il montre                */
/* ------------------------------------------------------------------ */

/*
 * « Films populaires », puis « Séries » dans le sélecteur de type : la grille
 * montrait des séries sous le titre « Films populaires ». Le titre se calcule
 * donc à partir de la nature du parcours ET du type affiché — et d'un genre
 * resté actif, que l'on nomme dans le dictionnaire du type courant.
 *
 * Les genres TMDB ne sont pas les mêmes pour les films et les séries : changer
 * de type garde le genre quand il a un équivalent (Comédie → Comédie, Action →
 * Action & Aventure), et le retire seulement quand il n'en a pas (Horreur).
 */

import type { DiscoverFilters, DiscoverMediaType } from "../api/types";
import type { BrowsePreset } from "../hub/HubContext";
import { MOVIE_GENRES, TV_GENRES } from "../constants/genres";

type Translate = (key: string, opts?: Record<string, unknown>) => string;

const MOVIE_TO_TV: Record<number, number> = {
  28: 10759, 12: 10759, 16: 16, 35: 35, 80: 80, 99: 99, 18: 18, 10751: 10751,
  14: 10765, 878: 10765, 9648: 9648, 10752: 10768, 37: 37,
};

const TV_TO_MOVIE: Record<number, number> = {
  10759: 28, 16: 16, 35: 35, 80: 80, 99: 99, 18: 18, 10751: 10751, 10762: 10751,
  10765: 878, 9648: 9648, 10768: 10752, 37: 37,
};

const isMovies = (type: DiscoverMediaType) => type === "movies";

/** Les genres retenus, traduits dans le dictionnaire de l'autre type. */
export function mapGenres(genres: readonly number[], from: DiscoverMediaType, to: DiscoverMediaType): number[] {
  if (isMovies(from) === isMovies(to)) return [...genres];
  const table = isMovies(from) ? MOVIE_TO_TV : TV_TO_MOVIE;
  return [...new Set(genres.map((g) => table[g]).filter((g): g is number => g !== undefined))];
}

function genreName(id: number, type: DiscoverMediaType, t: Translate): string | null {
  const genre = (isMovies(type) ? MOVIE_GENRES : TV_GENRES).find((g) => g.id === id);
  return genre ? t(`seer:${genre.key}`) : null;
}

export function presetTitle(
  preset: BrowsePreset,
  mediaType: DiscoverMediaType,
  filters: Pick<DiscoverFilters, "genres">,
  t: Translate,
): string {
  const type = t(`seer:type_${mediaType}`);
  switch (preset.kind) {
    case "trending":
      return t("seer:railTrending");
    case "popular":
      return t(`seer:titlePopular_${mediaType}`);
    case "top":
      return t(`seer:titleTop_${mediaType}`);
    case "upcoming":
      return t(`seer:titleUpcoming_${mediaType}`);
    case "genre": {
      const name = filters.genres.length > 0 ? genreName(filters.genres[0], mediaType, t) : null;
      return name ? `${name} · ${type}` : t(`seer:titleAll_${mediaType}`);
    }
    case "provider":
      return preset.label ? `${preset.label} · ${type}` : t(`seer:titleAll_${mediaType}`);
    case "all":
      return t(`seer:titleAll_${mediaType}`);
    default:
      return preset.title;
  }
}
