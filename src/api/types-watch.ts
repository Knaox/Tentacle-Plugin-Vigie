/* ------------------------------------------------------------------ */
/*  Vigie — Où regarder un titre (fiche Jellyseerr)                    */
/* ------------------------------------------------------------------ */

/* Extrait de types.ts pour tenir sous 300 lignes. La forme est celle de
 * `watchProviders` dans `GET /movie/{id}` et `GET /tv/{id}` (spec Seerr :
 * `WatchProviders`, `WatchProviderDetails`). */

export interface SeerrWatchProvider {
  id: number;
  name: string;
  logoPath: string;
  displayPriority?: number;
}

/** Les fournisseurs d'un pays : abonnement (`flatrate`) et achat (`buy`). */
export interface SeerrWatchProviders {
  iso_3166_1: string;
  link?: string;
  flatrate?: SeerrWatchProvider[];
  buy?: SeerrWatchProvider[];
}
