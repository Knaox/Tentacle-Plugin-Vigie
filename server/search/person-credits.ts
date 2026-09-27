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
  /** Crédit technique (réaliser, écrire…) plutôt qu'un rôle joué. */
  crew: boolean;
  status: number | undefined;
}

/* Les apparitions « dans son propre rôle » (talk-shows, cérémonies) noient le reste. */
const SELF = /^(himself|herself|themselves|self|lui-même|elle-même|eux-mêmes)\b/i;
/* Au générique, ce qui fait une œuvre : jouer, réaliser, écrire, créer. */
const CREW_JOBS = new Set(["Director", "Screenplay", "Writer", "Creator", "Novel", "Story"]);
/*
 * Le métier par lequel Tentacle arrive (`role` : le type Jellyfin du crédit
 * sur lequel on a cliqué) et ce qui lui répond au générique de TMDB. Produire
 * et composer ne font pas une filmographie par défaut : on ne les montre que
 * si l'on vient d'eux — la page d'un compositeur, ce sont ses musiques.
 */
const ROLE_JOBS: Readonly<Record<string, ReadonlySet<string>>> = {
  Director: new Set(["Director"]),
  Writer: new Set(["Screenplay", "Writer", "Novel", "Story", "Teleplay", "Author"]),
  Creator: new Set(["Creator"]),
  Producer: new Set(["Producer", "Executive Producer"]),
  Composer: new Set(["Original Music Composer", "Music", "Composer"]),
};
const KNOWN_JOBS = new Set([...CREW_JOBS, ...Object.values(ROLE_JOBS).flatMap((jobs) => [...jobs])]);

/** Le rôle d'arrivée, validé : `Actor`, un métier connu, ou rien. */
export function readRole(raw: unknown): string | null {
  if (raw === "Actor" || raw === "GuestStar") return "Actor";
  return typeof raw === "string" && Object.prototype.hasOwnProperty.call(ROLE_JOBS, raw) ? raw : null;
}
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
  if (crew && !KNOWN_JOBS.has(String(r.job ?? ""))) return null;
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
    crew,
    status: typeof info?.status === "number" ? info.status : undefined,
  };
}

/** Ce crédit répond-il au métier d'arrivée ? */
function matchesRole(credit: Credit, role: string | null): boolean {
  if (role === null) return false;
  if (role === "Actor") return !credit.crew;
  return credit.crew && (ROLE_JOBS[role]?.has(credit.role ?? "") ?? false);
}

/**
 * Une ligne par œuvre. Celle du métier d'arrivée gagne (le film qu'un acteur
 * a aussi réalisé, vu depuis la réalisation, se lit « Réalisation ») ; sans
 * rôle d'arrivée, la première — jouer avant réaliser, comme avant. Produire
 * et composer n'entrent que par leur propre porte.
 */
export function pickCredits(credits: readonly Credit[], role: string | null): Array<{ credit: Credit; matches: boolean }> {
  const byKey = new Map<string, { credit: Credit; matches: boolean }>();
  for (const credit of credits) {
    const matches = matchesRole(credit, role);
    if (!matches && credit.crew && !CREW_JOBS.has(credit.role ?? "")) continue;
    const key = `${credit.mediaType}:${credit.id}`;
    const known = byKey.get(key);
    if (!known || (matches && !known.matches)) byKey.set(key, { credit, matches });
  }
  return [...byKey.values()];
}

async function seerrGet(cfg: WorkerCfg, path: string, lang: string): Promise<Raw> {
  const res = await fetch(`${cfg.seerrUrl}${path}`, {
    headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Jellyseerr ${path.split("?")[0]} ${res.status}`);
  return (await res.json()) as Raw;
}

/**
 * Tout ce que la personne a fait, crédit par crédit, mis en commun une
 * demi-heure. Une œuvre peut y figurer deux fois (jouée ET réalisée) : c'est
 * `pickCredits`, selon le rôle d'arrivée, qui n'en garde qu'une.
 */
async function personCredits(cfg: WorkerCfg, personId: number, lang: string): Promise<Credit[]> {
  // `v2` : l'entrée de cache ne dédoublonne plus — l'ancienne forme ne doit pas être relue.
  return cached(`vigie:person:v2:${personId}:${lang}`, CREDITS_TTL_MS, async () => {
    const raw = await seerrGet(cfg, `/api/v1/person/${personId}/combined_credits?language=${lang}`, lang);
    const all = [
      ...(Array.isArray(raw.cast) ? (raw.cast as Raw[]).map((r) => toCredit(r, false)) : []),
      ...(Array.isArray(raw.crew) ? (raw.crew as Raw[]).map((r) => toCredit(r, true)) : []),
    ];
    const credits = all.filter((c): c is Credit => c !== null && c.title !== "");
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

/* Le métier au générique, dit dans la langue de l'interface (TMDB le rend en anglais). */
const JOB_LABELS: Record<"fr" | "en", Record<string, string>> = {
  fr: {
    Director: "Réalisation", Screenplay: "Scénario", Writer: "Scénario", Teleplay: "Scénario", Novel: "Roman",
    Story: "Histoire", Author: "Auteur", Creator: "Création", Producer: "Production",
    "Executive Producer": "Production exécutive", "Original Music Composer": "Musique", Music: "Musique", Composer: "Musique",
  },
  en: {
    Director: "Director", Screenplay: "Screenplay", Writer: "Writer", Teleplay: "Teleplay", Novel: "Novel",
    Story: "Story", Author: "Author", Creator: "Creator", Producer: "Producer",
    "Executive Producer": "Executive Producer", "Original Music Composer": "Music", Music: "Music", Composer: "Music",
  },
};

/** Ce que la personne a fait sur l'œuvre : son personnage, ou son métier traduit. */
export function creditLabel(c: Pick<Credit, "crew" | "role">, lang: string): string | null {
  if (!c.role) return null;
  if (!c.crew) return c.role;
  return JOB_LABELS[lang === "fr" ? "fr" : "en"][c.role] ?? c.role;
}

function toItem(c: Credit, status: number | undefined, lang: string): ProviderItem {
  const l = lang === "fr" ? LABELS.fr : LABELS.en;
  const kind = c.mediaType === "movie" ? "movie" : "series";
  const year = c.releaseDate ? Number(c.releaseDate.slice(0, 4)) || null : null;
  const subtitle = [kind === "movie" ? l.movie : l.series, year, creditLabel(c, lang)].filter(Boolean).join(" · ");
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
  /** Le métier d'arrivée (cf. `readRole`) — ses œuvres passent devant. */
  role: string | null;
}

/** Le contrat générique : ce que la personne a fait et que la bibliothèque n'a PAS. */
export async function personProvider(cfg: WorkerCfg, q: PersonQuery): Promise<ProviderResponse> {
  const empty: ProviderResponse = { query: q.name, correction: null, complete: true, items: [], moreHref: null };
  const personId = await resolvePerson(cfg, q.name, q.tmdbId, q.lang);
  if (personId === null) return empty;
  const credits = await personCredits(cfg, personId, q.lang);
  const items = pickCredits(credits, q.role)
    .filter(({ credit: c }) => q.type === null || (q.type === "movie") === (c.mediaType === "movie"))
    .map(({ credit: c, matches }) => ({ c, matches, status: statusOf(c.mediaType, c.id) ?? c.status }))
    .filter(({ status }) => !inLibraryOrBlocked(status))
    // Le métier d'arrivée d'abord, puis les œuvres qu'on connaît : c'est
    // d'elles qu'on se souvient.
    .sort((a, b) => Number(b.matches) - Number(a.matches) || b.c.voteCount - a.c.voteCount || b.c.popularity - a.c.popularity)
    .slice(0, q.limit)
    .map(({ c, status }) => toItem(c, status, q.lang));
  return { ...empty, items, moreHref: `/discover?person=${personId}` };
}
