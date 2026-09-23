import { test } from "node:test";
import assert from "node:assert/strict";
import { countByGroup, groupOf, groupRequests, recentlyArrived } from "./requestGroups";
import type { LocalRequest } from "../api/types";

function req(id: string, status: LocalRequest["status"], createdAt = "2026-09-01T10:00:00Z", extra: Partial<LocalRequest> = {}): LocalRequest {
  return {
    id, jellyfinUserId: "u", username: "u", mediaType: "movie", tmdbId: 1, title: id, posterPath: null,
    backdropPath: null, overview: null, year: null, seasons: null, status, seerrRequestId: null, seerrMediaId: null,
    seerrMediaStatus: null, retryCount: 0, maxRetries: 10, lastError: null, priority: 0, createdAt,
    updatedAt: createdAt, sentAt: null, completedAt: null, profileId: null, ...extra,
  };
}

test("treize statuts, trois questions : ça arrive, c'est là, ça coince", () => {
  for (const s of ["queued", "processing", "sent_to_seer", "approved", "unavailable", "downloading", "retry_pending"] as const) {
    assert.equal(groupOf({ status: s }), "active", s);
  }
  assert.equal(groupOf({ status: "available" }), "available");
  assert.equal(groupOf({ status: "failed" }), "attention");
  assert.equal(groupOf({ status: "delete_failed" }), "attention");
  assert.equal(groupOf({ status: "deleting" }), "archived");
  assert.equal(groupOf({ status: "deleted" }), "archived");
});

test("une série en partie là qui récupère encore des épisodes est en cours", () => {
  assert.equal(groupOf({ status: "partially_available" }, true), "active");
});

test("en partie là, elle a son groupe : pas rangée parmi ce qui est là en entier", () => {
  assert.equal(groupOf({ status: "partially_available" }, false), "partial");
  assert.equal(groupOf({ status: "available" }), "available");
});

test("les plus récentes d'abord, dans chaque groupe", () => {
  const groups = groupRequests([
    req("a", "queued", "2026-09-01T10:00:00Z"),
    req("b", "downloading", "2026-09-10T10:00:00Z"),
    req("c", "available"),
  ]);
  assert.deepEqual(groups.get("active")?.map((r) => r.id), ["b", "a"]);
  assert.deepEqual(groups.get("available")?.map((r) => r.id), ["c"]);
});

test("les compteurs suivent les statistiques du serveur", () => {
  assert.deepEqual(countByGroup({ queued: 2, downloading: 1, partially_available: 2, available: 5, failed: 1, deleted: 3 }), {
    active: 3, partial: 2, available: 5, attention: 1, archived: 3,
  });
});

test("arrivée récemment : sept jours après l'arrivée", () => {
  const now = Date.parse("2026-09-23T12:00:00Z");
  assert.equal(recentlyArrived(req("x", "available", "2026-09-01T00:00:00Z", { completedAt: "2026-09-20T00:00:00Z" }), now), true);
  assert.equal(recentlyArrived(req("y", "available", "2026-09-01T00:00:00Z", { completedAt: "2026-09-01T00:00:00Z" }), now), false);
  assert.equal(recentlyArrived(req("z", "queued"), now), false);
});
