/* ------------------------------------------------------------------ */
/*  Vigie — Parcourir le catalogue                                     */
/* ------------------------------------------------------------------ */

/*
 * Ce qu'ouvre un « Tout voir », et l'onglet Catalogue : la grille entière d'un
 * parcours (films populaires, une plateforme, un genre, tout le catalogue),
 * avec le type, le tri et les filtres à portée de main. Le titre suit le type
 * choisi (« Séries populaires » dès qu'on passe aux séries), et un genre
 * survit au changement de type quand il y a un équivalent. « Tous » mêle
 * films et séries, en alternance (cf. mixCatalogs).
 *
 * Le nombre de titres s'affiche d'emblée et l'ascenseur a sa vraie taille :
 * on peut descendre loin, vite — seules les pages regardées se chargent
 * (`useSparseCatalog`), seules les rangées visibles existent (`VirtualGrid`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BrowseType, DiscoverMediaType } from "../api/types";
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
import { useMixedCatalog } from "./mixCatalogs";
import { VirtualGrid } from "./VirtualGrid";
import { BrowseToolbar } from "./BrowseToolbar";
import { mapGenres, presetTitle } from "./presetTitle";

interface Props {
  preset: BrowsePreset;
  active: boolean;
  /** Arrivé d'un autre onglet (« Tout voir » de Découvrir) : le chemin du retour. */
  back?: { label: string; run: () => void };
  /** Ouvre les filtres avancés à l'arrivée. */
  openFilters?: boolean;
}

export function BrowseView({ preset, active, back, openFilters = false }: Props) {
  const { t, i18n } = useTranslation("seer");
  const hub = useHub();
  const [mediaType, setMediaType] = useState<BrowseType>(preset.mediaType);
  const [panelOpen, setPanelOpen] = useState(openFilters);
  const f = useDiscoverFilters(preset.filters);
  const { filters } = f;
  const trending = preset.source === "trending";
  const title = presetTitle(preset, mediaType, filters, t);

  // « Tous » : les films d'un côté, les séries de l'autre — genres traduits ;
  // un genre sans équivalent en séries (Horreur) ne laisse que les films.
  const mixed = mediaType === "all";
  const primary: DiscoverMediaType = mixed ? "movies" : mediaType;
  const tvFilters = useMemo(
    () => ({ ...filters, genres: mapGenres(filters.genres, "movies", "tv"), tvStatus: [] }),
    [filters],
  );
  const seriesPossible = tvFilters.genres.length === filters.genres.length;

  const key = useMemo(
    () => JSON.stringify([preset.id, primary, filters, i18n.language]),
    [preset.id, primary, filters, i18n.language],
  );
  const seriesKey = useMemo(() => JSON.stringify([preset.id, "mix:tv", tvFilters, i18n.language]), [preset.id, tvFilters, i18n.language]);
  const fetchPage = useCallback(
    (page: number) => fetchBrowsePage({ ...preset, mediaType: primary }, filters, page, false),
    [preset, primary, filters],
  );
  const fetchSeries = useCallback(
    (page: number) => fetchBrowsePage({ ...preset, mediaType: "tv" }, tvFilters, page, false),
    [preset, tvFilters],
  );
  const first = useSparseCatalog(key, fetchPage);
  const second = useSparseCatalog(seriesKey, fetchSeries, mixed && seriesPossible);
  const catalog = useMixedCatalog(first, second, mixed);

  // Un autre parcours, un autre filtre, un autre type : on repart du haut de la grille.
  useEffect(() => { if (active) window.scrollTo({ top: 0 }); }, [key, mixed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Les genres ne portent pas les mêmes identifiants pour les films et les séries.
  const changeType = (next: BrowseType) => {
    if (next === mediaType) return;
    f.setGenres(mapGenres(filters.genres, mediaType, next), next === "tv" || next === "anime");
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
      <div className="mb-3 flex items-center gap-3 sm:mb-4">
        {back && (
          <button
            type="button"
            onClick={back.run}
            aria-label={back.label}
            title={back.label}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tentacle-fill-subtle text-tentacle-text-primary ring-1 ring-tentacle-border-subtle transition-colors hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-xl font-extrabold tracking-tight text-tentacle-text-primary sm:text-3xl">{title}</h2>
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
        // Accrochée sous les onglets du hub, au téléphone aussi : une seule
        // rangée, on change de type ou de filtres sans remonter la grille.
        <div className="sticky top-[49px] z-20 -mx-4 mb-4 space-y-2 bg-tentacle-surface-0 px-4 py-2 sm:space-y-3 md:-mx-8 md:px-8">
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
