import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "./test-support/fake-http";
import { testDb } from "./test-support/sqlite-storage";
import type { TestDatabase } from "./test-support/sqlite";
import type { VigieDb } from "./storage/vigie-db";
import { MIGRATIONS } from "./storage/migrations";
import { invalidateRequestCaches } from "./cache";
import { registerAllRequestsRoutes } from "./routes-requests-all";

/*
 * « Tous les comptes » : l'administrateur voit les demandes de chacun — qui
 * l'a faite, où elle en est —, les cherche par titre ou par compte. Un compte
 * ordinaire n'y a pas accès, côté serveur.
 */

const SEERR = "http://seerr.test";
const config = { seerrUrl: SEERR, seerrApiKey: "k" };
const admin = { userId: "u-admin", username: "admin", isAdmin: true };
const member = { userId: "u-alice", username: "alice", isAdmin: false };

let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;

const TITLES: Record<string, Record<string, unknown>> = {
  "/api/v1/movie/603": { id: 603, title: "Matrix" },
  "/api/v1/tv/1399": { id: 1399, name: "Game of Thrones" },
  "/api/v1/movie/550": { id: 550, title: "Fight Club" },
};

function seerr(c: FetchCall) {
  if (!c.url.startsWith(SEERR)) return null;
  const url = new URL(c.url);
  if (url.pathname === "/api/v1/request") {
    const results = [
      { id: 1, status: 2, createdAt: "2026-10-03T10:00:00.000Z", media: { id: 11, tmdbId: 603, mediaType: "movie", status: 3 }, requestedBy: { id: 1, jellyfinUserId: "u-alice", jellyfinUsername: "alice" } },
      { id: 2, status: 5, createdAt: "2026-10-02T10:00:00.000Z", media: { id: 12, tmdbId: 1399, mediaType: "tv", status: 5 }, seasons: [{ seasonNumber: 1 }], requestedBy: { id: 2, displayName: "Bob" } },
      { id: 3, status: 1, createdAt: "2026-10-01T10:00:00.000Z", media: { id: 13, tmdbId: 550, mediaType: "movie", status: 2 }, requestedBy: { id: 3, displayName: "Carol" } },
    ];
    return json({ pageInfo: { results: results.length }, results });
  }
  if (TITLES[url.pathname]) return json(TITLES[url.pathname]);
  if (url.pathname.startsWith("/api/v1/settings/")) return json([]);
  return json({});
}

/** Un faux Fastify qui joue la garde (`preHandler`) comme le vrai. */
function adminApp() {
  const routes = new Map<string, { pre?: (req: unknown, rep: unknown) => Promise<void>; handler: (req: unknown, rep: unknown) => unknown }>();
  const add = (method: string) => (path: string, opts: { preHandler?: never }, handler: never) => {
    routes.set(`${method} ${path}`, { pre: opts.preHandler, handler });
  };
  const app = { get: add("GET"), log: { warn: () => {} } };
  async function call(path: string, user: object, query: object = {}) {
    const route = routes.get(`GET ${path}`)!;
    const rep = { statusCode: 200, sent: false, payload: undefined as unknown,
      code(c: number) { rep.statusCode = c; return rep; }, status(c: number) { rep.statusCode = c; return rep; },
      send(p: unknown) { rep.payload = p; rep.sent = true; return rep; } };
    const req = { params: {}, query, headers: {}, user };
    await route.pre?.(req, rep);
    if (rep.sent) return { status: rep.statusCode, body: rep.payload as Record<string, unknown> };
    return { status: rep.statusCode, body: (await route.handler(req, rep)) as Record<string, unknown> };
  }
  return { app, call };
}

const requireAdmin = async (req: unknown, rep: unknown) => {
  const user = (req as { user: { isAdmin: boolean } }).user;
  if (!user.isAdmin) (rep as { code(c: number): { send(p: unknown): void } }).code(403).send({ error: "admin only" });
};

beforeEach(async () => {
  let storage;
  ({ db, raw, storage } = testDb());
  await storage.migrate(MIGRATIONS);
  invalidateRequestCaches();
  const now = Date.now();
  await db.execute(
    `INSERT INTO seer_user_settings (jellyfin_user_id, username, jellyseerr_user_id, created_at, updated_at) VALUES ('u-alice', 'alice', 1, ?, ?), ('u-bob', 'bob', 2, ?, ?)`,
    now, now, now, now,
  );
  // Une demande de Dave pas encore partie vers Jellyseerr.
  await db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, created_at, updated_at)
     VALUES ('q1', 'u-dave', 'dave', 'movie', 27205, 'Inception', 'queued', ?, ?)`, now, now,
  );
  net = stubFetch([seerr]);
});
afterEach(() => { net.restore(); raw.close(); });

function register() {
  const { app, call } = adminApp();
  registerAllRequestsRoutes(app as never, db, async () => config, requireAdmin);
  return call;
}

test("un compte ordinaire n'a pas accès à la liste de tous les comptes", async () => {
  const call = register();
  const res = await call("/admin/requests", member);
  assert.equal(res.status, 403);
});

test("l'administrateur voit les demandes de chacun, avec son demandeur", async () => {
  const call = register();
  const res = await call("/admin/requests", admin, { page: "1", limit: "50" });
  const rows = (res.body.results as Array<{ title: string; username: string; status: string }>).map((r) => [r.title, r.username]);
  assert.equal(res.body.total, 4);
  assert.deepEqual(new Map(rows as Array<[string, string]>), new Map([
    ["Inception", "dave"], ["Matrix", "alice"], ["Game of Thrones", "bob"], ["Fight Club", "Carol"],
  ]));
  // Les compteurs sont ceux de TOUS les comptes.
  assert.equal((res.body.stats as { total: number }).total, 4);
});

test("la recherche porte sur le titre ou sur le compte", async () => {
  const call = register();
  // Comme l'interface : la liste se charge (et ses fiches avec) avant qu'on cherche.
  await call("/admin/requests", admin, { limit: "50" });
  const byName = await call("/admin/requests", admin, { q: "bob", limit: "50" });
  assert.deepEqual((byName.body.results as Array<{ title: string }>).map((r) => r.title), ["Game of Thrones"]);
  const byTitle = await call("/admin/requests", admin, { q: "matr", limit: "50" });
  assert.deepEqual((byTitle.body.results as Array<{ username: string }>).map((r) => r.username), ["alice"]);
});

test("l'avancement de tous les comptes répond, sans erreur", async () => {
  const call = register();
  const res = await call("/admin/requests/progress", admin);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.items));
  assert.equal((await call("/admin/requests/progress", member)).status, 403);
});
