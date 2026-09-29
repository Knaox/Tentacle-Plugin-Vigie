import { test } from "node:test";
import assert from "node:assert/strict";
import { isReadableSeerrPath } from "./proxy-allowlist";

test("les lectures du catalogue que fait l'interface passent", () => {
  for (const path of [
    "api/v1/discover/movies", "api/v1/discover/tv", "api/v1/discover/trending",
    "api/v1/discover/movies/upcoming", "api/v1/search",
    "api/v1/movie/603", "api/v1/tv/1399", "api/v1/movie/603/similar", "api/v1/tv/1399/similar",
    "api/v1/tv/1399/season/2", "api/v1/person/6384", "api/v1/person/6384/combined_credits",
    "api/v1/collection/2344",
  ]) assert.equal(isReadableSeerrPath("GET", path), true, path);
});

test("les réglages, les comptes et les demandes ne passent pas", () => {
  for (const path of [
    "api/v1/settings/main", "api/v1/settings/sonarr", "api/v1/settings/jellyfin",
    "api/v1/user", "api/v1/user/5", "api/v1/request", "api/v1/request/12/approve",
    "api/v1/media", "api/v1/auth/me", "api/v1/movie/603/../../settings/main", "api/v1/movie/603x",
  ]) assert.equal(isReadableSeerrPath("GET", path), false, path);
});

test("une écriture ne passe jamais, même sur le catalogue", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(isReadableSeerrPath(method, "api/v1/movie/603"), false, method);
  }
});
