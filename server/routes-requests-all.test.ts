import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "./test-support/fake-http";
import type { PrismaClient } from "@prisma/client";
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

/** Le cache des fiches TMDB, déjà chaud (ligne 1.24 : la base est simulée). */
const TMDB_ROWS = [
  { media_type: "movie", tmdb_id: 603, title: "Matrix" },
  { media_type: "tv", tmdb_id: 1399, title: "Game of Thrones" },
  { media_type: "movie", tmdb_id: 550, title: "Fight Club" },
  { media_type: "movie", tmdb_id: 27205, title: "Inception" },
].map((r) => ({ ...r, poster_path: null, backdrop_path: null, overview: null, release_date: null, provider_ids: "", is_anime: 0,
  expires_at: new Date(Date.now() + 86_400_000), fetched_at: new Date() }));

/** Le client Prisma, réduit à ce que la liste lui demande (MariaDB simulée). */
const db = {
  async $queryRawUnsafe(sql: string, ...params: unknown[]) {
    if (/FROM seer_user_settings/.test(sql)) {
      return [{ jellyfin_user_id: "u-alice", username: "alice", jellyseerr_user_id: 1 }, { jellyfin_user_id: "u-bob", username: "bob", jellyseerr_user_id: 2 }];
    }
    if (/FROM seer_requests\s+WHERE status IN/.test(sql)) {
      // Une demande de Dave pas encore partie vers Jellyseerr.
      return [{ id: "q1", jellyfin_user_id: "u-dave", username: "dave", media_type: "movie", tmdb_id: 27205, title: "Inception",
        status: "queued", seasons: null, created_at: new Date(), updated_at: new Date() }];
    }
    if (/FROM seer_tmdb_cache/.test(sql)) return TMDB_ROWS.filter((r) => r.media_type === params[0] && params.slice(1).includes(r.tmdb_id));
    return [];
  },
  async $executeRawUnsafe() { return 0; },
} as unknown as PrismaClient;

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

beforeEach(() => {
  invalidateRequestCaches();
  net = stubFetch([seerr]);
});
afterEach(() => net.restore());

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
