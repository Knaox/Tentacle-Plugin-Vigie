/* ------------------------------------------------------------------ */
/*  Seer Plugin — Helpers Jellyseerr partagés (fetch + mapping unifié) */
/* ------------------------------------------------------------------ */

import type { FastifyRequest } from "fastify";
import type { UnifiedRequest, SeerRequest } from "./types";
import { resolveRequestStatus } from "./request-status";
import type { SeasonStates } from "./series-gaps";
import { aggregateDownloads, type SeerrDownloadItem } from "./download-progress";

export interface JellyfinUser { userId: string; username: string; isAdmin: boolean; }

export function getUser(request: FastifyRequest): JellyfinUser {
  return (request as any).user;
}

export type WorkerCfg = { seerrUrl: string; seerrApiKey: string };

export interface SeerrRequestRow {
  id: number;
  status: number;
  is4k?: boolean;
  createdAt?: string;
  updatedAt?: string;
  seasons?: Array<{ seasonNumber: number; status?: number }>;
  media?: {
    id: number;
    tmdbId: number;
    mediaType: "movie" | "tv";
    status?: number;
    /* Disponibilité SAISON PAR SAISON — c'est elle qui dit si une demande de
     * deux saisons est satisfaite, là où `status` ne parle que de la série
     * entière. Voir `request-status.ts`. */
    seasons?: Array<{ seasonNumber: number; status?: number }>;
    /* Le tableau porte déjà taille, restant et temps restant : la progression
     * réelle ne coûte donc aucun appel supplémentaire. */
    downloadStatus?: SeerrDownloadItem[];
  };
  requestedBy?: { id: number; jellyfinUserId?: string; jellyfinUsername?: string };
}

export interface SeerrTmdbDetail {
  id?: number;
  title?: string;
  name?: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  releaseDate?: string;
  firstAirDate?: string;
}

export function seerrRequestToUnified(
  sr: SeerrRequestRow,
  detail: SeerrTmdbDetail | null,
  localById: Map<number, SeerRequest>,
  fallbackUser: { jellyfinUserId: string; username: string },
  /** L'état des saisons de la série, quand elle est en partie là (series-gaps). */
  seasonStates?: SeasonStates,
): UnifiedRequest {
  const local = localById.get(sr.id);
  // Épingle « Disponible » et disponibilité par-saison : voir `request-status`.
  const status = resolveRequestStatus(sr, local, seasonStates);
  const seasons = sr.seasons?.map((s) => s.seasonNumber).filter((n) => typeof n === "number") ?? null;
  const mediaType = (sr.media?.mediaType ?? "movie") as "movie" | "tv";
  const title = detail?.title ?? detail?.name ?? local?.title ?? `#${sr.id}`;
  const year = (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null;
  const { summary, items } = aggregateDownloads(sr.media?.downloadStatus);

  return {
    download: summary,
    downloads: items.length > 1 ? items : undefined,
    id: local?.id ?? `seerr-${sr.id}`,
    source: "seerr",
    jellyfinUserId: sr.requestedBy?.jellyfinUserId ?? fallbackUser.jellyfinUserId,
    username: sr.requestedBy?.jellyfinUsername ?? fallbackUser.username,
    mediaType,
    tmdbId: sr.media?.tmdbId ?? 0,
    title,
    posterPath: detail?.posterPath ?? local?.posterPath ?? null,
    backdropPath: detail?.backdropPath ?? local?.backdropPath ?? null,
    overview: detail?.overview ?? local?.overview ?? null,
    year: year || local?.year || null,
    seasons: seasons && seasons.length > 0 ? seasons : (local?.seasons ?? null),
    status,
    seerrRequestId: sr.id,
    seerrMediaId: sr.media?.id ?? null,
    seerrMediaStatus: sr.media?.status ?? null,
    retryCount: local?.retryCount ?? 0,
    maxRetries: local?.maxRetries ?? 10,
    lastError: local?.lastError ?? null,
    priority: local?.priority ?? 0,
    createdAt: sr.createdAt ?? local?.createdAt ?? new Date().toISOString(),
    updatedAt: sr.updatedAt ?? local?.updatedAt ?? new Date().toISOString(),
    sentAt: local?.sentAt ?? null,
    completedAt: local?.completedAt ?? null,
    profileId: local?.profileId ?? null,
    isAnime: local?.isAnime ?? false,
  };
}

export function localToUnified(r: SeerRequest): UnifiedRequest {
  return {
    id: r.id,
    source: "local",
    jellyfinUserId: r.jellyfinUserId,
    username: r.username,
    mediaType: r.mediaType,
    tmdbId: r.tmdbId,
    title: r.title,
    posterPath: r.posterPath,
    backdropPath: r.backdropPath,
    overview: r.overview,
    year: r.year,
    seasons: r.seasons,
    status: r.status,
    seerrRequestId: r.seerrRequestId,
    seerrMediaId: r.seerrMediaId,
    seerrMediaStatus: r.seerrMediaStatus,
    retryCount: r.retryCount,
    maxRetries: r.maxRetries,
    lastError: r.lastError,
    priority: r.priority,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    sentAt: r.sentAt,
    completedAt: r.completedAt,
    profileId: r.profileId,
    isAnime: r.isAnime,
  };
}

export async function fetchSeerrRequestsForUser(
  config: WorkerCfg,
  seerUserId: number,
  take: number,
  skip: number,
): Promise<{ rows: SeerrRequestRow[]; total: number }> {
  // Endpoint général GET /api/v1/request filtré par requestedBy — plus stable que /user/:id/requests
  const url = `${config.seerrUrl}/api/v1/request?take=${take}&skip=${skip}&filter=all&sort=added&requestedBy=${seerUserId}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jellyseerr GET /request?requestedBy=${seerUserId} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { pageInfo?: { results?: number }; results?: SeerrRequestRow[] };
  return { rows: data.results ?? [], total: data.pageInfo?.results ?? data.results?.length ?? 0 };
}

export async function fetchSeerrTmdbDetail(
  config: WorkerCfg,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<SeerrTmdbDetail | null> {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SeerrTmdbDetail;
  } catch { return null; }
}

export interface SeerrSingleRequest {
  id: number;
  status: number;
  seasons?: Array<{ seasonNumber: number }>;
  media?: {
    id: number;
    tmdbId: number;
    mediaType: "movie" | "tv";
    status?: number;
  };
  requestedBy?: { id: number; jellyfinUserId?: string };
}

export async function fetchSeerrRequestById(
  config: WorkerCfg, seerrId: number,
): Promise<SeerrSingleRequest | null> {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/request/${seerrId}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SeerrSingleRequest;
  } catch { return null; }
}

/** Parse l'ID renvoyé par GET /requests : soit UUID local, soit "seerr-<n>". */
export function parseRequestId(id: string): { kind: "local"; id: string } | { kind: "seerr"; seerrId: number } {
  if (id.startsWith("seerr-")) {
    const n = Number(id.slice(6));
    if (Number.isFinite(n)) return { kind: "seerr", seerrId: n };
  }
  return { kind: "local", id };
}

