import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "../utils/tentacle-fetch";
import { resolveTmdbMedia } from "../utils/navigate-media";
import { mergeTrailers, type RichTrailer, type TmdbVideo } from "../utils/trailers";
import { getCurrentLanguage } from "../utils/media-helpers";
import type { MediaType } from "../api/types";
import { isInLibraryStatus } from "../utils/media-status";

/**
 * Bandes-annonces + extras d'un média, STRICTEMENT comme MediaDetail (core) :
 * vidéos TMDB (via /api/tmdb/trailers, source Jellyseerr) fusionnées avec les
 * RemoteTrailers Jellyfin (si le média est en bibliothèque), dédupliquées et
 * triées selon la langue de l'interface (VF d'abord en profil FR).
 *
 * `mediaStatus` >= 4 (partiellement/disponible) déclenche la résolution
 * Jellyfin pour récupérer ses RemoteTrailers.
 */
export function useRichTrailers(mediaType: MediaType, tmdbId: number, mediaStatus: number) {
  const lang = getCurrentLanguage();
  const inLibrary = isInLibraryStatus(mediaStatus);

  return useQuery({
    queryKey: ["seer-rich-trailers", mediaType, tmdbId, inLibrary, lang],
    queryFn: async (): Promise<RichTrailer[]> => {
      const [tmdbRes, jellyfinRes] = await Promise.all([
        tentacleApiFetch<{ videos?: TmdbVideo[] }>(
          `/api/tmdb/trailers?tmdbId=${tmdbId}&mediaType=${mediaType}`,
        ),
        inLibrary ? resolveTmdbMedia(tmdbId, mediaType) : Promise.resolve(null),
      ]);
      return mergeTrailers(
        jellyfinRes?.remoteTrailers ?? [],
        tmdbRes?.videos ?? [],
        lang,
      );
    },
    enabled: tmdbId > 0,
    staleTime: 30 * 60_000,
  });
}
