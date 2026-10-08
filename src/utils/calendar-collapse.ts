import type { CalendarItem } from "../api/types-releases";

/**
 * Une saison entière lâchée d'un coup ne doit pas produire dix lignes
 * identiques.
 *
 * Quand une plateforme publie toute une saison le même jour, l'agenda affichait
 * dix fois le même titre dans la même case — et le « +N » masquait tout le
 * reste de la journée. On replie donc les épisodes d'une même série et d'un même
 * jour en une seule entrée : « Stranger Things · S5E1–E8 ».
 *
 * Le tri du serveur place les épisodes d'une série côte à côte (date puis
 * titre), mais on ne s'y fie pas : le regroupement se fait par clé.
 */

export interface CollapsedItem extends CalendarItem {
  /** Épisodes repliés sous cette entrée, celle-ci comprise. Jamais vide. */
  group: CalendarItem[];
  /** « S5E1–E8 » quand plusieurs épisodes, sinon le libellé simple. */
  rangeLabel: string | null;
}

function episodeRange(items: CalendarItem[]): string | null {
  const eps = items
    .map((i) => i.episodeNumber)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  if (eps.length === 0) return null;

  const season = items[0].seasonNumber;
  const prefix = season != null ? `S${season}` : "";
  if (eps.length === 1) return `${prefix}E${eps[0]}`;
  return `${prefix}E${eps[0]}–E${eps[eps.length - 1]}`;
}

/** Replie les épisodes d'une même série au sein d'UN jour. */
export function collapseSeriesInDay(items: readonly CalendarItem[]): CollapsedItem[] {
  const groups = new Map<string, CalendarItem[]>();

  for (const item of items) {
    // Un film ne se replie jamais : sa clé est unique.
    const key = item.mediaType === "tv" && item.kind === "episode"
      ? `tv:${item.tmdbId}:${item.seasonNumber ?? "?"}`
      : item.id;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group[0],
    group,
    rangeLabel: group.length > 1 ? episodeRange(group) : null,
  }));
}
