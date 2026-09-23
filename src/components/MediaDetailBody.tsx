/* ------------------------------------------------------------------ */
/*  Vigie — Le corps d'une fiche                                       */
/* ------------------------------------------------------------------ */

/*
 * Sous l'en-tête : l'histoire, le prochain épisode, les saisons (leur état,
 * celui de chaque épisode, et leur demande), les extras, la distribution —
 * et, en colonne à droite sur grand écran, où le regarder, par où il est
 * sorti, sa fiche. Les titres semblables ferment la page, sur toute la
 * largeur.
 */

import { useContext } from "react";
import { useTranslation } from "react-i18next";
import type {
  SeerrCastMember, SeerrMovieDetail, SeerrSearchResult, SeerrSeason, SeerrTvDetail,
} from "../api/types";
import type { AvailabilityVerdict, SeriesEpisodeStates } from "../api/types-releases";
import type { RichTrailer } from "../utils/trailers";
import { airTimeKey } from "../hooks/useAirTimes";
import { HubContext } from "../hub/HubContext";
import { NextEpisodeBanner } from "./NextEpisodeBanner";
import { ExtrasRow } from "./ExtrasRow";
import { CastRow } from "./CastRow";
import { SeasonsSection } from "./detail/SeasonsSection";
import { DetailInfo, type WatchProviderEntry } from "./detail/DetailInfo";
import { Rail, SectionHeader } from "./ui/Rail";
import { PosterCard } from "./ui/PosterCard";

/** Là où mène le bouton « Choisir les saisons » de l'en-tête. */
export const SEASONS_ANCHOR = "vigie-seasons";

interface Props {
  currentItem: SeerrSearchResult;
  detail: SeerrMovieDetail | SeerrTvDetail | undefined;
  mediaType: "movie" | "tv";
  isLoading: boolean;
  trailers: RichTrailer[];
  onOpenTrailer: (index: number) => void;
  overview: string | undefined;
  synopsisExpanded: boolean;
  onToggleSynopsis: () => void;
  tvSeasons: SeerrSeason[];
  seasonLocks: Map<number, number>;
  episodeStates: SeriesEpisodeStates | undefined;
  airTimes: Map<string, string>;
  onSeasonRequest: (seasons: number[], profileId: string | null) => void;
  requestingSeasons: boolean;
  isAnime: boolean;
  defaultProfileId?: string | null;
  verdict: AvailabilityVerdict | null;
  providers: WatchProviderEntry[] | undefined;
  inLibrary: boolean;
  cast: SeerrCastMember[] | undefined;
  similar: SeerrSearchResult[] | undefined;
  onSelectSimilar: (item: SeerrSearchResult) => void;
}

export function MediaDetailBody(props: Props) {
  const {
    currentItem, detail, mediaType, isLoading, trailers, onOpenTrailer, overview, synopsisExpanded, onToggleSynopsis,
    tvSeasons, seasonLocks, episodeStates, airTimes, onSeasonRequest, requestingSeasons, isAnime, defaultProfileId,
    verdict, providers, inLibrary, cast, similar, onSelectSimilar,
  } = props;
  const { t } = useTranslation("seer");
  const hub = useContext(HubContext);
  const tv = mediaType === "tv" ? (detail as SeerrTvDetail | undefined) : undefined;
  const tagline = (detail as { tagline?: string } | undefined)?.tagline;
  const next = tv?.nextEpisodeToAir;
  // Suivie par le serveur (quelqu'un l'a demandée) : son épisode est au calendrier du serveur.
  const requested = (tv?.mediaInfo?.requests?.length ?? 0) > 0 || seasonLocks.size > 0;

  return (
    <div className="px-4 pb-10 pt-7 md:px-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
        <div className="min-w-0 space-y-9">
          {overview && (
            <section>
              <SectionHeader title={t("synopsisTitle")} />
              {tagline && <p className="mb-2 text-sm italic text-tentacle-text-tertiary">« {tagline} »</p>}
              <p className={`max-w-3xl text-[15px] leading-relaxed text-tentacle-text-secondary ${synopsisExpanded ? "" : "line-clamp-4"}`}>{overview}</p>
              {overview.length > 260 && (
                <button
                  type="button"
                  onClick={onToggleSynopsis}
                  className="mt-1 min-h-[36px] rounded-full text-sm font-semibold text-[var(--brand-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
                >
                  {synopsisExpanded ? t("showLess") : t("showMore")}
                </button>
              )}
            </section>
          )}

          {next?.airDate && (
            <NextEpisodeBanner
              episode={next}
              airDateUtc={airTimes.get(airTimeKey(next.seasonNumber ?? null, next.episodeNumber ?? null))}
              scope={requested ? "everyone" : "all"}
            />
          )}

          {mediaType === "tv" && tvSeasons.length > 0 && (
            <section id={SEASONS_ANCHOR} className="scroll-mt-20">
              <SectionHeader title={t("seer:seasonsTitle")} subtitle={episodeStates?.tracked ? t("seer:seasonsTrackedHint") : undefined} />
              <SeasonsSection
                tvId={currentItem.id}
                seasons={tvSeasons}
                locks={seasonLocks}
                episodeStates={episodeStates}
                airTimes={airTimes}
                onRequest={onSeasonRequest}
                requesting={requestingSeasons}
                isAnime={isAnime}
                defaultProfileId={defaultProfileId}
              />
            </section>
          )}
          {mediaType === "tv" && isLoading && (
            <div className="space-y-2" aria-hidden>
              {[0, 1, 2].map((i) => <div key={i} className="h-[60px] rounded-2xl bg-tentacle-fill-subtle" />)}
            </div>
          )}

          {trailers.length > 0 && <ExtrasRow trailers={trailers} onSelect={onOpenTrailer} />}
          {cast && cast.length > 0 && <CastRow cast={cast} />}
        </div>

        <aside className="mt-9 lg:sticky lg:top-6 lg:mt-0">
          <DetailInfo detail={detail} mediaType={mediaType} verdict={verdict} providers={providers} inLibrary={inLibrary} />
        </aside>
      </div>

      {similar && similar.length > 0 && (
        <div className="mt-10">
          <Rail title={t("similarMedia")}>
            {similar.map((item) => (
              <PosterCard key={`${item.mediaType}:${item.id}`} item={item} onOpen={onSelectSimilar} onQuickRequest={hub?.quickRequest} />
            ))}
          </Rail>
        </div>
      )}
    </div>
  );
}
