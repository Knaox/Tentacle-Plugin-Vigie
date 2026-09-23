/* ------------------------------------------------------------------ */
/*  Vigie — Où en est un titre, en un mot                              */
/* ------------------------------------------------------------------ */

/*
 * Treize statuts techniques côté serveur, quatre statuts Jellyseerr — et, pour
 * qui regarde une affiche, six réponses seulement :
 *
 *   demandé · en route · en cours d'importation · bloqué · disponible · en partie
 *
 * L'importation est la fin du trajet : le fichier est complet, Sonarr ou
 * Radarr le range. Elle garde la teinte d'« en route » — elle n'est pas
 * encore « là » — avec son icône et son mot.
 *
 * « Bloqué » n'est JAMAIS un échec : un téléchargement qui coince (source
 * morte, import refusé, pause) reste un téléchargement qui attend. Les
 * nuances (« en attente de validation », « 45 % ») vivent dans la ligne de
 * détail, jamais dans le mot d'état.
 */

import type { LocalRequest, RequestStatus } from "../api/types";
import type { CalendarItem, DownloadProgress, ItemState, ProgressItem } from "../api/types-releases";

export type TitleState = ItemState | "partial";

export interface TitleStatus {
  state: TitleState;
  /** Avancement quand le titre est en route, sinon `null`. */
  percent: number | null;
}

/** Ce que Jellyseerr joint à une fiche : son statut, et ce qui descend. */
export interface MediaInfoLike {
  status?: number;
  downloadStatus?: Array<{ status?: string; size?: number; sizeLeft?: number }>;
}

/* Ce qui, dans la file *arr, n'avancera plus tout seul — même règle que le serveur. */
const STALLED = new Set(["warning", "failed", "paused", "downloadClientUnavailable"]);

function percentOf(downloads: NonNullable<MediaInfoLike["downloadStatus"]>): number | null {
  let size = 0;
  let left = 0;
  for (const d of downloads) {
    if (typeof d.size !== "number" || d.size <= 0 || typeof d.sizeLeft !== "number") continue;
    size += d.size;
    left += Math.max(0, d.sizeLeft);
  }
  return size > 0 ? Math.min(100, Math.max(0, ((size - left) / size) * 100)) : null;
}

/** L'état d'une fiche Jellyseerr — celui que tout le monde voit. */
export function stateFromMedia(info: MediaInfoLike | undefined): TitleStatus | null {
  const status = info?.status;
  if (status === 5) return { state: "available", percent: null };
  const downloads = info?.downloadStatus ?? [];
  if (downloads.length > 0 && (status === 2 || status === 3 || status === 4)) {
    const stalled = downloads.every((d) => STALLED.has(d.status ?? ""));
    return { state: stalled ? "stalled" : "downloading", percent: percentOf(downloads) };
  }
  if (status === 4) return { state: "partial", percent: null };
  if (status === 2 || status === 3) return { state: "requested", percent: null };
  return null;
}

function arriving(download: DownloadProgress): TitleStatus {
  if (download.stalled) return { state: "stalled", percent: download.percent };
  // Complet : Sonarr ou Radarr le range dans la bibliothèque.
  if (download.validating) return { state: "importing", percent: null };
  return { state: "downloading", percent: download.percent };
}

/** Ce qui arrive encore : en route, en cours d'importation, ou bloqué en chemin. */
const moving = (s: TitleStatus) => s.state === "downloading" || s.state === "importing" || s.state === "stalled";

const WAITING: ReadonlySet<RequestStatus> = new Set([
  "queued", "processing", "sent_to_seer", "approved", "unavailable", "retry_pending",
]);

/**
 * L'état d'UNE demande, avancement réel compris. `null` pour ce qui n'est
 * plus une attente : refusée, supprimée, en cours de suppression.
 *
 * Une demande parle de SES saisons : le serveur la dit disponible quand elles
 * sont toutes là, en partie quand certaines le sont (ou certains de leurs
 * épisodes), en attente sinon — même si la série, elle, est en partie là.
 * C'est l'affiche du TITRE qui dit « en partie » pour la série entière.
 */
export function stateFromRequest(
  request: Pick<LocalRequest, "status">,
  progress?: ProgressItem,
): TitleStatus | null {
  const download = progress?.download;
  switch (request.status) {
    case "available":
      return { state: "available", percent: null };
    case "partially_available":
      return download ? arriving(download) : { state: "partial", percent: null };
    case "downloading":
      return download ? arriving(download) : { state: "downloading", percent: null };
    default:
      return WAITING.has(request.status) ? { state: "requested", percent: null } : null;
  }
}

const RANK: Record<TitleState, number> = { requested: 1, partial: 2, downloading: 3, importing: 3, stalled: 3, available: 4 };

/**
 * L'état d'un titre sur une affiche : celui de Jellyseerr, précisé par ce
 * que l'on sait de SA demande (l'avancement réel, « bloqué »). L'affiche parle
 * du TITRE : disponible pour Jellyseerr l'emporte toujours, et une série en
 * partie là le reste — même si la saison qu'on a demandée est arrivée, ou
 * seulement demandée.
 */
export function mergeStatus(media: TitleStatus | null, mine: TitleStatus | null | undefined): TitleStatus | null {
  if (!mine) return media;
  if (!media) return mine;
  if (media.state === "available") return media;
  if (moving(mine)) return mine;
  if (media.state === "partial" || moving(media)) return media;
  return RANK[mine.state] >= RANK[media.state] ? mine : media;
}

/**
 * Deux demandes pour un même titre (deux saisons) : ce qui bouge d'abord —
 * une saison qui arrive dit plus que celle qui est déjà là. Une saison là et
 * une autre seulement demandée : la série est EN PARTIE là, pas « demandée ».
 */
export function strongest(a: TitleStatus | null, b: TitleStatus | null): TitleStatus | null {
  if (!a) return b;
  if (!b) return a;
  if (moving(a) !== moving(b)) return moving(a) ? a : b;
  if (moving(a)) return a;
  const here = (s: TitleStatus) => s.state === "available" || s.state === "partial";
  if (here(a) !== here(b) || a.state === "partial" || b.state === "partial") return { state: "partial", percent: null };
  return RANK[b.state] > RANK[a.state] ? b : a;
}

/** L'état d'une sortie du calendrier (épisode, film), rendu par le serveur. */
export function stateFromItem(state: ItemState | null | undefined, percent?: number | null): TitleStatus | null {
  return state ? { state, percent: state === "downloading" ? percent ?? null : null } : null;
}

/** L'état d'une sortie ; chez un serveur plus ancien (sans `state`), celui de la demande. */
export function calendarStatus(item: Pick<CalendarItem, "state" | "percent" | "requestStatus">): TitleStatus | null {
  if (item.state !== undefined) return stateFromItem(item.state, item.percent);
  return item.requestStatus ? stateFromRequest({ status: item.requestStatus }) : null;
}

/**
 * Plusieurs épisodes le même jour (une saison publiée d'un coup, repliée en
 * une ligne) : ce qui coince d'abord, puis ce qui arrive ; tous là,
 * disponible ; une partie seulement, « en partie ».
 */
export function groupStatus(items: ReadonlyArray<Pick<CalendarItem, "state" | "percent" | "requestStatus">>): TitleStatus | null {
  const all = items.map(calendarStatus);
  const known = all.filter((s): s is TitleStatus => s !== null);
  if (known.length === 0) return null;
  const stalled = known.find((s) => s.state === "stalled");
  if (stalled) return stalled;
  const down = known.filter((s) => s.state === "downloading");
  if (down.length > 0) {
    const measured = down.filter((s) => s.percent !== null);
    const percent = measured.length > 0 ? measured.reduce((n, s) => n + (s.percent as number), 0) / measured.length : null;
    return { state: "downloading", percent };
  }
  const importing = known.find((s) => s.state === "importing");
  if (importing) return importing;
  const here = known.filter((s) => s.state === "available").length;
  if (here === all.length) return { state: "available", percent: null };
  if (here > 0) return { state: "partial", percent: null };
  return known.find((s) => s.state === "requested") ?? known[0];
}
