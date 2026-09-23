/* ------------------------------------------------------------------ */
/*  Vigie — La carte d'affiche                                         */
/* ------------------------------------------------------------------ */

/*
 * UNE carte pour tout le plugin : rangées, grille du catalogue, recherche,
 * filmographies. Elle répond aux deux questions qui comptent ici :
 *
 *   - où en est ce titre ? — le bandeau au pied de l'affiche : demandé, en
 *     route (son filet avance), bloqué, disponible, en partie. Posé sur une
 *     plaque presque opaque : aucune affiche ne peut en avaler la couleur ;
 *   - par où est-il sorti ? — sous le titre, sur la page : au cinéma, en
 *     streaming, potentiellement disponible…
 *
 * Un clic ouvre la fiche ; sur ordinateur, le « + » du survol demande un film
 * d'un geste, et ouvre les saisons libres d'une série pour les ajouter d'un
 * autre. Légère à dessein : rendue par centaines dans une
 * grille virtualisée, sans flou ni ombre animée — seule l'affiche s'agrandit
 * au survol (une transformation, cf. la règle GPU du projet).
 */

import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../../api/types";
import { mediaTitle, mediaYear, posterUrl } from "../../utils/media-helpers";
import { statusText } from "../../utils/state-labels";
import type { TitleStatus } from "../../utils/title-state";
import { useTitleStatus } from "../../hub/TitleStates";
import { useVerdict } from "../../hooks/useVerdict";
import { ChannelLine, channelOf } from "./ChannelLine";
import { StateBadge } from "./StateBadge";
import { PlusIcon, StarIcon } from "./icons";

/** Pointeur fin (souris) : la demande rapide au survol n'a de sens que là. */
const FINE_POINTER = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

export interface PosterCardProps {
  item: SeerrSearchResult;
  onOpen: (item: SeerrSearchResult) => void;
  /** Demande rapide (un film, ou les saisons libres d'une série) — absente, pas de bouton. */
  onQuickRequest?: (item: SeerrSearchResult) => void;
  /** Remplace la ligne du canal (« jeu. 25 · S4E18 » dans les sorties de la semaine). */
  caption?: string | null;
  /** État imposé — celui d'un épisode du calendrier ; sinon, celui du titre. */
  status?: TitleStatus | null;
  /** Première image d'une rangée : chargée sans attendre. */
  eager?: boolean;
}

export const PosterCard = memo(function PosterCard({ item, onOpen, onQuickRequest, caption, status: forced, eager }: PosterCardProps) {
  const { t } = useTranslation("seer");
  const [hovered, setHovered] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const title = mediaTitle(item) || t("seer:untitled");
  const year = mediaYear(item);
  const own = useTitleStatus(item);
  const status = forced !== undefined ? forced : own;
  const verdict = useVerdict(item.mediaType, item.id, caption == null);
  const typeLabel = item.mediaType === "tv" ? t("seer:typeSeries") : t("seer:typeMovie");
  let channel = verdict ? channelOf(verdict, t) : null;
  // « Potentiellement disponible » sous une affiche qui dit « Disponible » : non.
  if (channel?.kind === "uncharted" && (status?.state === "available" || status?.state === "partial")) channel = null;
  const poster = posterUrl(item.posterPath);
  // Un film pas encore demandé ; une série tant qu'elle n'est pas entièrement là
  // (le « + » ouvre alors ses saisons libres).
  const canQuickRequest = FINE_POINTER && !!onQuickRequest
    && (item.mediaType === "movie" ? status === null : item.mediaType === "tv" && status?.state !== "available");
  const rating = item.voteAverage ?? 0;
  // Une affiche déjà en cache a fini de charger avant que React n'écoute `load`.
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  const label = [title, status ? statusText(status, t) : "", caption ?? channel?.label ?? [typeLabel, year].filter(Boolean).join(" · ")]
    .filter(Boolean).join(" — ");

  return (
    <div
      className="group relative min-w-0"
      onMouseEnter={canQuickRequest ? () => setHovered(true) : undefined}
      onMouseLeave={canQuickRequest ? () => setHovered(false) : undefined}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={label}
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
            <div className="flex h-full w-full items-end p-3 pb-8 text-sm font-semibold leading-snug text-tentacle-text-tertiary">
              {title}
            </div>
          )}
          {rating > 0 && (
            <span
              className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-tentacle-on-media-primary"
              style={{ background: "var(--vg-plate)" }}
            >
              <StarIcon className="h-2.5 w-2.5 text-[var(--seer-st-rating-solid)]" />
              {rating.toFixed(1)}
            </span>
          )}
          {status && <StateBadge status={status} variant="band" />}
        </div>
        <p className="mt-2 truncate text-[13px] font-semibold leading-5 text-tentacle-text-primary">{title}</p>
        {caption != null ? (
          <p className="mt-0.5 truncate text-xs text-tentacle-text-tertiary">{caption}</p>
        ) : (
          <ChannelLine channel={channel} fallback={[typeLabel, year].filter(Boolean).join(" · ")} year={channel ? year : undefined} />
        )}
      </button>
      {/* Monté au survol, jamais masqué : rien ne se compose hors écran. */}
      {canQuickRequest && hovered && (
        // Un calque de la taille exacte de l'affiche : le bouton s'y cale en bas
        // à droite, quelle que soit la hauteur du texte en dessous.
        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[2/3]">
          <button
            type="button"
            onClick={() => onQuickRequest?.(item)}
            aria-label={item.mediaType === "tv" ? t("seer:quickRequestSeasons", { title }) : t("seer:requestTitle", { title })}
            title={item.mediaType === "tv" ? t("seer:chooseSeasons") : t("seer:request")}
            // Au-dessus du bandeau d'état quand il y en a un (série en partie là).
            className={`pointer-events-auto absolute right-2 flex h-9 w-9 items-center justify-center rounded-full bg-tentacle-cta-primary text-tentacle-cta-primary-fg shadow-tentacle-elev-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.7)] ${status ? "bottom-8" : "bottom-2"}`}
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
