/* ------------------------------------------------------------------ */
/*  Vigie — Ce que le retrait d'une demande consommée ne touche jamais  */
/* ------------------------------------------------------------------ */

/*
 * Le retrait d'une demande d'avant la suppression (action `forget` de la
 * file de nettoyage) peut passer tard : un nouvel essai après une panne, une
 * redemande faite entre-temps dans Jellyseerr. D'ici là, quelqu'un a pu
 * redemander le titre — Sonarr surveille de nouveau la saison, elle est
 * peut-être déjà revenue. Le retrait n'y touche pas : ni surveillance, ni
 * file, ni demande. Lu au moment d'agir, dans ce que Vigie sait déjà
 * (départs, index des demandes) : aucune requête de plus.
 */

import { liveState } from "./live-state";
import { requestIndex } from "./request-index";
import { isLiveRequest, madeBefore, requestTime } from "./title-truth";
import type { Departure } from "./library-keys";

/** Les départs et les demandes sont lus : le garde peut répondre (sinon, le retrait attend). */
export function forgetGuardReady(): boolean {
  return liveState.libraryReadable && requestIndex.ready;
}

function departureOf(mediaType: "movie" | "tv", tmdbId: number): Departure | undefined {
  return liveState.departures().find((d) => d.mediaType === mediaType && d.tmdbId === tmdbId);
}

/** Née APRÈS le départ de cette saison (ou du titre) : une redemande. */
function after(createdAt: number | string | null | undefined, at: number): boolean {
  return requestTime(createdAt) !== null && !madeBefore(createdAt, at);
}

/**
 * Une demande Jellyseerr est-elle une redemande de ce qui est parti ? Celles
 * qu'on ne retire ni ne réduit jamais.
 */
export function isRerequest(
  r: { createdAt?: number | string | null; seasons?: readonly number[] },
  mediaType: "movie" | "tv",
  tmdbId: number,
): boolean {
  const dep = departureOf(mediaType, tmdbId);
  if (!dep) return false;
  if (mediaType === "movie" || !r.seasons || r.seasons.length === 0) return after(r.createdAt, dep.at);
  return r.seasons.some((s) => dep.seasons.includes(s) && after(r.createdAt, dep.seasonAt?.get(s) ?? dep.at));
}

/**
 * Parmi ces saisons, celles à laisser : revenues dans Jellyfin, ou attendues
 * par une autre demande vivante faite après leur départ.
 */
export function sparedSeasons(tmdbId: number, seasons: readonly number[], exceptSeerrId: number | null): Set<number> {
  const dep = departureOf("tv", tmdbId);
  const spared = new Set<number>();
  for (const s of seasons) if (!dep || !dep.seasons.includes(s)) spared.add(s);
  if (!dep) return spared;
  for (const r of requestIndex.requestsFor("tv", tmdbId) ?? []) {
    if (r.id === exceptSeerrId || !isLiveRequest(r)) continue;
    for (const s of seasons) {
      const covers = r.seasons.length === 0 || r.seasons.includes(s);
      if (covers && after(r.createdAt, dep.seasonAt?.get(s) ?? dep.at)) spared.add(s);
    }
  }
  return spared;
}

/**
 * La série part-elle en entier (réglage) ? Seulement si plus rien d'elle
 * n'est dans Jellyfin et que personne ne l'a redemandée depuis.
 */
export function wholeSeriesStillGone(tmdbId: number, exceptSeerrId: number | null): boolean {
  const dep = departureOf("tv", tmdbId);
  if (!dep || !dep.whole) return false;
  return !(requestIndex.requestsFor("tv", tmdbId) ?? [])
    .some((r) => r.id !== exceptSeerrId && isLiveRequest(r) && after(r.createdAt, dep.at));
}

/** Les saisons parties d'une série — celles qu'un retrait « toute la série » vise. */
export function departedSeasonsOf(tmdbId: number): number[] {
  return departureOf("tv", tmdbId)?.seasons ?? [];
}

/** Le film est-il revenu dans Jellyfin (plus de départ connu) ? */
export function movieBack(tmdbId: number): boolean {
  return liveState.libraryReadable && !departureOf("movie", tmdbId);
}
