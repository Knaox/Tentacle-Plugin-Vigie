/* ------------------------------------------------------------------ */
/*  Vigie — le catalogue des bandes-annonces du serveur Tentacle        */
/* ------------------------------------------------------------------ */

/*
 * `GET /api/trailers/catalog?tmdbId=…&mediaType=…` (capacité `trailers.catalog`,
 * serveur 1.30.0) : la liste ORDONNÉE de tout ce qui se joue pour un titre —
 * AlloCiné (VF, VOSTFR), TMDB, Jellyfin, Jellyseerr —, la langue du SERVEUR
 * d'abord. C'est la même liste que les fiches de Tentacle : Vigie ne trie
 * plus rien. Lecture DÉFENSIVE (contrat `trailerCatalog.ts` du cœur) : une
 * entrée illisible est écartée, une réponse illisible vaut « rien ».
 *
 * Une bande-annonce LOCALE (Jellyfin) n'y est pas reprise : elle se lit dans
 * le lecteur de Tentacle, depuis sa fiche. Une vidéo Dailymotion ne se lit que
 * dans le lecteur complet de l'hôte (son propre lecteur insère des publicités) :
 * sans lui, elle est écartée.
 */

import type { RichTrailer } from "./trailers";

export type CatalogPlayback = { kind: "youtube"; ytId: string } | { kind: "dailymotion"; videoId: string };
export type CatalogVersion = "localized" | "subtitled" | "original" | "unknown";
export type CatalogScope = { kind: "movie" } | { kind: "series" } | { kind: "season"; season: number };

export interface CatalogTrailers {
  trailers: RichTrailer[];
  /** `false` : une source n'a pas fini — redemander un peu plus tard. */
  complete: boolean;
  /** La langue du serveur, qui décide des versions (VF, VOSTFR, VO). */
  language: string | null;
}

const YT_ID_RE = /^[\w-]{11}$/;
const DM_ID_RE = /^[a-zA-Z0-9]{5,16}$/;
const VERSIONS = ["localized", "subtitled", "original", "unknown"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export function catalogPath(mediaType: "movie" | "tv", tmdbId: number, lang: string): string {
  return `/api/trailers/catalog?tmdbId=${tmdbId}&mediaType=${mediaType}&lang=${encodeURIComponent(lang)}`;
}

/** La clé d'une vidéo (`yt:…`, `dm:…`) : celle que l'hôte reçoit pour partir de la bande-annonce cliquée. */
export function playbackKey(playback: CatalogPlayback): string {
  return playback.kind === "youtube" ? `yt:${playback.ytId}` : `dm:${playback.videoId}`;
}

/** L'adresse publique : « Ouvrir sur YouTube / Dailymotion », la vignette, la modale d'avant. */
export function publicUrl(playback: CatalogPlayback): string {
  return playback.kind === "youtube"
    ? `https://www.youtube.com/watch?v=${playback.ytId}`
    : `https://www.dailymotion.com/video/${playback.videoId}`;
}

function readPlayback(value: unknown): CatalogPlayback | null {
  if (!isRecord(value)) return null;
  if (value.kind === "youtube" && typeof value.ytId === "string" && YT_ID_RE.test(value.ytId)) return { kind: "youtube", ytId: value.ytId };
  if (value.kind === "dailymotion" && typeof value.videoId === "string" && DM_ID_RE.test(value.videoId)) {
    return { kind: "dailymotion", videoId: value.videoId };
  }
  return null;
}

function readScope(value: unknown): CatalogScope | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind === "movie" || value.kind === "series") return { kind: value.kind };
  const season = value.season;
  return value.kind === "season" && typeof season === "number" && Number.isInteger(season) && season > 0 ? { kind: "season", season } : undefined;
}

/** La réponse 200 → les bandes-annonces que Vigie sait montrer ; `withDailymotion` : l'hôte sait les lire. */
export function readCatalog(body: unknown, withDailymotion: boolean): CatalogTrailers | null {
  if (!isRecord(body) || !Array.isArray(body.entries)) return null;
  const language = typeof body.language === "string" ? body.language : null;
  const trailers: RichTrailer[] = [];
  for (const raw of body.entries) {
    if (!isRecord(raw)) continue;
    const playback = readPlayback(raw.playback);
    if (!playback || (playback.kind === "dailymotion" && !withDailymotion)) continue;
    const version = typeof raw.version === "string" && VERSIONS.includes(raw.version) ? (raw.version as CatalogVersion) : "unknown";
    trailers.push({
      Url: publicUrl(playback),
      Name: typeof raw.name === "string" ? raw.name : undefined,
      type: raw.type === "teaser" ? "Teaser" : "Trailer",
      playback,
      version,
      scope: readScope(raw.scope),
      source: typeof raw.source === "string" ? raw.source : undefined,
      versionKey: versionLabelKey(version, language) ?? undefined,
    });
  }
  return { trailers, complete: body.complete !== false, language };
}

/**
 * Le libellé de version, en clé de traduction (`seer:trailerVersion_<clé>`) :
 * VF, VOSTFR, VO pour un serveur français — les mots de l'interface ailleurs ;
 * `null` quand rien de sûr ne se dit (règle `trailerVersionLabelKey` du cœur).
 */
export function versionLabelKey(version: CatalogVersion | undefined, language: string | null): string | null {
  if (!version || version === "unknown") return null;
  const french = !!language && language.toLowerCase().split(/[-_]/)[0] === "fr";
  if (french) return version === "localized" ? "vf" : version === "subtitled" ? "vostfr" : "vo";
  return version;
}
