/* ------------------------------------------------------------------ */
/*  Vigie — Ce que Jellyfin a, et ce qu'il a perdu (modèle pur)         */
/* ------------------------------------------------------------------ */

/*
 * Le serveur Tentacle tient, pour ses annonces d'arrivée, la liste des items
 * de Jellyfin (`library_known_id`) : une ligne par film et par épisode, avec
 * la clé de son CONTENU et, quand il part, l'instant où il est parti
 * (`removedAt`). Il la tient seul — un diff toutes les minutes, quelques
 * secondes après un évènement de Jellyfin —, Vigie n'a qu'à la lire : aucune
 * requête de plus vers Jellyfin pour savoir qu'un titre a été supprimé.
 *
 * Les clés (apps/backend/src/services/libraryPresence.ts du serveur) :
 *   - `m:t:<tmdb>`                 un film identifié par TMDB ;
 *   - `e:t:<tmdb>:<saison>:<ép.>`  un épisode, par le TMDB de sa série.
 * La lecture les regroupe par film et par SAISON (`e:t:<tmdb>:<saison>`) :
 * une saison est là tant qu'un de ses épisodes l'est. Les autres formes (nom
 * normalisé, identifiant Jellyfin) ne disent rien de l'identité TMDB que
 * Jellyseerr connaît : elles sont ignorées.
 *
 * Un contenu est PRÉSENT tant qu'une de ses lignes n'a pas de départ — un
 * fichier remplacé (mise à niveau) a deux lignes, l'ancienne partie et la
 * nouvelle présente. Il est PARTI quand toutes ses lignes le sont.
 */

export type ParsedKey =
  | { kind: "movie"; tmdbId: number }
  | { kind: "season"; tmdbId: number; season: number };

const MOVIE = /^m:t:([1-9]\d{0,9})$/;
/* Épisode (`e:t:T:S:E`) ou saison déjà regroupée (`e:t:T:S`, `e:t:T:S:`). */
const SEASON = /^e:t:([1-9]\d{0,9}):(\d{1,4})(?::(\d{1,5})?)?$/;

export function parseContentKey(key: unknown): ParsedKey | null {
  if (typeof key !== "string") return null;
  const m = MOVIE.exec(key);
  if (m) return { kind: "movie", tmdbId: Number(m[1]) };
  const s = SEASON.exec(key);
  if (s) return { kind: "season", tmdbId: Number(s[1]), season: Number(s[2]) };
  return null;
}

/**
 * Une clé lue en base, regroupée ou non : au moins une de ses lignes est-elle
 * là, et le dernier départ parmi celles qui sont parties (ms, `null` : aucun).
 */
export interface KeyRow {
  key: string;
  present: boolean;
  departedAt: number | null;
}

/** Ce que la bibliothèque dit d'UNE série, saison par saison. */
export interface SeriesFacts {
  /** Saisons dont au moins un épisode est là. */
  present: Set<number>;
  /** Saisons dont TOUS les épisodes sont partis → dernier départ (ms). */
  departed: Map<number, number>;
}

export interface LibrarySnapshot {
  moviesPresent: Set<number>;
  /** Films partis (plus aucune ligne présente) → dernier départ (ms). */
  moviesDeparted: Map<number, number>;
  /** Séries connues de la bibliothèque, présentes ou parties. */
  series: Map<number, SeriesFacts>;
}

export function emptySnapshot(): LibrarySnapshot {
  return { moviesPresent: new Set(), moviesDeparted: new Map(), series: new Map() };
}

interface Tally { present: boolean; at: number | null }

function tally(into: Map<string, Tally>, id: string, row: KeyRow): void {
  const t = into.get(id) ?? { present: false, at: null };
  t.present ||= row.present;
  if (row.departedAt !== null) t.at = Math.max(t.at ?? 0, row.departedAt);
  into.set(id, t);
}

/**
 * Range les clés lues en base. Une ligne présente l'emporte sur les lignes
 * parties du même contenu (un remplacement, une seconde version) ; une
 * saison ne part que lorsque plus aucun de ses épisodes n'est là.
 */
export function buildSnapshot(rows: Iterable<KeyRow>): LibrarySnapshot {
  const movies = new Map<string, Tally>();
  const seasons = new Map<string, Tally>();
  for (const row of rows) {
    const parsed = parseContentKey(row.key);
    if (!parsed) continue;
    if (parsed.kind === "movie") tally(movies, String(parsed.tmdbId), row);
    else tally(seasons, `${parsed.tmdbId}:${parsed.season}`, row);
  }

  const snap = emptySnapshot();
  for (const [id, t] of movies) {
    if (t.present) snap.moviesPresent.add(Number(id));
    else if (t.at !== null) snap.moviesDeparted.set(Number(id), t.at);
  }
  for (const [id, t] of seasons) {
    const [tmdbId, season] = id.split(":").map(Number);
    let facts = snap.series.get(tmdbId);
    if (!facts) {
      facts = { present: new Set(), departed: new Map() };
      snap.series.set(tmdbId, facts);
    }
    if (t.present) facts.present.add(season);
    else if (t.at !== null) facts.departed.set(season, t.at);
  }
  return snap;
}

/** Ce qu'un titre est devenu dans Jellyfin, selon la liste du serveur. */
export type LibraryState =
  /** La bibliothèque l'a (en entier, ou au moins une saison pour une série). */
  | { state: "present"; goneSeasons: ReadonlySet<number>; presentSeasons: ReadonlySet<number> }
  /** Il y était, plus rien n'en reste. `since` : le dernier départ (ms). */
  | { state: "gone"; since: number; goneSeasons: ReadonlySet<number> }
  /** La liste n'en dit rien : jamais vu par son identité TMDB. */
  | { state: "unknown" };

const NONE: ReadonlySet<number> = new Set();

/**
 * L'état d'un titre. Une série est partie quand aucun de ses épisodes n'est
 * plus là ; présente sinon — ses saisons parties dans `goneSeasons`.
 */
export function libraryStateOf(snap: LibrarySnapshot, mediaType: "movie" | "tv", tmdbId: number): LibraryState {
  if (mediaType === "movie") {
    if (snap.moviesPresent.has(tmdbId)) return { state: "present", goneSeasons: NONE, presentSeasons: NONE };
    const since = snap.moviesDeparted.get(tmdbId);
    return since === undefined ? { state: "unknown" } : { state: "gone", since, goneSeasons: NONE };
  }
  const facts = snap.series.get(tmdbId);
  if (!facts) return { state: "unknown" };
  const gone = new Set(facts.departed.keys());
  if (facts.present.size > 0) return { state: "present", goneSeasons: gone, presentSeasons: facts.present };
  if (facts.departed.size === 0) return { state: "unknown" };
  return { state: "gone", since: Math.max(...facts.departed.values()), goneSeasons: gone };
}

/** Le départ le plus récent d'un titre, saisons comprises — `null` s'il n'a rien perdu. */
export function lastDepartureOf(snap: LibrarySnapshot, mediaType: "movie" | "tv", tmdbId: number): number | null {
  if (mediaType === "movie") return snap.moviesDeparted.get(tmdbId) ?? null;
  const facts = snap.series.get(tmdbId);
  if (!facts || facts.departed.size === 0) return null;
  return Math.max(...facts.departed.values());
}

export interface Departure {
  mediaType: "movie" | "tv";
  tmdbId: number;
  /** Dernier départ (ms). */
  at: number;
  /** Série : les saisons parties ; film : vide. */
  seasons: number[];
  /** Série : plus rien d'elle n'est là. Film : toujours vrai. */
  whole: boolean;
}

/** Les titres qui ont perdu quelque chose — film parti, saison partie —, avec leur dernier départ. */
export function departuresOf(snap: LibrarySnapshot): Departure[] {
  const out: Departure[] = [];
  for (const [tmdbId, at] of snap.moviesDeparted) out.push({ mediaType: "movie", tmdbId, at, seasons: [], whole: true });
  for (const [tmdbId, facts] of snap.series) {
    if (facts.departed.size === 0) continue;
    out.push({
      mediaType: "tv",
      tmdbId,
      at: Math.max(...facts.departed.values()),
      seasons: [...facts.departed.keys()].sort((a, b) => a - b),
      whole: facts.present.size === 0,
    });
  }
  return out;
}

/** Empreinte de ce que les titres peuvent en dire : deux instantanés d'empreinte égale ne changent rien. */
export function snapshotDigest(snap: LibrarySnapshot): string {
  const parts: string[] = [[...snap.moviesPresent].sort((a, b) => a - b).join(",")];
  for (const [id, at] of [...snap.moviesDeparted].sort((a, b) => a[0] - b[0])) parts.push(`d${id}@${at}`);
  for (const [id, facts] of [...snap.series].sort((a, b) => a[0] - b[0])) {
    const present = [...facts.present].sort((a, b) => a - b).join(".");
    const departed = [...facts.departed].sort((a, b) => a[0] - b[0]).map(([s, at]) => `${s}@${at}`).join(".");
    parts.push(`s${id}:${present}/${departed}`);
  }
  return parts.join("|");
}
