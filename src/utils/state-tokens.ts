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
 *   disponible  émeraude · en partie  citron vert (et l'icône à moitié pleine)
 *
 * « En partie » a longtemps été un émeraude plus clair : à l'œil, sur une liste,
 * il se confondait avec « Disponible » — exactement la distinction que l'on
 * cherche à faire (il manque une saison, des épisodes). Le citron vert reste de
 * la famille du « là », mais se sépare au premier coup d'œil.
 *
 * `--vg-color-scheme` dit au navigateur de dessiner ses propres contrôles
 * (liste d'un <select>, curseur) dans le schéma de l'hôte : sans lui, la liste
 * du tri s'ouvrait en blanc, avec le texte blanc du thème sombre.
 *
 * Deux familles de jetons :
 *   - `--vg-<état>-{fg,bg,solid}` : sur les surfaces de la page, PAR SCHÉMA —
 *     la gamme claire (300) sur fond sombre, la gamme foncée (700-800) sur fond
 *     clair, pour tenir 4,5:1 dans les deux ;
 *   - `--vg-media-<état>`, `--vg-plate`, `--vg-hero-*`, `--vg-glass*` : posés SUR
 *     une image (affiche, en-tête de fiche, toujours sombre). Constants :
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
--vg-partial-fg:#BEF264;--vg-partial-bg:rgba(163,230,53,0.15);--vg-partial-solid:#A3E635;
--vg-raised:rgba(255,255,255,0.13);--vg-raised-ring:rgba(255,255,255,0.14);
--vg-color-scheme:dark;`;

const LIGHT = `
--vg-requested-fg:#6D28D9;--vg-requested-bg:rgba(124,58,237,0.11);--vg-requested-solid:#7C3AED;
--vg-downloading-fg:#0369A1;--vg-downloading-bg:rgba(2,132,199,0.11);--vg-downloading-solid:#0284C7;
--vg-stalled-fg:#92400E;--vg-stalled-bg:rgba(217,119,6,0.13);--vg-stalled-solid:#D97706;
--vg-available-fg:#047857;--vg-available-bg:rgba(5,150,105,0.11);--vg-available-solid:#059669;
--vg-partial-fg:#3F6212;--vg-partial-bg:rgba(101,163,13,0.13);--vg-partial-solid:#65A30D;
--vg-raised:#FFFFFF;--vg-raised-ring:rgba(0,0,0,0.10);
--vg-color-scheme:light;`;

const ON_MEDIA = `
--vg-plate:rgba(9,9,13,0.84);
--vg-hero-bg:#0c0c12;--vg-hero-rgb:12,12,18;
--vg-glass:rgba(255,255,255,0.13);--vg-glass-hover:rgba(255,255,255,0.2);--vg-glass-ring:rgba(255,255,255,0.16);
--vg-media-requested:#C4B5FD;--vg-media-downloading:#7DD3FC;--vg-media-stalled:#FCD34D;
--vg-media-available:#6EE7B7;--vg-media-partial:#BEF264;`;

/** Bloc `:root{…}` des jetons d'état pour un schéma donné. */
export function buildStateCss(scheme: HostScheme): string {
  return `:root{${ON_MEDIA}${scheme === "light" ? LIGHT : DARK}}`;
}
