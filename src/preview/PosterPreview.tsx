/* ------------------------------------------------------------------ */
/*  Vigie — La mini-carte d'aperçu d'une affiche                        */
/* ------------------------------------------------------------------ */

/*
 * La SESSION d'aperçu d'une affiche : montée par PosterCard pendant le survol
 * seulement (au repos, une carte ne porte rien), elle tient le moteur, et
 * rend la MINI-CARTE dans un portail fixé à l'écran, qu'aucun `overflow` de
 * rangée ne rogne — mais DANS l'arbre React de la carte : passer de
 * l'affiche à la mini-carte ne quitte pas le survol.
 *
 * La mini-carte se pose cachée dès que le flux est trouvé (la vidéo se charge
 * en pause), se montre au rendez-vous en grandissant depuis l'affiche — la
 * vidéo JOUE dès cet instant, agrandissement compris —, révélée sur l'image
 * du titre si la vidéo n'a pas encore sa première image, qui la rejoint
 * alors en fondu. Elle reste accrochée
 * à sa carte quand la page défile. Dans une rangée, les voisines s'écartent
 * (transform seul) ; dans une grille, elle passe au-dessus.
 */

import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { portal } from "./portal";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import type { TitleMarks } from "../hub/UserMarks";
import type { TitleStatus } from "../utils/title-state";
import { usePosterGestures } from "../hooks/usePosterGestures";
import { backdropUrl } from "../utils/media-helpers";
import { VolumeOffIcon, VolumeOnIcon } from "../components/ui/icons";
import { watchPreviewExits, type PreviewExit } from "./exitGuard";
import { deviceAllowsPreviews, setPreviewMuted, setPreviewVolume, useHostPreviewEnv, useServerPreviewCapability } from "./host";
import { fromTransform, placePreview, type Placement } from "./placement";
import { PreviewPanel } from "./PreviewPanel";
import { PreviewVideo } from "./PreviewVideo";
import { injectPreviewStyles } from "./previewStyles";
import { openRailRoom } from "./railRoom";
import { usePreviewEngine } from "./usePreviewEngine";

/** Le bas de la barre d'onglets collante de Vigie : la mini-carte ne passe pas dessous. */
function safeTopFor(anchorTop: number): number {
  const sticky = document.querySelector("[data-vg-sticky-top]");
  if (!sticky) return 0;
  const bottom = sticky.getBoundingClientRect().bottom;
  return bottom <= anchorTop ? Math.max(0, bottom) : 0;
}

function measure(anchor: HTMLElement | null): Placement | null {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  return placePreview(
    { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    { width: window.innerWidth, height: window.innerHeight, safeTop: safeTopFor(rect.top) },
  );
}

export interface PosterPreviewProps {
  item: SeerrSearchResult;
  hovered: boolean;
  /** L'affiche de la carte : l'ancre de la place et du départ. */
  anchorRef: RefObject<HTMLElement | null>;
  status: TitleStatus | null;
  marks: TitleMarks | null;
  onQuickRequest?: (item: SeerrSearchResult) => void;
  name: string;
  detail: string | null;
  onOpen: () => void;
  /** La mini-carte est vue : l'affiche s'efface dessous, son survol se retire. */
  onShown: (shown: boolean) => void;
  /** Le pointeur a quitté la page, la fenêtre s'est effacée, ou Échap : la carte coupe l'aperçu. */
  onExit: (kind: PreviewExit) => void;
}

export function PosterPreview(props: PosterPreviewProps) {
  const { item, hovered, anchorRef, name, onShown, onExit } = props;
  const { t } = useTranslation("seer");
  const mediaType = item.mediaType === "tv" ? "tv" : "movie";
  const host = useHostPreviewEnv();
  const device = deviceAllowsPreviews();
  const capable = useServerPreviewCapability(device && host.enabled);
  // Serveur sans aperçu, réglage coupé, hors ligne : rien ne se demande, rien ne s'anime.
  const allowed = device && host.enabled && capable && navigator.onLine !== false;
  const engine = usePreviewEngine({ tmdbId: item.id, mediaType }, hovered && allowed);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const muted = host.muted || soundBlocked;
  const [placement, setPlacement] = useState<Placement | null>(null);
  const still = backdropUrl(item.backdropPath, "w780");

  useEffect(() => { injectPreviewStyles(); }, []);

  // Le filet : aucune mini-carte orpheline si la sortie du pointeur n'arrive jamais (exitGuard.ts).
  useEffect(() => {
    if (!hovered) return;
    return watchPreviewExits(window, document, onExit);
  }, [hovered, onExit]);

  // La place se prend quand la vidéo se pose (cachée), et suit la carte quand la page défile.
  useLayoutEffect(() => {
    if (!engine.mount) {
      setPlacement(null);
      return;
    }
    setPlacement(measure(anchorRef.current));
    let frame = 0;
    const follow = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setPlacement((current) => {
          const next = measure(anchorRef.current);
          if (!next || !current) return next;
          return next.left === current.left && next.top === current.top && next.width === current.width ? current : { ...next, from: current.from };
        });
      });
    };
    window.addEventListener("scroll", follow, { passive: true, capture: true });
    window.addEventListener("resize", follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", follow, { capture: true });
      window.removeEventListener("resize", follow);
    };
  }, [engine.mount, engine.cycle, anchorRef]);

  useEffect(() => {
    onShown(engine.visible);
  }, [engine.visible, onShown]);
  useEffect(() => () => onShown(false), [onShown]);

  // Dans une rangée, les voisines s'écartent ; elles reviennent au départ de la mini-carte.
  useEffect(() => {
    if (!engine.visible || !placement || !anchorRef.current) return;
    return openRailRoom(anchorRef.current, placement);
  }, [engine.visible, placement?.width]); // la place, une fois : le défilement ne rouvre rien

  if (!engine.mount || !engine.stream || !placement || typeof document === "undefined") return null;

  const style = {
    left: placement.left,
    top: placement.top,
    width: placement.width,
    height: placement.height,
    "--vgp-from": fromTransform(placement.from),
    "--vgp-video-h": `${placement.videoHeight}px`,
    "--vgp-crop": String(engine.crop),
  } as CSSProperties;

  return portal(
    <div
      className="vgp"
      data-shown={engine.visible}
      style={style}
      role="group"
      aria-label={t("seer:previewLabel", { title: name })}
      aria-hidden={!engine.visible}
      inert={!engine.visible}
      onClick={props.onOpen}
    >
      <div className="vgp-surface">
        <div className="vgp-stage">
          {still && (
            <img
              className="vgp-still"
              src={still}
              alt=""
              decoding="async"
              draggable={false}
              onLoad={(e) => { e.currentTarget.decode().then(engine.onStillReady, () => undefined); }}
            />
          )}
          <PreviewVideo
            stream={engine.stream}
            cycle={engine.cycle}
            playing={engine.phase === "shown"}
            volume={engine.visible ? host.volume : 0}
            waiting={!engine.videoReady}
            muted={muted}
            className="vgp-video"
            onReady={engine.onReady}
            onFragment={engine.onFragment}
            onError={engine.onError}
            onEnded={engine.onEnded}
            onSoundBlocked={() => setSoundBlocked(true)}
          />
          <div className="vgp-veil" aria-hidden />
          {/* Le son : le bouton et, à sa gauche, la réglette du volume, dépliée au survol ou au
              focus — retenus par l'hôte pour les aperçus suivants, comme ses propres cartes. */}
          <div className="vgp-sound" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={muted ? 0 : Math.round(host.volume * 100)}
              aria-label={t("seer:previewVolume")}
              onChange={(e) => {
                setSoundBlocked(false);
                setPreviewVolume(Number(e.currentTarget.value) / 100);
              }}
              className="vgp-volume"
            />
            <button
              type="button"
              className="vgp-mute"
              aria-label={t(muted ? "seer:previewUnmute" : "seer:previewMute")}
              title={t(muted ? "seer:previewUnmute" : "seer:previewMute")}
              onClick={(e) => {
                e.stopPropagation();
                setSoundBlocked(false);
                setPreviewMuted(!muted);
              }}
            >
              {muted ? <VolumeOffIcon /> : <VolumeOnIcon />}
            </button>
          </div>
        </div>
        <PanelWithGestures {...props} />
      </div>
    </div>,
    document.body,
  );
}

function PanelWithGestures({ item, status, marks, onQuickRequest, name, detail, onOpen }: PosterPreviewProps) {
  const gestures = usePosterGestures(item, status, marks, onQuickRequest);
  return <PreviewPanel item={item} name={name} gestures={gestures} detail={detail} onOpen={onOpen} />;
}
