import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  allowsTitle, filterTitles, restrictionFor, setContentPolicy,
  type ContentPolicyBridge, type ExternalTitle,
} from "./content-gate";

/*
 * La porte unique vers le pont du cœur : chemin court pour un compte libre,
 * comportement d'avant sans pont, fermé à l'échec quand le pont lève.
 */

interface Calls { restricted: number; filter: number; allows: number }

/** Un pont simulé : le compte « kid » ne voit que les titres de `allowed`. */
function fakeBridge(allowed: string[], opts: { fail?: "restricted" | "filter" | "allows" } = {}) {
  const calls: Calls = { restricted: 0, filter: 0, allows: 0 };
  const ok = new Set(allowed);
  const bridge: ContentPolicyBridge = {
    async isRestricted(userId) {
      calls.restricted++;
      if (opts.fail === "restricted") throw new Error("muet");
      return userId === "kid";
    },
    async filterExternalTitles(_userId, titles) {
      calls.filter++;
      if (opts.fail === "filter") throw new Error("muet");
      return titles.filter((t) => ok.has(`${t.mediaType}:${t.tmdbId}`));
    },
    async allowsExternalTitle(_userId, t) {
      calls.allows++;
      if (opts.fail === "allows") throw new Error("muet");
      return ok.has(`${t.mediaType}:${t.tmdbId}`);
    },
  };
  return { bridge, calls };
}

const items = [
  { id: 1, mediaType: "movie" }, { id: 2, mediaType: "tv" }, { id: 3, mediaType: "person" }, { id: 4, mediaType: "movie" },
];
const keyOf = (i: { id: number; mediaType: string }): ExternalTitle | null =>
  i.mediaType === "person" ? null : { mediaType: i.mediaType as "movie" | "tv", tmdbId: i.id };

afterEach(() => setContentPolicy(null));

test("sans pont (cœur d'avant) : tout passe, comme avant", async () => {
  setContentPolicy(undefined);
  assert.equal(await restrictionFor("kid"), null);
  assert.equal(await filterTitles("kid", items, keyOf), items);
  assert.equal(await allowsTitle("kid", { mediaType: "movie", tmdbId: 1 }), true);
});

test("un pont incomplet vaut l'absence de pont", async () => {
  setContentPolicy({ isRestricted: async () => true });
  assert.equal(await restrictionFor("kid"), null);
});

test("compte libre : chemin court — la même liste, aucun filtrage demandé", async () => {
  const { bridge, calls } = fakeBridge([]);
  setContentPolicy(bridge);
  assert.equal(await filterTitles("adult", items, keyOf), items);
  assert.equal(await allowsTitle("adult", { mediaType: "movie", tmdbId: 1 }), true);
  assert.deepEqual(calls, { restricted: 2, filter: 0, allows: 0 });
});

test("compte restreint : seuls les titres permis, dans l'ordre ; les personnes restent", async () => {
  const { bridge, calls } = fakeBridge(["movie:4", "tv:2"]);
  setContentPolicy(bridge);
  const kept = await filterTitles("kid", items, keyOf);
  assert.deepEqual(kept.map((i) => i.id), [2, 3, 4]);
  assert.equal(calls.filter, 1);
  assert.equal(await allowsTitle("kid", { mediaType: "movie", tmdbId: 1 }), false);
  assert.equal(await allowsTitle("kid", { mediaType: "movie", tmdbId: 4 }), true);
});

test("un même titre deux fois n'est demandé qu'une fois au pont", async () => {
  let asked: ExternalTitle[] = [];
  setContentPolicy({
    isRestricted: async () => true,
    filterExternalTitles: async (_u, titles) => { asked = titles; return titles; },
    allowsExternalTitle: async () => true,
  });
  const twice = [{ id: 7, mediaType: "movie" }, { id: 7, mediaType: "movie" }];
  assert.equal((await filterTitles("kid", twice, keyOf)).length, 2);
  assert.equal(asked.length, 1);
});

test("fermé à l'échec : isRestricted qui lève — plus aucun titre, aucune demande", async () => {
  setContentPolicy(fakeBridge(["movie:1"], { fail: "restricted" }).bridge);
  assert.deepEqual((await filterTitles("adult", items, keyOf)).map((i) => i.id), [3]);
  assert.equal(await allowsTitle("adult", { mediaType: "movie", tmdbId: 1 }), false);
});

test("fermé à l'échec : filterExternalTitles qui lève — liste vide de titres", async () => {
  setContentPolicy(fakeBridge(["movie:1"], { fail: "filter" }).bridge);
  assert.deepEqual((await filterTitles("kid", items, keyOf)).map((i) => i.id), [3]);
});

test("fermé à l'échec : allowsExternalTitle qui lève — refus", async () => {
  setContentPolicy(fakeBridge(["movie:1"], { fail: "allows" }).bridge);
  assert.equal(await allowsTitle("kid", { mediaType: "movie", tmdbId: 1 }), false);
});

test("un compte sans identité, pont présent : refus", async () => {
  setContentPolicy(fakeBridge(["movie:1"]).bridge);
  assert.equal(await allowsTitle("", { mediaType: "movie", tmdbId: 1 }), false);
  assert.equal(await allowsTitle(undefined, { mediaType: "movie", tmdbId: 1 }), false);
});

test("une réponse du pont qui n'est pas une liste ne laisse rien passer", async () => {
  setContentPolicy({
    isRestricted: async () => true,
    filterExternalTitles: async () => null as unknown as ExternalTitle[],
    allowsExternalTitle: async () => "oui" as unknown as boolean,
  });
  assert.deepEqual((await filterTitles("kid", items, keyOf)).map((i) => i.id), [3]);
  assert.equal(await allowsTitle("kid", { mediaType: "movie", tmdbId: 1 }), false);
});
