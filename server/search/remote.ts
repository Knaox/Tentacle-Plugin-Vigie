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
  /** Position dans la réponse TMDB — son avis sur la pertinence. */
  rank: number;
}

export interface RemotePerson {
  id: number;
  name: string;
  profilePath: string | null;
  popularity: number;
  department: string | null;
  knownFor: RemoteMedia[];
  rank: number;
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

export function toRemoteMedia(r: Raw, rank = 0): RemoteMedia | null {
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
    rank,
  };
}

function toRemotePerson(r: Raw, rank: number): RemotePerson | null {
  const id = num(r.id);
  const name = str(r.name);
  if (id <= 0 || !name) return null;
  const knownFor = Array.isArray(r.knownFor)
    ? (r.knownFor as Raw[]).map((m) => toRemoteMedia(m)).filter((m): m is RemoteMedia => m !== null)
    : [];
  return {
    id, name,
    profilePath: str(r.profilePath),
    popularity: num(r.popularity),
    department: str(r.knownForDepartment),
    knownFor,
    rank,
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
 *
 * `knownSafe` épargne la vérification des mots-clés aux titres déjà dans
 * l'index — ils y sont entrés filtrés. C'est l'essentiel du coût d'une
 * recherche à froid : une fiche TMDB par résultat inconnu.
 */
export async function remoteSearch(
  cfg: WorkerCfg,
  text: string,
  page: number,
  lang: string,
  showBlocked: boolean,
  knownSafe: (mediaType: "movie" | "tv", id: number) => boolean = () => false,
): Promise<RemotePage> {
  const key = `vigie:remote:${lang}:${showBlocked ? 1 : 0}:${page}:${foldText(text)}`;
  const result = await cached(key, TTL_MS, async (): Promise<RemotePage> => {
    const raw = await fetchSearchPage(cfg, text, page, lang);
    const results = (Array.isArray(raw.results) ? (raw.results as Raw[]) : []).map((r, rank) => ({ r, rank }));
    const tags = await getBlocklistedTags(cfg.seerrUrl, cfg.seerrApiKey);
    const blocked = parseTagSet(tags);
    let kept = results;
    let blockedCount = 0;
    if (blocked.size > 0 && !showBlocked) {
      const isSafe = ({ r }: { r: Raw }) =>
        (r.mediaType === "movie" || r.mediaType === "tv") && typeof r.id === "number"
        && knownSafe(r.mediaType, r.id) && (r.mediaInfo as { status?: number } | undefined)?.status !== 6;
      const unknown = results.filter((x) => !isSafe(x));
      const filtered = await filterResultsByTags(cfg.seerrUrl, cfg.seerrApiKey, unknown.map((x) => x.r) as ResultItem[], blocked);
      const survivors = new Set(filtered.kept as Raw[]);
      kept = results.filter((x) => isSafe(x) || survivors.has(x.r));
      blockedCount = filtered.blockedCount;
    }
    const media: RemoteMedia[] = [];
    const people: RemotePerson[] = [];
    for (const { r, rank } of kept) {
      if (r.mediaType === "person") {
        const person = toRemotePerson(r, rank);
        if (person) people.push(person);
      } else {
        const m = toRemoteMedia(r, rank);
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
