import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { registerRequestForgetRoute } from "./routes-requests-forget";
import { fakeApp, stubFetch } from "./test-support/fake-http";
import { testDb } from "./test-support/sqlite-storage";
import { MIGRATIONS } from "./storage/migrations";
import type { VigieDb } from "./storage/vigie-db";
import type { TestDatabase } from "./test-support/sqlite";

/*
 * « Retirer » une demande « À vérifier », figé avant le portage du stockage :
 * sa fiche part de Seerr, ses nettoyages *arr en attente sont abandonnés, sa
 * ligne locale disparaît — et rien d'autre n'est touché (ni Sonarr/Radarr, ni
 * le média Seerr). Seerr injoignable : la ligne locale part quand même.
 */

const SEERR = "http://seerr.test";
const config = { seerrUrl: SEERR, seerrApiKey: "k" };
const owner = { userId: "u1", username: "alice", isAdmin: false };

let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;
let seerrDown: boolean;

beforeEach(async () => {
  const t = testDb();
  ({ db, raw } = t);
  await t.storage.migrate(MIGRATIONS);
  seerrDown = false;
  net = stubFetch([(c) => {
    if (seerrDown) throw new TypeError("fetch failed");
    return c.method === "DELETE" && c.url === `${SEERR}/api/v1/request/42` ? new Response(null, { status: 204 }) : null;
  }]);
  await db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, seerr_request_id, created_at, updated_at)
     VALUES ('r1', 'u1', 'alice', 'movie', 603, 'Un film', 'delete_failed', 42, ?, ?)`, Date.now(), Date.now(),
  );
  await db.execute(
    `INSERT INTO seer_cleanup_queue (id, action, media_type, tmdb_id, title, request_id, status, created_at, next_retry_at)
     VALUES ('c1', 'delete', 'movie', 603, 'Un film', 'r1', 'pending', ?, ?)`, Date.now(), Date.now(),
  );
});
afterEach(() => {
  net.restore();
  raw.close();
});

async function forget(user = owner) {
  const { app, call } = fakeApp();
  registerRequestForgetRoute(app as never, db, async () => config);
  return call("POST", "/requests/:id/forget", { params: { id: "r1" }, user });
}

const rowsOf = (sql: string) => db.query(sql);

test("retire la demande de Seerr et d'ici, abandonne le nettoyage, ne touche à rien d'autre", async () => {
  assert.deepEqual((await forget()).body, { success: true });
  assert.deepEqual(net.calls.map((c) => `${c.method} ${c.url}`), [`DELETE ${SEERR}/api/v1/request/42`]);
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_requests`), []);
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_cleanup_queue`), []);
});

test("Seerr injoignable : la ligne locale part quand même", async () => {
  seerrDown = true;
  assert.deepEqual((await forget()).body, { success: true });
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_requests`), []);
});

test("une demande qui n'est pas « À vérifier » ne se retire pas seule", async () => {
  await db.execute(`UPDATE seer_requests SET status = 'processing'`);
  assert.equal((await forget()).status, 409);
  assert.equal(net.calls.length, 0);
  assert.equal((await rowsOf(`SELECT id FROM seer_requests`)).length, 1);
});
