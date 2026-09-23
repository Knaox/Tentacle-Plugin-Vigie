/* ------------------------------------------------------------------ */
/*  Vigie — Quelles saisons d'une série sont déjà prises               */
/* ------------------------------------------------------------------ */

/*
 * Partagé par la fiche et la demande rapide : une saison déjà là, déjà
 * demandée (chez Jellyseerr ou dans la file du plugin) ne se redemande pas.
 * Extrait de la fiche, à l'identique.
 */

import type { SeerrTvDetail } from "../api/types";
import { MEDIA_STATUS_DELETED } from "./media-status";

type MediaInfo = SeerrTvDetail["mediaInfo"];

/**
 * Numéro de saison → statut Jellyseerr (2 en attente, 3 en acquisition,
 * 4 partielle, 5 disponible). Une saison absente est libre.
 */
export function seasonLocks(info: MediaInfo, localSeasons: readonly number[] | undefined): Map<number, number> {
  const map = new Map<number, number>();
  // Saisons que Jellyseerr dit SUPPRIMÉES : données retirées, saison libre —
  // quoi qu'en disent une demande survivante ou la file locale (le worker
  // les aligne dans la minute). Média entier supprimé : ses demandes ne
  // verrouillent plus rien.
  const deleted = new Set<number>();
  // 1) Statuts de disponibilité par saison (présents seulement une fois dispo).
  for (const s of info?.seasons ?? []) {
    if (s.status === MEDIA_STATUS_DELETED) deleted.add(s.seasonNumber);
    else map.set(s.seasonNumber, s.status);
  }
  // 2) Saisons couvertes par une demande active : Jellyseerr ne remplit
  //    mediaInfo.seasons qu'à la disponibilité ; une saison seulement demandée
  //    n'est QUE dans mediaInfo.requests[].seasons. On la marque « en
  //    traitement » (3) pour la verrouiller, sans rétrograder une saison déjà
  //    disponible. (statut demande : 3 = refusée, 4 = échouée → ignorées)
  if (info?.status !== MEDIA_STATUS_DELETED) {
    for (const r of info?.requests ?? []) {
      if (r.status === 3 || r.status === 4) continue;
      for (const se of r.seasons ?? []) {
        if (deleted.has(se.seasonNumber)) continue;
        const existing = map.get(se.seasonNumber);
        if (existing === undefined || existing < 3) map.set(se.seasonNumber, 3);
      }
    }
  }
  // 3) Saisons demandées LOCALEMENT (file du plugin) : verrou immédiat et
  //    durable, même si Jellyseerr ne connaît pas encore la demande.
  for (const sn of localSeasons ?? []) {
    if (deleted.has(sn)) continue;
    const existing = map.get(sn);
    if (existing === undefined || existing < 3) map.set(sn, 3);
  }
  return map;
}

/** Détection animé : genre Animation + origine japonaise ou coréenne, ou mot-clé TMDB « anime ». */
export function isAnimeTitle(
  detail: { genres?: Array<{ id: number }>; originalLanguage?: string; keywords?: Array<{ id: number }> } | undefined,
  item: { genreIds?: number[]; originCountry?: string[] },
): boolean {
  const genres = detail?.genres?.map((g) => g.id) ?? item.genreIds ?? [];
  const origins = item.originCountry ?? [];
  const japanese = origins.includes("JP") || origins.includes("KR") || detail?.originalLanguage === "ja";
  const keyword = (detail?.keywords ?? []).some((k) => k.id === 210024);
  return keyword || (genres.includes(16) && japanese);
}
