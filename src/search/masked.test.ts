import { test } from "node:test";
import assert from "node:assert/strict";
import type { VigieSearchResponse } from "../api/types-search";
import { countMasked, withoutMasked } from "./masked";

function response(over: Partial<VigieSearchResponse>): VigieSearchResponse {
  return {
    query: "q", searched: "q", correction: null, year: null, type: null, complete: true, top: null,
    movies: [], series: [], people: [], facets: [], page: 1, hasMore: false,
    blockedCount: 0, blockedActive: true, indexing: false, tookMs: 1, ...over,
  };
}

test("les titres masqués se comptent une fois, meilleur résultat compris", () => {
  const hidden = { id: 1, mediaType: "movie" as const, masked: true };
  const data = response({
    top: { kind: "media", item: hidden },
    movies: [hidden, { id: 2, mediaType: "movie" }],
    series: [{ id: 3, mediaType: "tv", masked: true }],
  });
  assert.equal(countMasked(data), 2);
});

test("re-masquer retire les titres masqués, meilleur résultat compris", () => {
  const data = withoutMasked(response({
    top: { kind: "media", item: { id: 1, mediaType: "movie", masked: true } },
    movies: [{ id: 1, mediaType: "movie", masked: true }, { id: 2, mediaType: "movie" }],
  }));
  assert.equal(data.top, null);
  assert.deepEqual(data.movies.map((m) => m.id), [2]);
});

test("un meilleur résultat qui est une personne reste", () => {
  const person = { kind: "person" as const, person: { id: 9, mediaType: "person" as const, name: "N", popularity: 1, knownFor: [] } };
  assert.equal(withoutMasked(response({ top: person })).top, person);
});
