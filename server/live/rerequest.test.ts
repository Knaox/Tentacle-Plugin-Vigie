import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { testDb, type Notification } from "../test-support/sqlite-storage";
import type { TestDatabase } from "../test-support/sqlite";
import type { VigieDb } from "../storage/vigie-db";
import { MIGRATIONS } from "../storage/migrations";
import { findExistingTvRequest, getNextQueued } from "../db";
import { processNextRequest } from "../worker-send";
import { syncStatuses } from "../worker-sync";
import { liveState } from "./live-state";
import { requestIndex } from "./request-index";
import { deferredRequestIds, resetUnblock, staleSeasons } from "./seerr-unblock";

/*
 * Redemander ce qui a été supprimé de Jellyfin : la file ne le bloque plus,
 * Jellyseerr — qui le croit encore là — est débloqué, et rien ne s'annonce
 * « disponible » à tort.
 */

const SEERR = "http://seerr.test";
const config = { seerrUrl: SEERR, seerrApiKey: "k", interval: 60_000, syncEvery: 2 };
const LONG_AGO = Date.now() - 3_600_000;

let db: VigieDb;
let raw: TestDatabase;
let notifications: Notification[];
let net: ReturnType<typeof stubFetch>;
let seerrMedia: { id: number; status: number; seasons: Array<{ seasonNumber: number; status: number }>; requests: Array<{ id: number; status: number; seasons?: Array<{ seasonNumber: number }> }> } | null;
let posted: unknown[];

function seerr(c: FetchCall) {
  if (!c.url.startsWith(SEERR)) return null;
  const url = new URL(c.url);
  if (c.method === "GET" && url.pathname === "/api/v1/tv/1399") {
    return json({ id: 1399, name: "Série", keywords: [], mediaInfo: seerrMedia ?? undefined });
  }
  if (c.method === "DELETE" && url.pathname === "/api/v1/media/77") {
    seerrMedia = null;
    return new Response(null, { status: 204 });
  }
  if (c.method === "POST" && url.pathname === "/api/v1/request") {
    posted.push(JSON.parse(c.body ?? "{}"));
    // Jellyseerr refuse ce qu'il croit encore là.
    if (seerrMedia?.seasons.some((s) => s.status === 5)) return new Response(JSON.stringify({ message: "No seasons available to request" }), { status: 202 });
    return json({ id: 500, status: 2, media: { id: 78, status: 3 } }, 201);
  }
  if (url.pathname.startsWith("/api/v1/settings/jobs/")) return json({});
  if (url.pathname === "/api/v1/user") return json({ results: [{ id: 1, jellyfinUserId: "u1" }], pageInfo: { results: 1 } });
  if (url.pathname.startsWith("/api/v1/settings")) return json([]);
  return null;
}

beforeEach(async () => {
  let storage;
  ({ db, raw, storage, notifications } = testDb());
  await storage.migrate(MIGRATIONS);
  liveState.reset();
  requestIndex.reset();
  resetUnblock();
  posted = [];
  net = stubFetch([seerr]);
  // La série 1399 a été supprimée de Jellyfin il y a une heure ; Jellyseerr la croit toujours là.
  liveState.setLibrary([{ key: "e:t:1399:1", present: false, departedAt: LONG_AGO }, { key: "e:t:1399:2", present: false, departedAt: LONG_AGO }]);
  requestIndex.seed([]); // plus aucune demande chez Jellyseerr
  seerrMedia = { id: 77, status: 5, seasons: [{ seasonNumber: 1, status: 5 }, { seasonNumber: 2, status: 5 }], requests: [] };
  await db.execute(
    `INSERT INTO seer_user_settings (jellyfin_user_id, username, jellyseerr_user_id, created_at, updated_at) VALUES ('u1', 'alice', 1, ?, ?)`,
    Date.now(), Date.now(),
  );
});
afterEach(() => { net.restore(); raw.close(); });

async function queue(id: string, seasons: number[], createdAt = Date.now()) {
  await db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, seasons, status, created_at, updated_at)
     VALUES (?, 'u1', 'alice', 'tv', 1399, 'Série', ?, 'queued', ?, ?)`, id, JSON.stringify(seasons), createdAt, createdAt,
  );
}

test("une ancienne demande « disponible » ne bloque plus la même saison redemandée", async () => {
  await db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, seasons, status, created_at, updated_at)
     VALUES ('old', 'u1', 'alice', 'tv', 1399, 'Série', '[1]', 'available', ?, ?)`, Date.now(), Date.now(),
  );
  assert.equal(await findExistingTvRequest(db, "u1", 1399), null);
});

test("série supprimée en entier, sans demande : la fiche périmée de Jellyseerr part, la demande aussi", async () => {
  await queue("q1", [1, 2]);
  assert.deepEqual(staleSeasons({ mediaType: "tv", tmdbId: 1399, seasons: [1, 2] }, { keywords: [], mediaInfo: seerrMedia! }), [1, 2]);
  await processNextRequest(db, config, new Set());
  assert.equal(posted.length, 1, "envoyée après le retrait de la fiche périmée");
  const [{ status, seerr_request_id }] = await db.query<{ status: string; seerr_request_id: number }>("SELECT status, seerr_request_id FROM seer_requests WHERE id = 'q1'");
  assert.equal(status, "sent_to_seer");
  assert.equal(seerr_request_id, 500);
  assert.equal(notifications.length, 0, "rien ne s'annonce");
});

test("une autre demande vise encore la série : on attend Jellyseerr, sans bloquer la file", async () => {
  seerrMedia!.requests = [{ id: 9, status: 2, seasons: [{ seasonNumber: 3 }] }];
  await queue("q1", [1], Date.now() - 1000);
  await queue("q2", [1], Date.now());
  await processNextRequest(db, config, new Set());
  assert.equal(posted.length, 0);
  assert.deepEqual(deferredRequestIds(), ["q1"]);
  const [{ status }] = await db.query<{ status: string }>("SELECT status FROM seer_requests WHERE id = 'q1'");
  assert.equal(status, "queued", "elle reste en file");
  // La suivante passe devant au lieu d'attendre derrière elle.
  const next = await getNextQueued(db, deferredRequestIds());
  assert.equal(next?.id, "q2");
  assert.ok(net.calls.some((c) => c.url.endsWith("/settings/jobs/availability-sync/run")), "Jellyseerr revérifie");
});

test("la synchro ne déclare pas « disponible » un titre supprimé de Jellyfin", async () => {
  liveState.setLibrary([{ key: "m:t:603", present: false, departedAt: LONG_AGO }]);
  requestIndex.seed([]);
  await db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, seerr_request_id, created_at, updated_at)
     VALUES ('r1', 'u1', 'alice', 'movie', 603, 'Matrix', 'approved', 41, ?, ?)`, Date.now(), Date.now(),
  );
  net.restore();
  net = stubFetch([(c) => (c.url === `${SEERR}/api/v1/request/41`
    ? json({ id: 41, status: 2, seasons: [], media: { id: 9, status: 5, downloadStatus: [] } })
    : c.url.startsWith(SEERR) ? json({}) : null)]);
  await syncStatuses(db, config);
  const [{ status }] = await db.query<{ status: string }>("SELECT status FROM seer_requests WHERE id = 'r1'");
  assert.equal(status, "approved");
  assert.equal(notifications.length, 0);
});
