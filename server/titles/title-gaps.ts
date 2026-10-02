/* ------------------------------------------------------------------ */
/*  Vigie — Ce qui manque à une série que Tentacle a EN PARTIE          */
/* ------------------------------------------------------------------ */

/*
 * La route `gaps` du contrat `titles` de Tentacle : pour une série que sa
 * bibliothèque a déjà — un résultat de sa recherche, la fiche d'une série —,
 * les saisons qui ne sont PAS là, chacune dans la forme de `titles/seasons`
 * (où elle en est, si elle se demande encore). C'est ce qui permet à
 * Tentacle d'offrir « 2 saisons à demander » sur une série incomplète, sans
 * ouvrir nos pages.
 *
 * Mêmes verrous que la feuille des saisons (`titleSeasons`) : une saison déjà
 * demandée — chez Jellyseerr ou dans notre file — y figure, dite « Demandée »,
 * et ne se demande pas une seconde fois. Une saison là, ou là en partie, n'y
 * figure pas : elle n'est pas un trou.
 *
 * Pur : la fiche Jellyseerr, les saisons de la file du compte et ses droits
 * arrivent tout faits.
 */

import type { SeerrTvDetail } from "../../src/api/types";
import { seasonLocks } from "../../src/utils/season-locks";
import { MEDIA_STATUS } from "../search/status-map";
import { titleSeasons, type SeasonOut, type SeasonRights } from "./title-seasons";

/** Au plus autant de séries par question — la longueur d'URL de Tentacle, comme `state`. */
export const MAX_GAP_KEYS = 60;
/** Au plus autant de fiches Jellyseerr lues pour UNE question : une page de résultats. */
export const MAX_GAP_LOOKUPS = 24;

/**
 * Seule une série que Jellyseerr dit EN PARTIE là a des trous à dire. Entière,
 * il n'en manque rien ; inconnue, absente ou masquée, on ne sait pas ce que
 * la bibliothèque en a — on ne propose rien plutôt que de proposer une
 * saison déjà là.
 */
export function hasGapsToTell(status: number | undefined): boolean {
  return status === MEDIA_STATUS.PARTIALLY_AVAILABLE;
}

/** Les saisons qui manquent à la série : ni là, ni là en partie — dans l'ordre de la feuille. */
export function seriesGaps(
  detail: Pick<SeerrTvDetail, "seasons" | "mediaInfo">,
  localSeasons: readonly number[],
  rights: SeasonRights,
  opts: { specials: boolean; lang: string },
): SeasonOut[] {
  const locks = seasonLocks(detail.mediaInfo, localSeasons);
  return titleSeasons(detail, localSeasons, rights, opts).filter((season) => {
    const lock = locks.get(season.number);
    return lock !== MEDIA_STATUS.AVAILABLE && lock !== MEDIA_STATUS.PARTIALLY_AVAILABLE;
  });
}
