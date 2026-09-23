import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSeriesGaps } from "../api/client-releases";
import type { SeriesGaps } from "../api/types-releases";

/**
 * Ce qui manque à chaque série en partie là, par id TMDB. Une seule lecture
 * pour toutes les affiches du hub, gardée une minute (le serveur ne la
 * recalcule pas plus souvent).
 */
export function useSeriesGapsMap(): ReadonlyMap<number, SeriesGaps> {
  const { data } = useQuery({
    queryKey: ["vigie-series-gaps"],
    queryFn: getSeriesGaps,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  return useMemo(
    () => new Map(Object.entries(data?.items ?? {}).map(([id, gaps]) => [Number(id), gaps])),
    [data],
  );
}
