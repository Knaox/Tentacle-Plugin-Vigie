import { test } from "node:test";
import assert from "node:assert/strict";
import { isMaskedTitle, liftBlocklist, parseTagSet } from "./blocklist";
import { normalizeConfig } from "./plugin-config";

/*
 * Un titre masqué ne se demande que si l'administrateur l'a permis ; le
 * worker retire alors le titre de la liste de blocage de Jellyseerr juste
 * avant d'envoyer la demande — sans quoi Jellyseerr la refuse.
 */

const TAGS = parseTagSet("210024, 9951");

test("masqué : sur la liste de blocage de Jellyseerr (statut 6)", () => {
  assert.equal(isMaskedTitle({ mediaInfo: { status: 6 }, keywords: [] }, TAGS), true);
});

test("masqué : un mot-clé bloqué", () => {
  assert.equal(isMaskedTitle({ keywords: [{ id: 818 }, { id: 9951 }] }, TAGS), true);
});

test("pas masqué : ni statut 6, ni mot-clé bloqué", () => {
  assert.equal(isMaskedTitle({ mediaInfo: { status: 5 }, keywords: [{ id: 818 }] }, TAGS), false);
  assert.equal(isMaskedTitle({}, TAGS), false);
  assert.equal(isMaskedTitle({ keywords: [null, {}] }, TAGS), false);
  assert.equal(isMaskedTitle({ keywords: [{ id: 9951 }] }, new Set()), false, "aucun mot-clé bloqué");
});

test("l'option est éteinte par défaut, et ne s'allume que franchement", () => {
  assert.equal(normalizeConfig({}).allowMaskedRequests, false);
  assert.equal(normalizeConfig({ allowMaskedRequests: "true" }).allowMaskedRequests, false);
  assert.equal(normalizeConfig({ allowMaskedRequests: true }).allowMaskedRequests, true);
});

function withFetch(replies: number[], run: (calls: string[]) => Promise<void>): Promise<void> {
  const g = globalThis as { fetch: typeof fetch };
  const saved = g.fetch;
  const calls: string[] = [];
  g.fetch = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    return new Response(null, { status: replies[calls.length - 1] ?? 500 });
  }) as typeof fetch;
  return run(calls).finally(() => { g.fetch = saved; });
}

test("le blocage se lève par la route `blocklist`", () =>
  withFetch([204], async (calls) => {
    assert.equal(await liftBlocklist("http://seerr", "clé", "movie", 603), true);
    assert.deepEqual(calls, ["DELETE http://seerr/api/v1/blocklist/603?mediaType=movie"]);
  }));

test("un Jellyseerr d'avant la 2.x : la route s'appelait `blacklist`", () =>
  withFetch([404, 204], async (calls) => {
    assert.equal(await liftBlocklist("http://seerr", "clé", "tv", 1399), true);
    assert.deepEqual(calls, [
      "DELETE http://seerr/api/v1/blocklist/1399?mediaType=tv",
      "DELETE http://seerr/api/v1/blacklist/1399?mediaType=tv",
    ]);
  }));

test("un refus n'est pas un succès", () =>
  withFetch([403], async (calls) => {
    assert.equal(await liftBlocklist("http://seerr", "clé", "movie", 603), false);
    assert.equal(calls.length, 1, "un 403 ne se rejoue pas sous l'autre nom");
  }));
