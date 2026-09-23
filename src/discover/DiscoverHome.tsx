/* ------------------------------------------------------------------ */
/*  Vigie — L'accueil de Découvrir                                     */
/* ------------------------------------------------------------------ */

/*
 * De haut en bas, du plus personnel au plus large : la vitrine du moment,
 * l'entrée du catalogue (films, séries, animés, filtres — tout de suite, pas
 * au bas de la page), ses demandes, ses sorties de la semaine, puis les
 * rangées et les raccourcis par plateforme et par genre. Chaque rangée
 * s'ouvre en grille complète (« Tout voir »), avec filtres.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useHub, type BrowsePreset } from "../hub/HubContext";
import type { HubData } from "../hub/useHubData";
import { Rail } from "../components/ui/Rail";
import { PosterCard, PosterCardSkeleton } from "../components/ui/PosterCard";
import { CTA_SECONDARY, CTA_SIZE_LG } from "../styles/cta";
import { popularPreset, topRatedPreset, trendingPreset, upcomingPreset } from "../browse/presets";
import { HeroSpotlight } from "./HeroSpotlight";
import { MyRequestsStrip, ThisWeekStrip } from "./HomeStrips";
import { CatalogEntrances, GenreShortcuts, PlatformShortcuts } from "./BrowseShortcuts";
import { useRail, type RailId } from "./useRails";

function CatalogRail({ id, title, preset }: {
  id: RailId;
  title: string;
  preset: BrowsePreset;
}) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const { data, isPending } = useRail(id);
  const items = (data?.results ?? []).filter((i) => i.mediaType !== "person");
  if (!isPending && items.length === 0) return null;
  return (
    <Rail title={title} action={{ label: t("seer:seeAll"), onClick: () => hub.browse(preset) }}>
      {isPending
        ? Array.from({ length: 8 }, (_, i) => <PosterCardSkeleton key={i} />)
        : items.map((item, i) => (
          <PosterCard
            key={`${item.mediaType}:${item.id}`}
            item={item}
            onOpen={hub.openMedia}
            onQuickRequest={hub.quickRequest}
            eager={i < 6}
          />
        ))}
    </Rail>
  );
}

export const DiscoverHome = memo(function DiscoverHome({ data }: { data: HubData }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const trending = useRail("trending");

  return (
    <div className="space-y-10">
      <HeroSpotlight items={trending.data?.results ?? []} />
      <CatalogEntrances />
      <MyRequestsStrip data={data} />
      <ThisWeekStrip data={data} />
      <CatalogRail id="trending" title={t("seer:railTrending")} preset={trendingPreset(t)} />
      <CatalogRail id="movies" title={t("seer:railPopularMovies")} preset={popularPreset(t, "movies")} />
      <CatalogRail id="series" title={t("seer:railPopularSeries")} preset={popularPreset(t, "tv")} />
      <PlatformShortcuts />
      <CatalogRail id="upcoming" title={t("seer:railUpcomingMovies")} preset={upcomingPreset(t, "movies")} />
      <CatalogRail id="anime" title={t("seer:railPopularAnime")} preset={popularPreset(t, "anime")} />
      <CatalogRail id="top" title={t("seer:railTopMovies")} preset={topRatedPreset(t, "movies")} />
      <GenreShortcuts />
      <div className="flex justify-center pb-4">
        <button type="button" onClick={() => hub.openCatalog()} className={`${CTA_SECONDARY} ${CTA_SIZE_LG}`}>
          {t("seer:browseEverything")}
        </button>
      </div>
    </div>
  );
});
