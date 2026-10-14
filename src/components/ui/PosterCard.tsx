/* ------------------------------------------------------------------ */
/*  Vigie — La carte d'affiche                                         */
/* ------------------------------------------------------------------ */

/*
 * UNE carte pour tout le plugin : rangées, grille du catalogue, recherche,
 * filmographies. Elle répond aux trois questions qui comptent ici :
 *
 *   - où en est ce titre ? — le bandeau au pied de l'affiche : demandé, en
 *     route (son filet avance), bloqué, disponible, en partie. Posé sur une
 *     plaque presque opaque : aucune affiche ne peut en avaler la couleur ;
 *   - qu'en a-t-on fait ? — en haut de l'affiche : dans la bibliothèque, vu,
 *     dans « Ma liste » (ou mis de côté jusqu'à son arrivée), aimé, et sa
 *     propre note (cf. MarkPlate) ;
 *   - par où est-il sorti ? — sous le titre, sur la page : au cinéma, en
 *     streaming, potentiellement disponible… Pour une série en partie là,
 *     cette ligne dit plutôt ce qui lui manque : « Il manque 1 saison ».
 *
 * Un clic ouvre la fiche. Ses gestes sont ceux de TOUTES les cartes de
 * Tentacle (cf. PosterHover, usePosterGestures) : au survol — et au focus,
 * la grille se parcourt au clavier —, la note puis le plateau en bas,
 * « Demander » en tête et « Ma liste » ; au doigt, l'appui long ouvre la
 * même chose en feuille. Légère à dessein : rendue par centaines dans une grille
 * virtualisée, rien de ce survol n'existe au repos (monté à la demande).
 */

import { memo, useCallback, useContext, useEffect, useRef, useState, type FocusEvent } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../../api/types";
import { getCurrentLanguage, mediaTitle, mediaYear, posterUrl } from "../../utils/media-helpers";
import { statusText } from "../../utils/state-labels";
import type { TitleStatus } from "../../utils/title-state";
import { useTitleGaps, useTitleStatus } from "../../hub/TitleStates";
import { useTitleMarks, type TitleMarks } from "../../hub/UserMarks";
import { HubContext } from "../../hub/HubContext";
import { gapText } from "../../utils/series-gaps";
import { useVerdict } from "../../hooks/useVerdict";
import { useLongPress } from "../../hooks/useLongPress";
import { useMountWhile } from "../../hooks/useMountWhile";
import { usePosterGestures } from "../../hooks/usePosterGestures";
import { ChannelLine, channelOf } from "./ChannelLine";
import { GapLine } from "./GapLine";
import { StateBadge } from "./StateBadge";
import { MarkPlate, RatingChip, marksText } from "./MarkPlate";
import { PosterHover } from "./PosterHover";
import { EyeOffIcon } from "./icons";
import { PosterPreview } from "../../preview/PosterPreview";
import { PREVIEW_TIMING } from "../../preview/timing";
import { trackPreviewWarm } from "../../preview/warm";
import type { PreviewExit } from "../../preview/exitGuard";

/** Pointeur fin (souris) : le survol n'a de sens que là ; au doigt, c'est l'appui long. */
const FINE_POINTER = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/* Un appui long n'ouvre ni le menu du système ni une sélection de texte. */
const NO_CALLOUT = { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as const;

export interface PosterCardProps {
  item: SeerrSearchResult;
  onOpen: (item: SeerrSearchResult) => void;
  /** Demande rapide (un film, ou les saisons libres d'une série) — absente, pas de « Demander ». */
  onQuickRequest?: (item: SeerrSearchResult) => void;
  /** Remplace la ligne du canal (« jeu. 25 · S4E18 » dans les sorties de la semaine). */
  caption?: string | null;
  /** État imposé — celui d'un épisode du calendrier ; sinon, celui du titre. */
  status?: TitleStatus | null;
  /** Première image d'une rangée : chargée sans attendre. */
  eager?: boolean;
}

/** Le calque du survol, avec ses gestes : n'existe que monté (abonnements, mutations). */
function HoverLayer({ item, status, marks, onQuickRequest, name, visible }: {
  item: SeerrSearchResult;
  status: TitleStatus | null;
  marks: TitleMarks | null;
  onQuickRequest?: (item: SeerrSearchResult) => void;
  name: string;
  visible: boolean;
}) {
  const gestures = usePosterGestures(item, status, marks, onQuickRequest);
  return <PosterHover gestures={gestures} name={name} visible={visible} band={status !== null} />;
}

export const PosterCard = memo(function PosterCard({ item, onOpen, onQuickRequest, caption, status: forced, eager }: PosterCardProps) {
  const { t } = useTranslation("seer");
  const hub = useContext(HubContext);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const title = mediaTitle(item) || t("seer:untitled");
  const year = mediaYear(item);
  const own = useTitleStatus(item);
  const status = forced !== undefined ? forced : own;
  const gaps = useTitleGaps(item);
  // Ce qui manque ne se dit que d'une série « en partie » — pas d'un épisode du calendrier.
  const gap = forced === undefined && status?.state === "partial" ? gapText(gaps, t, "short") : null;
  const verdict = useVerdict(item.mediaType, item.id, caption == null);
  const typeLabel = item.mediaType === "tv" ? t("seer:typeSeries") : t("seer:typeMovie");
  let channel = verdict ? channelOf(verdict, t) : null;
  // « Potentiellement disponible » sous une affiche qui dit « Disponible » : non.
  if (channel?.kind === "uncharted" && (status?.state === "available" || status?.state === "partial")) channel = null;
  const poster = posterUrl(item.posterPath);
  const rating = item.voteAverage ?? 0;
  const marks = useTitleMarks(item);
  const lang = getCurrentLanguage();
  // Le bandeau dit déjà « là » : la plaque ne le répète pas.
  const bandSaysHere = status?.state === "available" || status?.state === "partial";
  const active = FINE_POINTER && (hovered || focused);
  const layerMounted = useMountWhile(active, 200);
  // L'aperçu de bande-annonce : sa session n'existe que pendant le survol (et son fondu de sortie).
  // Le focus ne compte que visible (clavier) ; une fiche ou une demande ouverte le coupe
  // jusqu'au prochain survol — rien ne joue sous une fenêtre.
  const [focusVisible, setFocusVisible] = useState(false);
  const [previewSuppressed, setPreviewSuppressed] = useState(false);
  const previewActive = FINE_POINTER && !previewSuppressed && (hovered || focusVisible);
  const previewMounted = useMountWhile(previewActive, PREVIEW_TIMING.exitMs + 120);
  const [previewShown, setPreviewShown] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const longPress = useLongPress(() => hub?.openActions(item, !!onQuickRequest));
  // Une affiche déjà en cache a fini de charger avant que React n'écoute `load`.
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);
  // À l'écran, son aperçu se prépare chez le serveur (`warm.ts`) : au survol, la vidéo part aussitôt.
  useEffect(() => {
    const element = posterRef.current;
    if (!FINE_POINTER || !element || (item.mediaType !== "movie" && item.mediaType !== "tv")) return;
    return trackPreviewWarm(element, { tmdbId: item.id, mediaType: item.mediaType });
  }, [item.id, item.mediaType]);
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setFocused(false);
      setFocusVisible(false);
    }
  };
  // Pourquoi l'aperçu est coupé : « away » (page quittée, fenêtre effacée) repart au
  // prochain mouvement sur la carte ; une fiche ouverte ou Échap, au prochain survol.
  const exitKind = useRef<PreviewExit | null>(null);
  const onPreviewExit = useCallback((kind: PreviewExit) => {
    exitKind.current = kind;
    setPreviewSuppressed(true);
  }, []);
  const openFromCard = () => {
    exitKind.current = "escape";
    setPreviewSuppressed(true);
    onOpen(item);
  };
  const requestFromPreview = onQuickRequest && ((target: SeerrSearchResult) => {
    exitKind.current = "escape";
    setPreviewSuppressed(true);
    onQuickRequest(target);
  });

  const label = [
    title, item.masked ? t("seer:maskedResultLabel") : "", status ? statusText(status, t) : "",
    ...marksText(marks, bandSaysHere, t, lang),
    caption ?? gap ?? channel?.label ?? [typeLabel, year].filter(Boolean).join(" · "),
  ].filter(Boolean).join(" — ");

  return (
    <div
      className="group relative min-w-0"
      // La mini-carte d'aperçu montrée : la carte entière (affiche et légende) s'efface dessous.
      data-vgp-concealed={previewShown}
      onMouseEnter={FINE_POINTER ? () => { setHovered(true); exitKind.current = null; setPreviewSuppressed(false); } : undefined}
      onMouseMove={FINE_POINTER ? () => {
        if (exitKind.current !== "away") return;
        exitKind.current = null;
        setHovered(true);
        setPreviewSuppressed(false);
      } : undefined}
      onMouseLeave={FINE_POINTER ? () => setHovered(false) : undefined}
      onFocus={FINE_POINTER ? (e) => { setFocused(true); setFocusVisible((e.target as HTMLElement).matches?.(":focus-visible") === true); } : undefined}
      onBlur={FINE_POINTER ? onBlur : undefined}
    >
      <button
        type="button"
        onClick={() => { if (!longPress.consumeClick()) openFromCard(); }}
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onContextMenu={longPress.onContextMenu}
        aria-label={label}
        className="block w-full text-left focus-visible:outline-none"
        style={NO_CALLOUT}
      >
        <div ref={posterRef} data-vg-poster="" className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-[rgba(var(--brand-rgb),0.8)]">
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
          {/* Au survol, les étoiles disent la note : la pastille cède la place. */}
          {!active && <RatingChip score={marks?.score ?? null} publicRating={rating} lang={lang} />}
          {item.masked ? (
            // Masqué d'ordinaire par le filtre de contenu, montré par une recherche.
            <span
              aria-hidden
              className="absolute left-1.5 top-1.5 inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[10px] font-bold text-tentacle-on-media-primary"
              style={{ background: "var(--vg-plate)" }}
            >
              <EyeOffIcon className="h-3 w-3" />
              {t("seer:maskedResult")}
            </span>
          ) : marks && <MarkPlate marks={marks} bandSaysHere={bandSaysHere} />}
          {status && <StateBadge status={status} variant="band" />}
        </div>
        <p className="mt-2 truncate text-[13px] font-semibold leading-5 text-tentacle-text-primary">{title}</p>
        {caption != null ? (
          <p className="mt-0.5 truncate text-xs text-tentacle-text-tertiary">{caption}</p>
        ) : gap ? (
          <GapLine text={gap} />
        ) : (
          <ChannelLine channel={channel} fallback={[typeLabel, year].filter(Boolean).join(" · ")} year={channel ? year : undefined} />
        )}
      </button>
      {/* Monté au survol, jamais masqué : rien ne se compose hors écran. */}
      {layerMounted && (
        <HoverLayer item={item} status={status} marks={marks} onQuickRequest={onQuickRequest} name={title} visible={active && !previewShown} />
      )}
      {previewMounted && (
        <PosterPreview
          item={item}
          hovered={previewActive}
          anchorRef={posterRef}
          status={status}
          marks={marks}
          onQuickRequest={requestFromPreview}
          name={title}
          detail={status ? statusText(status, t) : gap ?? channel?.label ?? null}
          onOpen={openFromCard}
          onShown={setPreviewShown}
          onExit={onPreviewExit}
        />
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
