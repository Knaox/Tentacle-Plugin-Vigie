import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "../api/endpoints";
import { langParam } from "../utils/media-helpers";
import type { SeerrSearchResult } from "../api/types";
import { sortParts } from "../utils/collection";

export interface MediaCollection {
  id: number;
  name: string;
  overview?: string;
  /** Les volets, dans l'ordre de sortie ; ceux sans date à la fin. */
  parts: SeerrSearchResult[];
}

/**
 * La saga d'un film, volets et état de chacun (`mediaInfo`, joint par
 * Jellyseerr). Relue à chaque ouverture, comme la fiche : un volet arrivé
 * depuis doit se dire « Disponible ».
 */
export function useMediaCollection(collectionId: number | undefined) {
  return useQuery({
    queryKey: ["seer-media-collection", collectionId],
    queryFn: async (): Promise<MediaCollection> => {
      const data = await proxyFetch<{ id: number; name: string; overview?: string; parts?: SeerrSearchResult[] }>(
        `/api/v1/collection/${collectionId}?${langParam()}`,
      );
      const parts = (data.parts ?? []).map((p) => ({ ...p, mediaType: "movie" as const }));
      return { id: data.id, name: data.name, overview: data.overview, parts: sortParts(parts) };
    },
    enabled: !!collectionId && collectionId > 0,
    staleTime: 24 * 60 * 60_000,
    refetchOnMount: "always",
  });
}
