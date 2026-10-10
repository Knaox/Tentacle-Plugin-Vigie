import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "./test-support/fake-http";
import { liveState } from "./live/live-state";
import { cleanArrForJob } from "./cleanup-arr";
import { resetGoneMedia, type SeerrMediaState } from "./seerr-media";

/*
 * Une demande supprimée ne laisse plus son titre « non surveillé » dans
 * Radarr ou Sonarr : le film est retiré, la série aussi quand plus aucune de
 * ses saisons n'est surveillée — jamais ce qu'une autre demande veut encore.
 */

const SEERR = "http://seerr.test";
const config = { seerrUrl: SEERR, seerrApiKey: "k", interval: 60_000, syncEvery: 2 };
const LONG_AGO = Date.now() - 3_600_000;

let net: ReturnType<typeof stubFetch>;
let arrCalls: string[];
let seasons: Array<{ seasonNumber: number; monitored: boolean }>;
let episodeFiles: Array<{ id: number; seasonNumber: number }>;

function seerrSettings(c: FetchCall) {
  if (c.url === `${SEERR}/api/v1/settings/radarr`) return json([{ isDefault: true, hostname: "radarr.test", port: 7878, apiKey: "r", useSsl: false, baseUrl: "" }]);
  if (c.url === `${SEERR}/api/v1/settings/sonarr`) return json([{ isDefault: true, hostname: "sonarr.test", port: 8989, apiKey: "s", useSsl: false, baseUrl: "" }]);
  return null;
}

/** Radarr et Sonarr : ce qu'on leur demande, et une série qui suit les PUT. */
function arr(c: FetchCall) {
  if (!c.url.startsWith("http://radarr.test") && !c.url.startsWith("http://sonarr.test")) return null;
  const url = new URL(c.url);
  if (url.pathname === "/api/v3/queue") return json({ records: [] });
  arrCalls.push(`${c.method} ${url.pathname}${url.search}`);
  if (url.pathname === "/api/v3/series/50" && c.method === "GET") {
    return json({ id: 50, monitored: true, seasons, statistics: { episodeFileCount: episodeFiles.length } });
  }
  if (url.pathname === "/api/v3/series/50" && c.method === "PUT") {
    seasons = (JSON.parse(c.body ?? "{}") as { seasons: typeof seasons }).seasons;
    return json({});
  }
  if (url.pathname === "/api/v3/episodefile") return json(episodeFiles);
  if (url.pathname === "/api/v3/episodefile/bulk") {
    const ids = new Set((JSON.parse(c.body ?? "{}") as { episodeFileIds: number[] }).episodeFileIds);
    episodeFiles = episodeFiles.filter((f) => !ids.has(f.id));
    return new Response(null, { status: 200 });
  }
  return new Response(null, { status: 200 });
}

beforeEach(() => {
  arrCalls = [];
  seasons = [{ seasonNumber: 1, monitored: true }, { seasonNumber: 2, monitored: true }];
  episodeFiles = [{ id: 1, seasonNumber: 1 }, { id: 2, seasonNumber: 2 }];
  net = stubFetch([seerrSettings, arr]);
});
afterEach(() => net.restore());

const media = (over: Partial<SeerrMediaState> = {}): SeerrMediaState => ({
  id: 9, status: 5, externalServiceId: 50, serviceId: 0, requests: [{ id: 41, status: 5, is4k: false }], ...over,
});
const movieJob = { mediaType: "movie" as const, seasons: null, deleteFiles: false, seerrRequestId: 41 };

test("un film : retiré de Radarr, ses fichiers gardés sauf si on l'a demandé", async () => {
  assert.equal(await cleanArrForJob(config, movieJob, media()), "removed");
  assert.deepEqual(arrCalls, ["DELETE /api/v3/movie/50?deleteFiles=false&addImportExclusion=false"]);
  arrCalls = [];
  await cleanArrForJob(config, { ...movieJob, deleteFiles: true }, media());
  assert.deepEqual(arrCalls, ["DELETE /api/v3/movie/50?deleteFiles=true&addImportExclusion=false"]);
});

test("un film qu'une autre demande veut encore : Radarr n'y touche pas", async () => {
  const other = media({ requests: [{ id: 41, status: 5, is4k: false }, { id: 42, status: 2, is4k: false }] });
  assert.equal(await cleanArrForJob(config, movieJob, other), "kept");
  assert.deepEqual(arrCalls, []);
  // Une demande refusée, ou en 4K, ne le retient pas.
  const dead = media({ requests: [{ id: 41, status: 5, is4k: false }, { id: 43, status: 3, is4k: false }, { id: 44, status: 2, is4k: true }] });
  assert.equal(await cleanArrForJob(config, movieJob, dead), "removed");
});

test("des saisons : Sonarr cesse de les surveiller ; la série reste tant qu'une autre l'est", async () => {
  const job = { mediaType: "tv" as const, seasons: [2], deleteFiles: false, seerrRequestId: 41 };
  assert.equal(await cleanArrForJob(config, job, media()), "unmonitored");
  assert.deepEqual(seasons, [{ seasonNumber: 1, monitored: true }, { seasonNumber: 2, monitored: false }]);
  assert.ok(!arrCalls.some((c) => c.startsWith("DELETE /api/v3/series")));
});

test("la dernière saison surveillée : la série est retirée de Sonarr, ses fichiers gardés", async () => {
  seasons = [{ seasonNumber: 1, monitored: true }, { seasonNumber: 2, monitored: false }];
  const job = { mediaType: "tv" as const, seasons: [1], deleteFiles: false, seerrRequestId: 41 };
  assert.equal(await cleanArrForJob(config, job, media()), "removed");
  assert.equal(arrCalls.at(-1), "DELETE /api/v3/series/50?deleteFiles=false&addImportListExclusion=false");
});

test("fichiers supprimés : le dossier de la série ne part que s'il n'y reste plus aucun épisode", async () => {
  seasons = [{ seasonNumber: 1, monitored: true }, { seasonNumber: 2, monitored: false }];
  // La saison 2 (pas surveillée) garde ses fichiers : le dossier reste.
  await cleanArrForJob(config, { mediaType: "tv", seasons: [1], deleteFiles: true, seerrRequestId: 41 }, media());
  assert.equal(arrCalls.at(-1), "DELETE /api/v3/series/50?deleteFiles=false&addImportListExclusion=false");
  // Plus aucun épisode : le dossier part avec la série.
  arrCalls = [];
  seasons = [{ seasonNumber: 1, monitored: true }];
  episodeFiles = [{ id: 1, seasonNumber: 1 }];
  await cleanArrForJob(config, { mediaType: "tv", seasons: [1], deleteFiles: true, seerrRequestId: 41 }, media());
  assert.equal(arrCalls.at(-1), "DELETE /api/v3/series/50?deleteFiles=true&addImportListExclusion=false");
});

test("jamais ajouté à Radarr : rien à faire", async () => {
  assert.equal(await cleanArrForJob(config, movieJob, media({ externalServiceId: null })), "no-target");
  assert.equal(await cleanArrForJob(config, movieJob, null), "no-target");
  assert.deepEqual(arrCalls, []);
});

/* ── La remise à zéro du média Jellyseerr (ligne 1.24 : le parcours complet de la
 *    file de nettoyage est éprouvé au banc, sur un vrai serveur 1.24.0 et MariaDB) ── */

let seerrMedia: { id: number; status: number; requests: Array<{ id: number; status: number }> } | null;
let mediaDeleted: boolean;

function seerrMediaApi(c: FetchCall) {
  if (!c.url.startsWith(SEERR)) return null;
  const url = new URL(c.url);
  if (url.pathname === "/api/v1/tv/66732" && c.method === "GET") return json({ id: 66732, mediaInfo: seerrMedia ?? undefined });
  if (url.pathname === "/api/v1/media/9" && c.method === "DELETE") { mediaDeleted = true; return new Response(null, { status: 204 }); }
  return null;
}

function goneSeries(present: boolean): void {
  liveState.reset();
  liveState.setLibrary([{ key: "e:t:66732:1", present, departedAt: present ? null : LONG_AGO }]);
}

test("plus dans Jellyfin, plus aucune demande, Jellyseerr le dit « en partie » : remis à zéro", async () => {
  net.restore();
  net = stubFetch([seerrMediaApi]);
  mediaDeleted = false;
  seerrMedia = { id: 9, status: 4, requests: [] };
  goneSeries(false);
  assert.equal(await resetGoneMedia(config, "tv", 66732, "Stranger Things"), true);
  assert.equal(mediaDeleted, true);
});

test("une demande y reste, ou Jellyfin a encore le titre : rien n'est remis à zéro", async () => {
  net.restore();
  net = stubFetch([seerrMediaApi]);
  mediaDeleted = false;
  seerrMedia = { id: 9, status: 4, requests: [{ id: 3, status: 2 }] };
  goneSeries(false);
  assert.equal(await resetGoneMedia(config, "tv", 66732, "Stranger Things"), false);
  seerrMedia = { id: 9, status: 4, requests: [] };
  goneSeries(true);
  assert.equal(await resetGoneMedia(config, "tv", 66732, "Stranger Things"), false);
  assert.equal(mediaDeleted, false);
});
