import { useQuery } from "@tanstack/react-query";
import { getMovieDetail, getTvDetail } from "../api/client-catalog";
import type { MediaType, SeerrMovieDetail, SeerrTvDetail } from "../api/types";
import { retryUnlessRestricted } from "../utils/restricted";

export function useMediaDetail(mediaType: MediaType, tmdbId: number) {
  return useQuery<SeerrMovieDetail | SeerrTvDetail>({
    queryKey: ["seer-media-detail", mediaType, tmdbId],
    queryFn: () => (mediaType === "movie" ? getMovieDetail(tmdbId) : getTvDetail(tmdbId)),
    enabled: tmdbId > 0,
    // Le cache d'une journée peint la fiche d'un coup ; mais `mediaInfo`
    // (demandes, saisons disponibles ou supprimées) bouge côté Jellyseerr sans
    // que le plugin en soit averti : chaque ouverture relit, en silence.
    staleTime: 24 * 60 * 60_000,
    refetchOnMount: "always",
    retry: retryUnlessRestricted,
  });
}
