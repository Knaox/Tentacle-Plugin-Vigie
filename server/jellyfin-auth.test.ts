import { test } from "node:test";
import assert from "node:assert/strict";
import type { VigieDb } from "./storage/vigie-db";
import { jellyfinAuthHeaders } from "./jellyfin-auth";
import { fetchJellyfinAccounts, forgetJellyfinAccounts } from "./jellyfin-users";
import { MARK_LIBRARY, MARK_WATCHED, userMarks } from "./user-marks";

/*
 * Un faux Jellyfin 12 : l'autorisation héritée y est coupée, comme sur le
 * 12.1.0 de production. Seul `Authorization: MediaBrowser … Token="…"` ouvre
 * la porte ; `X-Emby-Token` & co. ne sont plus une source d'identité (401).
 * Un retour à l'ancien en-tête fait échouer ces tests.
 */

const KEY = "cle-du-serveur-tentacle";
const BASE = "http://jellyfin.test/jellyfin";

const db = {
  async query(sql: string) {
    if (sql.includes("server_config")) return [{ k: "jellyfin_url", v: `${BASE}/` }, { k: "jellyfin_api_key", v: KEY }];
    return []; // user_likes, user_ratings : rien pour ces tests
  },
} as unknown as VigieDb;

async function withJellyfin12(routes: Record<string, unknown>, run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    if (!/^MediaBrowser\s/i.test(auth) || !auth.includes(`Token="${KEY}"`)) return new Response("", { status: 401 });
    const body = routes[url.pathname];
    return body === undefined ? new Response("", { status: 404 }) : Response.json(body);
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("l'en-tête MediaBrowser porte la clé, sans rien qui referme la valeur", () => {
  assert.deepEqual(jellyfinAuthHeaders("abc123"), { Authorization: 'MediaBrowser Token="abc123"' });
  assert.deepEqual(jellyfinAuthHeaders(' ab"c 12\n3 '), { Authorization: 'MediaBrowser Token="abc123"' });
});

test("le faux Jellyfin 12 refuse bien X-Emby-Token", async () => {
  await withJellyfin12({ "/jellyfin/Users": [] }, async () => {
    const res = await fetch(`${BASE}/Users`, { headers: { "X-Emby-Token": KEY } });
    assert.equal(res.status, 401);
  });
});

test("Jellyfin 12 : la synchro voit de nouveau les comptes", async () => {
  forgetJellyfinAccounts();
  await withJellyfin12({
    "/jellyfin/Users": [
      { Id: "b52628a704304f06a682f6037183b976", Name: "Knaoxtest", Policy: { IsAdministrator: false, IsDisabled: false } },
      { Id: "0f0e0d0c0b0a09080706050403020100", Name: "Ancien", Policy: { IsDisabled: true } },
    ],
  }, async () => {
    const accounts = await fetchJellyfinAccounts(db);
    assert.deepEqual(accounts.map((a) => [a.name, a.isDisabled]), [["Knaoxtest", false], ["Ancien", true]]);
  });
  forgetJellyfinAccounts();
});

test("Jellyfin 12 : les affiches gardent les marques de la bibliothèque", async () => {
  const userId = "b52628a704304f06a682f6037183b976";
  await withJellyfin12({
    [`/jellyfin/Users/${userId}/Items`]: { Items: [{ Type: "Movie", ProviderIds: { Tmdb: "603" }, UserData: { Played: true } }] },
  }, async () => {
    const { items } = await userMarks(db, userId);
    assert.deepEqual(items, [["movie", 603, MARK_LIBRARY | MARK_WATCHED, 0]]);
  });
});
