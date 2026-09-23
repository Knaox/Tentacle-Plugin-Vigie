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
import type { DiscoverMediaType, DiscoverFilters, SortOption, SortOrder, TvStatus } from "../api/types";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  mediaType: DiscoverMediaType;
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

export function FilterPanel({
  open,
  onClose,
  mediaType,
  filters,
  onToggleGenre,
  onToggleWatchProvider,
  onYearFromChange,
  onYearToChange,
  onRatingMinChange,
  onLanguageChange,
  onToggleTvStatus,
  onSortByChange,
  onSortOrderChange,
  onReset,
  activeFilterCount,
  resultCount,
}: FilterPanelProps) {
  const { t } = useTranslation("seer");
  const genres = mediaType === "movies" ? MOVIE_GENRES : TV_GENRES;

  return (
    <FilterSheet
      open={open}
      onClose={onClose}
      title={t("filterTitle")}
      activeCount={activeFilterCount}
      onReset={onReset}
      footerLabel={resultCount != null ? t("filterShowResults", { count: resultCount }) : undefined}
    >
      {/* Chaque famille de filtres dans une section repliable. Auparavant les
          sept sections étaient dépliées d'un coup : plusieurs écrans de
          défilement où tout se ressemblait, et les valeurs déjà cochées se
          perdaient dans la masse. */}
      <>

          <FilterSection title={t("filterSort")} alwaysOpen>
            <div className="flex flex-wrap items-center gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortByChange(opt.value)}
                  aria-pressed={filters.sortBy === opt.value}
                  className={pill(filters.sortBy === opt.value)}
                >
                  {t(opt.key)}
                </button>
              ))}
              <button
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
            onClear={() => filters.genres.forEach(onToggleGenre)}
          >
            <GenreFilter genres={genres} selected={filters.genres} onToggle={onToggleGenre} />
          </FilterSection>

          <FilterSection
            title={t("filterPlatforms")}
            count={filters.watchProviders.length}
            onClear={() => filters.watchProviders.forEach(onToggleWatchProvider)}
          >
            <PlatformFilter selected={filters.watchProviders} onToggle={onToggleWatchProvider} />
          </FilterSection>

          <FilterSection
            title={t("filterYear")}
            count={(filters.yearFrom ? 1 : 0) + (filters.yearTo ? 1 : 0)}
            onClear={() => { onYearFromChange(null); onYearToChange(null); }}
          >
            <YearRangeFilter
              yearFrom={filters.yearFrom}
              yearTo={filters.yearTo}
              onYearFromChange={onYearFromChange}
              onYearToChange={onYearToChange}
            />
          </FilterSection>

          <FilterSection
            title={t("filterRating")}
            count={filters.ratingMin ? 1 : 0}
            onClear={() => onRatingMinChange(null)}
          >
            <RatingSlider value={filters.ratingMin} onChange={onRatingMinChange} />
          </FilterSection>

          <FilterSection
            title={t("filterLanguage")}
            count={filters.originalLanguage ? 1 : 0}
            onClear={() => onLanguageChange(null)}
          >
            {/* Douze langues : des pilules se parcourent d'un regard, là où une
                liste déroulante oblige à ouvrir puis chercher. */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onLanguageChange(null)}
                aria-pressed={!filters.originalLanguage}
                className={pill(!filters.originalLanguage)}
              >
                {t("filterLanguageAll")}
              </button>
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => onLanguageChange(filters.originalLanguage === l.code ? null : l.code)}
                  aria-pressed={filters.originalLanguage === l.code}
                  className={pill(filters.originalLanguage === l.code)}
                >
                  {t(l.key)}
                </button>
              ))}
            </div>
          </FilterSection>

          {mediaType === "tv" && (
            <FilterSection
              title={t("filterTvStatus")}
              count={filters.tvStatus.length}
              onClear={() => filters.tvStatus.forEach(onToggleTvStatus)}
            >
              <div className="flex flex-wrap gap-2">
                {TV_STATUSES.map((s) => {
                  const active = filters.tvStatus.includes(s.value as TvStatus);
                  return (
                    <button
                      key={s.value}
                      onClick={() => onToggleTvStatus(s.value as TvStatus)}
                      aria-pressed={active}
                      className={pill(active)}
                    >
                      {t(s.key)}
                    </button>
                  );
                })}
              </div>
            </FilterSection>
          )}
      </>
    </FilterSheet>
  );
}
