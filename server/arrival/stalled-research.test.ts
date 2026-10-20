import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { QueueEntry } from "../arr-queue";
import {
  STALLED_RESEARCH_MS, queueRecordId, researchStalledEntries, resetStalledResearch, stepStalled,
} from "./stalled-research";

/*
 * La promesse de l'avis « le fichier sera recherché à nouveau » : une source
 * morte (personne ne partage, aucun octet pendant six heures) est écartée et
 * la recherche relancée — une seule fois, jamais ce qui avance encore.
 */

const HOUR = 60 * 60_000;

function entry(over: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id: "sonarr-7", source: "sonarr", mediaType: "tv", title: "Dark", seasonNumber: 1, episodeNumber: 1,
    episodeTitle: null, tmdbId: 42, percent: 12, size: 1000, sizeLeft: 880, etaSeconds: null,
    validating: false, paused: false, waiting: false, stalled: true, cause: "noSource", warning: null, downloadId: "HASH", ...over,
  };
}

beforeEach(() => resetStalledResearch());

test("six heures sans un octet : due ; avant, non", () => {
  const first = stepStalled(null, entry(), 0);
  assert.equal(first.due, false);
  assert.equal(stepStalled(first.track, entry(), STALLED_RESEARCH_MS - 1).due, false);
  assert.equal(stepStalled(first.track, entry(), STALLED_RESEARCH_MS).due, true);
});

test("un octet qui arrive remet le compte à zéro", () => {
  const first = stepStalled(null, entry(), 0);
  const trickle = stepStalled(first.track, entry({ sizeLeft: 870 }), 5 * HOUR);
  assert.equal(trickle.due, false);
  assert.equal(stepStalled(trickle.track, entry({ sizeLeft: 870 }), 6 * HOUR).due, false);
  assert.equal(stepStalled(trickle.track, entry({ sizeLeft: 870 }), 11 * HOUR).due, true);
});

test("une autre cause, ou un titre qui avance, n'est jamais relancé", () => {
  assert.equal(stepStalled({ since: 0, sizeLeft: 880 }, entry({ cause: "diskSpace" }), 10 * HOUR).track, null);
  assert.equal(stepStalled({ since: 0, sizeLeft: 880 }, entry({ stalled: false, cause: null }), 10 * HOUR).track, null);
});

test("le numéro de l'entrée chez Sonarr ou Radarr", () => {
  assert.equal(queueRecordId({ id: "sonarr-42" }), 42);
  assert.equal(queueRecordId({ id: "radarr-3" }), 3);
  assert.equal(queueRecordId({ id: "x" }), null);
});

test("relancé UNE fois par téléchargement — un pack de saison est un seul téléchargement", async () => {
  const calls: number[] = [];
  const research = async (_e: QueueEntry, id: number) => { calls.push(id); return true; };
  const pack = [entry({ id: "sonarr-7" }), entry({ id: "sonarr-8", episodeNumber: 2 })];
  await researchStalledEntries(pack, 0, research);
  assert.deepEqual(calls, []);
  const done = await researchStalledEntries(pack, STALLED_RESEARCH_MS, research);
  assert.deepEqual(calls, [7]);
  assert.equal(done.length, 1);
  await researchStalledEntries(pack, STALLED_RESEARCH_MS + HOUR, research);
  assert.deepEqual(calls, [7]);
});

test("un refus du service se retente à la passe suivante", async () => {
  let ok = false;
  const calls: number[] = [];
  const research = async (_e: QueueEntry, id: number) => { calls.push(id); return ok; };
  await researchStalledEntries([entry()], 0, research);
  await researchStalledEntries([entry()], STALLED_RESEARCH_MS, research);
  ok = true;
  await researchStalledEntries([entry()], STALLED_RESEARCH_MS + 60_000, research);
  assert.deepEqual(calls, [7, 7]);
});
