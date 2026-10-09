import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { testDb } from "../test-support/sqlite-storage";
import type { TestDatabase } from "../test-support/sqlite";
import type { VigieDb } from "../storage/vigie-db";
import { MIGRATIONS } from "../storage/migrations";
import { forgetJellyfinAccounts } from "../jellyfin-users";
import { normalizeConfig } from "../plugin-config";
import { liveState } from "./live-state";
import { requestIndex } from "./request-index";
import type { IndexedRequest } from "./request-index-model";
import type { Departure } from "./library-keys";
import { createAutoForget, forgetOptionsOf } from "./auto-forget";
import { FORGET_GRACE_MS, MASS_TITLES, forgetCandidates, planJobs } from "./auto-forget-plan";
import { REQUEST } from "./title-truth";

/*
 * « Supprimer la demande avec le titre » (option, désactivée d'office) :
 * supprimer est irréversible, chaque garde est éprouvée — l'activation,
 * le délai de grâce, Jellyfin redemandé, la vague de départs.
 */

const JELLYFIN = "http://jellyfin.test";
const cfg = { seerrUrl: "http://seerr.test", seerrApiKey: "k" };
const indexed = (id: number, tmdbId: number, status: number, seasons: number[] = [], mediaType: "movie" | "tv" = "movie"): IndexedRequest => ({
  id, status, is4k: false, mediaType, tmdbId, seasons,
  requestedBy: { seerrUserId: 1, jellyfinUserId: "u1", name: "Alice" }, createdAt: null, updatedAt: null, mediaStatus: 5,
});
const movieDeparture = (tmdbId: number, at: number): Departure => ({ mediaType: "movie", tmdbId, at, seasons: [], whole: true });

test("l'option : désactivée d'office, l'instant d'activation posé par le serveur, gardé ensuite", () => {
  assert.equal(normalizeConfig({}).deleteRequestsWithMedia, false);
  assert.equal(normalizeConfig({}).deleteRequestsWithMediaSince, null);
  const before = Date.now();
  const on = normalizeConfig({ deleteRequestsWithMedia: true, deleteRequestsWithMediaSince: 1 });
  assert.ok((on.deleteRequestsWithMediaSince as number) >= before, "le client ne choisit pas l'instant");
  const again = normalizeConfig({ deleteRequestsWithMedia: true }, on);
  assert.equal(again.deleteRequestsWithMediaSince, on.deleteRequestsWithMediaSince, "un autre réglage ne le déplace pas");
  assert.equal(normalizeConfig({ deleteRequestsWithMedia: false }, on).deleteRequestsWithMediaSince, null);
  assert.deepEqual(forgetOptionsOf({ deleteRequestsWithMedia: true, deleteRequestsWithMediaSince: 5 }), { enabled: true, since: 5 });
});

test("les candidats : après l'activation, après la grâce, jamais en vague", () => {
  const now = 10_000_000;
  const options = { enabled: true, since: now - 3_600_000 };
  const before = movieDeparture(1, now - 7_200_000); // parti avant l'activation
  const fresh = movieDeparture(2, now - 60_000); // dans la grâce
  const ready = movieDeparture(3, now - FORGET_GRACE_MS - 1);
  assert.deepEqual(forgetCandidates({ departures: [before, fresh, ready], options, now }), { kind: "ready", departures: [ready] });
  assert.deepEqual(forgetCandidates({ departures: [ready], options: { enabled: false, since: 1 }, now }), { kind: "none" });
  const wave = Array.from({ length: MASS_TITLES + 1 }, (_, i) => movieDeparture(100 + i, now - FORGET_GRACE_MS - 1));
  assert.deepEqual(forgetCandidates({ departures: wave, options, now }), { kind: "mass", count: MASS_TITLES + 1 });
});

test("ce que devient chaque demande d'un titre parti", () => {
  const base = { localId: null, jellyfinUserId: "u1" };
  // Film : toutes ses demandes vivantes partent ; refusées et 4K restent.
  assert.deepEqual(planJobs(movieDeparture(603, 1), [
    { ...base, seerrRequestId: 1, status: REQUEST.COMPLETED, seasons: [] },
    { ...base, seerrRequestId: 2, status: REQUEST.DECLINED, seasons: [] },
    { ...base, seerrRequestId: 3, status: REQUEST.APPROVED, seasons: [], is4k: true },
  ]).map((j) => j.seerrRequestId), [1]);
  // Série : saison 2 partie, saison 1 encore là.
  const dep: Departure = { mediaType: "tv", tmdbId: 1399, at: 1, seasons: [2], whole: false };
  const jobs = planJobs(dep, [
    { ...base, seerrRequestId: 10, status: REQUEST.APPROVED, seasons: [2] }, // ne couvrait qu'elle : part
    { ...base, seerrRequestId: 11, status: REQUEST.COMPLETED, seasons: [1, 2] }, // terminée : part
    { ...base, seerrRequestId: 12, status: REQUEST.APPROVED, seasons: [2, 3] }, // attend la 3 : garde-la
    { ...base, seerrRequestId: 13, status: REQUEST.APPROVED, seasons: [4] }, // pas concernée
  ]);
  assert.deepEqual(jobs.map((j) => [j.seerrRequestId, j.seasons, j.whole]), [
    [10, [2], true],
    [11, [2], true], // Sonarr ne cesse de surveiller QUE la saison partie
    [null, [2], false],
  ]);
});

let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;
let jellyfinHas: Set<number>;
let config: Record<string, unknown>;

function jellyfin(c: FetchCall) {
  if (!c.url.startsWith(JELLYFIN)) return null;
  const url = new URL(c.url);
  if (url.pathname === "/Users") return json([{ Id: "admin1", Name: "admin", Policy: { IsAdministrator: true } }]);
  if (url.pathname === "/Users/admin1/Items") {
    const id = Number(/^Tmdb\.(\d+)$/i.exec(url.searchParams.get("AnyProviderIdEquals") ?? "")?.[1]);
    const items = jellyfinHas.has(id) ? [{ Id: `j${id}`, Type: "Movie", ProviderIds: { Tmdb: String(id) } }] : [];
    return json({ Items: items, TotalRecordCount: items.length });
  }
  return null;
}

beforeEach(async () => {
  let storage;
  ({ db, raw, storage } = testDb());
  await storage.migrate(MIGRATIONS);
  raw.exec(`CREATE TABLE server_config ("key" TEXT PRIMARY KEY, "value" TEXT)`);
  raw.prepare(`INSERT INTO server_config ("key", "value") VALUES ('jellyfin_url', ?), ('jellyfin_api_key', 'jk')`).run(JELLYFIN);
  forgetJellyfinAccounts();
  liveState.reset();
  requestIndex.reset();
  jellyfinHas = new Set();
  net = stubFetch([jellyfin, (c) => (c.url.includes("/settings/") ? json([]) : null)]);
  config = { deleteRequestsWithMedia: true, deleteRequestsWithMediaSince: Date.now() - 3_600_000 };
});
afterEach(() => { net.restore(); raw.close(); });

async function cleanupJobs() {
  return db.query<{ seerr_request_id: number | null; request_id: string | null; delete_files: number }>(
    "SELECT seerr_request_id, request_id, delete_files FROM seer_cleanup_queue ORDER BY seerr_request_id",
  );
}

test("parti depuis plus de dix minutes, absent de Jellyfin : la demande part, sans toucher aux fichiers", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  requestIndex.seed([indexed(1, 603, REQUEST.COMPLETED)]);
  await db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, seerr_request_id, created_at, updated_at)
     VALUES ('r1', 'u1', 'alice', 'movie', 603, 'Matrix', 'available', 1, ?, ?)`, Date.now(), Date.now(),
  );
  await createAutoForget(db, () => config)(cfg, Date.now());
  assert.deepEqual(await cleanupJobs(), [{ seerr_request_id: 1, request_id: "r1", delete_files: 0 }]);
  const [{ status }] = await db.query<{ status: string }>("SELECT status FROM seer_requests WHERE id = 'r1'");
  assert.equal(status, "deleting");
  // Une seconde passe ne remet rien en file.
  await createAutoForget(db, () => config)(cfg, Date.now());
  assert.equal((await cleanupJobs()).length, 1);
});

test("Jellyfin l'a de nouveau (remplacé), ou ne répond pas : rien ne part", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  requestIndex.seed([indexed(1, 603, REQUEST.COMPLETED)]);
  jellyfinHas.add(603);
  await createAutoForget(db, () => config)(cfg, Date.now());
  assert.deepEqual(await cleanupJobs(), []);

  jellyfinHas.delete(603);
  net.restore();
  net = stubFetch([() => { throw new TypeError("fetch failed"); }]);
  forgetJellyfinAccounts();
  await createAutoForget(db, () => config)(cfg, Date.now());
  assert.deepEqual(await cleanupJobs(), []);
});

test("option désactivée, ou suppression d'avant l'activation : rien ne part", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  requestIndex.seed([indexed(1, 603, REQUEST.COMPLETED)]);
  await createAutoForget(db, () => ({ deleteRequestsWithMedia: false }))(cfg, Date.now());
  await createAutoForget(db, () => ({ deleteRequestsWithMedia: true, deleteRequestsWithMediaSince: Date.now() }))(cfg, Date.now());
  assert.deepEqual(await cleanupJobs(), []);
});

test("une vague de départs (disque débranché) : rien ne part", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  const rows = Array.from({ length: MASS_TITLES + 5 }, (_, i) => [`m:t:${1000 + i}`, false, at] as [string, boolean, number]);
  liveState.setLibrary(buildSnapshotRows(rows));
  requestIndex.seed(rows.map((_, i) => indexed(i + 1, 1000 + i, REQUEST.COMPLETED)));
  await createAutoForget(db, () => config)(cfg, Date.now());
  assert.deepEqual(await cleanupJobs(), []);
});

/** Les lignes que la boucle lirait dans la liste du serveur. */
function buildSnapshotRows(rows: Array<[string, boolean, number | null]>) {
  return rows.map(([key, present, departedAt]) => ({ key, present, departedAt }));
}
