/* ------------------------------------------------------------------ */
/*  Vigie — Ce que Tentacle montre d'un titre sur SES cartes           */
/* ------------------------------------------------------------------ */

/*
 * Le contrat `titles` de Tentacle (plugin.json → `titles`) : pour un titre
 * que la bibliothèque n'a pas, la pastille de sa carte et le geste qu'on y
 * offre. Les mêmes que sur l'affiche du hub, pour que la carte d'un titre se
 * lise pareil dans une recherche de Tentacle, sur ses recommandations et ici :
 *
 *   - la pastille : « Demandé », « En partie », « Disponible » — les mots de
 *     l'affiche. Aucune famille de « téléchargement » : l'application mobile
 *     lit ces mots (règle de revue Apple) ;
 *   - le geste : un film pas encore demandé se demande d'un geste (`direct`) ;
 *     une série qui n'est pas entièrement là ouvre ses saisons libres dans le
 *     hub (`open`) — exactement le « + » de l'affiche.
 *
 * Pur : le statut vient de la table des statuts (Jellyseerr, précisée par la
 * file locale), les droits du compte de ses réglages.
 */

import { MEDIA_STATUS } from "../search/status-map";

export type TitleMediaType = "movie" | "tv";

export interface TitleKey {
  key: string;
  mediaType: TitleMediaType;
  tmdbId: number;
}

export interface TitleStateOut {
  badge: { label: string; tone: "neutral" | "info" | "success" | "warning" } | null;
  request: { mode: "direct" | "open"; label: string; href?: string } | null;
}

/** Ce que le compte a le droit de demander (réglages Vigie). */
export interface RequestRights {
  movies: boolean;
  tv: boolean;
}

/** Au plus autant de titres par question — la longueur d'URL de Tentacle. */
export const MAX_TITLE_KEYS = 60;

const KEY = /^(movie|tv):([1-9]\d{0,9})$/;

const LABELS = {
  fr: {
    requested: "Demandé", partial: "En partie", available: "Disponible", masked: "Masqué",
    request: "Demander", seasons: "Choisir les saisons", moreSeasons: "Demander d'autres saisons",
  },
  en: {
    requested: "Requested", partial: "Partly here", available: "Available", masked: "Hidden",
    request: "Request", seasons: "Choose seasons", moreSeasons: "Request more seasons",
  },
};

export function labelsFor(lang: string) {
  return lang === "fr" ? LABELS.fr : LABELS.en;
}

/** Les clés d'une question, dédoublonnées et bornées ; ce qui n'en est pas une est ignoré. */
export function parseTitleKeys(raw: unknown): TitleKey[] {
  if (typeof raw !== "string") return [];
  const seen = new Set<string>();
  const out: TitleKey[] = [];
  for (const part of raw.split(",")) {
    const m = KEY.exec(part.trim());
    if (!m || seen.has(m[0])) continue;
    const tmdbId = Number(m[2]);
    if (!Number.isSafeInteger(tmdbId)) continue;
    seen.add(m[0]);
    out.push({ key: m[0], mediaType: m[1] as TitleMediaType, tmdbId });
    if (out.length >= MAX_TITLE_KEYS) break;
  }
  return out;
}

/** Le lien du hub qui ouvre les saisons libres d'une série, prêtes à cocher. */
export function seasonsHref(tmdbId: number): string {
  return `/discover?request=tv:${tmdbId}`;
}

/**
 * La pastille d'un statut Jellyseerr — les mots de l'affiche du hub : demandé
 * (en attente ou validé, rien ne bouge encore), en partie, disponible, masqué.
 * La même partout où Tentacle montre un de nos titres : recherche,
 * filmographie, recommandations.
 */
export function titleBadge(status: number | undefined, lang: string): TitleStateOut["badge"] {
  const l = labelsFor(lang);
  if (status === MEDIA_STATUS.PENDING || status === MEDIA_STATUS.PROCESSING) return { label: l.requested, tone: "info" };
  if (status === MEDIA_STATUS.PARTIALLY_AVAILABLE) return { label: l.partial, tone: "success" };
  if (status === MEDIA_STATUS.AVAILABLE) return { label: l.available, tone: "success" };
  if (status === MEDIA_STATUS.BLOCKLISTED) return { label: l.masked, tone: "neutral" };
  return null;
}

export function titleStateFor(
  mediaType: TitleMediaType,
  tmdbId: number,
  status: number | undefined,
  rights: RequestRights,
  lang: string,
): TitleStateOut {
  const l = labelsFor(lang);
  const badge = titleBadge(status, lang);

  let request: TitleStateOut["request"] = null;
  if (mediaType === "movie") {
    // Un film se demande une fois : déjà demandé, en route, là ou masqué, il n'y a plus rien à faire.
    if (rights.movies && badge === null) request = { mode: "direct", label: l.request };
  } else if (rights.tv && status !== MEDIA_STATUS.AVAILABLE && status !== MEDIA_STATUS.BLOCKLISTED) {
    // Une série tant qu'elle n'est pas entièrement là : ses saisons libres, dans le hub.
    request = { mode: "open", label: badge === null ? l.seasons : l.moreSeasons, href: seasonsHref(tmdbId) };
  }
  return { badge, request };
}
