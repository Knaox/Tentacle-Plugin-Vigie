import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { fakeApp, json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { testDb } from "../test-support/sqlite-storage";
import type { TestDatabase } from "../test-support/sqlite";
import type { VigieDb } from "../storage/vigie-db";
import { MIGRATIONS } from "../storage/migrations";
import { submitRequest } from "../request-submit";
import { registerTitleRoutes } from "../routes-titles";
import { registerTitleSeasonRoutes } from "../routes-titles-seasons";
import { registerBulkRoutes } from "../routes-bulk";
import { setContentPolicy, type ContentPolicyBridge } from "./content-gate";
import { RESTRICTED_REFUSAL } from "./refusal";

/*
 * Les portes de Vigie face au contrôle parental du cœur : un compte restreint
 * ne demande pas un titre au-dessus de son âge (hub, cartes du cœur, renvois),
 * et le contrat `titles` ne lui en montre rien. Un compte libre, ou un cœur
 * sans pont, garde le comportement d'avant.
 */

const SEERR = "http://seerr.test";
const config = { seerrUrl: SEERR, seerrApiKey: "k" };
const kid = { userId: "u-kid", username: "kid", isAdmin: false };
const adult = { userId: "u-adult", username: "adult", isAdmin: false };

let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;

/** Le compte « u-kid » ne voit que le film 100 et la série 200. */
const bridge: ContentPolicyBridge = {
  isRestricted: async (userId) => userId === "u-kid",
  filterExternalTitles: async (_u, titles) => titles.filter((t) => t.tmdbId === 100 || t.tmdbId === 200),
  allowsExternalTitle: async (_u, t) => t.tmdbId === 100 || t.tmdbId === 200,
};

function seerr(c: FetchCall) {
  if (!c.url.startsWith(SEERR)) return null;
  const path = new URL(c.url).pathname;
  if (path === "/api/v1/movie/666") return json({ id: 666, title: "Interdit", keywords: [] });
  if (path === "/api/v1/tv/999") return json({ id: 999, name: "Série interdite", seasons: [{ seasonNumber: 1 }] });
  if (path.startsWith("/api/v1/settings")) return json({});
  return null;
}

beforeEach(async () => {
  let storage;
  ({ db, raw, storage } = testDb());
  await storage.migrate(MIGRATIONS);
  net = stubFetch([seerr]);
  setContentPolicy(bridge);
});
afterEach(() => { net.restore(); raw.close(); setContentPolicy(null); });

const countRequests = async () => (await db.query<{ n: number }>("SELECT COUNT(*) AS n FROM seer_requests"))[0].n;
const body = (tmdbId: number) => ({ mediaType: "movie" as const, tmdbId, title: `#${tmdbId}` });

test("le hub : un titre interdit au profil est refusé (403, code clair), rien n'entre dans la file", async () => {
  const res = await submitRequest(db, async () => null, kid, body(666));
  assert.equal(res.status, 403);
  assert.deepEqual(res.body, { ...RESTRICTED_REFUSAL });
  assert.equal(Number(await countRequests()), 0);
});

test("le hub : un titre permis au profil se demande comme avant", async () => {
  const res = await submitRequest(db, async () => null, kid, body(100));
  assert.equal(res.status, 201);
  assert.equal(Number(await countRequests()), 1);
});

test("un compte libre demande ce qu'il veut ; sans pont, le compte restreint aussi (cœur d'avant)", async () => {
  assert.equal((await submitRequest(db, async () => null, adult, body(666))).status, 201);
  setContentPolicy(null);
  assert.equal((await submitRequest(db, async () => null, kid, body(667))).status, 201);
});

test("un pont qui lève refuse la demande (fermé à l'échec)", async () => {
  setContentPolicy({ ...bridge, allowsExternalTitle: async () => { throw new Error("muet"); } });
  assert.equal((await submitRequest(db, async () => null, kid, body(100))).status, 403);
});

test("contrat `titles` : la carte d'un titre interdit n'a ni pastille, ni geste, ni fiche", async () => {
  const { app, call } = fakeApp();
  registerTitleRoutes(app as never, db, async () => config);
  const res = (await call("GET", "/titles/state", { user: kid, query: { keys: "movie:100,movie:666", lang: "fr" } } as never))
    .body as { items: Record<string, { request: unknown; page?: unknown; badge: unknown }> };
  assert.deepEqual(res.items["movie:666"], { badge: null, request: null });
  assert.equal((res.items["movie:100"].request as { mode: string }).mode, "direct");
  assert.ok(res.items["movie:100"].page);
});

test("contrat `titles` : demander un titre interdit répond une phrase, sans toucher Jellyseerr", async () => {
  const { app, call } = fakeApp();
  registerTitleRoutes(app as never, db, async () => config);
  const before = net.calls.length;
  for (const mediaType of ["movie", "tv"]) {
    const res = (await call("POST", "/titles/request", { user: kid, body: { mediaType, tmdbId: 666, lang: "fr" } })).body as { ok: boolean; message: string };
    assert.deepEqual(res, { ok: false, message: "Ce titre n'est pas disponible pour ce profil." });
  }
  assert.equal(net.calls.length, before);
});

test("contrat `titles.seasons` : une série interdite n'a aucune saison", async () => {
  const { app, call } = fakeApp();
  registerTitleSeasonRoutes(app as never, db, async () => config);
  const res = (await call("GET", "/titles/seasons", { user: kid, query: { key: "tv:999", lang: "en" } } as never)).body as { ok: boolean; seasons: unknown[] };
  assert.deepEqual(res, { ok: false, message: "This title isn't available for this profile.", seasons: [] });
});

test("un renvoi groupé ne renvoie pas un titre devenu interdit", async () => {
  const now = Date.now();
  await db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, created_at, updated_at)
     VALUES ('r1', 'u-kid', 'kid', 'movie', 666, 'Interdit', 'failed', ?, ?)`, now, now,
  );
  const { app, call } = fakeApp();
  registerBulkRoutes(app as never, db, async () => null);
  const res = (await call("POST", "/requests/bulk-retry", { user: kid, body: { ids: ["r1"] } })).body as { retried: number; errors: number };
  assert.deepEqual({ retried: res.retried, errors: res.errors }, { retried: 0, errors: 1 });
  assert.deepEqual((await db.query<{ id: string }>("SELECT id FROM seer_requests")).map((r) => r.id), ["r1"]);
});
