import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import type { PrismaClient } from "@prisma/client";
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

let net: ReturnType<typeof stubFetch>;
let jellyfinHas: Set<number>;
let config: Record<string, unknown>;
/** La file de nettoyage et la file des demandes, telles que la base les verrait (MariaDB simulée). */
let jobs: Array<{ seerrRequestId: number | null; requestId: string | null; deleteFiles: number }>;
let localRows: Array<Record<string, unknown>>;

const prisma = {
  async $queryRawUnsafe(sql: string, ...params: unknown[]) {
    if (/FROM server_config/.test(sql)) return [{ k: "jellyfin_url", v: JELLYFIN }, { k: "jellyfin_api_key", v: "jk" }];
    if (/FROM seer_cleanup_queue/.test(sql)) return [{ n: BigInt(jobs.filter((j) => j.seerrRequestId === params[0]).length) }];
    if (/FROM seer_requests WHERE media_type = \? AND tmdb_id = \?/.test(sql)) {
      return localRows.filter((r) => r.media_type === params[0] && r.tmdb_id === params[1] && !["deleted", "deleting", "delete_failed"].includes(String(r.status)));
    }
    return [];
  },
  async $executeRawUnsafe(sql: string, ...params: unknown[]) {
    if (/INSERT INTO seer_cleanup_queue/.test(sql)) {
      jobs.push({ seerrRequestId: (params[5] as number | null) ?? null, requestId: (params[9] as string | null) ?? null, deleteFiles: params[7] as number });
      return 1;
    }
    if (/UPDATE seer_requests SET .*status = \?/.test(sql)) {
      const row = localRows.find((r) => r.id === params[params.length - 1]);
      if (row) row.status = params[0];
      return row ? 1 : 0;
    }
    return 0;
  },
} as unknown as PrismaClient;

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

beforeEach(() => {
  forgetJellyfinAccounts();
  liveState.reset();
  requestIndex.reset();
  jellyfinHas = new Set();
  jobs = [];
  localRows = [{ id: "r1", jellyfin_user_id: "u1", username: "alice", media_type: "movie", tmdb_id: 603, title: "Matrix", status: "available", seerr_request_id: 1, created_at: new Date(), updated_at: new Date() }];
  net = stubFetch([jellyfin, (c) => (c.url.includes("/settings/") ? json([]) : null)]);
  config = { deleteRequestsWithMedia: true, deleteRequestsWithMediaSince: Date.now() - 3_600_000 };
});
afterEach(() => { net.restore(); });

/** Les lignes que la boucle lirait dans la liste du serveur. */
function buildSnapshotRows(rows: Array<[string, boolean, number | null]>) {
  return rows.map(([key, present, departedAt]) => ({ key, present, departedAt }));
}

test("parti depuis plus de dix minutes, absent de Jellyfin : la demande part, sans toucher aux fichiers", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  requestIndex.seed([indexed(1, 603, REQUEST.COMPLETED)]);
  await createAutoForget(prisma, () => config)(cfg, Date.now());
  assert.deepEqual(jobs, [{ seerrRequestId: 1, requestId: "r1", deleteFiles: 0 }]);
  assert.equal(localRows[0].status, "deleting");
  // Une seconde passe ne remet rien en file.
  await createAutoForget(prisma, () => config)(cfg, Date.now());
  assert.equal(jobs.length, 1);
});

test("Jellyfin l'a de nouveau (remplacé), ou ne répond pas : rien ne part", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  requestIndex.seed([indexed(1, 603, REQUEST.COMPLETED)]);
  jellyfinHas.add(603);
  await createAutoForget(prisma, () => config)(cfg, Date.now());
  assert.deepEqual(jobs, []);

  jellyfinHas.delete(603);
  net.restore();
  net = stubFetch([() => { throw new TypeError("fetch failed"); }]);
  forgetJellyfinAccounts();
  await createAutoForget(prisma, () => config)(cfg, Date.now());
  assert.deepEqual(jobs, []);
});

test("option désactivée, ou suppression d'avant l'activation : rien ne part", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  requestIndex.seed([indexed(1, 603, REQUEST.COMPLETED)]);
  await createAutoForget(prisma, () => ({ deleteRequestsWithMedia: false }))(cfg, Date.now());
  await createAutoForget(prisma, () => ({ deleteRequestsWithMedia: true, deleteRequestsWithMediaSince: Date.now() }))(cfg, Date.now());
  assert.deepEqual(jobs, []);
});

test("une vague de départs (disque débranché) : rien ne part", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  const rows = Array.from({ length: MASS_TITLES + 5 }, (_, i) => [`m:t:${1000 + i}`, false, at] as [string, boolean, number]);
  liveState.setLibrary(buildSnapshotRows(rows));
  requestIndex.seed(rows.map((_, i) => indexed(i + 1, 1000 + i, REQUEST.COMPLETED)));
  await createAutoForget(prisma, () => config)(cfg, Date.now());
  assert.deepEqual(jobs, []);
});
