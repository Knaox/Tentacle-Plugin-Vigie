import { test } from "node:test";
import assert from "node:assert/strict";
import { DEPARTURE_CONFIRM_MS, stepBlocked, stepDeparture, type ArrivalObservation, type BlockedTrack, type DepartureTrack } from "./notice-watch";
import { CAUSES } from "./blocked-causes";

/*
 * Les deux fenêtres d'annonce, sur une horloge simulée : une passe par
 * minute, comme le worker.
 */

const MIN = 60_000;
const moving = (sizeLeft: number | null, percent: number | null = null): ArrivalObservation =>
  ({ state: "downloading", sizeLeft, percent });

/** Rejoue des passes ; rend la minute de la première confirmation, ou null. */
function departureAt(passes: ArrivalObservation[]): number | null {
  let track: DepartureTrack | null = null;
  for (let minute = 0; minute < passes.length; minute++) {
    const step = stepDeparture(track, passes[minute], minute * MIN);
    if (step.confirmed) return minute;
    track = step.track;
  }
  return null;
}

test("la fenêtre de départ : trois minutes, soit trois passes du worker", () => {
  assert.equal(DEPARTURE_CONFIRM_MS, 3 * MIN);
});

test("un titre qui descend vraiment s'annonce à la troisième minute, pas avant", () => {
  assert.equal(departureAt([moving(1000), moving(900), moving(800), moving(700), moving(600)]), 3);
});

test("Sonarr bloque juste après la prise : aucune annonce de départ", () => {
  const blocked: ArrivalObservation = { state: "blocked", sizeLeft: 1000, percent: 0, cause: "noSource" };
  assert.equal(departureAt([moving(1000), moving(1000), blocked, blocked, blocked, blocked]), null);
});

test("rien n'arrive (0 octet en trois minutes) : pas encore d'annonce, elle part au premier octet", () => {
  assert.equal(departureAt([moving(1000), moving(1000), moving(1000), moving(1000), moving(990)]), 4);
});

test("une interruption reprend la fenêtre à zéro", () => {
  const waiting: ArrivalObservation = { state: "pending", sizeLeft: 1000, percent: null };
  assert.equal(departureAt([moving(1000), moving(900), waiting, moving(900), moving(800), moving(700), moving(600)]), 6);
});

test("déjà en importation : pas d'annonce de départ, l'arrivée la remplace", () => {
  const importing: ArrivalObservation = { state: "importing", sizeLeft: 0, percent: 100 };
  assert.equal(departureAt([moving(1000), moving(10), importing, importing, importing]), null);
});

test("l'avancement seul suffit quand la taille manque ; sans aucune mesure, le temps fait foi", () => {
  assert.equal(departureAt([moving(null, 1), moving(null, 2), moving(null, 3), moving(null, 4)]), 3);
  assert.equal(departureAt([moving(null), moving(null), moving(null), moving(null)]), 3);
});

/** Rejoue des passes de blocage ; rend la minute de la première échéance, ou null. */
function blockedDueAt(passes: ArrivalObservation[]): number | null {
  let track: BlockedTrack | null = null;
  for (let minute = 0; minute < passes.length; minute++) {
    const step = stepBlocked(track, passes[minute], minute * MIN);
    if (step.due) return minute;
    track = step.track;
  }
  return null;
}

const stuck = (cause: ArrivalObservation["cause"]): ArrivalObservation => ({ state: "blocked", sizeLeft: 0, percent: 100, cause });

test("un import refusé s'annonce après deux lectures concordantes (deux minutes)", () => {
  assert.equal(CAUSES.sample.confirmMs, 2 * MIN);
  assert.equal(blockedDueAt([stuck("sample"), stuck("sample"), stuck("sample")]), 2);
});

test("une source morte qui revient avant vingt minutes : aucune alerte", () => {
  const passes = [...Array(15)].map(() => stuck("noSource"));
  assert.equal(blockedDueAt([...passes, moving(500), ...passes]), null);
  assert.equal(blockedDueAt([...Array(25)].map(() => stuck("noSource"))), 20);
});

test("une autre cause reprend le compte à zéro", () => {
  assert.equal(blockedDueAt([stuck("busyFile"), stuck("busyFile"), stuck("sample"), stuck("sample"), stuck("sample")]), 4);
});

test("sans cause dite, le repli générique a sa propre durée", () => {
  const passes = [...Array(12)].map(() => ({ state: "blocked", sizeLeft: null, percent: null }) as ArrivalObservation);
  assert.equal(blockedDueAt(passes), CAUSES.unknown.confirmMs / MIN);
});
