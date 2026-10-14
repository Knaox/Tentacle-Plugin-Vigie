/* ------------------------------------------------------------------ */
/*  Vigie — Poser le flux d'un aperçu sur un élément vidéo              */
/* ------------------------------------------------------------------ */

/*
 * Le flux se pose CACHÉ et EN PAUSE dès qu'il est trouvé : seul le premier
 * segment se charge (celui que le serveur a lu d'avance) tant que la
 * mini-carte n'est pas montrée ; `unleash` élargit le tampon ensuite. Comme
 * les cartes de Tentacle (`previewSource.ts` du cœur) : hls.js d'abord (lui
 * seul dit quand le premier fragment vidéo arrive et laisse partir à 4 s),
 * l'élément seul en dernier recours, un MP4 lu par plages. Rien ne consomme
 * une fois relâché : hls.js détruit, l'élément vidé. Quittée en cours de
 * route, la bande-annonce reprend au retour où on l'avait laissée
 * (`positions.ts`).
 */

import { loadHls, type HlsInstance } from "./hlsLoader";
import { measureVideoCrop } from "./letterbox";
import { forgetPosition, rememberPosition, resumePositionFor } from "./positions";
import { HLS_MIME } from "./source";
import { PREVIEW_TIMING } from "./timing";

export interface PreviewStream {
  src: string;
  kind: "hls" | "mp4";
  /**
   * Une VOSTFR : ses sous-titres sont INCRUSTÉS, souvent dans la bande noire
   * du bas — jamais rognée, sinon ils disparaissent (même règle que le cœur).
   */
  burnedSubtitles?: boolean;
}

export interface SourceHandlers {
  /** La première image est décodée ; `crop` rogne son letterbox (1 : rien). */
  onReady: (crop: number) => void;
  /** Le premier fragment VIDÉO est reçu : le flux coule. */
  onFragment: () => void;
  onError: () => void;
}

export interface SourceSession {
  unleash(): void;
  release(): void;
}

const PRELOAD_BUFFER_S = 1;
const PLAY_BUFFER_S = 12;
const PLAY_MAX_BUFFER_S = 15;

const LOAD_POLICY = {
  default: {
    maxTimeToFirstByteMs: 6_000,
    maxLoadTimeMs: 15_000,
    timeoutRetry: { maxNumRetry: 1, retryDelayMs: 0, maxRetryDelayMs: 0 },
    errorRetry: { maxNumRetry: 1, retryDelayMs: 500, maxRetryDelayMs: 1_000 },
  },
};

export function attachPreviewSource(video: HTMLVideoElement, stream: PreviewStream, handlers: SourceHandlers): SourceSession {
  let released = false;
  let ready = false;
  let flowing = false;
  let hls: HlsInstance | null = null;
  let playedOnce = false;
  const resumeAt = resumePositionFor(stream.src);

  const fail = () => { if (!released) handlers.onError(); };
  const markFlowing = () => {
    if (released || flowing) return;
    flowing = true;
    handlers.onFragment();
  };
  const onLoadedData = () => {
    if (released || ready) return;
    ready = true;
    markFlowing();
    // L'image décodée est présentée à l'image suivante : la mesure la lit alors.
    // Jamais de rognage pour une VOSTFR : ses sous-titres vivent dans la bande du bas.
    requestAnimationFrame(() => { if (!released) handlers.onReady(stream.burnedSubtitles ? 1 : measureVideoCrop(video)); });
  };
  const onProgress = () => { if (video.buffered.length > 0) markFlowing(); };
  const onPlaying = () => { playedOnce = true; };
  const onEnded = () => forgetPosition(stream.src);
  // MP4 ou lecture native : la reprise se pose dès que la durée est connue.
  const onLoadedMetadata = () => { if (resumeAt !== null && !hls) video.currentTime = resumeAt; };
  video.addEventListener("loadeddata", onLoadedData);
  video.addEventListener("progress", onProgress);
  video.addEventListener("error", fail);
  video.addEventListener("playing", onPlaying);
  video.addEventListener("ended", onEnded);
  video.addEventListener("loadedmetadata", onLoadedMetadata);

  const nativeSupport = video.canPlayType(stream.kind === "hls" ? HLS_MIME : "video/mp4") !== "";
  const playNatively = () => {
    video.src = stream.src;
    video.load();
  };

  if (stream.kind === "mp4") {
    if (nativeSupport) playNatively();
    else queueMicrotask(fail);
  } else if (typeof MediaSource === "undefined") {
    if (nativeSupport) playNatively();
    else queueMicrotask(fail);
  } else {
    void loadHls().then((Hls) => {
      if (released) return;
      if (!Hls || !Hls.isSupported()) {
        if (nativeSupport) playNatively();
        else fail();
        return;
      }
      const instance = new Hls({
        autoStartLoad: false,
        capLevelToPlayerSize: false,
        maxBufferLength: PRELOAD_BUFFER_S,
        maxMaxBufferLength: PRELOAD_BUFFER_S + 1,
        backBufferLength: 0,
        enableWorker: true,
        fragLoadPolicy: LOAD_POLICY,
        manifestLoadPolicy: LOAD_POLICY,
        playlistLoadPolicy: LOAD_POLICY,
      });
      hls = instance;
      const { Events } = Hls;
      instance.on(Events.MANIFEST_PARSED, () => instance.startLoad(resumeAt ?? PREVIEW_TIMING.startOffsetS));
      // Le départ à 4 s ne vaut que dans le premier segment d'une vidéo assez longue ; une reprise garde sa position.
      let checked = resumeAt !== null;
      instance.on(Events.LEVEL_LOADED, (_e, data) => {
        if (checked) return;
        checked = true;
        const details = data?.details;
        const first = details?.fragments?.[0];
        const keeps = details && details.totalduration >= PREVIEW_TIMING.startOffsetMinDurationS
          && first && first.duration >= PREVIEW_TIMING.startOffsetS + 0.5;
        if (!keeps) {
          instance.stopLoad();
          instance.startLoad(0);
        }
      });
      instance.on(Events.FRAG_LOADED, (_e, data) => { if (data?.frag?.type === "main") markFlowing(); });
      instance.on(Events.ERROR, (_e, data) => { if (data?.fatal) fail(); });
      instance.loadSource(stream.src);
      instance.attachMedia(video);
    }, fail);
  }

  return {
    unleash() {
      if (!hls || released) return;
      hls.config.maxBufferLength = PLAY_BUFFER_S;
      hls.config.maxMaxBufferLength = PLAY_MAX_BUFFER_S;
    },
    release() {
      if (released) return;
      released = true;
      if (ready && playedOnce && !video.ended) rememberPosition(stream.src, video.currentTime, video.duration);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("error", fail);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      hls?.destroy();
      hls = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    },
  };
}
