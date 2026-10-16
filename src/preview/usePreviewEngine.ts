/* ------------------------------------------------------------------ */
/*  Vigie — Le moteur de l'aperçu d'une affiche                        */
/* ------------------------------------------------------------------ */

/*
 * Monté par la SESSION d'aperçu d'une affiche (PosterPreview), qui n'existe
 * que pendant le survol : au repos, une carte ne porte rien. Il tient la
 * machine (machine.ts), arme UNE minuterie sur sa prochaine échéance, écoute
 * le pointeur et la molette pendant l'intention seulement, demande la
 * décision du titre (source.ts, une fois par titre) et prend la place
 * unique : jamais deux aperçus à la fois.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { getCurrentLanguage } from "../utils/media-helpers";
import { attachArbiter } from "./arbiter";
import { backendAbsolute, hostPreviewDelayMs, requestPreview } from "./host";
import { IDLE, previewDeadline, reducePreview, type PreviewPhase } from "./machine";
import { createPreviewSource, HLS_MIME, streamPathFor, type PreviewTitle } from "./source";
import { PREVIEW_TIMING } from "./timing";
import type { PreviewStream } from "./attachSource";

const now = () => performance.now();

/**
 * UNE source pour toute la page : la mémoire des décisions survit aux cartes ;
 * la préparation des affiches à l'écran (`warm.ts`) y range les aperçus prêts.
 */
export const previewSource = createPreviewSource((title) => requestPreview(title, getCurrentLanguage()));
const source = previewSource;

export interface PreviewEngine {
  phase: PreviewPhase;
  /** La mini-carte se montre (révélée, survol tenu). */
  visible: boolean;
  /** La vidéo existe : chargée cachée, montrée, ou dans son fondu de sortie. */
  mount: boolean;
  stream: PreviewStream | null;
  videoReady: boolean;
  crop: number;
  /** Le cycle d'aperçu : un nouveau cycle remonte une vidéo neuve. */
  cycle: number;
  onReady: (crop: number) => void;
  onFragment: () => void;
  onStillReady: () => void;
  onError: () => void;
  onEnded: () => void;
}

export function usePreviewEngine(title: PreviewTitle | null, hovered: boolean): PreviewEngine {
  const [state, dispatch] = useReducer(reducePreview, IDLE);
  const [stream, setStream] = useState<PreviewStream | null>(null);
  const [crop, setCrop] = useState(1);
  const [cycle, setCycle] = useState(0);
  // Le survol quitté pendant une lecture : la vidéo reste le temps du fondu, un retour la reprend.
  const [leaving, setLeaving] = useState(false);
  const titleRef = useRef(title);
  titleRef.current = title;
  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;

  const withVideo = state.phase === "buffering" || state.phase === "shown";

  // Le survol : un nouveau cycle, ou la reprise d'une lecture qu'on vient de quitter.
  useEffect(() => {
    if (hovered && title) {
      setLeaving(false);
      const p = phaseRef.current;
      if (p === "buffering" || p === "shown") return;
      setStream(null);
      setCrop(1);
      setCycle((c) => c + 1);
      // Le délai choisi dans Tentacle, le même que pour ses cartes (`timing.ts`).
      dispatch({ type: "start", at: now(), delayMs: hostPreviewDelayMs() });
      return;
    }
    if (phaseRef.current === "buffering" || phaseRef.current === "shown") {
      setLeaving(true);
      const id = setTimeout(() => {
        setLeaving(false);
        dispatch({ type: "stop", at: now() });
      }, PREVIEW_TIMING.exitMs);
      return () => clearTimeout(id);
    }
    dispatch({ type: "stop", at: now() });
  }, [hovered, title?.tmdbId, title?.mediaType]);

  // UNE minuterie, sur la prochaine échéance de la machine.
  const deadline = previewDeadline(state);
  useEffect(() => {
    if (deadline === null) return;
    const id = setTimeout(() => dispatch({ type: "tick", at: now() }), Math.max(0, deadline - now()));
    return () => clearTimeout(id);
  }, [deadline]);

  // L'intention exige un pointeur ARRÊTÉ : un mouvement, un coup de molette, un défilement la repoussent.
  useEffect(() => {
    if (state.phase !== "intent") return;
    let anchor: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (anchor && Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) < PREVIEW_TIMING.intentMovePx) return;
      anchor = { x: e.clientX, y: e.clientY };
      dispatch({ type: "move", at: now() });
    };
    const onScroll = () => dispatch({ type: "move", at: now() });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [state.phase]);

  // La demande : à chaque tentative de `fetching` (la première, puis après un refus passager).
  useEffect(() => {
    if (state.phase !== "fetching" || state.retryAt !== null || !title) return;
    let cancelled = false;
    void source.decide(title).then((decision) => {
      if (cancelled) return;
      if (decision.kind === "found") {
        const { preview } = decision;
        setStream({
          src: backendAbsolute(streamPathFor(preview, window.devicePixelRatio || 1)),
          kind: preview.mimeType === HLS_MIME ? "hls" : "mp4",
          burnedSubtitles: preview.version === "subtitled",
        });
        dispatch({ type: "found", at: now() });
      } else if (decision.kind === "missing") {
        dispatch({ type: "missing", at: now() });
      } else {
        dispatch({ type: "retry", at: now(), retryAt: now() + (decision.retryAt - Date.now()) });
      }
    });
    return () => { cancelled = true; };
  }, [state.phase, state.attempt, state.retryAt]);

  // Une seule vidéo à la fois : celle-ci prend la place tant qu'elle existe.
  useEffect(() => {
    if (!withVideo) return;
    return attachArbiter(() => dispatch({ type: "ended", at: now() }));
  }, [withVideo, cycle]);

  // Un flux trouvé qui ne se lit pas : plus de tentative avant 10 min.
  useEffect(() => {
    if (state.phase === "over" && state.failed && titleRef.current) source.markFailed(titleRef.current);
  }, [state.phase, state.failed]);

  const onReady = useCallback((scale: number) => {
    setCrop(scale > 1 ? scale : 1);
    dispatch({ type: "videoReady", at: now() });
  }, []);
  const onFragment = useCallback(() => dispatch({ type: "fragment", at: now() }), []);
  const onStillReady = useCallback(() => dispatch({ type: "stillReady", at: now() }), []);
  const onError = useCallback(() => dispatch({ type: "fail", at: now() }), []);
  const onEnded = useCallback(() => dispatch({ type: "ended", at: now() }), []);

  return {
    phase: state.phase,
    visible: state.phase === "shown" && hovered && !leaving,
    mount: withVideo && stream !== null,
    stream: withVideo ? stream : null,
    videoReady: state.videoReady,
    crop,
    cycle,
    onReady,
    onFragment,
    onStillReady,
    onError,
    onEnded,
  };
}
