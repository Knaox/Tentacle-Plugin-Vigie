/* ------------------------------------------------------------------ */
/*  Vigie — la vidéo d'un aperçu, lue PAR L'HÔTE                        */
/* ------------------------------------------------------------------ */

/*
 * Mesuré le 14 oct. 2026 (Chromium 150+ : Electron 43, Chrome 152) : la page
 * de Vigie vit dans un cadre isolé (origine opaque, `tentacle://plugin` sur le
 * bureau) qui ne peut plus joindre un serveur du RÉSEAU LOCAL (Local Network
 * Access) — `localhost`, `192.168.…`. hls.js y échouait sur le premier
 * manifeste, en 2 ms : aucun aperçu, sur aucun titre.
 *
 * Un hôte qui le sait (`__tentacle_env.mediaBridge`, Tentacle 1.30.0) lit les
 * octets du relais pour nous (`__tentacle_bridge.fetchMedia`) : hls.js reçoit
 * ici un chargeur qui passe par lui. Un hôte d'avant : le chargeur de hls.js,
 * comme avant (qui marche face à un serveur public).
 */

interface MediaResponse {
  status: number;
  contentType: string;
  body: ArrayBuffer;
}

type FetchMedia = (url: string, range?: string) => Promise<MediaResponse>;

/** La lecture de média par l'hôte, s'il la propose ; `null` sinon. */
export function hostMediaFetch(): FetchMedia | null {
  const w = window as unknown as { __tentacle_env?: { mediaBridge?: boolean }; __tentacle_bridge?: { fetchMedia?: FetchMedia } };
  const fetchMedia = w.__tentacle_bridge?.fetchMedia;
  return w.__tentacle_env?.mediaBridge === true && typeof fetchMedia === "function" ? fetchMedia : null;
}

/* Le contrat de chargeur de hls.js (1.x), réduit à ce qu'il appelle. */
interface LoaderContext {
  url: string;
  responseType?: string;
  rangeStart?: number;
  rangeEnd?: number;
}
interface LoaderCallbacks {
  onSuccess: (response: { url: string; data: string | ArrayBuffer; code: number }, stats: LoaderStats, context: LoaderContext, details: unknown) => void;
  onError: (error: { code: number; text: string }, context: LoaderContext, details: unknown, stats: LoaderStats) => void;
  onTimeout: (stats: LoaderStats, context: LoaderContext, details: unknown) => void;
}
interface LoaderStats {
  aborted: boolean;
  loaded: number;
  retry: number;
  total: number;
  chunkCount: number;
  bwEstimate: number;
  loading: { start: number; first: number; end: number };
  parsing: { start: number; end: number };
  buffering: { start: number; first: number; end: number };
}

const freshStats = (): LoaderStats => ({
  aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 0, bwEstimate: 0,
  loading: { start: 0, first: 0, end: 0 }, parsing: { start: 0, end: 0 }, buffering: { start: 0, first: 0, end: 0 },
});

/** Une plage d'octets hls.js → l'en-tête `Range` (fin exclusive chez hls.js). */
export function rangeHeader(context: Pick<LoaderContext, "rangeStart" | "rangeEnd">): string | undefined {
  const { rangeStart, rangeEnd } = context;
  if (typeof rangeStart !== "number" || (rangeStart === 0 && !rangeEnd)) return undefined;
  return `bytes=${rangeStart}-${typeof rangeEnd === "number" && rangeEnd > 0 ? rangeEnd - 1 : ""}`;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** La classe de chargeur à donner à hls.js (`loader`), branchée sur la lecture de l'hôte. */
export function bridgeLoaderClass(fetchMedia: FetchMedia) {
  return class BridgeLoader {
    context: LoaderContext | null = null;
    stats: LoaderStats = freshStats();
    private done = false;
    private timer: ReturnType<typeof setTimeout> | undefined;

    load(context: LoaderContext, config: { maxLoadTimeMs?: number; timeout?: number }, callbacks: LoaderCallbacks): void {
      this.context = context;
      this.stats = freshStats();
      this.done = false;
      const stats = this.stats;
      stats.loading.start = performance.now();
      const limit = config.maxLoadTimeMs ?? config.timeout ?? DEFAULT_TIMEOUT_MS;
      this.timer = setTimeout(() => {
        if (this.finish()) callbacks.onTimeout(stats, context, null);
      }, limit);
      fetchMedia(context.url, rangeHeader(context)).then((res) => {
        if (!this.finish()) return;
        const now = performance.now();
        stats.loading.first = stats.loading.end = now;
        stats.loaded = stats.total = res.body.byteLength;
        if (res.status < 200 || res.status >= 300) {
          callbacks.onError({ code: res.status, text: `HTTP ${res.status}` }, context, null, stats);
          return;
        }
        const data = context.responseType === "arraybuffer" ? res.body : new TextDecoder().decode(res.body);
        callbacks.onSuccess({ url: context.url, data, code: res.status }, stats, context, null);
      }, (err: unknown) => {
        if (this.finish()) callbacks.onError({ code: 0, text: err instanceof Error ? err.message : String(err) }, context, null, stats);
      });
    }

    /** Vrai la première fois seulement : une réponse tardive après un abandon ne dit plus rien. */
    private finish(): boolean {
      if (this.done) return false;
      this.done = true;
      clearTimeout(this.timer);
      return true;
    }

    abort(): void {
      this.stats.aborted = true;
      this.finish();
    }

    destroy(): void {
      this.abort();
      this.context = null;
    }

    getCacheAge(): number | null {
      return null;
    }

    getResponseHeader(): string | null {
      return null;
    }
  };
}

/** Un MP4 entier lu par l'hôte → une adresse `blob:` que l'élément lit seul ; `null` en échec. */
export async function bridgeBlobUrl(fetchMedia: FetchMedia, url: string): Promise<string | null> {
  try {
    const res = await fetchMedia(url);
    if (res.status < 200 || res.status >= 300) return null;
    return URL.createObjectURL(new Blob([res.body], { type: res.contentType || "video/mp4" }));
  } catch {
    return null;
  }
}
