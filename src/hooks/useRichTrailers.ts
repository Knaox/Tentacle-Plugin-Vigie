import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "../utils/tentacle-fetch";
import { resolveTmdbMedia } from "../utils/navigate-media";
import { mergeTrailers, type RichTrailer, type TmdbVideo } from "../utils/trailers";
import { catalogPath, readCatalog } from "../utils/trailer-catalog";
import { hostPlaysCatalog } from "../utils/external";
import { useServerCapabilities } from "../utils/server-capabilities";
import { getCurrentLanguage } from "../utils/media-helpers";
import type { MediaType } from "../api/types";
import { isInLibraryStatus } from "../utils/media-status";

export interface RichTrailers {
  trailers: RichTrailer[];
  /** La liste vient du catalogue du serveur : l'hôte peut la rejouer (`openTrailerFor`). */
  fromCatalog: boolean;
  /** La langue du serveur (catalogue), qui dit VF / VOSTFR / VO. */
  language: string | null;
  complete: boolean;
}

/** Tant qu'une source du catalogue n'a pas fini, deux relectures au plus, à 5 s. */
const CATALOG_RETRY_MS = 5_000;
const CATALOG_RETRIES = 2;

/**
 * Bandes-annonces + extras d'un titre, COMME les fiches de Tentacle :
 * - serveur avec `trailers.catalog` : SON catalogue (AlloCiné, TMDB, Jellyfin,
 *   Jellyseerr), dans son ordre — la langue du serveur d'abord. Les vidéos
 *   Dailymotion n'y restent que si l'hôte ouvre son lecteur complet ;
 * - serveur d'avant : vidéos Jellyseerr (`/api/tmdb/trailers`) fusionnées avec
 *   les RemoteTrailers Jellyfin (média en bibliothèque), triées par langue.
 */
export function useRichTrailers(mediaType: MediaType, tmdbId: number, mediaStatus: number) {
  const lang = getCurrentLanguage();
  const inLibrary = isInLibraryStatus(mediaStatus);
  const capabilities = useServerCapabilities();
  const catalog = capabilities?.has("trailers.catalog") === true;
  const withDailymotion = hostPlaysCatalog();

  const query = useQuery({
    queryKey: ["seer-rich-trailers", mediaType, tmdbId, catalog ? "catalog" : inLibrary, lang, withDailymotion],
    queryFn: async (): Promise<RichTrailers> => {
      if (catalog) {
        const body = await tentacleApiFetch<unknown>(catalogPath(mediaType === "movie" ? "movie" : "tv", tmdbId, lang));
        const read = readCatalog(body, withDailymotion);
        if (read) return { ...read, fromCatalog: true };
      }
      const [tmdbRes, jellyfinRes] = await Promise.all([
        tentacleApiFetch<{ videos?: TmdbVideo[] }>(`/api/tmdb/trailers?tmdbId=${tmdbId}&mediaType=${mediaType}`),
        inLibrary ? resolveTmdbMedia(tmdbId, mediaType) : Promise.resolve(null),
      ]);
      const trailers = mergeTrailers(jellyfinRes?.remoteTrailers ?? [], tmdbRes?.videos ?? [], lang);
      return { trailers, fromCatalog: false, language: null, complete: true };
    },
    // Rien ne se choisit avant de connaître le serveur : ni un chemin, ni l'autre.
    enabled: tmdbId > 0 && capabilities !== null,
    staleTime: 30 * 60_000,
    refetchInterval: (q) => (q.state.data?.complete === false && q.state.dataUpdateCount <= CATALOG_RETRIES ? CATALOG_RETRY_MS : false),
  });
  return { ...query, data: query.data?.trailers, catalog: query.data ?? null };
}
