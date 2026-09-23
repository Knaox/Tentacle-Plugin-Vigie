/* ------------------------------------------------------------------ */
/*  Vigie — Le statut de chaque titre, sans aller le demander          */
/* ------------------------------------------------------------------ */

/*
 * Un résultat instantané doit déjà dire « Disponible » ou « Demandé » — sinon
 * la pastille arrive après coup et la liste change sous les yeux. Jellyseerr
 * sait, pour chaque titre qu'il connaît, où il en est (`GET /api/v1/media`) :
 * on garde cette table en mémoire.
 *
 * Coût : une lecture complète au premier usage (≈ 30 pages de 100 sur une
 * grosse instance), puis UNE page triée par date de modification par minute
 * au plus — seulement quand quelqu'un cherche. Une relecture complète toutes
 * les six heures rattrape les suppressions, que l'incrémental ne voit pas.
 */

import { mapLimit } from "../concurrency";
import type { WorkerCfg } from "../seerr-unified";

/** Statuts Jellyseerr d'un média. */
export const MEDIA_STATUS = {
  UNKNOWN: 1,
  PENDING: 2,
  PROCESSING: 3,
  PARTIALLY_AVAILABLE: 4,
  AVAILABLE: 5,
  BLOCKLISTED: 6,
  DELETED: 7,
} as const;

const PAGE_SIZE = 100;
const INCREMENTAL_EVERY_MS = 60_000;
const FULL_EVERY_MS = 6 * 3_600_000;
const FULL_CONCURRENCY = 3;

interface MediaRow {
  tmdbId?: number;
  mediaType?: string;
  status?: number;
  updatedAt?: string;
}

interface MediaPage {
  pageInfo?: { pages?: number; results?: number };
  results?: MediaRow[];
}

const statuses = new Map<string, number>();
let lastFull = 0;
let lastIncremental = 0;
let newestSeen = "";
let running: Promise<void> | null = null;
/* Jellyseerr injoignable : on ne réessaie pas à chaque frappe. */
let retryAfter = 0;
const RETRY_MS = 60_000;

export function statusOf(mediaType: "movie" | "tv", tmdbId: number): number | undefined {
  return statuses.get(`${mediaType}:${tmdbId}`);
}

/** Un statut lu ailleurs (réponse de recherche, demande qu'on vient de faire) — plus frais que la table. */
export function noteStatus(mediaType: "movie" | "tv", tmdbId: number, status: number | undefined): void {
  if (typeof status === "number" && status > 0) statuses.set(`${mediaType}:${tmdbId}`, status);
}

export function statusMapReady(): boolean {
  return lastFull > 0;
}

async function fetchPage(cfg: WorkerCfg, skip: number, take = PAGE_SIZE): Promise<MediaPage> {
  const res = await fetch(
    `${cfg.seerrUrl}/api/v1/media?take=${take}&skip=${skip}&filter=all&sort=modified`,
    { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) throw new Error(`GET /media ${res.status}`);
  return (await res.json()) as MediaPage;
}

function absorb(rows: MediaRow[] | undefined, into: Map<string, number>): void {
  for (const row of rows ?? []) {
    if (typeof row.tmdbId !== "number" || (row.mediaType !== "movie" && row.mediaType !== "tv")) continue;
    if (typeof row.status === "number") into.set(`${row.mediaType}:${row.tmdbId}`, row.status);
    if (row.updatedAt && row.updatedAt > newestSeen) newestSeen = row.updatedAt;
  }
}

async function fullReload(cfg: WorkerCfg): Promise<void> {
  const first = await fetchPage(cfg, 0);
  const fresh = new Map<string, number>();
  absorb(first.results, fresh);
  const total = first.pageInfo?.results ?? 0;
  const skips: number[] = [];
  for (let skip = PAGE_SIZE; skip < total; skip += PAGE_SIZE) skips.push(skip);
  const pages = await mapLimit(skips, FULL_CONCURRENCY, (skip) => fetchPage(cfg, skip));
  for (const page of pages) absorb(page?.results, fresh);
  // Remplacement d'un bloc : un titre supprimé chez Jellyseerr disparaît ici aussi.
  statuses.clear();
  for (const [k, v] of fresh) statuses.set(k, v);
  lastFull = Date.now();
  lastIncremental = lastFull;
}

async function incremental(cfg: WorkerCfg): Promise<void> {
  const since = newestSeen;
  const page = await fetchPage(cfg, 0, 50);
  absorb(page.results, statuses);
  lastIncremental = Date.now();
  // Plus de cinquante changements depuis la dernière fois : on ne rattrape pas
  // page à page, la prochaine lecture complète s'en charge — on l'avance.
  const rows = page.results ?? [];
  if (rows.length === 50 && rows.every((r) => (r.updatedAt ?? "") > since)) lastFull = 0;
}

/**
 * Tient la table à jour, SANS jamais faire attendre l'appelant : la recherche
 * part avec ce qu'on sait, et la table se complète derrière elle.
 */
export function refreshStatusMap(cfg: WorkerCfg): void {
  if (running) return;
  const now = Date.now();
  if (now < retryAfter) return;
  const needFull = now - lastFull > FULL_EVERY_MS;
  if (!needFull && now - lastIncremental < INCREMENTAL_EVERY_MS) return;
  running = (needFull ? fullReload(cfg) : incremental(cfg))
    .catch((err) => {
      console.warn(`[Vigie] Statuts des médias indisponibles : ${err instanceof Error ? err.message : err}`);
      retryAfter = Date.now() + RETRY_MS;
    })
    .finally(() => { running = null; });
}

/** Pour les tests : repartir d'une table vide. */
export function resetStatusMapForTests(): void {
  statuses.clear();
  lastFull = 0;
  lastIncremental = 0;
  newestSeen = "";
  running = null;
  retryAfter = 0;
}
