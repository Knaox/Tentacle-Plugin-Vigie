import { test } from "node:test";
import assert from "node:assert/strict";
import type { QueueEntry, QueueResponse } from "./arr-queue";
import type { EpisodeFact } from "./sonarr-episodes";
import { matchQueue, restat, seriesFiles, summarizeQueue, verdictFor, withArrStatus, type InFlightRequest } from "./arr-truth";

function entry(over: Partial<QueueEntry>): QueueEntry {
  return {
    id: "sonarr-1", source: "sonarr", mediaType: "tv", title: "Série", seasonNumber: 1, episodeNumber: 1,
    episodeTitle: null, tmdbId: 42, percent: 50, size: 1000, sizeLeft: 500, etaSeconds: 600,
    validating: false, paused: false, stalled: false, warning: null, downloadId: null, ...over,
  };
}

const queue = (items: QueueEntry[], unreachable: Array<"sonarr" | "radarr"> = []): QueueResponse =>
  ({ updatedAt: "", items, total: items.length, unreachable });

const movie: InFlightRequest = { id: "seerr-1", mediaType: "movie", tmdbId: 7, seasons: null, status: "approved" };
const show: InFlightRequest = { id: "seerr-2", mediaType: "tv", tmdbId: 42, seasons: [3, 4], status: "approved" };

test("la file sert une demande : son film, ou SES saisons", () => {
  const items = [
    entry({ id: "radarr-1", source: "radarr", mediaType: "movie", tmdbId: 7, seasonNumber: null }),
    entry({ id: "sonarr-7", tmdbId: 7 }),
    entry({ id: "sonarr-2", seasonNumber: 1 }),
    entry({ id: "sonarr-3", seasonNumber: 3 }),
  ];
  assert.deepEqual(matchQueue(movie, items).map((e) => e.id), ["radarr-1"]);
  assert.deepEqual(matchQueue(show, items).map((e) => e.id), ["sonarr-3"]);
});

test("un pack de saison se compte une fois, pas une fois par épisode", () => {
  const pack = [1, 2, 3].map((n) => entry({ id: `sonarr-${n}`, episodeNumber: n, downloadId: "PACK", size: 3000, sizeLeft: 1000 }));
  const { summary, items } = summarizeQueue(pack)!;
  assert.equal(summary.size, 3000);
  assert.equal(Math.round(summary.percent!), 67);
  assert.equal(summary.validating, false);
  assert.equal(items.length, 3);
});

test("tout est complet : la demande s'importe, sans temps restant", () => {
  const { summary } = summarizeQueue([entry({ validating: true, sizeLeft: 0, percent: 100 }), entry({ id: "sonarr-9", validating: true })])!;
  assert.equal(summary.validating, true);
  assert.equal(summary.percent, 100);
  assert.equal(summary.etaSeconds, null);
  // Un épisode descend encore : ce n'est pas encore l'importation.
  assert.equal(summarizeQueue([entry({ validating: true }), entry({ id: "sonarr-9" })])!.summary.validating, false);
});

test("les fichiers de Sonarr disent si les saisons demandées sont là", () => {
  const facts = new Map<string, EpisodeFact>([
    ["S3E1", { hasFile: true, monitored: true }], ["S3E2", { hasFile: true, monitored: true }],
    ["S4E1", { hasFile: true, monitored: true }], ["S4E2", { hasFile: false, monitored: true }],
    ["S1E1", { hasFile: false, monitored: false }],
  ]);
  assert.equal(seriesFiles([3], facts), "all");
  assert.equal(seriesFiles([3, 4], facts), "some");
  assert.equal(seriesFiles([1], facts), "none");
  assert.equal(seriesFiles([9], facts), null);
  assert.equal(seriesFiles(null, facts), null);
});

test("Radarr dit le film là : disponible, sans attendre Jellyseerr", () => {
  assert.deepEqual(verdictFor(movie, queue([]), "all"), { status: "available", download: null });
  assert.equal(verdictFor(movie, queue([]), "none"), null);
  // Jellyseerr le croyait en route, rien ne descend et rien n'est là : il attend.
  assert.equal(verdictFor({ ...movie, status: "downloading" }, queue([]), "none")?.status, "unavailable");
  // Radarr muet : Jellyseerr garde la parole.
  assert.equal(verdictFor(movie, queue([], ["radarr"]), "all"), null);
});

test("dans la file : en route, puis en cours d'importation", () => {
  const film = (over: Partial<QueueEntry>) => entry({ id: "radarr-1", source: "radarr", mediaType: "movie", tmdbId: 7, seasonNumber: null, ...over });
  const down = verdictFor(movie, queue([film({ percent: 40, sizeLeft: 600 })]), null)!;
  assert.equal(down.status, "downloading");
  assert.equal(Math.round(down.download!.percent!), 40);
  assert.equal(down.download!.validating, false);
  const importing = verdictFor(movie, queue([film({ validating: true, sizeLeft: 0 })]), null)!;
  assert.equal(importing.status, "downloading");
  assert.equal(importing.download!.validating, true);
});

test("une série déjà là en partie reste « en partie » quand le reste arrive", () => {
  const v = verdictFor({ ...show, status: "partially_available" }, queue([entry({ seasonNumber: 4 })]), null)!;
  assert.equal(v.status, "partially_available");
  assert.ok(v.download);
  assert.equal(verdictFor(show, queue([]), "some")?.status, "partially_available");
  assert.equal(verdictFor({ ...show, status: "partially_available" }, queue([]), "some"), null);
});

test("liste et compteurs prennent les mêmes corrections", () => {
  const verdicts = new Map([["seerr-1", { status: "available" as const, download: null }]]);
  const items = [{ id: "seerr-1", status: "approved" as const }, { id: "seerr-2", status: "approved" as const }];
  assert.deepEqual(withArrStatus(items, verdicts).map((i) => i.status), ["available", "approved"]);
  const stats = restat({ total: 2, byStatus: { approved: 2 }, byType: { movie: 1, tv: 1 } }, items, verdicts);
  assert.deepEqual(stats.byStatus, { approved: 1, available: 1 });
});
