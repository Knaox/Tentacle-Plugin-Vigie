/* ------------------------------------------------------------------ */
/*  Vigie — Ce qui manque à une série en partie là, en une phrase       */
/* ------------------------------------------------------------------ */

/*
 * « En partie » dit que la série n'est pas complète ; la phrase dit CE qui
 * manque — une saison entière (qu'on peut demander), ou des épisodes d'une
 * saison (souvent : elle est en cours de diffusion). Deux longueurs :
 *
 *   courte, sous une affiche     « Il manque 1 saison » · « Il manque des épisodes »
 *   longue, fiche et demandes    « Il manque la saison 3, et des épisodes de la saison 4 »
 *
 * La source est l'état des saisons chez Jellyseerr (5 là, 4 en partie, le
 * reste absent) : la fiche le reçoit avec la série, les affiches par la
 * liste du serveur (series-gaps côté serveur).
 */

import type { SeriesGaps } from "../api/types-releases";

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** Au-delà, on compte au lieu d'énumérer : « 11 saisons ». */
const LISTED = 3;

/** Ce qui manque, d'après l'état de chaque saison ; `null` : rien ne manque. */
export function gapsFromSeasons(
  seasons: ReadonlyArray<{ seasonNumber: number; status: number }> | undefined,
): SeriesGaps | null {
  if (!seasons || seasons.length === 0) return null;
  const missing: number[] = [];
  const partial: number[] = [];
  for (const s of seasons) {
    if (s.seasonNumber <= 0) continue;
    if (s.status === 4) partial.push(s.seasonNumber);
    else if (s.status !== 5) missing.push(s.seasonNumber);
  }
  if (missing.length === 0 && partial.length === 0) return null;
  return { missing: missing.sort((a, b) => a - b), partial: partial.sort((a, b) => a - b) };
}

/** Ce qui manque parmi les saisons d'une demande — la série entière si elle l'était. */
export function restrictGaps(
  gaps: SeriesGaps | null | undefined,
  seasons: readonly number[] | null | undefined,
): SeriesGaps | null {
  if (!gaps) return null;
  if (!seasons || seasons.length === 0) return gaps;
  const wanted = new Set(seasons);
  const missing = gaps.missing.filter((n) => wanted.has(n));
  const partial = gaps.partial.filter((n) => wanted.has(n));
  return missing.length > 0 || partial.length > 0 ? { missing, partial } : null;
}

function joined(numbers: readonly number[], t: Translate): string {
  if (numbers.length <= 1) return String(numbers[0] ?? "");
  return `${numbers.slice(0, -1).join(", ")}${t("seer:gapAnd")}${numbers[numbers.length - 1]}`;
}

/** « la saison 3 » · « les saisons 3 et 4 » · « 11 saisons ». */
function seasonsPhrase(numbers: readonly number[], t: Translate): string {
  return numbers.length > LISTED
    ? t("seer:gapSeasonMany", { count: numbers.length })
    : t("seer:gapSeasonList", { count: numbers.length, list: joined(numbers, t) });
}

/** « de la saison 4 » · « des saisons 3 et 4 » · « de 11 saisons ». */
function ofSeasonsPhrase(numbers: readonly number[], t: Translate): string {
  return numbers.length > LISTED
    ? t("seer:gapOfSeasonMany", { count: numbers.length })
    : t("seer:gapOfSeasonList", { count: numbers.length, list: joined(numbers, t) });
}

/** La phrase ; `null` quand rien ne manque (ou qu'on ne le sait pas). */
export function gapText(gaps: SeriesGaps | null | undefined, t: Translate, form: "short" | "long"): string | null {
  if (!gaps) return null;
  const { missing, partial } = gaps;
  if (missing.length === 0 && partial.length === 0) return null;
  if (form === "short") {
    if (partial.length === 0) return t("seer:gapShortSeasons", { count: missing.length });
    if (missing.length === 0) return t("seer:gapShortEpisodes");
    return t("seer:gapShortBoth", { count: missing.length });
  }
  if (partial.length === 0) return t("seer:gapLongSeasons", { what: seasonsPhrase(missing, t) });
  if (missing.length === 0) return t("seer:gapLongEpisodes", { of: ofSeasonsPhrase(partial, t) });
  return t("seer:gapLongBoth", { what: seasonsPhrase(missing, t), of: ofSeasonsPhrase(partial, t) });
}
