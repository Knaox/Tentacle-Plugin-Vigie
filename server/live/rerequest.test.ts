import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { createRequest, findExistingTvRequest, getNextQueued } from "../db";
import { liveState } from "./live-state";
import { requestIndex } from "./request-index";
import { deferredRequestIds, resetUnblock, staleSeasons, unblockSeasons } from "./seerr-unblock";

/*
 * Redemander ce qui a été supprimé de Jellyfin (ligne 1.24) : la file ne le
 * bloque plus, Jellyseerr — qui le croit encore là — est débloqué. Le SQL de
 * MariaDB est éprouvé à part, sur une vraie MariaDB ; ici, ce qu'il demande.
 */

const SEERR = "http://seerr.test";
const cfg = { seerrUrl: SEERR, seerrApiKey: "k" };
const LONG_AGO = Date.now() - 3_600_000;

let net: ReturnType<typeof stubFetch>;
let calls: string[];

beforeEach(() => {
  liveState.reset();
  requestIndex.reset();
  resetUnblock();
  calls = [];
  net = stubFetch([
    (c: FetchCall) => {
      calls.push(`${c.method} ${new URL(c.url).pathname}`);
      if (c.method === "DELETE" && c.url.endsWith("/api/v1/media/77")) return new Response(null, { status: 204 });
      if (c.url.includes("/settings/jobs/")) return json({});
      return null;
    },
  ]);
  // La série 1399 a été supprimée de Jellyfin il y a une heure ; Jellyseerr la croit toujours là.
  liveState.setLibrary([{ key: "e:t:1399:1", present: false, departedAt: LONG_AGO }, { key: "e:t:1399:2", present: false, departedAt: LONG_AGO }]);
  requestIndex.seed([]);
});
afterEach(() => net.restore());

const detail = (requests: Array<{ id: number; status: number }> = []) => ({
  keywords: [],
  mediaInfo: { id: 77, status: 5, seasons: [{ seasonNumber: 1, status: 5 }, { seasonNumber: 2, status: 5 }], requests },
});
const request = { id: "q1", title: "Série", mediaType: "tv" as const, tmdbId: 1399, seasons: [1, 2] };

test("les saisons perdues par Jellyfin que Jellyseerr croit encore là", () => {
  assert.deepEqual(staleSeasons(request, detail()), [1, 2]);
  assert.deepEqual(staleSeasons({ ...request, mediaType: "movie" }, detail()), []);
  assert.deepEqual(staleSeasons(request, { keywords: [], mediaInfo: { seasons: [{ seasonNumber: 1, status: 7 }] } }), []);
});

test("série partie en entier, sans demande : sa fiche périmée part, la demande part tout de suite", async () => {
  assert.equal(await unblockSeasons(cfg, request, detail()), "send");
  assert.ok(calls.includes("DELETE /api/v1/media/77"));
});

test("une autre demande vise encore la série : Jellyseerr revérifie, la demande attend sans bloquer la file", async () => {
  assert.equal(await unblockSeasons(cfg, request, detail([{ id: 9, status: 2 }])), "wait");
  assert.ok(!calls.includes("DELETE /api/v1/media/77"));
  assert.ok(calls.includes("POST /api/v1/settings/jobs/availability-sync/run"));
  assert.deepEqual(deferredRequestIds(), ["q1"]);
});

test("la file écarte ce qui attend, et une demande arrivée ne bloque plus une saison redemandée", async () => {
  const seen: Array<{ sql: string; params: unknown[] }> = [];
  const prisma = {
    async $queryRawUnsafe(sql: string, ...params: unknown[]) { seen.push({ sql, params }); return []; },
  } as unknown as PrismaClient;
  await getNextQueued(prisma, ["q1", "q2"]);
  assert.match(seen[0].sql, /AND id NOT IN \(\?, \?\)/);
  assert.deepEqual(seen[0].params, ["q1", "q2"]);
  await findExistingTvRequest(prisma, "u1", 1399);
  assert.match(seen[1].sql, /status NOT IN \('deleted', 'deleting', 'delete_failed', 'available', 'failed'\)/);
});

test("une redemande attend le nettoyage de la demande d'avant : posé à sa création, la file le respecte", async () => {
  const seen: Array<{ sql: string; params: unknown[] }> = [];
  const prisma = {
    async $executeRawUnsafe(sql: string, ...params: unknown[]) { seen.push({ sql, params }); return 1; },
    async $queryRawUnsafe(sql: string, ...params: unknown[]) {
      seen.push({ sql, params });
      return /SELECT \* FROM seer_requests WHERE id = \?/.test(sql)
        ? [{ id: params[0], jellyfin_user_id: "u1", username: "alice", media_type: "movie", tmdb_id: 603, title: "Matrix", status: "queued", pending_cleanup_id: "c1" }]
        : [];
    },
  } as unknown as PrismaClient;
  await createRequest(prisma, { jellyfinUserId: "u1", username: "alice", mediaType: "movie", tmdbId: 603, title: "Matrix", pendingCleanupId: "c1" });
  const insert = seen.find((q) => /INSERT INTO seer_requests/.test(q.sql));
  assert.match(insert!.sql, /pending_cleanup_id\)/);
  assert.equal(insert!.params.at(-1), "c1");
  await getNextQueued(prisma);
  assert.match(seen.at(-1)!.sql, /pending_cleanup_id IS NULL/);
});
