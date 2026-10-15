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
const { openSqlite } = await import(`${REPO}/apps/backend/src/services/database/nodeSqlite.ts`);

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
/* Certifications SIMULÉES (aucun appel à TMDB) dans le cache des fiches du cœur : film n
 * → FR « U » si n % 3 = 1 (permis à une note max de 10), « 12 » si n % 3 = 2, « 18 » sinon.
 * Avant le démarrage du backend, dans CE processus : jamais à côté de son Prisma. */
const certOf = (n: number) => (n % 3 === 1 ? "U" : n % 3 === 2 ? "12" : "18");
const sqlite = openSqlite(db.path);
try {
  const insert = sqlite.prepare(`INSERT INTO "tmdb_meta_cache" ("mediaType", "tmdbId", "payload", "fetchedAt", "expiresAt") VALUES ('movie', ?, ?, ?, ?)`);
  const now = Date.now();
  for (let n = 1; n <= 1100; n++) {
    const payload = { id: n, adult: false, release_dates: { results: [{ iso_3166_1: "FR", release_dates: [{ certification: certOf(n) }] }] } };
    insert.run(n, JSON.stringify(payload), now, now + 30 * 86400_000);
  }
} finally {
  sqlite.close();
}
log("certifications simulées : 1100 films (FR U / 12 / 18)");
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
const ids = (r: any) => (r.json?.results ?? []).map((x: any) => x.id) as number[];
const allU = (list: number[]) => list.every((n) => n % 3 === 1);
for (const who of ["adulte", "enfant"]) {
  const tok = await login(who);
  const p1 = await call(tok, "GET", "/seerr/api/v1/discover/movies?page=1&_lang=fr");
  const p2 = await call(tok, "GET", "/seerr/api/v1/discover/movies?page=2&_lang=fr");
  const similar = await call(tok, "GET", "/seerr/api/v1/movie/7/similar?page=1&_lang=fr");
  const ficheU = await call(tok, "GET", "/seerr/api/v1/movie/7?_lang=fr");
  const fiche12 = await call(tok, "GET", "/seerr/api/v1/movie/8?_lang=fr");
  const saga = await call(tok, "GET", "/seerr/api/v1/collection/9?_lang=fr");
  const state = await call(tok, "GET", "/titles/state?keys=movie:7,movie:8&lang=fr");
  const before = await posted();
  const hubU = await call(tok, "POST", "/requests", { mediaType: "movie", tmdbId: 10, title: "Film 10" });
  const hub18 = await call(tok, "POST", "/requests", { mediaType: "movie", tmdbId: 9, title: "Film 9" });
  const card12 = await call(tok, "POST", "/titles/request", { mediaType: "movie", tmdbId: who === "adulte" ? 11 : 8, lang: "fr" });
  const i1 = ids(p1), i2 = ids(p2);
  rows.push({
    compte: who,
    "découverte p1": `${i1.length} titres ${i1[0]}…${i1.at(-1)} · total ${p1.json?.totalResults}${allU(i1) ? " · tous U" : ""}`,
    "découverte p2": `${i2.length} titres, dès ${i2[0]}${allU(i2) ? " · tous U" : ""}`,
    semblables: `${ids(similar).length} titres`,
    "fiche U / 12": `${ficheU.status} / ${fiche12.status}${fiche12.json?.code ? ` ${fiche12.json.code}` : ""}`,
    "saga (1 U, 2 « 12 »)": (saga.json?.parts ?? []).map((x: any) => x.id).join(",") || "vide",
    "titles.state 8": JSON.stringify(state.json?.items?.["movie:8"]?.request ?? null),
    "demande U / 18": `${hubU.status} / ${hub18.status}${hub18.json?.code ? ` ${hub18.json.code}` : ""}`,
    "carte « 12 »": card12.json?.ok ? "ok" : `refus : ${card12.json?.message}`,
    "POST Jellyseerr": (await posted()) - before,
  });
}
console.table(rows);
writeFileSync(join(RUN, "report.json"), JSON.stringify(rows, null, 2));
const policyLines = backend.lines.filter((l: { text: string }) => /vigie-policy|contentPolicy|\[PluginBackend\].*seer/.test(l.text)).map((l: { text: string }) => l.text);
console.log(policyLines.slice(-8).join("\n"));
await backend.stop?.();
process.exit(0);
