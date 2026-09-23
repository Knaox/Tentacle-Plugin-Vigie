/* ------------------------------------------------------------------ */
/*  Vigie — La fiche d'un titre                                        */
/* ------------------------------------------------------------------ */

/*
 * Un en-tête de cinéma (l'image, le titre, où en est le titre, par où il est
 * sorti, et l'action qu'on vient chercher), puis son corps. Au téléphone, une
 * feuille qui monte du bas et dont la fin passe au-dessus de la barre de
 * l'application ; sur grand écran, une fenêtre large. Retour et fermeture
 * restent accrochés en haut pendant qu'on défile.
 *
 * Une autre fiche ouverte depuis celle-ci (un titre semblable, un film de la
 * filmographie) s'empile : « retour » ramène à la précédente.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrMovieDetail, SeerrSearchResult, SeerrTvDetail } from "../api/types";
import { formatSeerError } from "../api/seer-client";
import { useMediaDetail } from "../hooks/useMediaDetail";
import { useLocalRequestedSeasons } from "../hooks/useLocalRequestedSeasons";
import { useMediaSimilar } from "../hooks/useMediaSimilar";
import { useWatchProviders } from "../hooks/useWatchProviders";
import { useRichTrailers } from "../hooks/useRichTrailers";
import { useRequestMedia } from "../hooks/useRequestMedia";
import { useEpisodeStates } from "../hooks/useEpisodeStates";
import { useSeriesAirTimes } from "../hooks/useAirTimes";
import { useVerdict } from "../hooks/useVerdict";
import { useToast } from "../hooks/useToast";
import { useOverlay } from "../hooks/useOverlay";
import { useTitleStatus } from "../hub/TitleStates";
import { isAnimeTitle, seasonLocks } from "../utils/season-locks";
import { mediaTitle, mediaYear } from "../utils/media-helpers";
import { openTrailersViaHost } from "../utils/external";
import { CHROME_BOTTOM } from "../utils/host-chrome";
import { DetailHero } from "./detail/DetailHero";
import { DetailActions } from "./detail/DetailActions";
import { MediaDetailBody, SEASONS_ANCHOR } from "./MediaDetailBody";
import { TrailerModal } from "./TrailerModal";
import { ChevronLeft, CloseIcon } from "./ui/icons";

interface MediaDetailModalProps {
  item: SeerrSearchResult;
  onClose: () => void;
  onRequest: (item: SeerrSearchResult) => void;
  requesting: boolean;
  /** Saisons déjà demandées dans Tentacle (verrouillées). */
  lockedSeasons?: number[];
  /** Profil par défaut pré-sélectionné. */
  defaultProfileId?: string | null;
}

const PLATE = "flex h-10 w-10 items-center justify-center rounded-full bg-[var(--vg-plate)] text-tentacle-on-media-primary ring-1 ring-[var(--vg-glass-ring)] transition-colors hover:bg-[rgba(var(--vg-hero-rgb),0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.7)]";

export function MediaDetailModal({ item, onClose, lockedSeasons, defaultProfileId }: MediaDetailModalProps) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(item);
  const [stack, setStack] = useState<SeerrSearchResult[]>([]);
  const [closing, setClosing] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [movieProfileId, setMovieProfileId] = useState<string | null>(defaultProfileId ?? null);
  const [trailer, setTrailer] = useState<number | null>(null);

  /* Une autre fiche demandée pendant que celle-ci est ouverte (un film de la
   * filmographie d'un acteur du casting) : elle s'empile. */
  const [shownProp, setShownProp] = useState(item);
  if (item !== shownProp) {
    setShownProp(item);
    setStack((s) => [...s, current]);
    setCurrent(item);
    setSynopsisExpanded(false);
  }

  const mediaType = current.mediaType === "movie" ? "movie" as const : "tv" as const;
  const isTv = mediaType === "tv";
  const { data: detail, isLoading } = useMediaDetail(mediaType, current.id);
  const { data: localSeasons } = useLocalRequestedSeasons(mediaType, current.id);
  const { data: similar } = useMediaSimilar(mediaType, current.id);
  const { data: providers } = useWatchProviders(mediaType, current.id);
  const mediaStatus = detail?.mediaInfo?.status ?? current.mediaInfo?.status ?? 0;
  const { data: trailers } = useRichTrailers(mediaType, current.id, mediaStatus);
  const { data: episodeStates } = useEpisodeStates(current.id, isTv);
  const airTimes = useSeriesAirTimes(current.id, isTv);
  const verdict = useVerdict(mediaType, current.id);
  const status = useTitleStatus({ id: current.id, mediaType, mediaInfo: detail?.mediaInfo ?? current.mediaInfo });
  const requestMedia = useRequestMedia();

  const tvDetail = isTv ? (detail as SeerrTvDetail | undefined) : undefined;
  const title = mediaTitle(current) || (detail ? mediaTitle(detail as unknown as SeerrSearchResult) : "") || t("seer:untitled");
  const year = mediaYear(current);
  const isAnime = useMemo(() => isAnimeTitle(detail as never, current), [detail, current]);
  const locks = useMemo(
    () => seasonLocks(tvDetail?.mediaInfo, [...(localSeasons ?? []), ...(lockedSeasons ?? [])]),
    [tvDetail?.mediaInfo, localSeasons, lockedSeasons],
  );
  const tvSeasons = (tvDetail?.seasons ?? []).filter((s) => s.seasonNumber > 0);
  const freeSeasons = tvSeasons.filter((s) => locks.get(s.seasonNumber) === undefined).length;
  const streamingIds = (providers ?? []).map((p) => p.provider_id).filter((id) => id > 0);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);
  // La bande-annonce, ouverte par-dessus, prend Échap tant qu'elle est là.
  useOverlay(true, handleClose);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [current]);

  // Lecture : via la modale de l'HÔTE (l'embed YouTube échoue dans le cadre isolé), sinon ici.
  const openTrailerAt = useCallback((index: number) => {
    if (openTrailersViaHost(trailers ?? [], index)) return;
    setTrailer(index);
  }, [trailers]);

  const payload = {
    tmdbId: current.id, title, posterPath: current.posterPath ?? detail?.posterPath,
    backdropPath: current.backdropPath ?? detail?.backdropPath, overview: current.overview ?? detail?.overview, year,
  };

  const requestSeasons = (seasons: number[], profileId: string | null) => {
    requestMedia.mutate({ ...payload, mediaType: "tv", seasons, profileId }, {
      onSuccess: () => toast.show("success", t("seer:quickSeasonsDone", { title, count: seasons.length })),
      onError: (err) => toast.show("error", formatSeerError(err, t, "seer:requestError")),
    });
  };

  const requestMovie = () => {
    setRequestSuccess(false);
    requestMedia.mutate({ ...payload, mediaType: "movie", profileId: movieProfileId }, {
      onSuccess: () => {
        setRequestSuccess(true);
        toast.show("success", t("requestAdded"));
        setTimeout(handleClose, 600);
      },
      onError: (err) => toast.show("error", formatSeerError(err, t, "seer:requestError")),
    });
  };

  const openOther = (next: SeerrSearchResult) => {
    setStack((s) => [...s, current]);
    setCurrent(next);
    setSynopsisExpanded(false);
  };
  const back = () => {
    const previous = stack[stack.length - 1];
    if (!previous) return;
    setStack((s) => s.slice(0, -1));
    setCurrent(previous);
    setSynopsisExpanded(false);
  };

  const actions = (
    <DetailActions
      mediaType={mediaType}
      tmdbId={current.id}
      mediaStatus={mediaStatus}
      trailers={trailers ?? []}
      onOpenTrailer={() => openTrailerAt(0)}
      movieRequest={!isTv && mediaStatus < 2 ? {
        requesting: requestMedia.isPending, success: requestSuccess, obtainable: verdict?.obtainable ?? true,
        isAnime, profileId: movieProfileId, onProfile: setMovieProfileId, onRequest: requestMovie,
      } : null}
      seasonsLabel={isTv && freeSeasons > 0 ? (mediaStatus >= 4 ? t("seer:requestMoreSeasons") : t("seer:chooseSeasons")) : null}
      onJumpToSeasons={() => document.getElementById(SEASONS_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "start" })}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" onClick={handleClose}>
      {/* Voile sombre dans les deux thèmes, sans flou : opaque aux trois quarts,
          flouter derrière ne se verrait presque pas (règle GPU du projet). */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(var(--scrim-media-rgb, 0, 0, 0), 0.74)", animation: closing ? "fadeOut 180ms ease forwards" : "fadeIn 200ms ease both" }}
      />
      <div
        ref={scrollRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seer-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[94dvh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-t-3xl bg-tentacle-surface-modal shadow-tentacle-modal ring-1 ring-tentacle-border-subtle sm:max-h-[90vh] sm:rounded-3xl"
        style={{
          animation: closing ? "fadeOut 180ms ease forwards" : "vigieDialogIn 320ms cubic-bezier(0.22,1,0.36,1) both",
          // La fin de la fiche passe au-dessus de la barre de l'application.
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${CHROME_BOTTOM})`,
          scrollbarWidth: "thin",
        }}
      >
        {/* Accrochés en haut pendant qu'on défile : on ne cherche jamais la sortie. */}
        <div className="sticky top-0 z-30 h-0">
          <div className="flex items-start justify-between p-3">
            {stack.length > 0 ? (
              <button type="button" onClick={back} aria-label={t("seer:backToTitle", { title: mediaTitle(stack[stack.length - 1]) })} className={PLATE}>
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : <span />}
            <span aria-hidden className="mt-1 h-1 w-10 rounded-full bg-[rgba(255,255,255,0.35)] sm:hidden" />
            <button type="button" onClick={handleClose} aria-label={t("seer:close")} className={PLATE}>
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <DetailHero
          item={current}
          detail={detail as SeerrMovieDetail | SeerrTvDetail | undefined}
          mediaType={mediaType}
          status={status}
          verdict={verdict}
          streamingIds={streamingIds}
          actions={actions}
        />
        <MediaDetailBody
          currentItem={current}
          detail={detail as SeerrMovieDetail | SeerrTvDetail | undefined}
          mediaType={mediaType}
          isLoading={isLoading}
          trailers={trailers ?? []}
          onOpenTrailer={openTrailerAt}
          overview={detail?.overview ?? current.overview}
          synopsisExpanded={synopsisExpanded}
          onToggleSynopsis={() => setSynopsisExpanded((v) => !v)}
          tvSeasons={tvSeasons}
          seasonLocks={locks}
          episodeStates={episodeStates}
          airTimes={airTimes}
          onSeasonRequest={requestSeasons}
          requestingSeasons={requestMedia.isPending}
          isAnime={isAnime}
          defaultProfileId={defaultProfileId}
          verdict={verdict}
          providers={providers}
          inLibrary={mediaStatus >= 4}
          cast={detail?.credits?.cast}
          similar={similar}
          onSelectSimilar={openOther}
        />
      </div>

      <TrailerModal open={trailer !== null} onClose={() => setTrailer(null)} trailers={trailers ?? []} initialIndex={trailer ?? 0} />
    </div>
  );
}
