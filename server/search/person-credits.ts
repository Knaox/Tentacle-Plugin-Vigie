/* ------------------------------------------------------------------ */
/*  Vigie — La filmographie d'une personne, hors bibliothèque           */
/* ------------------------------------------------------------------ */

/*
 * La filmographie de Tentacle ne montre que ce que la bibliothèque a. On y
 * cherche un acteur… et ses films qui ne sont PAS sur le serveur, ceux qu'on
 * voudrait justement demander, n'apparaissent nulle part.
 *
 * Même contrat générique que la recherche (`search` du manifeste, champ
 * `person`) : Tentacle donne un nom — et l'identifiant TMDB quand Jellyfin le
 * connaît —, Vigie rend ce que cette personne a fait et que la bibliothèque
 * n'a pas, les œuvres les plus connues d'abord.
 */

import { cached } from "../cache";
import type { WorkerCfg } from "../seerr-unified";
import { foldText } from "./fold";
import { MEDIA_STATUS, noteStatus, statusOf } from "./status-map";
import { inLibraryOrBlocked, type ProviderItem, type ProviderResponse } from "./present";
import { remoteSearch } from "./remote";

const CREDITS_TTL_MS = 30 * 60_000;
const CREDITS_STALE_MS = 6 * 3_600_000;

type Raw = Record<string, unknown>;

interface Credit {
  mediaType: "movie" | "tv";
  id: number;
  title: string;
  releaseDate: string | null;
  posterPath: string | null;
  voteCount: number;
  popularity: number;
  role: string | null;
  status: number | undefined;
}

/* Les apparitions « dans son propre rôle » (talk-shows, cérémonies) noient le reste. */
const SELF = /^(himself|herself|themselves|self|lui-même|elle-même|eux-mêmes)\b/i;
/* Au générique, ce qui fait une œuvre : jouer, réaliser, écrire, créer. */
const CREW_JOBS = new Set(["Director", "Screenplay", "Writer", "Creator", "Novel", "Story"]);
/* Talk-shows et journaux : on y passe, on n'y joue pas. */
const TALK_OR_NEWS = new Set([10767, 10763]);

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function toCredit(r: Raw, crew: boolean): Credit | null {
  const mediaType = r.mediaType === "movie" || r.mediaType === "tv" ? r.mediaType : null;
  const id = num(r.id);
  if (!mediaType || id <= 0) return null;
  const role = crew ? str(r.job) : str(r.character);
  if (!crew && role && SELF.test(role)) return null;
  if (crew && !CREW_JOBS.has(String(r.job ?? ""))) return null;
  const genres = Array.isArray(r.genreIds) ? (r.genreIds as unknown[]) : [];
  if (genres.some((g) => typeof g === "number" && TALK_OR_NEWS.has(g))) return null;
  const info = r.mediaInfo as { status?: number } | undefined;
  return {
    mediaType,
    id,
    title: str(r.title) ?? str(r.name) ?? "",
    releaseDate: str(r.releaseDate) ?? str(r.firstAirDate),
    posterPath: str(r.posterPath),
    voteCount: num(r.voteCount),
    popularity: num(r.popularity),
    role,
    status: typeof info?.status === "number" ? info.status : undefined,
  };
}

async function seerrGet(cfg: WorkerCfg, path: string, lang: string): Promise<Raw> {
  const res = await fetch(`${cfg.seerrUrl}${path}`, {
    headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Jellyseerr ${path.split("?")[0]} ${res.status}`);
  return (await res.json()) as Raw;
}

/** Tout ce que la personne a fait, une ligne par œuvre, mis en commun une demi-heure. */
async function personCredits(cfg: WorkerCfg, personId: number, lang: string): Promise<Credit[]> {
  return cached(`vigie:person:${personId}:${lang}`, CREDITS_TTL_MS, async () => {
    const raw = await seerrGet(cfg, `/api/v1/person/${personId}/combined_credits?language=${lang}`, lang);
    const all = [
      ...(Array.isArray(raw.cast) ? (raw.cast as Raw[]).map((r) => toCredit(r, false)) : []),
      ...(Array.isArray(raw.crew) ? (raw.crew as Raw[]).map((r) => toCredit(r, true)) : []),
    ];
    const byKey = new Map<string, Credit>();
    for (const credit of all) {
      if (!credit || !credit.title) continue;
      const key = `${credit.mediaType}:${credit.id}`;
      // Jouer ET réaliser le même film : une seule ligne, le premier rôle gagne.
      if (!byKey.has(key)) byKey.set(key, credit);
    }
    const credits = [...byKey.values()];
    for (const c of credits) noteStatus(c.mediaType, c.id, c.status);
    return credits;
  }, { staleMs: CREDITS_STALE_MS });
}

/**
 * La personne TMDB derrière un nom. L'identifiant, quand Jellyfin le connaît,
 * vaut mieux que tout ; sinon, parmi les personnes au nom EXACT, la plus connue.
 */
async function resolvePerson(cfg: WorkerCfg, name: string, tmdbId: number | null, lang: string): Promise<number | null> {
  if (tmdbId !== null) return tmdbId;
  const folded = foldText(name);
  if (!folded) return null;
  const page = await remoteSearch(cfg, name, 1, lang, true);
  const exact = page.people.filter((p) => foldText(p.name) === folded);
  const best = (exact.length > 0 ? exact : page.people.slice(0, 1))
    .sort((a, b) => b.popularity - a.popularity)[0];
  return best?.id ?? null;
}

const LABELS = {
  fr: { movie: "Film", series: "Série", requested: "Demandé", processing: "En cours" },
  en: { movie: "Movie", series: "Series", requested: "Requested", processing: "In progress" },
};

function toItem(c: Credit, status: number | undefined, lang: string): ProviderItem {
  const l = lang === "fr" ? LABELS.fr : LABELS.en;
  const kind = c.mediaType === "movie" ? "movie" : "series";
  const year = c.releaseDate ? Number(c.releaseDate.slice(0, 4)) || null : null;
  const subtitle = [kind === "movie" ? l.movie : l.series, year, c.role].filter(Boolean).join(" · ");
  return {
    id: `${c.mediaType}:${c.id}`,
    kind,
    title: c.title,
    year,
    subtitle: subtitle.slice(0, 120),
    imageUrl: c.posterPath ? `https://image.tmdb.org/t/p/w185${c.posterPath}` : null,
    href: `/discover?media=${c.mediaType}:${c.id}`,
    badge: status === MEDIA_STATUS.PENDING
      ? { label: l.requested, tone: "info" }
      : status === MEDIA_STATUS.PROCESSING
        ? { label: l.processing, tone: "warning" }
        : null,
  };
}

export interface PersonQuery {
  name: string;
  tmdbId: number | null;
  lang: string;
  limit: number;
  type: "movie" | "series" | null;
}

/** Le contrat générique : ce que la personne a fait et que la bibliothèque n'a PAS. */
export async function personProvider(cfg: WorkerCfg, q: PersonQuery): Promise<ProviderResponse> {
  const empty: ProviderResponse = { query: q.name, correction: null, complete: true, items: [], moreHref: null };
  const personId = await resolvePerson(cfg, q.name, q.tmdbId, q.lang);
  if (personId === null) return empty;
  const credits = await personCredits(cfg, personId, q.lang);
  const items = credits
    .filter((c) => q.type === null || (q.type === "movie") === (c.mediaType === "movie"))
    .map((c) => ({ c, status: statusOf(c.mediaType, c.id) ?? c.status }))
    .filter(({ status }) => !inLibraryOrBlocked(status))
    // Les œuvres qu'on connaît d'abord : c'est d'elles qu'on se souvient.
    .sort((a, b) => b.c.voteCount - a.c.voteCount || b.c.popularity - a.c.popularity)
    .slice(0, q.limit)
    .map(({ c, status }) => toItem(c, status, q.lang));
  return { ...empty, items, moreHref: `/discover?person=${personId}` };
}
