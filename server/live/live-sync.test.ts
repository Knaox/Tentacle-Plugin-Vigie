import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { testDb } from "../test-support/sqlite-storage";
import type { TestDatabase } from "../test-support/sqlite";
import type { VigieDb } from "../storage/vigie-db";
import { MIGRATIONS } from "../storage/migrations";
import { forgetJellyfinAccounts } from "../jellyfin-users";
import { refreshLocalPending } from "../search/pending";
import { statusFor } from "../search/respond";
import { titleStateFor } from "../titles/title-state";
import { liveState, SETTLE_MS } from "./live-state";
import { requestIndex } from "./request-index";
import { coreLibraryStore } from "./library-store";
import { departuresToCheck, liveGeneration, resetLiveSync, runPass, type LiveSyncDeps } from "./live-sync";
import { STATUS } from "./title-truth";

/*
 * Le parcours de l'administrateur, de bout en bout, sur une vraie SQLite :
 *   1. un film demandé est là → « Disponible » ;
 *   2. il est supprimé de Jellyfin → « Demandé » (sa demande est toujours là),
 *      sans attendre Jellyseerr, qui le croit encore disponible ;
 *   3. sa demande est supprimée dans Jellyseerr → il se redemande, et la
 *      ligne de la file locale est close aussitôt.
 */

const SEERR = "http://seerr.test";
const JELLYFIN = "http://jellyfin.test";
const cfg = { seerrUrl: SEERR, seerrApiKey: "k" };
const rights = { movies: true, tv: true };

let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;
let seerrRequests: Array<{ id: number; status: number; updatedAt: string; tmdbId: number }>;
/** Ce que Jellyfin a, par TMDB. */
let jellyfinHas: Set<number>;
let deps: LiveSyncDeps;

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
      media: { tmdbId: r.tmdbId, mediaType: "movie", status: 5 }, seasons: [],
      requestedBy: { id: 1, jellyfinUserId: "u1" },
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

beforeEach(async () => {
  let storage;
  ({ db, raw, storage } = testDb());
  await storage.migrate(MIGRATIONS);
  raw.exec(`CREATE TABLE library_known_id (itemId TEXT NOT NULL PRIMARY KEY, contentKey TEXT, removedAt DATETIME)`);
  raw.exec(`CREATE TABLE server_config ("key" TEXT PRIMARY KEY, "value" TEXT)`);
  raw.prepare(`INSERT INTO server_config ("key", "value") VALUES ('jellyfin_url', ?), ('jellyfin_api_key', 'jk')`).run(JELLYFIN);
  liveState.reset();
  requestIndex.reset();
  resetLiveSync();
  forgetJellyfinAccounts();
  seerrRequests = [{ id: 1, status: 5, updatedAt: "2026-10-01T10:00:00.000Z", tmdbId: 603 }];
  jellyfinHas = new Set([603]);
  net = stubFetch([seerr, jellyfin]);
  raw.prepare("INSERT INTO library_known_id (itemId, contentKey, removedAt) VALUES ('j603', 'm:t:603', NULL)").run();
  await db.execute(
    `INSERT INTO seer_requests (id, jellyfin_user_id, username, media_type, tmdb_id, title, status, seerr_request_id, created_at, updated_at)
     VALUES ('r1', 'u1', 'alice', 'movie', 603, 'Matrix', 'available', 1, ?, ?)`, Date.now(), Date.now(),
  );
  deps = { db, store: coreLibraryStore(db), getWorkerConfig: async () => cfg };
});
afterEach(() => { net.restore(); raw.close(); resetLiveSync(); });

/** Ce que la recherche et les cartes de Tentacle montrent du film (Jellyseerr le croit toujours disponible). */
function shown() {
  const status = statusFor({ key: "movie:603", mediaType: "movie", tmdbId: 603, remoteStatus: STATUS.AVAILABLE });
  return { status, state: titleStateFor("movie", 603, status, rights, "fr") };
}

test("supprimé de Jellyfin : « Demandé » tout de suite ; demande supprimée : il se redemande", async () => {
  await runPass(deps);
  assert.equal(shown().status, STATUS.AVAILABLE);
  assert.equal(shown().state.badge?.label, "Disponible");

  // Jellyfin supprime le film ; le serveur Tentacle le note.
  jellyfinHas.delete(603);
  const now = Date.now();
  raw.prepare("UPDATE library_known_id SET removedAt = ? WHERE itemId = 'j603'").run(now);
  const gen = liveGeneration();
  await runPass(deps, now + 1_000);
  assert.ok(liveGeneration() > gen, "le hub est prévenu");
  assert.equal(shown().status, STATUS.PENDING);
  assert.equal(shown().state.badge?.label, "Demandé");
  assert.equal(shown().state.request, null, "déjà demandé : rien à redemander");

  // La demande est supprimée dans Jellyseerr.
  seerrRequests = [];
  await runPass(deps, now + 11_000);
  const [{ status }] = await db.query<{ status: string }>("SELECT status FROM seer_requests WHERE id = 'r1'");
  assert.equal(status, "deleted", "la ligne locale est close");
  refreshLocalPending(db, true);
  assert.equal(shown().status, STATUS.DELETED);
  assert.equal(shown().state.badge, null);
  assert.deepEqual(shown().state.request, { mode: "direct", label: "Demander" });
});

test("un fichier remplacé (mise à niveau) n'est pas un titre supprimé", async () => {
  await runPass(deps);
  const now = Date.now();
  // L'ancien item part ; Jellyfin a déjà le nouveau, que le serveur n'a pas encore inscrit.
  raw.prepare("UPDATE library_known_id SET removedAt = ? WHERE itemId = 'j603'").run(now);
  await runPass(deps, now + 1_000);
  assert.equal(shown().status, STATUS.AVAILABLE);
  assert.equal(shown().state.badge?.label, "Disponible");
});

test("un départ récent pas encore confirmé ne corrige rien ; ancien, il est acquis sans Jellyfin", async () => {
  await runPass(deps);
  const longAgo = Date.now() - SETTLE_MS - 60_000;
  raw.prepare("UPDATE library_known_id SET removedAt = ? WHERE itemId = 'j603'").run(longAgo);
  jellyfinHas.delete(603);
  net.restore();
  net = stubFetch([seerr]); // Jellyfin muet
  await runPass(deps);
  assert.deepEqual(departuresToCheck(Date.now()), [], "un départ acquis ne se redemande pas");
  assert.equal(shown().status, STATUS.PENDING);
});

test("Jellyfin muet sur un départ tout récent : Jellyseerr garde la parole", async () => {
  await runPass(deps);
  const now = Date.now();
  raw.prepare("UPDATE library_known_id SET removedAt = ? WHERE itemId = 'j603'").run(now);
  net.restore();
  net = stubFetch([seerr]);
  await runPass(deps, now + 1_000);
  assert.equal(shown().status, STATUS.AVAILABLE);
});

test("sans la liste du serveur (Tentacle trop ancien) : rien n'est corrigé, rien ne casse", async () => {
  raw.exec("DROP TABLE library_known_id");
  await runPass(deps);
  assert.equal(liveState.libraryReadable, false);
  assert.equal(shown().status, STATUS.AVAILABLE);
});

test("au repos : une question à Jellyseerr par passe, aucune à Jellyfin", async () => {
  await runPass(deps);
  const before = net.calls.length;
  await runPass(deps, Date.now() + 60_000);
  const calls = net.calls.slice(before);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith(`${SEERR}/api/v1/request?take=1`));
});
