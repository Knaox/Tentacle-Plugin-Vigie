/* ------------------------------------------------------------------ */
/*  Vigie — Les marques d'un titre, assemblées (pur)                   */
/* ------------------------------------------------------------------ */

/*
 * Les marques que rend le serveur (`/marks`), précisées par deux listes de
 * Tentacle : les notes du compte et les titres mis de côté jusqu'à leur
 * arrivée. Pur, pour les tests : UserMarks.tsx le branche sur les requêtes.
 */

import type { CoreRating } from "../hooks/useTitleGestures";

/* Mêmes bits que le serveur (server/user-marks.ts). */
const LIBRARY = 1;
const WATCHED = 2;
const WATCHLIST = 4;
const LIKED = 8;

export interface TitleMarks {
  library: boolean;
  watched: boolean;
  watchlist: boolean;
  liked: boolean;
  /** Sa note, 1..10 (une demi-étoile par point) ; `null` : pas notée. */
  score: number | null;
  /** Mis de côté : il entrera dans « Ma liste » dès son arrivée. */
  pending: boolean;
}

export type MarkEntry = ["movie" | "tv", number, number, number];

export function toMarks(bits: number, score: number): TitleMarks {
  return {
    library: (bits & LIBRARY) !== 0,
    watched: (bits & WATCHED) !== 0,
    watchlist: (bits & WATCHLIST) !== 0,
    liked: (bits & LIKED) !== 0,
    score: score >= 1 && score <= 10 ? score : null,
    pending: false,
  };
}

const EMPTY: TitleMarks = { library: false, watched: false, watchlist: false, liked: false, score: null, pending: false };

/** Les notes d'un TITRE (ni saison ni épisode), par clé « movie:603 » / « tv:1399 ». */
export function titleScores(entries: readonly CoreRating[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const r of entries) {
    if (r.seasonNumber !== 0 || r.episodeNumber !== 0 || r.score < 1 || r.score > 10) continue;
    if (r.mediaType === "movie") scores.set(`movie:${r.tmdbId}`, r.score);
    else if (r.mediaType === "series") scores.set(`tv:${r.tmdbId}`, r.score);
  }
  return scores;
}

/**
 * Les marques du serveur, précisées par les listes de Tentacle quand elles
 * sont là : leur note remplace celle du serveur (qui date d'une minute au
 * plus), et un titre mis de côté porte sa marque.
 */
export function mergeMarks(
  entries: readonly MarkEntry[],
  ratings: readonly CoreRating[] | null | undefined,
  pending: readonly string[] | null | undefined,
): Map<string, TitleMarks> {
  const map = new Map<string, TitleMarks>();
  for (const [type, id, bits, score] of entries) map.set(`${type}:${id}`, toMarks(bits, score));
  if (ratings) {
    const scores = titleScores(ratings);
    for (const [key, marks] of map) map.set(key, { ...marks, score: scores.get(key) ?? null });
    for (const [key, score] of scores) if (!map.has(key)) map.set(key, { ...EMPTY, score });
  }
  for (const key of pending ?? []) map.set(key, { ...(map.get(key) ?? EMPTY), pending: true });
  return map;
}
