/* ------------------------------------------------------------------ */
/*  Vigie — L'index des demandes de Jellyseerr (lecture et suivi)       */
/* ------------------------------------------------------------------ */

/*
 * Toutes les demandes de Jellyseerr — tous les comptes —, gardées en mémoire
 * sous une forme réduite, et suivies par une empreinte minuscule (cf.
 * request-index-model.ts) : une question d'UNE ligne tant que rien ne bouge,
 * la page des dernières modifications quand quelque chose bouge, une
 * relecture complète seulement quand des demandes ont disparu.
 *
 * C'est ce qui dit, sans relire chaque demande, qu'une demande a été
 * supprimée dans Jellyseerr : Vigie le répercute aussitôt (sa file, ses
 * listes, l'état des titres).
 */

import type { WorkerCfg } from "../seerr-unified";
import {
  applyIncremental, byTitleOf, sameSignature, signatureOf, toIndexed, vanished,
  type IndexedRequest, type IndexSignature,
} from "./request-index-model";

const PAGE = 100;
const RECENT = 50;
const CONCURRENCY = 4;
/** Garde-fou : au-delà, les plus anciennes ne sont pas lues (l'index le sait). */
const MAX_PAGES = 60;
/** Une relecture complète de loin en loin rattrape ce que l'empreinte aurait manqué. */
const FULL_EVERY_MS = 6 * 3_600_000;
/** Jellyseerr muet : on ne le relance pas à chaque passe. */
const BACKOFF_MS = 30_000;

export interface IndexChange {
  /** Demandes ajoutées ou modifiées. */
  changed: IndexedRequest[];
  /** Demandes disparues de Jellyseerr (supprimées). */
  deleted: IndexedRequest[];
}

interface RequestPage {
  pageInfo?: { results?: unknown };
  results?: unknown[];
}

async function fetchPage(cfg: WorkerCfg, take: number, skip: number, sort: "modified" | "added"): Promise<RequestPage> {
  const res = await fetch(
    `${cfg.seerrUrl}/api/v1/request?take=${take}&skip=${skip}&filter=all&sort=${sort}`,
    { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) throw new Error(`Jellyseerr GET /request ${res.status}`);
  return (await res.json()) as RequestPage;
}

class RequestIndexState {
  byId = new Map<number, IndexedRequest>();
  private titles = new Map<string, IndexedRequest[]>();
  private signature: IndexSignature | null = null;
  private hidden = 0;
  private lastFull = 0;
  private retryAfter = 0;
  private running: Promise<IndexChange | null> | null = null;
  /** Vrai dès la première relecture complète réussie. */
  ready = false;
  /** La dernière relecture n'a pas tout lu (trop de demandes). */
  truncated = false;
  /** Change à chaque modification de l'index : les caches qui en dépendent se reconnaissent. */
  generation = 0;

  /** Les demandes d'un titre, telles que Jellyseerr les a — `null` si l'index n'est pas prêt. */
  requestsFor(mediaType: "movie" | "tv", tmdbId: number): readonly IndexedRequest[] | null {
    if (!this.ready) return null;
    return this.titles.get(`${mediaType}:${tmdbId}`) ?? [];
  }

  /** La demande existe-t-elle encore ? `null` : on ne peut pas le dire. */
  exists(id: number): boolean | null {
    if (!this.ready) return null;
    if (this.byId.has(id)) return true;
    if (this.truncated && this.byId.size > 0 && id < Math.min(...this.byId.keys())) return null;
    return false;
  }

  all(): IndexedRequest[] {
    return [...this.byId.values()];
  }

  /**
   * Une passe : l'empreinte, puis ce qu'elle demande. Ne rejette jamais ;
   * rend ce qui a changé, ou `null` quand rien n'a bougé (ou Jellyseerr muet).
   */
  poll(cfg: WorkerCfg, now = Date.now()): Promise<IndexChange | null> {
    if (this.running) return this.running;
    if (now < this.retryAfter) return Promise.resolve(null);
    this.running = this.pass(cfg, now)
      .catch((err) => {
        this.retryAfter = Date.now() + BACKOFF_MS;
        console.warn(`[VigieLive] Demandes de Jellyseerr illisibles : ${err instanceof Error ? err.message : err}`);
        return null;
      })
      .finally(() => { this.running = null; });
    return this.running;
  }

  /** Pour les tests : un index déjà lu. */
  seed(rows: readonly IndexedRequest[]): void {
    this.byId = new Map(rows.map((r) => [r.id, r]));
    this.hidden = 0;
    this.truncated = false;
    this.ready = true;
    this.lastFull = Date.now();
    this.rebuild();
  }

  /** Oublie tout (changement d'instance Jellyseerr). */
  reset(): void {
    this.byId.clear();
    this.titles.clear();
    this.signature = null;
    this.hidden = 0;
    this.lastFull = 0;
    this.ready = false;
    this.truncated = false;
    this.generation++;
  }

  private async pass(cfg: WorkerCfg, now: number): Promise<IndexChange | null> {
    if (!this.ready || now - this.lastFull > FULL_EVERY_MS) return this.full(cfg);
    const sig = signatureOf(await fetchPage(cfg, 1, 0, "modified"));
    if (!sig) throw new Error("empreinte illisible");
    if (sameSignature(sig, this.signature)) return null;
    const recent = await fetchPage(cfg, RECENT, 0, "modified");
    const rows = (recent.results ?? []).map(toIndexed).filter((r): r is IndexedRequest => r !== null);
    const verdict = applyIncremental(this.byId, rows, RECENT, sig.total, this.hidden);
    if (verdict.kind === "reload") return this.full(cfg);
    this.signature = sig;
    if (verdict.changed.length === 0) return null;
    this.rebuild();
    return { changed: verdict.changed, deleted: [] };
  }

  private async full(cfg: WorkerCfg): Promise<IndexChange | null> {
    const first = await fetchPage(cfg, PAGE, 0, "added");
    const total = Number(first.pageInfo?.results ?? first.results?.length ?? 0) || 0;
    const pages = Math.min(Math.ceil(total / PAGE), MAX_PAGES);
    const skips = Array.from({ length: Math.max(0, pages - 1) }, (_, i) => (i + 1) * PAGE);
    // Tout ou rien : une page manquante ferait passer ses demandes pour supprimées.
    const rest = await runLimited(skips, CONCURRENCY, (skip) => fetchPage(cfg, PAGE, skip, "added"));
    const raw = [first, ...rest].flatMap((p) => p.results ?? []);
    const rows = raw.map(toIndexed).filter((r): r is IndexedRequest => r !== null);
    const truncated = Math.ceil(total / PAGE) > MAX_PAGES;
    const sig = signatureOf(await fetchPage(cfg, 1, 0, "modified"));

    const before = this.byId;
    const wasReady = this.ready;
    const deletedIds = wasReady ? vanished(before, rows, truncated) : [];
    const deleted = deletedIds.map((id) => before.get(id)).filter((r): r is IndexedRequest => !!r);
    const changed = wasReady
      ? rows.filter((r) => {
        const known = before.get(r.id);
        return !known || known.updatedAt !== r.updatedAt || known.status !== r.status;
      })
      : [];

    this.byId = new Map(rows.map((r) => [r.id, r]));
    this.hidden = Math.max(0, total - rows.length);
    this.truncated = truncated;
    this.signature = sig;
    this.lastFull = Date.now();
    this.ready = true;
    if (wasReady && changed.length === 0 && deleted.length === 0) return null;
    this.rebuild();
    return { changed, deleted };
  }

  private rebuild(): void {
    this.titles = byTitleOf(this.byId.values());
    this.generation++;
  }
}

/** Comme mapLimit, mais le premier échec fait tout échouer — rien de partiel. */
async function runLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

/** L'index du serveur — un seul, partagé par toutes les routes et le worker. */
export const requestIndex = new RequestIndexState();
export type RequestIndex = RequestIndexState;
export { RequestIndexState };
