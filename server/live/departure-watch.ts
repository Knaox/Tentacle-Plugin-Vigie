/* ------------------------------------------------------------------ */
/*  Vigie — Suppression ou panne ? Ce que Jellyfin en dit               */
/* ------------------------------------------------------------------ */

/*
 * Avant qu'une demande parte avec son titre, Vigie s'assure que le titre a
 * bien été SUPPRIMÉ — pas seulement perdu de vue :
 *
 *   1. les dossiers des bibliothèques répondent (storage-health.ts) ; en
 *      panne, rien ne part et la panne est retenue (outages.ts) ;
 *   2. ce qui est parti autour d'une panne, ou dans une vague, attend une
 *      analyse complète de la bibliothèque par Jellyfin, finie APRÈS — Vigie
 *      la lance lui-même, dossiers revenus, une fois les départs calmés ;
 *   3. ce qui reste suspect ne se dit pas « supprimé » non plus : la fiche
 *      garde « Demandé » (live-state.ts, `setSuspect`).
 *
 * Les dépendances vers Jellyfin s'injectent : les tests jouent la panne.
 */

import type { VigieDb } from "../storage/vigie-db";
import { forgetCandidates, inWave, mergeWaves, unconfirmedWindows, wavesOf, type Candidates, type WaveWindow } from "./auto-forget-plan";
import { createOutageLog, outageWindows } from "./outages";
import { createStorageWatch, libraryScanState, startLibraryScan, type ScanState, type StorageReport } from "./storage-health";
import { liveState } from "./live-state";
import type { Departure } from "./library-keys";

/** Une vague retenue est oubliée avec les départs que le serveur garde (30 jours). */
const WAVE_MEMORY_MS = 31 * 86_400_000;
/** Une analyse lancée sans réponse n'est pas relancée avant ce délai. */
const SCAN_RETRY_MS = 30 * 60_000;
const WARN_EVERY_MS = 6 * 60 * 60_000;

export interface WatchDeps {
  storage: (now: number) => Promise<StorageReport>;
  scanState: () => Promise<ScanState | null>;
  startScan: (taskId: string) => Promise<boolean>;
}

export function jellyfinWatchDeps(db: VigieDb): WatchDeps {
  const storage = createStorageWatch(db);
  return {
    storage,
    scanState: () => libraryScanState(db),
    startScan: (taskId) => startLibraryScan(db, taskId),
  };
}

export function createDepartureWatch(db: VigieDb, deps: WatchDeps) {
  const outages = createOutageLog(db);
  let waves: WaveWindow[] = [];
  let lastScanRequest = 0;
  let lastWarn = 0;
  let lastWarnKey = "";

  const warn = (key: string, now: number, message: string) => {
    if (key === lastWarnKey && now - lastWarn < WARN_EVERY_MS) return;
    lastWarnKey = key;
    lastWarn = now;
    console.warn(`[VigieLive] ${message}`);
  };

  /** Quels titres partis peuvent perdre leur demande maintenant. `open` : ceux dont une demande d'avant vit. */
  return async function decide(open: readonly Departure[], now: number): Promise<Candidates | null> {
    const departures = liveState.departures();
    if (open.length === 0) {
      liveState.setSuspect([]);
      return null;
    }
    const storage = await deps.storage(now);
    const windows = outageWindows(await outages.observe(storage.state, now), now);
    const allWaves = mergeWaves([...waves, ...wavesOf(departures)]);
    // L'état de l'analyse n'est lu que si un candidat est suspect.
    const suspect = open.some((d) => inWave(d.at, unconfirmedWindows(allWaves, windows, null)));
    const scan = suspect ? await deps.scanState().catch(() => null) : null;

    const plan = forgetCandidates({
      departures, candidates: open, now, knownWaves: waves, outages: windows,
      storage: storage.state, lastScanEnd: scan?.lastEnd ?? null,
    });
    waves = plan.waves.filter((w) => now - w.end < WAVE_MEMORY_MS);
    liveState.setSuspect(plan.unconfirmed);

    if (storage.state === "down") {
      warn(`down:${storage.down.join("|")}`, now,
        `Dossier(s) de Jellyfin injoignable(s) : ${storage.down.join(", ")} — une panne, pas une suppression. `
        + "Aucune demande n'est retirée tant qu'ils ne répondent pas.");
    } else if (plan.held > 0) {
      warn(`held:${plan.held}`, now,
        `${plan.held} titre(s) partis autour d'une panne ou d'une vague : leurs demandes attendent que Jellyfin ait relu sa bibliothèque.`);
    }
    if (plan.scanNeeded && scan && !scan.running && now - lastScanRequest >= SCAN_RETRY_MS) {
      lastScanRequest = now;
      if (await deps.startScan(scan.taskId).catch(() => false)) {
        console.log("[VigieLive] Analyse de la médiathèque demandée à Jellyfin : ce qui n'en revient pas a bien été supprimé");
      }
    }
    return plan;
  };
}
