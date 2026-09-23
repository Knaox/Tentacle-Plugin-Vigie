/* ------------------------------------------------------------------ */
/*  Vigie — La vitrine de l'accueil                                    */
/* ------------------------------------------------------------------ */

/*
 * Les titres du moment, en grand : une image, un titre, et l'action qui
 * compte (Demander, Regarder). Six titres, que l'on fait défiler au doigt ou
 * aux flèches — JAMAIS tout seuls : une vitrine qui tourne en permanence est
 * une animation infinie (règle GPU du projet), et un titre qui change sous le
 * pouce au moment d'appuyer fait ouvrir le mauvais.
 */

import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import { backdropUrl, mediaTitle, mediaYear } from "../utils/media-helpers";
import { mediaStateOf } from "../utils/media-status";
import { navigateToMedia } from "../utils/navigate-media";
import { CTA_PRIMARY, CTA_SECONDARY, CTA_SIZE_LG } from "../styles/cta";
import { useHub } from "../hub/HubContext";
import { ChevronLeft, ChevronRight, PlayIcon, PlusIcon, StarIcon } from "../components/ui/icons";

const SHOWN = 6;

export const HeroSpotlight = memo(function HeroSpotlight({ items }: { items: SeerrSearchResult[] }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const slides = items.filter((i) => i.backdropPath && i.mediaType !== "person").slice(0, SHOWN);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  if (slides.length === 0) return null;

  const current = slides[index % slides.length];
  const nextBackdrop = backdropUrl(slides[(index + 1) % slides.length].backdropPath, "w1280");
  const go = (delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length);
  const state = mediaStateOf(current.mediaInfo?.status);
  const meta = [
    current.mediaType === "tv" ? t("seer:typeSeries") : t("seer:typeMovie"),
    mediaYear(current),
  ].filter(Boolean).join(" · ");

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("seer:heroLabel")}
      className="group/hero relative -mx-4 overflow-hidden bg-tentacle-surface-1 md:mx-0 md:rounded-3xl md:ring-1 md:ring-tentacle-border-subtle"
      onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start !== null && end !== undefined && Math.abs(end - start) > 50) go(end < start ? 1 : -1);
      }}
    >
      <div className="relative aspect-[4/3] max-h-[60vh] w-full sm:aspect-[16/9] md:aspect-[2/1] lg:aspect-[21/9] lg:max-h-[480px]">
        <img
          key={current.id}
          src={backdropUrl(current.backdropPath, "w1280")}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ animation: "viewCrossfade 400ms ease both" }}
        />
        <Preload src={nextBackdrop} />
        <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--surface-0) 0%, rgba(var(--scrim-media-rgb),0.55) 45%, rgba(var(--scrim-media-rgb),0.1) 80%)" }} />
        <div aria-hidden className="absolute inset-0 hidden md:block" style={{ background: "linear-gradient(90deg, rgba(var(--scrim-media-rgb),0.7) 0%, transparent 60%)" }} />

        <div className="absolute inset-x-0 bottom-0 px-4 pb-5 sm:px-8 sm:pb-8" key={`t-${current.id}`} style={{ animation: "fadeSlideUp 400ms cubic-bezier(0.22,1,0.36,1) both" }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tentacle-on-media-secondary">{t("seer:heroEyebrow")}</p>
          <h2 className="mt-1 line-clamp-2 max-w-2xl text-2xl font-extrabold leading-tight text-tentacle-on-media-primary sm:text-4xl lg:text-5xl">{mediaTitle(current)}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-tentacle-on-media-secondary">
            <span>{meta}</span>
            {(current.voteAverage ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1"><StarIcon className="h-3.5 w-3.5 text-[var(--seer-st-rating-solid)]" />{current.voteAverage?.toFixed(1)}</span>
            )}
          </p>
          {current.overview && <p className="mt-2 hidden max-w-xl text-sm leading-relaxed text-tentacle-on-media-secondary md:line-clamp-2">{current.overview}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {state === "available" || state === "partial" ? (
              <button type="button" onClick={() => void navigateToMedia(current.id, current.mediaType)} className={`${CTA_PRIMARY} ${CTA_SIZE_LG} gap-2`}>
                <PlayIcon className="h-4 w-4" />{t("seer:watch")}
              </button>
            ) : state === null ? (
              <button type="button" onClick={() => (current.mediaType === "movie" ? hub.quickRequest(current) : hub.openMedia(current))} className={`${CTA_PRIMARY} ${CTA_SIZE_LG} gap-2`}>
                <PlusIcon className="h-4 w-4" />{current.mediaType === "movie" ? t("seer:request") : t("seer:chooseSeasons")}
              </button>
            ) : (
              <span className="inline-flex h-11 items-center rounded-full bg-[rgba(var(--scrim-media-rgb),0.45)] px-5 text-sm font-semibold text-tentacle-on-media-primary">
                {t(state === "processing" ? "seer:stateProcessing" : "seer:stateRequested")}
              </span>
            )}
            <button type="button" onClick={() => hub.openMedia(current)} className={`${CTA_SECONDARY} ${CTA_SIZE_LG}`}>{t("seer:moreInfo")}</button>
          </div>
        </div>

        {slides.length > 1 && (
          <>
            {/* Des points fins, mais des cibles de 24 px : on les vise au doigt. */}
            <div className="absolute bottom-4 right-3 flex sm:bottom-6 sm:right-7">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={t("seer:heroGoTo", { title: mediaTitle(s) })}
                  aria-current={i === index % slides.length}
                  className="flex h-6 items-center px-[3px]"
                >
                  <span className={`block h-1.5 rounded-full transition-[width] duration-300 ${i === index % slides.length ? "w-6 bg-tentacle-on-media-primary" : "w-1.5 bg-tentacle-on-media-muted"}`} />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => go(-1)} aria-label={t("seer:railPrevious")} className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(var(--scrim-media-rgb),0.45)] text-tentacle-on-media-primary opacity-0 transition-opacity focus-visible:opacity-100 group-hover/hero:opacity-100 [@media(hover:hover)]:flex">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label={t("seer:railNext")} className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(var(--scrim-media-rgb),0.45)] text-tentacle-on-media-primary opacity-0 transition-opacity focus-visible:opacity-100 group-hover/hero:opacity-100 [@media(hover:hover)]:flex">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </section>
  );
});

/** L'image suivante, déjà demandée : le passage se fait sans attente. */
function Preload({ src }: { src: string }) {
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.src = src;
  }, [src]);
  return null;
}
