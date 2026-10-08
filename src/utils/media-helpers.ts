import type { SeerrSearchResult } from "../api/types";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(path?: string | null, size = "w342"): string {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(path?: string | null, size = "w1280"): string {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function profileUrl(path?: string | null, size = "w185"): string {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function mediaTitle(item: SeerrSearchResult): string {
  return item.title ?? item.name ?? "";
}

export function mediaYear(item: SeerrSearchResult): string {
  const date = item.releaseDate ?? item.firstAirDate;
  return date ? date.slice(0, 4) : "";
}

export function isAnime(item: SeerrSearchResult): boolean {
  return item.genreIds?.includes(16) ?? false;
}

/** Format runtime in hours and minutes: "1h 38min" */
export function formatRuntime(minutes?: number): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/** Get the current i18next language code (2-letter) */
export function getCurrentLanguage(): string {
  try {
    const shared = (window as unknown as Record<string, unknown>).TentacleShared as
      | { i18n?: { language?: string } }
      | undefined;
    const lang = shared?.i18n?.language;
    if (lang) return lang.slice(0, 2);
  } catch {
    // ignore
  }
  return "en";
}

/** Build a language query parameter for Seerr API */
export function langParam(): string {
  return `language=${getCurrentLanguage()}`;
}

/** Le nom d'une saison ; TMDB en nomme certaines « 1 », « 2 » — on dit alors « Saison 1 ». */
export function seasonName(name: string | undefined, seasonNumber: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed && !/^\d+$/.test(trimmed)) return trimmed;
  return seasonNumber === 0 ? t("seer:seasonSpecials") : t("seer:seasonFallback", { number: seasonNumber });
}
