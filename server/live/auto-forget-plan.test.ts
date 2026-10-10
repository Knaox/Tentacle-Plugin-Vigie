import { test } from "node:test";
import assert from "node:assert/strict";
import type { Departure } from "./library-keys";
import { FORGET_GRACE_MS, MASS_TITLES, MASS_WINDOW_MS, forgetCandidates } from "./auto-forget-plan";
import { nextOutages, outageWindows } from "./outages";

/*
 * Suppression ou panne ? La décision, pure : rien pendant une panne des
 * dossiers ; ce qui est parti autour d'une panne ou dans une vague attend une
 * analyse de Jellyfin finie après ; le reste part après la grâce.
 */

const movieDeparture = (tmdbId: number, at: number): Departure => ({ mediaType: "movie", tmdbId, at, seasons: [], whole: true });

test("les candidats : après la grâce, le passé compris, jamais en vague — même l'heure passée", () => {
  const now = 100_000_000_000;
  const old = movieDeparture(1, now - 21 * 86_400_000); // trois semaines : avant cette règle
  const fresh = movieDeparture(2, now - 60_000); // dans la grâce
  const ready = movieDeparture(3, now - FORGET_GRACE_MS - 1);
  const plain = forgetCandidates({ departures: [old, fresh, ready], now });
  assert.deepEqual([plain.ready, plain.held, plain.waves], [[old, ready], 0, []]);

  // Vingt et un départs en vingt minutes, il y a cinq heures : toujours tenus à l'écart.
  const waveAt = now - 5 * 3_600_000;
  const wave = Array.from({ length: MASS_TITLES + 1 }, (_, i) => movieDeparture(100 + i, waveAt + i * 60_000));
  const held = forgetCandidates({ departures: [...wave, ready], now });
  assert.deepEqual([held.ready, held.held], [[ready], MASS_TITLES + 1]);
  assert.deepEqual(held.waves, [{ start: waveAt, end: waveAt + MASS_TITLES * 60_000 }]);
  // La plupart sont revenus (disque rebranché) : les derniers absents restent à l'écart.
  const left = wave.slice(0, 3);
  assert.deepEqual(forgetCandidates({ departures: left, now }).ready, left, "sans mémoire, ils partiraient");
  assert.deepEqual(forgetCandidates({ departures: left, now, knownWaves: held.waves }).ready, []);
  // Au seuil, ce n'est pas une vague ; étalés sur plus d'une heure non plus.
  assert.equal(forgetCandidates({ departures: wave.slice(1), now }).held, 0);
  const spread = Array.from({ length: MASS_TITLES + 1 }, (_, i) => movieDeparture(200 + i, waveAt + i * 4 * 60_000));
  assert.equal(forgetCandidates({ departures: spread, now }).held, 0);
});

test("dossiers de Jellyfin en panne, ou muets : rien ne part, quoi qu'il y ait", () => {
  const now = 100_000_000_000;
  const ready = movieDeparture(1, now - FORGET_GRACE_MS - 1);
  for (const storage of ["down", "unknown"] as const) {
    const plan = forgetCandidates({ departures: [ready], now, storage });
    assert.deepEqual([plan.ready, plan.held, plan.scanNeeded], [[], 1, false]);
  }
});

test("une panne rend suspect ce qui est parti autour d'elle, jusqu'à une analyse de Jellyfin finie après son retour", () => {
  const now = 100_000_000_000;
  // Panne vue il y a 3 h, revenue il y a 1 h ; un titre parti juste avant qu'on la voie.
  const outages = outageWindows([{ start: now - 3 * 3_600_000, end: now - 3_600_000 }], now);
  const during = movieDeparture(1, now - 3 * 3_600_000 - 20 * 60_000);
  const later = movieDeparture(2, now - 30 * 60_000); // après le retour : une vraie suppression
  const plan = forgetCandidates({ departures: [during, later], now, outages, lastScanEnd: now - 2 * 3_600_000 });
  assert.deepEqual(plan.ready, [later]);
  assert.equal(plan.held, 1);
  assert.equal(plan.scanNeeded, true, "Jellyfin doit relire sa bibliothèque");
  // L'analyse finie après le retour confirme : ce qui n'est pas revenu part.
  const confirmed = forgetCandidates({ departures: [during, later], now, outages, lastScanEnd: now - 10 * 60_000 });
  assert.deepEqual(confirmed.ready, [during, later]);
  assert.equal(confirmed.scanNeeded, false);
  // Bien avant la panne (plus d'une heure) : pas suspect.
  const before = movieDeparture(3, now - 3 * 3_600_000 - MASS_WINDOW_MS - 60_000);
  assert.deepEqual(forgetCandidates({ departures: [before], now, outages }).ready, [before]);
});

test("plus de vingt titres supprimés d'un coup, dossiers en bonne santé : tous partent après l'analyse", () => {
  const now = 100_000_000_000;
  const at = now - 2 * 3_600_000;
  const wave = Array.from({ length: MASS_TITLES + 30 }, (_, i) => movieDeparture(100 + i, at + i * 30_000));
  const end = at + (MASS_TITLES + 29) * 30_000;
  const before = forgetCandidates({ departures: wave, now, lastScanEnd: null });
  assert.deepEqual([before.ready.length, before.scanNeeded], [0, true]);
  const after = forgetCandidates({ departures: wave, now, lastScanEnd: end + 60_000 });
  assert.equal(after.ready.length, MASS_TITLES + 30);
  // Les suppressions continuent (fenêtre finie il y a moins que la grâce) : on n'analyse pas encore.
  const ongoing = forgetCandidates({ departures: wave, now: end + 60_000, lastScanEnd: null });
  assert.equal(ongoing.scanNeeded, false);
});

test("le journal des pannes : ouverte à la première vue, close au retour, rien sinon", () => {
  assert.equal(nextOutages([], "ok", 10), null);
  const open = nextOutages([], "down", 10)!;
  assert.deepEqual(open, [{ start: 10, end: null }]);
  assert.equal(nextOutages(open, "down", 20), null);
  assert.equal(nextOutages(open, "unknown", 20), null, "Jellyfin muet ne clôt rien");
  assert.deepEqual(nextOutages(open, "ok", 30), [{ start: 10, end: 30 }]);
  assert.deepEqual(outageWindows(open, 99), [{ start: 10, end: 99 }]);
});
