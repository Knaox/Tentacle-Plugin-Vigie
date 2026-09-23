import { useState, useCallback, useMemo } from "react";
import type { DiscoverFilters, SortOption, SortOrder, TvStatus } from "../api/types";

export const DEFAULT_FILTERS: DiscoverFilters = {
  genres: [],
  watchProviders: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  originalLanguage: null,
  tvStatus: [],
  sortBy: "popularity",
  sortOrder: "desc",
};

/** `initial` : le préréglage d'un parcours (genre, plateforme, tri…). */
export function useDiscoverFilters(initial?: Partial<DiscoverFilters>) {
  const [filters, setFilters] = useState<DiscoverFilters>(() => ({ ...DEFAULT_FILTERS, ...initial }));

  const toggleGenre = useCallback((id: number) => {
    setFilters((f) => ({
      ...f,
      genres: f.genres.includes(id) ? f.genres.filter((g) => g !== id) : [...f.genres, id],
    }));
  }, []);

  const toggleWatchProvider = useCallback((id: number) => {
    setFilters((f) => ({
      ...f,
      watchProviders: f.watchProviders.includes(id)
        ? f.watchProviders.filter((p) => p !== id)
        : [...f.watchProviders, id],
    }));
  }, []);

  const setYearFrom = useCallback((v: number | null) => {
    setFilters((f) => ({ ...f, yearFrom: v }));
  }, []);

  const setYearTo = useCallback((v: number | null) => {
    setFilters((f) => ({ ...f, yearTo: v }));
  }, []);

  const setRatingMin = useCallback((v: number | null) => {
    setFilters((f) => ({ ...f, ratingMin: v }));
  }, []);

  const setOriginalLanguage = useCallback((v: string | null) => {
    setFilters((f) => ({ ...f, originalLanguage: v }));
  }, []);

  const toggleTvStatus = useCallback((s: TvStatus) => {
    setFilters((f) => ({
      ...f,
      tvStatus: f.tvStatus.includes(s) ? f.tvStatus.filter((x) => x !== s) : [...f.tvStatus, s],
    }));
  }, []);

  const setSortBy = useCallback((v: SortOption) => {
    setFilters((f) => ({ ...f, sortBy: v }));
  }, []);

  const setSortOrder = useCallback((v: SortOrder) => {
    setFilters((f) => ({ ...f, sortOrder: v }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const resetGenres = useCallback(() => {
    setFilters((f) => ({ ...f, genres: [], tvStatus: [] }));
  }, []);

  /* Changer de type : les genres traduits dans l'autre dictionnaire ; le
   * statut de diffusion n'a de sens que pour les séries. */
  const setGenres = useCallback((genres: number[], keepTvStatus: boolean) => {
    setFilters((f) => ({ ...f, genres, tvStatus: keepTvStatus ? f.tvStatus : [] }));
  }, []);

  const setSort = useCallback((sortBy: SortOption, sortOrder: SortOrder) => {
    setFilters((f) => ({ ...f, sortBy, sortOrder }));
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.genres.length > 0) count++;
    if (filters.watchProviders.length > 0) count++;
    if (filters.yearFrom != null || filters.yearTo != null) count++;
    if (filters.ratingMin != null) count++;
    if (filters.originalLanguage != null) count++;
    if (filters.tvStatus.length > 0) count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    filters,
    toggleGenre,
    toggleWatchProvider,
    setYearFrom,
    setYearTo,
    setRatingMin,
    setOriginalLanguage,
    toggleTvStatus,
    setSortBy,
    setSortOrder,
    resetFilters,
    resetGenres,
    setGenres,
    setSort,
    activeFilterCount,
    hasActiveFilters,
  };
}
