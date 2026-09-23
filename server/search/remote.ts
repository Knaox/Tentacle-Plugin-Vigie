/* ------------------------------------------------------------------ */
/*  Vigie — La recherche complète, chez Jellyseerr (TMDB)              */
/* ------------------------------------------------------------------ */

/*
 * La seconde moitié de la recherche : tout TMDB, pas seulement les titres
 * connus de l'index. Plus lente (TMDB + le blocage par tags), elle n'est
 * jamais attendue pour afficher quelque chose — l'index a déjà répondu.
 *
 * Les réponses sont MUTUALISÉES : la même requête, dans la même langue, sert
 * tout le monde pendant dix minutes. Les statuts qu'elles portent sont
 * recopiés dans la carte des statuts, plus fraîche d'autant.
 */

import { cached } from "../cache";
import { filterResultsByTags, getBlocklistedTags, parseTagSet, type ResultItem } from "../blocklist";
import type { WorkerCfg } from "../seerr-unified";
import { foldText } from "./fold";
import { noteStatus } from "./status-map";

export interface RemoteMedia {
  mediaType: "movie" | "tv";
  id: number;
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genreIds: number[];
  originalLanguage: string | null;
  status: number | undefined;
}

export interface RemotePerson {
  id: number;
  name: string;
  profilePath: string | null;
  popularity: number;
  department: string | null;
  knownFor: RemoteMedia[];
}

export interface RemotePage {
  media: RemoteMedia[];
  people: RemotePerson[];
  totalPages: number;
  blockedCount: number;
  blockedActive: boolean;
}

const TTL_MS = 10 * 60_000;
const STALE_MS = 60 * 60_000;

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function toRemoteMedia(r: Raw): RemoteMedia | null {
  const mediaType = r.mediaType === "movie" || r.mediaType === "tv" ? r.mediaType : null;
  const id = num(r.id);
  if (!mediaType || id <= 0) return null;
  const info = r.mediaInfo as { status?: number } | undefined;
  return {
    mediaType,
    id,
    title: str(r.title) ?? str(r.name) ?? "",
    originalTitle: str(r.originalTitle) ?? str(r.originalName),
    releaseDate: str(r.releaseDate) ?? str(r.firstAirDate),
    posterPath: str(r.posterPath),
    backdropPath: str(r.backdropPath),
    overview: str(r.overview),
    voteAverage: num(r.voteAverage),
    voteCount: num(r.voteCount),
    popularity: num(r.popularity),
    genreIds: Array.isArray(r.genreIds) ? (r.genreIds as unknown[]).filter((g): g is number => typeof g === "number") : [],
    originalLanguage: str(r.originalLanguage),
    status: typeof info?.status === "number" ? info.status : undefined,
  };
}

function toRemotePerson(r: Raw): RemotePerson | null {
  const id = num(r.id);
  const name = str(r.name);
  if (id <= 0 || !name) return null;
  const knownFor = Array.isArray(r.knownFor)
    ? (r.knownFor as Raw[]).map(toRemoteMedia).filter((m): m is RemoteMedia => m !== null)
    : [];
  return {
    id, name,
    profilePath: str(r.profilePath),
    popularity: num(r.popularity),
    department: str(r.knownForDepartment),
    knownFor,
  };
}

async function fetchSearchPage(cfg: WorkerCfg, text: string, page: number, lang: string): Promise<Raw> {
  const url = `${cfg.seerrUrl}/api/v1/search?query=${encodeURIComponent(text)}&page=${page}&language=${encodeURIComponent(lang)}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Jellyseerr /search ${res.status}`);
  return (await res.json()) as Raw;
}

/**
 * Une page de résultats TMDB, filtrée par le blocage par tags sauf si l'on a
 * demandé à tout voir. Ne rejette que si Jellyseerr est injoignable.
 */
export async function remoteSearch(
  cfg: WorkerCfg,
  text: string,
  page: number,
  lang: string,
  showBlocked: boolean,
): Promise<RemotePage> {
  const key = `vigie:remote:${lang}:${showBlocked ? 1 : 0}:${page}:${foldText(text)}`;
  const result = await cached(key, TTL_MS, async (): Promise<RemotePage> => {
    const raw = await fetchSearchPage(cfg, text, page, lang);
    const results = Array.isArray(raw.results) ? (raw.results as Raw[]) : [];
    const tags = await getBlocklistedTags(cfg.seerrUrl, cfg.seerrApiKey);
    const blocked = parseTagSet(tags);
    let kept: Raw[] = results;
    let blockedCount = 0;
    if (blocked.size > 0 && !showBlocked) {
      const filtered = await filterResultsByTags(cfg.seerrUrl, cfg.seerrApiKey, results as ResultItem[], blocked);
      kept = filtered.kept as Raw[];
      blockedCount = filtered.blockedCount;
    }
    const media: RemoteMedia[] = [];
    const people: RemotePerson[] = [];
    for (const r of kept) {
      if (r.mediaType === "person") {
        const person = toRemotePerson(r);
        if (person) people.push(person);
      } else {
        const m = toRemoteMedia(r);
        if (m) media.push(m);
      }
    }
    // Recopiés à la LECTURE seulement : une réponse resservie du cache ne doit
    // pas ramener un statut d'il y a une heure par-dessus un statut frais.
    for (const m of media) noteStatus(m.mediaType, m.id, m.status);
    return { media, people, totalPages: num(raw.totalPages), blockedCount, blockedActive: blocked.size > 0 };
  }, { staleMs: STALE_MS });
  return result;
}
