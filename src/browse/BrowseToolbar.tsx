/* ------------------------------------------------------------------ */
/*  Vigie — La barre d'un parcours : type, tri, filtres                */
/* ------------------------------------------------------------------ */

/*
 * Trois commandes, dans l'ordre où l'on s'en sert : le type (Films, Séries,
 * Animés — un segmenté franc, plus une rangée de puces minuscules), le tri
 * (une liste native : le téléphone ouvre son propre sélecteur) et les filtres
 * avancés, qui disent combien sont actifs. La barre reste accrochée sous les
 * onglets du hub : on filtre sans remonter la grille.
 *
 * Au téléphone, UNE rangée : le type et le bouton des filtres. Le tri vit en
 * tête du panneau de filtres (il y était déjà) — deux rangées accrochées
 * mangeaient le quart de l'écran au-dessus de la grille.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { BrowseType, SortOption, SortOrder } from "../api/types";
import { Segmented } from "../components/ui/Segmented";
import { FilterButton } from "../components/ui/FilterButton";
import { ChevronDown, FilmIcon, LayersIcon, SortIcon, SparkIcon, TvIcon } from "../components/ui/icons";

const SORTS: ReadonlyArray<{ id: string; by: SortOption; order: SortOrder; key: string }> = [
  { id: "popularity.desc", by: "popularity", order: "desc", key: "seer:sortOptPopular" },
  { id: "vote_average.desc", by: "vote_average", order: "desc", key: "seer:sortOptRating" },
  { id: "release_date.desc", by: "release_date", order: "desc", key: "seer:sortOptNewest" },
  { id: "release_date.asc", by: "release_date", order: "asc", key: "seer:sortOptOldest" },
  { id: "title.asc", by: "title", order: "asc", key: "seer:sortOptTitle" },
];

interface Props {
  mediaType: BrowseType;
  onType: (type: BrowseType) => void;
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

  return (
    <div className="flex items-center gap-2 sm:flex-wrap">
      <Segmented
        ariaLabel={t("seer:mediaType")}
        value={mediaType}
        onChange={onType}
        stretch="mobile"
        size="adaptive"
        className="min-w-0 flex-1 sm:flex-none"
        // Quatre segments au téléphone : les icônes n'y tiendraient pas.
        options={[
          { value: "all", label: t("seer:filterAllTypes"), icon: <LayersIcon className="hidden h-4 w-4 sm:block" /> },
          { value: "movies", label: t("seer:filterMovies"), icon: <FilmIcon className="hidden h-4 w-4 sm:block" /> },
          { value: "tv", label: t("seer:filterSeries"), icon: <TvIcon className="hidden h-4 w-4 sm:block" /> },
          { value: "anime", label: t("seer:filterAnimes"), icon: <SparkIcon className="hidden h-4 w-4 sm:block" /> },
        ]}
      />
      <label className="relative hidden min-w-0 flex-1 sm:flex sm:flex-none">
        <span className="sr-only">{t("seer:sortLabel")}</span>
        <SortIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tentacle-text-tertiary" />
        <select
          value={current.id}
          onChange={(e) => {
            const next = SORTS.find((s) => s.id === e.target.value);
            if (next) onSort(next.by, next.order);
          }}
          // La liste native se dessine dans le schéma de l'hôte : ouverte, elle
          // était blanche, texte blanc compris, en thème sombre.
          style={{ colorScheme: "var(--vg-color-scheme)" }}
          className="h-10 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-tentacle-fill-subtle pl-10 pr-9 text-sm font-semibold text-tentacle-text-secondary outline-none ring-1 ring-tentacle-border-subtle transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] sm:w-auto"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id} className="bg-[var(--surface-2)] text-[var(--text-primary)]">{t(s.key)}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tentacle-text-tertiary" />
      </label>
      <FilterButton count={filterCount} onClick={onOpenFilters} compact />
    </div>
  );
});
