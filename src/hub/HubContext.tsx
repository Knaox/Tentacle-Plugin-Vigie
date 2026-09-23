/* ------------------------------------------------------------------ */
/*  Vigie — Ce que toutes les vues du hub partagent                    */
/* ------------------------------------------------------------------ */

/*
 * Le hub est UNE page : Découvrir, Mes demandes et le Calendrier y sont des
 * vues, pas des pages de l'application. Passer de l'une à l'autre ne recharge
 * rien (l'hôte recréait jusqu'ici tout le cadre du plugin à chaque entrée du
 * menu), et une fiche s'ouvre de n'importe où — depuis une demande, une
 * sortie du calendrier ou un résultat de recherche — avec les mêmes gestes.
 */

import { createContext, useContext } from "react";
import type { DiscoverFilters, DiscoverMediaType, SeerrSearchResult } from "../api/types";

export type HubTab = "discover" | "catalog" | "requests" | "calendar";

export type BrowseKind = "all" | "popular" | "top" | "upcoming" | "genre" | "provider" | "trending";

/** Un parcours du catalogue : une rangée « Tout voir », un genre, une plateforme. */
export interface BrowsePreset {
  /** Identité stable (clé de cache, retour en arrière). */
  id: string;
  /** Titre à l'ouverture — ensuite, il suit le type choisi (cf. presetTitle). */
  title: string;
  /** Ce que le parcours montre : « populaires », un genre, une plateforme… */
  kind?: BrowseKind;
  /** Nom de la plateforme, pour un parcours qui en porte une. */
  label?: string;
  mediaType: DiscoverMediaType;
  /** `trending` : les tendances, films et séries mêlés — sans filtre possible. */
  source?: "discover" | "trending";
  filters?: Partial<DiscoverFilters>;
  /** Seulement ce qui sort à partir d'aujourd'hui. */
  upcoming?: boolean;
}

/** Une fiche ouverte depuis une demande : ses saisons déjà demandées restent verrouillées. */
export interface OpenMediaOptions {
  lockedSeasons?: number[];
  defaultProfileId?: string | null;
}

export interface HubApi {
  tab: HubTab;
  setTab: (tab: HubTab) => void;
  /** Le catalogue entier, dans un type — et, au besoin, ses filtres ouverts. */
  openCatalog: (mediaType?: DiscoverMediaType, withFilters?: boolean) => void;
  openMedia: (item: SeerrSearchResult, options?: OpenMediaOptions) => void;
  openPerson: (id: number) => void;
  browse: (preset: BrowsePreset) => void;
  /** Remplit la recherche du hub (une pastille, une correction proposée). */
  setQuery: (query: string) => void;
  /** Demande un film d'un geste — les séries passent par la fiche (choix des saisons). */
  quickRequest: (item: SeerrSearchResult) => void;
}

export const HubContext = createContext<HubApi | null>(null);

export function useHub(): HubApi {
  const hub = useContext(HubContext);
  if (!hub) throw new Error("useHub hors du hub Vigie");
  return hub;
}
