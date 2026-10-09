import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { forgetJellyfinAccounts } from "../jellyfin-users";
import { refreshLocalPending } from "../search/pending";
import { statusFor } from "../search/respond";
import { titleStateFor } from "../titles/title-state";
import { liveState, SETTLE_MS } from "./live-state";
import { requestIndex } from "./request-index";
import type { KeyRow } from "./library-keys";
import type { LibraryStore } from "./library-store";
import { departuresToCheck, liveGeneration, resetLiveSync, runPass, type LiveSyncDeps } from "./live-sync";
import { STATUS } from "./title-truth";

/*
 * Le parcours de l'administrateur, de bout en bout (ligne 1.24, MariaDB) :
 *   1. un film demandé est là → « Disponible » ;
 *   2. il est supprimé de Jellyfin → « Demandé » (sa demande est toujours là),
 *      sans attendre Jellyseerr, qui le croit encore disponible ;
 *   3. sa demande est supprimée dans Jellyseerr → il se redemande, et la
 *      ligne de la file locale est close aussitôt.
 * La base est simulée (le SQL MariaDB est éprouvé à part, sur une vraie
 * MariaDB) : on note ce que la boucle y écrit.
 */

const SEERR = "http://seerr.test";
const JELLYFIN = "http://jellyfin.test";
const cfg = { seerrUrl: SEERR, seerrApiKey: "k" };
const rights = { movies: true, tv: true };

let net: ReturnType<typeof stubFetch>;
let seerrRequests: Array<{ id: number; status: number; updatedAt: string; tmdbId: number }>;
let jellyfinHas: Set<number>;
let rows: KeyRow[];
let localStatus: string;
let tableMissing: boolean;
let deps: LiveSyncDeps;

const store: LibraryStore = {
  async signature() {
    if (tableMissing) return null;
    const departed = rows.filter((r) => !r.present);
    return { total: rows.length, departed: departed.length, last: departed.reduce<number | null>((m, r) => Math.max(m ?? 0, r.departedAt ?? 0), null) };
  },
  async rows() { return tableMissing ? null : rows.map((r) => ({ ...r })); },
};

/** Le client Prisma, réduit à ce que la boucle lui demande. */
const prisma = {
  async $queryRawUnsafe(sql: string) {
    if (/FROM server_config/.test(sql)) return [{ k: "jellyfin_url", v: JELLYFIN }, { k: "jellyfin_api_key", v: "jk" }];
    if (/FROM seer_requests/.test(sql)) {
      return ["queued", "processing", "retry_pending", "sent_to_seer", "approved"].includes(localStatus)
        ? [{ media_type: "movie", tmdb_id: 603, status: localStatus, seasons: null }] : [];
    }
    return [];
  },
  async $executeRawUnsafe(sql: string, ...params: unknown[]) {
    if (/UPDATE seer_requests SET status = 'deleted'/.test(sql) && params.includes(1) && localStatus !== "deleted") {
      localStatus = "deleted";
      return 1;
    }
    return 0;
  },
} as unknown as PrismaClient;

function seerr(c: FetchCall) {
  const url = new URL(c.url);
  if (!c.url.startsWith(SEERR) || url.pathname !== "/api/v1/request") return null;
  const take = Number(url.searchParams.get("take"));
  const skip = Number(url.searchParams.get("skip"));
  const sorted = [...seerrRequests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
  return json({
    pageInfo: { results: seerrRequests.length },
    results: sorted.slice(skip, skip + take).map((r) => ({
      id: r.id, status: r.status, updatedAt: r.updatedAt, type: "movie",
      media: { tmdbId: r.tmdbId, mediaType: "movie", status: 5 }, seasons: [], requestedBy: { id: 1, jellyfinUserId: "u1" },
    })),
  });
}

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
  liveState.reset();
  requestIndex.reset();
  resetLiveSync();
  forgetJellyfinAccounts();
  seerrRequests = [{ id: 1, status: 5, updatedAt: "2026-10-01T10:00:00.000Z", tmdbId: 603 }];
  jellyfinHas = new Set([603]);
  rows = [{ key: "m:t:603", present: true, departedAt: null }];
  localStatus = "available";
  tableMissing = false;
  net = stubFetch([seerr, jellyfin]);
  deps = { db: prisma, store, getWorkerConfig: async () => cfg };
});
afterEach(() => { net.restore(); resetLiveSync(); });

function shown() {
  const status = statusFor({ key: "movie:603", mediaType: "movie", tmdbId: 603, remoteStatus: STATUS.AVAILABLE });
  return { status, state: titleStateFor("movie", 603, status, rights, "fr") };
}

const gone = (at: number) => { rows = [{ key: "m:t:603", present: false, departedAt: at }]; };

test("supprimé de Jellyfin : « Demandé » tout de suite ; demande supprimée : il se redemande", async () => {
  await runPass(deps);
  assert.equal(shown().state.badge?.label, "Disponible");

  jellyfinHas.delete(603);
  const now = Date.now();
  gone(now);
  const gen = liveGeneration();
  await runPass(deps, now + 1_000);
  assert.ok(liveGeneration() > gen, "le hub est prévenu");
  assert.equal(shown().status, STATUS.PENDING);
  assert.equal(shown().state.badge?.label, "Demandé");

  seerrRequests = [];
  await runPass(deps, now + 11_000);
  assert.equal(localStatus, "deleted", "la ligne locale est close");
  refreshLocalPending(prisma, true);
  assert.equal(shown().status, STATUS.DELETED);
  assert.deepEqual(shown().state.request, { mode: "direct", label: "Demander" });
});

test("un fichier remplacé (mise à niveau) n'est pas un titre supprimé", async () => {
  await runPass(deps);
  const now = Date.now();
  gone(now);
  await runPass(deps, now + 1_000);
  assert.equal(shown().state.badge?.label, "Disponible");
});

test("un départ ancien est acquis sans Jellyfin ; un départ récent sans réponse ne corrige rien", async () => {
  await runPass(deps);
  gone(Date.now() - SETTLE_MS - 60_000);
  net.restore();
  net = stubFetch([seerr]);
  await runPass(deps);
  assert.deepEqual(departuresToCheck(Date.now()), []);
  assert.equal(shown().status, STATUS.PENDING);

  liveState.reset();
  resetLiveSync();
  gone(Date.now());
  await runPass(deps, Date.now() + 1_000);
  assert.equal(shown().status, STATUS.AVAILABLE);
});

test("sans la liste du serveur (Tentacle trop ancien) : rien n'est corrigé, rien ne casse", async () => {
  tableMissing = true;
  await runPass(deps);
  assert.equal(liveState.libraryReadable, false);
  assert.equal(shown().status, STATUS.AVAILABLE);
});
