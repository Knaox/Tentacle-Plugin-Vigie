import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { fakeApp, json, stubFetch, type FetchCall } from "./test-support/fake-http";
import { testDb } from "./test-support/sqlite-storage";
import type { TestDatabase } from "./test-support/sqlite";
import type { VigieDb } from "./storage/vigie-db";
import { MIGRATIONS } from "./storage/migrations";
import { registerBulkRoutes } from "./routes-bulk";

/*
 * Supprimer plusieurs demandes d'un coup — dont celles nées dans Jellyseerr,
 * sans ligne locale (« seerr-<id> ») : elles tombaient toutes en erreur.
 */

const SEERR = "http://seerr.test";
const config = { seerrUrl: SEERR, seerrApiKey: "k" };
const admin = { userId: "u-admin", username: "admin", isAdmin: true };
const alice = { userId: "u-alice", username: "alice", isAdmin: false };

let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;

function seerr(c: FetchCall) {
  if (c.url === `${SEERR}/api/v1/request/7`) {
    return json({ id: 7, status: 5, media: { id: 70, tmdbId: 603, mediaType: "movie" }, requestedBy: { id: 2 } });
  }
  return null;
}

beforeEach(async () => {
  let storage;
  ({ db, raw, storage } = testDb());
  await storage.migrate(MIGRATIONS);
  const now = Date.now();
  await db.execute(
    `INSERT INTO seer_user_settings (jellyfin_user_id, username, jellyseerr_user_id, created_at, updated_at) VALUES ('u-alice', 'alice', 1, ?, ?)`, now, now,
  );
  await db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, seerr_request_id, created_at, updated_at)
     VALUES ('r1', 'u-alice', 'alice', 'movie', 550, 'Fight Club', 'approved', 8, ?, ?)`, now, now,
  );
  net = stubFetch([seerr]);
});
afterEach(() => { net.restore(); raw.close(); });

async function bulkDelete(user: object, ids: string[]) {
  const { app, call } = fakeApp();
  registerBulkRoutes(app as never, db, async () => config);
  return (await call("POST", "/requests/bulk-delete", { body: { ids }, user })).body as { deleted: number; errors: number };
}

test("l'administrateur supprime d'un coup une demande locale et une demande née dans Jellyseerr", async () => {
  const res = await bulkDelete(admin, ["r1", "seerr-7"]);
  assert.deepEqual({ deleted: res.deleted, errors: res.errors }, { deleted: 2, errors: 0 });
  const jobs = await db.query<{ seerr_request_id: number; tmdb_id: number }>(
    "SELECT seerr_request_id, tmdb_id FROM seer_cleanup_queue ORDER BY seerr_request_id",
  );
  assert.deepEqual(jobs.map((j) => [Number(j.seerr_request_id), Number(j.tmdb_id)]), [[7, 603], [8, 550]]);
});

test("un compte ordinaire ne supprime pas la demande Jellyseerr d'un autre", async () => {
  const res = await bulkDelete(alice, ["seerr-7"]);
  assert.deepEqual({ deleted: res.deleted, errors: res.errors }, { deleted: 0, errors: 1 });
  assert.deepEqual(await db.query("SELECT id FROM seer_cleanup_queue"), []);
});
