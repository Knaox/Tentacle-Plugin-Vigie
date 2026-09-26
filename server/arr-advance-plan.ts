/* ------------------------------------------------------------------ */
/*  Vigie — Ce que Sonarr et Radarr font avancer (calcul pur)           */
/* ------------------------------------------------------------------ */

/*
 * Les notifications attendaient Jellyseerr : son relais de la file (une
 * minute), puis son scan de Jellyfin (plusieurs), puis le passage de Vigie
 * (deux). « Est sorti sur Tentacle TV » arrivait souvent un quart d'heure
 * après le film. Sonarr et Radarr savent dès l'instant où le fichier est
 * rangé — c'est eux qu'on écoute désormais.
 *
 * Ce module décide, sans rien écrire : le statut de la demande, et ce qu'on
 * annonce. Jamais deux fois la même chose : les saisons annoncées sont
 * mémorisées, et le film porte son drapeau (cf. seer-availability-notify.ts).
 */

import type { RequestStatus } from "./types";
import type { EpisodeFact } from "./sonarr-episodes";

/** L'avancement d'une demande vers son arrivée. Hors de cette échelle : terminal. */
const PROGRESS_RANK: Partial<Record<RequestStatus, number>> = {
  sent_to_seer: 1,
  approved: 1,
  unavailable: 1,
  downloading: 2,
  partially_available: 3,
  available: 4,
};

/** Recul sur l'échelle (« disponible en partie » → « en téléchargement »…). */
export function isDowngrade(from: RequestStatus, to: RequestStatus): boolean {
  const a = PROGRESS_RANK[from];
  const b = PROGRESS_RANK[to];
  return a !== undefined && b !== undefined && b < a;
}

export interface SeasonFacts {
  /** Saisons prises en compte : les demandées, sinon toutes celles de Sonarr hors spéciaux. */
  considered: number[];
  /** Saisons dont chaque épisode attendu a son fichier. */
  complete: number[];
  /** Saisons dont au moins un épisode est là. */
  started: number[];
}

/**
 * L'état des saisons d'après les fichiers de Sonarr. Un épisode compte s'il
 * est suivi (Sonarr le récupérera, y compris ceux qui ne sont pas encore
 * sortis) ou déjà là ; un épisode que l'administrateur a cessé de suivre, sans
 * fichier, ne bloque pas sa saison pour toujours.
 */
export function seasonFacts(facts: ReadonlyMap<string, EpisodeFact>, requested: readonly number[] | null): SeasonFacts {
  const counts = new Map<number, { expected: number; here: number }>();
  for (const [key, fact] of facts) {
    const season = Number(/^S(\d+)E/.exec(key)?.[1]);
    if (!Number.isInteger(season)) continue;
    const c = counts.get(season) ?? { expected: 0, here: 0 };
    if (fact.monitored || fact.hasFile) c.expected++;
    if (fact.hasFile) c.here++;
    counts.set(season, c);
  }
  const considered = requested?.length
    ? [...requested].sort((a, b) => a - b)
    : [...counts.keys()].filter((s) => s > 0).sort((a, b) => a - b);
  const complete: number[] = [];
  const started: number[] = [];
  for (const s of considered) {
    const c = counts.get(s);
    if (!c || c.here === 0) continue;
    started.push(s);
    if (c.here >= c.expected) complete.push(s);
  }
  return { considered, complete, started };
}

export interface AdvanceInput {
  status: RequestStatus;
  mediaType: "movie" | "tv";
  notifiedSeasons: readonly number[] | null;
  /** Quelque chose qui sert cette demande est dans la file. */
  inQueue: boolean;
  /** Film : le fichier est-il là ? `null` : Radarr n'en sait rien. */
  movieHasFile?: boolean | null;
  /** Série : `null` quand Sonarr ne la suit pas. */
  seasons?: SeasonFacts | null;
}

export interface AdvanceDecision {
  /** Nouveau statut ; `null` : inchangé. */
  status: RequestStatus | null;
  /** La demande vient d'arriver au bout. */
  completed: boolean;
  notifyDownloading: boolean;
  notifyMovie: boolean;
  /** Saisons à annoncer maintenant. */
  notifySeasons: number[];
  /** Saisons annoncées à mémoriser ; `null` : inchangé. */
  notified: number[] | null;
}

const NOTHING: AdvanceDecision = {
  status: null, completed: false, notifyDownloading: false, notifyMovie: false, notifySeasons: [], notified: null,
};

/** Monter sur l'échelle seulement ; « disponible » clôt la demande. */
function climb(input: AdvanceInput, target: RequestStatus, decision: AdvanceDecision): AdvanceDecision {
  if (target === input.status || isDowngrade(input.status, target)) return decision;
  const nothingAnnounced = (input.notifiedSeasons ?? []).length === 0;
  return {
    ...decision,
    status: target,
    completed: target === "available",
    // « En cours de téléchargement » : une fois, au départ — jamais après une annonce.
    notifyDownloading: target === "downloading" && nothingAnnounced,
  };
}

export function decideAdvance(input: AdvanceInput): AdvanceDecision {
  if (input.mediaType === "movie") {
    if (input.movieHasFile === true) {
      const first = (input.notifiedSeasons ?? []).length === 0;
      return climb(input, "available", { ...NOTHING, notifyMovie: first, notified: first ? [0] : null });
    }
    if (input.inQueue) return climb(input, "downloading", NOTHING);
    // Parti de la file sans fichier (téléchargement abandonné) : on attend une autre source.
    if (input.movieHasFile === false && input.status === "downloading") return { ...NOTHING, status: "unavailable" };
    return NOTHING;
  }

  const facts = input.seasons;
  if (!facts || facts.considered.length === 0) {
    return input.inQueue ? climb(input, "downloading", NOTHING) : NOTHING;
  }
  const already = new Set(input.notifiedSeasons ?? []);
  const fresh = facts.complete.filter((s) => !already.has(s));
  const base: AdvanceDecision = {
    ...NOTHING,
    notifySeasons: fresh,
    notified: fresh.length > 0 ? [...new Set([...already, ...facts.complete])].sort((a, b) => a - b) : null,
  };
  if (facts.complete.length === facts.considered.length) return climb(input, "available", base);
  if (facts.started.length > 0) return climb(input, "partially_available", base);
  if (input.inQueue) return climb(input, "downloading", base);
  if (input.status === "downloading") return { ...base, status: "unavailable" };
  return base;
}
