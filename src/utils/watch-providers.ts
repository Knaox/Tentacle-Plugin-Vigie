/* ------------------------------------------------------------------ */
/*  Vigie — « Disponible sur » : les fournisseurs d'un pays            */
/* ------------------------------------------------------------------ */

/*
 * La fiche demandait `/{type}/{id}/watch/providers`, une route que Jellyseerr
 * n'a jamais eue : son validateur répond 404 « not found » (mesuré sur Seerr
 * 3.4.1), et la carte « Disponible sur » ne s'affichait jamais. Les
 * fournisseurs arrivent pourtant avec la fiche elle-même (`watchProviders`,
 * une entrée par pays) : on les y lit.
 */

import type { SeerrWatchProvider, SeerrWatchProviders } from "../api/types-watch";

/** Six logos au plus : la carte tient sur deux colonnes. */
const MAX_PROVIDERS = 6;

/**
 * Le pays de la langue affichée, sinon la France, sinon les États-Unis ;
 * l'abonnement d'abord, l'achat à défaut.
 */
export function pickWatchProviders(
  regions: readonly SeerrWatchProviders[] | undefined,
  lang: string,
): SeerrWatchProvider[] {
  if (!regions?.length) return [];
  const find = (country: string) => regions.find((r) => r.iso_3166_1 === country);
  const region = find(lang.toUpperCase()) ?? find("FR") ?? find("US");
  if (!region) return [];
  const list = region.flatrate?.length ? region.flatrate : region.buy ?? [];
  return list.slice(0, MAX_PROVIDERS);
}
