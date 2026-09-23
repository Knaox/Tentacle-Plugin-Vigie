import type { ReactNode } from "react";
import type { CalendarKind } from "../api/types-releases";
import { DiscIcon, PlayCircleIcon, SparkIcon, TicketIcon, TvIcon } from "../components/ui/icons";

/**
 * Chaque type de sortie se reconnaît à son ICÔNE, sur une puce neutre : la
 * couleur, dans Vigie, ne dit que l'état (demandé, en route, bloqué,
 * disponible). Les types empruntaient les teintes des statuts — un épisode
 * s'affichait dans l'orange d'un blocage, une sortie en ligne dans le vert de
 * « Disponible » : deux sens pour une même couleur, sur la même ligne.
 */
const NEUTRAL = { chip: "bg-tentacle-fill-soft text-tentacle-text-secondary", dot: "bg-tentacle-fill-strong" };

export const KIND_STYLE: Record<CalendarKind, { chip: string; dot: string }> = {
  digital: NEUTRAL,
  theatrical: NEUTRAL,
  physical: NEUTRAL,
  episode: NEUTRAL,
  premiere: NEUTRAL,
};

export const KIND_ICON: Record<CalendarKind, (p: { className?: string }) => ReactNode> = {
  digital: PlayCircleIcon,
  theatrical: TicketIcon,
  physical: DiscIcon,
  episode: TvIcon,
  premiere: SparkIcon,
};

export const KIND_I18N: Record<CalendarKind, string> = {
  digital: "seer:releasesKindDigital",
  theatrical: "seer:releasesKindTheatrical",
  physical: "seer:releasesKindPhysical",
  episode: "seer:releasesKindEpisode",
  premiere: "seer:releasesKindPremiere",
};

/** « S2E5 » — vide pour un film. */
export function episodeLabel(season: number | null, episode: number | null): string {
  if (season == null && episode == null) return "";
  if (season != null && episode != null) return `S${season}E${episode}`;
  if (season != null) return `S${season}`;
  return `E${episode}`;
}
