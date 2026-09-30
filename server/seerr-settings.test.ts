import { test } from "node:test";
import assert from "node:assert/strict";
import { getBlocklistedTags } from "./blocklist";
import { specialSeasonsEnabled, specialSeasonsQuick } from "./seerr-settings";

/*
 * La saison 0 ne se propose que si Jellyseerr la laisse demander — et `GET
 * /config`, appelé au montage de Vigie, n'attend jamais un Jellyseerr lent.
 */

function withFetch(reply: (url: string) => Promise<Response>, run: (calls: string[]) => Promise<void>): Promise<void> {
  const g = globalThis as { fetch: typeof fetch };
  const saved = g.fetch;
  const calls: string[] = [];
  g.fetch = (async (url: string) => { calls.push(url); return reply(url); }) as typeof fetch;
  return run(calls).finally(() => { g.fetch = saved; });
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

test("le réglage de Jellyseerr décide, et une seule lecture sert aux deux usages", () =>
  withFetch(async () => json({ enableSpecialEpisodes: true, blocklistedTags: "9951,818" }), async (calls) => {
    assert.equal(await specialSeasonsEnabled("http://seerr-a", "clé"), true);
    assert.equal(await getBlocklistedTags("http://seerr-a", "clé"), "9951,818");
    assert.deepEqual(calls, ["http://seerr-a/api/v1/settings/main"], "gardé en cache");
  }));

test("éteint ou absent : pas de saison 0", () =>
  withFetch(async () => json({ enableSpecialEpisodes: false }), async () => {
    assert.equal(await specialSeasonsEnabled("http://seerr-b", "clé"), false);
  }));

test("Jellyseerr injoignable : non, sans erreur", () =>
  withFetch(async () => { throw new Error("ECONNREFUSED"); }, async () => {
    assert.equal(await specialSeasonsEnabled("http://seerr-c", "clé"), false);
  }));

test("un Jellyseerr qui traîne ne fait pas attendre la configuration", () =>
  withFetch(() => new Promise<Response>(() => {}), async () => {
    const started = Date.now();
    assert.equal(await specialSeasonsQuick("http://seerr-d", "clé", 50), false);
    assert.ok(Date.now() - started < 1_000);
  }));
