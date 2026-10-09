import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { json, stubFetch, type FetchCall } from "../test-support/fake-http";
import { RequestIndexState } from "./request-index";
import { applyIncremental, signatureOf, toIndexed, vanished, type IndexedRequest } from "./request-index-model";

/*
 * Savoir qu'une demande a été supprimée dans Jellyseerr sans relire chaque
 * demande : une question d'une ligne tant que rien ne bouge, la page des
 * dernières modifications quand quelque chose bouge, tout relire seulement
 * quand le total dit qu'il en manque.
 */

const SEERR = "http://seerr.test";
const cfg = { seerrUrl: SEERR, seerrApiKey: "k" };

interface FakeRequest { id: number; status: number; updatedAt: string; tmdbId: number; type: "movie" | "tv"; seasons?: number[] }

function row(r: FakeRequest) {
  return {
    id: r.id, status: r.status, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: r.updatedAt, type: r.type,
    media: { tmdbId: r.tmdbId, mediaType: r.type, status: 5 },
    seasons: (r.seasons ?? []).map((seasonNumber) => ({ seasonNumber })),
    requestedBy: { id: 7, jellyfinUserId: "u1", displayName: "Alice" },
  };
}

/** Un Jellyseerr : ses demandes, triées comme il les trie. */
function fakeSeerr(store: FakeRequest[]) {
  return (c: FetchCall) => {
    const url = new URL(c.url);
    if (url.pathname !== "/api/v1/request") return null;
    const take = Number(url.searchParams.get("take"));
    const skip = Number(url.searchParams.get("skip"));
    const sorted = [...store].sort((a, b) => url.searchParams.get("sort") === "modified"
      ? b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id
      : b.id - a.id);
    return json({ pageInfo: { results: store.length }, results: sorted.slice(skip, skip + take).map(row) });
  };
}

let net: ReturnType<typeof stubFetch> | null = null;
let store: FakeRequest[];

beforeEach(() => {
  store = [
    { id: 1, status: 5, updatedAt: "2026-10-01T10:00:00.000Z", tmdbId: 603, type: "movie" },
    { id: 2, status: 2, updatedAt: "2026-10-02T10:00:00.000Z", tmdbId: 1399, type: "tv", seasons: [1, 2] },
  ];
  net = stubFetch([fakeSeerr(store)]);
});
afterEach(() => { net?.restore(); net = null; });

test("la ligne de Jellyseerr réduite à ce qui compte", () => {
  const r = toIndexed(row(store[1]));
  assert.deepEqual(r, {
    id: 2, status: 2, is4k: false, mediaType: "tv", tmdbId: 1399, seasons: [1, 2],
    requestedBy: { seerrUserId: 7, jellyfinUserId: "u1", name: "Alice" },
    createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T10:00:00.000Z", mediaStatus: 5,
  });
  assert.equal(toIndexed({ id: 3, status: 1 }), null);
  assert.deepEqual(signatureOf({ pageInfo: { results: 2 }, results: [row(store[1])] }), { total: 2, topId: 2, topUpdatedAt: "2026-10-02T10:00:00.000Z" });
});

test("l'index se lit, puis ne coûte qu'une ligne tant que rien ne bouge", async () => {
  const index = new RequestIndexState();
  const first = await index.poll(cfg);
  // Première lecture : tout est nouveau, rien n'a disparu.
  assert.deepEqual(first, { changed: [], deleted: [] });
  assert.equal(index.ready, true);
  assert.equal(index.requestsFor("movie", 603)?.length, 1);
  assert.equal(index.exists(2), true);
  assert.equal(index.exists(99), false);

  const calls = net!.calls.length;
  assert.equal(await index.poll(cfg), null);
  assert.equal(net!.calls.length - calls, 1, "une seule question tant que rien ne bouge");
  assert.ok(net!.calls.at(-1)!.url.includes("take=1"));
});

test("une demande supprimée dans Jellyseerr : vue à la passe suivante", async () => {
  const index = new RequestIndexState();
  await index.poll(cfg);
  const gen = index.generation;
  store.splice(0, 1); // la demande du film disparaît
  const change = await index.poll(cfg);
  assert.ok(change);
  assert.deepEqual(change.deleted.map((r) => r.id), [1]);
  assert.equal(index.exists(1), false);
  assert.deepEqual(index.requestsFor("movie", 603), []);
  assert.ok(index.generation > gen);
});

test("une demande supprimée ET une autre ajoutée dans la même fenêtre : rien n'échappe", async () => {
  const index = new RequestIndexState();
  await index.poll(cfg);
  store.splice(0, 1);
  store.push({ id: 3, status: 1, updatedAt: "2026-10-09T10:00:00.000Z", tmdbId: 27205, type: "movie" });
  const change = await index.poll(cfg);
  assert.ok(change);
  assert.deepEqual(change.deleted.map((r) => r.id), [1]);
  assert.ok(change.changed.some((r) => r.id === 3));
  assert.equal(index.requestsFor("movie", 27205)?.length, 1);
});

test("une demande modifiée (validée) : la page des modifications suffit", async () => {
  const index = new RequestIndexState();
  await index.poll(cfg);
  store[0] = { ...store[0], status: 2, updatedAt: "2026-10-09T11:00:00.000Z" };
  const before = net!.calls.length;
  const change = await index.poll(cfg);
  assert.deepEqual(change?.changed.map((r) => r.id), [1]);
  assert.deepEqual(change?.deleted, []);
  const urls = net!.calls.slice(before).map((c) => c.url);
  assert.equal(urls.length, 2, "l'empreinte puis la page des modifications, pas de relecture complète");
  assert.ok(urls.every((u) => u.includes("sort=modified")));
});

test("Jellyseerr muet : pas de relance à chaque passe, l'index garde ce qu'il sait", async () => {
  const index = new RequestIndexState();
  await index.poll(cfg);
  net!.restore();
  net = stubFetch([() => { throw new TypeError("fetch failed"); }]);
  assert.equal(await index.poll(cfg), null);
  const after = net.calls.length;
  assert.equal(await index.poll(cfg), null);
  assert.equal(net.calls.length, after, "pas de nouvelle tentative avant la fin de l'attente");
  assert.equal(index.exists(1), true);
});

test("le modèle : supprimées, ajoutées, rafale, relecture tronquée", () => {
  const known = (id: number, updatedAt = "a"): IndexedRequest => ({
    id, status: 2, is4k: false, mediaType: "movie", tmdbId: id, seasons: [],
    requestedBy: { seerrUserId: null, jellyfinUserId: null, name: null }, createdAt: null, updatedAt, mediaStatus: null,
  });
  const byId = () => new Map([[1, known(1)], [2, known(2)]]);
  // Une modification : appliquée.
  assert.equal(applyIncremental(byId(), [known(2, "b")], 50, 2).kind, "applied");
  // Une suppression : le total baisse → relecture.
  assert.equal(applyIncremental(byId(), [known(2, "b")], 50, 1).kind, "reload");
  // Une page entière de nouveautés : il y en a peut-être d'autres → relecture.
  assert.equal(applyIncremental(byId(), [known(3), known(4)], 2, 4).kind, "reload");
  // Des demandes jamais lues (relecture tronquée) comptent dans le total.
  assert.equal(applyIncremental(byId(), [known(2, "b")], 50, 5, 3).kind, "applied");
  // Disparues : sous la plus ancienne lue d'une relecture tronquée, rien ne se conclut.
  assert.deepEqual(vanished(new Map([[1, known(1)], [7, known(7)], [9, known(9)]]), [known(9), known(6)], true), [7]);
  assert.deepEqual(vanished(new Map([[1, known(1)], [5, known(5)]]), [known(5)], false), [1]);
});
