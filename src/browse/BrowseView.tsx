/* ------------------------------------------------------------------ */
/*  Vigie — Parcourir le catalogue                                     */
/* ------------------------------------------------------------------ */

/*
 * Ce qu'ouvre un « Tout voir », et l'onglet Catalogue : la grille entière d'un
 * parcours (films populaires, une plateforme, un genre, tout le catalogue),
 * avec le type, le tri et les filtres à portée de main. Le titre suit le type
 * choisi (« Séries populaires » dès qu'on passe aux séries), et un genre
 * survit au changement de type quand il y a un équivalent.
 *
 * Le nombre de titres s'affiche d'emblée et l'ascenseur a sa vraie taille :
 * on peut descendre loin, vite — seules les pages regardées se chargent
 * (`useSparseCatalog`), seules les rangées visibles existent (`VirtualGrid`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DiscoverMediaType } from "../api/types";
import { fetchBrowsePage } from "../api/client-browse";
import { useDiscoverFilters } from "../hooks/useDiscoverFilters";
import { useHub, type BrowsePreset } from "../hub/HubContext";
import { PosterCard, PosterCardSkeleton } from "../components/ui/PosterCard";
import { ChevronLeft } from "../components/ui/icons";
import { FilterPanel } from "../components/FilterPanel";
import { ActiveFilterPills } from "../components/ActiveFilterPills";
import { EmptyState } from "../components/EmptyState";
import { CTA_SECONDARY, CTA_SIZE_MD } from "../styles/cta";
import { getCurrentLanguage } from "../utils/media-helpers";
import { useSparseCatalog } from "./useSparseCatalog";
import { VirtualGrid } from "./VirtualGrid";
import { BrowseToolbar } from "./BrowseToolbar";
import { mapGenres, presetTitle } from "./presetTitle";

interface Props {
  preset: BrowsePreset;
  active: boolean;
  /** Absent dans l'onglet Catalogue : on n'en revient pas, on en part. */
  onBack?: () => void;
  /** Ouvre les filtres avancés à l'arrivée. */
  openFilters?: boolean;
}

export function BrowseView({ preset, active, onBack, openFilters = false }: Props) {
  const { t, i18n } = useTranslation("seer");
  const hub = useHub();
  const [mediaType, setMediaType] = useState<DiscoverMediaType>(preset.mediaType);
  const [panelOpen, setPanelOpen] = useState(openFilters);
  const f = useDiscoverFilters(preset.filters);
  const { filters } = f;
  const trending = preset.source === "trending";
  const title = presetTitle(preset, mediaType, filters, t);

  const key = useMemo(
    () => JSON.stringify([preset.id, mediaType, filters, i18n.language]),
    [preset.id, mediaType, filters, i18n.language],
  );
  const fetchPage = useCallback(
    (page: number) => fetchBrowsePage({ ...preset, mediaType }, filters, page, false),
    [preset, mediaType, filters],
  );
  const catalog = useSparseCatalog(key, fetchPage);

  // Un autre parcours, un autre filtre : on repart du haut de la grille.
  useEffect(() => { if (active) window.scrollTo({ top: 0 }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Les genres ne portent pas les mêmes identifiants pour les films et les séries.
  const changeType = (next: DiscoverMediaType) => {
    if (next === mediaType) return;
    f.setGenres(mapGenres(filters.genres, mediaType, next), next !== "movies");
    setMediaType(next);
  };

  const { itemAt, version } = catalog;
  const renderItem = useCallback((index: number) => {
    const item = itemAt(index);
    return item
      ? <PosterCard item={item} onOpen={hub.openMedia} onQuickRequest={hub.quickRequest} />
      : <PosterCardSkeleton />;
    // `version` : une page arrivée redessine les cases qui l'attendaient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemAt, version, hub.openMedia, hub.quickRequest]);

  const count = catalog.total ?? 24;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("seer:backToDiscover")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tentacle-fill-subtle text-tentacle-text-primary ring-1 ring-tentacle-border-subtle transition-colors hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-extrabold tracking-tight text-tentacle-text-primary sm:text-3xl">{title}</h2>
          <p className="mt-0.5 text-xs tabular-nums text-tentacle-text-tertiary sm:text-sm">
            {catalog.total !== null
              ? t(catalog.capped ? "seer:titlesCountCapped" : "seer:titlesCount", {
                count: catalog.total,
                n: new Intl.NumberFormat(getCurrentLanguage()).format(catalog.total),
              })
              : " "}
          </p>
        </div>
      </div>

      {!trending && (
        <div className="-mx-4 mb-4 space-y-3 bg-tentacle-surface-0 px-4 py-2 sm:sticky sm:top-[49px] sm:z-20 md:-mx-8 md:px-8">
          <BrowseToolbar
            mediaType={mediaType}
            onType={changeType}
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={f.setSort}
            filterCount={f.activeFilterCount}
            onOpenFilters={() => setPanelOpen(true)}
          />
          <ActiveFilterPills
            mediaType={mediaType}
            filters={filters}
            onRemoveGenre={f.toggleGenre}
            onRemoveWatchProvider={f.toggleWatchProvider}
            onClearYears={() => { f.setYearFrom(null); f.setYearTo(null); }}
            onClearRating={() => f.setRatingMin(null)}
            onClearLanguage={() => f.setOriginalLanguage(null)}
            onRemoveTvStatus={f.toggleTvStatus}
            onReset={f.resetFilters}
            hasActiveFilters={f.hasActiveFilters}
          />
        </div>
      )}

      {catalog.error && catalog.total === null ? (
        <EmptyState
          title={t("seer:connectionError")}
          action={<button type="button" onClick={catalog.retry} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>{t("seer:retry")}</button>}
        />
      ) : catalog.total === 0 ? (
        <EmptyState title={t("seer:noContent")} subtitle={t("seer:noContentHint")} />
      ) : (
        <VirtualGrid count={count} renderItem={renderItem} onRange={catalog.ensureRange} active={active} />
      )}

      <FilterPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        mediaType={mediaType}
        filters={filters}
        onToggleGenre={f.toggleGenre}
        onToggleWatchProvider={f.toggleWatchProvider}
        onYearFromChange={f.setYearFrom}
        onYearToChange={f.setYearTo}
        onRatingMinChange={f.setRatingMin}
        onLanguageChange={f.setOriginalLanguage}
        onToggleTvStatus={f.toggleTvStatus}
        onSortByChange={f.setSortBy}
        onSortOrderChange={f.setSortOrder}
        onReset={f.resetFilters}
        activeFilterCount={f.activeFilterCount}
        resultCount={catalog.total}
      />
    </div>
  );
}
