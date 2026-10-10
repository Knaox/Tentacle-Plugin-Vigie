import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { testDb } from "../test-support/sqlite-storage";
import type { TestDatabase } from "../test-support/sqlite";
import type { VigieDb } from "../storage/vigie-db";
import { MIGRATIONS } from "../storage/migrations";
import { forgetJellyfinAccounts } from "../jellyfin-users";
import { readMeta } from "../search/title-store";
import { liveState, correctedStatus } from "./live-state";
import { requestIndex } from "./request-index";
import type { IndexedRequest } from "./request-index-model";
import { createAutoForget } from "./auto-forget";
import { FORGET_GRACE_MS } from "./auto-forget-plan";
import { createStorageWatch, libraryScanState, startLibraryScan } from "./storage-health";
import { STATUS } from "./title-truth";

/*
 * Suppression ou panne : Vigie le demande à Jellyfin. Un dossier de
 * bibliothèque qui ne répond plus (NAS, partage, disque) suspend tout ; ce qui
 * est parti autour attend que Jellyfin ait relu sa bibliothèque — Vigie lance
 * l'analyse —, et garde « Demandé » d'ici là.
 */

const JELLYFIN = "http://jellyfin.test";
const cfg = { seerrUrl: "http://seerr.test", seerrApiKey: "k" };
const BEFORE = (at: number) => new Date(at - 86_400_000).toISOString();

let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;
/** Ce que voit Jellyfin : le contenu de chaque dossier (`null` : introuvable). */
let folders: Record<string, string[] | null>;
let scan: { State: string; LastExecutionResult?: { EndTimeUtc: string; Status: string } };
let scansStarted: number;

const indexed = (id: number, tmdbId: number, createdAt: string): IndexedRequest => ({
  id, status: 5, is4k: false, mediaType: "movie", tmdbId, seasons: [],
  requestedBy: { seerrUserId: 1, jellyfinUserId: "u1", name: null }, createdAt, updatedAt: null, mediaStatus: 5,
});

function jellyfin(c: FetchCall) {
  if (!c.url.startsWith(JELLYFIN)) return null;
  const url = new URL(c.url);
  if (url.pathname === "/Users") return json([{ Id: "admin1", Name: "admin", Policy: { IsAdministrator: true } }]);
  if (url.pathname === "/Users/admin1/Items") return json({ Items: [], TotalRecordCount: 0 });
  if (url.pathname === "/Library/VirtualFolders") return json([{ Name: "Films", Locations: Object.keys(folders) }]);
  if (url.pathname === "/Environment/DirectoryContents") {
    const entries = folders[url.searchParams.get("path") ?? ""];
    return entries === null || entries === undefined
      ? new Response("not found", { status: 404 })
      : json(entries.map((name) => ({ Name: name, Path: `/x/${name}`, Type: "Directory" })));
  }
  if (url.pathname === "/ScheduledTasks") return json([{ Id: "scan1", Key: "RefreshLibrary", ...scan }]);
  if (url.pathname === "/ScheduledTasks/Running/scan1" && c.method === "POST") {
    scansStarted++;
    return new Response(null, { status: 204 });
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
  folders = { "/media/films": ["Matrix (1999)"] };
  scan = { State: "Idle" };
  scansStarted = 0;
  net = stubFetch([jellyfin, (c) => (c.url.includes("/settings/") ? json([]) : null)]);
});
afterEach(() => { net.restore(); raw.close(); });

const jobs = () => db.query<{ seerr_request_id: number }>("SELECT seerr_request_id FROM seer_cleanup_queue");

test("les dossiers : vus remplis, puis injoignables ou vidés — même après un redémarrage", async () => {
  const watch = createStorageWatch(db);
  assert.deepEqual(await watch(0), { state: "ok", down: [] });
  folders = { "/media/films": null };
  assert.deepEqual(await watch(60_000), { state: "down", down: ["/media/films"] });
  folders = { "/media/films": [] };
  assert.deepEqual(await watch(120_000), { state: "down", down: ["/media/films"] }, "un montage perdu laisse le dossier vide");
  // Redémarré pendant la panne : le dossier, vu rempli avant, est toujours en panne.
  assert.deepEqual(await createStorageWatch(db)(0), { state: "down", down: ["/media/films"] });
  // Jamais vus remplis (bibliothèque neuve, vieux disque resté dans la liste) : rien ne bloque.
  folders = { "/media/films": ["Matrix (1999)"], "/media/neuf": [], "/media/vieux": null };
  assert.deepEqual(await createStorageWatch(db)(0), { state: "ok", down: [] });
});

test("l'analyse de la médiathèque : sa dernière fin, la lancer", async () => {
  scan = { State: "Idle", LastExecutionResult: { EndTimeUtc: "2026-10-10T10:00:00Z", Status: "Completed" } };
  assert.deepEqual(await libraryScanState(db), { taskId: "scan1", running: false, lastEnd: Date.parse("2026-10-10T10:00:00Z") });
  assert.equal(await startLibraryScan(db, "scan1"), true);
  assert.equal(scansStarted, 1);
});

test("NAS injoignable : rien ne part, la panne est retenue ; revenu, Jellyfin relit, puis la demande part", async () => {
  const t0 = Date.now();
  const at = t0 - FORGET_GRACE_MS - 60_000;
  liveState.setLibrary([{ key: "m:t:603", present: false, departedAt: at }]);
  liveState.setCheck("movie:603", { at: t0, present: false });
  requestIndex.seed([indexed(1, 603, BEFORE(at))]);
  await createStorageWatch(db)(0); // Vigie a déjà vu le dossier rempli
  folders = { "/media/films": null };
  const autoForget = createAutoForget(db, () => ({}));

  await autoForget(cfg, t0);
  assert.deepEqual(await jobs(), [], "une panne, pas une suppression");
  assert.match((await readMeta(db, "live:storage-outages")) ?? "", /^\[\[\d+,null\]\]$/, "retenue en base");
  assert.equal(correctedStatus("movie", 603, STATUS.AVAILABLE), STATUS.PENDING, "la fiche garde « Demandé »");

  // Le NAS revient ; le titre n'est toujours pas là : Jellyfin doit relire avant tout.
  folders = { "/media/films": ["Autre film (2001)"] };
  await autoForget(cfg, t0 + 61_000);
  assert.deepEqual(await jobs(), []);
  await autoForget(cfg, t0 + 61_000 + FORGET_GRACE_MS + 61_000);
  assert.equal(scansStarted, 1, "Vigie lance l'analyse de la médiathèque");

  // L'analyse finie, le titre n'est pas revenu : c'était bien une suppression.
  scan = { State: "Idle", LastExecutionResult: { EndTimeUtc: new Date(t0 + 30 * 60_000).toISOString(), Status: "Completed" } };
  await autoForget(cfg, t0 + 31 * 60_000);
  assert.deepEqual((await jobs()).map((j) => j.seerr_request_id), [1]);
  assert.equal(correctedStatus("movie", 603, STATUS.AVAILABLE), STATUS.DELETED, "il se redemande");
});
