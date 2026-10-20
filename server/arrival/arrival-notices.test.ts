import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { MIGRATIONS } from "../storage/migrations";
import { testDb, type Notification } from "../test-support/sqlite-storage";
import type { TestDatabase } from "../test-support/sqlite";
import type { VigieDb } from "../storage/vigie-db";
import type { ArrivalObservation } from "./notice-watch";
import {
  arrivalAnnounced, departureBody, observationOf, resetArrivalWatch, watchArrival, type WatchedRequest,
} from "./arrival-notices";
import { summarizeQueue } from "../arr-truth";
import type { QueueEntry } from "../arr-queue";

/*
 * Les annonces de départ et de blocage, sur une vraie SQLite : au bon moment
 * (horloge simulée, une passe par minute), une fois par cause et par titre,
 * dans la langue du compte, avec l'état que le cœur range.
 */

const MIN = 60_000;
let raw: TestDatabase;
let db: VigieDb;
let sent: Notification[];

beforeEach(async () => {
  const t = testDb();
  ({ raw, db, notifications: sent } = t);
  await t.storage.migrate(MIGRATIONS);
  raw.exec("CREATE TABLE server_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  resetArrivalWatch();
});
afterEach(() => raw.close());

const req: WatchedRequest = { id: "r1", jellyfinUserId: "u1", mediaType: "tv", tmdbId: 42, title: "Dark", notifiedSeasons: null };
const moving = (sizeLeft: number): ArrivalObservation => ({ state: "downloading", sizeLeft, percent: null });
const stuck = (cause: ArrivalObservation["cause"]): ArrivalObservation => ({ state: "blocked", sizeLeft: 0, percent: 100, cause });

/** Rejoue des passes, une par minute à partir de `start`. */
async function passes(seen: ArrivalObservation[], target = req, start = 0): Promise<string[]> {
  const said: string[] = [];
  for (let i = 0; i < seen.length; i++) said.push(...await watchArrival(db, target, seen[i], (start + i) * MIN));
  return said;
}

test("départ confirmé : UNE annonce « en route », état progress, le texte que le cœur pousse", async () => {
  assert.deepEqual(await passes([moving(1000), moving(900), moving(800), moving(700), moving(600), moving(500)]), ["departure"]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].data.body, departureBody("Dark"));
  assert.equal(sent[0].data.body, "« Dark » est en route");
  assert.equal(sent[0].data.state, "progress");
  assert.equal(sent[0].data.refId, "r1");
});

test("Sonarr bloque juste après la prise : pas de « en route », puis le blocage expliqué une seule fois", async () => {
  const said = await passes([moving(1000), stuck("sample"), stuck("sample"), stuck("sample"), stuck("sample"), stuck("sample")]);
  assert.deepEqual(said, ["sample"]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].data.state, "blocked");
  assert.equal(sent[0].data.title, "Votre demande est en attente");
  assert.equal(sent[0].data.body, "« Dark » — Le fichier reçu n'est qu'un extrait, pas le titre complet. Un administrateur doit intervenir.");
  const target = JSON.parse(String(sent[0].data.target));
  assert.deepEqual(target.params, { tab: "requests", find: "Dark", focus: "r1" });
});

test("pas de rafale : la même cause, même après un redémarrage de Vigie, ne se redit pas ; une autre pendant le MÊME blocage non plus", async () => {
  await passes([stuck("sample"), stuck("sample"), stuck("sample")]);
  resetArrivalWatch(); // Vigie redémarre : la base se souvient.
  await passes([stuck("sample"), stuck("sample"), stuck("sample")], req, 10);
  assert.equal(sent.length, 1);
  // Sans reprise entre les deux, une autre cause n'est pas un nouvel avis.
  await passes([stuck("diskSpace"), stuck("diskSpace"), stuck("diskSpace")], req, 20);
  assert.equal(sent.length, 1);
  // Le titre repart, puis bloque pour une autre raison : là, c'est un nouvel état.
  await passes([moving(900), stuck("diskSpace"), stuck("diskSpace"), stuck("diskSpace")], req, 30);
  assert.equal(sent.length, 2);
  // Une autre demande du même titre, même compte : toujours une seule annonce par cause.
  await passes([stuck("diskSpace"), stuck("diskSpace"), stuck("diskSpace")], { ...req, id: "r2" }, 40);
  assert.equal(sent.length, 2);
});

test("le compte réglé en anglais lit l'avis en anglais", async () => {
  raw.prepare("INSERT INTO server_config (key, value) VALUES (?, ?)").run("user_lang_u1", "en");
  await passes([stuck("diskSpace"), stuck("diskSpace"), stuck("diskSpace")]);
  assert.equal(sent[0].data.title, "Your request is on hold");
  assert.equal(sent[0].data.body, "\"Dark\" — The server is out of disk space to store this title. An administrator needs to step in.");
});

test("arrivé : la mémoire du titre s'efface, une suite bloquée sera de nouveau dite", async () => {
  await passes([stuck("sample"), stuck("sample"), stuck("sample")]);
  await arrivalAnnounced(db, req);
  await passes([stuck("sample"), stuck("sample"), stuck("sample")], req, 10);
  assert.equal(sent.length, 2);
});

test("jamais « en route » après une arrivée annoncée (la suite d'une série)", async () => {
  const later = { ...req, notifiedSeasons: [1] };
  assert.deepEqual(await passes([moving(1000), moving(900), moving(800), moving(700)], later), []);
  assert.equal(sent.length, 0);
});

test("une écriture qui échoue rend la réservation : l'annonce repart à la passe suivante", async () => {
  let fail = true;
  const flaky = async () => { if (fail) throw new Error("cœur occupé"); };
  for (let i = 0; i < 3; i++) await watchArrival(db, req, stuck("sample"), i * MIN, flaky).catch(() => {});
  fail = false;
  // Sans redémarrage : la passe suivante retente, une seule fois.
  const said: string[] = [];
  for (let i = 3; i < 6; i++) said.push(...await watchArrival(db, req, stuck("sample"), i * MIN, flaky));
  assert.deepEqual(said, ["sample"]);
});

test("de la file à l'observation : la copie qui descend l'emporte, la cause d'un titre bloqué voyage", () => {
  const entry = (over: Partial<QueueEntry>): QueueEntry => ({
    id: "sonarr-1", source: "sonarr", mediaType: "tv", title: "Dark", seasonNumber: 1, episodeNumber: 1,
    episodeTitle: null, tmdbId: 42, percent: 50, size: 1000, sizeLeft: 500, etaSeconds: 600,
    validating: false, paused: false, waiting: false, stalled: false, cause: null, warning: null, downloadId: null, ...over,
  });
  const refused = entry({ id: "sonarr-1", downloadId: "A", stalled: true, cause: "sample", sizeLeft: 0, percent: 100 });
  assert.equal(observationOf(summarizeQueue([refused, entry({ id: "sonarr-2", downloadId: "B" })])).state, "downloading");
  const blocked = observationOf(summarizeQueue([refused]));
  assert.deepEqual(blocked, { state: "blocked", sizeLeft: 0, percent: 100, cause: "sample" });
  assert.deepEqual(observationOf(null), { state: null, sizeLeft: null, percent: null });
});
