/* ------------------------------------------------------------------ */
/*  Vigie — Où en est une saison, et chacun de ses épisodes             */
/* ------------------------------------------------------------------ */

/*
 * Jellyseerr ne connaît que la saison ; Sonarr, chaque épisode. Quand Sonarr
 * suit la série, la saison se résume depuis ses épisodes — « En partie » pour
 * une saison en cours de diffusion dont 18 épisodes sur 25 sont là — ; sinon,
 * on s'en tient au statut de la saison chez Jellyseerr.
 */

import type { SeriesEpisodeStates } from "../api/types-releases";
import { isRequestedSeasonStatus } from "./media-status";
import type { TitleStatus } from "./title-state";

/** Le statut Jellyseerr d'une saison, dans les mots communs. */
export function lockStatus(status: number | undefined): TitleStatus | null {
  if (status === 5) return { state: "available", percent: null };
  if (status === 4) return { state: "partial", percent: null };
  return isRequestedSeasonStatus(status) ? { state: "requested", percent: null } : null;
}

/**
 * TMDB et Sonarr découpent-ils la série pareil ? Un animé tient souvent en une
 * saison de 66 épisodes chez l'un et en quatre saisons chez l'autre : leurs
 * numéros « S1E60 » et « S4E18 » désignent alors le même épisode.
 */
export function numberingMatches(eps: SeriesEpisodeStates | undefined, tmdbSeasons: number): boolean {
  return !eps?.seasons || eps.seasons.length === 0 || eps.seasons.length === tmdbSeasons;
}

/**
 * L'état d'un épisode ; `null` : personne ne l'a demandé. Numérotations qui
 * divergent : l'épisode de Sonarr diffusé le même jour fait foi.
 */
export function episodeStatus(
  eps: SeriesEpisodeStates | undefined, season: number, episode: number, airDate?: string, sameNumbering = true,
): TitleStatus | null {
  const key = sameNumbering ? `S${season}E${episode}` : airDate ? eps?.dates?.[airDate] : undefined;
  const state = key ? eps?.states[key] : undefined;
  if (!key || !state) return null;
  return { state, percent: state === "downloading" ? eps?.percents[key] ?? null : null };
}

export function seasonStatus(
  season: number,
  episodeCount: number,
  lock: number | undefined,
  eps: SeriesEpisodeStates | undefined,
  sameNumbering = true,
): TitleStatus | null {
  const prefix = `S${season}E`;
  // Numérotations qui divergent : les saisons de Sonarr ne sont pas celles-ci.
  const states = eps?.tracked && sameNumbering
    ? Object.entries(eps.states).filter(([key]) => key.startsWith(prefix)).map(([key, state]) => ({ key, state }))
    : [];
  if (states.length === 0) return lockStatus(lock);

  if (states.some((s) => s.state === "stalled")) return { state: "stalled", percent: null };
  const moving = states.filter((s) => s.state === "downloading");
  if (moving.length > 0) {
    const measured = moving.map((s) => eps?.percents[s.key]).filter((p): p is number => typeof p === "number");
    const percent = measured.length > 0 ? measured.reduce((a, b) => a + b, 0) / measured.length : null;
    return { state: "downloading", percent };
  }
  const here = states.filter((s) => s.state === "available").length;
  if (here > 0 && here >= episodeCount) return { state: "available", percent: null };
  if (here > 0) return { state: "partial", percent: null };
  return { state: "requested", percent: null };
}

/**
 * TMDB numérote parfois le prochain épisode d'un animé en absolu — « S1E84 »
 * — quand ses saisons, elles, le découpent : c'est l'épisode 18 de la
 * saison 4. On le replace dans sa saison, d'après le nombre d'épisodes de
 * chacune ; un numéro qui tient dans sa saison reste tel quel.
 */
export function placeEpisode(
  season: number,
  episode: number,
  seasons: ReadonlyArray<{ seasonNumber: number; episodeCount: number }>,
): { season: number; episode: number } {
  const regular = seasons.filter((s) => s.seasonNumber > 0).sort((a, b) => a.seasonNumber - b.seasonNumber);
  const own = regular.find((s) => s.seasonNumber === season);
  if (!own || episode <= own.episodeCount) return { season, episode };
  let left = episode;
  for (const s of regular) {
    if (s.seasonNumber < season) continue;
    if (left <= s.episodeCount) return { season: s.seasonNumber, episode: left };
    left -= s.episodeCount;
  }
  return { season, episode };
}
