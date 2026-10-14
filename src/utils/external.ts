/**
 * Comportements plateforme — ceux du core web (apps/web/src/lib/openExternal.ts,
 * le lecteur des bandes-annonces). La branche « Mac Tauri » est retirée : le
 * cœur n'a plus de coquille Tauri, `tauri` y est toujours faux.
 *
 * Le plugin tourne dans une iframe sandboxée (allow-scripts seul) : pas d'accès
 * à __TAURI_INTERNALS__ ni à window.open. Le host injecte `window.__tentacle_env`
 * (plateforme + base backend) et expose `__tentacle_bridge.openExternal`.
 */

interface TentacleHostEnv {
  backendUrl?: string;
  /** L'hôte ouvre son lecteur complet sur le catalogue (`openTrailerFor`) — cœur 1.30.0 et plus. */
  trailerCatalog?: boolean;
}

function hostEnv(): TentacleHostEnv {
  return ((window as unknown as Record<string, unknown>).__tentacle_env as TentacleHostEnv) ?? {};
}

/** Source de l'iframe d'embed de `youtubeId` : `youtube-nocookie`, comme le core. */
export function youtubeEmbedSrc(youtubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`;
}

/** Ouvre une URL dans le navigateur système via le bridge host (repli window.open). */
export function openExternal(url: string): void {
  if (!url) return;
  const bridge = (window as unknown as Record<string, unknown>).__tentacle_bridge as
    { openExternal?: (url: string) => void } | undefined;
  if (bridge?.openExternal) {
    bridge.openExternal(url);
    return;
  }
  // Mobile WebView / contexte hors iframe : postMessage RN ou window.open.
  const rnWebView = (window as unknown as Record<string, unknown>).ReactNativeWebView as
    { postMessage?: (msg: string) => void } | undefined;
  if (rnWebView?.postMessage) {
    rnWebView.postMessage(JSON.stringify({ type: "OPEN_EXTERNAL", url }));
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Handler de clic prêt à l'emploi pour un lien externe (preventDefault + openExternal). */
export function externalLinkHandler(url: string) {
  return (e: { preventDefault: () => void }) => {
    e.preventDefault();
    openExternal(url);
  };
}

/**
 * Joue les bandes-annonces via le TrailerModal du HOST quand le bridge le
 * permet. Un embed YouTube imbriqué dans l'iframe sandboxée du plugin hérite
 * de la sandbox (pas d'allow-same-origin) → le player YouTube plante
 * (SecurityError caches / writeEmbed). Retourne false si le bridge est absent
 * (mobile WebView) — l'appelant retombe sur la modale locale.
 */
export function openTrailersViaHost(
  trailers: Array<{ Url: string; Name?: string }>,
  index = 0,
): boolean {
  const bridge = (window as unknown as Record<string, unknown>).__tentacle_bridge as
    { openTrailer?: (trailers: Array<{ Url: string; Name?: string }>, index: number) => void } | undefined;
  if (!bridge?.openTrailer || trailers.length === 0) return false;
  bridge.openTrailer(trailers.map((t) => ({ Url: t.Url, Name: t.Name })), index);
  return true;
}

/** L'hôte sait-il ouvrir son lecteur COMPLET (sans publicité) sur le catalogue d'un titre ? */
export function hostPlaysCatalog(): boolean {
  return hostEnv().trailerCatalog === true;
}

export interface TrailerCatalogQuery {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  title?: string;
  /** La bande-annonce cliquée (`yt:<id>`, `dm:<id>`). */
  start?: string;
}

/**
 * Ouvre le lecteur complet de l'HÔTE sur le catalogue du titre — même ordre,
 * zéro publicité, même repli que les fiches de Tentacle. `false` si l'hôte ne
 * sait pas le faire (cœur d'avant, WebView du mobile d'aujourd'hui) :
 * l'appelant garde `openTrailersViaHost` ou la modale locale.
 */
export function openTrailerForViaHost(query: TrailerCatalogQuery): boolean {
  const bridge = (window as unknown as Record<string, unknown>).__tentacle_bridge as
    { openTrailerFor?: (query: TrailerCatalogQuery) => void } | undefined;
  if (!hostPlaysCatalog() || !bridge?.openTrailerFor) return false;
  bridge.openTrailerFor(query);
  return true;
}
