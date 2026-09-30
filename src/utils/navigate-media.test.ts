import { test } from "node:test";
import assert from "node:assert/strict";
import { libraryIdOf, navigateToMedia } from "./navigate-media";

/*
 * « Voir la série » s'ouvre sur l'élément Jellyfin que Jellyseerr connaît déjà
 * — le lien même qui lui fait dire « Disponible » — sans attendre la
 * résolution par TMDB du serveur (qui, sur certaines versions de Jellyfin,
 * parcourt toute la bibliothèque). Et un échec se dit.
 */

const ID = "0123456789abcdef0123456789abcdef";

test("l'élément Jellyfin connu de Jellyseerr", () => {
  assert.equal(libraryIdOf({ jellyfinMediaId: ID }), ID);
  assert.equal(libraryIdOf({ jellyfinMediaId: "01234567-89ab-cdef-0123-456789abcdef" }), "01234567-89ab-cdef-0123-456789abcdef");
});

test("la version 4K sert de repli", () => {
  assert.equal(libraryIdOf({ jellyfinMediaId: null, jellyfinMediaId4k: ID }), ID);
});

test("rien de sûr : pas d'identifiant", () => {
  assert.equal(libraryIdOf(undefined), null);
  assert.equal(libraryIdOf(null), null);
  assert.equal(libraryIdOf({}), null);
  assert.equal(libraryIdOf({ jellyfinMediaId: "" }), null);
  // Une clé Plex (Overseerr) ou une valeur tronquée n'ouvre pas une fiche vide.
  assert.equal(libraryIdOf({ jellyfinMediaId: "12345" }), null);
  assert.equal(libraryIdOf({ jellyfinMediaId: "../admin" }), null);
});

function withHost<T>(run: (messages: string[], fetches: string[]) => Promise<T>): Promise<T> {
  const messages: string[] = [];
  const fetches: string[] = [];
  const g = globalThis as Record<string, unknown>;
  const saved = { window: g.window, localStorage: g.localStorage, fetch: g.fetch };
  const store = new Map([["tentacle_server_url", "https://tentacle.example/"], ["tentacle_token", "jeton"]]);
  g.window = { ReactNativeWebView: { postMessage: (m: string) => messages.push(m) } };
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null };
  g.fetch = async (url: string) => {
    fetches.push(url);
    return new Response(JSON.stringify({ jellyfinId: null }), { status: 200 });
  };
  return run(messages, fetches).finally(() => Object.assign(g, saved));
}

test("un identifiant connu ouvre la fiche sans rien demander au serveur", () =>
  withHost(async (messages, fetches) => {
    assert.equal(await navigateToMedia(603, "movie", ID), true);
    assert.deepEqual(messages.map((m) => JSON.parse(m)), [{ type: "NAVIGATE", route: `/media/${ID}` }]);
    assert.equal(fetches.length, 0);
  }));

test("sans identifiant : le serveur cherche, et un échec rend faux", () =>
  withHost(async (messages, fetches) => {
    assert.equal(await navigateToMedia(1399, "tv"), false);
    assert.equal(messages.length, 0, "aucune navigation vers une fiche vide");
    // L'adresse enregistrée avec une barre finale ne double plus la barre.
    assert.deepEqual(fetches, ["https://tentacle.example/api/tmdb/resolve?tmdbId=1399&mediaType=tv"]);
  }));
