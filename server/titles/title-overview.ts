/* ------------------------------------------------------------------ */
/*  Vigie — Le résumé d'un titre hors bibliothèque, pour Tentacle      */
/* ------------------------------------------------------------------ */

/*
 * La carte ouverte d'un titre absent, sur les téléviseurs de Tentacle, montre
 * son résumé comme celle d'un titre de la bibliothèque (sinon une zone vide).
 * `GET /titles/state` le joint à la pastille, en champ FACULTATIF (`overview`,
 * venu après, comme `page`) : un Tentacle d'avant l'ignore.
 *
 * Jamais d'attente pour une liste : la réponse part avec les fiches déjà en
 * mémoire (tmdb-cache) et les manquantes se remplissent en fond. Seule une
 * question sur un ou deux titres (la carte focalisée) va chercher sa fiche
 * tout de suite.
 */

import type { TitleKey, TitleStateOut } from "./title-state";
import type { TmdbMeta, TmdbRef } from "../tmdb-cache";

/** Au plus autant de titres récupérés sur-le-champ (une carte focalisée, sa voisine). */
export const OVERVIEW_FETCH_NOW = 2;
/** Un résumé reste un résumé : coupé à la phrase sous cette longueur. */
export const OVERVIEW_MAX = 600;

/** Combien de fiches manquantes chercher tout de suite pour cette question. */
export function overviewFetchBudget(keyCount: number): number {
  return keyCount <= OVERVIEW_FETCH_NOW ? keyCount : 0;
}

/** Le résumé, propre et borné : des phrases entières, jamais un mot coupé. */
export function clipOverview(raw: string | null | undefined): string | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= OVERVIEW_MAX) return text;
  const cut = text.slice(0, OVERVIEW_MAX);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (end > OVERVIEW_MAX / 3) return cut.slice(0, end + 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 0 ? space : OVERVIEW_MAX)}…`;
}

export const refOf = (k: TitleKey): TmdbRef => ({ mediaType: k.mediaType, tmdbId: k.tmdbId });

/** Joint le résumé connu à l'état de chaque titre (sans le toucher s'il n'y en a pas). */
export function withOverview(state: TitleStateOut, meta: TmdbMeta | undefined): TitleStateOut {
  const overview = clipOverview(meta?.overview);
  return overview ? { ...state, overview } : state;
}
