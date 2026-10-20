import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { MIGRATIONS } from "../storage/migrations";
import { testDb, type Notification } from "../test-support/sqlite-storage";
import { json, stubFetch } from "../test-support/fake-http";
import type { TestDatabase } from "../test-support/sqlite";
import type { VigieDb } from "../storage/vigie-db";
import { advanceFromArr } from "../arr-advance";
import { resetArrivalWatch } from "./arrival-notices";
import { resetStalledResearch } from "./stalled-research";
import type { FetchCall } from "../test-support/fake-http";
import { invalidate } from "../cache";

/*
 * Le worker de bout en bout, minute par minute : un faux Jellyseerr qui
 * désigne un faux Radarr, dont la file change à chaque passe — les scénarios
 * des retours de Damien. Aucun service réel ; horloge simulée.
 */

const SEERR = "http://seerr.test";
const RADARR = "http://radarr.test:7878";
const cfg = { seerrUrl: SEERR, seerrApiKey: "k" } as never;
const MIN = 60_000;

let raw: TestDatabase;
let db: VigieDb;
let sent: Notification[];
let clock = 0;
const realNow = Date.now;
/** La file de Radarr à la passe en cours, et le fichier du film. */
let queue: unknown[] = [];
let hasFile = false;
let restoreFetch: () => void;
let calls: FetchCall[] = [];

beforeEach(async () => {
  const t = testDb();
  ({ raw, db, notifications: sent } = t);
  await t.storage.migrate(MIGRATIONS);
  raw.exec("CREATE TABLE server_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  raw.exec("CREATE TABLE content_claims (tmdbId INTEGER, jellyfinUserId TEXT, mediaType TEXT, title TEXT, expiresAt INTEGER, createdAt INTEGER, PRIMARY KEY (tmdbId, jellyfinUserId))");
  resetArrivalWatch();
  resetStalledResearch();
  invalidate("seer");
  clock = Date.UTC(2026, 9, 15, 20, 0, 0);
  Date.now = () => clock;
  queue = [];
  hasFile = false;
  const stub = stubFetch([
    (c) => (c.url === `${SEERR}/api/v1/settings/radarr` ? json([{ isDefault: true, hostname: "radarr.test", port: 7878, apiKey: "r", useSsl: false, baseUrl: "" }]) : null),
    (c) => (c.url === `${SEERR}/api/v1/settings/sonarr` ? json([]) : null),
    (c) => (c.url.startsWith(`${RADARR}/api/v3/queue`) ? json({ records: queue, totalRecords: queue.length }) : null),
    (c) => (c.url.startsWith(`${RADARR}/api/v3/movie?tmdbId=`) ? json([{ hasFile }]) : null),
  ]);
  restoreFetch = stub.restore;
  calls = stub.calls;
  raw.prepare(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, created_at, updated_at)
     VALUES ('r1', 'u1', 'alice', 'movie', 7, 'Dune', 'approved', ?, ?)`,
  ).run(clock, clock);
});

afterEach(() => {
  restoreFetch();
  Date.now = realNow;
  raw.close();
});

const record = (over: Record<string, unknown>) => ({
  id: 1, title: "Dune.2026.1080p", size: 1000, sizeleft: 1000, status: "downloading", trackedDownloadState: "downloading",
  trackedDownloadStatus: "ok", downloadId: "A", movie: { title: "Dune", tmdbId: 7 }, ...over,
});

/** Une passe du worker par minute ; `scene(minute)` règle la file avant la passe. */
async function minutes(count: number, scene: (minute: number) => void): Promise<void> {
  for (let minute = 0; minute < count; minute++) {
    scene(minute);
    await advanceFromArr(db, cfg);
    clock += MIN;
  }
}

const bodies = () => sent.map((n) => `${n.data.state}: ${n.data.body}`);
const status = () => (raw.prepare("SELECT status FROM seer_requests WHERE id = 'r1'").all()[0] as { status: string }).status;

test("Radarr prend le film puis bloque aussitôt (source morte) : jamais « en route », un seul avis de blocage", async () => {
  const stalled = record({ status: "warning", trackedDownloadStatus: "warning",
    statusMessages: [{ title: "Dune.2026.1080p", messages: ["The download is stalled with no connections"] }] });
  await minutes(30, (m) => { queue = m === 0 ? [record({})] : [stalled]; });
  assert.deepEqual(bodies(), [
    "blocked: « Dune » — Pas assez de personnes partagent ce fichier pour l'instant : le transfert est à l'arrêt. Ça se réglera tout seul : le fichier sera recherché à nouveau automatiquement, rien à faire de votre part.",
  ]);
  assert.equal(sent[0].data.title, "Votre demande est en attente");
});

test("la promesse tenue : une source morte six heures durant est écartée, la recherche relancée — une seule fois", async () => {
  const stalled = record({ id: 31, status: "warning", trackedDownloadStatus: "warning",
    statusMessages: [{ title: "Dune.2026.1080p", messages: ["The download is stalled with no connections"] }] });
  const deletes = () => calls.filter((c) => c.method === "DELETE").map((c) => c.url);
  await minutes(5 * 60, () => { queue = [stalled]; });
  assert.deepEqual(deletes(), []);
  await minutes(70, () => { queue = [stalled]; });
  assert.deepEqual(deletes(), [`${RADARR}/api/v3/queue/31?removeFromClient=true&blocklist=true&skipRedownload=false`]);
  // Un seul avis pour tout ce temps : la demande attend, elle ne crie pas.
  assert.equal(sent.length, 1);
});

test("une copie refusée à l'import (échantillon), une autre qui descend : « en route » confirmé, aucune alerte, puis l'arrivée", async () => {
  const sample = record({ id: 1, downloadId: "OLD", status: "completed", sizeleft: 0, trackedDownloadState: "importBlocked",
    trackedDownloadStatus: "warning", statusMessages: [{ title: "Dune.SAMPLE", messages: ["Sample"] }] });
  await minutes(12, (m) => {
    queue = [sample, record({ id: 2, downloadId: "NEW", sizeleft: 1000 - m * 80 })];
  });
  assert.deepEqual(bodies(), ["progress: « Dune » est en route"]);
  assert.equal(status(), "downloading");

  // La bonne copie est rangée : le film est là.
  hasFile = true;
  await minutes(2, () => { queue = [sample]; });
  assert.deepEqual(bodies(), ["progress: « Dune » est en route", "available: « Dune » est sorti sur Tentacle TV"]);
  assert.equal(status(), "available");
});

test("import refusé pour de bon : expliqué en deux minutes, une seule fois, puis rien de plus", async () => {
  const unknownRelease = record({ status: "completed", sizeleft: 0, trackedDownloadState: "importBlocked", trackedDownloadStatus: "warning",
    statusMessages: [{ title: "Dune.2026", messages: ["Movie title mismatch, automatic import is not possible"] }] });
  await minutes(4, (m) => { queue = [record({ sizeleft: 1000 - m * 300 })]; });
  await minutes(40, () => { queue = [unknownRelease]; });
  assert.deepEqual(bodies(), [
    "progress: « Dune » est en route",
    "blocked: « Dune » — Le serveur ne reconnaît pas le fichier reçu et ne peut pas le ranger seul. Un administrateur doit intervenir.",
  ]);
  const target = JSON.parse(String(sent[1].data.target));
  assert.equal(target.path, "/discover");
  assert.equal(target.params.focus, "r1");
});
