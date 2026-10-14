/* ------------------------------------------------------------------ */
/*  Vigie — hls.js, chargé à la demande                                */
/* ------------------------------------------------------------------ */

/*
 * hls.js pèse ~540 Ko (≈ 160 Ko compressé) : il n'entre PAS dans le paquet
 * de Vigie, chargé dans chaque iframe. Il est servi par le serveur de Vigie
 * (`GET /api/plugins/seer/vendor/hls.js`, le fichier livré dans `dist/vendor/`)
 * et injecté au PREMIER aperçu HLS, une fois — comme l'hôte injecte le paquet
 * de Vigie lui-même (script en ligne : permis par la politique de l'iframe,
 * rien à desserrer). Un appareil qui ne survole jamais rien ne le charge pas.
 */

/** Le peu de hls.js dont l'aperçu se sert. */
export interface HlsInstance {
  loadSource(src: string): void;
  attachMedia(video: HTMLVideoElement): void;
  startLoad(at?: number): void;
  stopLoad(): void;
  destroy(): void;
  on(event: string, handler: (event: string, data: any) => void): void;
  config: { maxBufferLength: number; maxMaxBufferLength: number };
}

export interface HlsConstructor {
  new (config: Record<string, unknown>): HlsInstance;
  isSupported(): boolean;
  Events: Record<string, string>;
}

type HlsWindow = Window & { Hls?: HlsConstructor };

let loading: Promise<HlsConstructor | null> | null = null;
let failedAt = 0;
/** Après un échec, on ne redemande pas le fichier avant ce délai. */
const RETRY_AFTER_MS = 10 * 60_000;

/** La version du paquet — le fichier est mis en cache par le navigateur de l'hôte, par version. */
declare const __VIGIE_VERSION__: string | undefined;

export function loadHls(): Promise<HlsConstructor | null> {
  const w = window as HlsWindow;
  if (w.Hls) return Promise.resolve(w.Hls);
  if (!loading && Date.now() - failedAt < RETRY_AFTER_MS) return Promise.resolve(null);
  loading ??= (async () => {
    try {
      const version = typeof __VIGIE_VERSION__ === "string" ? __VIGIE_VERSION__ : "0";
      const res = await fetch(`/api/plugins/seer/vendor/hls.js?v=${encodeURIComponent(version)}`);
      if (!res.ok) return null;
      // Le pont de l'hôte relaie le texte en JSON : une chaîne, ou le texte brut.
      const raw = await res.text();
      let code: unknown = raw;
      try { code = JSON.parse(raw); } catch { /* texte brut */ }
      if (typeof code !== "string" || code.length < 1000) return null;
      const script = document.createElement("script");
      script.textContent = code;
      document.head.appendChild(script);
      script.remove();
      return w.Hls ?? null;
    } catch {
      return null;
    }
  })().then((ctor) => {
    // Un échec se retente plus tard, jamais à chaque survol.
    if (!ctor) {
      loading = null;
      failedAt = Date.now();
    }
    return ctor;
  });
  return loading;
}
