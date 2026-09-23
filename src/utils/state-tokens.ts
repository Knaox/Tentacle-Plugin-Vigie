/* ------------------------------------------------------------------ */
/*  Vigie — Les couleurs des états d'un titre                          */
/* ------------------------------------------------------------------ */

/*
 * Cinq états, cinq teintes — et c'est tout ce que la couleur dit dans Vigie.
 * Salle, streaming ou Blu-ray se reconnaissent à leur ICÔNE, jamais à une
 * couleur : deux dictionnaires de teintes se seraient contredits sur la même
 * affiche (le vert d'« En streaming » contre celui de « Disponible »).
 *
 *   demandé  violet · en route  bleu ciel · bloqué  ambre
 *   disponible  émeraude · en partie  émeraude clair (et l'icône à moitié pleine)
 *
 * Deux familles de jetons :
 *   - `--vg-<état>-{fg,bg,solid}` : sur les surfaces de la page, PAR SCHÉMA —
 *     la gamme claire (300) sur fond sombre, la gamme foncée (700-800) sur fond
 *     clair, pour tenir 4,5:1 dans les deux ;
 *   - `--vg-media-<état>` et `--vg-plate` : posés SUR une affiche. Constants :
 *     une affiche est la même dans les deux thèmes. Le texte coloré s'y lit sur
 *     une plaque presque opaque — la couleur de l'affiche ne peut plus avaler
 *     celle de l'état (un badge vert sur une affiche verte disparaissait).
 */

import type { HostScheme } from "./host-scheme";

const DARK = `
--vg-requested-fg:#C4B5FD;--vg-requested-bg:rgba(139,92,246,0.18);--vg-requested-solid:#8B5CF6;
--vg-downloading-fg:#7DD3FC;--vg-downloading-bg:rgba(14,165,233,0.18);--vg-downloading-solid:#0EA5E9;
--vg-stalled-fg:#FCD34D;--vg-stalled-bg:rgba(245,158,11,0.18);--vg-stalled-solid:#F59E0B;
--vg-available-fg:#6EE7B7;--vg-available-bg:rgba(16,185,129,0.18);--vg-available-solid:#10B981;
--vg-partial-fg:#A7F3D0;--vg-partial-bg:rgba(52,211,153,0.14);--vg-partial-solid:#34D399;
--vg-raised:rgba(255,255,255,0.13);--vg-raised-ring:rgba(255,255,255,0.14);`;

const LIGHT = `
--vg-requested-fg:#6D28D9;--vg-requested-bg:rgba(124,58,237,0.11);--vg-requested-solid:#7C3AED;
--vg-downloading-fg:#0369A1;--vg-downloading-bg:rgba(2,132,199,0.11);--vg-downloading-solid:#0284C7;
--vg-stalled-fg:#92400E;--vg-stalled-bg:rgba(217,119,6,0.13);--vg-stalled-solid:#D97706;
--vg-available-fg:#047857;--vg-available-bg:rgba(5,150,105,0.11);--vg-available-solid:#059669;
--vg-partial-fg:#065F46;--vg-partial-bg:rgba(16,185,129,0.09);--vg-partial-solid:#10B981;
--vg-raised:#FFFFFF;--vg-raised-ring:rgba(0,0,0,0.10);`;

const ON_MEDIA = `
--vg-plate:rgba(9,9,13,0.84);
--vg-media-requested:#C4B5FD;--vg-media-downloading:#7DD3FC;--vg-media-stalled:#FCD34D;
--vg-media-available:#6EE7B7;--vg-media-partial:#A7F3D0;`;

/** Bloc `:root{…}` des jetons d'état pour un schéma donné. */
export function buildStateCss(scheme: HostScheme): string {
  return `:root{${ON_MEDIA}${scheme === "light" ? LIGHT : DARK}}`;
}
