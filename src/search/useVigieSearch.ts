/* ------------------------------------------------------------------ */
/*  Vigie — La recherche du hub, à deux vitesses                       */
/* ------------------------------------------------------------------ */

/*
 * Deux requêtes pour une frappe :
 *
 *   - l'INSTANTANÉE (index du serveur, quelques millisecondes) part presque
 *     tout de suite — c'est elle qui fait apparaître les affiches pendant
 *     qu'on tape ;
 *   - la COMPLÈTE (index + TMDB) part quand la frappe se pose, et remplace la
 *     première sans rien réordonner (même barème des deux côtés).
 *
 * Tant que ni l'une ni l'autre ne correspond à ce qui est tapé, la réponse
 * précédente reste affichée : une grille qui clignote à chaque lettre se lit
 * comme une recherche lente.
 */

import { useCallback, useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { backendFetch } from "../api/seer-client";
import { getCurrentLanguage } from "../utils/media-helpers";
import { useDebounced } from "../hooks/useDebounced";
import type { SeerrSearchResult } from "../api/types";
import type { VigieSearchResponse } from "../api/types-search";

const MIN_LENGTH = 2;
const INSTANT_MS = 60;
const FULL_MS = 220;
const isEmpty = (q: string) => q.length < MIN_LENGTH;

interface SearchFlags {
  showBlocked: boolean;
  /** « Rechercher X quand même » : pas de correction. */
  exact: boolean;
}

function searchPath(q: string, mode: "instant" | "full", page: number, flags: SearchFlags): string {
  const params = new URLSearchParams({ q, mode, page: String(page), lang: getCurrentLanguage() });
  if (flags.showBlocked) params.set("showBlocked", "1");
  if (flags.exact) params.set("exact", "1");
  return `/search?${params}`;
}

function dedupe(items: SeerrSearchResult[]): SeerrSearchResult[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.mediaType}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface VigieSearchState {
  /** La réponse à afficher — celle de la frappe courante ou, à défaut, la précédente. */
  data: VigieSearchResponse | undefined;
  /** La réponse affichée correspond-elle à ce qui est tapé ? */
  current: boolean;
  /** Une requête est en route (anneau dans le champ). */
  searching: boolean;
  /** Pas encore la réponse complète pour cette frappe. */
  refining: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

export function useVigieSearch(query: string, flags: SearchFlags): VigieSearchState {
  const { showBlocked, exact } = flags;
  const q = query.trim();
  const instantQ = useDebounced(q, INSTANT_MS, isEmpty);
  const fullQ = useDebounced(q, FULL_MS, isEmpty);
  const lang = getCurrentLanguage();

  const instant = useQuery({
    queryKey: ["vigie-search", "instant", instantQ, lang, showBlocked, exact],
    queryFn: ({ signal }) => backendFetch<VigieSearchResponse>(searchPath(instantQ, "instant", 1, flags), { signal }),
    enabled: instantQ.length >= MIN_LENGTH,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const full = useInfiniteQuery({
    queryKey: ["vigie-search", "full", fullQ, lang, showBlocked, exact],
    queryFn: ({ pageParam, signal }) =>
      backendFetch<VigieSearchResponse>(searchPath(fullQ, "full", pageParam, flags), { signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: fullQ.length >= MIN_LENGTH,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  // Les pages suivantes ne portent que des titres : on les coud à la première.
  const fullData = useMemo<VigieSearchResponse | undefined>(() => {
    const pages = full.data?.pages;
    if (!pages || pages.length === 0) return undefined;
    const [first, ...rest] = pages;
    if (rest.length === 0) return first;
    const last = rest[rest.length - 1];
    return {
      ...first,
      movies: dedupe([...first.movies, ...rest.flatMap((p) => p.movies)]),
      series: dedupe([...first.series, ...rest.flatMap((p) => p.series)]),
      hasMore: last.hasMore,
      page: last.page,
    };
  }, [full.data]);

  const fullCurrent = fullData !== undefined && !full.isPlaceholderData && fullData.query.trim() === q;
  const instantCurrent = instant.data !== undefined && !instant.isPlaceholderData && instant.data.query.trim() === q;
  const data = fullCurrent ? fullData : instantCurrent ? instant.data : (fullData ?? instant.data);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = full;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    data: q.length >= MIN_LENGTH ? data : undefined,
    current: fullCurrent || instantCurrent,
    searching: q.length >= MIN_LENGTH && (instant.isFetching || full.isFetching || q !== fullQ),
    refining: q.length >= MIN_LENGTH && !fullCurrent,
    hasMore: fullCurrent && !!hasNextPage,
    loadingMore: isFetchingNextPage,
    loadMore,
  };
}
