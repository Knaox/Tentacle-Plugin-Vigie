import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { testDb } from "../test-support/sqlite-storage";
import type { TestDatabase } from "../test-support/sqlite";
import type { VigieDb } from "../storage/vigie-db";
import { MIGRATIONS } from "../storage/migrations";
import { enqueueCleanup, getNextQueued } from "../db";
import { processCleanupQueue } from "../worker-cleanup";
import { liveState } from "./live-state";
import { requestIndex } from "./request-index";
import type { IndexedRequest } from "./request-index-model";

/*
 * Le retrait d'une demande consommée (action « forget ») passe parfois tard :
 * un nouvel essai, une redemande faite entre-temps. Il n'emporte jamais ce
 * qu'une redemande attend ; et une demande que Jellyseerr refuse de réduire
 * part en entier, pour que la saison supprimée se redemande.
 */

const SEERR = "http://seerr.test";
const config = { seerrUrl: SEERR, seerrApiKey: "k", interval: 60_000, syncEvery: 2 };
const LONG_AGO = Date.now() - 3_600_000;
const BEFORE = new Date(LONG_AGO - 86_400_000).toISOString();
const AFTER = new Date(LONG_AGO + 600_000).toISOString();

let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;
let calls: string[];
let requests: Array<{ id: number; status: number; createdAt: string; seasons: Array<{ seasonNumber: number }> }>;

const indexed = (id: number, status: number, seasons: number[], createdAt: string): IndexedRequest => ({
  id, status, is4k: false, mediaType: "tv", tmdbId: 1399, seasons,
  requestedBy: { seerrUserId: 1, jellyfinUserId: "u1", name: null }, createdAt, updatedAt: null, mediaStatus: 4,
});

function fake(c: FetchCall) {
  const url = new URL(c.url);
  calls.push(`${c.method} ${url.host}${url.pathname}`);
  if (c.url === `${SEERR}/api/v1/settings/sonarr`) return json([{ isDefault: true, hostname: "sonarr.test", port: 8989, apiKey: "s", useSsl: false, baseUrl: "" }]);
  if (url.pathname === "/api/v1/tv/1399") return json({ id: 1399, mediaInfo: { id: 9, status: 4, externalServiceId: 50, requests } });
  if (url.pathname.startsWith("/api/v1/request/") && c.method === "PUT") return new Response("locked", { status: 409 });
  if (url.pathname.startsWith("/api/v1/request/") && c.method === "DELETE") {
    requests = requests.filter((r) => `/api/v1/request/${r.id}` !== url.pathname);
    return new Response(null, { status: 204 });
  }
  if (url.host === "sonarr.test:8989" && url.pathname === "/api/v3/series/50" && c.method === "GET") {
    return json({ id: 50, seasons: [{ seasonNumber: 1, monitored: true }, { seasonNumber: 2, monitored: true }, { seasonNumber: 3, monitored: true }], statistics: { episodeFileCount: 4 } });
  }
  if (url.host === "sonarr.test:8989" && url.pathname === "/api/v3/queue") return json({ records: [] });
  return json({});
}

beforeEach(async () => {
  let storage;
  ({ db, raw, storage } = testDb());
  await storage.migrate(MIGRATIONS);
  liveState.reset();
  requestIndex.reset();
  calls = [];
  net = stubFetch([fake]);
});
afterEach(() => { net.restore(); raw.close(); });

test("la saison 1 a été redemandée entre-temps : Sonarr la garde, la redemande aussi", async () => {
  // S1 supprimée de Jellyfin ; A (d'avant) la couvrait, B la redemande après.
  liveState.setLibrary([{ key: "e:t:1399:1", present: false, departedAt: LONG_AGO }, { key: "e:t:1399:2", present: true, departedAt: null }]);
  requests = [
    { id: 41, status: 5, createdAt: BEFORE, seasons: [{ seasonNumber: 1 }, { seasonNumber: 2 }] },
    { id: 77, status: 2, createdAt: AFTER, seasons: [{ seasonNumber: 1 }] },
  ];
  requestIndex.seed([indexed(41, 5, [1, 2], BEFORE), indexed(77, 2, [1], AFTER)]);
  await enqueueCleanup(db, { action: "forget", mediaType: "tv", tmdbId: 1399, title: "Série", seerrRequestId: 41, deleteFiles: false, seasons: [1] });
  await processCleanupQueue(db, config);
  assert.ok(calls.includes(`DELETE ${new URL(SEERR).host}/api/v1/request/41`), "la demande d'avant part");
  assert.ok(!calls.some((c) => c.startsWith("PUT sonarr.test")), "Sonarr ne perd pas la saison redemandée");
  assert.deepEqual(requests.map((r) => r.id), [77], "la redemande reste entière");
});

test("Jellyseerr refuse de réduire une demande validée : elle part en entier, Sonarr garde les saisons attendues", async () => {
  // S1 supprimée ; A (validée) couvre S1 à S3 et attend encore S3.
  liveState.setLibrary([{ key: "e:t:1399:1", present: false, departedAt: LONG_AGO }, { key: "e:t:1399:2", present: true, departedAt: null }]);
  requests = [{ id: 41, status: 2, createdAt: BEFORE, seasons: [{ seasonNumber: 1 }, { seasonNumber: 2 }, { seasonNumber: 3 }] }];
  requestIndex.seed([indexed(41, 2, [1, 2, 3], BEFORE)]);
  await enqueueCleanup(db, { action: "forget", mediaType: "tv", tmdbId: 1399, title: "Série", seasons: [1] });
  await processCleanupQueue(db, config);
  assert.ok(calls.includes(`PUT ${new URL(SEERR).host}/api/v1/request/41`));
  assert.deepEqual(requests, [], "supprimée : la saison 1 se redemande");
  const put = net.calls.find((c) => c.method === "PUT" && c.url.includes("sonarr.test"));
  const monitored = (JSON.parse(put?.body ?? "{}") as { seasons: Array<{ seasonNumber: number; monitored: boolean }> }).seasons;
  assert.deepEqual(monitored.map((s) => [s.seasonNumber, s.monitored]), [[1, false], [2, true], [3, true]]);
});

test("une redemande liée à un nettoyage déjà fini ou retiré n'attend pas pour rien", async () => {
  const insert = (id: string, cleanup: string) => db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, pending_cleanup_id, created_at, updated_at)
     VALUES (?, 'u1', 'alice', 'movie', 603, 'Matrix', 'queued', ?, ?, ?)`, id, cleanup, Date.now(), Date.now(),
  );
  const pending = await enqueueCleanup(db, { action: "forget", mediaType: "movie", tmdbId: 603, title: "Matrix", seerrRequestId: 5 });
  await insert("waits", pending);
  await insert("orphan", "un-nettoyage-disparu");
  assert.equal((await getNextQueued(db))?.id, "orphan");
  assert.equal((await getNextQueued(db, ["orphan"]))?.id, undefined, "l'autre attend son nettoyage");
  await db.execute("UPDATE seer_cleanup_queue SET status = 'completed' WHERE id = ?", pending);
  assert.equal((await getNextQueued(db, ["orphan"]))?.id, "waits");
});
