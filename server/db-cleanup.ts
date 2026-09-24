/* ------------------------------------------------------------------ */
/*  Seer Plugin — Cleanup queue database operations                    */
/* ------------------------------------------------------------------ */

import type { PrismaClient } from "@prisma/client";
import { toIso, uuid } from "./db-helpers";

type Prisma = PrismaClient;

/* ── Types ────────────────────────────────────────────────────────── */

export interface CleanupJob {
  id: string;
  action: "delete" | "retry" | "sync";
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  seerrRequestId: number | null;
  seerrMediaId: number | null;
  deleteFiles: boolean;
  /** Saisons ciblées (TV). null/[] = série entière / film. */
  seasons: number[] | null;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  status: string;
  nextRetryAt: string;
  requestId: string | null;
  /** Propriétaire de la demande — sert à n'invalider QUE son cache. */
  jellyfinUserId: string | null;
}

/** Parse défensif de la colonne JSON `seasons`. */
function parseSeasons(raw: unknown): number[] | null {
  if (raw == null) return null;
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) {
      const nums = arr.map(Number).filter((n) => Number.isFinite(n));
      return nums.length > 0 ? nums : null;
    }
  } catch { /* ignore */ }
  return null;
}

/* ── CRUD ─────────────────────────────────────────────────────────── */

export async function enqueueCleanup(
  prisma: Prisma,
  job: {
    action: string;
    mediaType: string;
    tmdbId: number;
    title: string;
    seerrRequestId?: number | null;
    seerrMediaId?: number | null;
    deleteFiles?: boolean;
    seasons?: number[] | null;
    requestId?: string | null;
    jellyfinUserId?: string | null;
    /** Exécution différée (ex. re-synchro de dispo après un délai) */
    delaySeconds?: number;
  },
): Promise<string> {
  const id = uuid();
  const delay = Math.max(0, Math.floor(job.delaySeconds ?? 0));
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_cleanup_queue (id, action, media_type, tmdb_id, title, seerr_request_id, seerr_media_id, delete_files, seasons, request_id, jellyfin_user_id, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    id, job.action, job.mediaType, job.tmdbId, job.title,
    job.seerrRequestId ?? null, job.seerrMediaId ?? null, job.deleteFiles ? 1 : 0,
    job.seasons && job.seasons.length > 0 ? JSON.stringify(job.seasons) : null,
    job.requestId ?? null,
    job.jellyfinUserId ?? null,
    delay,
  );
  return id;
}

export async function getPendingCleanups(prisma: Prisma, limit = 25): Promise<CleanupJob[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM seer_cleanup_queue
     WHERE status = 'pending' AND next_retry_at <= NOW()
     ORDER BY created_at ASC LIMIT ${Math.max(1, Math.min(100, limit))}`,
  );
  return rows.map((r) => ({
    id: r.id as string,
    action: r.action as "delete" | "retry",
    mediaType: r.media_type as "movie" | "tv",
    tmdbId: r.tmdb_id as number,
    title: r.title as string,
    seerrRequestId: (r.seerr_request_id as number) || null,
    seerrMediaId: (r.seerr_media_id as number) || null,
    deleteFiles: Boolean(r.delete_files),
    seasons: parseSeasons(r.seasons),
    retryCount: (r.retry_count as number) || 0,
    maxRetries: (r.max_retries as number) || 20,
    lastError: (r.last_error as string) || null,
    status: r.status as string,
    nextRetryAt: toIso(r.next_retry_at),
    requestId: (r.request_id as string) || null,
    jellyfinUserId: (r.jellyfin_user_id as string) || null,
  }));
}

export async function updateCleanupJob(
  prisma: Prisma,
  id: string,
  status: string,
  extra?: { lastError?: string; retryCount?: number; nextRetryAt?: Date },
): Promise<void> {
  const sets: string[] = ["status = ?"];
  const params: unknown[] = [status];
  if (extra?.lastError !== undefined) { sets.push("last_error = ?"); params.push(extra.lastError); }
  if (extra?.retryCount !== undefined) { sets.push("retry_count = ?"); params.push(extra.retryCount); }
  if (extra?.nextRetryAt !== undefined) { sets.push("next_retry_at = ?"); params.push(extra.nextRetryAt); }
  params.push(id);
  await prisma.$executeRawUnsafe(`UPDATE seer_cleanup_queue SET ${sets.join(", ")} WHERE id = ?`, ...params);
}

/** Clear pending_cleanup_id on requests linked to a completed cleanup job */
export async function clearPendingCleanup(prisma: Prisma, cleanupId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET pending_cleanup_id = NULL WHERE pending_cleanup_id = ?`,
    cleanupId,
  );
}

/**
 * Abandonne les nettoyages *arr pas encore aboutis d'une demande qu'on retire
 * sans rien toucher : ce sont eux qui toucheraient Sonarr ou Radarr.
 */
export async function cancelCleanupsForRequest(prisma: Prisma, requestId: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `DELETE FROM seer_cleanup_queue WHERE request_id = ? AND status <> 'completed'`,
    requestId,
  );
}

/** Link a request to a cleanup job so it waits for cleanup to complete */
export async function setPendingCleanup(prisma: Prisma, requestId: string, cleanupId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE seer_requests SET pending_cleanup_id = ? WHERE id = ?`,
    cleanupId,
    requestId,
  );
}
