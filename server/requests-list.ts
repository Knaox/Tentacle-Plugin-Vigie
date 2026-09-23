/* ------------------------------------------------------------------ */
/*  Seer Plugin — Fusion Jellyseerr + local, stats, filtres            */
/* ------------------------------------------------------------------ */

/*
 * Ce module ne met en cache que des lignes BRUTES, jamais des `UnifiedRequest`
 * déjà habillées. C'est délibéré :
 *   - le remplissage des fiches TMDB en tâche de fond devient visible à la
 *     requête suivante, sans avoir à invalider quoi que ce soit ;
 *   - la progression des téléchargements se lit dans ces mêmes lignes, donc le
 *     suivi en direct n'oblige jamais à jeter la grosse liste ;
 *   - les statistiques se calculent sur place, ce qui supprime la seconde
 *     pagination complète que faisait `/requests/stats`.
 */

import type { PrismaClient } from "@prisma/client";
import type { RequestStatus, RequestsStats, SeerRequest, UnifiedRequest } from "./types";
import type { TmdbMeta } from "./tmdb-cache";
import { tmdbKey, type TmdbRef } from "./tmdb-cache";
import {
  type JellyfinUser, type SeerrRequestRow, type SeerrTmdbDetail, type WorkerCfg,
  seerrRequestToUnified, localToUnified,
} from "./seerr-unified";
import { fetchAllSeerrRequests } from "./seerr-requests-fetch";
import { resolveJellyseerrUserId } from "./jellyseerr-user";
import { resolveRequestStatus } from "./request-status";
import { partialSeriesSeasons, type SeasonStates } from "./series-gaps";
import { rowToRequest } from "./db-helpers";

/** Statuts locaux considérés comme « pas encore repris par Jellyseerr ». */
const LOCAL_PENDING_STATUSES = [
  "queued", "processing", "retry_pending", "failed", "deleting", "delete_failed",
];

export interface MergedRows {
  seerrRows: SeerrRequestRow[];
  localBySeerrId: Map<number, SeerRequest>;
  localOnly: SeerRequest[];
  deletingIds: Set<number>;
  stats: RequestsStats;
  fetchedAt: string;
  /**
   * L'état des saisons des séries en partie là, par id TMDB : la liste de
   * Jellyseerr ne le donne pas, et c'est lui qui dit si une demande de
   * saison est arrivée, arrivée en partie, ou pas du tout.
   */
  seasonStates?: ReadonlyMap<number, SeasonStates>;
  /**
   * true = Jellyseerr n'a pas répondu et ces lignes sont un REPLI local.
   * Le calendrier s'en sert pour se déclarer incomplet plutôt que de graver
   * une liste amputée comme la vérité du moment.
   */
  seerrUnreachable?: boolean;
}

export async function buildMergedRows(
  prisma: PrismaClient,
  cfg: WorkerCfg,
  user: JellyfinUser,
  log?: (err: unknown, msg: string) => void,
): Promise<MergedRows> {
  const localPendingRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ?
       AND status IN (${LOCAL_PENDING_STATUSES.map(() => "?").join(",")})
     ORDER BY created_at DESC`,
    user.userId,
    ...LOCAL_PENDING_STATUSES,
  );
  const localPending = localPendingRows.map(rowToRequest);

  const localBySeerrId = new Map<number, SeerRequest>();
  const allLocalRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_requests WHERE jellyfin_user_id = ? AND seerr_request_id IS NOT NULL`,
    user.userId,
  );
  for (const row of allLocalRows) {
    const r = rowToRequest(row);
    if (r.seerrRequestId) localBySeerrId.set(r.seerrRequestId, r);
  }

  let seerrRows: SeerrRequestRow[] = [];
  let seerrUnreachable = false;
  // En parallèle : une liste partagée par tout le serveur, en cache une minute.
  const seasonStatesP = partialSeriesSeasons(cfg);
  try {
    const seerUserId = await resolveJellyseerrUserId(cfg, prisma, user.userId, user.username);
    const all = await fetchAllSeerrRequests(cfg, seerUserId);
    seerrRows = all.rows;
  } catch (err) {
    seerrUnreachable = true;
    log?.(err, "Seerr fetch failed, falling back to local only");
  }

  const seerrSeenIds = new Set(seerrRows.map((r) => r.id));
  const localOnly = localPending.filter(
    (l) => !l.seerrRequestId || !seerrSeenIds.has(l.seerrRequestId),
  );

  /* Suppressions en file : affichées « deleting » immédiatement, sans quoi un
   * rafraîchissement juste après l'action réaffiche l'ancien état. */
  const deletingIds = new Set<number>();
  try {
    const pending = await prisma.$queryRawUnsafe<Array<{ seerr_request_id: number }>>(
      `SELECT seerr_request_id FROM seer_cleanup_queue
       WHERE status = 'pending' AND action = 'delete' AND seerr_request_id IS NOT NULL`,
    );
    for (const r of pending) deletingIds.add(Number(r.seerr_request_id));
  } catch { /* best-effort */ }

  const seasonStates = await seasonStatesP;
  return {
    seerrRows,
    localBySeerrId,
    localOnly,
    deletingIds,
    stats: computeStats(seerrRows, localOnly, localBySeerrId, deletingIds, seasonStates),
    fetchedAt: new Date().toISOString(),
    seasonStates,
    seerrUnreachable,
  };
}

function computeStats(
  seerrRows: SeerrRequestRow[],
  localOnly: SeerRequest[],
  localBySeerrId: Map<number, SeerRequest>,
  deletingIds: Set<number>,
  seasonStates: ReadonlyMap<number, SeasonStates>,
): RequestsStats {
  const byStatus: Record<string, number> = {};
  const byType = { movie: 0, tv: 0 };
  let total = 0;

  const bump = (status: string, mediaType: string | undefined) => {
    total++;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (mediaType === "movie") byType.movie++;
    else if (mediaType === "tv") byType.tv++;
  };

  for (const sr of seerrRows) {
    bump(effectiveStatus(sr, localBySeerrId, deletingIds, seasonStates), sr.media?.mediaType);
  }
  for (const l of localOnly) bump(l.status, l.mediaType);

  return { total, byStatus, byType };
}

/** Le statut affiché, épingle « Disponible » et suppressions en file comprises. */
function effectiveStatus(
  sr: SeerrRequestRow,
  localBySeerrId: Map<number, SeerRequest>,
  deletingIds: Set<number>,
  seasonStates: ReadonlyMap<number, SeasonStates>,
): RequestStatus {
  if (deletingIds.has(sr.id)) return "deleting";
  /* Le MÊME verdict que la liste, sans quoi les compteurs du bandeau et les
   * badges des cartes raconteraient deux histoires différentes. */
  return resolveRequestStatus(sr, localBySeerrId.get(sr.id), seasonStates.get(sr.media?.tmdbId ?? 0));
}

export function collectTmdbRefs(rows: MergedRows): TmdbRef[] {
  const out: TmdbRef[] = [];
  for (const sr of rows.seerrRows) {
    if (sr.media?.tmdbId) out.push({ mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId });
  }
  for (const l of rows.localOnly) {
    if (l.tmdbId) out.push({ mediaType: l.mediaType, tmdbId: l.tmdbId });
  }
  return out;
}

/** Adapte une fiche mémorisée à la forme attendue par le mapping historique. */
export function metaToDetail(meta: TmdbMeta | undefined): SeerrTmdbDetail | null {
  if (!meta) return null;
  return {
    id: meta.tmdbId,
    title: meta.mediaType === "movie" ? meta.title : undefined,
    name: meta.mediaType === "tv" ? meta.title : undefined,
    posterPath: meta.posterPath ?? undefined,
    backdropPath: meta.backdropPath ?? undefined,
    overview: meta.overview ?? undefined,
    releaseDate: meta.mediaType === "movie" ? meta.releaseDate ?? undefined : undefined,
    firstAirDate: meta.mediaType === "tv" ? meta.releaseDate ?? undefined : undefined,
  };
}

export function hydrateRows(
  rows: MergedRows,
  meta: Map<string, TmdbMeta>,
  user: JellyfinUser,
): UnifiedRequest[] {
  const out: UnifiedRequest[] = rows.localOnly.map(localToUnified);

  for (const sr of rows.seerrRows) {
    if (!sr.media) continue;
    const detail = metaToDetail(meta.get(tmdbKey({ mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId })));
    const unified = seerrRequestToUnified(sr, detail, rows.localBySeerrId, {
      jellyfinUserId: user.userId,
      username: user.username,
    }, rows.seasonStates?.get(sr.media.tmdbId));
    if (rows.deletingIds.has(sr.id)) unified.status = "deleting";
    out.push(unified);
  }

  out.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return out;
}

export interface ListQuery {
  page: number;
  limit: number;
  status?: string;
  type?: string;
  q?: string;
}

export function filterAndPaginate(
  items: UnifiedRequest[],
  query: ListQuery,
): { results: UnifiedRequest[]; total: number; page: number; pages: number } {
  let filtered = items;

  if (query.type) filtered = filtered.filter((r) => r.mediaType === query.type);

  if (query.status) {
    const wanted = new Set(query.status.split(",").map((s) => s.trim() as RequestStatus));
    filtered = filtered.filter((r) => wanted.has(r.status));
  }

  if (query.q) {
    const q = query.q.trim().toLowerCase();
    if (q) filtered = filtered.filter((r) => (r.title ?? "").toLowerCase().includes(q));
  }

  const total = filtered.length;
  const offset = (query.page - 1) * query.limit;

  return {
    results: filtered.slice(offset, offset + query.limit),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}
