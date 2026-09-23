/* ------------------------------------------------------------------ */
/*  Vigie — Une page d'un parcours du catalogue                        */
/* ------------------------------------------------------------------ */

import { discoverMedia, discoverTrending } from "./client-catalog";
import type { DiscoverFilters, DiscoverMediaType, SeerrPagedResponse } from "./types";
import type { BrowsePreset } from "../hub/HubContext";

/** TMDB ne sert pas au-delà de la page 500, quoi qu'il annonce. */
export const MAX_BROWSE_PAGES = 500;
export const BROWSE_PAGE_SIZE = 20;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Une page d'UNE source : « Tous » en assemble deux (cf. mixCatalogs). */
export function fetchBrowsePage(
  preset: Pick<BrowsePreset, "source" | "upcoming"> & { mediaType: DiscoverMediaType },
  filters: DiscoverFilters,
  page: number,
  showBlocked: boolean,
): Promise<SeerrPagedResponse> {
  if (preset.source === "trending") return discoverTrending(page, showBlocked);
  return discoverMedia(preset.mediaType, page, filters, showBlocked, preset.upcoming ? todayIso() : undefined);
}
