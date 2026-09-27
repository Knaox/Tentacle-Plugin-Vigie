import { test } from "node:test";
import assert from "node:assert/strict";
import type { SeerrSearchResult } from "../api/types";
import { partsHere, sortParts } from "./collection";

const part = (id: number, releaseDate?: string, status?: number): SeerrSearchResult => ({
  id, mediaType: "movie", releaseDate, ...(status ? { mediaInfo: { status } } : {}),
});

test("les volets se rangent par date de sortie, les inconnus à la fin", () => {
  const sorted = sortParts([part(3, "2010-06-23"), part(9), part(1, "2008-11-20"), part(2, "2009-11-18")]);
  assert.deepEqual(sorted.map((p) => p.id), [1, 2, 3, 9]);
});

test("disponible ou en partie compte comme là ; demandé, non", () => {
  assert.equal(partsHere([part(1, undefined, 5), part(2, undefined, 4), part(3, undefined, 3), part(4)]), 2);
});
