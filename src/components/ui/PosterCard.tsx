/* ------------------------------------------------------------------ */
/*  Vigie — La carte d'affiche                                         */
/* ------------------------------------------------------------------ */

/*
 * UNE carte pour tout le plugin : rangées, grille du catalogue, recherche,
 * filmographies. Elle répond d'abord à la seule question qui compte ici —
 * « puis-je le regarder, l'ai-je déjà demandé ? » — par une pastille en clair
 * sur l'affiche. Un clic ouvre la fiche ; sur ordinateur, un film se demande
 * aussi d'un geste depuis la carte.
 *
 * Légère à dessein : elle est rendue par centaines dans une grille
 * virtualisée. Pas de flou, pas d'ombre animée — seule l'affiche s'agrandit
 * au survol (une transformation, cf. la règle GPU du projet).
 */

import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../../api/types";
import { mediaTitle, mediaYear, posterUrl } from "../../utils/media-helpers";
import { mediaStateOf, type MediaState } from "../../utils/media-status";
import { STATUS_STYLE } from "../../styles/status";
import { CheckIcon, PlusIcon, StarIcon } from "./icons";

const STATE: Record<MediaState, { cls: string; key: string }> = {
  available: { cls: STATUS_STYLE.available.solid, key: "seer:stateAvailable" },
  partial: { cls: STATUS_STYLE.partially_available.solid, key: "seer:statePartial" },
  processing: { cls: STATUS_STYLE.processing.solid, key: "seer:stateProcessing" },
  requested: { cls: STATUS_STYLE.approved.solid, key: "seer:stateRequested" },
};

/** Pointeur fin (souris) : la demande rapide au survol n'a de sens que là. */
const FINE_POINTER = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

export interface PosterCardProps {
  item: SeerrSearchResult;
  onOpen: (item: SeerrSearchResult) => void;
  /** Demande rapide (films pas encore demandés) — absente, pas de bouton. */
  onQuickRequest?: (item: SeerrSearchResult) => void;
  /** Ligne sous le titre ; par défaut le type et l'année. */
  meta?: string;
  /** Mention posée en bas de l'affiche (« Sortie le 12 nov. »). */
  ribbon?: string | null;
  /** Première image d'une rangée : chargée sans attendre. */
  eager?: boolean;
}

export const PosterCard = memo(function PosterCard({ item, onOpen, onQuickRequest, meta, ribbon, eager }: PosterCardProps) {
  const { t } = useTranslation("seer");
  const [hovered, setHovered] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const title = mediaTitle(item) || t("seer:untitled");
  const year = mediaYear(item);
  const state = mediaStateOf(item.mediaInfo?.status);
  const poster = posterUrl(item.posterPath);
  const typeLabel = item.mediaType === "tv" ? t("seer:typeSeries") : t("seer:typeMovie");
  const line = meta ?? [typeLabel, year].filter(Boolean).join(" · ");
  const canQuickRequest = FINE_POINTER && onQuickRequest && item.mediaType === "movie" && state === null;
  const rating = item.voteAverage ?? 0;
  // Une affiche déjà en cache a fini de charger avant que React n'écoute `load`.
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <div
      className="group relative min-w-0"
      onMouseEnter={canQuickRequest ? () => setHovered(true) : undefined}
      onMouseLeave={canQuickRequest ? () => setHovered(false) : undefined}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={[title, line, state ? t(STATE[state].key) : ""].filter(Boolean).join(" — ")}
        className="block w-full text-left focus-visible:outline-none"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-[rgba(var(--brand-rgb),0.8)]">
          {poster ? (
            <img
              src={poster}
              alt=""
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              onLoad={() => setLoaded(true)}
              ref={imgRef}
              className="h-full w-full object-cover transition-[transform,opacity] duration-300 group-hover:scale-[1.04]"
              style={{ opacity: loaded ? 1 : 0 }}
            />
          ) : (
            <div className="flex h-full w-full items-end p-3 text-sm font-semibold leading-snug text-tentacle-text-tertiary">
              {title}
            </div>
          )}
          {state && (
            <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-tentacle-on-media-primary ${STATE[state].cls}`}>
              {state === "available" && <CheckIcon className="h-3 w-3" />}
              {t(STATE[state].key)}
            </span>
          )}
          {rating > 0 && (
            <span
              className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-tentacle-on-media-primary"
              style={{ background: "rgba(var(--scrim-media-rgb), 0.62)" }}
            >
              <StarIcon className="h-2.5 w-2.5 text-[var(--seer-st-rating-solid)]" />
              {rating.toFixed(1)}
            </span>
          )}
          {ribbon && (
            <span
              className="absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-6 text-[11px] font-semibold text-tentacle-on-media-primary"
              style={{ background: "linear-gradient(to top, rgba(var(--scrim-media-rgb),0.85), transparent)" }}
            >
              {ribbon}
            </span>
          )}
        </div>
        <p className="mt-2 truncate text-[13px] font-semibold text-tentacle-text-primary">{title}</p>
        {line && <p className="truncate text-xs text-tentacle-text-tertiary">{line}</p>}
      </button>
      {/* Monté au survol, jamais masqué : rien ne se compose hors écran. */}
      {canQuickRequest && hovered && (
        // Un calque de la taille exacte de l'affiche : le bouton s'y cale en bas
        // à droite, quelle que soit la hauteur du texte en dessous.
        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[2/3]">
          <button
            type="button"
            onClick={() => onQuickRequest?.(item)}
            aria-label={t("seer:requestTitle", { title })}
            title={t("seer:request")}
            className="pointer-events-auto absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-tentacle-cta-primary text-tentacle-cta-primary-fg shadow-tentacle-elev-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.7)]"
            style={{ animation: "fadeIn 150ms ease both" }}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
});

/** La place d'une carte pendant le chargement — statique, rien ne s'anime. */
export function PosterCardSkeleton() {
  return (
    <div aria-hidden className="min-w-0">
      <div className="aspect-[2/3] w-full rounded-xl bg-tentacle-fill-subtle" />
      <div className="mt-2 h-3 w-4/5 rounded bg-tentacle-fill-subtle" />
      <div className="mt-1.5 h-2.5 w-1/2 rounded bg-tentacle-fill-faint" />
    </div>
  );
}
