import { useTranslation } from "react-i18next";
import { DetailActionBar } from "./DetailActionBar";
import { NextEpisodeBanner } from "./NextEpisodeBanner";
import { ExtrasRow } from "./ExtrasRow";
import { SeasonRow } from "./SeasonRow";
import { SeriesSeasonPicker } from "./SeriesSeasonPicker";
import { MovieRequestSection } from "./MovieRequestSection";
import { AvailabilityPill } from "./AvailabilityPill";
import { hasSignal } from "../utils/availability-labels";
import { PlatformBadges } from "./PlatformBadges";
import { useSingleAvailability } from "../hooks/useAvailability";
import { airTimeKey, useSeriesAirTimes } from "../hooks/useAirTimes";
import { WatchProviders } from "./WatchProviders";
import { CastRow } from "./CastRow";
import { DetailMetaGrid } from "./DetailMetaGrid";
import { SimilarMedia } from "./SimilarMedia";
import type {
  SeerrSearchResult, SeerrTvDetail, SeerrMovieDetail, SeerrSeason, SeerrCastMember,
} from "../api/types";
import type { RichTrailer } from "../utils/trailers";

/** Là où mène le bouton « Choisir les saisons » du haut de la fiche d'une série. */
const REQUEST_ANCHOR = "vigie-request";

interface WatchProviderEntry {
  logo_path: string;
  provider_id: number;
  provider_name: string;
}

interface MediaDetailBodyProps {
  currentItem: SeerrSearchResult;
  detail: SeerrMovieDetail | SeerrTvDetail | undefined;
  mediaType: "movie" | "tv";
  mediaStatus: number;
  trailers: RichTrailer[];
  isLoading: boolean;
  isTv: boolean;
  tvDetail: SeerrTvDetail | undefined;
  tvFullyAvailable: boolean;
  tvSeasons: SeerrSeason[];
  requestedSeasonMap: Map<number, number>;
  expandedSeason: number | null;
  onExpandSeasonToggle: (seasonNumber: number) => void;
  onOpenTrailer: (index: number) => void;
  overview: string | undefined;
  synopsisExpanded: boolean;
  onToggleSynopsis: () => void;
  onSeasonRequest: (seasons: number[], profileId?: string | null) => void;
  requestingSeasons: boolean;
  isAnime: boolean;
  lockedSeasons?: number[];
  defaultProfileId?: string | null;
  requestSuccess: boolean;
  movieProfileId: string | null;
  onMovieProfileChange: (id: string | null) => void;
  onMovieRequest: () => void;
  providers: WatchProviderEntry[] | undefined;
  cast: SeerrCastMember[] | undefined;
  similar: SeerrSearchResult[] | undefined;
  onSelectSimilar: (item: SeerrSearchResult) => void;
}

/**
 * Corps de la fiche détail (sous le header) : action bar, demande d'un film,
 * prochain épisode, synopsis, extras, saisons/épisodes ou picker de demande,
 * providers, casting, fiche technique, médias similaires. Extrait de
 * MediaDetailModal pour rester sous 300 lignes.
 */
export function MediaDetailBody({
  currentItem, detail, mediaType, mediaStatus, trailers, isLoading,
  isTv, tvDetail, tvFullyAvailable, tvSeasons, requestedSeasonMap,
  expandedSeason, onExpandSeasonToggle, onOpenTrailer,
  overview, synopsisExpanded, onToggleSynopsis,
  onSeasonRequest, requestingSeasons, isAnime, lockedSeasons, defaultProfileId,
  requestSuccess, movieProfileId, onMovieProfileChange, onMovieRequest,
  providers, cast, similar, onSelectSimilar,
}: MediaDetailBodyProps) {
  const { t } = useTranslation("seer");
  const availability = useSingleAvailability(currentItem.mediaType as "movie" | "tv", currentItem.id);
  /* L'heure exacte des épisodes, quand Sonarr suit la série. Map vide sinon :
   * on affiche alors la date seule, sans rien inventer. */
  const airTimes = useSeriesAirTimes(currentItem.id, isTv);
  /* Plateformes d'abonnement uniquement : « je peux le voir maintenant » n'a
   * pas le même sens qu'« il est en vente ». */
  const streamingIds = (providers ?? []).map((p) => p.provider_id).filter((id) => id > 0);
  const isMovie = currentItem.mediaType === "movie";
  /* Par où ce titre est sorti, et ce qu'une demande peut espérer. */
  const availabilityPill = hasSignal(availability) ? (
    <div className="flex justify-center">
      <AvailabilityPill verdict={availability} variant="detail" inLibrary={mediaStatus >= 4} />
    </div>
  ) : null;

  /* Film : la demande se fait sous l'en-tête — un seul bouton, visible sans
   * défiler (plus bas, elle doublait le bouton qui y menait). Tant que le film
   * n'est pas là, elle passe avant la bande-annonce : c'est l'action principale. */
  const movieRequest = isMovie ? (
    <div className="space-y-3">
      {availabilityPill}
      <MovieRequestSection
        mediaStatus={mediaStatus}
        isAnime={isAnime}
        requesting={requestingSeasons}
        requestSuccess={requestSuccess}
        profileId={movieProfileId}
        onProfileChange={onMovieProfileChange}
        onRequest={onMovieRequest}
        obtainable={availability?.obtainable ?? true}
      />
    </div>
  ) : null;
  const requestFirst = isMovie && mediaStatus < 4;

  return (
    <div className="space-y-6 px-4 pb-6 sm:px-6">
      {requestFirst && movieRequest}
      <DetailActionBar
        mediaType={mediaType}
        tmdbId={currentItem.id}
        mediaStatus={mediaStatus}
        trailers={trailers}
        onOpenTrailer={() => onOpenTrailer(0)}
        requestLabel={
          isTv && !tvFullyAvailable && !isLoading && tvSeasons.length > 0
            ? (mediaStatus === 4 ? t("seer:requestMoreSeasons") : t("seer:chooseSeasons"))
            : null
        }
        onJumpToRequest={() => document.getElementById(REQUEST_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "center" })}
      />

      {!requestFirst && movieRequest}

      {/* Prochain épisode (séries en cours) */}
      {isTv && tvDetail?.nextEpisodeToAir?.airDate && (
        <NextEpisodeBanner
          episode={tvDetail.nextEpisodeToAir}
          airDateUtc={airTimes.get(airTimeKey(
            tvDetail.nextEpisodeToAir.seasonNumber ?? null,
            tvDetail.nextEpisodeToAir.episodeNumber ?? null,
          ))}
        />
      )}

      {/* Synopsis */}
      {overview && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">{t("synopsisTitle")}</h4>
          <p className={`text-sm leading-relaxed text-tentacle-text-secondary sm:text-base ${synopsisExpanded ? "" : "line-clamp-3"}`}>{overview}</p>
          {overview.length > 200 && (
            <button
              onClick={onToggleSynopsis}
              className="mt-1 min-h-[32px] rounded text-xs font-medium text-tentacle-brand-light focus:outline-none focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.5)]"
            >
              {synopsisExpanded ? t("showLess") : t("showMore")}
            </button>
          )}
        </div>
      )}

      {/* Extras (trailers + teasers) AU-DESSUS des saisons, comme MediaDetail (core) */}
      {trailers.length > 0 && (
        <ExtrasRow
          trailers={trailers}
          onSelect={onOpenTrailer}
        />
      )}

      {/* Série 100% dispo → consultation : saisons + épisodes + dates */}
      {tvFullyAvailable && tvSeasons.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">{t("seer:seasonsTitle")}</h4>
          {tvSeasons.map((season) => (
            <SeasonRow
              key={season.seasonNumber}
              tvId={currentItem.id}
              season={season}
              status={requestedSeasonMap.get(season.seasonNumber)}
              expanded={expandedSeason === season.seasonNumber}
              onExpandToggle={() => onExpandSeasonToggle(season.seasonNumber)}
              airTimes={airTimes}
            />
          ))}
        </div>
      )}

      {/* Série incomplète → sélection de saisons à demander */}
      {isTv && !tvFullyAvailable && !isLoading && tvSeasons.length > 0 && (
        <div id={REQUEST_ANCHOR} className="scroll-mt-24">
        <SeriesSeasonPicker
          tvId={currentItem.id}
          seasons={tvSeasons}
          requestedSeasons={requestedSeasonMap}
          onRequest={onSeasonRequest}
          requesting={requestingSeasons}
          isAnime={isAnime}
          lockedSeasons={lockedSeasons}
          defaultProfileId={defaultProfileId}
        />
        </div>
      )}

      {isLoading && isTv && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-tentacle-brand border-t-transparent" />
        </div>
      )}

      {!isMovie && availabilityPill}

      {/* Où le regarder tout de suite, si c'est déjà quelque part. */}
      {streamingIds.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-tentacle-text-tertiary">{t("seer:streamingLabel")}</span>
          <PlatformBadges providerIds={streamingIds} max={5} />
        </div>
      )}

      {providers && providers.length > 0 && <WatchProviders providers={providers} />}
      {cast && cast.length > 0 && <CastRow cast={cast} />}
      <DetailMetaGrid detail={detail} mediaType={mediaType} />
      {similar && similar.length > 0 && (
        <SimilarMedia items={similar} onSelect={onSelectSimilar} />
      )}
    </div>
  );
}
