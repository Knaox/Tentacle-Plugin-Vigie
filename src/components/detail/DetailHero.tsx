/* ------------------------------------------------------------------ */
/*  Vigie — L'en-tête d'une fiche                                      */
/* ------------------------------------------------------------------ */

/*
 * Une image, un titre, et d'un regard : où en est ce titre (le badge d'état),
 * par où il est sorti (salle, streaming, plateformes), et ce qu'on peut en
 * faire (les actions). L'en-tête est TOUJOURS sombre, comme une affiche : son
 * texte blanc se lit sur l'image dans les deux thèmes, et la page claire
 * reprend dessous.
 */

import { memo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrMovieDetail, SeerrSearchResult, SeerrTvDetail } from "../../api/types";
import type { AvailabilityVerdict } from "../../api/types-releases";
import { backdropUrl, formatRuntime, mediaTitle, mediaYear, posterUrl } from "../../utils/media-helpers";
import type { TitleStatus } from "../../utils/title-state";
import { StateBadge } from "../ui/StateBadge";
import { channelOf } from "../ui/ChannelLine";
import { DashedCircleIcon, DiscIcon, PlayCircleIcon, StarIcon, TicketIcon, CalendarIcon } from "../ui/icons";
import { PlatformBadges } from "../PlatformBadges";

const CHANNEL_ICON = {
  theater: TicketIcon, streaming: PlayCircleIcon, physical: DiscIcon, upcoming: CalendarIcon, uncharted: DashedCircleIcon,
} as const;

/* Le fondu de l'image vers le fond de l'en-tête : le texte posé dessous reste lisible. */
const SCRIM = "linear-gradient(to top, var(--vg-hero-bg) 3%, rgba(var(--vg-hero-rgb),0.78) 38%, rgba(var(--vg-hero-rgb),0.22) 72%, rgba(var(--vg-hero-rgb),0.5) 100%)";

interface Props {
  item: SeerrSearchResult;
  detail: SeerrMovieDetail | SeerrTvDetail | undefined;
  mediaType: "movie" | "tv";
  status: TitleStatus | null;
  verdict: AvailabilityVerdict | null;
  /** Plateformes d'abonnement où le titre se regarde aujourd'hui. */
  streamingIds: number[];
  actions: ReactNode;
}

export const DetailHero = memo(function DetailHero({ item, detail, mediaType, status, verdict, streamingIds, actions }: Props) {
  const { t } = useTranslation("seer");
  const [loaded, setLoaded] = useState(false);
  const info = detail as unknown as SeerrSearchResult | undefined;
  const title = mediaTitle(item) || (info ? mediaTitle(info) : "") || t("seer:untitled");
  const year = mediaYear(item) || (info ? mediaYear(info) : "");
  const backdrop = backdropUrl(item.backdropPath ?? detail?.backdropPath);
  const poster = posterUrl(item.posterPath ?? detail?.posterPath, "w342");
  const movie = mediaType === "movie" ? (detail as SeerrMovieDetail | undefined) : undefined;
  const tv = mediaType === "tv" ? (detail as SeerrTvDetail | undefined) : undefined;
  const original = movie?.originalTitle ?? tv?.originalName;
  const rating = detail?.voteAverage ?? item.voteAverage ?? 0;
  const votes = detail?.voteCount ?? 0;
  const certification = movie?.certification ?? tv?.certification;
  let channel = verdict ? channelOf(verdict, t) : null;
  if (channel?.kind === "uncharted" && (status?.state === "available" || status?.state === "partial")) channel = null;
  const ChannelIcon = channel ? CHANNEL_ICON[channel.kind] : null;

  const eyebrow = [
    mediaType === "tv" ? t("seer:typeSeries") : t("seer:typeMovie"),
    year,
    movie?.runtime ? formatRuntime(movie.runtime) : tv?.numberOfSeasons ? t("seasonsCount", { count: tv.numberOfSeasons }) : "",
  ].filter(Boolean).join(" · ");

  return (
    <section className="relative isolate overflow-hidden" style={{ background: "var(--vg-hero-bg)" }}>
      <div className="absolute inset-x-0 top-0 h-[260px] sm:h-[360px] lg:h-[420px]">
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            onLoad={() => setLoaded(true)}
            className="h-full w-full object-cover"
            style={{ opacity: loaded ? 1 : 0, transition: "opacity 400ms ease" }}
          />
        )}
        <div aria-hidden className="absolute inset-0" style={{ background: SCRIM }} />
        <div aria-hidden className="absolute inset-0 hidden sm:block" style={{ background: "linear-gradient(90deg, rgba(var(--vg-hero-rgb),0.72) 0%, transparent 55%)" }} />
      </div>

      <div className={`relative px-4 pb-6 md:px-8 ${backdrop ? "pt-[150px] sm:pt-[200px] lg:pt-[240px]" : "pt-16"}`}>
        <div className="flex items-end gap-5 lg:gap-7">
          {poster && (
            <img
              src={poster}
              alt=""
              className={`${backdrop ? "hidden sm:block" : "block"} aspect-[2/3] w-24 shrink-0 rounded-2xl object-cover shadow-[0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-[var(--vg-glass-ring)] sm:w-36 lg:w-44`}
            />
          )}
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tentacle-on-media-secondary">{eyebrow}</p>
            <h2 id="seer-detail-title" className="mt-1.5 line-clamp-3 text-[28px] font-extrabold leading-[1.08] tracking-tight text-tentacle-on-media-primary sm:text-4xl lg:text-5xl">
              {title}
            </h2>
            {original && original !== title && (
              <p className="mt-1 truncate text-sm text-tentacle-on-media-secondary">{original}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-sm text-tentacle-on-media-secondary">
              {rating > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-tentacle-on-media-primary">
                  <StarIcon className="h-4 w-4 text-[var(--seer-st-rating-solid)]" />
                  {rating.toFixed(1)}
                  {votes > 0 && <span className="font-normal text-tentacle-on-media-secondary">({new Intl.NumberFormat(undefined, { notation: "compact" }).format(votes)})</span>}
                </span>
              )}
              {certification && (
                <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-tentacle-on-media-primary ring-1 ring-[var(--vg-glass-ring)]">{certification}</span>
              )}
              {detail?.genres?.slice(0, 3).map((g) => (
                <span key={g.id} className="rounded-full bg-[var(--vg-glass)] px-2.5 py-0.5 text-xs font-medium text-tentacle-on-media-primary">{g.name}</span>
              ))}
            </div>
          </div>
        </div>

        {(status || channel || streamingIds.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {status && <StateBadge status={status} variant="media" />}
            {channel && ChannelIcon && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--vg-plate)] px-3 text-xs font-semibold text-tentacle-on-media-primary ring-1 ring-[var(--vg-glass-ring)]">
                <ChannelIcon className="h-4 w-4 text-tentacle-on-media-secondary" />
                {channel.label}
              </span>
            )}
            {streamingIds.length > 0 && (
              <span className="inline-flex h-8 items-center rounded-full bg-[var(--vg-plate)] px-2 ring-1 ring-[var(--vg-glass-ring)]">
                <PlatformBadges providerIds={streamingIds} max={4} />
              </span>
            )}
          </div>
        )}

        <div className="mt-5">{actions}</div>
      </div>
    </section>
  );
});
