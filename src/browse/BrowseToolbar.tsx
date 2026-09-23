/* ------------------------------------------------------------------ */
/*  Vigie — La barre d'un parcours : type, tri, filtres                */
/* ------------------------------------------------------------------ */

/*
 * Trois commandes, dans l'ordre où l'on s'en sert : le type (Films, Séries,
 * Animés — un segmenté franc, plus une rangée de puces minuscules), le tri
 * (une liste native : le téléphone ouvre son propre sélecteur) et les filtres
 * avancés, qui disent combien sont actifs. Sur grand écran la barre reste
 * accrochée sous les onglets du hub : on filtre sans remonter la grille.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { DiscoverMediaType, SortOption, SortOrder } from "../api/types";
import { Segmented } from "../components/ui/Segmented";
import { ChevronDown, FilmIcon, FilterIcon, SortIcon, SparkIcon, TvIcon } from "../components/ui/icons";

const SORTS: ReadonlyArray<{ id: string; by: SortOption; order: SortOrder; key: string }> = [
  { id: "popularity.desc", by: "popularity", order: "desc", key: "seer:sortOptPopular" },
  { id: "vote_average.desc", by: "vote_average", order: "desc", key: "seer:sortOptRating" },
  { id: "release_date.desc", by: "release_date", order: "desc", key: "seer:sortOptNewest" },
  { id: "release_date.asc", by: "release_date", order: "asc", key: "seer:sortOptOldest" },
  { id: "title.asc", by: "title", order: "asc", key: "seer:sortOptTitle" },
];

interface Props {
  mediaType: DiscoverMediaType;
  onType: (type: DiscoverMediaType) => void;
  sortBy: SortOption;
  sortOrder: SortOrder;
  onSort: (by: SortOption, order: SortOrder) => void;
  filterCount: number;
  onOpenFilters: () => void;
  /** Tendances : films et séries mêlés, ni type ni filtre. */
  locked?: boolean;
}

export const BrowseToolbar = memo(function BrowseToolbar(props: Props) {
  const { mediaType, onType, sortBy, sortOrder, onSort, filterCount, onOpenFilters, locked } = props;
  const { t } = useTranslation("seer");
  if (locked) return null;

  const current = SORTS.find((s) => s.by === sortBy && s.order === sortOrder) ?? SORTS.find((s) => s.by === sortBy) ?? SORTS[0];
  const active = filterCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        ariaLabel={t("seer:mediaType")}
        value={mediaType}
        onChange={onType}
        stretch
        className="sm:w-auto sm:flex-none"
        options={[
          { value: "movies", label: t("seer:filterMovies"), icon: <FilmIcon className="h-4 w-4" /> },
          { value: "tv", label: t("seer:filterSeries"), icon: <TvIcon className="h-4 w-4" /> },
          { value: "anime", label: t("seer:filterAnimes"), icon: <SparkIcon className="h-4 w-4" /> },
        ]}
      />
      <label className="relative flex min-w-0 flex-1 sm:flex-none">
        <span className="sr-only">{t("seer:sortLabel")}</span>
        <SortIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tentacle-text-tertiary" />
        <select
          value={current.id}
          onChange={(e) => {
            const next = SORTS.find((s) => s.id === e.target.value);
            if (next) onSort(next.by, next.order);
          }}
          className="h-10 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-tentacle-fill-subtle pl-10 pr-9 text-sm font-semibold text-tentacle-text-secondary outline-none ring-1 ring-tentacle-border-subtle transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] sm:w-auto"
        >
          {SORTS.map((s) => <option key={s.id} value={s.id}>{t(s.key)}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tentacle-text-tertiary" />
      </label>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label={active ? t("seer:filtersActive", { count: filterCount }) : t("seer:filtersAdvanced")}
        className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] ${
          active
            ? "bg-[var(--brand-soft)] text-[var(--brand-light)] ring-[rgba(var(--brand-rgb),0.45)]"
            : "bg-tentacle-fill-subtle text-tentacle-text-secondary ring-tentacle-border-subtle hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary"
        }`}
      >
        <FilterIcon className="h-4 w-4" />
        <span className="hidden min-[400px]:inline">{t("seer:filtersAdvanced")}</span>
        {active && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-bold tabular-nums text-white">
            {filterCount}
          </span>
        )}
      </button>
    </div>
  );
});
