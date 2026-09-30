import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "../api/endpoints";
import { langParam } from "../utils/media-helpers";
import type { SeerrEpisode } from "../api/types";

interface SeerrSeasonDetail {
  id: number;
  seasonNumber: number;
  name?: string;
  episodes?: SeerrEpisode[];
}

/**
 * Épisodes d'une saison (Seerr → TMDB) : numéro, titre, date de diffusion,
 * vignette. Utilisé pour afficher les dates de sortie des prochains épisodes.
 * `enabled` piloté par l'appelant (chargé seulement quand la saison est dépliée).
 */
export function useTvSeasonEpisodes(tvId: number, seasonNumber: number | null) {
  return useQuery({
    queryKey: ["seer-season-episodes", tvId, seasonNumber],
    queryFn: async () => {
      const data = await proxyFetch<SeerrSeasonDetail>(
        `/api/v1/tv/${tvId}/season/${seasonNumber}?${langParam()}`,
      );
      return data.episodes ?? [];
    },
    enabled: tvId > 0 && seasonNumber != null && seasonNumber >= 0,
    staleTime: 30 * 60_000,
  });
}
