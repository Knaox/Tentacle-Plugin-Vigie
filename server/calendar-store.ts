/* ------------------------------------------------------------------ */
/*  Seer Plugin — Cache et entretien du calendrier maître              */
/* ------------------------------------------------------------------ */

/*
 * Une entrée par région, servie périmée pendant qu'elle se reconstruit en
 * fond (stale-while-revalidate) : personne n'attend jamais derrière le TTL.
 * Le warmup du démarrage + un passage périodique font que le PREMIER visiteur
 * de la journée trouve lui aussi un calendrier déjà chaud — c'était lui qui
 * payait jusqu'ici la construction entière, sans même un message.
 */

import type { VigieDb } from "./storage/vigie-db";
import type { WorkerCfg } from "./seerr-unified";
import { cached } from "./cache";
import { todayString } from "./tmdb-fetch";
import { addDays } from "./calendar-types";
import { DEFAULT_REGION } from "./tmdb-resolver";
import { buildCalendarStore, type CalendarStore } from "./calendar-store-build";

const STORE_TTL_MS = 6 * 3_600_000;
const STORE_STALE_MS = 24 * 3_600_000;
/**
 * Un store incomplet (fiches en cours de récupération) se redonne un TTL
 * court : le remplissage de fond aboutit en une poignée de minutes, et le
 * sondage du client (10 s) déclenche la reconstruction — qui repart des
 * sources cachées, donc ne re-paie que du SQL.
 */
const STORE_PARTIAL_TTL_MS = 60_000;

/** Marge passée au-delà du mois précédent : la grille du mois déborde au lundi. */
const PAST_GRID_MARGIN_DAYS = 7;
const FUTURE_DAYS = 180;

/** Les régions réellement consultées — le warmup ne chauffe que celles-là. */
const seenRegions = new Set<string>([DEFAULT_REGION]);

/**
 * Horizon canonique du store : du 1er du mois PRÉCÉDENT (moins la marge de
 * grille) à J+180. Le coût de construction est quasi indépendant de la
 * fenêtre — autant la prendre large et servir toute navigation raisonnable
 * depuis la même entrée.
 */
export function calendarStoreHorizon(today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const prevFirst = m === 1
    ? `${y - 1}-12-01`
    : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  return { from: addDays(prevFirst, -PAST_GRID_MARGIN_DAYS), to: addDays(today, FUTURE_DAYS) };
}

export async function getCalendarStore(
  db: VigieDb,
  cfg: WorkerCfg,
  region: string,
  warn?: (err: unknown, msg: string) => void,
): Promise<CalendarStore> {
  const reg = /^[A-Z]{2}$/.test(region) ? region : DEFAULT_REGION;
  seenRegions.add(reg);
  const { from, to } = calendarStoreHorizon(todayString());

  /* La borne `from` dans la clé fait basculer sur une entrée neuve à chaque
   * changement de jour utile (début de mois) ; l'ancienne meurt au balayage. */
  return cached(
    `seer:store:${reg}:${from}`,
    STORE_TTL_MS,
    () => buildCalendarStore(db, cfg, reg, from, to, warn),
    {
      staleMs: STORE_STALE_MS,
      ttlFor: (s) => (s.partial ? STORE_PARTIAL_TTL_MS : STORE_TTL_MS),
    },
  );
}

/**
 * Chauffe le store au démarrage puis le maintient frais : un passage toutes
 * les 30 min sur les régions consultées. En deçà du TTL c'est un simple accès
 * mémoire ; au-delà, le stale-while-revalidate reconstruit en fond.
 *
 * Rendu par `registerCalendarRoutes` plutôt que branché dans index.ts : le
 * fichier d'entrée est déjà au-delà du budget de lignes du projet.
 */
export function initCalendarStoreMaintenance(
  db: VigieDb,
  getCfg: () => Promise<WorkerCfg | null>,
  warn?: (err: unknown, msg: string) => void,
): () => void {
  let stopped = false;

  const warm = async () => {
    if (stopped) return;
    const cfg = await getCfg();
    if (!cfg) return;
    for (const region of seenRegions) {
      if (stopped) return;
      await getCalendarStore(db, cfg, region, warn).catch((err) => {
        warn?.(err, `[seer] échec du préchauffage du calendrier (${region})`);
      });
    }
  };

  const boot = setTimeout(() => { void warm(); }, 15_000);
  const tick = setInterval(() => { void warm(); }, 30 * 60_000);
  boot.unref?.();
  tick.unref?.();

  return () => {
    stopped = true;
    clearTimeout(boot);
    clearInterval(tick);
  };
}
