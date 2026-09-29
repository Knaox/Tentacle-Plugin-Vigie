import { useMemo } from "react";
import type { MediaType } from "../api/types";
import type { WatchProviderEntry } from "../components/detail/DetailInfo";
import { getCurrentLanguage } from "../utils/media-helpers";
import { pickWatchProviders } from "../utils/watch-providers";
import { useMediaDetail } from "./useMediaDetail";

/**
 * Où regarder le titre, lu dans sa fiche : la même requête que la fiche, en
 * cache — Jellyseerr n'a pas de route à part (cf. utils/watch-providers.ts).
 */
export function useWatchProviders(mediaType: MediaType, tmdbId: number): { data: WatchProviderEntry[] | undefined } {
  const { data: detail } = useMediaDetail(mediaType, tmdbId);
  const regions = detail?.watchProviders;
  const data = useMemo(
    () => regions && pickWatchProviders(regions, getCurrentLanguage())
      .map((p) => ({ provider_id: p.id, provider_name: p.name, logo_path: p.logoPath })),
    [regions],
  );
  return { data };
}
