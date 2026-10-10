import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { fakeApp, json, stubFetch, type FetchCall } from "./test-support/fake-http";
import { registerBulkRoutes } from "./routes-bulk";

/*
 * Supprimer plusieurs demandes d'un coup — dont celles nées dans Jellyseerr,
 * sans ligne locale (« seerr-<id> ») : elles tombaient toutes en erreur.
 * Ligne 1.24 : la base est simulée (on note ce qui part dans la file).
 */

const SEERR = "http://seerr.test";
const config = { seerrUrl: SEERR, seerrApiKey: "k" };
const admin = { userId: "u-admin", username: "admin", isAdmin: true };
const alice = { userId: "u-alice", username: "alice", isAdmin: false };

let net: ReturnType<typeof stubFetch>;
/** La file de nettoyage : [demande Jellyseerr, film TMDB] de chaque tâche. */
let jobs: Array<[number | null, number]>;

const prisma = {
  async $queryRawUnsafe(sql: string, ...params: unknown[]) {
    if (/FROM seer_requests WHERE id = \?/.test(sql) && params[0] === "r1") {
      return [{ id: "r1", jellyfin_user_id: "u-alice", username: "alice", media_type: "movie", tmdb_id: 550, title: "Fight Club",
        status: "approved", seerr_request_id: 8, seasons: null, created_at: new Date(), updated_at: new Date() }];
    }
    if (/FROM seer_user_settings/.test(sql)) return params[0] === "u-alice" ? [{ jellyseerr_user_id: 1 }] : [];
    return [];
  },
  async $executeRawUnsafe(sql: string, ...params: unknown[]) {
    if (/INSERT INTO seer_cleanup_queue/.test(sql)) jobs.push([(params[5] as number | null) ?? null, params[3] as number]);
    return 1;
  },
} as unknown as PrismaClient;

function seerr(c: FetchCall) {
  if (c.url === `${SEERR}/api/v1/request/7`) {
    return json({ id: 7, status: 5, media: { id: 70, tmdbId: 603, mediaType: "movie" }, requestedBy: { id: 2 } });
  }
  return null;
}

beforeEach(() => {
  jobs = [];
  net = stubFetch([seerr]);
});
afterEach(() => net.restore());

async function bulkDelete(user: object, ids: string[]) {
  const { app, call } = fakeApp();
  registerBulkRoutes(app as never, prisma, async () => config);
  return (await call("POST", "/requests/bulk-delete", { body: { ids }, user })).body as { deleted: number; errors: number };
}

test("l'administrateur supprime d'un coup une demande locale et une demande née dans Jellyseerr", async () => {
  const res = await bulkDelete(admin, ["r1", "seerr-7"]);
  assert.deepEqual({ deleted: res.deleted, errors: res.errors }, { deleted: 2, errors: 0 });
  assert.deepEqual(jobs.sort((a, b) => Number(a[0]) - Number(b[0])), [[7, 603], [8, 550]]);
});

test("un compte ordinaire ne supprime pas la demande Jellyseerr d'un autre", async () => {
  const res = await bulkDelete(alice, ["seerr-7"]);
  assert.deepEqual({ deleted: res.deleted, errors: res.errors }, { deleted: 0, errors: 1 });
  assert.deepEqual(jobs, []);
});
