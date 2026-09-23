/* ------------------------------------------------------------------ */
/*  Vigie — Les rangées de l'accueil                                   */
/* ------------------------------------------------------------------ */

/*
 * Chaque rangée est UNE page de catalogue (vingt titres), mise en commun par
 * le serveur pour tout le monde (cache de cinq minutes du proxy) et gardée
 * dix minutes ici : revenir sur l'accueil ne recharge rien.
 */

import { useQuery } from "@tanstack/react-query";
import { discoverMedia, discoverTrending } from "../api/client-catalog";
import { DEFAULT_FILTERS } from "../hooks/useDiscoverFilters";
import { getCurrentLanguage } from "../utils/media-helpers";
import type { DiscoverFilters, DiscoverMediaType, SeerrPagedResponse } from "../api/types";

const STALE_MS = 10 * 60_000;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type RailId = "trending" | "movies" | "series" | "anime" | "upcoming" | "top";

const RAILS: Record<Exclude<RailId, "trending">, { type: DiscoverMediaType; filters: Partial<DiscoverFilters>; upcoming?: boolean }> = {
  movies: { type: "movies", filters: {} },
  series: { type: "tv", filters: {} },
  anime: { type: "anime", filters: {} },
  upcoming: { type: "movies", filters: {}, upcoming: true },
  top: { type: "movies", filters: { sortBy: "vote_average", ratingMin: 7 } },
};

function load(id: RailId): Promise<SeerrPagedResponse> {
  if (id === "trending") return discoverTrending(1);
  const rail = RAILS[id];
  return discoverMedia(rail.type, 1, { ...DEFAULT_FILTERS, ...rail.filters }, false, rail.upcoming ? todayIso() : undefined);
}

export function useRail(id: RailId) {
  return useQuery({
    queryKey: ["vigie-rail", id, getCurrentLanguage()],
    queryFn: () => load(id),
    staleTime: STALE_MS,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}
