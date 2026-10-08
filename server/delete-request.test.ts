import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { registerRequestRoutes } from "./routes-requests";
import { processCleanupQueue } from "./worker-cleanup";
import { fakeApp, json, stubFetch, type FetchCall } from "./test-support/fake-http";
import { legacyPrisma, type LegacyPrisma } from "./test-support/legacy-prisma";

/*
 * Le comportement de la SUPPRESSION d'une demande, figé avant le portage du
 * stockage (consigne : rien ne change, seul le stockage change).
 *
 * - Seerr est la source : la demande y est supprimée (DELETE /request/:id),
 *   pour qu'on puisse la redemander tout de suite ; la ligne locale suit.
 * - Le média Seerr n'est JAMAIS supprimé (aucun DELETE /api/v1/media).
 * - Sans l'option `deleteFiles`, le contenu reste : Radarr arrête seulement
 *   de surveiller. Avec l'option, les fichiers sont supprimés, comme aujourd'hui.
 * - Seerr en panne : la demande reste « deleting », le nettoyage est rejoué
 *   plus tard ; après le dernier essai, elle passe « delete_failed ».
 */

const SEERR = "http://seerr.test";
const config = { seerrUrl: SEERR, seerrApiKey: "k" };
const owner = { userId: "u1", username: "alice", isAdmin: false };

let prisma: LegacyPrisma;
let net: ReturnType<typeof stubFetch>;
let seerrDeleteStatus: number | "down";

/** Radarr (#77) connu de Seerr, un fichier ; Seerr répond selon le test. */
function rules() {
  return [
    (c: FetchCall) => (c.url === `${SEERR}/api/v1/settings/radarr`
      ? json([{ isDefault: true, hostname: "radarr", port: 7878, apiKey: "r", useSsl: false }]) : null),
    (c: FetchCall) => (c.url === `${SEERR}/api/v1/movie/603` ? json({ mediaInfo: { externalServiceId: 77 } }) : null),
    (c: FetchCall) => (c.url.startsWith("http://radarr:7878/api/v3/queue") ? json({ records: [] }) : null),
    (c: FetchCall) => (c.url === "http://radarr:7878/api/v3/movie/77" ? json({ id: 77, monitored: true }) : null),
    (c: FetchCall) => (c.url === "http://radarr:7878/api/v3/moviefile?movieId=77" ? json([{ id: 5 }]) : null),
    (c: FetchCall) => (c.url === "http://radarr:7878/api/v3/moviefile/5" ? json({}) : null),
    (c: FetchCall) => {
      if (c.method !== "DELETE" || c.url !== `${SEERR}/api/v1/request/42`) return null;
      if (seerrDeleteStatus === "down") throw new TypeError("fetch failed");
      return new Response(null, { status: seerrDeleteStatus });
    },
    (c: FetchCall) => (c.url.includes("/settings/jobs/") ? json({}) : null),
  ];
}

async function seedMovieRequest(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, seerr_request_id, seerr_media_id)
     VALUES ('r1', 'u1', 'alice', 'movie', 603, 'Un film', 'processing', 42, 9)`,
  );
}

async function deleteViaRoute(body: object) {
  const { app, call } = fakeApp();
  registerRequestRoutes(app as never, prisma as never, async () => config);
  return call("DELETE", "/requests/:id", { params: { id: "r1" }, body, user: owner });
}

const rowsOf = (sql: string) => prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
const seen = (method: string, fragment: string) => net.calls.some((c) => c.method === method && c.url.includes(fragment));

beforeEach(async () => {
  prisma = legacyPrisma();
  seerrDeleteStatus = 204;
  net = stubFetch(rules());
  await seedMovieRequest();
});
afterEach(() => {
  net.restore();
  prisma.db.close();
});

test("sans l'option : la demande part de Seerr, la ligne locale suit, le contenu reste", async () => {
  const res = await deleteViaRoute({});
  assert.deepEqual(res.body, { success: true, status: "deleting" });
  assert.equal((await rowsOf(`SELECT status FROM seer_requests`))[0].status, "deleting");
  const [job] = await rowsOf(`SELECT delete_files, request_id, seerr_request_id FROM seer_cleanup_queue`);
  assert.deepEqual({ ...job }, { delete_files: 0, request_id: "r1", seerr_request_id: 42 });

  await processCleanupQueue(prisma as never, config);

  assert.ok(seen("DELETE", "/api/v1/request/42"), "la demande est supprimée dans Seerr");
  assert.ok(seen("PUT", "/api/v3/movie/77"), "Radarr arrête de surveiller");
  assert.ok(!seen("DELETE", "/api/v3/moviefile/"), "aucun fichier supprimé");
  assert.ok(!seen("DELETE", "/api/v1/media/"), "le média Seerr n'est jamais supprimé");
  assert.ok(!seen("DELETE", "/api/v3/movie/77"), "le film reste dans Radarr");
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_requests`), []);
  assert.equal((await rowsOf(`SELECT status FROM seer_cleanup_queue`))[0].status, "completed");
});

test("avec l'option : les fichiers sont supprimés, et la disponibilité se relance", async () => {
  await deleteViaRoute({ deleteFiles: true });
  await processCleanupQueue(prisma as never, config);

  assert.ok(seen("DELETE", "/api/v1/request/42"));
  assert.ok(seen("DELETE", "/api/v3/moviefile/5"), "le fichier est supprimé");
  assert.ok(!seen("DELETE", "/api/v1/media/"), "le média Seerr n'est jamais supprimé");
  assert.ok(!seen("DELETE", "/api/v3/movie/77"), "le film reste dans Radarr");
  assert.ok(seen("POST", "/settings/jobs/availability-sync/run"));
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_requests`), []);
  const syncs = await rowsOf(`SELECT action, status FROM seer_cleanup_queue WHERE action = 'sync'`);
  assert.equal(syncs.length, 2, "deux relances différées de la disponibilité");
});

for (const failure of [500, "down"] as const) {
  test(`Seerr ${failure === "down" ? "injoignable" : "en erreur 500"} : rien n'est perdu, le nettoyage est rejoué`, async () => {
    seerrDeleteStatus = failure;
    await deleteViaRoute({});
    await processCleanupQueue(prisma as never, config);

    const [req] = await rowsOf(`SELECT status FROM seer_requests`);
    assert.equal(req.status, "deleting", "la demande locale reste, en suppression");
    const [job] = await rowsOf(`SELECT status, retry_count, last_error FROM seer_cleanup_queue`);
    assert.equal(job.status, "pending");
    assert.equal(job.retry_count, 1);
    assert.ok(String(job.last_error).length > 0);
    // Plus éligible tout de suite : la reprise attend son délai.
    assert.deepEqual(await rowsOf(`SELECT id FROM seer_cleanup_queue WHERE next_retry_at <= datetime('now')`), []);
  });
}

test("Seerr en panne au dernier essai : la demande passe « delete_failed », elle n'est pas supprimée", async () => {
  seerrDeleteStatus = 500;
  await deleteViaRoute({});
  await prisma.$executeRawUnsafe(`UPDATE seer_cleanup_queue SET retry_count = max_retries - 1`);
  await processCleanupQueue(prisma as never, config);

  const [req] = await rowsOf(`SELECT status, last_error FROM seer_requests`);
  assert.equal(req.status, "delete_failed");
  assert.match(String(req.last_error), /Jellyseerr request delete returned 500/);
  assert.equal((await rowsOf(`SELECT status FROM seer_cleanup_queue`))[0].status, "failed");
});

test("Seerr répond 404 : la demande y était déjà partie, la ligne locale suit", async () => {
  seerrDeleteStatus = 404;
  await deleteViaRoute({});
  await processCleanupQueue(prisma as never, config);
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_requests`), []);
});

test("la demande d'un autre compte ne se supprime pas", async () => {
  const { app, call } = fakeApp();
  registerRequestRoutes(app as never, prisma as never, async () => config);
  const res = await call("DELETE", "/requests/:id", { params: { id: "r1" }, body: {}, user: { ...owner, userId: "u2" } });
  assert.equal(res.status, 403);
  assert.deepEqual(await rowsOf(`SELECT id FROM seer_cleanup_queue`), []);
});
