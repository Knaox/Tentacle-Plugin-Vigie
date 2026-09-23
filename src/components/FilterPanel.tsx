import { useTranslation } from "react-i18next";
import { GenreFilter } from "./GenreFilter";
import { PlatformFilter } from "./PlatformFilter";
import { YearRangeFilter } from "./YearRangeFilter";
import { RatingSlider } from "./RatingSlider";
import { FilterSection } from "./filters/FilterSection";
import { FilterSheet } from "./filters/FilterSheet";
import { pill, ICON_BUTTON } from "../styles/pills";
import { MOVIE_GENRES, TV_GENRES } from "../constants/genres";
import { LANGUAGES } from "../constants/languages";
import { TV_STATUSES } from "../constants/tv-statuses";
import { useCalendarProviders } from "../hooks/useReleases";
import { PLATFORMS } from "../utils/platforms";
import { getCurrentLanguage } from "../utils/media-helpers";
import type { BrowseType, DiscoverFilters, SortOption, SortOrder, TvStatus } from "../api/types";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  mediaType: BrowseType;
  filters: DiscoverFilters;
  onToggleGenre: (id: number) => void;
  onToggleWatchProvider: (id: number) => void;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
  onRatingMinChange: (v: number | null) => void;
  onLanguageChange: (v: string | null) => void;
  onToggleTvStatus: (s: TvStatus) => void;
  onSortByChange: (v: SortOption) => void;
  onSortOrderChange: (v: SortOrder) => void;
  onReset: () => void;
  activeFilterCount: number;
  /** Nombre de titres correspondant aux filtres, pour le bouton de sortie. */
  resultCount?: number | null;
}

const SORT_OPTIONS: { value: SortOption; key: string }[] = [
  { value: "popularity", key: "sortPopularity" },
  { value: "vote_average", key: "sortRating" },
  { value: "release_date", key: "sortRecent" },
  { value: "title", key: "sortTitle" },
];

/**
 * Les filtres avancés du catalogue. Chaque famille dans une section repliable
 * qui, repliée, dit ce qu'elle retient ; le statut de diffusion n'existe que
 * pour ce qui se diffuse (séries et animés).
 */
export function FilterPanel({
  open, onClose, mediaType, filters, onToggleGenre, onToggleWatchProvider,
  onYearFromChange, onYearToChange, onRatingMinChange, onLanguageChange, onToggleTvStatus,
  onSortByChange, onSortOrderChange, onReset, activeFilterCount, resultCount,
}: FilterPanelProps) {
  const { t } = useTranslation("seer");
  const { data: providers } = useCalendarProviders();
  // « Tous » filtre avec les genres des films ; la source séries en reçoit la traduction.
  const genres = mediaType === "movies" || mediaType === "all" ? MOVIE_GENRES : TV_GENRES;
  const names = (keys: Array<string | null | undefined>) => keys.filter(Boolean).join(", ");
  const providerName = (id: number) =>
    providers?.results?.find((p) => p.id === id)?.name ?? PLATFORMS.find((p) => p.id === id)?.name;
  const years = filters.yearFrom != null || filters.yearTo != null
    ? `${filters.yearFrom ?? "…"} – ${filters.yearTo ?? "…"}` : undefined;

  return (
    <FilterSheet
      open={open}
      onClose={onClose}
      title={t("seer:filtersAdvanced")}
      activeCount={activeFilterCount}
      onReset={onReset}
      footerLabel={resultCount != null
        ? t("filterShowResults", { count: resultCount, n: new Intl.NumberFormat(getCurrentLanguage()).format(resultCount) })
        : undefined}
    >
      <FilterSection title={t("filterSort")} alwaysOpen>
        <div className="flex flex-wrap items-center gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSortByChange(opt.value)}
              aria-pressed={filters.sortBy === opt.value}
              className={pill(filters.sortBy === opt.value)}
            >
              {t(opt.key)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSortOrderChange(filters.sortOrder === "desc" ? "asc" : "desc")}
            className={ICON_BUTTON}
            title={filters.sortOrder === "desc" ? t("sortOrderDesc") : t("sortOrderAsc")}
            aria-label={filters.sortOrder === "desc" ? t("sortOrderDesc") : t("sortOrderAsc")}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {filters.sortOrder === "desc" ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
              )}
            </svg>
          </button>
        </div>
      </FilterSection>

      <FilterSection
        title={t("filterGenres")}
        count={filters.genres.length}
        summary={names(filters.genres.map((id) => { const g = genres.find((x) => x.id === id); return g ? t(g.key) : null; }))}
        onClear={() => filters.genres.forEach(onToggleGenre)}
      >
        <GenreFilter genres={genres} selected={filters.genres} onToggle={onToggleGenre} />
      </FilterSection>

      <FilterSection
        title={t("filterPlatforms")}
        count={filters.watchProviders.length}
        summary={names(filters.watchProviders.map(providerName))}
        onClear={() => filters.watchProviders.forEach(onToggleWatchProvider)}
      >
        <PlatformFilter selected={filters.watchProviders} onToggle={onToggleWatchProvider} />
      </FilterSection>

      <FilterSection
        title={t("filterYear")}
        count={(filters.yearFrom ? 1 : 0) + (filters.yearTo ? 1 : 0)}
        summary={years}
        onClear={() => { onYearFromChange(null); onYearToChange(null); }}
      >
        <YearRangeFilter yearFrom={filters.yearFrom} yearTo={filters.yearTo} onYearFromChange={onYearFromChange} onYearToChange={onYearToChange} />
      </FilterSection>

      <FilterSection
        title={t("filterRating")}
        count={filters.ratingMin ? 1 : 0}
        summary={filters.ratingMin ? `★ ${filters.ratingMin.toFixed(1)}+` : undefined}
        onClear={() => onRatingMinChange(null)}
      >
        <RatingSlider value={filters.ratingMin} onChange={onRatingMinChange} />
      </FilterSection>

      <FilterSection
        title={t("filterLanguage")}
        count={filters.originalLanguage ? 1 : 0}
        summary={filters.originalLanguage ? t(LANGUAGES.find((l) => l.code === filters.originalLanguage)?.key ?? "") : undefined}
        onClear={() => onLanguageChange(null)}
      >
        {/* Douze langues : des pilules se parcourent d'un regard, là où une
            liste déroulante oblige à ouvrir puis chercher. */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onLanguageChange(null)} aria-pressed={!filters.originalLanguage} className={pill(!filters.originalLanguage)}>
            {t("filterLanguageAll")}
          </button>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => onLanguageChange(filters.originalLanguage === l.code ? null : l.code)}
              aria-pressed={filters.originalLanguage === l.code}
              className={pill(filters.originalLanguage === l.code)}
            >
              {t(l.key)}
            </button>
          ))}
        </div>
      </FilterSection>

      {(mediaType === "tv" || mediaType === "anime") && (
        <FilterSection
          title={t("filterTvStatus")}
          count={filters.tvStatus.length}
          summary={names(filters.tvStatus.map((v) => { const s = TV_STATUSES.find((x) => x.value === v); return s ? t(s.key) : null; }))}
          onClear={() => filters.tvStatus.forEach(onToggleTvStatus)}
        >
          <div className="flex flex-wrap gap-2">
            {TV_STATUSES.map((s) => {
              const active = filters.tvStatus.includes(s.value as TvStatus);
              return (
                <button key={s.value} type="button" onClick={() => onToggleTvStatus(s.value as TvStatus)} aria-pressed={active} className={pill(active)}>
                  {t(s.key)}
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}
    </FilterSheet>
  );
}
