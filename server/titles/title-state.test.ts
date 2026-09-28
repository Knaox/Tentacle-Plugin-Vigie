import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TITLE_KEYS, parseTitleKeys, seasonsHref, titleBadge, titleStateFor } from "./title-state";
import { refusalMessage, requestedMessage } from "./title-messages";

/*
 * Ce que Tentacle montre de nos titres sur SES cartes doit dire la même chose
 * que l'affiche du hub : les mêmes mots, et le même « + » — un film pas encore
 * demandé d'un geste, une série tant qu'elle n'est pas entièrement là.
 */

const ALL = { movies: true, tv: true };

test("un film jamais demandé se demande d'un geste", () => {
  assert.deepEqual(titleStateFor("movie", 603, undefined, ALL, "fr"), {
    badge: null,
    request: { mode: "direct", label: "Demander" },
  });
  // Supprimé chez Jellyseerr, ou inconnu : on peut le redemander.
  assert.equal(titleStateFor("movie", 603, 7, ALL, "fr").request?.mode, "direct");
  assert.equal(titleStateFor("movie", 603, 1, ALL, "fr").request?.mode, "direct");
});

test("un film demandé, en route, là ou masqué n'offre plus rien", () => {
  for (const status of [2, 3, 4, 5, 6]) {
    assert.equal(titleStateFor("movie", 603, status, ALL, "fr").request, null, String(status));
  }
  assert.deepEqual(titleStateFor("movie", 603, 3, ALL, "fr").badge, { label: "Demandé", tone: "info" });
});

test("une série ouvre ses saisons libres dans le hub, tant qu'elle n'est pas entièrement là", () => {
  assert.deepEqual(titleStateFor("tv", 1399, undefined, ALL, "fr").request, {
    mode: "open", label: "Choisir les saisons", href: "/discover?request=tv:1399",
  });
  assert.equal(titleStateFor("tv", 1399, 4, ALL, "en").request?.label, "Request more seasons");
  assert.equal(titleStateFor("tv", 1399, 5, ALL, "fr").request, null);
  assert.equal(titleStateFor("tv", 1399, 6, ALL, "fr").request, null);
  assert.equal(seasonsHref(1399), "/discover?request=tv:1399");
});

test("les droits du compte retirent le geste, jamais la pastille", () => {
  assert.equal(titleStateFor("movie", 603, undefined, { movies: false, tv: true }, "fr").request, null);
  const tv = titleStateFor("tv", 1399, 4, { movies: true, tv: false }, "fr");
  assert.equal(tv.request, null);
  assert.deepEqual(tv.badge, { label: "En partie", tone: "success" });
});

test("les mots de l'affiche, sans jamais la famille de « téléchargement »", () => {
  for (const status of [2, 3, 4, 5, 6]) {
    const badge = titleBadge(status, "fr");
    assert.ok(badge);
    assert.doesNotMatch(badge.label, /télécharg|download/i);
  }
  assert.equal(titleBadge(1, "fr"), null);
  assert.equal(titleBadge(undefined, "en"), null);
});

test("les clés d'une question : valides, uniques, bornées", () => {
  assert.deepEqual(parseTitleKeys("movie:603, tv:1399,movie:603,series:1,movie:0,tv:abc"), [
    { key: "movie:603", mediaType: "movie", tmdbId: 603 },
    { key: "tv:1399", mediaType: "tv", tmdbId: 1399 },
  ]);
  const many = Array.from({ length: MAX_TITLE_KEYS + 10 }, (_, i) => `movie:${i + 1}`).join(",");
  assert.equal(parseTitleKeys(many).length, MAX_TITLE_KEYS);
  assert.deepEqual(parseTitleKeys(undefined), []);
});

test("les phrases rendues à Tentacle après un geste", () => {
  assert.equal(requestedMessage("Dune", "fr"), "« Dune » est demandé — vous serez prévenu à son arrivée.");
  assert.equal(refusalMessage(409, {}, "fr"), "Ce titre est déjà demandé.");
  assert.equal(refusalMessage(429, { errorKey: "seer:errQuotaReached", limit: 3 }, "en"), "Limit reached: 3 requests per day.");
  assert.equal(refusalMessage(403, { errorKey: "seer:errUserBlocked" }, "fr"), "Votre compte ne peut pas faire de demandes.");
  assert.equal(refusalMessage(500, {}, "fr"), "La demande n'a pas abouti.");
});
