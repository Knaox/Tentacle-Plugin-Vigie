import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverSortBy } from "./discover-sort";

/* Les valeurs que Seerr 3.5 accepte (MovieSortOptionsIterable / TvSortOptionsIterable). */
const MOVIE = ["popularity", "vote_average", "vote_count", "release_date", "revenue", "primary_release_date", "original_title"];
const TV = ["popularity", "vote_average", "vote_count", "first_air_date", "original_name"];

test("le tri par titre d'une série passe par original_name", () => {
  assert.equal(discoverSortBy("tv", "title", "asc"), "original_name.asc");
  assert.equal(discoverSortBy("movies", "title", "desc"), "original_title.desc");
});

test("chaque tri proposé est une valeur que Seerr accepte pour ce type", () => {
  for (const sortBy of ["popularity", "vote_average", "release_date", "title"] as const) {
    for (const order of ["asc", "desc"] as const) {
      assert.ok(MOVIE.includes(discoverSortBy("movies", sortBy, order).split(".")[0]), `movies ${sortBy}`);
      assert.ok(TV.includes(discoverSortBy("tv", sortBy, order).split(".")[0]), `tv ${sortBy}`);
    }
  }
});
