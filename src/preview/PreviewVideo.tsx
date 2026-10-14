/* ------------------------------------------------------------------ */
/*  Vigie — L'élément vidéo d'un aperçu                                */
/* ------------------------------------------------------------------ */

/*
 * Le jumeau de `TrailerPreviewVideo` du cœur : la source se pose CACHÉE et EN
 * PAUSE (attachSource.ts) ; la lecture part quand `playing` est vrai — dès
 * que la mini-carte paraît, agrandissement compris —, le son glisse vers
 * 0,6. Un navigateur qui refuse le son : la lecture continue en muet, sans
 * erreur. Une lecture montrée qui attend ses données plus de 5 s s'efface.
 *
 * ⚠️ Cachée par l'OPACITÉ pendant le chargement, jamais `display: none` : une
 * vidéo non rendue ne compose pas sa première image.
 */

import { memo, useEffect, useRef } from "react";
import { attachPreviewSource, type PreviewStream, type SourceSession } from "./attachSource";
import { PREVIEW_TIMING } from "./timing";

interface PreviewVideoProps {
  stream: PreviewStream;
  cycle: number;
  /** La vidéo joue : montrée, ou dans le fondu de sortie de la mini-carte. */
  playing: boolean;
  /** Le volume visé (0,6 montrée, 0 pendant la sortie) : le son y glisse. */
  volume: number;
  /** La première image n'est pas encore là : la vidéo reste invisible (l'image du titre se voit). */
  waiting: boolean;
  muted: boolean;
  className: string;
  onReady: (crop: number) => void;
  onFragment: () => void;
  onError: () => void;
  onEnded: () => void;
  /** Le navigateur a refusé le son : la lecture continue en muet. */
  onSoundBlocked: () => void;
}

/** Fait glisser le volume vers `target` en `ms` ; rend l'arrêt. */
function rampVolume(video: HTMLVideoElement, target: number, ms: number): () => void {
  const from = video.volume;
  const start = performance.now();
  let frame = 0;
  const step = () => {
    const t = ms <= 0 ? 1 : Math.min(1, (performance.now() - start) / ms);
    video.volume = Math.min(1, Math.max(0, from + (target - from) * t));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

export const PreviewVideo = memo(function PreviewVideo(props: PreviewVideoProps) {
  const { stream, cycle, playing, volume, waiting, muted, className } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<SourceSession | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const session = attachPreviewSource(video, stream, {
      onReady: (crop) => latest.current.onReady(crop),
      onFragment: () => latest.current.onFragment(),
      onError: () => latest.current.onError(),
    });
    sessionRef.current = session;
    return () => {
      session.release();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [stream.src, stream.kind, cycle]);

  useEffect(() => {
    if (playing) sessionRef.current?.unleash();
  }, [playing, cycle]);

  const running = playing;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !running) {
      video?.pause();
      return;
    }
    let cancelled = false;
    video.volume = 0;
    const attempt = (sound: boolean) => {
      video.muted = !sound;
      video.play().catch((error: { name?: string }) => {
        if (cancelled || error?.name === "AbortError") return;
        if (sound && error?.name === "NotAllowedError") {
          latest.current.onSoundBlocked();
          attempt(false);
          return;
        }
        latest.current.onError();
      });
    };
    attempt(!latest.current.muted);
    // Une lecture qui attend ses données trop longtemps s'efface plutôt que de rester figée.
    let stall: ReturnType<typeof setTimeout> | null = null;
    const onWaiting = () => {
      if (stall === null) stall = setTimeout(() => latest.current.onError(), PREVIEW_TIMING.stallTimeoutMs);
    };
    const onFlow = () => {
      if (stall !== null) clearTimeout(stall);
      stall = null;
    };
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onFlow);
    video.addEventListener("timeupdate", onFlow);
    return () => {
      cancelled = true;
      onFlow();
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onFlow);
      video.removeEventListener("timeupdate", onFlow);
    };
  }, [running, cycle]);

  // Le son coupé ou rendu d'un geste, en cours de lecture.
  useEffect(() => {
    const video = videoRef.current;
    if (video && running) video.muted = muted;
  }, [muted, running]);

  // Le volume glisse : fondu d'entrée à la révélation, de sortie au départ.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !running) return;
    const rising = volume > video.volume;
    return rampVolume(video, volume, rising ? PREVIEW_TIMING.audioFadeInMs : PREVIEW_TIMING.exitMs);
  }, [volume, running]);

  return (
    <video
      ref={videoRef}
      className={className}
      data-waiting={waiting}
      playsInline
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      aria-hidden="true"
      tabIndex={-1}
      onEnded={() => latest.current.onEnded()}
    />
  );
});
