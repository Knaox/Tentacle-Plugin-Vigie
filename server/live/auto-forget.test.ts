import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import type { PrismaClient } from "@prisma/client";
import { forgetJellyfinAccounts } from "../jellyfin-users";
import { normalizeConfig } from "../plugin-config";
import { invalidate } from "../cache";
import { liveState } from "./live-state";
import { requestIndex } from "./request-index";
import type { IndexedRequest } from "./request-index-model";
import type { Departure } from "./library-keys";
import { createAutoForget, forgetSpentNow } from "./auto-forget";
import type { WatchDeps } from "./departure-watch";
import { FORGET_GRACE_MS, MASS_TITLES, planJobs } from "./auto-forget-plan";
import { REQUEST } from "./title-truth";

/*
 * Un titre supprimé de Jellyfin emporte sa demande — toujours, plus de
 * réglage. Supprimer est irréversible : chaque garde est éprouvée — le délai
 * de grâce, Jellyfin redemandé, Sonarr ou Radarr qui le font redescendre, la
 * vague de départs. Et redemander n'attend rien.
 */

const JELLYFIN = "http://jellyfin.test";
const cfg = { seerrUrl: "http://seerr.test", seerrApiKey: "k" };
const indexed = (id: number, tmdbId: number, status: number, seasons: number[] = [], mediaType: "movie" | "tv" = "movie"): IndexedRequest => ({
  id, status, is4k: false, mediaType, tmdbId, seasons,
  requestedBy: { seerrUserId: 1, jellyfinUserId: "u1", name: "Alice" }, createdAt: null, updatedAt: null, mediaStatus: 5,
});
const movieDeparture = (tmdbId: number, at: number): Departure => ({ mediaType: "movie", tmdbId, at, seasons: [], whole: true });
const noConfig = () => ({});
/** Les dossiers de Jellyfin répondent ; aucune analyse connue (departure-watch.test.ts joue le reste). */
const healthy: WatchDeps = { storage: async () => ({ state: "ok", down: [] }), scanState: async () => null, startScan: async () => false };

test("plus de réglage : une configuration d'avant ne garde rien de l'interrupteur", () => {
  const saved = normalizeConfig({ deleteRequestsWithMedia: false, deleteRequestsWithMediaSince: 5, autoApprove: true });
  assert.equal("deleteRequestsWithMedia" in saved, false);
  assert.equal("deleteRequestsWithMediaSince" in saved, false);
  assert.equal(saved.autoApprove, true);
});

test("chaque saison à sa date : une redemande d'une saison partie plus tôt n'est jamais retirée", () => {
  const day = 86_400_000;
  // S3 partie au jour 1, redemandée une heure après ; S1 partie au jour 5.
  const dep: Departure = {
    mediaType: "tv", tmdbId: 1399, at: 5 * day, seasons: [1, 3], whole: false,
    seasonAt: new Map([[3, day], [1, 5 * day]]),
  };
  const base = { localId: null, jellyfinUserId: "u1" };
  const jobs = planJobs(dep, [
    { ...base, seerrRequestId: 30, status: REQUEST.APPROVED, seasons: [3], createdAt: day + 3_600_000 }, // la redemande
    { ...base, seerrRequestId: 31, status: REQUEST.COMPLETED, seasons: [1], createdAt: 0 }, // consommée
  ]);
  assert.deepEqual(jobs.map((j) => j.seerrRequestId), [31]);
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

test("une série partie en entier : seules les demandes de ce qui est parti suivent", () => {
  const base = { localId: null, jellyfinUserId: "u1" };
  // La saison 1 était là, plus rien n'y est ; la saison 2 est encore attendue.
  const dep: Departure = { mediaType: "tv", tmdbId: 66732, at: 1, seasons: [1], whole: true };
  const jobs = planJobs(dep, [
    { ...base, seerrRequestId: 20, status: REQUEST.COMPLETED, seasons: [1] }, // la saison partie : part
    { ...base, seerrRequestId: 21, status: REQUEST.APPROVED, seasons: [2] }, // jamais arrivée : reste
    { ...base, seerrRequestId: 22, status: REQUEST.APPROVED, seasons: [1, 2] }, // garde la 2, perd la 1
    { ...base, seerrRequestId: 23, status: REQUEST.APPROVED, seasons: [] }, // « toute la série » d'avant : part
  ]);
  assert.deepEqual(jobs.map((j) => [j.seerrRequestId, j.seasons, j.whole]), [
    [20, [1], true],
    [null, [1], false],
    [23, null, true],
  ]);
});

let net: ReturnType<typeof stubFetch>;
/** La file de nettoyage et la file des demandes, telles que la base les verrait (MariaDB simulée). */
let jobs: Array<{ id: string; seerrRequestId: number | null; requestId: string | null; deleteFiles: number; status: string }>;
let localRows: Array<Record<string, unknown>>;

const db = {
  async $queryRawUnsafe(sql: string, ...params: unknown[]) {
    if (/FROM server_config/.test(sql)) return [{ k: "jellyfin_url", v: JELLYFIN }, { k: "jellyfin_api_key", v: "jk" }];
    if (/SELECT id FROM seer_cleanup_queue/.test(sql)) {
      return jobs.filter((j) => j.status === "pending" && j.seerrRequestId === params[0]).map((j) => ({ id: j.id }));
    }
    if (/FROM seer_requests WHERE media_type = \? AND tmdb_id = \?/.test(sql)) {
      return localRows.filter((r) => r.media_type === params[0] && r.tmdb_id === params[1] && !["deleted", "deleting", "delete_failed"].includes(String(r.status)));
    }
    return [];
  },
  async $executeRawUnsafe(sql: string, ...params: unknown[]) {
    if (/INSERT INTO seer_cleanup_queue/.test(sql)) {
      jobs.push({
        id: params[0] as string, seerrRequestId: (params[5] as number | null) ?? null,
        requestId: (params[9] as string | null) ?? null, deleteFiles: params[7] as number, status: "pending",
      });
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
let jellyfinHas: Set<number>;
let radarrQueue: Array<Record<string, unknown>>;

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

function radarr(c: FetchCall) {
  if (c.url === `${cfg.seerrUrl}/api/v1/settings/radarr`) {
    return json([{ isDefault: true, hostname: "radarr.test", port: 7878, apiKey: "r", useSsl: false, baseUrl: "" }]);
  }
  if (c.url.startsWith("http://radarr.test:7878/api/v3/queue")) return json({ records: radarrQueue, totalRecords: radarrQueue.length });
  return null;
}

beforeEach(() => {
  jobs = [];
  localRows = [];
  forgetJellyfinAccounts();
  liveState.reset();
  requestIndex.reset();
  invalidate("seer:arr:queue");
  jellyfinHas = new Set();
  radarrQueue = [];
  net = stubFetch([jellyfin, radarr, (c) => (c.url.includes("/settings/") ? json([]) : null)]);
});
afterEach(() => { net.restore(); });

async function cleanupJobs() {
  return [...jobs]
    .sort((a, b) => (a.seerrRequestId ?? 0) - (b.seerrRequestId ?? 0))
    .map((j) => ({ id: j.id, seerr_request_id: j.seerrRequestId, request_id: j.requestId, delete_files: j.deleteFiles }));
}

async function insertLocal(id: string, seerrRequestId: number, status = "available") {
  localRows.push({
    id, jellyfin_user_id: "u1", username: "alice", media_type: "movie", tmdb_id: 603, title: "Matrix",
    status, seerr_request_id: seerrRequestId, created_at: new Date(), updated_at: new Date(),
  });
}

test("parti depuis plus de dix minutes, absent de Jellyfin : la demande part, sans toucher aux fichiers", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  requestIndex.seed([indexed(1, 603, REQUEST.COMPLETED)]);
  await insertLocal("r1", 1);
  const autoForget = createAutoForget(db, noConfig, healthy);
  await autoForget(cfg, Date.now());
  assert.deepEqual((await cleanupJobs()).map((j) => [j.seerr_request_id, j.request_id, j.delete_files]), [[1, "r1", 0]]);
  assert.equal(localRows.find((r) => r.id === "r1")?.status, "deleting");
  // Une seconde passe ne remet rien en file.
  await autoForget(cfg, Date.now());
  await createAutoForget(db, noConfig, healthy)(cfg, Date.now());
  assert.equal((await cleanupJobs()).length, 1);
});

test("supprimé il y a trois semaines, avant cette règle : sa demande part aussi", async () => {
  const at = Date.now() - 21 * 86_400_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  requestIndex.seed([{ ...indexed(1, 603, REQUEST.COMPLETED), createdAt: new Date(at - 86_400_000).toISOString() }]);
  await createAutoForget(db, noConfig, healthy)(cfg, Date.now());
  assert.deepEqual((await cleanupJobs()).map((j) => j.seerr_request_id), [1]);
});

test("Jellyfin l'a de nouveau (remplacé), ou ne répond pas : rien ne part", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  requestIndex.seed([indexed(1, 603, REQUEST.COMPLETED)]);
  jellyfinHas.add(603);
  await createAutoForget(db, noConfig, healthy)(cfg, Date.now());
  assert.deepEqual(await cleanupJobs(), []);

  jellyfinHas.delete(603);
  net.restore();
  net = stubFetch([() => { throw new TypeError("fetch failed"); }]);
  forgetJellyfinAccounts();
  await createAutoForget(db, noConfig, healthy)(cfg, Date.now());
  assert.deepEqual(await cleanupJobs(), []);
});

test("Radarr le fait redescendre : on attend, puis la demande part une fois la file vide", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  requestIndex.seed([indexed(1, 603, REQUEST.APPROVED)]);
  radarrQueue = [{ id: 9, title: "Matrix.1999.2160p", size: 100, sizeleft: 40, movie: { title: "Matrix", tmdbId: 603 } }];
  const autoForget = createAutoForget(db, noConfig, healthy);
  await autoForget(cfg, Date.now());
  assert.deepEqual(await cleanupJobs(), []);
  // Le téléchargement abandonné, le titre toujours absent : elle part à la passe suivante.
  radarrQueue = [];
  invalidate("seer:arr:queue");
  await autoForget(cfg, Date.now());
  assert.deepEqual((await cleanupJobs()).map((j) => j.seerr_request_id), [1]);
});

test("une redemande, faite APRÈS le départ du titre, n'est jamais retirée", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  liveState.setLibrary(buildSnapshotRows([["m:t:603", false, at]]));
  const before = { ...indexed(1, 603, REQUEST.COMPLETED), createdAt: new Date(at - 86_400_000).toISOString() };
  const after = { ...indexed(2, 603, REQUEST.APPROVED), createdAt: new Date(at + 60_000).toISOString() };
  // La demande d'avant part ; la redemande reste.
  requestIndex.seed([before, after]);
  await createAutoForget(db, noConfig, healthy)(cfg, Date.now());
  assert.deepEqual((await cleanupJobs()).map((j) => j.seerr_request_id), [1]);
  // Seule la redemande reste : rien ne la touche, même plus tard.
  requestIndex.seed([after]);
  await createAutoForget(db, noConfig, healthy)(cfg, Date.now() + 3_600_000);
  assert.deepEqual((await cleanupJobs()).map((j) => j.seerr_request_id), [1]);
  assert.deepEqual(planJobs(movieDeparture(603, at), [
    { seerrRequestId: 2, status: REQUEST.APPROVED, seasons: [], localId: null, jellyfinUserId: "u1", createdAt: at + 60_000 },
  ]), []);
});

test("une vague de départs, sans analyse de Jellyfin après elle : rien ne part, même des heures après", async () => {
  const at = Date.now() - FORGET_GRACE_MS - 5_000;
  const rows = Array.from({ length: MASS_TITLES + 5 }, (_, i) => [`m:t:${1000 + i}`, false, at] as [string, boolean, number]);
  liveState.setLibrary(buildSnapshotRows(rows));
  requestIndex.seed(rows.map((_, i) => indexed(i + 1, 1000 + i, REQUEST.COMPLETED)));
  await createAutoForget(db, noConfig, healthy)(cfg, Date.now());
  await createAutoForget(db, noConfig, healthy)(cfg, Date.now() + 5 * 3_600_000);
  assert.deepEqual(await cleanupJobs(), []);
});

test("redemander : la demande d'avant part tout de suite — pendant la grâce, et même dans une vague", async () => {
  // Parti il y a une minute, Jellyfin l'a confirmé.
  const at = Date.now() - 60_000;
  const rows = Array.from({ length: MASS_TITLES + 5 }, (_, i) => [`m:t:${600 + i}`, false, at] as [string, boolean, number]);
  liveState.setLibrary(buildSnapshotRows(rows));
  liveState.setCheck("movie:603", { at: Date.now(), present: false });
  requestIndex.seed([{ ...indexed(1, 603, REQUEST.COMPLETED), createdAt: new Date(at - 86_400_000).toISOString() }]);
  await insertLocal("r1", 1);
  // La boucle, elle, n'y touche pas (grâce, vague).
  await createAutoForget(db, noConfig, healthy)(cfg, Date.now());
  assert.deepEqual(await cleanupJobs(), []);
  // Le geste de l'utilisateur, si.
  const jobs = await forgetSpentNow(db, "movie", 603);
  const queued = await cleanupJobs();
  assert.deepEqual(queued.map((j) => [j.seerr_request_id, j.request_id]), [[1, "r1"]]);
  assert.deepEqual(jobs, [queued[0].id]);
  // Un titre que Jellyfin n'a pas encore confirmé parti : rien.
  assert.deepEqual(await forgetSpentNow(db, "movie", 604), []);
  // Rien d'autre à retirer : rien.
  assert.deepEqual(await forgetSpentNow(db, "movie", 999), []);
});

/** Les lignes que la boucle lirait dans la liste du serveur. */
function buildSnapshotRows(rows: Array<[string, boolean, number | null]>) {
  return rows.map(([key, present, departedAt]) => ({ key, present, departedAt }));
}

test("réglage « une série supprimée part en entier » : désactivé d'office ; actif, tout part — sauf une redemande", () => {
  assert.equal(normalizeConfig({}).deleteWholeSeries, false);
  assert.equal(normalizeConfig({ deleteWholeSeries: true }).deleteWholeSeries, true);
  const base = { localId: null, jellyfinUserId: "u1" };
  // Plus rien de la série dans Jellyfin : S1 et S2 parties, S3 encore attendue.
  const dep: Departure = { mediaType: "tv", tmdbId: 66732, at: 10_000_000, seasons: [1, 2], whole: true };
  const requests = [
    { ...base, seerrRequestId: 50, status: REQUEST.COMPLETED, seasons: [1, 2], createdAt: 0 },
    { ...base, seerrRequestId: 51, status: REQUEST.APPROVED, seasons: [3], createdAt: 0 }, // attendue
    { ...base, seerrRequestId: 52, status: REQUEST.APPROVED, seasons: [1], createdAt: 10_000_000 + 600_000 }, // redemande
  ];
  assert.deepEqual(planJobs(dep, requests).map((j) => j.seerrRequestId), [50], "désactivé : la saison attendue garde sa demande");
  const whole = planJobs(dep, requests, true);
  assert.deepEqual(whole.map((j) => [j.seerrRequestId, j.seasons, j.wholeSeries]), [[50, null, true], [51, null, true]]);
  // Une saison seule supprimée d'une série encore là : le réglage n'y change rien.
  const partial: Departure = { ...dep, seasons: [1], whole: false };
  assert.deepEqual(planJobs(partial, requests, true).map((j) => j.wholeSeries ?? false), [false]);
});
