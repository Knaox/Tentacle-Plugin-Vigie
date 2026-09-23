/* ------------------------------------------------------------------ */
/*  Seer Plugin — Le statut AFFICHÉ d'une demande Jellyseerr           */
/* ------------------------------------------------------------------ */

/*
 * Une demande porte sur ce QU'ON A DEMANDÉ, pas sur la série entière.
 *
 * Jellyseerr, lui, ne connaît qu'un statut par MÉDIA : une série dont il manque
 * la saison 4 reste « partiellement disponible » pour toujours. Quiconque avait
 * demandé les saisons 1 et 2, toutes deux arrivées, lisait donc « Partiellement
 * disponible » sur une demande entièrement satisfaite — sans jamais savoir ce
 * qui manquait, puisque rien de ce qu'il avait demandé ne manquait.
 *
 * La granularité existe pourtant : `media.seasons[].status` donne la
 * disponibilité SAISON PAR SAISON. Il suffit de la croiser avec le périmètre de
 * la demande (`request.seasons`). C'est exactement ce que fait déjà le worker
 * pour les demandes suivies localement (`season-availability.ts`) ; ce module
 * étend le même raisonnement aux lignes lues chez Jellyseerr, qui sont la
 * source de vérité de « Mes demandes ».
 *
 * Deux tableaux de saisons coexistent, et ils ne disent PAS la même chose :
 *   - `media.seasons[].status`   → la DISPONIBILITÉ de la saison (5 = AVAILABLE)
 *   - `request.seasons[].status` → l'état de la DEMANDE de saison (5 = COMPLETED)
 *
 * Le premier est le plus direct, mais `GET /request` ne le renvoie pas : il ne
 * vient qu'avec la fiche du média (`/tv/:id`), que la liste n'a aucune raison
 * d'aller chercher pour chaque série. Le second, lui, est TOUJOURS là, et il
 * répond à la même question : Jellyseerr passe une demande de saison à
 * « terminée » quand la saison est arrivée. On accepte donc les deux signaux —
 * une saison compte pour arrivée dès que l'un des deux l'affirme.
 */

import type { RequestStatus } from "./types";
import type { SeasonStates } from "./series-gaps";
import { mapSeerrStatus } from "./worker-sync";

/** `media.seasons[].status` : 5 = AVAILABLE (la saison est en bibliothèque). */
const AVAILABLE = 5;

/** `request.seasons[].status` : 5 = COMPLETED (la saison demandée est arrivée). */
const COMPLETED = 5;

/** `media.seasons[].status` : 4 = PARTIALLY_AVAILABLE (une partie des épisodes est là). */
const PARTIAL = 4;

/**
 * La forme MINIMALE dont ce module a besoin — volontairement structurelle :
 * les appelants passent leurs propres lignes Jellyseerr sans qu'un type ait à
 * traverser la moitié du serveur.
 */
export interface StatusRow {
  status: number;
  /** Saisons couvertes par la demande, avec l'état de CHAQUE demande de saison. */
  seasons?: Array<{ seasonNumber: number; status?: number }>;
  media?: {
    status?: number;
    /** Disponibilité par saison de la série entière. */
    seasons?: Array<{ seasonNumber: number; status?: number }>;
    downloadStatus?: Array<{ status?: string }>;
  };
}

/** Ce qui, des saisons DEMANDÉES, est déjà là. */
export type RequestedSeasonsHere = "all" | "some" | "none" | "unknown";

/**
 * Les saisons demandées sont-elles là — toutes, une partie, aucune ?
 *
 * Une saison compte pour arrivée si `media.seasons` la dit disponible OU si sa
 * demande est « terminée » ; pour « en partie » si seuls certains de ses
 * épisodes sont là. `seasonStates` complète `media.seasons`, que la liste des
 * demandes ne renvoie pas (cf. series-gaps.ts).
 *
 * « unknown » dès qu'on ne peut pas conclure — demande sans saison (film,
 * série demandée en bloc), saison dont on ignore l'état : mieux vaut garder le
 * statut global que promettre ce qu'on n'a pas vu.
 */
export function requestedSeasonsHere(row: StatusRow, seasonStates?: SeasonStates): RequestedSeasonsHere {
  const requested = (row.seasons ?? []).filter((s) => typeof s.seasonNumber === "number");
  if (requested.length === 0) return "unknown";

  const states = new Map<number, number>(seasonStates ?? []);
  for (const s of row.media?.seasons ?? []) {
    if (typeof s.status === "number") states.set(s.seasonNumber, s.status);
  }

  let here = 0;
  let some = 0;
  let known = 0;
  for (const s of requested) {
    const state = states.get(s.seasonNumber);
    if (state === AVAILABLE || s.status === COMPLETED) here++;
    else if (state === PARTIAL) some++;
    if (state !== undefined || s.status === COMPLETED) known++;
  }
  if (here === requested.length) return "all";
  if (here + some > 0) return "some";
  return known === requested.length ? "none" : "unknown";
}

/** Toutes les saisons demandées sont-elles disponibles ? */
export function allRequestedSeasonsAvailable(row: StatusRow, seasonStates?: SeasonStates): boolean {
  return requestedSeasonsHere(row, seasonStates) === "all";
}

/**
 * Le statut d'une ligne Jellyseerr, tel qu'il doit s'afficher.
 *
 * Deux corrections se superposent au mapping brut :
 *   1. la disponibilité par-saison — voir l'en-tête du module ;
 *   2. l'épingle « Disponible » — une ligne locale posée à la main via
 *      « Marquer comme » l'emporte quand Jellyseerr a PERDU le média
 *      (availability-sync → UNKNOWN/DELETED, approbation fantôme) ; un état
 *      réel plus actif reprend toujours la main.
 */
export function resolveRequestStatus(
  row: StatusRow,
  local?: { status: RequestStatus } | null,
  seasonStates?: SeasonStates,
): RequestStatus {
  let status = mapSeerrStatus(row.status, row.media?.status, row.media?.downloadStatus);

  /* Uniquement depuis « partiellement disponible » : c'est le seul état où le
   * périmètre de la demande et celui du média divergent. La série est en
   * partie là ; la DEMANDE, elle, l'est entièrement (ses saisons sont toutes
   * arrivées), en partie, ou pas du tout — la saison 5 demandée d'une série
   * dont les quatre premières sont là attend toujours : elle reprend alors le
   * statut d'une demande en cours (en route si quelque chose descend). */
  if (status === "partially_available") {
    const here = requestedSeasonsHere(row, seasonStates);
    if (here === "all") status = "available";
    else if (here === "none") {
      const downloads = row.media?.downloadStatus;
      status = mapSeerrStatus(row.status, downloads && downloads.length > 0 ? 3 : 2, downloads);
    }
  }

  if (
    local?.status === "available" &&
    (status === "approved" || status === "unavailable" || status === "deleted")
  ) {
    status = "available";
  }

  return status;
}
