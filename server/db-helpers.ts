/* ------------------------------------------------------------------ */
/*  Seer Plugin — Database helpers (shared across db modules)          */
/* ------------------------------------------------------------------ */

import type { SeerRequest, RequestStatus } from "./types";

export function uuid(): string {
  return crypto.randomUUID();
}

export function rowToRequest(r: Record<string, unknown>): SeerRequest {
  return {
    id: r.id as string,
    jellyfinUserId: r.jellyfin_user_id as string,
    username: r.username as string,
    mediaType: r.media_type as "movie" | "tv",
    tmdbId: r.tmdb_id as number,
    title: r.title as string,
    posterPath: (r.poster_path as string) || null,
    backdropPath: (r.backdrop_path as string) || null,
    overview: (r.overview as string) || null,
    year: (r.year as string) || null,
    seasons: r.seasons ? (typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons) as number[] : null,
    notifiedSeasons: r.notified_seasons ? (typeof r.notified_seasons === "string" ? JSON.parse(r.notified_seasons) : r.notified_seasons) as number[] : null,
    status: r.status as RequestStatus,
    seerrRequestId: (r.seerr_request_id as number) || null,
    seerrMediaId: (r.seerr_media_id as number) || null,
    seerrMediaStatus: (r.seerr_media_status as number) || null,
    retryCount: (r.retry_count as number) || 0,
    maxRetries: (r.max_retries as number) || 10,
    lastError: (r.last_error as string) || null,
    priority: (r.priority as number) || 0,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    sentAt: r.sent_at ? toIso(r.sent_at) : null,
    completedAt: r.completed_at ? toIso(r.completed_at) : null,
    pendingCleanupId: (r.pending_cleanup_id as string) || null,
    profileId: (r.profile_id as string) || null,
    isAnime: Boolean(r.is_anime),
    origin: (r.origin as string) || null,
    platform: (r.platform as string) || null,
  };
}

export function rowToUserSettings(r: Record<string, unknown>): import("./types").SeerUserSettings {
  return {
    jellyfinUserId: r.jellyfin_user_id as string,
    username: r.username as string,
    blocked: Boolean(r.blocked),
    dailyLimit: r.daily_limit === null || r.daily_limit === undefined ? null : Number(r.daily_limit),
    allowMovies: Boolean(r.allow_movies),
    allowTv: Boolean(r.allow_tv),
    allowAnime: Boolean(r.allow_anime),
    jellyseerrUserId: r.jellyseerr_user_id === null || r.jellyseerr_user_id === undefined ? null : Number(r.jellyseerr_user_id),
    jellyseerrLastSync: r.jellyseerr_last_sync ? toIso(r.jellyseerr_last_sync) : null,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

export function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}
