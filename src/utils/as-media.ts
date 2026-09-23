/* ------------------------------------------------------------------ */
/*  Vigie — Une demande, une sortie : la même fiche                    */
/* ------------------------------------------------------------------ */

/*
 * La fiche détaillée part d'un résultat de recherche. Une demande et une
 * sortie du calendrier en portent assez pour l'ouvrir (identifiant, type,
 * titre, images) : la fiche charge le reste elle-même.
 */

import type { LocalRequest, RequestStatus, SeerrSearchResult } from "../api/types";
import type { CalendarItem } from "../api/types-releases";

export function requestAsMedia(request: LocalRequest): SeerrSearchResult {
  const movie = request.mediaType === "movie";
  return {
    id: request.tmdbId,
    mediaType: request.mediaType,
    ...(movie ? { title: request.title } : { name: request.title }),
    posterPath: request.posterPath ?? undefined,
    backdropPath: request.backdropPath ?? undefined,
    overview: request.overview ?? undefined,
    ...(request.year ? (movie ? { releaseDate: `${request.year}-01-01` } : { firstAirDate: `${request.year}-01-01` }) : {}),
  };
}

/* Une sortie qui vient d'une demande dit où en est la demande, comme une affiche. */
const REQUEST_TO_MEDIA: Partial<Record<RequestStatus, number>> = {
  queued: 2, processing: 2, sent_to_seer: 2, retry_pending: 2,
  approved: 3, unavailable: 3, downloading: 3,
  partially_available: 4, available: 5,
};

export function calendarAsMedia(item: CalendarItem): SeerrSearchResult {
  const movie = item.mediaType === "movie";
  const status = item.requestStatus ? REQUEST_TO_MEDIA[item.requestStatus] : undefined;
  return {
    ...(status !== undefined ? { mediaInfo: { status } } : {}),
    id: item.tmdbId,
    mediaType: item.mediaType,
    ...(movie ? { title: item.title, releaseDate: item.date } : { name: item.title, firstAirDate: item.date }),
    posterPath: item.posterPath ?? undefined,
    backdropPath: item.backdropPath ?? undefined,
    overview: item.overview ?? undefined,
  };
}
