/* ------------------------------------------------------------------ */
/*  Vigie — Ce que l'on sait, en ce moment, de chaque titre             */
/* ------------------------------------------------------------------ */

/*
 * Trois sources, tenues à jour par la boucle en direct (live-sync.ts) :
 *
 *   - la liste des items de Jellyfin que tient le serveur Tentacle — ce qui
 *     est là, ce qui est parti et quand (library-keys.ts) ;
 *   - ce que Jellyfin répond, titre par titre, pour un départ tout récent :
 *     un fichier remplacé (mise à niveau) part avant que son remplaçant ne
 *     soit inscrit, et ne doit pas passer pour supprimé ;
 *   - toutes les demandes de Jellyseerr (request-index.ts).
 *
 * `factsFor` les assemble pour la règle (title-truth.ts) : c'est la seule
 * porte par laquelle la recherche, les cartes de Tentacle, le hub et la liste
 * des demandes corrigent ce que Jellyseerr dit d'un titre.
 */

import {
  buildSnapshot, departuresOf, emptySnapshot, libraryStateOf, snapshotDigest,
  type Departure, type KeyRow, type LibrarySnapshot,
} from "./library-keys";
import { requestIndex } from "./request-index";
import { locallyQueued } from "../search/pending";
import {
  NO_SEASONS, UNKNOWN_LIBRARY, correctMediaStatus, correctSeasonStatus,
  type LibraryFact, type RequestFact, type TitleFacts,
} from "./title-truth";

/**
 * Au-delà, un départ sans remplaçant est acquis sans demander à Jellyfin : le
 * serveur inscrit un remplaçant au plus dix minutes après son arrivée.
 */
export const SETTLE_MS = 20 * 60_000;

export interface JellyfinCheck {
  /** Quand Jellyfin a répondu (ms). */
  at: number;
  present: boolean;
  presentSeasons?: ReadonlySet<number>;
}

class LiveState {
  snapshot: LibrarySnapshot = emptySnapshot();
  /** La liste du serveur a pu être lue : les départs sont connus. */
  libraryReadable = false;
  private digest = "";
  readonly checks = new Map<string, JellyfinCheck>();
  private gen = 0;

  /** Change dès que l'état d'un titre a pu changer (bibliothèque, Jellyfin, demandes). */
  get generation(): number {
    return this.gen + requestIndex.generation;
  }

  bump(): void {
    this.gen++;
  }

  /** Pour les tests : rien de connu. */
  reset(): void {
    this.snapshot = emptySnapshot();
    this.libraryReadable = false;
    this.digest = "";
    this.checks.clear();
    this.gen++;
  }

  /** Nouvelles lignes de la liste du serveur. Vrai si ce qu'elles disent a changé. */
  setLibrary(rows: readonly KeyRow[] | null): boolean {
    if (rows === null) {
      const changed = this.libraryReadable;
      this.libraryReadable = false;
      this.snapshot = emptySnapshot();
      this.digest = "";
      if (changed) this.gen++;
      return changed;
    }
    const snap = buildSnapshot(rows);
    const digest = snapshotDigest(snap);
    this.libraryReadable = true;
    this.snapshot = snap;
    if (digest === this.digest) return false;
    this.digest = digest;
    // Les réponses de Jellyfin sur des titres qui ne sont plus partis ne servent plus.
    const departed = new Set(departuresOf(snap).map((d) => `${d.mediaType}:${d.tmdbId}`));
    for (const key of this.checks.keys()) if (!departed.has(key)) this.checks.delete(key);
    this.gen++;
    return true;
  }

  /** Une réponse de Jellyfin. Vrai si elle change ce qu'on dit du titre. */
  setCheck(key: string, check: JellyfinCheck): boolean {
    const before = this.checks.get(key);
    this.checks.set(key, check);
    const same = before && before.present === check.present
      && sameSet(before.presentSeasons, check.presentSeasons);
    if (!same) this.gen++;
    return !same;
  }

  departures(): Departure[] {
    return departuresOf(this.snapshot);
  }

  /**
   * Un départ est acquis quand Jellyfin, interrogé APRÈS lui, n'a plus le
   * titre — ou, sans réponse de Jellyfin, quand il est assez ancien.
   */
  private settled(key: string, departedAt: number, now: number, absent: (c: JellyfinCheck) => boolean): boolean {
    const check = this.checks.get(key);
    if (check && check.at >= departedAt) return absent(check);
    return now - departedAt >= SETTLE_MS;
  }

  /** Ce que Jellyfin est pour ce titre, départs confirmés seulement. */
  libraryFact(mediaType: "movie" | "tv", tmdbId: number, now = Date.now()): LibraryFact {
    if (!this.libraryReadable) return UNKNOWN_LIBRARY;
    const base = libraryStateOf(this.snapshot, mediaType, tmdbId);
    if (base.state === "unknown") return UNKNOWN_LIBRARY;
    const key = `${mediaType}:${tmdbId}`;
    const facts = mediaType === "tv" ? this.snapshot.series.get(tmdbId) : undefined;

    if (base.state === "present") {
      if (base.goneSeasons.size === 0 || !facts) {
        return { state: "present", goneSeasons: NO_SEASONS, presentSeasons: base.presentSeasons };
      }
      const gone = new Set<number>();
      for (const season of base.goneSeasons) {
        const at = facts.departed.get(season) ?? 0;
        if (this.settled(key, at, now, (c) => !c.presentSeasons?.has(season))) gone.add(season);
      }
      return { state: "present", goneSeasons: gone, presentSeasons: base.presentSeasons, seasonDepartedAt: departuresOfSeasons(facts.departed, gone) };
    }

    if (this.settled(key, base.since, now, (c) => !c.present)) {
      return {
        state: "gone", goneSeasons: base.goneSeasons, presentSeasons: NO_SEASONS,
        departedAt: base.since, seasonDepartedAt: facts?.departed,
      };
    }
    const check = this.checks.get(key);
    if (check && check.at >= base.since && check.present) {
      // Jellyfin l'a encore (fichier remplacé) : il est là, ses saisons sont celles que Jellyfin a.
      const present = check.presentSeasons ?? NO_SEASONS;
      const gone = new Set([...base.goneSeasons].filter((s) => check.presentSeasons && !present.has(s)));
      return { state: "present", goneSeasons: gone, presentSeasons: present, seasonDepartedAt: departuresOfSeasons(facts?.departed, gone) };
    }
    // Départ tout récent, pas encore confirmé : Jellyseerr garde la parole.
    return UNKNOWN_LIBRARY;
  }
}

/**
 * Quand chaque saison CONFIRMÉE partie a quitté Jellyfin : une demande faite
 * avant ne la retient plus (title-truth.ts). Un départ pas encore confirmé
 * n'y figure pas.
 */
function departuresOfSeasons(departed: ReadonlyMap<number, number> | undefined, gone: ReadonlySet<number>): ReadonlyMap<number, number> | undefined {
  if (!departed || gone.size === 0) return undefined;
  const out = new Map<number, number>();
  for (const season of gone) {
    const at = departed.get(season);
    if (at !== undefined) out.set(season, at);
  }
  return out;
}

function sameSet(a?: ReadonlySet<number>, b?: ReadonlySet<number>): boolean {
  if (!a || !b) return !a && !b;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export const liveState = new LiveState();
export type { LiveState };

export interface FactsOptions {
  /** Les demandes du titre telles qu'une réponse de Jellyseerr les porte (fiche) — sinon, l'index. */
  requests?: readonly RequestFact[] | null;
  downloading?: boolean;
  now?: number;
}

/** Tout ce que l'on sait d'un titre, prêt pour la règle. */
export function factsFor(mediaType: "movie" | "tv", tmdbId: number, opts: FactsOptions = {}): TitleFacts {
  const queuedSeasons = locallyQueued(`${mediaType}:${tmdbId}`);
  return {
    library: liveState.libraryFact(mediaType, tmdbId, opts.now),
    requests: opts.requests !== undefined ? opts.requests : requestIndex.requestsFor(mediaType, tmdbId),
    queued: queuedSeasons !== null,
    queuedSeasons: queuedSeasons && queuedSeasons.size > 0 ? queuedSeasons : undefined,
    downloading: opts.downloading,
  };
}

/** Le statut d'un titre, corrigé — ce que tout Vigie affiche. */
export function correctedStatus(
  mediaType: "movie" | "tv",
  tmdbId: number,
  seerr: number | undefined,
  opts?: FactsOptions,
): number | undefined {
  return correctMediaStatus(mediaType, seerr, factsFor(mediaType, tmdbId, opts));
}

/** Le statut d'une saison, corrigé. */
export function correctedSeasonStatus(
  tmdbId: number,
  season: number,
  seerr: number | undefined,
  opts?: FactsOptions,
): number | undefined {
  return correctSeasonStatus(season, seerr, factsFor("tv", tmdbId, opts));
}

/**
 * Pour UNE demande qu'on sait exister (le worker la relit chez Jellyseerr) :
 * les faits du titre, cette demande comprise — même si l'index ne l'a pas
 * encore vue.
 */
export function factsWithRequest(
  mediaType: "movie" | "tv",
  tmdbId: number,
  own: RequestFact,
  downloading = false,
): TitleFacts {
  const base = factsFor(mediaType, tmdbId, { downloading });
  return { ...base, requests: [...(base.requests ?? []), own] };
}

/** Le titre est-il parti de Jellyfin (confirmé) ? */
export function goneFromJellyfin(mediaType: "movie" | "tv", tmdbId: number): boolean {
  return liveState.libraryFact(mediaType, tmdbId).state === "gone";
}

/** Les saisons parties de Jellyfin (confirmées) d'une série — vide si rien n'est parti. */
export function goneSeasonsOf(tmdbId: number): ReadonlySet<number> {
  const fact = liveState.libraryFact("tv", tmdbId);
  return fact.state === "unknown" ? NO_SEASONS : fact.goneSeasons;
}
