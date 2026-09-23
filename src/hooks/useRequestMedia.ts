import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRequest } from "../api/seer-client";
import type { MediaType, SeerrPagedResponse, SeerrSearchResult } from "../api/types";
import { markRequestedEverywhere } from "./markRequested";

export interface RequestMediaPayload {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string | null;
  year?: string | null;
  seasons?: number[];
  profileId?: string | null;
}

/** Met à jour le mediaInfo.status d'un item dans un array de résultats */
function markRequested(results: SeerrSearchResult[], tmdbId: number, mediaType: string): SeerrSearchResult[] {
  return results.map((r) =>
    r.id === tmdbId && r.mediaType === mediaType
      ? { ...r, mediaInfo: { ...(r.mediaInfo || {}), status: 2 } }
      : r,
  );
}

export function useRequestMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestMediaPayload) => createRequest(payload),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-queue-status"] });

      // Update simple queries (trending, search) — format SeerrPagedResponse
      const updateSimple = (old: SeerrPagedResponse | undefined) => {
        if (!old?.results) return old;
        return { ...old, results: markRequested(old.results, payload.tmdbId, payload.mediaType) };
      };

      // Update infinite queries (discover) — format { pages: SeerrPagedResponse[], pageParams: [] }
      const updateInfinite = (old: { pages: SeerrPagedResponse[]; pageParams: unknown[] } | undefined) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            results: markRequested(page.results, payload.tmdbId, payload.mediaType),
          })),
        };
      };

      qc.setQueriesData({ queryKey: ["seer-trending"] }, updateSimple);
      qc.setQueriesData({ queryKey: ["seer-search"] }, updateSimple);
      qc.setQueriesData({ queryKey: ["seer-discover"] }, updateInfinite);
      // Le hub : rangées, recherche, grille à accès direct, filmographies.
      markRequestedEverywhere(qc, payload.tmdbId, payload.mediaType);

      // Verrou des saisons demandées : MàJ optimiste immédiate de la source
      // locale (le picker les verrouille aussitôt), puis invalidation pour
      // réconcilier avec la DB locale (qui, elle, connaît déjà la demande).
      // On NE réinvalide PAS ["seer-media-detail"] : il est lu depuis Jellyseerr,
      // qui ignore encore la demande (worker async) — un refetch immédiat
      // re-cacherait l'état PRÉ-demande et « déverrouillerait » la saison.
      if (payload.mediaType === "tv" && payload.seasons?.length) {
        const key = ["seer-local-seasons", "tv", payload.tmdbId];
        qc.setQueryData<number[]>(key, (old) => {
          const merged = new Set<number>([...(old ?? []), ...payload.seasons!]);
          return [...merged].sort((a, b) => a - b);
        });
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
