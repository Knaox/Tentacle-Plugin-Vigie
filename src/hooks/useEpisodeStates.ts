import { useQuery } from "@tanstack/react-query";
import { getEpisodeStates } from "../api/client-releases";
import type { SeriesEpisodeStates } from "../api/types-releases";

/**
 * L'état de chaque épisode d'une série, pour sa fiche. Tant qu'un épisode
 * arrive, on repasse toutes les vingt secondes : son avancement bouge sous les
 * yeux ; sinon, une lecture à l'ouverture suffit.
 */
export function useEpisodeStates(tmdbId: number, enabled: boolean) {
  return useQuery<SeriesEpisodeStates>({
    queryKey: ["vigie-episode-states", tmdbId],
    queryFn: () => getEpisodeStates(tmdbId),
    enabled: enabled && tmdbId > 0,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    refetchInterval: (q) =>
      Object.values(q.state.data?.states ?? {}).some((s) => s === "downloading") ? 20_000 : false,
    retry: 1,
  });
}
