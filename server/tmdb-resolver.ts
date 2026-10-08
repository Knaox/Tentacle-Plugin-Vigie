/* ------------------------------------------------------------------ */
/*  Seer Plugin — Résolution des fiches TMDB (SQL → réseau borné)      */
/* ------------------------------------------------------------------ */

/*
 * Le correctif du N+1.
 *
 * L'ancien code faisait `allRows.map(async …)` avec un `Map` local censé
 * dédupliquer. Il ne dédupliquait rien : chaque callback s'exécute jusqu'à son
 * premier `await`, donc les 428 `has()` étaient évalués AVANT le premier
 * `set()`. 428 requêtes partaient d'un coup, la plupart tombaient sur le
 * timeout de 8 s, et la liste s'affichait avec des « #1972 » sans affiche.
 *
 * Deux corrections structurelles :
 *   1. la déduplication vit au niveau MODULE, pas de la requête HTTP — deux
 *      onglets, ou la liste et le calendrier en même temps, ne déclenchent
 *      qu'un seul appel par fiche ;
 *   2. la concurrence est bornée par un pool.
 */

import type { VigieDb } from "./storage/vigie-db";
import {
  type TmdbMeta, type TmdbRef, tmdbKey,
  getTmdbMetaBulk, upsertTmdbMetaBulk,
} from "./tmdb-cache";
import { fetchTmdbMeta } from "./tmdb-fetch";
import type { WorkerCfg } from "./seerr-unified";
import { mapLimit, DEFAULT_CONCURRENCY } from "./concurrency";

export const DEFAULT_REGION = "FR";

export interface ResolveOpts {
  /** Fiches récupérées SYNCHRONEMENT dans cette requête. 0 = SQL seul. */
  maxFetch?: number;
  concurrency?: number;
  region?: string;
  /** false = ignorer les fiches périmées (pour décider quoi rafraîchir). */
  includeExpired?: boolean;
}

export interface ResolveResult {
  meta: Map<string, TmdbMeta>;
  /** Fiches toujours inconnues après ce passage. */
  missing: TmdbRef[];
}

/** Dédup au niveau module : une fiche en vol n'est jamais demandée deux fois. */
const inflightMeta = new Map<string, Promise<TmdbMeta | null>>();

function fetchOnce(cfg: WorkerCfg, ref: TmdbRef, region: string): Promise<TmdbMeta | null> {
  const key = tmdbKey(ref);
  const pending = inflightMeta.get(key);
  if (pending) return pending;

  const p = fetchTmdbMeta(cfg, ref, region).finally(() => {
    inflightMeta.delete(key);
  });
  inflightMeta.set(key, p);
  return p;
}

export function dedupeRefs(refs: readonly TmdbRef[]): TmdbRef[] {
  const seen = new Set<string>();
  const out: TmdbRef[] = [];
  for (const r of refs) {
    if (!r || !Number.isFinite(r.tmdbId) || r.tmdbId <= 0) continue;
    const k = tmdbKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** SQL groupé → récupération bornée des manquantes → écriture groupée. */
export async function resolveTmdbMeta(
  db: VigieDb,
  cfg: WorkerCfg | null,
  refs: readonly TmdbRef[],
  opts: ResolveOpts = {},
): Promise<ResolveResult> {
  const unique = dedupeRefs(refs);
  if (unique.length === 0) return { meta: new Map(), missing: [] };

  const meta = await getTmdbMetaBulk(db, unique, opts.includeExpired ?? true);
  const missing = unique.filter((r) => !meta.has(tmdbKey(r)));

  const budget = opts.maxFetch ?? 0;
  if (budget <= 0 || !cfg || missing.length === 0) return { meta, missing };

  const toFetch = missing.slice(0, budget);
  const region = opts.region ?? DEFAULT_REGION;
  const fetched = await mapLimit(
    toFetch,
    opts.concurrency ?? DEFAULT_CONCURRENCY,
    (ref) => fetchOnce(cfg, ref, region),
  );

  const ok = fetched.filter((m): m is TmdbMeta => m !== null);
  if (ok.length > 0) {
    await upsertTmdbMetaBulk(db, ok).catch(() => { /* affichage prioritaire sur la persistance */ });
    for (const m of ok) meta.set(tmdbKey(m), m);
  }

  return { meta, missing: unique.filter((r) => !meta.has(tmdbKey(r))) };
}

/* ── Remplissage en arrière-plan ─────────────────────────────────── */

const backfillQueue = new Set<string>();
const backfillRefs = new Map<string, TmdbRef>();
let backfillRunning = false;

/** Fiches restant à récupérer en fond — exposé au front via `metaPending`. */
export function pendingBackfillCount(): number {
  return backfillQueue.size;
}

/**
 * Remplit la mémoire des fiches sans faire attendre l'utilisateur.
 * Idempotent : un seul drainage à la fois, les appels suivants fusionnent
 * leurs clés dans la file en cours.
 */
export function scheduleTmdbBackfill(
  db: VigieDb,
  cfg: WorkerCfg | null,
  refs: readonly TmdbRef[],
  region = DEFAULT_REGION,
): void {
  if (!cfg) return;
  for (const ref of dedupeRefs(refs)) {
    const k = tmdbKey(ref);
    if (backfillQueue.has(k)) continue;
    backfillQueue.add(k);
    backfillRefs.set(k, ref);
  }
  if (backfillRunning || backfillQueue.size === 0) return;

  backfillRunning = true;
  void drainBackfill(db, cfg, region)
    .catch(() => { /* jamais de rejet non capté : il tuerait le process host */ })
    .finally(() => { backfillRunning = false; });
}

async function drainBackfill(db: VigieDb, cfg: WorkerCfg, region: string): Promise<void> {
  while (backfillQueue.size > 0) {
    const batch = Array.from(backfillQueue).slice(0, 40);
    const refs = batch.map((k) => backfillRefs.get(k)).filter((r): r is TmdbRef => !!r);

    const fetched = await mapLimit(refs, 4, (ref) => fetchOnce(cfg, ref, region));
    const ok = fetched.filter((m): m is TmdbMeta => m !== null);
    if (ok.length > 0) await upsertTmdbMetaBulk(db, ok).catch(() => {});

    for (const k of batch) {
      backfillQueue.delete(k);
      backfillRefs.delete(k);
    }
  }
}
