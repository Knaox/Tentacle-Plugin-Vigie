import { proxyFetch, configUrl, setConfigured, getSeerBackendUrl } from "./endpoints";
import { langParam, getCurrentLanguage } from "../utils/media-helpers";
import type {
  SeerrPagedResponse,
  SeerrMovieDetail,
  SeerrTvDetail,
  DiscoverMediaType,
  DiscoverFilters,
  MediaType,
  LocalRequest,
  LocalRequestsResponse,
  QueueStatus,
  StatsResponse,
  AdminUserRow,
  UpdateAdminUserBody,
} from "./types";

/** Error thrown by backendFetch carrying optional i18n errorKey + extra context. */
export class SeerBackendApiError extends Error {
  status: number;
  errorKey?: string;
  limit?: number;
  constructor(message: string, status: number, opts?: { errorKey?: string; limit?: number }) {
    super(message);
    this.name = "SeerBackendApiError";
    this.status = status;
    this.errorKey = opts?.errorKey;
    this.limit = opts?.limit;
  }
}

/**
 * Formate une erreur backend en message traduit. Si l'erreur expose `errorKey`,
 * on l'utilise comme clé i18n avec `limit` injecté. Sinon on retombe sur `fallback`.
 */
export function formatSeerError(
  err: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
  fallbackKey = "seer:requestError",
): string {
  if (err instanceof SeerBackendApiError && err.errorKey) {
    return t(err.errorKey, err.limit !== undefined ? { limit: err.limit } : undefined);
  }
  if (err instanceof Error && err.message) return err.message;
  return t(fallbackKey);
}

function getToken(): string {
  return localStorage.getItem("tentacle_token") ?? "";
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

/** Fetch from the Seer plugin backend (not Seerr proxy) */
export async function backendFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${getSeerBackendUrl()}/api/plugins/seer${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText })) as {
      message?: string; errorKey?: string; limit?: number;
    };
    throw new SeerBackendApiError(body.message || `HTTP ${res.status}`, res.status, {
      errorKey: body.errorKey,
      limit: body.limit,
    });
  }
  return res.json();
}


/* ── Requests (Tentacle backend — queue system) ──────────────────── */

export async function createRequest(body: {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string | null;
  year?: string | null;
  seasons?: number[];
  profileId?: string | null;
}): Promise<LocalRequest> {
  return backendFetch("/requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMyRequests(
  page = 1,
  limit = 20,
  status?: string,
  mediaType?: string,
  q?: string,
): Promise<LocalRequestsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  if (mediaType) params.set("type", mediaType);
  if (q && q.trim()) params.set("q", q.trim());
  return backendFetch(`/requests?${params}`);
}

export async function deleteRequest(
  id: string,
  opts?: { seasons?: number[]; deleteFiles?: boolean },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (opts?.seasons) body.seasons = opts.seasons;
  if (opts?.deleteFiles !== undefined) body.deleteFiles = opts.deleteFiles;
  await backendFetch(`/requests/${id}`, {
    method: "DELETE",
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });
}

export async function retryRequest(
  id: string,
  opts?: { seasons?: number[]; profileId?: string | null; forceRedownload?: boolean },
): Promise<LocalRequest> {
  const body: Record<string, unknown> = {};
  if (opts?.seasons) body.seasons = opts.seasons;
  if (opts?.profileId !== undefined) body.profileId = opts.profileId;
  if (opts?.forceRedownload !== undefined) body.forceRedownload = opts.forceRedownload;
  return backendFetch(`/requests/${id}/retry`, {
    method: "POST",
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });
}

/** Retire une demande « À vérifier » — et rien d'autre : ni fichiers, ni Sonarr, ni Radarr. */
export async function forgetRequest(id: string): Promise<void> {
  await backendFetch(`/requests/${id}/forget`, { method: "POST" });
}

export async function retryDeleteRequest(id: string): Promise<void> {
  await backendFetch(`/requests/${id}/retry-delete`, { method: "POST" });
}

export async function markRequestStatus(
  id: string,
  status: "available" | "partial" | "processing" | "unknown",
): Promise<{ success: boolean; target: string }> {
  return backendFetch(`/requests/${id}/mark`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

/* ── Profiles ────────────────────────────────────────────────────── */

export async function getProfiles(): Promise<{ profiles: import("./types").SeerProfile[] }> {
  return backendFetch("/profiles");
}

export async function getProfileOptions(): Promise<{
  radarr: import("./types").ArrServerInfo[];
  sonarr: import("./types").ArrServerInfo[];
}> {
  return backendFetch("/profiles/options");
}

/* ── Bulk actions ────────────────────────────────────────────────── */

export async function bulkDeleteRequests(ids: string[]): Promise<{ deleted: number; errors: number }> {
  return backendFetch("/requests/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export async function bulkRetryRequests(ids: string[], profileId?: string | null): Promise<{ retried: number; errors: number }> {
  const body: Record<string, unknown> = { ids };
  if (profileId !== undefined) body.profileId = profileId;
  return backendFetch("/requests/bulk-retry", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* ── Queue ────────────────────────────────────────────────────────── */

export async function getQueueStatus(): Promise<QueueStatus> {
  return backendFetch("/queue/status");
}

/* ── Stats ────────────────────────────────────────────────────────── */

export async function getStats(): Promise<StatsResponse> {
  return backendFetch("/stats");
}

/* ── Stats overview (Jellyseerr source de vérité) ────────────────── */

export interface RequestsStatsOverview {
  total: number;
  byStatus: Record<string, number>;
  byType: { movie: number; tv: number };
}

export async function getRequestsStats(): Promise<RequestsStatsOverview> {
  return backendFetch("/requests/stats");
}

/* ── Config check ────────────────────────────────────────────────── */

export async function isSeerConfigured(): Promise<boolean> {
  try {
    const res = await fetch(configUrl(), {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.enabled && data.url && (data.hasApiKey || data.apiKey)) {
      setConfigured(true);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
