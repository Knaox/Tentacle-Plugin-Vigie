/* ------------------------------------------------------------------ */
/*  Vigie — Les voisines d'une rangée s'écartent                       */
/* ------------------------------------------------------------------ */

/*
 * Dans une RANGÉE (Rail : `[data-vg-rail]`, ses cases `[data-vg-rail-item]`),
 * les cartes de part et d'autre glissent pour laisser la place à la
 * mini-carte — celles de gauche vers la gauche, celles de droite vers la
 * droite, du débord de la mini-carte de chaque côté —, puis reviennent à son
 * départ. `transform` seul : aucune carte re-rendue, rien de mis en page.
 *
 * Seulement dans une rangée : elle défile déjà de côté, une voisine poussée
 * hors de l'écran n'y change rien. Une grille, elle, verrait sa dernière
 * colonne sortir de la page — la mini-carte y passe au-dessus.
 */

import { roomShifts, type Rect } from "./placement";
import { PREVIEW_MOTION } from "./timing";

const SHIFT = "data-vgp-shift";

/** Ouvre la place ; rend son retour (les voisines reviennent au tempo de la sortie). */
export function openRailRoom(anchor: HTMLElement, preview: Rect): () => void {
  const cell = anchor.closest<HTMLElement>("[data-vg-rail-item]");
  const rail = cell?.parentElement;
  if (!cell || !rail || !rail.hasAttribute("data-vg-rail")) return () => undefined;
  const rect = cell.getBoundingClientRect();
  const shifts = roomShifts({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }, preview);
  const moved: HTMLElement[] = [];
  let before = true;
  for (const child of Array.from(rail.children) as HTMLElement[]) {
    if (child === cell) {
      before = false;
      continue;
    }
    const dx = before ? -shifts.left : shifts.right;
    if (dx === 0) continue;
    child.setAttribute(SHIFT, "");
    child.style.transform = `translateX(${dx}px)`;
    moved.push(child);
  }
  return () => {
    for (const child of moved) child.style.transform = "";
    setTimeout(() => {
      // Une nouvelle mini-carte a pu reprendre la case entre-temps : on ne retire que ce qui est revenu.
      for (const child of moved) if (!child.style.transform) child.removeAttribute(SHIFT);
    }, PREVIEW_MOTION.enterMs);
  };
}
