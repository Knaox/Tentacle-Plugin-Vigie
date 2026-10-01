/* ------------------------------------------------------------------ */
/*  Vigie — Les saisons d'une série, pour la feuille de Tentacle       */
/* ------------------------------------------------------------------ */

/*
 * Le contrat `titles.seasons` de Tentacle : un client qui ne montre pas nos
 * pages (le téléviseur) choisit lui-même les saisons d'une série. On lui dit,
 * saison par saison, où elle en est — les mots de nos fiches — et si elle se
 * demande encore. Les verrous sont CEUX du hub (`seasonLocks`, saisons libres
 * `requestableSeasons`) : une saison déjà là ou déjà demandée — chez
 * Jellyseerr ou dans notre file — ne se redemande pas.
 *
 * Pur : la fiche Jellyseerr, les saisons de la file du compte et ses droits
 * arrivent tout faits.
 */

import type { SeerrTvDetail } from "../../src/api/types";
import { seasonLocks } from "../../src/utils/season-locks";
import { requestableSeasons } from "../../src/utils/request-seasons";
import { MEDIA_STATUS } from "../search/status-map";

export interface SeasonOut {
  number: number;
  /** Le nom que TMDB donne à la saison (« Saison 1 », « Épisodes spéciaux »). */
  name: string | null;
  episodeCount: number | null;
  /** Où elle en est : « Disponible », « En partie », « Demandée » ; null : libre. */
  badge: { label: string; tone: "info" | "success" } | null;
  /** Elle se demande d'un geste : libre, et le compte en a le droit. */
  requestable: boolean;
}

export interface SeasonRights {
  tv: boolean;
  /** Les titres masqués se demandent (option de l'administrateur). */
  masked?: boolean;
}

/** Au plus autant de saisons dans une demande : au-delà, rien n'est lu. */
export const MAX_REQUESTED_SEASONS = 100;

const LABELS = {
  fr: { requested: "Demandée", partial: "En partie", available: "Disponible" },
  en: { requested: "Requested", partial: "Partly here", available: "Available" },
};

function seasonBadge(lock: number | undefined, lang: string): SeasonOut["badge"] {
  const l = lang === "fr" ? LABELS.fr : LABELS.en;
  if (lock === MEDIA_STATUS.AVAILABLE) return { label: l.available, tone: "success" };
  if (lock === MEDIA_STATUS.PARTIALLY_AVAILABLE) return { label: l.partial, tone: "success" };
  return lock === undefined ? null : { label: l.requested, tone: "info" };
}

/**
 * Les saisons qu'une feuille propose : les numérotées dans l'ordre, puis les
 * épisodes spéciaux quand Jellyseerr les laisse demander (`specials`). Une
 * série masquée ne propose rien, sauf si l'administrateur le permet.
 */
export function titleSeasons(
  detail: Pick<SeerrTvDetail, "seasons" | "mediaInfo">,
  localSeasons: readonly number[],
  rights: SeasonRights,
  opts: { specials: boolean; lang: string },
): SeasonOut[] {
  const locks = seasonLocks(detail.mediaInfo, localSeasons);
  const masked = detail.mediaInfo?.status === MEDIA_STATUS.BLOCKLISTED && rights.masked !== true;
  const open = rights.tv && !masked;
  return requestableSeasons(detail.seasons ?? [], opts.specials).map((season) => {
    const lock = locks.get(season.seasonNumber);
    return {
      number: season.seasonNumber,
      name: typeof season.name === "string" && season.name.trim() !== "" ? season.name.trim().slice(0, 80) : null,
      episodeCount: typeof season.episodeCount === "number" ? season.episodeCount : null,
      badge: seasonBadge(lock, opts.lang),
      requestable: open && lock === undefined,
    };
  });
}

/** Les saisons d'une demande : entières, dédoublonnées, croissantes ; `null` si rien ne se lit. */
export function parseRequestedSeasons(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const out = new Set<number>();
  for (const value of raw) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1000) out.add(value);
    if (out.size >= MAX_REQUESTED_SEASONS) break;
  }
  return out.size > 0 ? [...out].sort((a, b) => a - b) : null;
}

/** Ce qui reste à demander : les saisons choisies que la feuille propose encore. */
export function freeSeasons(chosen: readonly number[], seasons: readonly SeasonOut[]): number[] {
  const free = new Set(seasons.filter((s) => s.requestable).map((s) => s.number));
  return chosen.filter((n) => free.has(n));
}
