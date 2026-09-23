/* ------------------------------------------------------------------ */
/*  Vigie — Contrat de la recherche (GET /search du serveur du plugin) */
/* ------------------------------------------------------------------ */

import type { SeerrSearchResult } from "./types";

export type SearchFacet =
  | { kind: "genre"; id: number; mediaType: "movie" | "tv"; label: string }
  | { kind: "provider"; id: number; label: string; logoPath: string | null };

export interface SearchPerson {
  id: number;
  mediaType: "person";
  name: string;
  profilePath?: string;
  knownForDepartment?: string;
  popularity: number;
  knownFor: SeerrSearchResult[];
}

export interface VigieSearchResponse {
  query: string;
  /** Ce qui a réellement été cherché (faute corrigée, année et type retirés). */
  searched: string;
  correction: string | null;
  year: number | null;
  type: "movie" | "tv" | null;
  /** Faux : réponse de l'index seul, la réponse complète suit. */
  complete: boolean;
  top: { kind: "media"; item: SeerrSearchResult } | { kind: "person"; person: SearchPerson } | null;
  movies: SeerrSearchResult[];
  series: SeerrSearchResult[];
  people: SearchPerson[];
  facets: SearchFacet[];
  page: number;
  hasMore: boolean;
  blockedCount: number;
  blockedActive: boolean;
  /** L'index local se construit encore : les résultats instantanés sont partiels. */
  indexing: boolean;
  tookMs: number;
}
