/* ------------------------------------------------------------------ */
/*  Vigie — Parcourir le catalogue                                     */
/* ------------------------------------------------------------------ */

/*
 * Ce qu'ouvre un « Tout voir » : la grille entière d'un parcours (films
 * populaires, une plateforme, un genre…), avec le type, le tri et les filtres
 * à portée de main. Le nombre de titres s'affiche d'emblée et l'ascenseur a sa
 * vraie taille : on peut descendre loin, vite — seules les pages regardées se
 * chargent (`useSparseCatalog`), seules les rangées visibles existent
 * (`VirtualGrid`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DiscoverMediaType } from "../api/types";
import { fetchBrowsePage } from "../api/client-browse";
import { useDiscoverFilters } from "../hooks/useDiscoverFilters";
import { useHub, type BrowsePreset } from "../hub/HubContext";
import { PosterCard, PosterCardSkeleton } from "../components/ui/PosterCard";
import { ChevronLeft, FilterIcon } from "../components/ui/icons";
import { FilterPanel } from "../components/FilterPanel";
import { ActiveFilterPills } from "../components/ActiveFilterPills";
import { EmptyState } from "../components/EmptyState";
import { segment, SEGMENT_GROUP } from "../styles/pills";
import { CTA_SECONDARY, CTA_SIZE_MD } from "../styles/cta";
import { getCurrentLanguage } from "../utils/media-helpers";
import { useSparseCatalog } from "./useSparseCatalog";
import { VirtualGrid } from "./VirtualGrid";

const TYPES: Array<{ value: DiscoverMediaType; key: string }> = [
  { value: "movies", key: "seer:filterMovies" },
  { value: "tv", key: "seer:filterSeries" },
  { value: "anime", key: "seer:filterAnimes" },
];

export function BrowseView({ preset, active, onBack }: { preset: BrowsePreset; active: boolean; onBack: () => void }) {
  const { t, i18n } = useTranslation("seer");
  const hub = useHub();
  const [mediaType, setMediaType] = useState<DiscoverMediaType>(preset.mediaType);
  const [panelOpen, setPanelOpen] = useState(false);
  const f = useDiscoverFilters(preset.filters);
  const { filters } = f;
  const trending = preset.source === "trending";

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
  useEffect(() => { window.scrollTo({ top: 0 }); }, [key]);

  // Les identifiants de genre ne sont pas les mêmes pour les films et les séries.
  const changeType = (next: DiscoverMediaType) => {
    if (next === mediaType) return;
    f.resetGenres();
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
        <button
          type="button"
          onClick={onBack}
          aria-label={t("seer:backToDiscover")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tentacle-fill-subtle text-tentacle-text-primary ring-1 ring-tentacle-border-subtle transition-colors hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight text-tentacle-text-primary sm:text-2xl">{preset.title}</h2>
          {catalog.total !== null && (
            <p className="text-xs tabular-nums text-tentacle-text-tertiary">
              {t(catalog.capped ? "seer:titlesCountCapped" : "seer:titlesCount", {
                count: catalog.total,
                n: new Intl.NumberFormat(getCurrentLanguage()).format(catalog.total),
              })}
            </p>
          )}
        </div>
      </div>

      {!trending && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className={SEGMENT_GROUP} role="tablist" aria-label={t("seer:mediaType")}>
            {TYPES.map((type) => (
              <button key={type.value} type="button" role="tab" aria-selected={mediaType === type.value} onClick={() => changeType(type.value)} className={`${segment(mediaType === type.value)} min-h-[32px]`}>
                {t(type.key)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setPanelOpen(true)} className={`${CTA_SECONDARY} h-9 gap-1.5 px-3 text-xs`}>
            <FilterIcon className="h-4 w-4" />
            {t("seer:filterTitle")}
            {f.activeFilterCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-tentacle-brand px-1 text-[10px] font-bold text-tentacle-cta-brand-fg">{f.activeFilterCount}</span>
            )}
          </button>
        </div>
      )}

      {!trending && (
        <ActiveFilterPills
          mediaType={mediaType}
          filters={filters}
          totalResults={undefined}
          onRemoveGenre={f.toggleGenre}
          onRemoveWatchProvider={f.toggleWatchProvider}
          onClearYears={() => { f.setYearFrom(null); f.setYearTo(null); }}
          onClearRating={() => f.setRatingMin(null)}
          onClearLanguage={() => f.setOriginalLanguage(null)}
          onRemoveTvStatus={f.toggleTvStatus}
          onReset={f.resetFilters}
          hasActiveFilters={f.hasActiveFilters}
        />
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
