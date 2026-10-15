/* ------------------------------------------------------------------ */
/*  Vigie — Où en est un titre : l'état le plus avancé gagne           */
/* ------------------------------------------------------------------ */

/*
 * Un titre peut avoir plusieurs entrées dans la file de Sonarr ou de Radarr :
 * deux copies du MÊME épisode (une refusée à l'import, une autre qui
 * descend), ou des épisodes différents d'une même demande. La file ne dit
 * rien de leur hiérarchie ; c'est ce module, pur, qui la tranche.
 *
 * Deux ordres, explicites, et jamais l'un pour l'autre :
 *
 *   1. Pour UN élément (le film, ou un épisode) — des copies concurrentes de
 *      la même chose : la plus avancée l'emporte.
 *        importé > en cours d'importation > en route > en attente > bloqué
 *      Un épisode refusé à l'import pendant qu'une autre copie descend n'est
 *      pas bloqué : il arrive.
 *
 *   2. Pour le TITRE — des éléments différents : ce qui descend encore dit
 *      « en route » (le reste attend la fin du trajet), puis l'importation,
 *      puis l'attente. « Bloqué » seulement quand TOUT est bloqué : tant
 *      qu'un élément avance, le titre avance — les bloqués sont une nuance
 *      (« 2 éléments bloqués »), jamais l'état.
 */

/** Ce qu'une entrée de la file dit de son élément. */
export type ArrivalState = "blocked" | "pending" | "downloading" | "importing" | "imported";

/** Ordre 1 — copies d'un même élément, du moins au plus avancé. */
export const ITEM_ORDER: readonly ArrivalState[] = ["blocked", "pending", "downloading", "importing", "imported"];

/** Ce qu'un titre montre : un élément importé n'attend plus rien (cf. `titleArrival`). */
export type TitleArrivalState = "blocked" | "pending" | "importing" | "downloading";

/** Ordre 2 — éléments différents d'un même titre, du moins au plus parlant. */
export const TITLE_ORDER: readonly TitleArrivalState[] = ["blocked", "pending", "importing", "downloading"];

/** Ce que la règle lit d'une entrée : la file *arr comme le relais de Jellyseerr. */
export interface ArrivalEntry {
  /** L'élément servi : « movie », « S2E5 », ou l'empreinte d'un pack sans épisode. */
  item: string;
  state: ArrivalState;
}

/**
 * La clé d'un élément : l'épisode quand on le connaît, sinon sa saison,
 * sinon le titre entier (un film, ou un pack sans détail).
 */
export function arrivalItemKey(seasonNumber: number | null | undefined, episodeNumber: number | null | undefined): string {
  if (seasonNumber != null && episodeNumber != null) return `S${seasonNumber}E${episodeNumber}`;
  if (seasonNumber != null) return `S${seasonNumber}`;
  return "whole";
}

function rank<T extends string>(order: readonly T[], state: T): number {
  return order.indexOf(state);
}

/** `a` est-elle une copie plus avancée que `b` (ordre 1) ? */
export function moreAdvanced(a: ArrivalState, b: ArrivalState): boolean {
  return rank(ITEM_ORDER, a) > rank(ITEM_ORDER, b);
}

/** La plus avancée de plusieurs copies d'un même élément ; `null` sans copie. */
export function bestCopy<E extends ArrivalEntry>(copies: readonly E[]): E | null {
  let best: E | null = null;
  for (const copy of copies) {
    if (!best || moreAdvanced(copy.state, best.state)) best = copy;
  }
  return best;
}

/** Les copies regroupées par élément, chaque élément réduit à sa meilleure copie (ordre 1). */
export function bestCopies<E extends ArrivalEntry>(entries: readonly E[]): E[] {
  const byItem = new Map<string, E[]>();
  for (const entry of entries) {
    const list = byItem.get(entry.item) ?? [];
    list.push(entry);
    byItem.set(entry.item, list);
  }
  return [...byItem.values()].map((copies) => bestCopy(copies) as E);
}

export interface TitleArrival {
  state: TitleArrivalState;
  /** Éléments dont MÊME la meilleure copie est bloquée. */
  blockedItems: number;
}

/**
 * L'état d'un titre (ordre 2), sur les meilleures copies de chaque élément
 * (ordre 1) ; `null` quand rien de ce titre n'est dans la file. Un élément
 * déjà importé est au bout du trajet : il ne dit rien de ce qui reste — sauf
 * quand tout l'est, et le titre finit alors de se ranger.
 */
export function titleArrival(entries: readonly ArrivalEntry[]): TitleArrival | null {
  const items = bestCopies(entries);
  if (items.length === 0) return null;
  const remaining = items.filter((i) => i.state !== "imported");
  if (remaining.length === 0) return { state: "importing", blockedItems: 0 };
  let state: TitleArrivalState = "blocked";
  let blockedItems = 0;
  for (const item of remaining) {
    const s = item.state as TitleArrivalState;
    if (s === "blocked") blockedItems++;
    if (rank(TITLE_ORDER, s) > rank(TITLE_ORDER, state)) state = s;
  }
  return { state, blockedItems };
}

/**
 * L'état d'une entrée d'après ses signaux bruts. L'ordre des tests compte :
 * un import refusé est « complet » pour le client, mais bloqué pour nous.
 */
export function entryState(signals: {
  stalled: boolean;
  validating: boolean;
  imported?: boolean;
  /** En file chez le client, ou retardé par un profil de délai : partira de lui-même. */
  waiting?: boolean;
}): ArrivalState {
  if (signals.stalled) return "blocked";
  if (signals.imported) return "imported";
  if (signals.validating) return "importing";
  if (signals.waiting) return "pending";
  return "downloading";
}
