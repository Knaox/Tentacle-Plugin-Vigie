/*
 * Banc « droits-vigie » : le VRAI cœur (branche du socle, pont ctx.contentPolicy),
 * un Jellyfin 10.11 JETABLE (droits-vigie-jf, 18141), un faux Jellyseerr (18142),
 * Vigie de la branche lot-droits/vigie installée. Un compte restreint (`enfant`,
 * MaxParentalRating=10) et un compte libre (`adulte`) passent par les mêmes routes.
 *
 *   node fake-seerr.mjs &            # le faux Jellyseerr, port 18142
 *   cd <Tentacle-TV>/apps/backend && REPO=<Tentacle-TV> VIGIE=<ce dépôt> RUN=<dossier jetable> \
 *     npx tsx <ce dépôt>/scripts/banc-droits/banc.mts
 *   docker stop droits-vigie-jf      # à la fin ; `docker rm` + volumes `droits-vigie-jf-*` pour tout effacer
 *
 * Vigie doit être construite (`npm run build`) : le banc installe `server/index.mjs`.
 */
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const REPO = process.env.REPO!;
const VIGIE = process.env.VIGIE!;
const RUN = process.env.RUN!;
const T = `${REPO}/apps/backend/test/jellyfin-compat`;
const { containerState, docker, startJellyfin } = await import(`${T}/docker.ts`);
const { JellyfinHttp } = await import(`${T}/jellyfinHttp.ts`);
const { waitForServer, completeWizard, authenticate, ensureApiKey, ensureUser, COMPAT_PASSWORD } = await import(`${T}/provision.ts`);
const { startDatabase, seedBackendConfig, startBackend } = await import(`${T}/backendEnv.ts`);

const JF_PORT = 18141, SEERR = "http://127.0.0.1:18142", PORT = 3141;
const log = (l: string) => console.log(`[banc] ${l}`);
const name = "droits-vigie-jf";
if (containerState(name) === "missing") {
  docker(["volume", "create", `${name}-media`]);
  startJellyfin({ name, image: "jellyfin/jellyfin:10.11", port: JF_PORT, configVolume: `${name}-config`, cacheVolume: `${name}-cache`, mediaVolume: `${name}-media` });
} else if (containerState(name) === "stopped") docker(["start", name]);
const jfUrl = `http://127.0.0.1:${JF_PORT}`;
const http = new JellyfinHttp(jfUrl);
log(`Jellyfin ${(await waitForServer(http)).Version}`);
await completeWizard(http);
const admin = await authenticate(http, "compat-admin");
const apiKey = await ensureApiKey(http, admin.token);
const kidId = await ensureUser(http, admin.token, "enfant");
await ensureUser(http, admin.token, "adulte");
const kid = await http.get<{ Policy: Record<string, unknown> }>(`/Users/${kidId}`, admin.token);
await http.post(`/Users/${kidId}/Policy`, { ...kid.Policy, MaxParentalRating: 10 }, admin.token);
log("comptes : enfant (MaxParentalRating=10), adulte (libre)");

mkdirSync(RUN, { recursive: true });
const db = startDatabase(RUN, log);
seedBackendConfig(db, { jellyfinUrl: jfUrl, apiKey, adminUserId: admin.id });
const plugins = join(db.dataDir, "plugins");
mkdirSync(join(plugins, "seer", "server"), { recursive: true });
cpSync(`${VIGIE}/plugin.json`, join(plugins, "seer", "plugin.json"));
cpSync(`${VIGIE}/server/index.mjs`, join(plugins, "seer", "server", "index.mjs"));
writeFileSync(join(plugins, "installed.json"), JSON.stringify([{
  id: "banc-seer", pluginId: "seer", sourceId: "official", name: "Vigie", version: "banc", enabled: true,
  config: { url: SEERR, apiKey: "fake", enabled: true }, installedAt: new Date().toISOString(),
}], null, 2));
const backend = await startBackend({ port: PORT, db, runDir: RUN });
log(`backend :${PORT}`);
await new Promise((r) => setTimeout(r, 3000));

const base = `http://127.0.0.1:${PORT}`;
async function login(username: string): Promise<string> {
  const res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: COMPAT_PASSWORD }) });
  if (!res.ok) throw new Error(`login ${username} ${res.status} ${await res.text()}`);
  return ((await res.json()) as { AccessToken: string }).AccessToken;
}
async function call(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}/api/plugins/seer${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: res.status, json };
}
const rows: Array<Record<string, unknown>> = [];
const posted = async () => ((await (await fetch(`${SEERR}/__posted`)).json()) as { posted: unknown[] }).posted.length;
for (const who of ["adulte", "enfant"]) {
  const tok = await login(who);
  const p1 = await call(tok, "GET", "/seerr/api/v1/discover/movies?page=1&_lang=fr");
  const p2 = await call(tok, "GET", "/seerr/api/v1/discover/movies?page=2&_lang=fr");
  const fiche = await call(tok, "GET", "/seerr/api/v1/movie/7?_lang=fr");
  const saga = await call(tok, "GET", "/seerr/api/v1/collection/9?_lang=fr");
  const state = await call(tok, "GET", "/titles/state?keys=movie:7&lang=fr");
  const before = await posted();
  const hub = await call(tok, "POST", "/requests", { mediaType: "movie", tmdbId: 7, title: "Film 7" });
  const card = await call(tok, "POST", "/titles/request", { mediaType: "movie", tmdbId: 8, lang: "fr" });
  rows.push({
    compte: who,
    "découverte p1": `${p1.status} · ${p1.json?.results?.length} titres · total ${p1.json?.totalResults}${p1.json?.vigieDense ? " (pleine)" : ""}`,
    "découverte p2": `${p2.status} · ${p2.json?.results?.length} titres`,
    fiche: `${fiche.status}${fiche.json?.code ? ` ${fiche.json.code}` : ` « ${fiche.json?.title} »`}`,
    saga: `${saga.status} · ${saga.json?.parts?.length} volets`,
    "titles.state": JSON.stringify(state.json?.items?.["movie:7"]?.request ?? null),
    "demande hub": `${hub.status}${hub.json?.code ? ` ${hub.json.code}` : ""}`,
    "demande carte": card.json?.ok ? "ok" : `refus : ${card.json?.message}`,
    "POST Jellyseerr": (await posted()) - before,
  });
}
console.table(rows);
writeFileSync(join(RUN, "report.json"), JSON.stringify(rows, null, 2));
const policyLines = backend.lines.filter((l: { text: string }) => /vigie-policy|contentPolicy|\[PluginBackend\].*seer/.test(l.text)).map((l: { text: string }) => l.text);
console.log(policyLines.slice(-8).join("\n"));
await backend.stop?.();
process.exit(0);
