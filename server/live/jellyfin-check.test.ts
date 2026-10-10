import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { testDb } from "../test-support/sqlite-storage";
import type { TestDatabase } from "../test-support/sqlite";
import type { VigieDb } from "../storage/vigie-db";
import { forgetJellyfinAccounts } from "../jellyfin-users";
import { checkInJellyfin } from "./jellyfin-check";

/*
 * Ce que Jellyfin garde d'un titre supprimé, tel que mesuré sur 10.11 : les
 * fichiers d'une série supprimés, ses dossiers restés, Jellyfin garde la
 * fiche Série et la fiche de chaque saison — sans un seul épisode.
 */

const JELLYFIN = "http://jellyfin.test";

let db: VigieDb;
let raw: TestDatabase;
let net: ReturnType<typeof stubFetch>;
/** Les épisodes de chaque série, par id Jellyfin. */
let episodes: Record<string, Array<{ ParentIndexNumber: number; LocationType: string }>>;
let items: Array<{ Id: string; Type: string; LocationType: string; ProviderIds: Record<string, string> }>;

function jellyfin(c: FetchCall) {
  if (!c.url.startsWith(JELLYFIN)) return null;
  const url = new URL(c.url);
  if (url.pathname === "/Users") return json([{ Id: "admin1", Name: "admin", Policy: { IsAdministrator: true } }]);
  if (url.pathname === "/Users/admin1/Items") {
    const type = url.searchParams.get("IncludeItemTypes");
    const tmdb = /^Tmdb\.(\d+)$/i.exec(url.searchParams.get("AnyProviderIdEquals") ?? "")?.[1];
    const found = items.filter((it) => it.Type === type && (!tmdb || it.ProviderIds.Tmdb === tmdb));
    return json({ Items: found, TotalRecordCount: found.length });
  }
  const shows = /^\/Shows\/([^/]+)\/Episodes$/.exec(url.pathname);
  if (shows) {
    const all = episodes[shows[1]] ?? [];
    const real = url.searchParams.get("IsMissing") === "false" ? all.filter((e) => e.LocationType !== "Virtual") : all;
    return json({ Items: real, TotalRecordCount: real.length });
  }
  return null;
}

beforeEach(() => {
  ({ db, raw } = testDb());
  raw.exec(`CREATE TABLE server_config ("key" TEXT PRIMARY KEY, "value" TEXT)`);
  raw.prepare(`INSERT INTO server_config ("key", "value") VALUES ('jellyfin_url', ?), ('jellyfin_api_key', 'jk')`).run(JELLYFIN);
  forgetJellyfinAccounts();
  items = [
    { Id: "st", Type: "Series", LocationType: "FileSystem", ProviderIds: { Tmdb: "66732" } },
    { Id: "bb", Type: "Series", LocationType: "FileSystem", ProviderIds: { Tmdb: "1396" } },
    { Id: "mx", Type: "Movie", LocationType: "FileSystem", ProviderIds: { Tmdb: "603" } },
    { Id: "vm", Type: "Movie", LocationType: "Virtual", ProviderIds: { Tmdb: "604" } },
  ];
  episodes = {
    st: [],
    bb: [
      { ParentIndexNumber: 1, LocationType: "FileSystem" },
      { ParentIndexNumber: 2, LocationType: "Virtual" },
    ],
  };
  net = stubFetch([jellyfin]);
});
afterEach(() => { net.restore(); raw.close(); });

test("une fiche Série sans épisode (dossier vide) : la série est partie", async () => {
  const out = await checkInJellyfin(db, [{ mediaType: "tv", tmdbId: 66732 }]);
  assert.deepEqual(out.get("tv:66732"), { present: false, presentSeasons: new Set() });
});

test("une série : seules les saisons qui ont un vrai épisode sont là — même sans saison demandée", async () => {
  const out = await checkInJellyfin(db, [{ mediaType: "tv", tmdbId: 1396 }]);
  assert.deepEqual(out.get("tv:1396"), { present: true, presentSeasons: new Set([1]) });
  // L'épisode virtuel de la saison 2 (pas encore sorti) n'est pas un fichier.
  assert.ok(net.calls.some((c) => c.url.includes("/Shows/bb/Episodes") && c.url.includes("IsMissing=false")));
});

test("un film : là s'il a un fichier ; virtuel ou absent, parti", async () => {
  const out = await checkInJellyfin(db, [
    { mediaType: "movie", tmdbId: 603 },
    { mediaType: "movie", tmdbId: 604 },
    { mediaType: "movie", tmdbId: 605 },
  ]);
  assert.deepEqual(out.get("movie:603"), { present: true });
  assert.equal(out.get("movie:604")?.present, false);
  assert.equal(out.get("movie:605")?.present, false);
});

test("Jellyfin muet : rien n'est conclu", async () => {
  net.restore();
  net = stubFetch([(c) => (c.url.startsWith(JELLYFIN) ? new Response("boom", { status: 500 }) : null)]);
  forgetJellyfinAccounts();
  const out = await checkInJellyfin(db, [{ mediaType: "tv", tmdbId: 66732 }]);
  assert.equal(out.get("tv:66732"), null);
});
