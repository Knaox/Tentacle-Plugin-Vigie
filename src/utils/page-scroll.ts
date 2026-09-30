/* ------------------------------------------------------------------ */
/*  Vigie — Le défilement de la page                                   */
/* ------------------------------------------------------------------ */

/*
 * Dans l'application iOS, la page d'une extension vit dans une WKWebView dont
 * le défilement PRINCIPAL garde à peine son élan : react-native-webview
 * (13.x, New Architecture) lui impose une décélération que personne n'a
 * choisie. Mesuré au banc : 0,992 par milliseconde, quand une liste native de
 * Tentacle garde 0,998 — un même jet de doigt parcourt cinq fois moins de
 * chemin, et la page s'arrête net. C'est tout le « moins fluide, moins
 * rapide » de Vigie sur iPhone et iPad.
 *
 * Une boîte qui défile DANS la page, elle, est un défileur de WebKit, pas
 * celui de la WebView : elle garde la physique native — l'élan, le rebond.
 * Dans la WebView iOS, la page de Vigie défile donc dans sa propre boîte,
 * calée sur l'écran. Ailleurs (web, bureau, Android) rien ne change : le
 * document défile, comme avant.
 *
 * Tout ce qui lisait ou pilotait le défilement de la fenêtre passe par ici :
 * la position, le retour en haut, l'écoute, la hauteur visible, le blocage
 * pendant qu'un panneau est ouvert.
 */

/** La classe de la boîte qui défile (WebView iOS seulement). */
export const PAGE_BOX_CLASS = "vg-page-box";

const STYLE_ID = "vg-page-scroll";

let box: HTMLElement | null = null;
let enabled: boolean | null = null;
let keyboardWatch: (() => void) | null = null;

interface HostWindow {
  ReactNativeWebView?: { postMessage?: unknown };
  webkit?: { messageHandlers?: unknown };
}

/**
 * La WebView iOS de l'application : le pont React Native (`ReactNativeWebView`)
 * ET WebKit (`webkit.messageHandlers`, que la WebView Android n'a pas). Le web
 * et le bureau n'ont ni l'un ni l'autre.
 */
export function isIosWebView(win: HostWindow): boolean {
  return typeof win.ReactNativeWebView?.postMessage === "function" && !!win.webkit?.messageHandlers;
}

/** Vrai quand la page de Vigie défile dans sa propre boîte. */
export function ownsPageScroll(): boolean {
  if (enabled === null) enabled = typeof window !== "undefined" && isIosWebView(window as unknown as HostWindow);
  return enabled;
}

/**
 * La feuille de style de ce mode. Le document ne défile plus (ni rebond, qui
 * ferait glisser la page entière sous le doigt) ; la boîte occupe l'écran,
 * défile verticalement et garde son rebond pour elle (`contain`).
 *
 * `absolute` et non `fixed` : le document immobile, les deux calent la boîte
 * sur l'écran, mais `fixed` crée un contexte d'empilement — les feuilles nées
 * DANS la page (filtres du catalogue) passaient alors sous le bouton « Revenir
 * en haut », posé à côté de la boîte.
 */
export function pageScrollCss(): string {
  return "html,body{height:100%;overflow:hidden;overscroll-behavior:none;}"
    + `.${PAGE_BOX_CLASS}{position:absolute;top:0;right:0;left:0;bottom:var(--vg-keyboard,0px);`
    + "overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;}";
}

/**
 * Ce que le clavier couvre en bas de l'écran. Il ne réduit que le viewport
 * VISUEL : sans cette marge, la fin de la page restait sous le clavier.
 */
export function keyboardInset(layoutHeight: number, visualHeight: number, visualTop: number): number {
  return Math.max(0, Math.round(layoutHeight - visualHeight - visualTop));
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = pageScrollCss();
  document.head.appendChild(style);
}

function watchKeyboard(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const update = () => {
    const inset = keyboardInset(window.innerHeight, vv.height, vv.offsetTop);
    document.documentElement.style.setProperty("--vg-keyboard", `${inset}px`);
  };
  vv.addEventListener("resize", update);
  return () => vv.removeEventListener("resize", update);
}

/**
 * La boîte de la page, posée par le hub (ref de rappel). Hors WebView iOS,
 * rien n'est retenu : le document reste le défileur.
 */
export function registerPageBox(el: HTMLElement | null): void {
  if (!ownsPageScroll()) return;
  if (el) {
    box = el;
    try {
      ensureStyle();
      if (!keyboardWatch) keyboardWatch = watchKeyboard();
    } catch {
      /* jamais bloquant pour le rendu */
    }
  } else if (box) {
    box = null;
  }
}

/** La position verticale de la page. */
export function pageScrollTop(): number {
  return box ? box.scrollTop : window.scrollY;
}

/** La hauteur visible de la page (le clavier retiré, dans la boîte). */
export function pageViewportHeight(): number {
  return box ? box.clientHeight : window.innerHeight;
}

/** Amène la page à `top` — d'un coup, ou en glissant. */
export function scrollPageTo(top: number, smooth = false): void {
  const options: ScrollToOptions = { top, behavior: smooth ? "smooth" : "auto" };
  if (box) box.scrollTo(options);
  else window.scrollTo(options);
}

/* Un objet, pas `true` : l'EventTarget de Node ne retire pas un écouteur
 * capture désigné par le booléen — les navigateurs lisent les deux pareil. */
const CAPTURE = { capture: true, passive: true } as const;

/**
 * Écoute le défilement de la page, quel qu'en soit le défileur. En capture
 * sur la fenêtre : le défilement d'un élément ne remonte pas, mais se capture
 * — la boîte peut ainsi se poser après l'écouteur. Les rangées horizontales
 * et les panneaux, qui défilent aussi, sont écartés.
 */
export function onPageScroll(listener: () => void): () => void {
  const handler = (e: Event) => {
    const target = e.target;
    if (target === document || target === document.documentElement || (box !== null && target === box)) listener();
  };
  window.addEventListener("scroll", handler, CAPTURE);
  return () => window.removeEventListener("scroll", handler, CAPTURE);
}

let locks = 0;
let savedBody = "";

/**
 * La page ne défile plus tant qu'un panneau est ouvert par-dessus. Imbriqué
 * (une feuille ouverte depuis la fiche), il ne rend la main qu'au dernier. La
 * boîte aussi se bloque : un doigt posé sur le voile d'une feuille née DANS la
 * page aurait fait défiler la page dessous.
 */
export function lockPageScroll(): () => void {
  if (locks++ === 0) {
    savedBody = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (box) box.style.overflowY = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks > 0) return;
    document.body.style.overflow = savedBody;
    if (box) box.style.overflowY = "";
  };
}
