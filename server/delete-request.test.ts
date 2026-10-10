import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { registerRequestRoutes } from "./routes-requests";
import { processCleanupQueue } from "./worker-cleanup";
import { fakeApp, json, stubFetch, type FetchCall } from "./test-support/fake-http";
import { testDb } from "./test-support/sqlite-storage";
import { MIGRATIONS } from "./storage/migrations";
import type { VigieDb } from "./storage/vigie-db";
import type { TestDatabase } from "./test-support/sqlite";

/*
 * Le comportement de la SUPPRESSION d'une demande, figé AVANT le portage du
 * stockage et rejoué APRÈS, à l'identique (consigne : seul le stockage change).
 * La base est celle des migrations de Vigie, sur une vraie SQLite.
 *
 * - Seerr est la source : la demande y est supprimée (DELETE /request/:id),
 *   pour qu'on puisse la redemander tout de suite ; la ligne locale suit.
 * - Le média Seerr n'est remis à zéro (DELETE /api/v1/media) que pour un titre
 *   que Jellyfin n'a plus du tout (seerr-media.ts) — jamais ici.
 * - Le film est retiré de Radarr (règle du 2026-10-10, cleanup-arr.ts) : sans
 *   l'option `deleteFiles`, ses fichiers restent ; avec, ils partent avec lui.
 * - Seerr en panne : la demande reste « deleting », le nettoyage est rejoué
 *   plus tard ; après le dernier essai, elle passe « delete_failed ».
 */

const SEERR = "http://seerr.test";
const config = { seerrUrl: SEERR, seerrApiKey: "k", interval: 60_000, syncEvery: 2 };
const owner = { userId: "u1", username: "alice", isAdmin: false };

let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;
let seerrDeleteStatus: number | "down";

/** Radarr (#77) connu de Seerr, un fichier ; Seerr répond selon le test. */
function rules() {
  return [
    (c: FetchCall) => (c.url === `${SEERR}/api/v1/settings/radarr`
      ? json([{ isDefault: true, hostname: "radarr", port: 7878, apiKey: "r", useSsl: false }]) : null),
    (c: FetchCall) => (c.url === `${SEERR}/api/v1/movie/603`
      ? json({ mediaInfo: { id: 9, status: 5, externalServiceId: 77, requests: [{ id: 42, status: 5 }] } }) : null),
    (c: FetchCall) => (c.url.startsWith("http://radarr:7878/api/v3/queue") ? json({ records: [] }) : null),
    (c: FetchCall) => (c.method === "DELETE" && c.url.startsWith("http://radarr:7878/api/v3/movie/77?")
      ? new Response(null, { status: 200 }) : null),
    (c: FetchCall) => {
      if (c.method !== "DELETE" || c.url !== `${SEERR}/api/v1/request/42`) return null;
      if (seerrDeleteStatus === "down") throw new TypeError("fetch failed");
      return new Response(null, { status: seerrDeleteStatus });
    },
    (c: FetchCall) => (c.url.includes("/settings/jobs/") ? json({}) : null),
  ];
}

async function seedMovieRequest(): Promise<void> {
  await db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, seerr_request_id, seerr_media_id, created_at, updated_at)
     VALUES ('r1', 'u1', 'alice', 'movie', 603, 'Un film', 'processing', 42, 9, ?, ?)`, Date.now(), Date.now(),
  );
}

async function deleteViaRoute(body: object) {
  const { app, call } = fakeApp();
  registerRequestRoutes(app as never, db, async () => config);
  return call("DELETE", "/requests/:id", { params: { id: "r1" }, body, user: owner });
}

const rowsOf = (sql: string) => db.query(sql);
const seen = (method: string, fragment: string) => net.calls.some((c) => c.method === method && c.url.includes(fragment));

beforeEach(async () => {
  const t = testDb();
  ({ db, raw } = t);
  await t.storage.migrate(MIGRATIONS);
  seerrDeleteStatus = 204;
  net = stubFetch(rules());
  await seedMovieRequest();
});
afterEach(() => {
  net.restore();
  raw.close();
});

test("sans l'option : la demande part de Seerr, la ligne locale suit, le contenu reste", async () => {
  const res = await deleteViaRoute({});
  assert.deepEqual(res.body, { success: true, status: "deleting" });
  assert.equal((await rowsOf(`SELECT status FROM seer_requests`))[0].status, "deleting");
  const [job] = await rowsOf(`SELECT delete_files, request_id, seerr_request_id FROM seer_cleanup_queue`);
  assert.deepEqual({ ...job }, { delete_files: 0, request_id: "r1", seerr_request_id: 42 });

  await processCleanupQueue(db, config);

  assert.ok(seen("DELETE", "/api/v1/request/42"), "la demande est supprimée dans Seerr");
  assert.ok(seen("DELETE", "/api/v3/movie/77?deleteFiles=false"), "le film est retiré de Radarr, ses fichiers gardés");
  assert.ok(!seen("DELETE", "/api/v3/moviefile/"), "aucun fichier supprimé");
  assert.ok(!seen("DELETE", "/api/v1/media/"), "le titre est encore dans Jellyfin : le média Seerr reste");
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_requests`), []);
  assert.equal((await rowsOf(`SELECT status FROM seer_cleanup_queue`))[0].status, "completed");
});

test("avec l'option : les fichiers sont supprimés, et la disponibilité se relance", async () => {
  await deleteViaRoute({ deleteFiles: true });
  await processCleanupQueue(db, config);

  assert.ok(seen("DELETE", "/api/v1/request/42"));
  assert.ok(seen("DELETE", "/api/v3/movie/77?deleteFiles=true"), "le film est retiré de Radarr avec ses fichiers");
  assert.ok(!seen("DELETE", "/api/v1/media/"), "Jellyfin ne l'a pas encore vu partir : le média Seerr reste");
  assert.ok(seen("POST", "/settings/jobs/availability-sync/run"));
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_requests`), []);
  const syncs = await rowsOf(`SELECT action, status FROM seer_cleanup_queue WHERE action = 'sync'`);
  assert.equal(syncs.length, 2, "deux relances différées de la disponibilité");
});

for (const failure of [500, "down"] as const) {
  test(`Seerr ${failure === "down" ? "injoignable" : "en erreur 500"} : rien n'est perdu, le nettoyage est rejoué`, async () => {
    seerrDeleteStatus = failure;
    await deleteViaRoute({});
    await processCleanupQueue(db, config);

    const [req] = await rowsOf(`SELECT status FROM seer_requests`);
    assert.equal(req.status, "deleting", "la demande locale reste, en suppression");
    const [job] = await rowsOf(`SELECT status, retry_count, last_error FROM seer_cleanup_queue`);
    assert.equal(job.status, "pending");
    assert.equal(job.retry_count, 1);
    assert.ok(String(job.last_error).length > 0);
    // Plus éligible tout de suite : la reprise attend son délai.
    assert.deepEqual(await rowsOf(`SELECT id FROM seer_cleanup_queue WHERE next_retry_at <= CAST(unixepoch('subsec') * 1000 AS INTEGER)`), []);
  });
}

test("Seerr en panne au dernier essai : la demande passe « delete_failed », elle n'est pas supprimée", async () => {
  seerrDeleteStatus = 500;
  await deleteViaRoute({});
  await db.execute(`UPDATE seer_cleanup_queue SET retry_count = max_retries - 1`);
  await processCleanupQueue(db, config);

  const [req] = await rowsOf(`SELECT status, last_error FROM seer_requests`);
  assert.equal(req.status, "delete_failed");
  assert.match(String(req.last_error), /Jellyseerr request delete returned 500/);
  assert.equal((await rowsOf(`SELECT status FROM seer_cleanup_queue`))[0].status, "failed");
});

test("Seerr répond 404 : la demande y était déjà partie, la ligne locale suit", async () => {
  seerrDeleteStatus = 404;
  await deleteViaRoute({});
  await processCleanupQueue(db, config);
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_requests`), []);
});

test("la demande d'un autre compte ne se supprime pas", async () => {
  const { app, call } = fakeApp();
  registerRequestRoutes(app as never, db, async () => config);
  const res = await call("DELETE", "/requests/:id", { params: { id: "r1" }, body: {}, user: { ...owner, userId: "u2" } });
  assert.equal(res.status, 403);
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_cleanup_queue`), []);
});
