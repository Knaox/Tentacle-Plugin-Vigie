/* ------------------------------------------------------------------ */
/*  Le chrome de l'hôte qui FLOTTE au-dessus du cadre du plugin        */
/* ------------------------------------------------------------------ */

/**
 * Sur l'application mobile, la barre d'onglets est une pilule de verre en
 * position absolue : elle ne réserve aucune place, elle se pose PAR-DESSUS le
 * cadre du plugin, qui va jusqu'au bas de l'écran. Tout ce que le plugin ancre
 * en bas — le pied d'un panneau de filtres, une feuille, un toast — se retrouve
 * donc dessous, et le bouton de sortie devient invisible.
 *
 * Le contenu qui défile ne souffrait pas du problème (on continue de faire
 * défiler jusqu'à voir la fin) ; ce qui est FIXÉ en bas, si.
 *
 * Une seule variable répond à la question « combien de pixels du bas ne
 * m'appartiennent pas ? » :
 *
 *   1. si l'hôte la publie lui-même (`--tentacle-chrome-bottom`), c'est elle
 *      qui gagne — lui seul connaît la hauteur exacte de sa barre et les
 *      encoches de l'appareil ;
 *   2. sinon, dans une WebView mobile, on retombe sur une réserve mesurée sur
 *      la barre actuelle (≈ 63 px) majorée d'une marge : un pouce doit pouvoir
 *      viser le bouton sans toucher la barre. `env(safe-area-inset-bottom)`
 *      couvre l'appareil à encoche quand la WebView descend sous la zone sûre,
 *      et vaut 0 quand le viewport y est déjà contenu — les deux cas tombent
 *      juste ;
 *   3. dans le cadre web ÉTROIT (moins de 768 px, le seuil où Tentacle passe
 *      à sa mise en page de téléphone), la barre d'onglets de l'hôte est fixée
 *      au bas de l'écran et le cadre du plugin court dessous : même réserve
 *      que la WebView. Le cadre fait la largeur de la fenêtre, sa requête
 *      média tombe donc au même seuil que celle de l'hôte ;
 *   4. ailleurs (cadre web large, bureau), le chrome de l'hôte ne recouvre rien : 0.
 *
 * Volontairement généreux : trop de marge se voit à peine (le fond du panneau
 * continue derrière le verre), trop peu rend un bouton inatteignable.
 */

import { isMobileWebView } from "./tentacle-fetch";

/** À utiliser en CSS : `calc(0.75rem + var(--seer-chrome-bottom, 0px))`. */
export const CHROME_BOTTOM = "var(--seer-chrome-bottom, 0px)";

/** Réserve de repli quand l'hôte ne publie pas la hauteur de sa barre. */
const MOBILE_FALLBACK = "calc(88px + env(safe-area-inset-bottom, 0px))";

/** Sous cette largeur, Tentacle web affiche sa barre d'onglets en bas (`useIsMobile`, 768). */
const WEB_PHONE_MAX = 767;

const STYLE_ID = "seer-host-chrome";

/**
 * La déclaration à injecter. Pure et exportée pour être testable : c'est la
 * seule chose qui décide, le reste n'est que du DOM.
 */
export function chromeCss(mobileWebView: boolean): string {
  if (mobileWebView) return `:root{--seer-chrome-bottom:var(--tentacle-chrome-bottom,${MOBILE_FALLBACK});}`;
  return `:root{--seer-chrome-bottom:var(--tentacle-chrome-bottom,0px);}`
    + `@media (max-width:${WEB_PHONE_MAX}px){:root{--seer-chrome-bottom:var(--tentacle-chrome-bottom,${MOBILE_FALLBACK});}}`;
}

/** Idempotent, jamais bloquant — appelé une fois à l'initialisation. */
export function ensureHostChrome(): void {
  try {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = chromeCss(isMobileWebView());
    document.head.appendChild(style);
  } catch {
    /* jamais bloquant pour le render */
  }
}
