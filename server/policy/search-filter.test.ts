import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { filterHubSearch, filterProviderSearch } from "./search-filter";
import { setContentPolicy } from "./content-gate";
import type { HubSearchResponse, ProviderResponse, SearchItem } from "../search/present";

/*
 * La recherche (hub, barre globale, filmographie, saga) ne montre à un profil
 * restreint aucun titre au-dessus de son âge — vedette et œuvres des personnes
 * comprises — en UNE question au pont.
 */

let asked = 0;
const ALLOWED = new Set(["movie:1", "tv:2"]);
function install() {
  asked = 0;
  setContentPolicy({
    isRestricted: async (u) => u === "kid",
    filterExternalTitles: async (_u, ts) => { asked++; return ts.filter((t) => ALLOWED.has(`${t.mediaType}:${t.tmdbId}`)); },
    allowsExternalTitle: async () => false,
  });
}
afterEach(() => setContentPolicy(null));

const m = (id: number): SearchItem => ({ id, mediaType: "movie", title: `m${id}` });
const s = (id: number): SearchItem => ({ id, mediaType: "tv", name: `s${id}` });

function hub(top: HubSearchResponse["top"]): HubSearchResponse {
  return {
    query: "q", searched: "q", correction: null, year: null, type: null, complete: true, top,
    movies: [m(1), m(3)], series: [s(2), s(4)],
    people: [{ id: 9, mediaType: "person", name: "P", popularity: 1, knownFor: [m(1), m(3), s(4)] }],
    facets: [], page: 1, hasMore: false, blockedCount: 0, blockedActive: false, indexing: false, tookMs: 1,
  };
}

test("hub : films, séries et œuvres des personnes filtrés ; la personne reste", async () => {
  install();
  const out = await filterHubSearch("kid", hub({ kind: "media", item: m(1) }));
  assert.deepEqual(out.movies.map((i) => i.id), [1]);
  assert.deepEqual(out.series.map((i) => i.id), [2]);
  assert.deepEqual(out.people[0].knownFor.map((i) => i.id), [1]);
  assert.equal(out.top?.kind, "media");
  assert.equal(asked, 1);
});

test("hub : une vedette interdite disparaît ; une personne en vedette perd ses œuvres interdites", async () => {
  install();
  assert.equal((await filterHubSearch("kid", hub({ kind: "media", item: m(3) }))).top, null);
  const person = { id: 9, mediaType: "person" as const, name: "P", popularity: 1, knownFor: [m(3), s(2)] };
  const out = await filterHubSearch("kid", hub({ kind: "person", person }));
  assert.deepEqual(out.top?.kind === "person" ? out.top.person.knownFor.map((i) => i.id) : null, [2]);
});

test("compte libre : la réponse elle-même, sans question au pont", async () => {
  install();
  const res = hub(null);
  assert.equal(await filterHubSearch("adult", res), res);
  assert.equal(asked, 0);
});

test("contrat `search` du cœur : les éléments d'un profil restreint filtrés par type et TMDB", async () => {
  install();
  const item = (kind: "movie" | "series", tmdbId: number) => ({
    id: `${kind}:${tmdbId}`, kind, tmdbId, title: "t", year: null, subtitle: null, imageUrl: null, href: "/", badge: null,
  });
  const res: ProviderResponse = { query: "q", correction: null, complete: true, moreHref: null, items: [item("movie", 1), item("series", 2), item("movie", 2)] };
  const out = await filterProviderSearch("kid", res);
  assert.deepEqual(out.items.map((i) => i.id), ["movie:1", "series:2"]);
});
