/* ------------------------------------------------------------------ */
/*  Seer Plugin — Réchauffage de la mémoire des fiches TMDB            */
/* ------------------------------------------------------------------ */

/*
 * Le remplissage se fait en tâche de fond, jamais sur le chemin d'une requête
 * utilisateur. Budget volontairement bas : 40 fiches toutes les 5 minutes, soit
 * ~480 par heure — de quoi remplir une instance de plusieurs centaines de
 * demandes en moins d'une heure après l'installation, sans jamais peser sur
 * Jellyseerr ni sur l'affichage.
 */

import type { VigieDb } from "./storage/vigie-db";
import {
  listStaleTmdbRefs, upsertTmdbMetaBulk, pruneTmdbCache, getTmdbMetaBulk,
  seedTmdbCacheFromLocalRequests, tmdbKey, type TmdbMeta, type TmdbRef,
} from "./tmdb-cache";
import { fetchTmdbMeta } from "./tmdb-fetch";
import { DEFAULT_REGION, dedupeRefs, scheduleTmdbBackfill } from "./tmdb-resolver";
import { fetchAllSeerrRequests } from "./seerr-requests-fetch";
import type { WorkerCfg } from "./seerr-unified";
import { mapLimit } from "./concurrency";

const WARM_BUDGET = 40;
const WARM_CONCURRENCY = 4;
const PRUNE_AFTER_DAYS = 180;
/** Les mille demandes les plus récentes suffisent à couvrir un agenda. */
const DISCOVER_MAX_PAGES = 10;

let lastPruneDay = "";
let seeded = false;

/** Amorçage unique : reprend titres et affiches déjà présents en base. */
export async function seedTmdbCacheOnce(db: VigieDb): Promise<void> {
  if (seeded) return;
  seeded = true;
  try {
    const n = await seedTmdbCacheFromLocalRequests(db);
    if (n > 0) console.log(`[SeerTmdb] Seeded ${n} fiches depuis les demandes locales`);
  } catch (err) {
    console.warn("[SeerTmdb] Seed échoué", err);
  }
}

/**
 * Découverte des demandes faites HORS du plugin.
 *
 * Le réchauffage ne rafraîchit que ce que la table contient déjà, et l'amorçage
 * ne lit que les demandes locales. Une demande passée directement dans
 * Jellyseerr — par un autre utilisateur, typiquement — n'entrait donc dans la
 * mémoire des fiches que si quelqu'un ouvrait « Toutes les demandes », et
 * seulement à hauteur du budget de cette requête. C'est ce qui faisait de cette
 * vue une copie de la vue personnelle.
 *
 * On ne planifie ici que les fiches TOTALEMENT absentes : rafraîchir les
 * périmées reste le travail du réchauffage, avec son budget borné. Sans ce
 * partage, chaque passage remettrait toute l'instance en file.
 */
export async function discoverSeerrRefs(db: VigieDb, cfg: WorkerCfg): Promise<number> {
  const { rows } = await fetchAllSeerrRequests(cfg, null, { maxPages: DISCOVER_MAX_PAGES });

  const refs: TmdbRef[] = [];
  for (const r of rows) {
    if (!r.media?.tmdbId) continue;
    refs.push({ mediaType: r.media.mediaType, tmdbId: r.media.tmdbId });
  }

  const unique = dedupeRefs(refs);
  if (unique.length === 0) return 0;

  const known = await getTmdbMetaBulk(db, unique, true);
  const unknown = unique.filter((r) => !known.has(tmdbKey(r)));
  if (unknown.length > 0) scheduleTmdbBackfill(db, cfg, unknown);
  return unknown.length;
}

export async function warmTmdbCache(
  db: VigieDb,
  cfg: WorkerCfg,
  opts: { budget?: number; region?: string } = {},
): Promise<{ fetched: number; remaining: number }> {
  const budget = opts.budget ?? WARM_BUDGET;
  const region = opts.region ?? DEFAULT_REGION;

  const refs = await listStaleTmdbRefs(db, budget);
  if (refs.length === 0) {
    await pruneOncePerDay(db);
    return { fetched: 0, remaining: 0 };
  }

  const fetched = await mapLimit(refs, WARM_CONCURRENCY, (ref) => fetchTmdbMeta(cfg, ref, region));
  const ok = fetched.filter((m): m is TmdbMeta => m !== null);
  if (ok.length > 0) await upsertTmdbMetaBulk(db, ok);

  await pruneOncePerDay(db);
  return { fetched: ok.length, remaining: Math.max(0, refs.length - ok.length) };
}

async function pruneOncePerDay(db: VigieDb): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (lastPruneDay === today) return;
  lastPruneDay = today;
  try {
    const n = await pruneTmdbCache(db, PRUNE_AFTER_DAYS);
    if (n > 0) console.log(`[SeerTmdb] Purge de ${n} fiches inutilisées`);
  } catch { /* best-effort */ }
}
