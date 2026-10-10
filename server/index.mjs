// Seer Plugin — Server module (auto-generated, do not edit)

// server/index.ts
import { dirname } from "path";
import { fileURLToPath } from "url";

// server/storage/schema.ts
function col(name, create, add = create.replace(/\bNOT NULL\b(?!.*DEFAULT)/, "")) {
  return { name, create, add: add.trim() };
}
var TABLES = [
  {
    name: "seer_requests",
    columns: [
      col("id", "TEXT NOT NULL"),
      col("jellyfin_user_id", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT ''"),
      col("username", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT ''"),
      col("media_type", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT 'movie'"),
      col("tmdb_id", "INTEGER NOT NULL", "INTEGER NOT NULL DEFAULT 0"),
      col("title", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT ''"),
      col("poster_path", "TEXT"),
      col("backdrop_path", "TEXT"),
      col("overview", "TEXT"),
      col("year", "TEXT"),
      col("seasons", "TEXT"),
      col("status", "TEXT NOT NULL DEFAULT 'queued'"),
      col("seerr_request_id", "INTEGER"),
      col("seerr_media_id", "INTEGER"),
      col("seerr_media_status", "INTEGER"),
      col("retry_count", "INTEGER NOT NULL DEFAULT 0"),
      col("max_retries", "INTEGER NOT NULL DEFAULT 10"),
      col("last_error", "TEXT"),
      col("priority", "INTEGER NOT NULL DEFAULT 0"),
      col("created_at", "DATETIME NOT NULL", "DATETIME"),
      col("updated_at", "DATETIME NOT NULL", "DATETIME"),
      col("sent_at", "DATETIME"),
      col("completed_at", "DATETIME"),
      col("pending_cleanup_id", "TEXT"),
      col("profile_id", "TEXT"),
      col("is_anime", "INTEGER NOT NULL DEFAULT 0"),
      col("notified_seasons", "TEXT"),
      col("origin", "TEXT"),
      col("platform", "TEXT")
    ],
    primaryKey: ["id"],
    indexes: [
      { name: "idx_seer_req_user", columns: "jellyfin_user_id" },
      { name: "idx_seer_req_status", columns: "status" },
      { name: "idx_seer_req_queue", columns: "status, priority DESC, created_at ASC" }
    ]
  },
  {
    name: "seer_cleanup_queue",
    columns: [
      col("id", "TEXT NOT NULL"),
      col("action", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT 'delete'"),
      col("media_type", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT 'movie'"),
      col("tmdb_id", "INTEGER NOT NULL", "INTEGER NOT NULL DEFAULT 0"),
      col("title", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT ''"),
      col("seerr_request_id", "INTEGER"),
      col("seerr_media_id", "INTEGER"),
      col("delete_files", "INTEGER NOT NULL DEFAULT 1"),
      col("retry_count", "INTEGER NOT NULL DEFAULT 0"),
      col("max_retries", "INTEGER NOT NULL DEFAULT 20"),
      col("last_error", "TEXT"),
      col("status", "TEXT NOT NULL DEFAULT 'pending'"),
      col("created_at", "DATETIME NOT NULL", "DATETIME"),
      col("next_retry_at", "DATETIME NOT NULL", "DATETIME"),
      col("request_id", "TEXT"),
      col("seasons", "TEXT"),
      col("jellyfin_user_id", "TEXT")
    ],
    primaryKey: ["id"],
    indexes: [{ name: "idx_cleanup_status", columns: "status, next_retry_at" }]
  },
  {
    name: "seer_user_settings",
    columns: [
      col("jellyfin_user_id", "TEXT NOT NULL"),
      col("username", "TEXT NOT NULL", "TEXT NOT NULL DEFAULT ''"),
      col("blocked", "INTEGER NOT NULL DEFAULT 0"),
      col("daily_limit", "INTEGER"),
      col("allow_movies", "INTEGER NOT NULL DEFAULT 1"),
      col("allow_tv", "INTEGER NOT NULL DEFAULT 1"),
      col("allow_anime", "INTEGER NOT NULL DEFAULT 1"),
      col("jellyseerr_user_id", "INTEGER"),
      col("jellyseerr_last_sync", "DATETIME"),
      col("created_at", "DATETIME NOT NULL", "DATETIME"),
      col("updated_at", "DATETIME NOT NULL", "DATETIME")
    ],
    primaryKey: ["jellyfin_user_id"],
    indexes: [{ name: "idx_seer_user_seerrid", columns: "jellyseerr_user_id" }]
  },
  {
    name: "seer_tmdb_cache",
    columns: [
      col("media_type", "TEXT NOT NULL"),
      col("tmdb_id", "INTEGER NOT NULL"),
      col("title", "TEXT NOT NULL DEFAULT ''"),
      col("poster_path", "TEXT"),
      col("backdrop_path", "TEXT"),
      col("overview", "TEXT"),
      col("release_date", "TEXT"),
      col("tmdb_status", "TEXT"),
      col("digital_date", "TEXT"),
      col("theatrical_date", "TEXT"),
      col("physical_date", "TEXT"),
      col("release_region", "TEXT"),
      col("next_air_date", "TEXT"),
      col("next_season", "INTEGER"),
      col("next_episode", "INTEGER"),
      col("last_air_date", "TEXT"),
      col("networks", "TEXT"),
      col("provider_ids", "TEXT"),
      col("vote_average", "REAL"),
      col("popularity", "REAL"),
      col("original_language", "TEXT"),
      col("genre_ids", "TEXT"),
      col("is_anime", "INTEGER NOT NULL DEFAULT 0"),
      col("fetched_at", "DATETIME NOT NULL", "DATETIME"),
      col("expires_at", "DATETIME NOT NULL", "DATETIME")
    ],
    primaryKey: ["media_type", "tmdb_id"],
    indexes: [
      { name: "idx_tmdbc_expires", columns: "expires_at" },
      { name: "idx_tmdbc_next_air", columns: "next_air_date" },
      { name: "idx_tmdbc_digital", columns: "digital_date" }
    ]
  },
  {
    name: "seer_search_titles",
    columns: [
      col("media_type", "TEXT NOT NULL"),
      col("tmdb_id", "INTEGER NOT NULL"),
      col("lang", "TEXT NOT NULL"),
      col("title", "TEXT NOT NULL DEFAULT ''"),
      col("original_title", "TEXT"),
      col("release_date", "TEXT"),
      col("popularity", "REAL"),
      col("vote_count", "INTEGER"),
      col("vote_average", "REAL"),
      col("poster_path", "TEXT"),
      col("backdrop_path", "TEXT"),
      col("original_language", "TEXT"),
      col("genre_ids", "TEXT"),
      col("updated_at", "DATETIME NOT NULL", "DATETIME")
    ],
    primaryKey: ["media_type", "tmdb_id", "lang"],
    indexes: []
  },
  {
    name: "seer_search_meta",
    columns: [
      col("meta_key", "TEXT NOT NULL"),
      col("meta_value", "TEXT NOT NULL DEFAULT ''"),
      col("updated_at", "DATETIME NOT NULL", "DATETIME")
    ],
    primaryKey: ["meta_key"],
    indexes: []
  }
];
function createTableSql(table) {
  const columns = table.columns.map((c) => `${c.name} ${c.create}`);
  return `CREATE TABLE IF NOT EXISTS ${table.name} (${[...columns, `PRIMARY KEY (${table.primaryKey.join(", ")})`].join(", ")})`;
}

// server/storage/migrations.ts
async function reconcileTable(db, table) {
  const existing = new Set((await db.columns(table.name)).map((c) => c.toLowerCase()));
  if (existing.size === 0) {
    await db.execute(createTableSql(table));
  } else {
    const missingKey = table.primaryKey.filter((k) => !existing.has(k));
    if (missingKey.length > 0) {
      throw new Error(`${table.name} existe sans sa cl\xE9 (${missingKey.join(", ")}) \u2014 rien n'est modifi\xE9`);
    }
    for (const column of table.columns) {
      if (existing.has(column.name)) continue;
      await db.execute(`ALTER TABLE ${table.name} ADD COLUMN ${column.name} ${column.add}`);
      console.log(`[SeerDB] Colonne ajout\xE9e : ${table.name}.${column.name}`);
    }
  }
  for (const index of table.indexes) {
    await db.execute(`CREATE INDEX IF NOT EXISTS ${index.name} ON ${table.name} (${index.columns})`);
  }
}
var MIGRATIONS = [
  {
    version: 1,
    name: "tables de Vigie (cr\xE9ation ou reconnaissance)",
    up: async (db) => {
      for (const table of TABLES) await reconcileTable(db, table);
    }
  }
];

// server/storage/vigie-db.ts
function bindParams(params) {
  return params.map((value) => {
    if (value === void 0) return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "boolean") return value ? 1 : 0;
    return value;
  });
}
function wrap(queries) {
  return {
    dialect: queries.dialect,
    sql: queries.sql,
    query: (sql, ...params) => queries.query(sql, ...bindParams(params)),
    execute: (sql, ...params) => queries.execute(sql, ...bindParams(params)),
    columns: (table) => queries.columns(table),
    tableExists: (table) => queries.tableExists(table)
  };
}
function createVigieDb(storage, core) {
  return {
    ...wrap(storage),
    transaction: (fn) => storage.transaction((tx) => fn(wrap(tx))),
    core
  };
}
function usableStorage(storage) {
  if (!storage || typeof storage !== "object") return false;
  const s = storage;
  return s.dialect === "sqlite" && typeof s.query === "function" && typeof s.execute === "function" && typeof s.transaction === "function" && typeof s.migrate === "function" && !!s.sql;
}

// server/storage/startup.ts
async function openVigieDb(ctx) {
  if (!usableStorage(ctx.storage)) {
    console.error(
      "[SeerBackend] Pas de base SQLite pr\xEAt\xE9e par Tentacle (ctx.storage) : Vigie exige Tentacle 1.25.0 ou plus r\xE9cent. Rien n'est d\xE9marr\xE9, aucune donn\xE9e n'est touch\xE9e."
    );
    return null;
  }
  const applied = await ctx.storage.migrate(MIGRATIONS);
  if (applied.length > 0) console.log(`[SeerDB] Migrations appliqu\xE9es : ${applied.join(", ")}`);
  const core = ctx.getPrisma?.() ?? null;
  if (!core) throw new Error("[SeerBackend] Client du c\u0153ur absent (getPrisma) : notifications impossibles");
  const db = createVigieDb(ctx.storage, core);
  const [{ cnt }] = await db.query("SELECT COUNT(*) AS cnt FROM seer_requests");
  console.log(`[SeerDB] Base pr\xEAte \u2014 ${cnt} demande(s)`);
  return db;
}

// server/plugin-config.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, renameSync as renameSync2, statSync, writeFileSync as writeFileSync2 } from "fs";
import { resolve as resolve2 } from "path";

// server/nav-label.ts
import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { resolve } from "path";
var DEFAULT_NAV_LABEL = "Vigie";
var NAV_LABEL_MAX = 24;
var NAME_SUFFIX_FALLBACK = " \u2014 Jellyseerr (unofficial)";
function cleanNavLabel(raw) {
  if (typeof raw !== "string") return "";
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+[—–-]\s+/g, " \xB7 ").replace(/\s+/g, " ").trim();
  return Array.from(cleaned).slice(0, NAV_LABEL_MAX).join("").trim();
}
function cleanNavLabels(raw) {
  if (typeof raw === "string") {
    const one = cleanNavLabel(raw);
    return { fr: one, en: one };
  }
  const input = raw && typeof raw === "object" ? raw : {};
  return { fr: cleanNavLabel(input.fr), en: cleanNavLabel(input.en) };
}
function resolvedLabels(labels) {
  return {
    fr: labels.fr || labels.en || DEFAULT_NAV_LABEL,
    en: labels.en || labels.fr || DEFAULT_NAV_LABEL
  };
}
var sameLabels = (value, wanted) => {
  const labels = value ?? {};
  return labels.fr === wanted.fr && labels.en === wanted.en && Object.keys(labels).length === 2;
};
function manifestWithLabels(manifest, labels) {
  if (!Array.isArray(manifest.navItems)) return null;
  const wanted = resolvedLabels(labels);
  let changed = false;
  const navItems = manifest.navItems.map((item) => {
    if (item.admin === true || sameLabels(item.labels, wanted)) return item;
    changed = true;
    return { ...item, labels: { ...wanted } };
  });
  let tab = manifest.tab;
  if (tab && !sameLabels(tab.labels, wanted)) {
    tab = { ...tab, labels: { ...wanted } };
    changed = true;
  }
  return changed ? { ...manifest, navItems, ...tab ? { tab } : {} } : null;
}
function displayNameWithLabel(manifestName, label) {
  const wanted = label || DEFAULT_NAV_LABEL;
  const name = manifestName ?? "";
  const dash = name.indexOf(" \u2014 ");
  return `${wanted}${dash >= 0 ? name.slice(dash) : NAME_SUFFIX_FALLBACK}`;
}
function writeJsonAtomic(path, value) {
  const tmp = `${path}.vigie-${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}
function applyNavLabel(pluginDir, pluginId, rawLabels) {
  const labels = cleanNavLabels(rawLabels);
  try {
    const manifestPath = resolve(pluginDir, "plugin.json");
    if (!existsSync(manifestPath)) return;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    let changed = false;
    const nextManifest = manifestWithLabels(manifest, labels);
    if (nextManifest) {
      writeJsonAtomic(manifestPath, nextManifest);
      changed = true;
    }
    const installedPath2 = resolve(pluginDir, "..", "installed.json");
    if (existsSync(installedPath2)) {
      const installed = JSON.parse(readFileSync(installedPath2, "utf-8"));
      const entry = installed.find((p) => p.pluginId === pluginId || p.id === pluginId);
      const name = displayNameWithLabel(manifest.name, labels.fr || labels.en);
      if (entry && entry.name !== name) {
        entry.name = name;
        writeJsonAtomic(installedPath2, installed);
        changed = true;
      }
    }
    if (changed) {
      const shown = resolvedLabels(labels);
      console.log(`[SeerBackend] Nom de l'onglet : \xAB ${shown.fr} \xBB / \xAB ${shown.en} \xBB`);
    }
  } catch (err) {
    console.warn("[SeerBackend] Nom de l'onglet non appliqu\xE9 :", err);
  }
}

// server/plugin-config.ts
var cfgCache = null;
function installedPath(pluginDir) {
  return resolve2(pluginDir, "..", "installed.json");
}
function findEntry(installed, pluginId) {
  if (!Array.isArray(installed)) return void 0;
  return installed.find(
    (p) => p.pluginId === pluginId || p.id === pluginId
  );
}
function readPluginConfig(pluginDir, pluginId) {
  try {
    const path = installedPath(pluginDir);
    if (!existsSync2(path)) return {};
    const mtimeMs = statSync(path).mtimeMs;
    if (cfgCache && cfgCache.mtimeMs === mtimeMs) return cfgCache.value;
    const entry = findEntry(JSON.parse(readFileSync2(path, "utf-8")), pluginId);
    const value = entry?.config || {};
    cfgCache = { mtimeMs, value };
    return value;
  } catch {
    return {};
  }
}
function normalizeConfig(body, previous = {}) {
  const input = body && typeof body === "object" ? body : {};
  const forget = input.deleteRequestsWithMedia === true;
  const since = Number(previous.deleteRequestsWithMediaSince);
  const limit = Math.floor(Number(input.userLimit));
  const { navLabel: legacyLabel, ...rest } = input;
  return {
    ...rest,
    url: typeof input.url === "string" ? input.url.trim() : "",
    apiKey: typeof input.apiKey === "string" ? input.apiKey.trim() : "",
    enabled: input.enabled === true,
    autoApprove: input.autoApprove === true,
    // Les titres masqués (liste de blocage, mots-clés bloqués) se demandent-ils ?
    // Non par défaut : le masquage est un choix de l'administrateur.
    allowMaskedRequests: input.allowMaskedRequests === true,
    // Un titre supprimé de Jellyfin emporte sa demande (live/auto-forget.ts) ?
    // Non par défaut. L'instant d'activation est posé ICI, jamais par le
    // client : seules les suppressions qui le suivent sont concernées.
    deleteRequestsWithMedia: forget,
    deleteRequestsWithMediaSince: forget ? previous.deleteRequestsWithMedia === true && Number.isFinite(since) && since > 0 ? since : Date.now() : null,
    userLimit: Number.isFinite(limit) && limit > 0 ? limit : 0,
    // Un nom par langue ; l'ancienne forme (un seul nom) est reprise pour les deux.
    navLabels: cleanNavLabels(input.navLabels ?? legacyLabel),
    profiles: Array.isArray(input.profiles) ? input.profiles : []
  };
}
function navLabelsOf(config) {
  return cleanNavLabels(config.navLabels ?? config.navLabel);
}
function writePluginConfig(pluginDir, pluginId, body) {
  const path = installedPath(pluginDir);
  if (!existsSync2(path)) return null;
  const installed = JSON.parse(readFileSync2(path, "utf-8"));
  const entry = findEntry(installed, pluginId);
  if (!entry) return null;
  const config = normalizeConfig(body, entry.config ?? {});
  entry.config = config;
  const tmp = `${path}.vigie-${process.pid}.tmp`;
  writeFileSync2(tmp, JSON.stringify(installed, null, 2));
  renameSync2(tmp, path);
  applyNavLabel(pluginDir, pluginId, config.navLabels);
  return config;
}
function defaultDailyLimit(config) {
  const n = Math.floor(Number(config.userLimit));
  return Number.isFinite(n) && n > 0 ? n : null;
}
function effectiveDailyLimit(own, fallback) {
  if (own === -1) return null;
  return own ?? fallback;
}

// server/cache.ts
var store = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
var REFRESH_BACKOFF_MS = 3e4;
async function cached(key, ttlMs, loader, opts) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value;
  if (hit && hit.stale > now) {
    const backoffOver = !hit.failedAt || now - hit.failedAt > REFRESH_BACKOFF_MS;
    if (backoffOver && !inflight.has(key)) {
      void refresh(key, ttlMs, loader, opts).catch(() => {
      });
    }
    return hit.value;
  }
  const pending2 = inflight.get(key);
  if (pending2) return pending2;
  return refresh(key, ttlMs, loader, opts);
}
function refresh(key, ttlMs, loader, opts) {
  const p = (async () => {
    try {
      const value = await loader();
      put(key, value, opts?.ttlFor?.(value) ?? ttlMs, opts?.staleMs ?? 0);
      return value;
    } catch (err) {
      const prev = store.get(key);
      if (prev) prev.failedAt = Date.now();
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
function put(key, value, ttlMs, staleMs = 0) {
  const expires = Date.now() + ttlMs;
  store.set(key, { value, expires, stale: expires + staleMs });
}
function peek(key, allowStale = false) {
  const hit = store.get(key);
  if (!hit) return void 0;
  const now = Date.now();
  if (hit.expires > now) return hit.value;
  if (allowStale && hit.stale > now) return hit.value;
  return void 0;
}
function invalidate(prefix) {
  for (const key of Array.from(store.keys())) {
    if (key === prefix || key.startsWith(prefix + ":")) {
      store.delete(key);
    }
  }
}
function invalidateRequestCaches(userId) {
  invalidate(userId ? `seer-cache:${userId}` : "seer-cache");
  invalidate("seer:rows:everyone");
  invalidate("seer:cal:everyone");
  invalidate("seer:requested:index");
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.stale <= now) store.delete(key);
  }
}, 6e4).unref?.();

// server/seerr-settings.ts
function getSeerrMainSettings(seerrUrl2, apiKey) {
  return cached(`seerr:settingsMain:${seerrUrl2}`, 5 * 6e4, async () => {
    try {
      const res = await fetch(`${seerrUrl2}/api/v1/settings/main`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8e3)
      });
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {};
    }
  }, { staleMs: 24 * 36e5 });
}
async function specialSeasonsEnabled(seerrUrl2, apiKey) {
  return (await getSeerrMainSettings(seerrUrl2, apiKey)).enableSpecialEpisodes === true;
}
function specialSeasonsQuick(seerrUrl2, apiKey, capMs = 400) {
  let timer3;
  const late = new Promise((resolve3) => {
    timer3 = setTimeout(() => resolve3(false), capMs);
  });
  return Promise.race([specialSeasonsEnabled(seerrUrl2, apiKey), late]).finally(() => clearTimeout(timer3));
}

// server/db-helpers.ts
function uuid() {
  return crypto.randomUUID();
}
function rowToRequest(r) {
  return {
    id: r.id,
    jellyfinUserId: r.jellyfin_user_id,
    username: r.username,
    mediaType: r.media_type,
    tmdbId: r.tmdb_id,
    title: r.title,
    posterPath: r.poster_path || null,
    backdropPath: r.backdrop_path || null,
    overview: r.overview || null,
    year: r.year || null,
    seasons: r.seasons ? typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons : null,
    notifiedSeasons: r.notified_seasons ? typeof r.notified_seasons === "string" ? JSON.parse(r.notified_seasons) : r.notified_seasons : null,
    status: r.status,
    seerrRequestId: r.seerr_request_id || null,
    seerrMediaId: r.seerr_media_id || null,
    seerrMediaStatus: r.seerr_media_status || null,
    retryCount: r.retry_count || 0,
    maxRetries: r.max_retries || 10,
    lastError: r.last_error || null,
    priority: r.priority || 0,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    sentAt: r.sent_at ? toIso(r.sent_at) : null,
    completedAt: r.completed_at ? toIso(r.completed_at) : null,
    pendingCleanupId: r.pending_cleanup_id || null,
    profileId: r.profile_id || null,
    isAnime: Boolean(r.is_anime),
    origin: r.origin || null,
    platform: r.platform || null
  };
}
function rowToUserSettings(r) {
  return {
    jellyfinUserId: r.jellyfin_user_id,
    username: r.username,
    blocked: Boolean(r.blocked),
    dailyLimit: r.daily_limit === null || r.daily_limit === void 0 ? null : Number(r.daily_limit),
    allowMovies: Boolean(r.allow_movies),
    allowTv: Boolean(r.allow_tv),
    allowAnime: Boolean(r.allow_anime),
    jellyseerrUserId: r.jellyseerr_user_id === null || r.jellyseerr_user_id === void 0 ? null : Number(r.jellyseerr_user_id),
    jellyseerrLastSync: r.jellyseerr_last_sync ? toIso(r.jellyseerr_last_sync) : null,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at)
  };
}
function readStoredDate(v) {
  if (v === null || v === void 0 || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number" || typeof v === "bigint") return new Date(Number(v));
  if (typeof v !== "string") return null;
  if (/^\d+$/.test(v)) return new Date(Number(v));
  const text2 = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(v) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? `${v.replace(" ", "T")}Z` : v;
  const d = new Date(text2);
  return Number.isNaN(d.getTime()) ? null : d;
}
function toIso(v) {
  return (readStoredDate(v) ?? /* @__PURE__ */ new Date()).toISOString();
}

// server/db-origin.ts
var warned = false;
async function recordRequestOrigin(db, id, origin) {
  try {
    await db.execute(
      `UPDATE seer_requests SET updated_at = ${db.sql.now()}, origin = ?, platform = ? WHERE id = ?`,
      origin.origin,
      origin.platform,
      id
    );
  } catch (err) {
    if (!warned) console.warn("[SeerDB] Origine de la demande non gard\xE9e :", err);
    warned = true;
  }
}

// server/db-queries.ts
async function getUserRequests(db, jellyfinUserId, opts) {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;
  let where = `WHERE jellyfin_user_id = ? AND status != 'deleted'`;
  const params = [jellyfinUserId];
  if (opts.status) {
    const statuses2 = opts.status.split(",").map((s) => s.trim());
    where += ` AND status IN (${statuses2.map(() => "?").join(",")})`;
    params.push(...statuses2);
  }
  if (opts.mediaType) {
    where += ` AND media_type = ?`;
    params.push(opts.mediaType);
  }
  const countRows = await db.query(
    `SELECT COUNT(*) as cnt FROM seer_requests ${where}`,
    ...params
  );
  const total = Number(countRows[0].cnt);
  const rows = await db.query(
    `SELECT * FROM seer_requests ${where} ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return { results: rows.map(rowToRequest), total, page, pages: Math.ceil(total / limit) || 1 };
}
async function getAllRequests(db, opts) {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 100);
  const offset = (page - 1) * limit;
  let where = `WHERE status != 'deleted'`;
  const params = [];
  if (opts.status) {
    const statuses2 = opts.status.split(",").map((s) => s.trim());
    where += ` AND status IN (${statuses2.map(() => "?").join(",")})`;
    params.push(...statuses2);
  }
  if (opts.mediaType) {
    where += ` AND media_type = ?`;
    params.push(opts.mediaType);
  }
  const countRows = await db.query(
    `SELECT COUNT(*) as cnt FROM seer_requests ${where}`,
    ...params
  );
  const total = Number(countRows[0].cnt);
  const rows = await db.query(
    `SELECT * FROM seer_requests ${where} ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return { results: rows.map(rowToRequest), total, page, pages: Math.ceil(total / limit) || 1 };
}
async function getQueueStatus(db, jellyfinUserId) {
  const userFilter = jellyfinUserId ? ` AND jellyfin_user_id = ?` : "";
  const userParams = jellyfinUserId ? [jellyfinUserId] : [];
  const processingRows = await db.query(
    `SELECT * FROM seer_requests WHERE status = 'processing'${userFilter} ORDER BY id ASC LIMIT 1`,
    ...userParams
  );
  const countRows = await db.query(
    `SELECT
       SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
       SUM(CASE WHEN status = 'retry_pending' THEN 1 ELSE 0 END) as retry_pending,
       SUM(CASE WHEN status = 'deleting' THEN 1 ELSE 0 END) as deleting
     FROM seer_requests WHERE status IN ('queued', 'retry_pending', 'deleting')${userFilter}`,
    ...userParams
  );
  return {
    processing: processingRows.length > 0 ? rowToRequest(processingRows[0]) : null,
    queued: Number(countRows[0].queued) || 0,
    retryPending: Number(countRows[0].retry_pending) || 0,
    deleting: Number(countRows[0].deleting) || 0
  };
}
async function getUserStats(db, jellyfinUserId) {
  const byStatus = await db.query(
    `SELECT status, COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ? AND status != 'deleted'
     GROUP BY status`,
    jellyfinUserId
  );
  const byType = await db.query(
    `SELECT media_type, COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ? AND status != 'deleted'
     GROUP BY media_type`,
    jellyfinUserId
  );
  const total = byStatus.reduce((n, r) => n + Number(r.cnt), 0);
  return {
    totalRequests: total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.cnt)])),
    byType: Object.fromEntries(byType.map((r) => [r.media_type, Number(r.cnt)]))
  };
}
async function getGlobalStats(db) {
  const byStatus = await db.query(
    `SELECT status, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY status`
  );
  const byType = await db.query(
    `SELECT media_type, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY media_type`
  );
  const topRequested = await db.query(
    `SELECT title, tmdb_id, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY title, tmdb_id ORDER BY cnt DESC, title ASC, tmdb_id ASC LIMIT 10`
  );
  const topUsers = await db.query(
    `SELECT jellyfin_user_id, username, MAX(created_at) AS last_at, COUNT(*) as cnt FROM seer_requests
     WHERE status != 'deleted' GROUP BY jellyfin_user_id ORDER BY cnt DESC, username ASC, jellyfin_user_id ASC LIMIT 10`
  );
  const total = byStatus.reduce((n, r) => n + Number(r.cnt), 0);
  const available = Number(byStatus.find((r) => r.status === "available")?.cnt || 0);
  return {
    totalRequests: total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.cnt)])),
    byType: Object.fromEntries(byType.map((r) => [r.media_type, Number(r.cnt)])),
    topRequested: topRequested.map((r) => ({ title: r.title, tmdbId: r.tmdb_id, count: Number(r.cnt) })),
    topUsers: topUsers.map((r) => ({ username: r.username, count: Number(r.cnt) })),
    successRate: total > 0 ? Math.round(available / total * 100) : 0
  };
}

// server/db-cleanup.ts
function parseSeasons(raw) {
  if (raw == null) return null;
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) {
      const nums = arr.map(Number).filter((n) => Number.isFinite(n));
      return nums.length > 0 ? nums : null;
    }
  } catch {
  }
  return null;
}
async function enqueueCleanup(db, job) {
  const id = uuid();
  const delay = Math.max(0, Math.floor(job.delaySeconds ?? 0));
  await db.execute(
    `INSERT INTO seer_cleanup_queue (id, action, media_type, tmdb_id, title, seerr_request_id, seerr_media_id, delete_files, seasons, request_id, jellyfin_user_id, created_at, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${db.sql.now()}, ${db.sql.shiftedNow(delay, "second")})`,
    id,
    job.action,
    job.mediaType,
    job.tmdbId,
    job.title,
    job.seerrRequestId ?? null,
    job.seerrMediaId ?? null,
    job.deleteFiles ? 1 : 0,
    job.seasons && job.seasons.length > 0 ? JSON.stringify(job.seasons) : null,
    job.requestId ?? null,
    job.jellyfinUserId ?? null
  );
  return id;
}
async function getPendingCleanups(db, limit = 25) {
  const rows = await db.query(
    `SELECT * FROM seer_cleanup_queue
     WHERE status = 'pending' AND next_retry_at <= ${db.sql.now()}
     ORDER BY created_at ASC, id ASC LIMIT ${Math.max(1, Math.min(100, limit))}`
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    mediaType: r.media_type,
    tmdbId: r.tmdb_id,
    title: r.title,
    seerrRequestId: r.seerr_request_id || null,
    seerrMediaId: r.seerr_media_id || null,
    deleteFiles: Boolean(r.delete_files),
    seasons: parseSeasons(r.seasons),
    retryCount: r.retry_count || 0,
    maxRetries: r.max_retries || 20,
    lastError: r.last_error || null,
    status: r.status,
    nextRetryAt: toIso(r.next_retry_at),
    requestId: r.request_id || null,
    jellyfinUserId: r.jellyfin_user_id || null
  }));
}
async function updateCleanupJob(db, id, status, extra) {
  const sets = ["status = ?"];
  const params = [status];
  if (extra?.lastError !== void 0) {
    sets.push("last_error = ?");
    params.push(extra.lastError);
  }
  if (extra?.retryCount !== void 0) {
    sets.push("retry_count = ?");
    params.push(extra.retryCount);
  }
  if (extra?.nextRetryAt !== void 0) {
    sets.push("next_retry_at = ?");
    params.push(extra.nextRetryAt);
  }
  params.push(id);
  await db.execute(`UPDATE seer_cleanup_queue SET ${sets.join(", ")} WHERE id = ?`, ...params);
}
async function clearPendingCleanup(db, cleanupId) {
  await db.execute(
    `UPDATE seer_requests SET updated_at = ${db.sql.now()}, pending_cleanup_id = NULL WHERE pending_cleanup_id = ?`,
    cleanupId
  );
}
async function cancelCleanupsForRequest(db, requestId) {
  return db.execute(
    `DELETE FROM seer_cleanup_queue WHERE request_id = ? AND status <> 'completed'`,
    requestId
  );
}

// server/db-claims.ts
async function upsertContentClaim(db, tmdbId, jellyfinUserId, mediaType, title, ttlSeconds) {
  const expiresAt = db.sql.dateParam(new Date(Date.now() + ttlSeconds * 1e3));
  await db.execute(
    db.sql.upsert({
      table: "content_claims",
      columns: ["tmdbId", "jellyfinUserId", "mediaType", "title", "expiresAt"],
      conflict: ["tmdbId", "jellyfinUserId"],
      update: ["mediaType", "title", "expiresAt"]
    }),
    tmdbId,
    jellyfinUserId,
    mediaType,
    title,
    expiresAt
  );
}
async function purgeExpiredContentClaims(db) {
  await db.execute(`DELETE FROM content_claims WHERE expiresAt < ${db.sql.now()}`);
}

// server/db-users.ts
async function getOrCreateUserSettings(db, jellyfinUserId, username) {
  const rows = await db.query(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId
  );
  if (rows.length > 0) {
    if (username && rows[0].username !== username) {
      await db.execute(
        `UPDATE seer_user_settings SET updated_at = ${db.sql.now()}, username = ? WHERE jellyfin_user_id = ?`,
        username,
        jellyfinUserId
      );
      rows[0].username = username;
    }
    return rowToUserSettings(rows[0]);
  }
  await db.execute(
    `INSERT INTO seer_user_settings
      (jellyfin_user_id, username, blocked, daily_limit, allow_movies, allow_tv, allow_anime, created_at, updated_at)
     VALUES (?, ?, 0, NULL, 1, 1, 1, ${db.sql.now()}, ${db.sql.now()})`,
    jellyfinUserId,
    username || jellyfinUserId
  );
  const created = await db.query(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId
  );
  return rowToUserSettings(created[0]);
}
async function getUserSettings(db, jellyfinUserId) {
  const rows = await db.query(
    `SELECT * FROM seer_user_settings WHERE jellyfin_user_id = ?`,
    jellyfinUserId
  );
  return rows.length > 0 ? rowToUserSettings(rows[0]) : null;
}
async function updateUserSettings(db, jellyfinUserId, patch) {
  const sets = [];
  const params = [];
  if (patch.blocked !== void 0) {
    sets.push("blocked = ?");
    params.push(patch.blocked ? 1 : 0);
  }
  if (patch.dailyLimit !== void 0) {
    sets.push("daily_limit = ?");
    params.push(patch.dailyLimit);
  }
  if (patch.allowMovies !== void 0) {
    sets.push("allow_movies = ?");
    params.push(patch.allowMovies ? 1 : 0);
  }
  if (patch.allowTv !== void 0) {
    sets.push("allow_tv = ?");
    params.push(patch.allowTv ? 1 : 0);
  }
  if (patch.allowAnime !== void 0) {
    sets.push("allow_anime = ?");
    params.push(patch.allowAnime ? 1 : 0);
  }
  if (patch.jellyseerrUserId !== void 0) {
    sets.push("jellyseerr_user_id = ?");
    params.push(patch.jellyseerrUserId);
  }
  if (patch.jellyseerrLastSync !== void 0) {
    sets.push("jellyseerr_last_sync = ?");
    params.push(patch.jellyseerrLastSync);
  }
  if (patch.username !== void 0) {
    sets.push("username = ?");
    params.push(patch.username);
  }
  if (sets.length === 0) return;
  params.push(jellyfinUserId);
  await db.execute(
    `UPDATE seer_user_settings SET updated_at = ${db.sql.now()}, ${sets.join(", ")} WHERE jellyfin_user_id = ?`,
    ...params
  );
}
async function countRequestsToday(db, jellyfinUserId) {
  const rows = await db.query(
    `SELECT COUNT(*) as cnt FROM seer_requests
     WHERE jellyfin_user_id = ?
       AND created_at >= ${db.sql.startOfToday()}
       AND status NOT IN ('failed', 'deleted')`,
    jellyfinUserId
  );
  return Number(rows[0].cnt);
}

// server/db.ts
async function createRequest(db, data) {
  const id = uuid();
  await db.execute(
    `INSERT INTO seer_requests
      (id, jellyfin_user_id, username, media_type, tmdb_id, title, poster_path,
       backdrop_path, overview, year, seasons, status, priority, profile_id, is_anime,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ${db.sql.now()}, ${db.sql.now()})`,
    id,
    data.jellyfinUserId,
    data.username,
    data.mediaType,
    data.tmdbId,
    data.title,
    data.posterPath || null,
    data.backdropPath || null,
    data.overview || null,
    data.year || null,
    data.seasons ? JSON.stringify(data.seasons) : null,
    data.priority || 0,
    data.profileId || null,
    data.isAnime ? 1 : 0
  );
  if (data.origin) await recordRequestOrigin(db, id, data.origin);
  const rows = await db.query(
    `SELECT * FROM seer_requests WHERE id = ?`,
    id
  );
  return rowToRequest(rows[0]);
}
async function getRequestById(db, id) {
  const rows = await db.query(
    `SELECT * FROM seer_requests WHERE id = ?`,
    id
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function updateRequestStatus(db, id, status, extra) {
  const sets = ["status = ?"];
  const params = [status];
  if (extra?.seerrRequestId !== void 0) {
    sets.push("seerr_request_id = ?");
    params.push(extra.seerrRequestId);
  }
  if (extra?.seerrMediaId !== void 0) {
    sets.push("seerr_media_id = ?");
    params.push(extra.seerrMediaId);
  }
  if (extra?.seerrMediaStatus !== void 0) {
    sets.push("seerr_media_status = ?");
    params.push(extra.seerrMediaStatus);
  }
  if (extra?.lastError !== void 0) {
    sets.push("last_error = ?");
    params.push(extra.lastError);
  }
  if (extra?.retryCount !== void 0) {
    sets.push("retry_count = ?");
    params.push(extra.retryCount);
  }
  if (extra?.sentAt !== void 0) {
    sets.push("sent_at = ?");
    params.push(extra.sentAt);
  }
  if (extra?.completedAt !== void 0) {
    sets.push("completed_at = ?");
    params.push(extra.completedAt);
  }
  params.push(id);
  await db.execute(`UPDATE seer_requests SET updated_at = ${db.sql.now()}, ${sets.join(", ")} WHERE id = ?`, ...params);
}
async function deleteRequestById(db, id) {
  await db.execute(`DELETE FROM seer_requests WHERE id = ?`, id);
}
async function findDuplicate(db, jellyfinUserId, tmdbId, mediaType, seasons) {
  const rows = await db.query(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = ?
       AND status NOT IN ('deleted', 'failed', 'available', 'deleting', 'delete_failed')`,
    jellyfinUserId,
    tmdbId,
    mediaType
  );
  if (rows.length === 0) return null;
  if (mediaType === "movie") return rowToRequest(rows[0]);
  const requestedSeasons = new Set(seasons ?? []);
  if (requestedSeasons.size === 0) return rowToRequest(rows[0]);
  for (const row of rows) {
    const existing = rowToRequest(row);
    const existingSeasons = new Set(existing.seasons ?? []);
    if (existingSeasons.size === 0) return existing;
    for (const s of requestedSeasons) {
      if (existingSeasons.has(s)) return existing;
    }
  }
  return null;
}
async function findExistingTvRequest(db, jellyfinUserId, tmdbId) {
  const rows = await db.query(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = 'tv'
       AND status NOT IN ('deleted', 'deleting', 'delete_failed', 'available', 'failed')
     ORDER BY created_at DESC, id ASC LIMIT 1`,
    jellyfinUserId,
    tmdbId
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function addSeasonsToRequest(db, id, seasons) {
  await db.execute(
    `UPDATE seer_requests SET updated_at = ${db.sql.now()}, seasons = ? WHERE id = ?`,
    JSON.stringify(seasons),
    id
  );
}
async function setNotifiedSeasons(db, id, seasons) {
  await db.execute(
    `UPDATE seer_requests SET updated_at = ${db.sql.now()}, notified_seasons = ? WHERE id = ?`,
    JSON.stringify(seasons),
    id
  );
}
async function getNextQueued(db, exclude = []) {
  const skip = exclude.slice(0, 500);
  const rows = await db.query(
    `SELECT * FROM seer_requests
     WHERE status IN ('queued', 'retry_pending')
       AND (pending_cleanup_id IS NULL)
       ${skip.length > 0 ? `AND id NOT IN (${skip.map(() => "?").join(", ")})` : ""}
     ORDER BY priority DESC, created_at ASC, id ASC
     LIMIT 1`,
    ...skip
  );
  return rows.length > 0 ? rowToRequest(rows[0]) : null;
}
async function getRequestsToSync(db) {
  const rows = await db.query(
    `SELECT * FROM seer_requests
     WHERE seerr_request_id IS NOT NULL
       AND status NOT IN ('available', 'failed', 'deleted', 'deleting', 'delete_failed')`
  );
  return rows.map(rowToRequest);
}

// server/anime.ts
var overridesCache = null;
async function fetchMediaDetail(seerrUrl2, apiKey, mediaType, tmdbId) {
  try {
    const res = await fetch(`${seerrUrl2}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
function isAnimeFromKeywords(detail) {
  if (!detail.keywords || !Array.isArray(detail.keywords)) return false;
  return detail.keywords.some((k) => k.name?.toLowerCase().includes("anime"));
}
async function fetchAnimeOverrides(seerrUrl2, apiKey) {
  if (overridesCache && Date.now() < overridesCache.expires) {
    return overridesCache.data;
  }
  try {
    const res = await fetch(`${seerrUrl2}/api/v1/settings/sonarr`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      overridesCache = { data: null, expires: Date.now() + 6e5 };
      return null;
    }
    const servers = await res.json();
    const defaultServer = servers.find((s) => s.isDefault);
    if (!defaultServer?.activeAnimeProfileId) {
      overridesCache = { data: null, expires: Date.now() + 6e5 };
      return null;
    }
    const data = {
      profileId: defaultServer.activeAnimeProfileId,
      rootFolder: defaultServer.activeAnimeDirectory,
      tags: defaultServer.animeTags || [],
      languageProfileId: defaultServer.activeAnimeLanguageProfileId
    };
    overridesCache = { data, expires: Date.now() + 6e5 };
    return data;
  } catch {
    overridesCache = { data: null, expires: Date.now() + 6e5 };
    return null;
  }
}

// server/season-availability.ts
var AVAILABLE = 5;
function releasedSuffix(gender, plural) {
  const v = plural ? gender === "f" ? "sont sorties" : "sont sortis" : gender === "f" ? "est sortie" : "est sorti";
  return `${v} sur Tentacle TV`;
}
var DELETED = 7;
function goneSeasons(requested2, mediaSeasons) {
  const deleted = new Set(
    (mediaSeasons ?? []).filter((s) => s.status === DELETED).map((s) => s.seasonNumber)
  );
  return (requested2 ?? []).filter((s) => deleted.has(s)).sort((a, b) => a - b);
}
function evaluateSeasons(requested2, mediaSeasons) {
  const req = requested2 ?? [];
  const availSet = new Set(
    (mediaSeasons ?? []).filter((s) => s.status === AVAILABLE).map((s) => s.seasonNumber)
  );
  const available = req.filter((s) => availSet.has(s)).sort((a, b) => a - b);
  return {
    requested: req,
    available,
    allAvailable: req.length > 0 && available.length === req.length
  };
}
function seasonNotification(request, newly, totalAvailable) {
  const sorted = [...newly].sort((a, b) => a - b);
  const multi = sorted.length > 1;
  const label = multi ? `Saisons ${sorted.join(", ")}` : `Saison ${sorted[0]}`;
  const requestedCount = request.seasons?.length ?? 0;
  const partial = requestedCount > 1 && totalAvailable < requestedCount ? ` (${totalAvailable}/${requestedCount} saisons)` : "";
  return {
    title: request.title,
    message: `${label} ${releasedSuffix("f", multi)}${partial}`
  };
}

// server/seer-availability-notify.ts
async function notifyAvailableSeasons(db, request, mediaSeasons) {
  const ev = evaluateSeasons(request.seasons, mediaSeasons);
  if (ev.available.length === 0) return null;
  const notified = new Set(request.notifiedSeasons ?? []);
  const newly = ev.available.filter((s) => !notified.has(s));
  if (newly.length > 0) {
    const n = seasonNotification(request, newly, ev.available.length);
    await db.core.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: n.title,
        body: n.message,
        refId: request.id
      }
    });
    await setNotifiedSeasons(db, request.id, [.../* @__PURE__ */ new Set([...notified, ...ev.available])].sort((a, b) => a - b));
    console.log(`[SeerWorker] "${request.title}" saisons dispo [${newly.join(",")}] \u2192 notif`);
  }
  return ev.allAvailable ? "available" : "partially_available";
}
async function notifyMovieAvailable(db, request) {
  if ((request.notifiedSeasons ?? []).length > 0) return;
  await db.core.notification.create({
    data: {
      jellyfinUserId: request.jellyfinUserId,
      type: "request_status",
      title: request.title,
      body: `\xAB ${request.title} \xBB ${releasedSuffix("m", false)}`,
      refId: request.id
    }
  });
  await setNotifiedSeasons(db, request.id, [0]);
  console.log(`[SeerWorker] "${request.title}" (film) dispo \u2192 notif`);
}
async function releaseGoneSeasons(db, request, mediaSeasons) {
  const gone = goneSeasons(request.seasons, mediaSeasons);
  if (gone.length === 0) return request;
  const remaining = (request.seasons ?? []).filter((s) => !gone.includes(s));
  if (remaining.length === 0) {
    await updateRequestStatus(db, request.id, "deleted", {
      lastError: "Saisons supprim\xE9es c\xF4t\xE9 Jellyseerr"
    });
    invalidateRequestCaches(request.jellyfinUserId);
    console.log(`[SeerWorker] "${request.title}" : S${gone.join(", S")} supprim\xE9e(s) c\xF4t\xE9 Jellyseerr \u2192 demande close`);
    return null;
  }
  await addSeasonsToRequest(db, request.id, remaining);
  invalidateRequestCaches(request.jellyfinUserId);
  console.log(`[SeerWorker] "${request.title}" : S${gone.join(", S")} supprim\xE9e(s) c\xF4t\xE9 Jellyseerr \u2192 reste S${remaining.join(", S")}`);
  return { ...request, seasons: remaining };
}

// server/arr-service.ts
var sonarrCache = null;
var radarrCache = null;
async function getArrServerConfig(seerrUrl2, apiKey, type) {
  const cache = type === "sonarr" ? sonarrCache : radarrCache;
  if (cache && Date.now() < cache.expires) return cache.data;
  try {
    const res = await fetch(`${seerrUrl2}/api/v1/settings/${type}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      setCacheForType(type, null, FAIL_TTL_MS);
      return null;
    }
    const servers = await res.json();
    const defaultServer = servers.find((s) => s.isDefault);
    if (!defaultServer) {
      setCacheForType(type, null, OK_TTL_MS);
      return null;
    }
    const data = {
      hostname: defaultServer.hostname,
      port: defaultServer.port,
      apiKey: defaultServer.apiKey,
      useSsl: !!defaultServer.useSsl,
      baseUrl: defaultServer.baseUrl || ""
    };
    setCacheForType(type, data, OK_TTL_MS);
    return data;
  } catch {
    setCacheForType(type, null, FAIL_TTL_MS);
    return null;
  }
}
var OK_TTL_MS = 6e5;
var FAIL_TTL_MS = 3e4;
function setCacheForType(type, data, ttlMs) {
  const entry = { data, expires: Date.now() + ttlMs };
  if (type === "sonarr") sonarrCache = entry;
  else radarrCache = entry;
}
function buildArrUrl(server) {
  const protocol = server.useSsl ? "https" : "http";
  const base = server.baseUrl ? `/${server.baseUrl.replace(/^\/|\/$/g, "")}` : "";
  return `${protocol}://${server.hostname}:${server.port}${base}`;
}
async function arrFetch(server, path, init) {
  return fetch(`${buildArrUrl(server)}${path}`, {
    ...init,
    headers: { "X-Api-Key": server.apiKey, ...init?.headers ?? {} },
    signal: AbortSignal.timeout(15e3)
  });
}
function isTargetedSeason(seasonNumber, seasons) {
  if (!seasons || seasons.length === 0) return true;
  return seasons.includes(seasonNumber);
}
async function unmonitorSonarrSeasons(server, seriesId, seasons) {
  try {
    const getRes = await arrFetch(server, `/api/v3/series/${seriesId}`);
    if (getRes.status === 404) return true;
    if (!getRes.ok) return false;
    const series = await getRes.json();
    for (const s of series.seasons ?? []) {
      if (isTargetedSeason(s.seasonNumber, seasons)) s.monitored = false;
    }
    if ((series.seasons ?? []).every((s) => !s.monitored)) series.monitored = false;
    const putRes = await arrFetch(server, `/api/v3/series/${seriesId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(series)
    });
    return putRes.ok || putRes.status === 404;
  } catch (err) {
    console.warn(`[ArrService] unmonitorSonarrSeasons #${seriesId} failed:`, err);
    return false;
  }
}
async function deleteSonarrSeasonFiles(server, seriesId, seasons) {
  try {
    const res = await arrFetch(server, `/api/v3/episodefile?seriesId=${seriesId}`);
    if (res.status === 404) return true;
    if (!res.ok) return false;
    const files = await res.json();
    const targets = files.filter((f) => isTargetedSeason(f.seasonNumber, seasons));
    if (targets.length === 0) return true;
    const bulk = await arrFetch(server, `/api/v3/episodefile/bulk`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeFileIds: targets.map((f) => f.id) })
    });
    if (bulk.ok) return true;
    let ok = true;
    for (const f of targets) {
      const del = await arrFetch(server, `/api/v3/episodefile/${f.id}`, { method: "DELETE" });
      if (!del.ok && del.status !== 404) ok = false;
    }
    return ok;
  } catch (err) {
    console.warn(`[ArrService] deleteSonarrSeasonFiles #${seriesId} failed:`, err);
    return false;
  }
}
async function cancelSonarrQueue(server, seriesId, seasons) {
  try {
    const res = await arrFetch(server, `/api/v3/queue?pageSize=1000&includeSeries=false`);
    if (!res.ok) return;
    const data = await res.json();
    const records = data.records ?? [];
    for (const r of records) {
      if (r.seriesId !== seriesId) continue;
      if (r.seasonNumber !== void 0 && !isTargetedSeason(r.seasonNumber, seasons)) continue;
      await arrFetch(server, `/api/v3/queue/${r.id}?removeFromClient=true&blocklist=false`, {
        method: "DELETE"
      }).catch(() => {
      });
    }
  } catch (err) {
    console.warn(`[ArrService] cancelSonarrQueue #${seriesId} failed:`, err);
  }
}
async function cancelRadarrQueue(server, movieId) {
  try {
    const res = await arrFetch(server, `/api/v3/queue?pageSize=1000&includeMovie=false`);
    if (!res.ok) return;
    const data = await res.json();
    for (const r of data.records ?? []) {
      if (r.movieId !== movieId) continue;
      await arrFetch(server, `/api/v3/queue/${r.id}?removeFromClient=true&blocklist=false`, {
        method: "DELETE"
      }).catch(() => {
      });
    }
  } catch (err) {
    console.warn(`[ArrService] cancelRadarrQueue #${movieId} failed:`, err);
  }
}
async function triggerSeerrJob(seerrUrl2, apiKey, jobId) {
  try {
    await fetch(`${seerrUrl2}/api/v1/settings/jobs/${jobId}/run`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(1e4)
    });
  } catch (err) {
    console.warn(`[ArrService] triggerSeerrJob ${jobId} failed:`, err);
  }
}

// server/download-progress.ts
var STALLED_STATUSES = /* @__PURE__ */ new Set(["warning", "failed", "paused", "downloadClientUnavailable"]);
function isStalledStatus(status) {
  return typeof status === "string" && STALLED_STATUSES.has(status);
}
function parseTimeSpan(raw) {
  if (!raw || typeof raw !== "string") return null;
  let rest = raw.trim();
  let days = 0;
  const dot = rest.indexOf(".");
  if (dot > 0 && dot < rest.indexOf(":")) {
    days = Number(rest.slice(0, dot));
    rest = rest.slice(dot + 1);
    if (!Number.isFinite(days)) return null;
  }
  const parts = rest.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  const total = days * 86400 + h * 3600 + m * 60 + s;
  return total >= 0 ? Math.round(total) : null;
}
function etaFrom(item) {
  const fromSpan = parseTimeSpan(item.timeLeft);
  const at = item.estimatedCompletionTime ?? null;
  if (fromSpan != null) return { seconds: fromSpan, at };
  if (at) {
    const ms2 = new Date(at).getTime() - Date.now();
    if (Number.isFinite(ms2) && ms2 > 0) return { seconds: Math.round(ms2 / 1e3), at };
  }
  return { seconds: null, at };
}
function isValidating(size, sizeLeft, status) {
  if (status === "completed" || status === "importPending" || status === "importing") return true;
  return sizeLeft === 0 && size != null && size > 0;
}
function toDownloadProgress(item) {
  if (!item || typeof item !== "object") return null;
  const size = Number.isFinite(item.size) && item.size > 0 ? item.size : null;
  const sizeLeft = Number.isFinite(item.sizeLeft) ? Math.max(0, item.sizeLeft) : null;
  let percent = null;
  if (size != null && sizeLeft != null) {
    percent = Math.min(100, Math.max(0, (size - sizeLeft) / size * 100));
  }
  const eta = etaFrom(item);
  const status = typeof item.status === "string" ? item.status : "downloading";
  return {
    percent,
    size,
    sizeLeft,
    etaSeconds: eta.seconds,
    estimatedCompletionAt: eta.at,
    status,
    validating: isValidating(size, sizeLeft, status),
    stalled: isStalledStatus(status),
    title: item.title ?? item.episode?.title ?? null,
    seasonNumber: item.episode?.seasonNumber ?? null,
    episodeNumber: item.episode?.episodeNumber ?? null
  };
}
var MAX_DETAIL_ITEMS = 24;
function aggregateDownloads(items, isBlocked) {
  if (!Array.isArray(items) || items.length === 0) return { summary: null, items: [] };
  const parsed = [];
  for (const raw of items) {
    const p = toDownloadProgress(raw);
    if (!p) continue;
    if (!p.stalled && raw.downloadId && isBlocked?.(raw.downloadId)) {
      p.stalled = true;
      p.validating = false;
    }
    parsed.push(p);
  }
  if (parsed.length === 0) return { summary: null, items: [] };
  let totalSize = 0;
  let totalLeft = 0;
  let sized = 0;
  let maxEta = null;
  let latestAt = null;
  for (const p of parsed) {
    if (p.size != null && p.sizeLeft != null) {
      totalSize += p.size;
      totalLeft += p.sizeLeft;
      sized++;
    }
    if (p.etaSeconds != null && (maxEta === null || p.etaSeconds > maxEta)) maxEta = p.etaSeconds;
    if (p.estimatedCompletionAt && (!latestAt || p.estimatedCompletionAt > latestAt)) {
      latestAt = p.estimatedCompletionAt;
    }
  }
  const active = parsed.find((p) => p.status === "downloading") ?? parsed[0];
  const stalledCount = parsed.filter((p) => p.stalled).length;
  const percent = sized > 0 && totalSize > 0 ? Math.min(100, Math.max(0, (totalSize - totalLeft) / totalSize * 100)) : null;
  const summary = {
    percent,
    size: sized > 0 ? totalSize : null,
    sizeLeft: sized > 0 ? totalLeft : null,
    etaSeconds: maxEta,
    estimatedCompletionAt: latestAt,
    status: parsed.some((p) => p.status === "downloading") ? "downloading" : active.status,
    // `every` et non `some` : tant qu'un seul épisode descend encore, la
    // demande télécharge réellement — ce n'est pas de la validation.
    validating: parsed.every((p) => p.validating),
    // Un épisode bloqué parmi d'autres qui avancent : la demande avance.
    stalled: stalledCount > 0 && parsed.every((p) => p.stalled || p.validating),
    stalledCount,
    title: parsed.length === 1 ? active.title : null,
    seasonNumber: parsed.length === 1 ? active.seasonNumber : null,
    episodeNumber: parsed.length === 1 ? active.episodeNumber : null
  };
  const detail = parsed.slice().sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)).slice(0, MAX_DETAIL_ITEMS);
  return { summary, items: detail };
}

// server/sonarr-schedule.ts
var SERIES_TTL_MS = 30 * 6e4;
var SERIES_STALE_MS = 6 * 36e5;
var CALENDAR_TTL_MS = 30 * 6e4;
var CALENDAR_STALE_MS = 6 * 36e5;
var EPISODES_TTL_MS = 36e5;
var EPISODES_STALE_MS = 12 * 36e5;
function airTimeKey(season, episode) {
  return `S${season}E${episode}`;
}
async function sonarr(cfg) {
  return getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "sonarr");
}
async function arrGet(server, path) {
  try {
    const res = await fetch(`${buildArrUrl(server)}${path}`, {
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
var SERIES_INDEX_KEY = "seer:sonarr:series";
var INDEX_RETRY_MS = 6e4;
var indexRereadAt = 0;
async function readSeriesIndex(cfg) {
  const server = await sonarr(cfg);
  if (!server) return /* @__PURE__ */ new Map();
  const rows = await arrGet(server, "/api/v3/series");
  if (rows === null) throw new Error("Sonarr injoignable (index des s\xE9ries)");
  const index = /* @__PURE__ */ new Map();
  for (const s of rows) {
    if (s.tmdbId && s.id) index.set(s.tmdbId, s.id);
  }
  return index;
}
async function sonarrSeriesIndex(cfg) {
  return cached(SERIES_INDEX_KEY, SERIES_TTL_MS, () => readSeriesIndex(cfg), { staleMs: SERIES_STALE_MS });
}
async function sonarrSeriesId(cfg, tmdbId) {
  const known = (await sonarrSeriesIndex(cfg)).get(tmdbId);
  if (known || Date.now() - indexRereadAt < INDEX_RETRY_MS) return known ?? null;
  indexRereadAt = Date.now();
  const fresh = await readSeriesIndex(cfg).catch(() => null);
  if (!fresh) return null;
  put(SERIES_INDEX_KEY, fresh, SERIES_TTL_MS, SERIES_STALE_MS);
  return fresh.get(tmdbId) ?? null;
}
async function sonarrCalendarRaw(cfg, from, to) {
  return cached(
    `seer:sonarr:calraw:${from}:${to}`,
    CALENDAR_TTL_MS,
    async () => {
      const server = await sonarr(cfg);
      if (!server) return [];
      const rows = await arrGet(
        server,
        `/api/v3/calendar?start=${from}&end=${to}&includeSeries=false`
      );
      if (rows === null) throw new Error("Sonarr injoignable (calendrier)");
      return rows;
    },
    { staleMs: CALENDAR_STALE_MS }
  );
}
async function sonarrWindowAirTimes(cfg, from, to) {
  const rows = await sonarrCalendarRaw(cfg, from, to);
  const times = /* @__PURE__ */ new Map();
  for (const e of rows) {
    if (!e.airDateUtc || e.seriesId == null || e.seasonNumber == null || e.episodeNumber == null) continue;
    times.set(`${e.seriesId}:${airTimeKey(e.seasonNumber, e.episodeNumber)}`, e.airDateUtc);
  }
  return times;
}
async function sonarrWindowEpisodes(cfg, from, to) {
  const [rows, index] = await Promise.all([
    sonarrCalendarRaw(cfg, from, to),
    sonarrSeriesIndex(cfg)
  ]);
  if (rows.length === 0 || index.size === 0) return [];
  const tmdbBySeriesId = /* @__PURE__ */ new Map();
  for (const [tmdbId, seriesId] of index) tmdbBySeriesId.set(seriesId, tmdbId);
  const out = [];
  for (const e of rows) {
    if (!e.airDateUtc || e.seriesId == null || e.seasonNumber == null || e.episodeNumber == null) continue;
    const tmdbId = tmdbBySeriesId.get(e.seriesId);
    if (!tmdbId) continue;
    out.push({
      tmdbId,
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      airDateUtc: e.airDateUtc,
      airDate: e.airDate && /^\d{4}-\d{2}-\d{2}$/.test(e.airDate) ? e.airDate : null
    });
  }
  return out;
}
async function attachAirTimes(cfg, res) {
  const episodes = res.items.filter((i) => i.kind === "episode");
  if (episodes.length === 0) return res;
  try {
    const [index, times] = await Promise.all([
      sonarrSeriesIndex(cfg),
      // Fenêtre élargie d'un jour : un épisode peut basculer d'une journée à
      // l'autre une fois ramené à l'heure locale, dans un sens comme dans l'autre.
      sonarrWindowAirTimes(cfg, shiftDay(res.from, -1), shiftDay(res.to, 1))
    ]);
    if (index.size === 0 || times.size === 0) return res;
    for (const item of episodes) {
      const seriesId = index.get(item.tmdbId);
      if (!seriesId || item.seasonNumber == null || item.episodeNumber == null) continue;
      const at = times.get(`${seriesId}:${airTimeKey(item.seasonNumber, item.episodeNumber)}`);
      if (at) item.airDateUtc = at;
    }
  } catch {
  }
  return res;
}
function shiftDay(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
async function sonarrSeriesAirTimes(cfg, tmdbId) {
  return cached(
    `seer:sonarr:eps:${tmdbId}`,
    EPISODES_TTL_MS,
    async () => {
      const [server, index] = await Promise.all([sonarr(cfg), sonarrSeriesIndex(cfg)]);
      const seriesId = index.get(tmdbId);
      if (!server || !seriesId) return /* @__PURE__ */ new Map();
      const rows = await arrGet(server, `/api/v3/episode?seriesId=${seriesId}`);
      if (rows === null) throw new Error("Sonarr injoignable (\xE9pisodes)");
      const times = /* @__PURE__ */ new Map();
      for (const e of rows) {
        if (!e.airDateUtc || e.seasonNumber == null || e.episodeNumber == null) continue;
        times.set(airTimeKey(e.seasonNumber, e.episodeNumber), e.airDateUtc);
      }
      return times;
    },
    { staleMs: EPISODES_STALE_MS }
  );
}

// server/sonarr-episodes.ts
var FACTS_TTL_MS = 6e4;
var SERIES_FACTS_TTL_MS = 45e3;
var FACTS_STALE_MS = 10 * 6e4;
var seriesFactsKey = (tmdbId) => `seer:sonarr:facts:series:${tmdbId}`;
function episodeKey(tmdbId, season, episode) {
  return `${tmdbId}:${airTimeKey(season, episode)}`;
}
function factOf(row) {
  const fact = { hasFile: row.hasFile === true, monitored: row.monitored === true };
  if (row.airDate && /^\d{4}-\d{2}-\d{2}$/.test(row.airDate)) fact.airDate = row.airDate;
  return fact;
}
async function sonarrWindowFacts(cfg, from, to) {
  return cached(
    `seer:sonarr:facts:${from}:${to}`,
    FACTS_TTL_MS,
    async () => {
      const facts = { byEpisode: /* @__PURE__ */ new Map(), byDay: /* @__PURE__ */ new Map() };
      const [server, index] = await Promise.all([sonarr(cfg), sonarrSeriesIndex(cfg)]);
      if (!server || index.size === 0) return facts;
      const rows = await arrGet(
        server,
        `/api/v3/calendar?start=${from}&end=${to}&unmonitored=true&includeSeries=false`
      );
      if (rows === null) throw new Error("Sonarr injoignable (\xE9tat des \xE9pisodes)");
      const tmdbBySeries = /* @__PURE__ */ new Map();
      for (const [tmdbId, seriesId] of index) tmdbBySeries.set(seriesId, tmdbId);
      for (const row of rows) {
        const tmdbId = row.seriesId != null ? tmdbBySeries.get(row.seriesId) : void 0;
        if (!tmdbId || row.seasonNumber == null || row.episodeNumber == null) continue;
        const fact = factOf(row);
        facts.byEpisode.set(episodeKey(tmdbId, row.seasonNumber, row.episodeNumber), fact);
        if (row.airDate) {
          const day = `${tmdbId}:${row.airDate}`;
          facts.byDay.set(day, [...facts.byDay.get(day) ?? [], fact]);
        }
      }
      return facts;
    },
    { staleMs: FACTS_STALE_MS }
  );
}
async function sonarrSeriesFacts(cfg, tmdbId) {
  return cached(
    seriesFactsKey(tmdbId),
    SERIES_FACTS_TTL_MS,
    async () => {
      const [server, seriesId] = await Promise.all([sonarr(cfg), sonarrSeriesId(cfg, tmdbId)]);
      if (!server || !seriesId) return /* @__PURE__ */ new Map();
      const rows = await arrGet(server, `/api/v3/episode?seriesId=${seriesId}`);
      if (rows === null) throw new Error("Sonarr injoignable (\xE9pisodes de la s\xE9rie)");
      const facts = /* @__PURE__ */ new Map();
      for (const row of rows) {
        if (row.seasonNumber == null || row.episodeNumber == null) continue;
        facts.set(airTimeKey(row.seasonNumber, row.episodeNumber), factOf(row));
      }
      return facts;
    },
    { staleMs: FACTS_STALE_MS }
  );
}

// server/radarr-movies.ts
var MOVIE_TTL_MS = 3e4;
var movieFactsKey = (tmdbId) => `seer:radarr:movie:${tmdbId}`;
async function radarrHasFile(cfg, tmdbId) {
  const server = await getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "radarr");
  if (!server) return null;
  return cached(movieFactsKey(tmdbId), MOVIE_TTL_MS, async () => {
    const movies = await arrGet(server, `/api/v3/movie?tmdbId=${tmdbId}`);
    if (movies === null) throw new Error("Radarr injoignable (fichier d'un film)");
    return movies.some((m) => m.hasFile === true);
  }).catch(() => null);
}

// server/arr-queue.ts
var MAX_ITEMS = 60;
var QUEUE_TTL_MS = 8e3;
var PAGE_SIZE = 250;
async function fetchQueue(server, path) {
  try {
    const res = await fetch(`${buildArrUrl(server)}${path}`, {
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { records: data.records ?? [], total: data.totalRecords ?? 0 };
  } catch {
    return null;
  }
}
function isValidating2(r) {
  const state2 = r.trackedDownloadState ?? "";
  if (state2 === "importPending" || state2 === "importing") return true;
  if (r.status === "completed") return true;
  return r.sizeleft === 0 && typeof r.size === "number" && r.size > 0;
}
var BLOCKED_STATES = /* @__PURE__ */ new Set(["importBlocked", "importFailed", "failedPending", "failed"]);
function isStalledRecord(r) {
  return isStalledStatus(r.status) || BLOCKED_STATES.has(r.trackedDownloadState ?? "") || r.trackedDownloadStatus === "error";
}
function firstMessage(r) {
  if (r.errorMessage) return r.errorMessage;
  for (const m of r.statusMessages ?? []) {
    const text2 = m.messages?.[0] ?? m.title;
    if (text2) return text2;
  }
  return null;
}
function toEntry(r, source) {
  if (r.id == null) return null;
  const size = typeof r.size === "number" && r.size > 0 ? r.size : null;
  const left = typeof r.sizeleft === "number" ? Math.max(0, r.sizeleft) : null;
  const percent = size != null && left != null ? Math.min(100, Math.max(0, (size - left) / size * 100)) : null;
  const media = source === "sonarr" ? r.series : r.movie;
  const stalled = isStalledRecord(r);
  return {
    id: `${source}-${r.id}`,
    source,
    mediaType: source === "sonarr" ? "tv" : "movie",
    title: media?.title ?? r.title ?? "",
    seasonNumber: r.seasonNumber ?? null,
    episodeNumber: r.episode?.episodeNumber ?? null,
    episodeTitle: r.episode?.title ?? null,
    tmdbId: media?.tmdbId ?? null,
    percent,
    size,
    sizeLeft: size != null ? left : null,
    etaSeconds: parseTimeSpan(r.timeleft),
    validating: isValidating2(r) && !stalled,
    paused: r.status === "paused" || r.status === "delay",
    stalled,
    warning: stalled || r.status === "warning" || r.status === "failed" ? firstMessage(r) : null,
    downloadId: typeof r.downloadId === "string" && r.downloadId !== "" ? r.downloadId : null
  };
}
var lastInQueue = /* @__PURE__ */ new Set();
function forgetFilesOfLeavers(items, unreachable) {
  const now = new Set(items.filter((e) => e.tmdbId != null).map((e) => `${e.source}:${e.tmdbId}`));
  for (const key of lastInQueue) {
    const [source, id] = key.split(":");
    if (now.has(key) || unreachable.includes(source)) continue;
    invalidate(source === "radarr" ? movieFactsKey(Number(id)) : seriesFactsKey(Number(id)));
  }
  const kept = [...lastInQueue].filter((key) => unreachable.includes(key.split(":")[0]));
  lastInQueue = /* @__PURE__ */ new Set([...now, ...kept]);
}
async function readQueues(cfg) {
  const [sonarr2, radarr] = await Promise.all([
    getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "sonarr"),
    getArrServerConfig(cfg.seerrUrl, cfg.seerrApiKey, "radarr")
  ]);
  const [sq, rq] = await Promise.all([
    sonarr2 ? fetchQueue(sonarr2, `/api/v3/queue?pageSize=${PAGE_SIZE}&includeSeries=true&includeEpisode=true`) : Promise.resolve(null),
    radarr ? fetchQueue(radarr, `/api/v3/queue?pageSize=${PAGE_SIZE}&includeMovie=true`) : Promise.resolve(null)
  ]);
  const unreachable = [];
  if (!sq) unreachable.push("sonarr");
  if (!rq) unreachable.push("radarr");
  const items = [
    ...(sq?.records ?? []).map((r) => toEntry(r, "sonarr")),
    ...(rq?.records ?? []).map((r) => toEntry(r, "radarr"))
  ].filter((e) => e !== null);
  items.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.title.localeCompare(b.title));
  forgetFilesOfLeavers(items, unreachable);
  return {
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    items,
    total: (sq?.total ?? 0) + (rq?.total ?? 0),
    unreachable
  };
}
function queueSnapshot(cfg) {
  return cached("seer:arr:queue:all", QUEUE_TTL_MS, () => readQueues(cfg));
}
async function fetchServerQueue(cfg) {
  const snapshot = await queueSnapshot(cfg);
  return { ...snapshot, items: snapshot.items.slice(0, MAX_ITEMS) };
}

// server/concurrency.ts
var DEFAULT_CONCURRENCY = 6;
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length).fill(null);
  if (items.length === 0) return out;
  const workers = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (; ; ) {
        const i = cursor++;
        if (i >= items.length) return;
        try {
          out[i] = await fn(items[i], i);
        } catch {
          out[i] = null;
        }
      }
    })
  );
  return out;
}
async function mapLimitStrict(items, limit, fn) {
  const out = new Array(items.length);
  if (items.length === 0) return out;
  const workers = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (; ; ) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}
function chunk(items, size) {
  if (size <= 0) return [items.slice()];
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// server/live/library-keys.ts
var MOVIE = /^m:t:([1-9]\d{0,9})$/;
var SEASON = /^e:t:([1-9]\d{0,9}):(\d{1,4})(?::(\d{1,5})?)?$/;
function parseContentKey(key) {
  if (typeof key !== "string") return null;
  const m = MOVIE.exec(key);
  if (m) return { kind: "movie", tmdbId: Number(m[1]) };
  const s = SEASON.exec(key);
  if (s) return { kind: "season", tmdbId: Number(s[1]), season: Number(s[2]) };
  return null;
}
function emptySnapshot() {
  return { moviesPresent: /* @__PURE__ */ new Set(), moviesDeparted: /* @__PURE__ */ new Map(), series: /* @__PURE__ */ new Map() };
}
function tally(into, id, row) {
  const t = into.get(id) ?? { present: false, at: null };
  t.present ||= row.present;
  if (row.departedAt !== null) t.at = Math.max(t.at ?? 0, row.departedAt);
  into.set(id, t);
}
function buildSnapshot(rows) {
  const movies = /* @__PURE__ */ new Map();
  const seasons = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const parsed = parseContentKey(row.key);
    if (!parsed) continue;
    if (parsed.kind === "movie") tally(movies, String(parsed.tmdbId), row);
    else tally(seasons, `${parsed.tmdbId}:${parsed.season}`, row);
  }
  const snap = emptySnapshot();
  for (const [id, t] of movies) {
    if (t.present) snap.moviesPresent.add(Number(id));
    else if (t.at !== null) snap.moviesDeparted.set(Number(id), t.at);
  }
  for (const [id, t] of seasons) {
    const [tmdbId, season] = id.split(":").map(Number);
    let facts = snap.series.get(tmdbId);
    if (!facts) {
      facts = { present: /* @__PURE__ */ new Set(), departed: /* @__PURE__ */ new Map() };
      snap.series.set(tmdbId, facts);
    }
    if (t.present) facts.present.add(season);
    else if (t.at !== null) facts.departed.set(season, t.at);
  }
  return snap;
}
var NONE = /* @__PURE__ */ new Set();
function libraryStateOf(snap, mediaType, tmdbId) {
  if (mediaType === "movie") {
    if (snap.moviesPresent.has(tmdbId)) return { state: "present", goneSeasons: NONE, presentSeasons: NONE };
    const since = snap.moviesDeparted.get(tmdbId);
    return since === void 0 ? { state: "unknown" } : { state: "gone", since, goneSeasons: NONE };
  }
  const facts = snap.series.get(tmdbId);
  if (!facts) return { state: "unknown" };
  const gone = new Set(facts.departed.keys());
  if (facts.present.size > 0) return { state: "present", goneSeasons: gone, presentSeasons: facts.present };
  if (facts.departed.size === 0) return { state: "unknown" };
  return { state: "gone", since: Math.max(...facts.departed.values()), goneSeasons: gone };
}
function departuresOf(snap) {
  const out = [];
  for (const [tmdbId, at] of snap.moviesDeparted) out.push({ mediaType: "movie", tmdbId, at, seasons: [], whole: true });
  for (const [tmdbId, facts] of snap.series) {
    if (facts.departed.size === 0) continue;
    out.push({
      mediaType: "tv",
      tmdbId,
      at: Math.max(...facts.departed.values()),
      seasons: [...facts.departed.keys()].sort((a, b) => a - b),
      whole: facts.present.size === 0
    });
  }
  return out;
}
function snapshotDigest(snap) {
  const parts = [[...snap.moviesPresent].sort((a, b) => a - b).join(",")];
  for (const [id, at] of [...snap.moviesDeparted].sort((a, b) => a[0] - b[0])) parts.push(`d${id}@${at}`);
  for (const [id, facts] of [...snap.series].sort((a, b) => a[0] - b[0])) {
    const present = [...facts.present].sort((a, b) => a - b).join(".");
    const departed = [...facts.departed].sort((a, b) => a[0] - b[0]).map(([s, at]) => `${s}@${at}`).join(".");
    parts.push(`s${id}:${present}/${departed}`);
  }
  return parts.join("|");
}

// server/live/request-index-model.ts
function sameSignature(a, b) {
  return !!a && !!b && a.total === b.total && a.topId === b.topId && a.topUpdatedAt === b.topUpdatedAt;
}
function num(v) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function text(v) {
  return typeof v === "string" && v !== "" ? v : null;
}
function toIndexed(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  const id = num(r.id);
  const status = num(r.status);
  const media = r.media && typeof r.media === "object" ? r.media : {};
  const tmdbId = num(media.tmdbId);
  const type = media.mediaType === "tv" || r.type === "tv" ? "tv" : media.mediaType === "movie" || r.type === "movie" ? "movie" : null;
  if (id === null || status === null || tmdbId === null || tmdbId <= 0 || !type) return null;
  const seasons = Array.isArray(r.seasons) ? r.seasons.map((s) => num(s?.seasonNumber)).filter((n) => n !== null) : [];
  const by = r.requestedBy && typeof r.requestedBy === "object" ? r.requestedBy : {};
  return {
    id,
    status,
    is4k: r.is4k === true,
    mediaType: type,
    tmdbId,
    seasons: [...new Set(seasons)].sort((a, b) => a - b),
    requestedBy: {
      seerrUserId: num(by.id),
      jellyfinUserId: text(by.jellyfinUserId),
      name: text(by.displayName) ?? text(by.jellyfinUsername) ?? text(by.username) ?? text(by.email)
    },
    createdAt: text(r.createdAt),
    updatedAt: text(r.updatedAt),
    mediaStatus: num(media.status)
  };
}
function signatureOf(page) {
  if (!page || typeof page !== "object") return null;
  const total = num(page.pageInfo?.results);
  if (total === null) return null;
  const top = Array.isArray(page.results) && page.results.length > 0 ? toIndexed(page.results[0]) : null;
  return { total, topId: top?.id ?? null, topUpdatedAt: top?.updatedAt ?? null };
}
function applyIncremental(byId, page, pageSize, total, hidden = 0) {
  const changed = [];
  for (const row of page) {
    const known = byId.get(row.id);
    if (!known || known.updatedAt !== row.updatedAt || known.status !== row.status || known.mediaStatus !== row.mediaStatus) {
      changed.push(row);
    }
  }
  const added = changed.filter((r) => !byId.has(r.id)).length;
  const after = byId.size + added + hidden;
  if (total < after) return { kind: "reload" };
  if (page.length >= pageSize && changed.length === page.length) return { kind: "reload" };
  if (total > after) return { kind: "reload" };
  for (const row of changed) byId.set(row.id, row);
  return { kind: "applied", changed };
}
function vanished(before, after, truncated) {
  const seen = new Set(after.map((r) => r.id));
  const floor = truncated && after.length > 0 ? Math.min(...after.map((r) => r.id)) : -Infinity;
  const out = [];
  for (const id of before.keys()) if (!seen.has(id) && id >= floor) out.push(id);
  return out.sort((a, b) => a - b);
}
function byTitleOf(rows) {
  const out = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = `${row.mediaType}:${row.tmdbId}`;
    const list = out.get(key);
    if (list) list.push(row);
    else out.set(key, [row]);
  }
  return out;
}

// server/live/request-index.ts
var PAGE = 100;
var RECENT = 50;
var CONCURRENCY = 4;
var MAX_PAGES = 60;
var FULL_EVERY_MS = 6 * 36e5;
var BACKOFF_MS = 3e4;
async function fetchPage(cfg, take, skip, sort) {
  const res = await fetch(
    `${cfg.seerrUrl}/api/v1/request?take=${take}&skip=${skip}&filter=all&sort=${sort}`,
    { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
  );
  if (!res.ok) throw new Error(`Jellyseerr GET /request ${res.status}`);
  return await res.json();
}
var RequestIndexState = class {
  byId = /* @__PURE__ */ new Map();
  titles = /* @__PURE__ */ new Map();
  signature = null;
  hidden = 0;
  lastFull = 0;
  retryAfter = 0;
  running = null;
  /** Vrai dès la première relecture complète réussie. */
  ready = false;
  /** La dernière relecture n'a pas tout lu (trop de demandes). */
  truncated = false;
  /** Change à chaque modification de l'index : les caches qui en dépendent se reconnaissent. */
  generation = 0;
  /** Les demandes d'un titre, telles que Jellyseerr les a — `null` si l'index n'est pas prêt. */
  requestsFor(mediaType, tmdbId) {
    if (!this.ready) return null;
    return this.titles.get(`${mediaType}:${tmdbId}`) ?? [];
  }
  /** La demande existe-t-elle encore ? `null` : on ne peut pas le dire. */
  exists(id) {
    if (!this.ready) return null;
    if (this.byId.has(id)) return true;
    if (this.truncated && this.byId.size > 0 && id < Math.min(...this.byId.keys())) return null;
    return false;
  }
  all() {
    return [...this.byId.values()];
  }
  /**
   * Une passe : l'empreinte, puis ce qu'elle demande. Ne rejette jamais ;
   * rend ce qui a changé, ou `null` quand rien n'a bougé (ou Jellyseerr muet).
   */
  poll(cfg, now = Date.now()) {
    if (this.running) return this.running;
    if (now < this.retryAfter) return Promise.resolve(null);
    this.running = this.pass(cfg, now).catch((err) => {
      this.retryAfter = Date.now() + BACKOFF_MS;
      console.warn(`[VigieLive] Demandes de Jellyseerr illisibles : ${err instanceof Error ? err.message : err}`);
      return null;
    }).finally(() => {
      this.running = null;
    });
    return this.running;
  }
  /** Pour les tests : un index déjà lu. */
  seed(rows) {
    this.byId = new Map(rows.map((r) => [r.id, r]));
    this.hidden = 0;
    this.truncated = false;
    this.ready = true;
    this.lastFull = Date.now();
    this.rebuild();
  }
  /** Oublie tout (changement d'instance Jellyseerr). */
  reset() {
    this.byId.clear();
    this.titles.clear();
    this.signature = null;
    this.hidden = 0;
    this.lastFull = 0;
    this.ready = false;
    this.truncated = false;
    this.generation++;
  }
  async pass(cfg, now) {
    if (!this.ready || now - this.lastFull > FULL_EVERY_MS) return this.full(cfg);
    const sig = signatureOf(await fetchPage(cfg, 1, 0, "modified"));
    if (!sig) throw new Error("empreinte illisible");
    if (sameSignature(sig, this.signature)) return null;
    const recent = await fetchPage(cfg, RECENT, 0, "modified");
    const rows = (recent.results ?? []).map(toIndexed).filter((r) => r !== null);
    const verdict = applyIncremental(this.byId, rows, RECENT, sig.total, this.hidden);
    if (verdict.kind === "reload") return this.full(cfg);
    this.signature = sig;
    if (verdict.changed.length === 0) return null;
    this.rebuild();
    return { changed: verdict.changed, deleted: [] };
  }
  async full(cfg) {
    const first = await fetchPage(cfg, PAGE, 0, "added");
    const total = Number(first.pageInfo?.results ?? first.results?.length ?? 0) || 0;
    const pages = Math.min(Math.ceil(total / PAGE), MAX_PAGES);
    const skips = Array.from({ length: Math.max(0, pages - 1) }, (_, i) => (i + 1) * PAGE);
    const rest = await runLimited(skips, CONCURRENCY, (skip) => fetchPage(cfg, PAGE, skip, "added"));
    const raw = [first, ...rest].flatMap((p) => p.results ?? []);
    const rows = raw.map(toIndexed).filter((r) => r !== null);
    const truncated = Math.ceil(total / PAGE) > MAX_PAGES;
    const sig = signatureOf(await fetchPage(cfg, 1, 0, "modified"));
    const before = this.byId;
    const wasReady = this.ready;
    const deletedIds = wasReady ? vanished(before, rows, truncated) : [];
    const deleted = deletedIds.map((id) => before.get(id)).filter((r) => !!r);
    const changed = wasReady ? rows.filter((r) => {
      const known = before.get(r.id);
      return !known || known.updatedAt !== r.updatedAt || known.status !== r.status;
    }) : [];
    this.byId = new Map(rows.map((r) => [r.id, r]));
    this.hidden = Math.max(0, total - rows.length);
    this.truncated = truncated;
    this.signature = sig;
    this.lastFull = Date.now();
    this.ready = true;
    if (wasReady && changed.length === 0 && deleted.length === 0) return null;
    this.rebuild();
    return { changed, deleted };
  }
  rebuild() {
    this.titles = byTitleOf(this.byId.values());
    this.generation++;
  }
};
async function runLimited(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (; ; ) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}
var requestIndex = new RequestIndexState();

// server/search/pending.ts
var REFRESH_MS = 1e4;
var WAITING = ["queued", "processing", "retry_pending", "sent_to_seer", "approved"];
var NOT_SENT = /* @__PURE__ */ new Set(["queued", "processing", "retry_pending"]);
var keys = /* @__PURE__ */ new Set();
var queued = /* @__PURE__ */ new Map();
var readAt = 0;
var reading = false;
function isLocallyPending(key) {
  return keys.has(key);
}
function locallyQueued(key) {
  return queued.get(key) ?? null;
}
function seasonsOf(raw) {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}
function refreshLocalPending(db, force = false) {
  if (reading || !force && Date.now() - readAt < REFRESH_MS) return;
  reading = true;
  db.query(
    `SELECT media_type, tmdb_id, status, seasons FROM seer_requests
     WHERE status IN (${WAITING.map(() => "?").join(", ")})`,
    ...WAITING
  ).then((rows) => {
    const nextKeys = /* @__PURE__ */ new Set();
    const nextQueued = /* @__PURE__ */ new Map();
    for (const r of rows) {
      const key = `${r.media_type}:${Number(r.tmdb_id)}`;
      nextKeys.add(key);
      if (!NOT_SENT.has(r.status)) continue;
      const set = nextQueued.get(key) ?? /* @__PURE__ */ new Set();
      for (const s of seasonsOf(r.seasons)) set.add(s);
      nextQueued.set(key, set);
    }
    keys = nextKeys;
    queued = nextQueued;
  }).catch(() => void 0).finally(() => {
    readAt = Date.now();
    reading = false;
  });
}
function markLocallyPending(mediaType, tmdbId, seasons) {
  const key = `${mediaType}:${tmdbId}`;
  keys.add(key);
  const set = queued.get(key) ?? /* @__PURE__ */ new Set();
  for (const s of seasons ?? []) set.add(s);
  queued.set(key, set);
}

// server/live/title-truth.ts
var STATUS = {
  UNKNOWN: 1,
  PENDING: 2,
  PROCESSING: 3,
  PARTIALLY_AVAILABLE: 4,
  AVAILABLE: 5,
  BLOCKLISTED: 6,
  DELETED: 7
};
var REQUEST = { PENDING: 1, APPROVED: 2, DECLINED: 3, FAILED: 4, COMPLETED: 5 };
var NO_SEASONS = /* @__PURE__ */ new Set();
var UNKNOWN_LIBRARY = { state: "unknown", goneSeasons: NO_SEASONS, presentSeasons: NO_SEASONS };
function isLiveRequest(r) {
  return !r.is4k && (r.status === REQUEST.PENDING || r.status === REQUEST.APPROVED || r.status === REQUEST.COMPLETED);
}
function requested(facts, seerr) {
  return facts.downloading || seerr === STATUS.PROCESSING ? STATUS.PROCESSING : STATUS.PENDING;
}
function stillRequested(facts) {
  if (facts.queued) return true;
  if (facts.requests === null) return null;
  return facts.requests.some(isLiveRequest);
}
function seasonStillRequested(facts, season) {
  if (facts.queuedSeasons?.has(season)) return true;
  if (facts.requests === null) return facts.queued ? true : null;
  return facts.requests.some((r) => isLiveRequest(r) && r.seasons.includes(season)) || facts.queued && !facts.queuedSeasons;
}
function correctMediaStatus(mediaType, seerr, facts) {
  if (seerr === STATUS.BLOCKLISTED) return seerr;
  const { library } = facts;
  if (library.state === "gone") {
    const still2 = stillRequested(facts);
    if (still2 === true) return requested(facts, seerr);
    if (still2 === false) return STATUS.DELETED;
    return seerr === STATUS.PENDING || seerr === STATUS.PROCESSING ? seerr : STATUS.DELETED;
  }
  if (library.state === "present") {
    if (mediaType === "movie") {
      return seerr === STATUS.AVAILABLE || seerr === STATUS.PARTIALLY_AVAILABLE ? seerr : STATUS.AVAILABLE;
    }
    if (seerr === STATUS.AVAILABLE) return library.goneSeasons.size > 0 ? STATUS.PARTIALLY_AVAILABLE : seerr;
    if (seerr === STATUS.PARTIALLY_AVAILABLE) return seerr;
    return STATUS.PARTIALLY_AVAILABLE;
  }
  if (seerr === STATUS.PENDING || seerr === STATUS.PROCESSING) {
    return stillRequested(facts) === false ? STATUS.UNKNOWN : seerr;
  }
  if (seerr === STATUS.DELETED && stillRequested(facts) === true) return requested(facts, seerr);
  return seerr;
}
function correctSeasonStatus(season, seerr, facts) {
  if (seerr === STATUS.BLOCKLISTED) return seerr;
  const { library } = facts;
  const gone = library.state === "gone" || library.goneSeasons.has(season);
  if (gone && (seerr === void 0 || seerr >= STATUS.PENDING)) {
    const still2 = seasonStillRequested(facts, season);
    if (still2 === true) return seerr === STATUS.PROCESSING || facts.downloading ? STATUS.PROCESSING : STATUS.PENDING;
    if (still2 === false) return STATUS.DELETED;
    return seerr === STATUS.PENDING || seerr === STATUS.PROCESSING ? seerr : STATUS.DELETED;
  }
  if (library.state === "present" && library.presentSeasons.has(season)) {
    return seerr === STATUS.AVAILABLE || seerr === STATUS.PARTIALLY_AVAILABLE ? seerr : STATUS.PARTIALLY_AVAILABLE;
  }
  if (seerr === STATUS.PENDING || seerr === STATUS.PROCESSING) {
    return seasonStillRequested(facts, season) === false ? STATUS.UNKNOWN : seerr;
  }
  return seerr;
}

// server/live/live-state.ts
var SETTLE_MS = 20 * 6e4;
var LiveState = class {
  snapshot = emptySnapshot();
  /** La liste du serveur a pu être lue : les départs sont connus. */
  libraryReadable = false;
  digest = "";
  checks = /* @__PURE__ */ new Map();
  gen = 0;
  /** Change dès que l'état d'un titre a pu changer (bibliothèque, Jellyfin, demandes). */
  get generation() {
    return this.gen + requestIndex.generation;
  }
  bump() {
    this.gen++;
  }
  /** Pour les tests : rien de connu. */
  reset() {
    this.snapshot = emptySnapshot();
    this.libraryReadable = false;
    this.digest = "";
    this.checks.clear();
    this.gen++;
  }
  /** Nouvelles lignes de la liste du serveur. Vrai si ce qu'elles disent a changé. */
  setLibrary(rows) {
    if (rows === null) {
      const changed = this.libraryReadable;
      this.libraryReadable = false;
      this.snapshot = emptySnapshot();
      this.digest = "";
      if (changed) this.gen++;
      return changed;
    }
    const snap = buildSnapshot(rows);
    const digest = snapshotDigest(snap);
    this.libraryReadable = true;
    this.snapshot = snap;
    if (digest === this.digest) return false;
    this.digest = digest;
    const departed = new Set(departuresOf(snap).map((d) => `${d.mediaType}:${d.tmdbId}`));
    for (const key of this.checks.keys()) if (!departed.has(key)) this.checks.delete(key);
    this.gen++;
    return true;
  }
  /** Une réponse de Jellyfin. Vrai si elle change ce qu'on dit du titre. */
  setCheck(key, check2) {
    const before = this.checks.get(key);
    this.checks.set(key, check2);
    const same = before && before.present === check2.present && sameSet(before.presentSeasons, check2.presentSeasons);
    if (!same) this.gen++;
    return !same;
  }
  departures() {
    return departuresOf(this.snapshot);
  }
  /**
   * Un départ est acquis quand Jellyfin, interrogé APRÈS lui, n'a plus le
   * titre — ou, sans réponse de Jellyfin, quand il est assez ancien.
   */
  settled(key, departedAt, now, absent) {
    const check2 = this.checks.get(key);
    if (check2 && check2.at >= departedAt) return absent(check2);
    return now - departedAt >= SETTLE_MS;
  }
  /** Ce que Jellyfin est pour ce titre, départs confirmés seulement. */
  libraryFact(mediaType, tmdbId, now = Date.now()) {
    if (!this.libraryReadable) return UNKNOWN_LIBRARY;
    const base = libraryStateOf(this.snapshot, mediaType, tmdbId);
    if (base.state === "unknown") return UNKNOWN_LIBRARY;
    const key = `${mediaType}:${tmdbId}`;
    const facts = mediaType === "tv" ? this.snapshot.series.get(tmdbId) : void 0;
    if (base.state === "present") {
      if (base.goneSeasons.size === 0 || !facts) {
        return { state: "present", goneSeasons: NO_SEASONS, presentSeasons: base.presentSeasons };
      }
      const gone = /* @__PURE__ */ new Set();
      for (const season of base.goneSeasons) {
        const at = facts.departed.get(season) ?? 0;
        if (this.settled(key, at, now, (c) => !c.presentSeasons?.has(season))) gone.add(season);
      }
      return { state: "present", goneSeasons: gone, presentSeasons: base.presentSeasons };
    }
    if (this.settled(key, base.since, now, (c) => !c.present)) {
      return { state: "gone", goneSeasons: base.goneSeasons, presentSeasons: NO_SEASONS };
    }
    const check2 = this.checks.get(key);
    if (check2 && check2.at >= base.since && check2.present) {
      const present = check2.presentSeasons ?? NO_SEASONS;
      const gone = new Set([...base.goneSeasons].filter((s) => check2.presentSeasons && !present.has(s)));
      return { state: "present", goneSeasons: gone, presentSeasons: present };
    }
    return UNKNOWN_LIBRARY;
  }
};
function sameSet(a, b) {
  if (!a || !b) return !a && !b;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
var liveState = new LiveState();
function factsFor(mediaType, tmdbId, opts = {}) {
  const queuedSeasons = locallyQueued(`${mediaType}:${tmdbId}`);
  return {
    library: liveState.libraryFact(mediaType, tmdbId, opts.now),
    requests: opts.requests !== void 0 ? opts.requests : requestIndex.requestsFor(mediaType, tmdbId),
    queued: queuedSeasons !== null,
    queuedSeasons: queuedSeasons && queuedSeasons.size > 0 ? queuedSeasons : void 0,
    downloading: opts.downloading
  };
}
function correctedStatus(mediaType, tmdbId, seerr, opts) {
  return correctMediaStatus(mediaType, seerr, factsFor(mediaType, tmdbId, opts));
}
function factsWithRequest(mediaType, tmdbId, own, downloading = false) {
  const base = factsFor(mediaType, tmdbId, { downloading });
  return { ...base, requests: [...base.requests ?? [], own] };
}
function goneFromJellyfin(mediaType, tmdbId) {
  return liveState.libraryFact(mediaType, tmdbId).state === "gone";
}
function goneSeasonsOf(tmdbId) {
  const fact = liveState.libraryFact("tv", tmdbId);
  return fact.state === "unknown" ? NO_SEASONS : fact.goneSeasons;
}

// server/arr-truth.ts
var IN_FLIGHT = /* @__PURE__ */ new Set([
  "approved",
  "unavailable",
  "downloading",
  "partially_available"
]);
var MAX_DETAIL = 24;
var CONCURRENCY2 = 4;
function matchQueue(req, items) {
  const source = req.mediaType === "movie" ? "radarr" : "sonarr";
  return items.filter((e) => e.source === source && e.tmdbId === req.tmdbId && (req.mediaType === "movie" || !req.seasons?.length || e.seasonNumber != null && req.seasons.includes(e.seasonNumber)));
}
function entryProgress(e) {
  return {
    percent: e.validating ? 100 : e.percent,
    size: e.size,
    sizeLeft: e.sizeLeft,
    etaSeconds: e.validating ? null : e.etaSeconds,
    estimatedCompletionAt: null,
    status: e.validating ? "completed" : e.paused ? "paused" : e.stalled ? "warning" : "downloading",
    validating: e.validating,
    stalled: e.stalled,
    title: e.episodeTitle,
    seasonNumber: e.seasonNumber,
    episodeNumber: e.episodeNumber
  };
}
function summarizeQueue(entries) {
  if (entries.length === 0) return null;
  const downloads = /* @__PURE__ */ new Map();
  for (const e of entries) downloads.set(e.downloadId ?? e.id, e);
  let size = 0;
  let left = 0;
  let sized = 0;
  let eta = null;
  for (const e of downloads.values()) {
    if (e.size != null && e.sizeLeft != null) {
      size += e.size;
      left += e.sizeLeft;
      sized++;
    }
    if (!e.validating && e.etaSeconds != null && (eta === null || e.etaSeconds > eta)) eta = e.etaSeconds;
  }
  const importing = entries.every((e) => e.validating);
  const stalledCount = entries.filter((e) => e.stalled).length;
  const moving = entries.some((e) => !e.validating && !e.stalled && !e.paused);
  const single = entries.length === 1 ? entries[0] : null;
  const summary = {
    percent: importing ? 100 : sized > 0 && size > 0 ? Math.min(100, Math.max(0, (size - left) / size * 100)) : null,
    size: sized > 0 ? size : null,
    sizeLeft: sized > 0 ? left : null,
    etaSeconds: importing ? null : eta,
    estimatedCompletionAt: null,
    status: importing ? "completed" : moving ? "downloading" : entries.some((e) => e.paused) ? "paused" : "warning",
    validating: importing,
    // Bloquée : tout ce qui n'est pas arrivé est bloqué (même règle que Jellyseerr).
    stalled: stalledCount > 0 && entries.every((e) => e.stalled || e.validating),
    stalledCount,
    title: single?.episodeTitle ?? null,
    seasonNumber: single?.seasonNumber ?? null,
    episodeNumber: single?.episodeNumber ?? null
  };
  const items = entries.map(entryProgress).sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)).slice(0, MAX_DETAIL);
  return { summary, items };
}
function seriesFiles(seasons, facts) {
  if (!seasons?.length || facts.size === 0) return null;
  let total = 0;
  let here = 0;
  for (const [key, fact] of facts) {
    const season = Number(/^S(\d+)E/.exec(key)?.[1]);
    if (!seasons.includes(season)) continue;
    total++;
    if (fact.hasFile) here++;
  }
  if (total === 0) return null;
  return here === total ? "all" : here > 0 ? "some" : "none";
}
function verdictFor(req, queue, files) {
  const source = req.mediaType === "movie" ? "radarr" : "sonarr";
  if (queue.unreachable.includes(source)) return null;
  const arriving2 = summarizeQueue(matchQueue(req, queue.items));
  if (arriving2) {
    const status = req.status === "partially_available" ? "partially_available" : "downloading";
    return { status, download: arriving2.summary, downloads: arriving2.items.length > 1 ? arriving2.items : void 0 };
  }
  if (files === "all") return { status: "available", download: null };
  if (files === "some" && req.status !== "partially_available") return { status: "partially_available", download: null };
  if (files === "none" && req.status === "downloading") return { status: "unavailable", download: null };
  return null;
}
async function filesOf(cfg, req) {
  if (req.mediaType === "movie") {
    const hasFile = await radarrHasFile(cfg, req.tmdbId);
    return hasFile === null ? null : hasFile ? "all" : "none";
  }
  const facts = await sonarrSeriesFacts(cfg, req.tmdbId).catch(() => null);
  return facts ? seriesFiles(req.seasons, facts) : null;
}
function deletedFromJellyfin(req) {
  if (goneFromJellyfin(req.mediaType, req.tmdbId)) return true;
  if (req.mediaType !== "tv" || !req.seasons?.length) return false;
  const gone = goneSeasonsOf(req.tmdbId);
  return req.seasons.some((s) => gone.has(s));
}
async function arrVerdicts(cfg, requests, isDeleted = deletedFromJellyfin) {
  const out = /* @__PURE__ */ new Map();
  const waiting = requests.filter((r) => IN_FLIGHT.has(r.status) && r.tmdbId > 0);
  if (waiting.length === 0) return out;
  const queue = await queueSnapshot(cfg).catch(() => null);
  if (!queue) return out;
  await mapLimit(waiting, CONCURRENCY2, async (req) => {
    let files = matchQueue(req, queue.items).length > 0 ? null : await filesOf(cfg, req);
    if ((files === "all" || files === "some") && isDeleted(req)) files = null;
    const verdict = verdictFor(req, queue, files);
    if (verdict) out.set(req.id, verdict);
  });
  return out;
}
function withArrStatus(items, verdicts) {
  if (verdicts.size === 0) return items;
  return items.map((i) => {
    const v = verdicts.get(i.id);
    return v && v.status !== i.status ? { ...i, status: v.status } : i;
  });
}
function restat(stats, items, verdicts) {
  if (verdicts.size === 0) return stats;
  const byStatus = { ...stats.byStatus };
  for (const i of items) {
    const v = verdicts.get(i.id);
    if (!v || v.status === i.status) continue;
    byStatus[i.status] = Math.max(0, (byStatus[i.status] ?? 0) - 1);
    byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
  }
  return { ...stats, byStatus };
}

// server/arr-advance-plan.ts
var PROGRESS_RANK = {
  sent_to_seer: 1,
  approved: 1,
  unavailable: 1,
  downloading: 2,
  partially_available: 3,
  available: 4
};
function isDowngrade(from, to) {
  const a = PROGRESS_RANK[from];
  const b = PROGRESS_RANK[to];
  return a !== void 0 && b !== void 0 && b < a;
}
function seasonFacts(facts, requested2) {
  const counts = /* @__PURE__ */ new Map();
  for (const [key, fact] of facts) {
    const season = Number(/^S(\d+)E/.exec(key)?.[1]);
    if (!Number.isInteger(season)) continue;
    const c = counts.get(season) ?? { expected: 0, here: 0 };
    if (fact.monitored || fact.hasFile) c.expected++;
    if (fact.hasFile) c.here++;
    counts.set(season, c);
  }
  const considered = requested2?.length ? [...requested2].sort((a, b) => a - b) : [...counts.keys()].filter((s) => s > 0).sort((a, b) => a - b);
  const complete = [];
  const started = [];
  for (const s of considered) {
    const c = counts.get(s);
    if (!c || c.here === 0) continue;
    started.push(s);
    if (c.here >= c.expected) complete.push(s);
  }
  return { considered, complete, started };
}
var NOTHING = {
  status: null,
  completed: false,
  notifyDownloading: false,
  notifyMovie: false,
  notifySeasons: [],
  notified: null
};
function climb(input, target, decision) {
  if (target === input.status || isDowngrade(input.status, target)) return decision;
  const nothingAnnounced = (input.notifiedSeasons ?? []).length === 0;
  return {
    ...decision,
    status: target,
    completed: target === "available",
    // « En cours de téléchargement » : une fois, au départ — jamais après une annonce.
    notifyDownloading: target === "downloading" && nothingAnnounced
  };
}
function decideAdvance(input) {
  if (input.mediaType === "movie") {
    if (input.movieHasFile === true) {
      const first = (input.notifiedSeasons ?? []).length === 0;
      return climb(input, "available", { ...NOTHING, notifyMovie: first, notified: first ? [0] : null });
    }
    if (input.inQueue) return climb(input, "downloading", NOTHING);
    if (input.movieHasFile === false && input.status === "downloading") return { ...NOTHING, status: "unavailable" };
    return NOTHING;
  }
  const facts = input.seasons;
  if (!facts || facts.considered.length === 0) {
    return input.inQueue ? climb(input, "downloading", NOTHING) : NOTHING;
  }
  const already = new Set(input.notifiedSeasons ?? []);
  const fresh = facts.complete.filter((s) => !already.has(s));
  const base = {
    ...NOTHING,
    notifySeasons: fresh,
    notified: fresh.length > 0 ? [.../* @__PURE__ */ new Set([...already, ...facts.complete])].sort((a, b) => a - b) : null
  };
  if (facts.complete.length === facts.considered.length) return climb(input, "available", base);
  if (facts.started.length > 0) return climb(input, "partially_available", base);
  if (input.inQueue) return climb(input, "downloading", base);
  if (input.status === "downloading") return { ...base, status: "unavailable" };
  return base;
}

// server/arr-advance.ts
var CANDIDATES = ["sent_to_seer", "approved", "unavailable", "downloading", "partially_available"];
var CONCURRENCY3 = 4;
var IDLE_EVERY_PASSES = 5;
var AFTER_QUEUE_PASSES = 3;
var CLAIM_TTL_SECONDS = 1800;
var passCount = 0;
var leftQueue = /* @__PURE__ */ new Map();
var reachable = { radarr: false, sonarr: false };
function arrKnows(mediaType) {
  return mediaType === "movie" ? reachable.radarr : reachable.sonarr;
}
function justLeft(id, inQueue) {
  if (inQueue) {
    leftQueue.set(id, AFTER_QUEUE_PASSES);
    return false;
  }
  const left = leftQueue.get(id);
  if (left === void 0) return false;
  if (left <= 1) leftQueue.delete(id);
  else leftQueue.set(id, left - 1);
  return true;
}
async function advanceFromArr(db, cfg) {
  passCount++;
  const queue = await queueSnapshot(cfg).catch(() => null);
  reachable = {
    radarr: !!queue && !queue.unreachable.includes("radarr"),
    sonarr: !!queue && !queue.unreachable.includes("sonarr")
  };
  if (!queue || !reachable.radarr && !reachable.sonarr) return;
  const rows = await db.query(
    `SELECT * FROM seer_requests
     WHERE status IN (${CANDIDATES.map(() => "?").join(", ")}) AND tmdb_id > 0
     ORDER BY updated_at DESC, id ASC LIMIT 500`,
    ...CANDIDATES
  );
  const requests = rows.map(rowToRequest);
  const alive = new Set(requests.map((r) => r.id));
  for (const id of leftQueue.keys()) if (!alive.has(id)) leftQueue.delete(id);
  const idleTurn = passCount % IDLE_EVERY_PASSES === 1;
  await mapLimit(requests, CONCURRENCY3, async (req) => {
    if (!arrKnows(req.mediaType)) return;
    const inQueue = matchQueue(req, queue.items).length > 0;
    const recent = justLeft(req.id, inQueue);
    if (!inQueue && !recent && !idleTurn && req.status !== "downloading") return;
    try {
      await apply(db, req, await decide(cfg, req, inQueue));
    } catch (err) {
      console.warn(`[SeerArr] "${req.title}" :`, err);
    }
  });
}
async function decide(cfg, req, inQueue) {
  const base = { status: req.status, notifiedSeasons: req.notifiedSeasons, inQueue };
  const deleted = deletedFromJellyfin(req);
  if (req.mediaType === "movie") {
    const hasFile = deleted ? false : await radarrHasFile(cfg, req.tmdbId);
    return decideAdvance({ ...base, mediaType: "movie", movieHasFile: hasFile });
  }
  const raw = await sonarrSeriesFacts(cfg, req.tmdbId).catch(() => null);
  const facts = raw && deleted ? withoutDeletedSeasons(raw, req.tmdbId) : raw;
  return decideAdvance({
    ...base,
    mediaType: "tv",
    seasons: facts && facts.size > 0 ? seasonFacts(facts, req.seasons) : null
  });
}
function withoutDeletedSeasons(facts, tmdbId) {
  const whole = goneFromJellyfin("tv", tmdbId);
  const gone = goneSeasonsOf(tmdbId);
  const out = /* @__PURE__ */ new Map();
  for (const [key, fact] of facts) {
    const season = Number(/^S(\d+)E/.exec(key)?.[1]);
    out.set(key, fact.hasFile && (whole || gone.has(season)) ? { ...fact, hasFile: false } : fact);
  }
  return out;
}
function arrivalNotifications(req, d) {
  const out = [];
  if (d.notifyDownloading) out.push({ title: req.title, body: `\xAB ${req.title} \xBB est en route` });
  if (d.notifyMovie) out.push({ title: req.title, body: `\xAB ${req.title} \xBB ${releasedSuffix("m", false)}` });
  if (d.notifySeasons.length > 0) {
    const requested2 = req.seasons ?? [];
    const arrived = (d.notified ?? req.notifiedSeasons ?? []).filter((s) => requested2.includes(s)).length;
    const n = seasonNotification(req, d.notifySeasons, arrived);
    out.push({ title: n.title, body: n.message });
  }
  return out;
}
async function apply(db, req, d) {
  const notifications = arrivalNotifications(req, d);
  if (d.status === null && d.notified === null && notifications.length === 0) return;
  if (d.status) {
    await updateRequestStatus(db, req.id, d.status, d.completed ? { completedAt: /* @__PURE__ */ new Date() } : void 0);
    console.log(`[SeerArr] "${req.title}" status: ${req.status} \u2192 ${d.status}`);
  }
  for (const n of notifications) {
    await db.core.notification.create({
      data: { jellyfinUserId: req.jellyfinUserId, type: "request_status", title: n.title, body: n.body, refId: req.id }
    });
  }
  if (d.notified) await setNotifiedSeasons(db, req.id, d.notified);
  invalidateRequestCaches(req.jellyfinUserId);
  await upsertContentClaim(db, req.tmdbId, req.jellyfinUserId, req.mediaType, req.title, CLAIM_TTL_SECONDS).catch(() => {
  });
}

// server/seerr-status-map.ts
function mapSeerrStatus(requestStatus, mediaStatus, downloadStatus) {
  if (requestStatus === 3) return "failed";
  if (requestStatus === 4) return "failed";
  if (mediaStatus === 5) return "available";
  if (mediaStatus === 4) return "partially_available";
  if (mediaStatus === 7) return "deleted";
  if (mediaStatus === 1) return "unavailable";
  if (mediaStatus === 3) {
    return downloadStatus && downloadStatus.length > 0 ? "downloading" : "unavailable";
  }
  if (requestStatus === 1) return "sent_to_seer";
  return "approved";
}

// server/worker-sync.ts
var CLAIM_TTL_SECONDS2 = 1800;
async function syncStatuses(db, config) {
  const requests = await getRequestsToSync(db);
  await purgeExpiredContentClaims(db).catch(() => {
  });
  if (requests.length === 0) return;
  let availabilitySyncDone = false;
  for (const request of requests) {
    if (!request.seerrRequestId) continue;
    await upsertContentClaim(
      db,
      request.tmdbId,
      request.jellyfinUserId,
      request.mediaType,
      request.title,
      CLAIM_TTL_SECONDS2
    ).catch(() => {
    });
    try {
      const res = await fetch(
        `${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`,
        { headers: { "X-Api-Key": config.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
      );
      if (!res.ok) {
        if (res.status === 404) {
          await updateRequestStatus(db, request.id, "deleted", {
            lastError: "Demande supprim\xE9e c\xF4t\xE9 Jellyseerr"
          });
          invalidateRequestCaches(request.jellyfinUserId);
        }
        continue;
      }
      const data = await res.json();
      const own = { status: data.status, seasons: (data.seasons ?? []).map((s) => s.seasonNumber) };
      const facts = factsWithRequest(request.mediaType, request.tmdbId, own, (data.media?.downloadStatus?.length ?? 0) > 0);
      const mediaStatus = correctMediaStatus(request.mediaType, data.media?.status, facts);
      const globalStatus = mapSeerrStatus(data.status, mediaStatus, data.media?.downloadStatus);
      if (globalStatus === "failed" && request.status !== "failed") {
        await handleFailedSync(db, config, request, data);
        invalidateRequestCaches(request.jellyfinUserId);
        continue;
      }
      if (request.mediaType === "tv" && (request.seasons?.length ?? 0) > 0) {
        await syncTvSeasons(db, config, request, globalStatus, mediaStatus, own);
      } else {
        await syncGlobal(db, request, globalStatus, mediaStatus);
      }
      if (!availabilitySyncDone && request.mediaType === "tv" && (globalStatus === "partially_available" || globalStatus === "downloading")) {
        availabilitySyncDone = true;
        await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      }
    } catch (err) {
      console.warn(`[SeerWorker] Failed to sync request #${request.seerrRequestId}:`, err);
    }
  }
}
async function syncGlobal(db, request, newStatus, mediaStatus) {
  if (newStatus === request.status) return;
  if (arrKnows(request.mediaType) && isDowngrade(request.status, newStatus)) return;
  const extra = { seerrMediaStatus: mediaStatus };
  if (newStatus === "available") extra.completedAt = /* @__PURE__ */ new Date();
  await updateRequestStatus(db, request.id, newStatus, extra);
  invalidateRequestCaches(request.jellyfinUserId);
  const notif = statusNotification(request, newStatus);
  if (notif) {
    await db.core.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: notif.title,
        body: notif.message,
        refId: request.id
      }
    });
  }
  console.log(`[SeerWorker] "${request.title}" status: ${request.status} \u2192 ${newStatus}`);
}
async function syncTvSeasons(db, config, request, fallbackStatus, mediaStatus, own) {
  const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, "tv", request.tmdbId);
  const facts = factsWithRequest("tv", request.tmdbId, own);
  const mediaSeasons = detail?.mediaInfo?.seasons?.map((s) => ({
    ...s,
    status: correctSeasonStatus(s.seasonNumber, s.status, facts) ?? s.status
  }));
  const kept = await releaseGoneSeasons(db, request, mediaSeasons);
  if (!kept) return;
  request = kept;
  const newStatus = await notifyAvailableSeasons(db, request, mediaSeasons);
  if (newStatus === null) {
    await syncGlobal(db, request, fallbackStatus, mediaStatus);
    return;
  }
  if (newStatus !== request.status && !(arrKnows("tv") && isDowngrade(request.status, newStatus))) {
    const extra = { seerrMediaStatus: mediaStatus };
    if (newStatus === "available") extra.completedAt = /* @__PURE__ */ new Date();
    await updateRequestStatus(db, request.id, newStatus, extra);
    invalidateRequestCaches(request.jellyfinUserId);
    console.log(`[SeerWorker] "${request.title}" status: ${request.status} \u2192 ${newStatus}`);
  }
}
async function handleFailedSync(db, config, request, data) {
  const retryN = request.retryCount + 1;
  if (retryN < request.maxRetries) {
    await fetch(`${config.seerrUrl}/api/v1/request/${request.seerrRequestId}`, {
      method: "DELETE",
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    }).catch(() => {
    });
    if (request.seerrMediaId) {
      await fetch(`${config.seerrUrl}/api/v1/media/${request.seerrMediaId}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(1e4)
      }).catch(() => {
      });
    }
    await db.execute(
      `UPDATE seer_requests SET updated_at = ${db.sql.now()}, status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      retryN,
      request.id
    );
    console.log(`[SeerWorker] Auto-retry "${request.title}" (attempt ${retryN}/${request.maxRetries})`);
  } else {
    await updateRequestStatus(db, request.id, "failed", {
      seerrMediaStatus: data.media?.status,
      retryCount: retryN
    });
    await db.core.notification.create({
      data: {
        jellyfinUserId: request.jellyfinUserId,
        type: "request_status",
        title: request.title,
        body: `\xC9chec d\xE9finitif pour \xAB ${request.title} \xBB apr\xE8s ${request.maxRetries} tentatives`,
        refId: request.id
      }
    });
    console.log(`[SeerWorker] "${request.title}" PERMANENTLY FAILED after ${request.maxRetries} retries`);
  }
}
async function retryFailedRequests(db) {
  const failed = await db.query(
    // Les lignes héritées de l'ancien classement (404 → « failed ») ne sont
    // plus recréées non plus : une suppression côté Jellyseerr est acquise.
    `SELECT id, title, retry_count, max_retries FROM seer_requests
     WHERE status = 'failed' AND retry_count < max_retries
       AND (last_error IS NULL OR last_error != 'Request no longer exists on Seerr') ORDER BY id ASC LIMIT 3`
  );
  for (const req of failed) {
    const newRetry = req.retry_count + 1;
    await db.execute(
      `UPDATE seer_requests SET updated_at = ${db.sql.now()}, status = 'retry_pending', seerr_request_id = NULL, seerr_media_id = NULL, seerr_media_status = NULL, retry_count = ? WHERE id = ?`,
      newRetry,
      req.id
    );
    console.log(`[SeerWorker] Auto-retry "${req.title}" (attempt ${newRetry}/${req.max_retries})`);
  }
}
function statusNotification(request, newStatus) {
  switch (newStatus) {
    // « En route », jamais « téléchargement » : l'application mobile affiche
    // ces notifications et n'écrit ce mot nulle part (cf. CLAUDE.md du core).
    case "downloading":
      return { type: "request_downloading", title: request.title, message: `\xAB ${request.title} \xBB est en route` };
    case "available": {
      const suffix = releasedSuffix(request.mediaType === "movie" ? "m" : "f", false);
      return { type: "request_available", title: request.title, message: `\xAB ${request.title} \xBB ${suffix}` };
    }
    case "failed":
      return { type: "request_declined", title: request.title, message: `Votre demande pour \xAB ${request.title} \xBB a \xE9t\xE9 refus\xE9e` };
    default:
      return null;
  }
}

// server/cleanup-arr.ts
var LIVE_REQUEST = /* @__PURE__ */ new Set([1, 2, 5]);
async function cleanArrForJob(config, job, media) {
  const arrId = media?.externalServiceId;
  if (!media || !arrId) return "no-target";
  const server = await getArrServerConfig(config.seerrUrl, config.seerrApiKey, job.mediaType === "movie" ? "radarr" : "sonarr");
  if (!server) return "no-target";
  return job.mediaType === "movie" ? cleanMovie(server, arrId, job, media) : cleanSeries(server, arrId, job);
}
async function cleanMovie(server, movieId, job, media) {
  const others = media.requests.filter((r) => r.id !== job.seerrRequestId && !r.is4k && LIVE_REQUEST.has(r.status));
  if (others.length > 0) return "kept";
  await cancelRadarrQueue(server, movieId);
  if (!await removeRadarrMovie(server, movieId, job.deleteFiles)) throw new Error("Radarr remove failed");
  return "removed";
}
async function cleanSeries(server, seriesId, job) {
  await cancelSonarrQueue(server, seriesId, job.seasons);
  if (!await unmonitorSonarrSeasons(server, seriesId, job.seasons)) throw new Error("Sonarr unmonitor failed");
  if (job.deleteFiles && !await deleteSonarrSeasonFiles(server, seriesId, job.seasons)) {
    throw new Error("Sonarr delete season files failed");
  }
  const outcome = await removeSonarrSeriesIfUnmonitored(server, seriesId, job.deleteFiles);
  if (outcome === "failed") throw new Error("Sonarr remove failed");
  return outcome === "removed" ? "removed" : "unmonitored";
}
async function removeRadarrMovie(server, movieId, deleteFiles) {
  try {
    const res = await arrFetch(server, `/api/v3/movie/${movieId}?deleteFiles=${deleteFiles}&addImportExclusion=false`, { method: "DELETE" });
    return res.ok || res.status === 404;
  } catch (err) {
    console.warn(`[ArrService] removeRadarrMovie #${movieId} failed:`, err);
    return false;
  }
}
async function removeSonarrSeriesIfUnmonitored(server, seriesId, deleteFiles) {
  try {
    const res = await arrFetch(server, `/api/v3/series/${seriesId}`);
    if (res.status === 404) return "removed";
    if (!res.ok) return "failed";
    const series = await res.json();
    if ((series.seasons ?? []).some((s) => s.monitored)) return "kept";
    const empty = series.statistics?.episodeFileCount === 0;
    const del = await arrFetch(
      server,
      `/api/v3/series/${seriesId}?deleteFiles=${deleteFiles && empty}&addImportListExclusion=false`,
      { method: "DELETE" }
    );
    return del.ok || del.status === 404 ? "removed" : "failed";
  } catch (err) {
    console.warn(`[ArrService] removeSonarrSeriesIfUnmonitored #${seriesId} failed:`, err);
    return "failed";
  }
}

// server/seerr-media.ts
var CLAIMS_SOMETHING = /* @__PURE__ */ new Set([2, 3, 4, 5]);
async function getSeerrMedia(cfg, mediaType, tmdbId) {
  try {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const m = data.mediaInfo;
    if (!m || typeof m.id !== "number") return null;
    return {
      id: m.id,
      status: m.status ?? 1,
      externalServiceId: m.externalServiceId ?? null,
      serviceId: m.serviceId ?? null,
      requests: (m.requests ?? []).filter((r) => typeof r.id === "number").map((r) => ({ id: r.id, status: r.status ?? 0, is4k: r.is4k === true }))
    };
  } catch {
    return null;
  }
}
async function resetGoneMedia(cfg, mediaType, tmdbId, title) {
  if (!goneFromJellyfin(mediaType, tmdbId)) return false;
  const media = await getSeerrMedia(cfg, mediaType, tmdbId);
  if (!media || media.requests.length > 0 || !CLAIMS_SOMETHING.has(media.status)) return false;
  try {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/media/${media.id}`, {
      method: "DELETE",
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok && res.status !== 404) return false;
    console.log(`[SeerWorker] \xAB ${title} \xBB n'est plus dans Jellyfin : son m\xE9dia Jellyseerr est remis \xE0 z\xE9ro (statut ${media.status} p\xE9rim\xE9)`);
    return true;
  } catch {
    return false;
  }
}

// server/seerr-reconcile.ts
async function reconcileSeerrSeasons(db, config, tmdbId, removedSeasons) {
  if (removedSeasons.length === 0) return;
  const removed = new Set(removedSeasons);
  const headers = { "X-Api-Key": config.seerrApiKey };
  const res = await fetch(`${config.seerrUrl}/api/v1/tv/${tmdbId}`, {
    headers,
    signal: AbortSignal.timeout(1e4)
  });
  if (res.status === 404) return;
  if (!res.ok) {
    throw new Error(`Jellyseerr GET /tv/${tmdbId} returned ${res.status}`);
  }
  const detail = await res.json();
  for (const req of detail.mediaInfo?.requests ?? []) {
    const seasons = (req.seasons ?? []).map((s) => s.seasonNumber).filter((n) => typeof n === "number");
    if (seasons.length === 0) continue;
    const remaining = seasons.filter((n) => !removed.has(n));
    if (remaining.length === seasons.length) continue;
    if (remaining.length === 0) {
      const del = await fetch(`${config.seerrUrl}/api/v1/request/${req.id}`, {
        method: "DELETE",
        headers,
        signal: AbortSignal.timeout(1e4)
      });
      if (!del.ok && del.status !== 404) {
        throw new Error(`Jellyseerr DELETE /request/${req.id} returned ${del.status}`);
      }
      await db.execute(
        `DELETE FROM seer_requests WHERE seerr_request_id = ?`,
        req.id
      );
      console.log(
        `[SeerReconcile] tv#${tmdbId} : demande Jellyseerr #${req.id} supprim\xE9e (S${seasons.join(", S")} retir\xE9es)`
      );
    } else {
      const put2 = await fetch(`${config.seerrUrl}/api/v1/request/${req.id}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType: "tv", seasons: remaining }),
        signal: AbortSignal.timeout(1e4)
      });
      if (put2.status === 409) {
        console.log(
          `[SeerReconcile] tv#${tmdbId} : Jellyseerr ne modifie plus la demande #${req.id} (statut ${req.status}) \u2014 S${seasons.join(", S")} y restent list\xE9es`
        );
      } else if (!put2.ok && put2.status !== 404) {
        const text2 = await put2.text().catch(() => "");
        throw new Error(
          `Jellyseerr PUT /request/${req.id} returned ${put2.status} ${text2.slice(0, 200)}`
        );
      } else {
        console.log(
          `[SeerReconcile] tv#${tmdbId} : demande Jellyseerr #${req.id} r\xE9duite aux saisons S${remaining.join(", S")}`
        );
      }
      await db.execute(
        `UPDATE seer_requests SET updated_at = ${db.sql.now()}, seasons = ? WHERE seerr_request_id = ?`,
        JSON.stringify(remaining),
        req.id
      );
    }
  }
}

// server/worker-cleanup.ts
var CLEANUP_BATCH = 25;
async function processCleanupQueue(db, config) {
  for (let pass = 0; pass < 4; pass++) {
    const jobs = await getPendingCleanups(db, CLEANUP_BATCH);
    if (jobs.length === 0) return;
    for (const job of jobs) {
      await processCleanupJob(db, config, job);
    }
    if (jobs.length < CLEANUP_BATCH) return;
  }
}
function invalidateForJob(job) {
  invalidateRequestCaches(job.jellyfinUserId);
}
async function processCleanupJob(db, config, job) {
  const headers = { "X-Api-Key": config.seerrApiKey };
  try {
    if (job.action === "sync") {
      await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      await resetGoneMedia(config, job.mediaType, job.tmdbId, job.title);
      await updateCleanupJob(db, job.id, "completed");
      invalidateForJob(job);
      console.log(`[SeerWorker] availability-sync re-d\xE9clench\xE9e pour "${job.title}"`);
      return;
    }
    const media = await getSeerrMedia(config, job.mediaType, job.tmdbId);
    const arr = await cleanArrForJob(config, job, media);
    console.log(
      `[SeerWorker] *arr pour "${job.title}" : ${arr} (saisons=${job.seasons ? JSON.stringify(job.seasons) : "toutes"}, fichiers supprim\xE9s=${job.deleteFiles})`
    );
    if (job.seerrRequestId) {
      const delRes = await fetch(
        `${config.seerrUrl}/api/v1/request/${job.seerrRequestId}`,
        { method: "DELETE", headers, signal: AbortSignal.timeout(1e4) }
      );
      if (!delRes.ok && delRes.status !== 404) {
        throw new Error(`Jellyseerr request delete returned ${delRes.status}`);
      }
    }
    if (job.mediaType === "tv" && job.seasons && job.seasons.length > 0) {
      await reconcileSeerrSeasons(db, config, job.tmdbId, job.seasons);
    }
    await resetGoneMedia(config, job.mediaType, job.tmdbId, job.title);
    await updateCleanupJob(db, job.id, "completed");
    if (job.requestId) {
      await deleteRequestById(db, job.requestId);
      console.log(`[SeerWorker] Deleted local request ${job.requestId}`);
    }
    await clearPendingCleanup(db, job.id);
    if (job.deleteFiles) {
      await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
      for (const delay of [120, 600]) {
        await enqueueCleanup(db, {
          action: "sync",
          mediaType: job.mediaType,
          tmdbId: job.tmdbId,
          title: job.title,
          deleteFiles: false,
          seasons: null,
          delaySeconds: delay,
          // Propagation obligatoire : sans elle, ces jobs enfants naîtraient
          // sans propriétaire et retomberaient sur l'invalidation globale.
          jellyfinUserId: job.jellyfinUserId
        });
      }
    }
    invalidateForJob(job);
    console.log(`[SeerWorker] Cleanup completed for "${job.title}"`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const newRetry = job.retryCount + 1;
    if (newRetry >= job.maxRetries) {
      await updateCleanupJob(db, job.id, "failed", { lastError: errMsg, retryCount: newRetry });
      if (job.requestId) {
        await updateRequestStatus(db, job.requestId, "delete_failed", {
          lastError: `\xC9chec suppression: ${errMsg}`
        });
      }
      await clearPendingCleanup(db, job.id);
      console.warn(`[SeerWorker] Cleanup FAILED permanently for "${job.title}" after ${newRetry} retries`);
    } else {
      const delaySec = Math.min(30 * Math.pow(2, newRetry - 1), 1800);
      const nextRetry = new Date(Date.now() + delaySec * 1e3);
      await updateCleanupJob(db, job.id, "pending", {
        lastError: errMsg,
        retryCount: newRetry,
        nextRetryAt: nextRetry
      });
      console.log(`[SeerWorker] Cleanup retry ${newRetry}/${job.maxRetries} for "${job.title}" in ${delaySec}s`);
    }
  }
}

// server/jellyseerr-user.ts
var SeerrAccountError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
};
var LINK_CHECK_TTL_MS = 10 * 6e4;
var checkedLinks = /* @__PURE__ */ new Map();
function forgetSeerrUserChecks() {
  checkedLinks.clear();
}
async function seerrUserExists(config, id) {
  const until = checkedLinks.get(id);
  if (until && until > Date.now()) return true;
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/user/${id}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(8e3)
    });
    if (res.status === 404) return false;
    if (!res.ok) return null;
    checkedLinks.set(id, Date.now() + LINK_CHECK_TTL_MS);
    return true;
  } catch {
    return null;
  }
}
async function resolveJellyseerrUserId(config, db, jellyfinUserId, username) {
  const settings = await getOrCreateUserSettings(db, jellyfinUserId, username);
  if (settings.jellyseerrUserId) {
    if (await seerrUserExists(config, settings.jellyseerrUserId) !== false) return settings.jellyseerrUserId;
    await updateUserSettings(db, jellyfinUserId, { jellyseerrUserId: null, jellyseerrLastSync: null });
  }
  const found = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (found) {
    await updateUserSettings(db, jellyfinUserId, {
      jellyseerrUserId: found.id,
      jellyseerrLastSync: /* @__PURE__ */ new Date()
    });
    return found.id;
  }
  if (username) {
    const placeholder = await findOrphanPlaceholderByUsername(config, username);
    if (placeholder) {
      await relinkJellyseerrUserToJellyfin(config, placeholder.id, jellyfinUserId);
      await updateUserSettings(db, jellyfinUserId, {
        jellyseerrUserId: placeholder.id,
        jellyseerrLastSync: /* @__PURE__ */ new Date()
      });
      return placeholder.id;
    }
  }
  let importError = null;
  try {
    const imported = await importJellyseerrUserFromJellyfin(config, jellyfinUserId);
    if (imported) {
      await updateUserSettings(db, jellyfinUserId, {
        jellyseerrUserId: imported.id,
        jellyseerrLastSync: /* @__PURE__ */ new Date()
      });
      return imported.id;
    }
  } catch (err) {
    importError = err instanceof Error ? err.message : String(err);
  }
  const refreshed = await findJellyseerrUserByJellyfinId(config, jellyfinUserId);
  if (refreshed) {
    await updateUserSettings(db, jellyfinUserId, {
      jellyseerrUserId: refreshed.id,
      jellyseerrLastSync: /* @__PURE__ */ new Date()
    });
    return refreshed.id;
  }
  try {
    const local = await createPlaceholderJellyseerrUser(config, username || jellyfinUserId);
    await updateUserSettings(db, jellyfinUserId, {
      jellyseerrUserId: local.id,
      jellyseerrLastSync: /* @__PURE__ */ new Date()
    });
    console.warn(`[SeerUsers] Import refus\xE9 par Jellyseerr (${importError ?? "sans r\xE9ponse"}) : compte local #${local.id} pour ${username}`);
    return local.id;
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    throw new SeerrAccountError(
      `Jellyseerr refuse d'importer ce compte depuis Jellyfin${importError ? ` (${importError})` : ""}, et n'a pas voulu cr\xE9er de compte local (${why}). V\xE9rifiez la connexion de Jellyseerr \xE0 Jellyfin (Jellyseerr \u2192 Param\xE8tres \u2192 Jellyfin).`,
      /Email notifications must be enabled/i.test(why) ? "local-needs-email" : "import-and-local-refused"
    );
  }
}
async function findOrphanPlaceholderByUsername(config, username) {
  const all = await listAllJellyseerrUsers(config);
  const target = username.trim().toLowerCase();
  return all.find(
    (u) => !u.jellyfinUserId && (u.username && u.username.trim().toLowerCase() === target || u.jellyfinUsername && u.jellyfinUsername.trim().toLowerCase() === target)
  ) ?? null;
}
async function createPlaceholderJellyseerrUser(config, username) {
  const existing = await findOrphanPlaceholderByUsername(config, username);
  if (existing) return existing;
  const email = `${username.toLowerCase().replace(/[^a-z0-9._-]+/g, "")}@tentacle.local`;
  const res = await fetch(`${config.seerrUrl}/api/v1/user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ email, username }),
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    const text2 = await res.text().catch(() => "");
    throw new Error(`Jellyseerr POST /user failed (${res.status}): ${text2.slice(0, 200)}`);
  }
  return await res.json();
}
async function invalidateStaleJellyseerrCache(config, db) {
  const seerUsers = await listAllJellyseerrUsers(config);
  const validIds = new Set(seerUsers.map((u) => u.id));
  const rows = await db.query(
    `SELECT jellyfin_user_id, jellyseerr_user_id FROM seer_user_settings WHERE jellyseerr_user_id IS NOT NULL`
  );
  let invalidated = 0;
  for (const row of rows) {
    if (!validIds.has(row.jellyseerr_user_id)) {
      await db.execute(
        `UPDATE seer_user_settings SET updated_at = ${db.sql.now()}, jellyseerr_user_id = NULL, jellyseerr_last_sync = NULL WHERE jellyfin_user_id = ?`,
        row.jellyfin_user_id
      );
      invalidated++;
    }
  }
  return invalidated;
}
async function relinkJellyseerrUserToJellyfin(config, jellyseerrUserId, jellyfinUserId) {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/${jellyseerrUserId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ jellyfinUserId }),
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    const text2 = await res.text().catch(() => "");
    throw new Error(`Jellyseerr PUT /user/${jellyseerrUserId} failed (${res.status}): ${text2.slice(0, 200)}`);
  }
}
async function findJellyseerrUserByJellyfinId(config, jellyfinUserId) {
  const all = await listAllJellyseerrUsers(config);
  const normalized = (id) => (id || "").toLowerCase().replace(/-/g, "");
  const target = normalized(jellyfinUserId);
  return all.find((u) => normalized(u.jellyfinUserId) === target) ?? null;
}
async function listAllJellyseerrUsers(config) {
  const out = [];
  let skip = 0;
  const take = 100;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${config.seerrUrl}/api/v1/user?take=${take}&skip=${skip}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      throw new Error(`Jellyseerr GET /user failed: ${res.status}`);
    }
    const data = await res.json();
    const page = data.results ?? [];
    out.push(...page);
    if (page.length < take) break;
    skip += take;
  }
  return out;
}
async function deleteJellyseerrUser(config, id) {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/${id}`, {
    method: "DELETE",
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok && res.status !== 404) {
    const text2 = await res.text().catch(() => "");
    throw new Error(`Jellyseerr DELETE /user/${id} a r\xE9pondu ${res.status}: ${text2.slice(0, 200)}`);
  }
  checkedLinks.delete(id);
}
async function importJellyseerrUserFromJellyfin(config, jellyfinUserId) {
  const res = await fetch(`${config.seerrUrl}/api/v1/user/import-from-jellyfin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
    body: JSON.stringify({ jellyfinUserIds: [jellyfinUserId] }),
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    const text2 = await res.text().catch(() => "");
    throw new Error(`Jellyseerr import-from-jellyfin failed (${res.status}): ${text2.slice(0, 200)}`);
  }
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) return data[0];
  if (!Array.isArray(data) && data && typeof data === "object") return data;
  return null;
}

// server/blocklist.ts
var MEDIA_STATUS_BLOCKLISTED = 6;
var KEYWORD_FETCH_CONCURRENCY = 8;
async function getBlocklistedTags(seerrUrl2, apiKey) {
  return ((await getSeerrMainSettings(seerrUrl2, apiKey)).blocklistedTags ?? "").trim();
}
function parseTagSet(csv) {
  const set = /* @__PURE__ */ new Set();
  for (const part of csv.split(",")) {
    const id = Number(part.trim());
    if (Number.isFinite(id) && id > 0) set.add(id);
  }
  return set;
}
async function getItemKeywordIds(seerrUrl2, apiKey, mediaType, id) {
  return cached(`seerr:kw:${mediaType}:${id}`, 7 * 864e5, async () => {
    try {
      const res = await fetch(`${seerrUrl2}/api/v1/${mediaType}/${id}`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(8e3)
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.keywords) ? data.keywords.map((k) => k?.id).filter((x) => typeof x === "number") : [];
    } catch {
      return [];
    }
  });
}
async function filterResultsByTags(seerrUrl2, apiKey, results, blockedSet) {
  const afterStatus = results.filter((r) => r?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED);
  let blockedCount = results.length - afterStatus.length;
  const blockedFlags = new Array(afterStatus.length).fill(false);
  const checkable = afterStatus.map((item, idx) => ({ item, idx })).filter(({ item }) => (item.mediaType === "movie" || item.mediaType === "tv") && typeof item.id === "number");
  await mapLimit(checkable, KEYWORD_FETCH_CONCURRENCY, async ({ item, idx }) => {
    const kwIds = await getItemKeywordIds(
      seerrUrl2,
      apiKey,
      item.mediaType,
      item.id
    );
    if (kwIds.some((id) => blockedSet.has(id))) blockedFlags[idx] = true;
  });
  const kept = afterStatus.filter((_, idx) => !blockedFlags[idx]);
  blockedCount += afterStatus.length - kept.length;
  return { kept, blockedCount };
}
function isMaskedTitle(detail, blockedTags) {
  if (detail.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED) return true;
  return (detail.keywords ?? []).some((k) => typeof k?.id === "number" && blockedTags.has(k.id));
}
async function liftBlocklist(seerrUrl2, apiKey, mediaType, tmdbId) {
  for (const route of ["blocklist", "blacklist"]) {
    try {
      const res = await fetch(`${seerrUrl2}/api/v1/${route}/${tmdbId}?mediaType=${mediaType}`, {
        method: "DELETE",
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(1e4)
      });
      if (res.ok) return true;
      if (res.status !== 404) return false;
    } catch {
      return false;
    }
  }
  return false;
}

// server/live/seerr-unblock.ts
var DEFER_MS = 2 * 6e4;
var MAX_WAIT_MS = 30 * 6e4;
var SYNC_EVERY_MS = 15 * 6e4;
var deferred = /* @__PURE__ */ new Map();
var lastSync = 0;
function deferredRequestIds(now = Date.now()) {
  const out = [];
  for (const [id, d] of deferred) {
    if (now - d.since > MAX_WAIT_MS + DEFER_MS) deferred.delete(id);
    else if (d.until > now) out.push(id);
  }
  return out;
}
function staleSeasons(request, detail) {
  if (request.mediaType !== "tv" || !request.seasons?.length) return [];
  const whole = goneFromJellyfin("tv", request.tmdbId);
  const gone = goneSeasonsOf(request.tmdbId);
  const held = new Map((detail?.mediaInfo?.seasons ?? []).map((s) => [s.seasonNumber, s.status]));
  return request.seasons.filter((s) => {
    if (!whole && !gone.has(s)) return false;
    const status = held.get(s);
    return status !== void 0 && status !== STATUS.UNKNOWN && status !== STATUS.DELETED;
  });
}
function syncSoon(cfg, now) {
  if (now - lastSync < SYNC_EVERY_MS) return;
  lastSync = now;
  void triggerSeerrJob(cfg.seerrUrl, cfg.seerrApiKey, "availability-sync");
  console.log("[VigieLive] Jellyseerr croit encore l\xE0 des saisons supprim\xE9es de Jellyfin : v\xE9rification relanc\xE9e (availability-sync)");
}
async function unblockSeasons(cfg, request, detail, now = Date.now()) {
  const mediaId = detail?.mediaInfo?.id;
  const live = (detail?.mediaInfo?.requests ?? []).some((r) => isLiveRequest({ status: r.status, seasons: [] }));
  if (mediaId && goneFromJellyfin("tv", request.tmdbId) && !live) {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/media/${mediaId}`, {
      method: "DELETE",
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    }).catch(() => null);
    if (res && (res.ok || res.status === 404)) {
      deferred.delete(request.id);
      console.log(`[VigieLive] \xAB ${request.title} \xBB : fiche p\xE9rim\xE9e de Jellyseerr retir\xE9e (s\xE9rie supprim\xE9e de Jellyfin) \u2014 la demande part`);
      return "send";
    }
  }
  const prior = deferred.get(request.id);
  const since = prior?.since ?? now;
  if (now - since >= MAX_WAIT_MS) {
    deferred.delete(request.id);
    return "send";
  }
  syncSoon(cfg, now);
  deferred.set(request.id, { until: now + DEFER_MS, since });
  return "wait";
}
function refusedForStaleSeasons(request, detail) {
  return staleSeasons(request, detail).length > 0;
}

// server/worker-send.ts
async function processNextRequest(db, config, skipIds) {
  const request = await getNextQueued(db, [...skipIds]);
  if (!request || skipIds.has(request.id)) return null;
  const fresh = await getRequestById(db, request.id);
  if (!fresh || fresh.status !== "queued" && fresh.status !== "retry_pending") return request.id;
  await updateRequestStatus(db, request.id, "processing");
  try {
    const seerrBody = {
      mediaType: request.mediaType,
      mediaId: request.tmdbId
    };
    if (request.mediaType === "tv" && request.seasons) {
      seerrBody.seasons = request.seasons.map(Number);
    }
    const detail = await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, request.mediaType, request.tmdbId);
    if (detail?.mediaInfo?.requests) {
      for (const r of detail.mediaInfo.requests) {
        if (r.status === 3 || r.status === 4) {
          await fetch(`${config.seerrUrl}/api/v1/request/${r.id}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
      }
    }
    if (staleSeasons(request, detail).length > 0) {
      const ready = await unblockSeasons(config, request, detail);
      if (ready === "wait") {
        await updateRequestStatus(db, request.id, fresh.status);
        console.log(`[SeerWorker] "${request.title}" : Jellyseerr ne voit pas encore la suppression des saisons \u2014 la demande repassera`);
        return request.id;
      }
    }
    if (config.allowMaskedRequests && detail?.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED) {
      const lifted = await liftBlocklist(
        config.seerrUrl,
        config.seerrApiKey,
        request.mediaType === "tv" ? "tv" : "movie",
        request.tmdbId
      );
      console.log(`[SeerWorker] "${request.title}" : blocage Jellyseerr ${lifted ? "lev\xE9" : "impossible \xE0 lever"} avant la demande`);
    }
    if (request.mediaType === "tv" && detail && isAnimeFromKeywords(detail)) {
      const overrides = await fetchAnimeOverrides(config.seerrUrl, config.seerrApiKey);
      if (overrides) {
        Object.assign(seerrBody, {
          profileId: overrides.profileId,
          rootFolder: overrides.rootFolder,
          tags: overrides.tags
        });
        if (overrides.languageProfileId) seerrBody.languageProfileId = overrides.languageProfileId;
        console.log(`[SeerWorker] Anime detected for "${request.title}", applying overrides`);
      }
    }
    if (request.profileId && config.profiles?.length) {
      const profile = config.profiles.find((p) => p.id === request.profileId);
      if (profile) {
        if (request.mediaType === "movie") {
          if (profile.radarrServerId != null) seerrBody.serverId = profile.radarrServerId;
          if (profile.radarrProfileId != null) seerrBody.profileId = profile.radarrProfileId;
          if (profile.radarrRootFolder) seerrBody.rootFolder = profile.radarrRootFolder;
        } else {
          if (profile.sonarrServerId != null) seerrBody.serverId = profile.sonarrServerId;
          if (profile.sonarrProfileId != null) seerrBody.profileId = profile.sonarrProfileId;
          if (profile.sonarrRootFolder) seerrBody.rootFolder = profile.sonarrRootFolder;
          if (profile.sonarrLanguageProfileId != null) seerrBody.languageProfileId = profile.sonarrLanguageProfileId;
        }
        if (profile.tags !== void 0) {
          seerrBody.tags = profile.tags.length > 0 ? profile.tags : [];
        }
        console.log(`[SeerWorker] Applied profile "${profile.name}" for "${request.title}" (tags: ${JSON.stringify(profile.tags ?? "default")})`);
      }
    }
    const seerUserId = await resolveJellyseerrUserId(
      config,
      db,
      request.jellyfinUserId,
      request.username
    );
    seerrBody.userId = seerUserId;
    const res = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
      body: JSON.stringify(seerrBody),
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok || res.status === 202) {
      const text2 = await res.text().catch(() => "");
      if (text2.includes("No seasons available to request") && refusedForStaleSeasons(request, detail)) {
        await triggerSeerrJob(config.seerrUrl, config.seerrApiKey, "availability-sync");
        throw new Error("Jellyseerr croit encore pr\xE9sentes des saisons supprim\xE9es de Jellyfin");
      }
      if (text2.includes("No seasons available to request")) {
        const mediaStatus = detail?.mediaInfo?.status;
        const localStatus = mediaStatus === 5 ? "available" : mediaStatus === 4 ? "partially_available" : "sent_to_seer";
        await updateRequestStatus(db, request.id, localStatus, {
          seerrMediaId: detail?.mediaInfo?.id,
          seerrMediaStatus: mediaStatus,
          sentAt: /* @__PURE__ */ new Date()
        });
        invalidateRequestCaches(request.jellyfinUserId);
        if (request.mediaType === "tv") {
          await notifyAvailableSeasons(db, request, detail?.mediaInfo?.seasons);
        } else if (mediaStatus === 5) {
          await notifyMovieAvailable(db, request);
        }
        console.log(`[SeerWorker] "${request.title}" : saisons d\xE9j\xE0 pr\xE9sentes c\xF4t\xE9 Jellyseerr \u2014 marqu\xE9 ${localStatus}`);
        return request.id;
      }
      throw new Error(`Seerr returned ${res.status}: ${text2.slice(0, 200)}`);
    }
    const data = await res.json();
    if (config.autoApprove && data.status === 1) await approveSeerrRequest(config, data.id, request.title);
    await updateRequestStatus(db, request.id, "sent_to_seer", {
      seerrRequestId: data.id,
      seerrMediaId: data.media?.id,
      seerrMediaStatus: data.media?.status,
      sentAt: /* @__PURE__ */ new Date()
    });
    invalidateRequestCaches(request.jellyfinUserId);
    await upsertContentClaim(
      db,
      request.tmdbId,
      request.jellyfinUserId,
      request.mediaType,
      request.title,
      1800
    ).catch(() => {
    });
    console.log(`[SeerWorker] Sent request for "${request.title}" (seerr #${data.id})`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const newRetryCount = request.retryCount + 1;
    if (newRetryCount >= request.maxRetries) {
      await updateRequestStatus(db, request.id, "failed", {
        lastError: errMsg,
        retryCount: newRetryCount
      });
      await db.core.notification.create({
        data: {
          jellyfinUserId: request.jellyfinUserId,
          type: "request_status",
          title: request.title,
          body: `Votre demande pour \xAB ${request.title} \xBB a \xE9chou\xE9 apr\xE8s ${newRetryCount} tentatives`,
          refId: request.id
        }
      });
      console.warn(`[SeerWorker] Request for "${request.title}" FAILED after ${newRetryCount} retries: ${errMsg}`);
    } else {
      await updateRequestStatus(db, request.id, "retry_pending", {
        lastError: errMsg,
        retryCount: newRetryCount
      });
      console.warn(`[SeerWorker] Request for "${request.title}" retry ${newRetryCount}/${request.maxRetries}: ${errMsg}`);
    }
  }
  return request.id;
}
async function approveSeerrRequest(config, seerrRequestId, title) {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}/approve`, {
      method: "POST",
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (res.ok) console.log(`[SeerWorker] "${title}" approuv\xE9e d'office`);
    else console.warn(`[SeerWorker] Auto-approbation refus\xE9e par Jellyseerr pour "${title}" (${res.status})`);
  } catch (err) {
    console.warn(`[SeerWorker] Auto-approbation impossible pour "${title}" :`, err);
  }
}

// server/tmdb-cache.ts
function tmdbKey(ref) {
  return `${ref.mediaType}:${ref.tmdbId}`;
}
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function asDate(v) {
  if (typeof v === "string" && DATE_RE.test(v)) return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}
function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function asNumOrNull(v) {
  if (v === null || v === void 0 || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function asIdList(v) {
  return String(v ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
}
function rowToMeta(row) {
  const ids = asIdList(row.provider_ids);
  return {
    mediaType: row.media_type === "tv" ? "tv" : "movie",
    tmdbId: Number(row.tmdb_id),
    title: String(row.title ?? ""),
    posterPath: row.poster_path ?? null,
    backdropPath: row.backdrop_path ?? null,
    overview: row.overview ?? null,
    releaseDate: asDate(row.release_date),
    tmdbStatus: row.tmdb_status ?? null,
    digitalDate: asDate(row.digital_date),
    theatricalDate: asDate(row.theatrical_date),
    physicalDate: asDate(row.physical_date),
    releaseRegion: row.release_region ?? null,
    nextAirDate: asDate(row.next_air_date),
    nextSeason: asNum(row.next_season),
    nextEpisode: asNum(row.next_episode),
    lastAirDate: asDate(row.last_air_date),
    networks: row.networks ?? null,
    providerIds: ids,
    voteAverage: asNumOrNull(row.vote_average),
    popularity: asNumOrNull(row.popularity),
    originalLanguage: row.original_language || null,
    genreIds: asIdList(row.genre_ids),
    isAnime: row.is_anime === 1 || row.is_anime === true,
    // Millisecondes entières, ou `Date` quand Prisma relit la colonne DATETIME.
    expiresAt: readStoredDate(row.expires_at)?.toISOString() ?? ""
  };
}
async function getTmdbMetaBulk(db, refs, includeExpired = true) {
  const out = /* @__PURE__ */ new Map();
  if (refs.length === 0) return out;
  const byType = { movie: [], tv: [] };
  for (const r of refs) {
    if (Number.isFinite(r.tmdbId) && r.tmdbId > 0) byType[r.mediaType].push(r.tmdbId);
  }
  const freshOnly = includeExpired ? "" : ` AND expires_at > ${db.sql.now()}`;
  for (const type of ["movie", "tv"]) {
    const ids = Array.from(new Set(byType[type]));
    for (const slice of chunk(ids, 500)) {
      if (slice.length === 0) continue;
      const placeholders = slice.map(() => "?").join(",");
      const rows = await db.query(
        `SELECT * FROM seer_tmdb_cache
         WHERE media_type = ? AND tmdb_id IN (${placeholders})${freshOnly}`,
        type,
        ...slice
      );
      for (const row of rows) {
        const meta = rowToMeta(row);
        out.set(tmdbKey(meta), meta);
      }
    }
  }
  return out;
}
var UPSERT_COLS = [
  "media_type",
  "tmdb_id",
  "title",
  "poster_path",
  "backdrop_path",
  "overview",
  "release_date",
  "tmdb_status",
  "digital_date",
  "theatrical_date",
  "physical_date",
  "release_region",
  "next_air_date",
  "next_season",
  "next_episode",
  "last_air_date",
  "networks",
  "provider_ids",
  "vote_average",
  "popularity",
  "original_language",
  "genre_ids",
  "is_anime",
  "expires_at"
];
function roundOrNull(n, digits) {
  if (n === null || n === void 0 || !Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
async function upsertTmdbMetaBulk(db, rows) {
  if (rows.length === 0) return;
  const columns = [...UPSERT_COLS, "fetched_at"];
  const update = columns.filter((c) => c !== "media_type" && c !== "tmdb_id");
  const fetchedAt = db.sql.dateParam(/* @__PURE__ */ new Date());
  for (const slice of chunk(rows, 100)) {
    const values = [];
    for (const m of slice) {
      values.push(
        m.mediaType,
        m.tmdbId,
        m.title.slice(0, 500),
        m.posterPath,
        m.backdropPath,
        m.overview,
        m.releaseDate,
        m.tmdbStatus,
        m.digitalDate,
        m.theatricalDate,
        m.physicalDate,
        m.releaseRegion,
        m.nextAirDate,
        m.nextSeason,
        m.nextEpisode,
        m.lastAirDate,
        m.networks,
        m.providerIds.join(","),
        // Les arrondis que faisaient DECIMAL(3,1) et DECIMAL(8,3) sous MariaDB.
        roundOrNull(m.voteAverage, 1),
        roundOrNull(m.popularity, 3),
        m.originalLanguage ?? null,
        (m.genreIds ?? []).join(",") || null,
        m.isAnime ? 1 : 0,
        db.sql.dateParam(new Date(m.expiresAt)),
        fetchedAt
      );
    }
    await db.execute(
      db.sql.upsert({ table: "seer_tmdb_cache", columns, rows: slice.length, conflict: ["media_type", "tmdb_id"], update }),
      ...values
    );
  }
}
async function seedTmdbCacheFromLocalRequests(db) {
  const affected = await db.execute(`
    ${db.sql.insertIgnore()} INTO seer_tmdb_cache
      (media_type, tmdb_id, title, poster_path, backdrop_path, overview, release_date, fetched_at, expires_at)
    SELECT r.media_type, r.tmdb_id,
           MAX(r.title), MAX(r.poster_path), MAX(r.backdrop_path), MAX(r.overview),
           NULL, ${db.sql.now()}, ${db.sql.now()}
    FROM seer_requests r
    WHERE r.tmdb_id > 0 AND r.title <> ''
    GROUP BY r.media_type, r.tmdb_id
  `);
  return Number(affected) || 0;
}
async function listStaleTmdbRefs(db, limit) {
  const rows = await db.query(
    `SELECT media_type, tmdb_id FROM seer_tmdb_cache
     WHERE expires_at <= ${db.sql.now()} ORDER BY expires_at ASC, media_type ASC, tmdb_id ASC LIMIT ${Math.max(1, Math.floor(limit))}`
  );
  return rows.map((r) => ({
    mediaType: r.media_type === "tv" ? "tv" : "movie",
    tmdbId: Number(r.tmdb_id)
  }));
}
async function pruneTmdbCache(db, olderThanDays) {
  const days = Math.max(1, Math.floor(olderThanDays));
  const n = await db.execute(`DELETE FROM seer_tmdb_cache WHERE fetched_at < ${db.sql.shiftedNow(-days, "day")}`);
  return Number(n) || 0;
}

// server/tmdb-traits.ts
var KEYWORD_ANIME = 210024;
var GENRE_ANIMATION = 16;
var ORIGINES = /* @__PURE__ */ new Set(["JP", "KR"]);
var LANGUES = /* @__PURE__ */ new Set(["ja", "ko"]);
function lireMotsCles(brut) {
  if (Array.isArray(brut)) return brut;
  const enveloppe = brut;
  return Array.isArray(enveloppe?.results) ? enveloppe.results : [];
}
function lireGenres(raw) {
  if (Array.isArray(raw.genreIds)) return raw.genreIds;
  return (raw.genres ?? []).map((g) => g?.id).filter((id) => typeof id === "number");
}
function detectAnime(raw) {
  if (lireMotsCles(raw.keywords).some((k) => k?.id === KEYWORD_ANIME)) return true;
  const asiatique = LANGUES.has(raw.originalLanguage ?? "") || (raw.originCountry ?? []).some((c) => ORIGINES.has((c ?? "").toUpperCase()));
  return asiatique && lireGenres(raw).includes(GENRE_ANIMATION);
}
function detectAnimeLoose(m) {
  if (m.isAnime === true) return true;
  return detectAnime({
    genreIds: m.genreIds,
    originalLanguage: m.originalLanguage ?? void 0,
    originCountry: m.originCountry
  });
}

// server/tmdb-fetch.ts
var RELEASE_TYPE = {
  PREMIERE: 1,
  THEATRICAL_LIMITED: 2,
  THEATRICAL: 3,
  DIGITAL: 4,
  PHYSICAL: 5,
  TV: 6
};
function toDayString(raw) {
  if (!raw || typeof raw !== "string") return null;
  const day = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}
function todayString(now = /* @__PURE__ */ new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
function pickReleaseDates(groups, region) {
  const empty = { digital: null, theatrical: null, physical: null, region: null };
  if (!Array.isArray(groups) || groups.length === 0) return empty;
  const wanted = region.toUpperCase();
  const group = groups.find((g) => g.iso_3166_1?.toUpperCase() === wanted) ?? groups.find((g) => g.iso_3166_1?.toUpperCase() === "US") ?? groups[0];
  if (!group?.release_dates?.length) return empty;
  const earliest = (types) => {
    let best = null;
    for (const r of group.release_dates ?? []) {
      if (typeof r.type !== "number" || !types.includes(r.type)) continue;
      const day = toDayString(r.release_date);
      if (day && (best === null || day < best)) best = day;
    }
    return best;
  };
  return {
    digital: earliest([RELEASE_TYPE.DIGITAL]),
    // Une sortie salle limitée ou une avant-première comptent comme « au cinéma ».
    theatrical: earliest([
      RELEASE_TYPE.THEATRICAL,
      RELEASE_TYPE.THEATRICAL_LIMITED,
      RELEASE_TYPE.PREMIERE
    ]),
    physical: earliest([RELEASE_TYPE.PHYSICAL, RELEASE_TYPE.TV]),
    region: group.iso_3166_1?.toUpperCase() ?? null
  };
}
var DAY = 864e5;
function computeTtlMs(meta, now = Date.now()) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const today = todayString(new Date(now));
  if (meta.mediaType === "tv") {
    const status = (meta.tmdbStatus ?? "").toLowerCase();
    if (status === "ended" || status === "canceled" || status === "cancelled") return 30 * DAY;
    if (meta.nextAirDate) {
      if (meta.nextAirDate <= today) return 6 * 36e5;
      const diff = (/* @__PURE__ */ new Date(`${meta.nextAirDate}T00:00:00`)).getTime() - now;
      return clamp(diff + DAY, 6 * 36e5, 7 * DAY);
    }
    return 2 * DAY;
  }
  if (meta.digitalDate && meta.digitalDate <= today) return 30 * DAY;
  if (meta.theatricalDate && meta.theatricalDate <= today) return 3 * DAY;
  if (meta.releaseDate && meta.releaseDate < today) return 30 * DAY;
  return 12 * 36e5;
}
function parseDetailToMeta(raw, ref, region) {
  const isTv = ref.mediaType === "tv";
  const rel = isTv ? { digital: null, theatrical: null, physical: null, region: null } : pickReleaseDates(raw.releases?.results, region);
  const providerIds = [];
  for (const wp of raw.watchProviders ?? []) {
    if (wp.iso_3166_1?.toUpperCase() !== region.toUpperCase()) continue;
    for (const p of wp.flatrate ?? []) {
      const id = p.id ?? p.providerId;
      if (typeof id === "number" && id > 0) providerIds.push(id);
    }
  }
  const meta = {
    mediaType: ref.mediaType,
    tmdbId: ref.tmdbId,
    title: raw.title ?? raw.name ?? "",
    posterPath: raw.posterPath ?? null,
    backdropPath: raw.backdropPath ?? null,
    overview: raw.overview ?? null,
    releaseDate: toDayString(raw.releaseDate ?? raw.firstAirDate),
    tmdbStatus: raw.status ?? null,
    digitalDate: rel.digital,
    theatricalDate: rel.theatrical,
    physicalDate: rel.physical,
    releaseRegion: rel.region,
    nextAirDate: toDayString(raw.nextEpisodeToAir?.airDate),
    nextSeason: raw.nextEpisodeToAir?.seasonNumber ?? null,
    nextEpisode: raw.nextEpisodeToAir?.episodeNumber ?? null,
    lastAirDate: toDayString(raw.lastEpisodeToAir?.airDate),
    networks: (raw.networks ?? []).map((n) => n?.name).filter((n) => !!n).slice(0, 3).join(", ") || null,
    providerIds: Array.from(new Set(providerIds)),
    voteAverage: typeof raw.voteAverage === "number" ? raw.voteAverage : null,
    popularity: typeof raw.popularity === "number" ? raw.popularity : null,
    originalLanguage: raw.originalLanguage ?? null,
    genreIds: (raw.genres ?? []).map((g) => g?.id).filter((id) => typeof id === "number"),
    isAnime: detectAnime(raw),
    expiresAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  meta.expiresAt = new Date(Date.now() + computeTtlMs(meta)).toISOString();
  return meta;
}
async function fetchTmdbMeta(cfg, ref, region) {
  try {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/${ref.mediaType}/${ref.tmdbId}`, {
      headers: { "X-Api-Key": cfg.seerrApiKey },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return null;
    return parseDetailToMeta(await res.json(), ref, region);
  } catch {
    return null;
  }
}

// server/tmdb-resolver.ts
var DEFAULT_REGION = "FR";
var inflightMeta = /* @__PURE__ */ new Map();
function fetchOnce(cfg, ref, region) {
  const key = tmdbKey(ref);
  const pending2 = inflightMeta.get(key);
  if (pending2) return pending2;
  const p = fetchTmdbMeta(cfg, ref, region).finally(() => {
    inflightMeta.delete(key);
  });
  inflightMeta.set(key, p);
  return p;
}
function dedupeRefs(refs) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const r of refs) {
    if (!r || !Number.isFinite(r.tmdbId) || r.tmdbId <= 0) continue;
    const k = tmdbKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
async function resolveTmdbMeta(db, cfg, refs, opts = {}) {
  const unique = dedupeRefs(refs);
  if (unique.length === 0) return { meta: /* @__PURE__ */ new Map(), missing: [] };
  const meta = await getTmdbMetaBulk(db, unique, opts.includeExpired ?? true);
  const missing = unique.filter((r) => !meta.has(tmdbKey(r)));
  const budget = opts.maxFetch ?? 0;
  if (budget <= 0 || !cfg || missing.length === 0) return { meta, missing };
  const toFetch = missing.slice(0, budget);
  const region = opts.region ?? DEFAULT_REGION;
  const fetched = await mapLimit(
    toFetch,
    opts.concurrency ?? DEFAULT_CONCURRENCY,
    (ref) => fetchOnce(cfg, ref, region)
  );
  const ok = fetched.filter((m) => m !== null);
  if (ok.length > 0) {
    await upsertTmdbMetaBulk(db, ok).catch(() => {
    });
    for (const m of ok) meta.set(tmdbKey(m), m);
  }
  return { meta, missing: unique.filter((r) => !meta.has(tmdbKey(r))) };
}
var backfillQueue = /* @__PURE__ */ new Set();
var backfillRefs = /* @__PURE__ */ new Map();
var backfillRunning = false;
function pendingBackfillCount() {
  return backfillQueue.size;
}
function scheduleTmdbBackfill(db, cfg, refs, region = DEFAULT_REGION) {
  if (!cfg) return;
  for (const ref of dedupeRefs(refs)) {
    const k = tmdbKey(ref);
    if (backfillQueue.has(k)) continue;
    backfillQueue.add(k);
    backfillRefs.set(k, ref);
  }
  if (backfillRunning || backfillQueue.size === 0) return;
  backfillRunning = true;
  void drainBackfill(db, cfg, region).catch(() => {
  }).finally(() => {
    backfillRunning = false;
  });
}
async function drainBackfill(db, cfg, region) {
  while (backfillQueue.size > 0) {
    const batch = Array.from(backfillQueue).slice(0, 40);
    const refs = batch.map((k) => backfillRefs.get(k)).filter((r) => !!r);
    const fetched = await mapLimit(refs, 4, (ref) => fetchOnce(cfg, ref, region));
    const ok = fetched.filter((m) => m !== null);
    if (ok.length > 0) await upsertTmdbMetaBulk(db, ok).catch(() => {
    });
    for (const k of batch) {
      backfillQueue.delete(k);
      backfillRefs.delete(k);
    }
  }
}

// server/seerr-requests-fetch.ts
var PAGE_CONCURRENCY = 4;
async function fetchSeerrRequestsPage(cfg, seerUserId, take, skip, filter = "all") {
  const who = seerUserId == null ? "" : `&requestedBy=${seerUserId}`;
  const url = `${cfg.seerrUrl}/api/v1/request?take=${take}&skip=${skip}&filter=${encodeURIComponent(filter)}&sort=added${who}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": cfg.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Jellyseerr GET /request${who || " (tous)"} failed: ${res.status} ${body.slice(0, 200)}`
    );
  }
  const data = await res.json();
  return {
    rows: data.results ?? [],
    total: data.pageInfo?.results ?? data.results?.length ?? 0
  };
}
async function fetchAllSeerrRequests(cfg, seerUserId, opts = {}) {
  const take = opts.take ?? 100;
  const maxPages = opts.maxPages ?? 25;
  const filter = opts.filter ?? "all";
  const first = await fetchSeerrRequestsPage(cfg, seerUserId, take, 0, filter);
  if (first.rows.length < take || first.total <= take) {
    return { rows: first.rows, total: first.total || first.rows.length, truncated: false };
  }
  const totalPages = Math.ceil(first.total / take);
  const wanted = Math.min(totalPages, maxPages);
  const skips = Array.from({ length: wanted - 1 }, (_, i) => (i + 1) * take);
  const pages = await mapLimit(
    skips,
    PAGE_CONCURRENCY,
    (skip) => fetchSeerrRequestsPage(cfg, seerUserId, take, skip, filter)
  );
  const rows = [...first.rows];
  for (const page of pages) if (page) rows.push(...page.rows);
  return { rows, total: first.total, truncated: totalPages > maxPages };
}

// server/worker-tmdb.ts
var WARM_BUDGET = 40;
var WARM_CONCURRENCY = 4;
var PRUNE_AFTER_DAYS = 180;
var DISCOVER_MAX_PAGES = 10;
var lastPruneDay = "";
var seeded = false;
async function seedTmdbCacheOnce(db) {
  if (seeded) return;
  seeded = true;
  try {
    const n = await seedTmdbCacheFromLocalRequests(db);
    if (n > 0) console.log(`[SeerTmdb] Seeded ${n} fiches depuis les demandes locales`);
  } catch (err) {
    console.warn("[SeerTmdb] Seed \xE9chou\xE9", err);
  }
}
async function discoverSeerrRefs(db, cfg) {
  const { rows } = await fetchAllSeerrRequests(cfg, null, { maxPages: DISCOVER_MAX_PAGES });
  const refs = [];
  for (const r of rows) {
    if (!r.media?.tmdbId) continue;
    refs.push({ mediaType: r.media.mediaType, tmdbId: r.media.tmdbId });
  }
  const unique = dedupeRefs(refs);
  if (unique.length === 0) return 0;
  const known = await getTmdbMetaBulk(db, unique, true);
  const unknown = unique.filter((r) => !known.has(tmdbKey(r)));
  if (unknown.length > 0) scheduleTmdbBackfill(db, cfg, unknown);
  return unknown.length;
}
async function warmTmdbCache(db, cfg, opts = {}) {
  const budget = opts.budget ?? WARM_BUDGET;
  const region = opts.region ?? DEFAULT_REGION;
  const refs = await listStaleTmdbRefs(db, budget);
  if (refs.length === 0) {
    await pruneOncePerDay(db);
    return { fetched: 0, remaining: 0 };
  }
  const fetched = await mapLimit(refs, WARM_CONCURRENCY, (ref) => fetchTmdbMeta(cfg, ref, region));
  const ok = fetched.filter((m) => m !== null);
  if (ok.length > 0) await upsertTmdbMetaBulk(db, ok);
  await pruneOncePerDay(db);
  return { fetched: ok.length, remaining: Math.max(0, refs.length - ok.length) };
}
async function pruneOncePerDay(db) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (lastPruneDay === today) return;
  lastPruneDay = today;
  try {
    const n = await pruneTmdbCache(db, PRUNE_AFTER_DAYS);
    if (n > 0) console.log(`[SeerTmdb] Purge de ${n} fiches inutilis\xE9es`);
  } catch {
  }
}

// server/jellyfin-auth.ts
function cleanToken(token) {
  return token.replace(/[^\x21-\x7E]/g, "").replace(/"/g, "");
}
function jellyfinAuthHeaders(apiKey) {
  return { Authorization: `MediaBrowser Token="${cleanToken(apiKey)}"` };
}

// server/jellyfin-users.ts
var ACCOUNTS_KEY = "seer:jellyfin:accounts";
var ACCOUNTS_TTL_MS = 3e4;
function normalizeJellyfinId(id) {
  return (id ?? "").toLowerCase().replace(/-/g, "");
}
async function jellyfinCredentials(db) {
  try {
    const rows = await db.query(
      `SELECT "key" AS k, "value" AS v FROM server_config WHERE "key" IN ('jellyfin_url', 'jellyfin_api_key')`
    );
    const url2 = rows.find((r) => r.k === "jellyfin_url")?.v ?? "";
    const apiKey2 = rows.find((r) => r.k === "jellyfin_api_key")?.v ?? "";
    if (url2 && apiKey2) return { url: url2.replace(/\/$/, ""), apiKey: apiKey2 };
  } catch {
  }
  const url = (process.env.JELLYFIN_URL || "").replace(/\/$/, "");
  const apiKey = process.env.JELLYFIN_ADMIN_API_KEY || "";
  return url && apiKey ? { url, apiKey } : null;
}
async function fetchJellyfinAccounts(db) {
  return cached(ACCOUNTS_KEY, ACCOUNTS_TTL_MS, async () => {
    const creds = await jellyfinCredentials(db);
    if (!creds) throw new Error("Jellyfin n'est pas configur\xE9 sur le serveur Tentacle");
    const res = await fetch(`${creds.url}/Users`, {
      headers: jellyfinAuthHeaders(creds.apiKey),
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) throw new Error(`Jellyfin GET /Users a r\xE9pondu ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("R\xE9ponse inattendue de Jellyfin (GET /Users)");
    return data.map((u) => ({
      id: u.Id,
      name: u.Name,
      isAdmin: u.Policy?.IsAdministrator === true,
      isDisabled: u.Policy?.IsDisabled === true,
      imageTag: u.PrimaryImageTag ?? null,
      lastActivityDate: u.LastActivityDate ?? null
    }));
  });
}
function forgetJellyfinAccounts() {
  invalidate(ACCOUNTS_KEY);
}

// server/user-sync-plan.ts
var PLACEHOLDER_DOMAIN = "@tentacle.local";
var SEERR_OWNER_ID = 1;
function pendingFixes(plan) {
  return plan.createRows.length + plan.renames.length + plan.clearLinks.length + plan.setLinks.length + plan.removeRows.length;
}
function linkStateOf(row, seerr) {
  if (!row?.jellyseerrUserId) return "unlinked";
  if (!seerr) return "linked";
  return seerr.some((s) => s.id === row.jellyseerrUserId) ? "linked" : "stale";
}
function nameKey(value) {
  return (value ?? "").normalize("NFD").replace(new RegExp("\\p{Diacritic}", "gu"), "").toLowerCase().trim();
}
function namesOf(s) {
  const local = (s.email ?? "").split("@")[0];
  return new Set([s.name, local, ...s.aliases ?? []].map(nameKey).filter(Boolean));
}
function planUserSync(input) {
  const plan = {
    createRows: [],
    renames: [],
    clearLinks: [],
    setLinks: [],
    removeRows: [],
    gone: [],
    missingSeerr: [],
    orphanSeerr: [],
    disabled: []
  };
  const accounts = new Map(input.accounts.map((a) => [normalizeJellyfinId(a.id), a]));
  const rows = new Map(input.rows.map((r) => [normalizeJellyfinId(r.jellyfinUserId), r]));
  const seerrById = new Map((input.seerr ?? []).map((s) => [s.id, s]));
  const seerrByJellyfin = /* @__PURE__ */ new Map();
  for (const s of [...input.seerr ?? []].sort((a, b) => a.id - b.id)) {
    const key = normalizeJellyfinId(s.jellyfinUserId);
    if (key && !seerrByJellyfin.has(key)) seerrByJellyfin.set(key, s);
  }
  const needing = [];
  for (const [key, account] of accounts) {
    const row = rows.get(key);
    const ref = { id: row?.jellyfinUserId ?? account.id, username: account.name };
    if (!row) plan.createRows.push({ id: account.id, name: account.name });
    else if (account.name && row.username !== account.name) {
      plan.renames.push({ id: row.jellyfinUserId, from: row.username, to: account.name });
    }
    if (account.isDisabled) plan.disabled.push(ref);
    if (!input.seerr) continue;
    const outcome = linkOutcome(row, account, seerrById.get(row?.jellyseerrUserId ?? -1), seerrByJellyfin.get(key), accounts);
    const previous = row?.jellyseerrUserId ?? null;
    if (outcome.clear !== void 0) plan.clearLinks.push({ ...ref, seerrId: outcome.clear });
    if (outcome.set) plan.setLinks.push({ ...ref, seerrId: outcome.set.id, previous, reason: "id" });
    else if (outcome.need) needing.push({ ref, account, previous });
  }
  const adopted = input.seerr ? adoptByName(plan, needing, input.seerr, accounts, rows) : /* @__PURE__ */ new Set();
  if (accounts.size > 0) planDepartures(plan, input, accounts, rows);
  if (input.seerr) plan.orphanSeerr = orphansOf(input.seerr, accounts, rows, plan, adopted);
  return plan;
}
function linkOutcome(row, account, linked, match, accounts) {
  const linkedId = row?.jellyseerrUserId ?? null;
  let clear;
  if (linkedId !== null && !linked) {
    clear = linkedId;
  } else if (linked) {
    const owner = normalizeJellyfinId(linked.jellyfinUserId);
    if (!owner || owner === normalizeJellyfinId(account.id) || !accounts.has(owner)) return { need: false };
    clear = linked.id;
  }
  if (match) return { clear, set: match, need: false };
  return { clear, need: !account.isDisabled };
}
function adoptByName(plan, needing, seerr, accounts, rows) {
  const taken = new Set(plan.setLinks.map((l) => l.seerrId));
  for (const [key, row] of rows) if (row.jellyseerrUserId && accounts.has(key)) taken.add(row.jellyseerrUserId);
  const free = seerr.filter((s) => {
    if (s.id === SEERR_OWNER_ID || taken.has(s.id)) return false;
    const owner = normalizeJellyfinId(s.jellyfinUserId);
    return !owner || !accounts.has(owner);
  });
  const byName = /* @__PURE__ */ new Map();
  for (const s of free) for (const n of namesOf(s)) byName.set(n, [...byName.get(n) ?? [], s]);
  const wanted = /* @__PURE__ */ new Map();
  for (const n of needing) wanted.set(nameKey(n.account.name), (wanted.get(nameKey(n.account.name)) ?? 0) + 1);
  const adopted = /* @__PURE__ */ new Set();
  for (const n of needing) {
    const key = nameKey(n.account.name);
    const candidates = (byName.get(key) ?? []).filter((s) => !adopted.has(s.id));
    if (key && candidates.length === 1 && wanted.get(key) === 1) {
      adopted.add(candidates[0].id);
      plan.setLinks.push({ ...n.ref, seerrId: candidates[0].id, previous: n.previous, reason: "name" });
    } else {
      plan.missingSeerr.push(n.ref);
    }
  }
  return adopted;
}
function planDepartures(plan, input, accounts, rows) {
  const seen = /* @__PURE__ */ new Set();
  for (const [key, row] of rows) {
    seen.add(key);
    if (accounts.has(key)) continue;
    const active = input.activeRequests.get(key) ?? 0;
    const ref = { id: row.jellyfinUserId, username: row.username };
    if (active === 0) plan.removeRows.push(ref);
    else plan.gone.push({ ...ref, activeRequests: active, seerrId: row.jellyseerrUserId });
  }
  for (const [key, active] of input.activeRequests) {
    if (seen.has(key) || accounts.has(key) || active === 0) continue;
    plan.gone.push({ id: key, username: key, activeRequests: active, seerrId: null });
  }
}
function orphansOf(seerr, accounts, rows, plan, adopted) {
  const shown = new Set(plan.gone.map((g) => g.seerrId).filter((id) => id !== null));
  const inUse = new Set(adopted);
  for (const [key, row] of rows) if (row.jellyseerrUserId && accounts.has(key)) inUse.add(row.jellyseerrUserId);
  return seerr.filter((s) => {
    if (s.id === SEERR_OWNER_ID || shown.has(s.id) || inUse.has(s.id)) return false;
    const owner = normalizeJellyfinId(s.jellyfinUserId);
    if (owner) return !accounts.has(owner);
    return (s.email ?? "").toLowerCase().endsWith(PLACEHOLDER_DOMAIN);
  });
}

// server/user-sync.ts
var AUTO_SYNC_EVERY_MINUTES = 30;
var lastReport = null;
var inflight2 = null;
function getLastUserSync() {
  return lastReport;
}
function isUserSyncRunning() {
  return inflight2 !== null;
}
var errorText = (err) => err instanceof Error ? err.message : String(err);
function toSeerrAccount(u) {
  return {
    id: u.id,
    name: u.displayName || u.jellyfinUsername || u.username || u.email || `#${u.id}`,
    email: u.email ?? null,
    jellyfinUserId: u.jellyfinUserId || null,
    requestCount: typeof u.requestCount === "number" ? u.requestCount : null,
    aliases: [u.displayName, u.jellyfinUsername, u.username].filter((n) => !!n)
  };
}
async function collectUserSync(db, cfg) {
  const [accountsResult, seerrResult, rows, activeRequests] = await Promise.all([
    fetchJellyfinAccounts(db).then(
      (accounts) => ({ accounts, error: null }),
      (err) => ({ accounts: null, error: errorText(err) })
    ),
    cfg ? listAllJellyseerrUsers(cfg).then(
      (users) => ({ seerr: users.map(toSeerrAccount), error: null }),
      (err) => ({ seerr: null, error: errorText(err) })
    ) : Promise.resolve({ seerr: null, error: "Jellyseerr n'est pas configur\xE9" }),
    loadLocalRows(db),
    loadActiveRequests(db)
  ]);
  const plan = accountsResult.accounts ? planUserSync({ accounts: accountsResult.accounts, seerr: seerrResult.seerr, rows, activeRequests }) : null;
  return {
    accounts: accountsResult.accounts,
    seerr: seerrResult.seerr,
    rows,
    activeRequests,
    plan,
    jellyfinError: accountsResult.error,
    seerrError: seerrResult.error
  };
}
async function loadLocalRows(db) {
  const rows = await db.query(`SELECT jellyfin_user_id, username, jellyseerr_user_id FROM seer_user_settings`);
  return rows.map((r) => ({
    jellyfinUserId: r.jellyfin_user_id,
    username: r.username,
    jellyseerrUserId: r.jellyseerr_user_id === null ? null : Number(r.jellyseerr_user_id)
  }));
}
async function loadActiveRequests(db) {
  const rows = await db.query(
    `SELECT jellyfin_user_id, COUNT(*) AS cnt FROM seer_requests
     WHERE status NOT IN ('available', 'failed', 'deleted', 'deleting', 'delete_failed')
     GROUP BY jellyfin_user_id`
  );
  const out = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const key = normalizeJellyfinId(r.jellyfin_user_id);
    out.set(key, (out.get(key) ?? 0) + Number(r.cnt));
  }
  return out;
}
function runUserSync(db, cfg, opts) {
  if (inflight2) return inflight2;
  inflight2 = (async () => {
    try {
      const report = await syncOnce(db, cfg, opts);
      lastReport = report;
      return report;
    } finally {
      inflight2 = null;
    }
  })();
  return inflight2;
}
async function syncOnce(db, cfg, opts) {
  const started = Date.now();
  if (opts.trigger === "manual") {
    forgetJellyfinAccounts();
    forgetSeerrUserChecks();
  }
  const snap = await collectUserSync(db, cfg);
  const report = {
    at: (/* @__PURE__ */ new Date()).toISOString(),
    trigger: opts.trigger,
    durationMs: 0,
    jellyfinError: snap.jellyfinError,
    seerrError: snap.seerrError,
    created: [],
    renamed: [],
    linked: [],
    adopted: [],
    unlinked: [],
    removed: [],
    imported: [],
    failures: []
  };
  if (snap.plan) await applyPlan(db, snap.plan, report);
  if (cfg && snap.plan && opts.importMissing) await importMissing(db, cfg, snap.plan, opts.importMissing, report);
  if (pendingFixes(snap.plan ?? emptyPlan()) > 0 || report.imported.length > 0) invalidateRequestCaches();
  report.durationMs = Date.now() - started;
  const touched = report.created.length + report.renamed.length + report.linked.length + report.adopted.length + report.unlinked.length + report.removed.length + report.imported.length;
  if (touched > 0 || report.failures.length > 0) {
    console.log(`[SeerUsers] Synchro ${opts.trigger} : ${touched} correction(s), ${report.failures.length} \xE9chec(s)`);
  }
  return report;
}
function emptyPlan() {
  return {
    createRows: [],
    renames: [],
    clearLinks: [],
    setLinks: [],
    removeRows: [],
    gone: [],
    missingSeerr: [],
    orphanSeerr: [],
    disabled: []
  };
}
async function applyPlan(db, plan, report) {
  const attempt = async (username, action, onDone) => {
    try {
      await action();
      onDone();
    } catch (err) {
      report.failures.push({ username, reason: errorText(err) });
    }
  };
  for (const c of plan.createRows) {
    await attempt(c.name, () => getOrCreateUserSettings(db, c.id, c.name).then(() => void 0), () => report.created.push(c.name));
  }
  for (const r of plan.renames) {
    await attempt(r.to, () => updateUserSettings(db, r.id, { username: r.to }), () => report.renamed.push({ from: r.from, to: r.to }));
  }
  for (const l of plan.clearLinks) {
    await attempt(
      l.username,
      () => updateUserSettings(db, l.id, { jellyseerrUserId: null, jellyseerrLastSync: null }),
      () => report.unlinked.push(l.username)
    );
  }
  for (const l of plan.setLinks) {
    await attempt(
      l.username,
      () => updateUserSettings(db, l.id, { jellyseerrUserId: l.seerrId, jellyseerrLastSync: /* @__PURE__ */ new Date() }),
      () => (l.reason === "name" ? report.adopted : report.linked).push(l.username)
    );
  }
  for (const r of plan.removeRows) {
    await attempt(r.username, async () => {
      await db.execute(
        `DELETE FROM seer_user_settings WHERE jellyfin_user_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM seer_requests WHERE seer_requests.jellyfin_user_id = seer_user_settings.jellyfin_user_id
               AND status NOT IN ('available', 'failed', 'deleted', 'deleting', 'delete_failed'))`,
        r.id
      );
    }, () => report.removed.push(r.username));
  }
}
async function importMissing(db, cfg, plan, which, report) {
  const wanted = which === true ? null : new Set(which.map(normalizeJellyfinId));
  const targets = plan.missingSeerr.filter((m) => !wanted || wanted.has(normalizeJellyfinId(m.id)));
  for (const t of targets) {
    try {
      await resolveJellyseerrUserId(cfg, db, t.id, t.username);
      report.imported.push(t.username);
    } catch (err) {
      report.failures.push({ username: t.username, reason: errorText(err) });
    }
  }
}

// server/worker.ts
var timer = null;
var cycleCount = 0;
var dbRef = null;
var getConfigRef = null;
var requestQueueBusy = false;
var cleanupQueueBusy = false;
async function runRequestQueue(db, config) {
  if (requestQueueBusy) return;
  requestQueueBusy = true;
  try {
    const seen = new Set(deferredRequestIds());
    for (let i = 0; i < 10; i++) {
      const processedId = await processNextRequest(db, config, seen);
      if (!processedId) return;
      seen.add(processedId);
    }
  } finally {
    requestQueueBusy = false;
  }
}
async function runCleanupQueue(db, config) {
  if (cleanupQueueBusy) return;
  cleanupQueueBusy = true;
  try {
    await processCleanupQueue(db, config);
  } finally {
    cleanupQueueBusy = false;
  }
}
function startWorker(db, getConfig) {
  if (timer) return;
  dbRef = db;
  getConfigRef = getConfig;
  async function tick2() {
    const config = await getConfig();
    if (!config || !config.seerrUrl || !config.seerrApiKey) return;
    cycleCount++;
    try {
      await runRequestQueue(db, config);
    } catch (err) {
      console.error("[SeerWorker] Error processing request:", err);
    }
    try {
      await advanceFromArr(db, config);
    } catch (err) {
      console.error("[SeerWorker] Error reading Sonarr/Radarr:", err);
    }
    if (cycleCount % config.syncEvery === 0) {
      try {
        await syncStatuses(db, config);
      } catch (err) {
        console.error("[SeerWorker] Error syncing statuses:", err);
      }
    }
    try {
      await retryFailedRequests(db);
    } catch (err) {
      console.error("[SeerWorker] Error retrying failed requests:", err);
    }
    try {
      await runCleanupQueue(db, config);
    } catch (err) {
      console.error("[SeerWorker] Error processing cleanup queue:", err);
    }
    if (cycleCount === 2 || cycleCount % AUTO_SYNC_EVERY_MINUTES === 0) {
      try {
        await runUserSync(db, config, { trigger: "auto" });
      } catch (err) {
        console.error("[SeerWorker] Error syncing users:", err);
      }
    }
    if (cycleCount % 5 === 0) {
      try {
        await warmTmdbCache(db, config);
      } catch (err) {
        console.error("[SeerWorker] Error warming TMDB cache:", err);
      }
    }
    if (cycleCount % 30 === 0) {
      try {
        const n = await discoverSeerrRefs(db, config);
        if (n > 0) console.log(`[SeerWorker] ${n} fiches d\xE9couvertes hors du plugin`);
      } catch (err) {
        console.error("[SeerWorker] Error discovering Seerr refs:", err);
      }
    }
  }
  setTimeout(() => {
    void seedTmdbCacheOnce(db);
    tick2();
  }, 5e3);
  timer = setInterval(() => {
    tick2();
  }, 6e4);
  console.log("[SeerWorker] Started");
}
function kickWorkerNow() {
  const db = dbRef;
  const getConfig = getConfigRef;
  if (!db || !getConfig) return;
  setTimeout(async () => {
    try {
      const config = await getConfig();
      if (!config || !config.seerrUrl || !config.seerrApiKey) return;
      await Promise.all([
        runRequestQueue(db, config).catch((err) => console.error("[SeerWorker] Kick request queue failed:", err)),
        runCleanupQueue(db, config).catch((err) => console.error("[SeerWorker] Kick cleanup queue failed:", err))
      ]);
    } catch (err) {
      console.error("[SeerWorker] Kick failed:", err);
    }
  }, 50);
}
function stopWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[SeerWorker] Stopped");
  }
}
function isWorkerRunning() {
  return timer !== null;
}

// server/request-status.ts
var AVAILABLE2 = 5;
var COMPLETED = 5;
var PARTIAL = 4;
function requestedSeasonsHere(row, seasonStates) {
  const requested2 = (row.seasons ?? []).filter((s) => typeof s.seasonNumber === "number");
  if (requested2.length === 0) return "unknown";
  const states = new Map(seasonStates ?? []);
  for (const s of row.media?.seasons ?? []) {
    if (typeof s.status === "number") states.set(s.seasonNumber, s.status);
  }
  let here = 0;
  let some = 0;
  let known = 0;
  for (const s of requested2) {
    const state2 = states.get(s.seasonNumber);
    if (state2 === AVAILABLE2 || s.status === COMPLETED) here++;
    else if (state2 === PARTIAL) some++;
    if (state2 !== void 0 || s.status === COMPLETED) known++;
  }
  if (here === requested2.length) return "all";
  if (here + some > 0) return "some";
  return known === requested2.length ? "none" : "unknown";
}
function resolveRequestStatus(row, local, seasonStates, library = "unknown") {
  let status = mapSeerrStatus(row.status, row.media?.status, row.media?.downloadStatus);
  if (status === "partially_available") {
    const here = requestedSeasonsHere(row, seasonStates);
    if (here === "all") status = "available";
    else if (here === "none") {
      const downloads = row.media?.downloadStatus;
      status = mapSeerrStatus(row.status, downloads && downloads.length > 0 ? 3 : 2, downloads);
    }
  }
  if (library === "unknown" && local?.status === "available" && (status === "approved" || status === "unavailable" || status === "deleted")) {
    status = "available";
  }
  return status;
}

// server/live/request-row.ts
function factsOfRow(row) {
  const type = row.media?.mediaType === "tv" ? "tv" : row.media?.mediaType === "movie" ? "movie" : null;
  const tmdbId = Number(row.media?.tmdbId);
  if (!type || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) return null;
  const downloading = (row.media?.downloadStatus?.length ?? 0) > 0;
  const own = {
    status: row.status,
    is4k: row.is4k === true,
    seasons: (row.seasons ?? []).map((s) => s.seasonNumber).filter((n) => typeof n === "number")
  };
  const base = factsFor(type, tmdbId, { downloading });
  return { type, facts: { ...base, requests: [...base.requests ?? [], own] } };
}
function correctRequestRow(row, seasonStates) {
  const read = factsOfRow(row);
  if (!read) return { row, seasonStates, library: "unknown" };
  const { facts, type } = read;
  const library = facts.library.state;
  const mediaStatus = correctMediaStatus(type, row.media?.status, facts);
  let mediaSeasons = row.media?.seasons;
  let states = seasonStates;
  let requestSeasons2 = row.seasons;
  if (type === "tv") {
    const gone = (s) => library === "gone" || facts.library.goneSeasons.has(s);
    mediaSeasons = mediaSeasons?.map((s) => ({ ...s, status: correctSeasonStatus(s.seasonNumber, s.status, facts) }));
    if (states) {
      const next = /* @__PURE__ */ new Map();
      for (const [season, status] of states) next.set(season, correctSeasonStatus(season, status, facts) ?? status);
      states = next;
    }
    requestSeasons2 = requestSeasons2?.map((s) => gone(s.seasonNumber) && s.status === REQUEST.COMPLETED ? { ...s, status: REQUEST.APPROVED } : s);
  }
  if (mediaStatus === row.media?.status && mediaSeasons === row.media?.seasons && requestSeasons2 === row.seasons && states === seasonStates) {
    return { row, seasonStates, library };
  }
  return {
    row: {
      ...row,
      seasons: requestSeasons2,
      media: row.media ? { ...row.media, status: mediaStatus, seasons: mediaSeasons } : row.media
    },
    seasonStates: states,
    library
  };
}
function resolveLiveStatus(row, local, seasonStates) {
  const fixed = correctRequestRow(row, seasonStates);
  return resolveRequestStatus(fixed.row, local, fixed.seasonStates, fixed.library);
}

// server/seerr-unified.ts
function getUser(request) {
  return request.user;
}
function seerrRequestToUnified(sr, detail, localById, fallbackUser, seasonStates) {
  const local = localById.get(sr.id);
  const status = resolveLiveStatus(sr, local, seasonStates);
  const seasons = sr.seasons?.map((s) => s.seasonNumber).filter((n) => typeof n === "number") ?? null;
  const mediaType = sr.media?.mediaType ?? "movie";
  const title = detail?.title ?? detail?.name ?? local?.title ?? `#${sr.id}`;
  const year = (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null;
  const { summary, items } = aggregateDownloads(sr.media?.downloadStatus);
  return {
    download: summary,
    downloads: items.length > 1 ? items : void 0,
    id: local?.id ?? `seerr-${sr.id}`,
    source: "seerr",
    jellyfinUserId: sr.requestedBy?.jellyfinUserId ?? fallbackUser.jellyfinUserId,
    username: sr.requestedBy?.jellyfinUsername ?? fallbackUser.username,
    mediaType,
    tmdbId: sr.media?.tmdbId ?? 0,
    title,
    posterPath: detail?.posterPath ?? local?.posterPath ?? null,
    backdropPath: detail?.backdropPath ?? local?.backdropPath ?? null,
    overview: detail?.overview ?? local?.overview ?? null,
    year: year || local?.year || null,
    seasons: seasons && seasons.length > 0 ? seasons : local?.seasons ?? null,
    status,
    seerrRequestId: sr.id,
    seerrMediaId: sr.media?.id ?? null,
    seerrMediaStatus: sr.media?.status ?? null,
    retryCount: local?.retryCount ?? 0,
    maxRetries: local?.maxRetries ?? 10,
    lastError: local?.lastError ?? null,
    priority: local?.priority ?? 0,
    createdAt: sr.createdAt ?? local?.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: sr.updatedAt ?? local?.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    sentAt: local?.sentAt ?? null,
    completedAt: local?.completedAt ?? null,
    profileId: local?.profileId ?? null,
    isAnime: local?.isAnime ?? false,
    origin: local?.origin ?? null
  };
}
function localToUnified(r) {
  return {
    id: r.id,
    source: "local",
    jellyfinUserId: r.jellyfinUserId,
    username: r.username,
    mediaType: r.mediaType,
    tmdbId: r.tmdbId,
    title: r.title,
    posterPath: r.posterPath,
    backdropPath: r.backdropPath,
    overview: r.overview,
    year: r.year,
    seasons: r.seasons,
    status: r.status,
    seerrRequestId: r.seerrRequestId,
    seerrMediaId: r.seerrMediaId,
    seerrMediaStatus: r.seerrMediaStatus,
    retryCount: r.retryCount,
    maxRetries: r.maxRetries,
    lastError: r.lastError,
    priority: r.priority,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    sentAt: r.sentAt,
    completedAt: r.completedAt,
    profileId: r.profileId,
    isAnime: r.isAnime,
    origin: r.origin
  };
}
async function fetchSeerrTmdbDetail(config, mediaType, tmdbId) {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/${mediaType}/${tmdbId}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function fetchSeerrRequestById(config, seerrId) {
  try {
    const res = await fetch(`${config.seerrUrl}/api/v1/request/${seerrId}`, {
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
function parseRequestId(id) {
  if (id.startsWith("seerr-")) {
    const n = Number(id.slice(6));
    if (Number.isFinite(n)) return { kind: "seerr", seerrId: n };
  }
  return { kind: "local", id };
}

// server/request-delete-seerr.ts
async function deleteSeerrOnlyRequest(db, config, user, seerrId, opts) {
  const seerrReq = await fetchSeerrRequestById(config, seerrId);
  if (!seerrReq) return { ok: false, code: 404, message: "Seerr request not found" };
  if (!user.isAdmin) {
    const settingsRows = await db.query(
      `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
      user.userId
    );
    const myId = settingsRows[0]?.jellyseerr_user_id ?? null;
    if (!myId || seerrReq.requestedBy?.id !== myId) {
      return { ok: false, code: 403, message: "Not your request" };
    }
  }
  const seerrMediaType = seerrReq.media?.mediaType ?? "movie";
  const seerrSeasons = (seerrReq.seasons ?? []).map((s) => s.seasonNumber).filter((n) => typeof n === "number");
  const isSeasonSpecific = seerrMediaType === "tv" && !!opts.seasons && opts.seasons.length > 0;
  const removing = isSeasonSpecific ? opts.seasons : seerrMediaType === "tv" && seerrSeasons.length > 0 ? seerrSeasons : null;
  const remaining = isSeasonSpecific ? seerrSeasons.filter((s) => !removing.includes(s)) : [];
  const partial = isSeasonSpecific && remaining.length > 0;
  await enqueueCleanup(db, {
    action: "delete",
    mediaType: seerrMediaType,
    tmdbId: seerrReq.media?.tmdbId ?? 0,
    title: `#${seerrReq.id}`,
    seerrRequestId: partial ? null : seerrReq.id,
    seerrMediaId: seerrReq.media?.id ?? null,
    deleteFiles: opts.deleteFiles,
    seasons: removing,
    requestId: null,
    jellyfinUserId: user.userId
  });
  return { ok: true, status: partial ? "updated" : "deleting" };
}

// server/series-gaps.ts
var AVAILABLE3 = 5;
var PARTIAL2 = 4;
var PAGE2 = 100;
var MAX_PAGES2 = 10;
async function loadIndex(cfg) {
  const out = /* @__PURE__ */ new Map();
  for (let page = 0; page < MAX_PAGES2; page++) {
    const url = `${cfg.seerrUrl}/api/v1/media?filter=partial&take=${PAGE2}&skip=${page * PAGE2}&sort=mediaAdded`;
    const res = await fetch(url, { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(1e4) });
    if (!res.ok) throw new Error(`Jellyseerr GET /media?filter=partial : ${res.status}`);
    const body = await res.json();
    for (const media of body.results ?? []) {
      if (media.mediaType !== "tv" || typeof media.tmdbId !== "number") continue;
      const seasons = /* @__PURE__ */ new Map();
      for (const s of media.seasons ?? []) {
        if (typeof s.seasonNumber === "number" && s.seasonNumber > 0 && typeof s.status === "number") {
          seasons.set(s.seasonNumber, s.status);
        }
      }
      out.set(media.tmdbId, seasons);
    }
    if ((body.pageInfo?.pages ?? 1) <= page + 1) break;
  }
  return out;
}
async function partialSeriesSeasons(cfg) {
  if (!cfg) return /* @__PURE__ */ new Map();
  try {
    return await cached(`series-gaps:${cfg.seerrUrl}`, 6e4, () => loadIndex(cfg), { staleMs: 10 * 6e4 });
  } catch {
    return /* @__PURE__ */ new Map();
  }
}
function gapsOf(seasons) {
  if (!seasons || seasons.size === 0) return null;
  const missing = [];
  const partial = [];
  for (const [season, status] of seasons) {
    if (status === PARTIAL2) partial.push(season);
    else if (status !== AVAILABLE3) missing.push(season);
  }
  if (missing.length === 0 && partial.length === 0) return null;
  return { missing: missing.sort((a, b) => a - b), partial: partial.sort((a, b) => a - b) };
}

// server/requests-list.ts
var LOCAL_PENDING_STATUSES = [
  "queued",
  "processing",
  "retry_pending",
  "failed",
  "deleting",
  "delete_failed"
];
async function buildMergedRows(db, cfg, user, log) {
  const localPendingRows = await db.query(
    `SELECT * FROM seer_requests
     WHERE jellyfin_user_id = ?
       AND status IN (${LOCAL_PENDING_STATUSES.map(() => "?").join(",")})
     ORDER BY created_at DESC, id ASC`,
    user.userId,
    ...LOCAL_PENDING_STATUSES
  );
  const localPending = localPendingRows.map(rowToRequest);
  const localBySeerrId = /* @__PURE__ */ new Map();
  const allLocalRows = await db.query(
    `SELECT * FROM seer_requests WHERE jellyfin_user_id = ? AND seerr_request_id IS NOT NULL`,
    user.userId
  );
  for (const row of allLocalRows) {
    const r = rowToRequest(row);
    if (r.seerrRequestId) localBySeerrId.set(r.seerrRequestId, r);
  }
  let seerrRows = [];
  let seerrUnreachable = false;
  const seasonStatesP = partialSeriesSeasons(cfg);
  try {
    const seerUserId = await resolveJellyseerrUserId(cfg, db, user.userId, user.username);
    const all = await fetchAllSeerrRequests(cfg, seerUserId);
    seerrRows = all.rows;
  } catch (err) {
    seerrUnreachable = true;
    log?.(err, "Seerr fetch failed, falling back to local only");
  }
  return assembleRows(db, { seerrRows, localPending, localBySeerrId, seerrUnreachable }, seasonStatesP);
}
async function assembleRows(db, parts, seasonStatesP) {
  const { seerrRows, localPending, localBySeerrId, seerrUnreachable } = parts;
  const seerrSeenIds = new Set(seerrRows.map((r) => r.id));
  const localOnly = localPending.filter(
    (l) => !l.seerrRequestId || !seerrSeenIds.has(l.seerrRequestId)
  );
  const deletingIds = /* @__PURE__ */ new Set();
  try {
    const pending2 = await db.query(
      `SELECT seerr_request_id FROM seer_cleanup_queue
       WHERE status = 'pending' AND action = 'delete' AND seerr_request_id IS NOT NULL`
    );
    for (const r of pending2) deletingIds.add(Number(r.seerr_request_id));
  } catch {
  }
  const seasonStates = await seasonStatesP;
  return {
    seerrRows,
    localBySeerrId,
    localOnly,
    deletingIds,
    stats: computeStats(seerrRows, localOnly, localBySeerrId, deletingIds, seasonStates),
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    seasonStates,
    seerrUnreachable
  };
}
function computeStats(seerrRows, localOnly, localBySeerrId, deletingIds, seasonStates) {
  const byStatus = {};
  const byType = { movie: 0, tv: 0 };
  let total = 0;
  const bump = (status, mediaType) => {
    total++;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (mediaType === "movie") byType.movie++;
    else if (mediaType === "tv") byType.tv++;
  };
  for (const sr of seerrRows) {
    bump(effectiveStatus(sr, localBySeerrId, deletingIds, seasonStates), sr.media?.mediaType);
  }
  for (const l of localOnly) bump(l.status, l.mediaType);
  return { total, byStatus, byType };
}
function effectiveStatus(sr, localBySeerrId, deletingIds, seasonStates) {
  if (deletingIds.has(sr.id)) return "deleting";
  return resolveLiveStatus(sr, localBySeerrId.get(sr.id), seasonStates.get(sr.media?.tmdbId ?? 0));
}
function collectTmdbRefs(rows) {
  const out = [];
  for (const sr of rows.seerrRows) {
    if (sr.media?.tmdbId) out.push({ mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId });
  }
  for (const l of rows.localOnly) {
    if (l.tmdbId) out.push({ mediaType: l.mediaType, tmdbId: l.tmdbId });
  }
  return out;
}
function metaToDetail(meta) {
  if (!meta) return null;
  return {
    id: meta.tmdbId,
    title: meta.mediaType === "movie" ? meta.title : void 0,
    name: meta.mediaType === "tv" ? meta.title : void 0,
    posterPath: meta.posterPath ?? void 0,
    backdropPath: meta.backdropPath ?? void 0,
    overview: meta.overview ?? void 0,
    releaseDate: meta.mediaType === "movie" ? meta.releaseDate ?? void 0 : void 0,
    firstAirDate: meta.mediaType === "tv" ? meta.releaseDate ?? void 0 : void 0
  };
}
function hydrateRows(rows, meta, user, requesterOf) {
  const out = rows.localOnly.map(localToUnified);
  const viewer = { jellyfinUserId: user.userId, username: user.username };
  for (const sr of rows.seerrRows) {
    if (!sr.media) continue;
    const detail = metaToDetail(meta.get(tmdbKey({ mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId })));
    const unified = seerrRequestToUnified(
      sr,
      detail,
      rows.localBySeerrId,
      requesterOf ? requesterOf(sr) : viewer,
      rows.seasonStates?.get(sr.media.tmdbId)
    );
    if (rows.deletingIds.has(sr.id)) unified.status = "deleting";
    out.push(unified);
  }
  out.sort((a, b) => b.createdAt > a.createdAt ? 1 : -1);
  return out;
}
function filterAndPaginate(items, query) {
  let filtered = items;
  if (query.type) filtered = filtered.filter((r) => r.mediaType === query.type);
  if (query.status) {
    const wanted = new Set(query.status.split(",").map((s) => s.trim()));
    filtered = filtered.filter((r) => wanted.has(r.status));
  }
  if (query.q) {
    const q = query.q.trim().toLowerCase();
    const matches2 = (r) => (r.title ?? "").toLowerCase().includes(q) || query.byRequester === true && (r.username ?? "").toLowerCase().includes(q);
    if (q) filtered = filtered.filter(matches2);
  }
  const total = filtered.length;
  const offset = (query.page - 1) * query.limit;
  return {
    results: filtered.slice(offset, offset + query.limit),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit))
  };
}

// server/requests-page.ts
var PAGE_META_BUDGET = 20;
async function requestsPage(db, config, rows, viewer, query, requesterOf) {
  const refs = collectTmdbRefs(rows);
  const { meta, missing } = await resolveTmdbMeta(db, config, refs, { maxFetch: 0 });
  const hydrated = hydrateRows(rows, meta, viewer, requesterOf);
  const verdicts = await arrVerdicts(config, hydrated).catch(() => /* @__PURE__ */ new Map());
  let items = withArrStatus(hydrated, verdicts);
  let result = filterAndPaginate(items, query);
  if (missing.length > 0) {
    const visible2 = new Set(result.results.map((r) => tmdbKey({ mediaType: r.mediaType, tmdbId: r.tmdbId })));
    const onPage = missing.filter((r) => visible2.has(tmdbKey(r)));
    if (onPage.length > 0) {
      const filled = await resolveTmdbMeta(db, config, onPage, { maxFetch: PAGE_META_BUDGET });
      for (const [k, v] of filled.meta) meta.set(k, v);
      items = withArrStatus(hydrateRows(rows, meta, viewer, requesterOf), verdicts);
      result = filterAndPaginate(items, query);
    }
    scheduleTmdbBackfill(db, config, missing);
  }
  return {
    ...result,
    stats: restat(rows.stats, hydrated, verdicts),
    // > 0 : des titres manquent encore, le front repasse plus vite.
    metaPending: pendingBackfillCount()
  };
}

// server/titles/local-seasons.ts
async function localRequestedSeasons(db, userId, tmdbId) {
  const rows = await db.query(
    `SELECT seasons FROM seer_requests
     WHERE jellyfin_user_id = ? AND tmdb_id = ? AND media_type = 'tv'
       AND status NOT IN ('deleted', 'failed', 'available', 'deleting', 'delete_failed')`,
    userId,
    tmdbId
  );
  const seasons = /* @__PURE__ */ new Set();
  for (const r of rows) {
    if (!r.seasons) continue;
    try {
      const arr = typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons;
      if (Array.isArray(arr)) {
        for (const s of arr) {
          const n = Number(s);
          if (Number.isFinite(n)) seasons.add(n);
        }
      }
    } catch {
    }
  }
  return [...seasons].sort((a, b) => a - b);
}

// server/routes-requests-read.ts
var ROWS_TTL_MS = 6e4;
var ROWS_STALE_MS = 6e5;
var rowsCacheKey = (userId) => `seer-cache:${userId}:rows`;
function loadMergedRows(db, cfg, user, log) {
  return cached(rowsCacheKey(user.userId), ROWS_TTL_MS, () => buildMergedRows(db, cfg, user, log), { staleMs: ROWS_STALE_MS });
}
function registerRequestReadRoutes(app, db, getWorkerConfig2) {
  const loadRows = (cfg, user) => loadMergedRows(db, cfg, user, (err, msg) => app.log?.warn?.({ err }, msg));
  app.get("/requests", async (request) => {
    const user = getUser(request);
    const query = request.query;
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const config = await getWorkerConfig2();
    if (!config) {
      const local = await getUserRequests(db, user.userId, { page, limit, mediaType: query.type });
      return { ...local, results: local.results.map(localToUnified) };
    }
    const rows = await loadRows(config, user);
    return requestsPage(db, config, rows, user, { page, limit, status: query.status, type: query.type, q: query.q });
  });
  app.get("/requests/stats", async (request) => {
    const user = getUser(request);
    const config = await getWorkerConfig2();
    const empty = { total: 0, byStatus: {}, byType: { movie: 0, tv: 0 } };
    if (!config) return empty;
    const hit = peek(rowsCacheKey(user.userId), true);
    if (hit) return hit.stats;
    const rows = await loadRows(config, user);
    return rows.stats;
  });
  app.get("/requests/lookup", async (request) => {
    const user = getUser(request);
    const q = request.query;
    const tmdbId = Number(q.tmdbId);
    if (q.mediaType !== "tv" || !Number.isFinite(tmdbId) || tmdbId <= 0) return { seasons: [] };
    return { seasons: await localRequestedSeasons(db, user.userId, tmdbId) };
  });
}

// server/titles/request-origin.ts
var ORIGIN = /^[a-z][a-z0-9-]{0,15}$/;
var PLATFORM = /^[a-z][a-z0-9-]{0,23}$/;
function readRequestOrigin(body) {
  const raw = body && typeof body === "object" ? body : null;
  const origin = typeof raw?.origin === "string" && ORIGIN.test(raw.origin) ? raw.origin : null;
  if (!origin) return null;
  const platform = typeof raw?.platform === "string" && PLATFORM.test(raw.platform) ? raw.platform : null;
  return { origin, platform };
}
function readOriginFilter(raw) {
  if (raw === void 0) return void 0;
  return typeof raw === "string" && ORIGIN.test(raw) ? raw : "";
}
function ofOrigin(requests, filter) {
  return filter === void 0 ? requests : requests.filter((r) => r.origin === filter);
}
function originOf(request) {
  return request.origin ? { origin: request.origin, platform: request.platform } : null;
}

// server/routes-requests-actions.ts
function registerRequestActionRoutes(app, db, getWorkerConfig2) {
  app.post("/requests/:id/retry", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const forceRedownload = body.forceRedownload === true;
    const parsed = parseRequestId(id);
    const config = await getWorkerConfig2();
    if (parsed.kind === "local") {
      const req = await getRequestById(db, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }
      const newProfileId = body.profileId !== void 0 ? body.profileId : req.profileId;
      if (config) {
        if (req.seerrRequestId) {
          await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
        if (forceRedownload && req.seerrMediaId) {
          await fetch(`${config.seerrUrl}/api/v1/media/${req.seerrMediaId}`, {
            method: "DELETE",
            headers: { "X-Api-Key": config.seerrApiKey },
            signal: AbortSignal.timeout(1e4)
          }).catch(() => {
          });
        }
      }
      await deleteRequestById(db, parsed.id);
      const retrySeasons2 = body.seasons && body.seasons.length > 0 ? body.seasons : req.seasons;
      const newReq2 = await createRequest(db, {
        jellyfinUserId: req.jellyfinUserId,
        username: req.username,
        mediaType: req.mediaType,
        tmdbId: req.tmdbId,
        title: req.title,
        posterPath: req.posterPath,
        backdropPath: req.backdropPath,
        overview: req.overview,
        year: req.year,
        seasons: retrySeasons2,
        priority: 1,
        profileId: newProfileId,
        isAnime: req.isAnime,
        origin: originOf(req)
      });
      invalidateRequestCaches(user.userId);
      kickWorkerNow();
      return reply.status(201).send(newReq2);
    }
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
    if (!seerrReq) {
      invalidateRequestCaches(user.userId);
      return reply.status(404).send({ errorKey: "seer:errRequestGone", message: "Request no longer exists in Jellyseerr" });
    }
    if (!user.isAdmin) {
      const settingsRows = await db.query(
        `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
        user.userId
      );
      const myId = settingsRows[0]?.jellyseerr_user_id ?? null;
      if (!myId || seerrReq.requestedBy?.id !== myId) {
        return reply.status(403).send({ message: "Not your request" });
      }
    }
    const mediaType = seerrReq.media?.mediaType ?? "movie";
    const tmdbId = seerrReq.media?.tmdbId ?? 0;
    if (!tmdbId) return reply.status(400).send({ message: "Cannot retry: missing TMDB id" });
    const detail = await fetchSeerrTmdbDetail(config, mediaType, tmdbId);
    const title = detail?.title ?? detail?.name ?? `#${seerrReq.id}`;
    await fetch(`${config.seerrUrl}/api/v1/request/${seerrReq.id}`, {
      method: "DELETE",
      headers: { "X-Api-Key": config.seerrApiKey },
      signal: AbortSignal.timeout(1e4)
    }).catch(() => {
    });
    if (forceRedownload && seerrReq.media?.id) {
      await fetch(`${config.seerrUrl}/api/v1/media/${seerrReq.media.id}`, {
        method: "DELETE",
        headers: { "X-Api-Key": config.seerrApiKey },
        signal: AbortSignal.timeout(1e4)
      }).catch(() => {
      });
    }
    const retrySeasons = body.seasons && body.seasons.length > 0 ? body.seasons : seerrReq.seasons?.map((s) => s.seasonNumber) ?? null;
    const newReq = await createRequest(db, {
      jellyfinUserId: user.userId,
      username: user.username,
      mediaType,
      tmdbId,
      title,
      posterPath: detail?.posterPath ?? null,
      backdropPath: detail?.backdropPath ?? null,
      overview: detail?.overview ?? null,
      year: (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null,
      seasons: retrySeasons,
      priority: 1,
      profileId: body.profileId ?? null,
      isAnime: false
    });
    invalidateRequestCaches(user.userId);
    kickWorkerNow();
    return reply.status(201).send(newReq);
  });
  app.post("/requests/:id/mark", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const target = body.status;
    if (!target || !["available", "partial", "processing", "unknown"].includes(target)) {
      return reply.status(400).send({ message: "status must be 'available', 'partial', 'processing' or 'unknown'" });
    }
    const config = await getWorkerConfig2();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const parsed = parseRequestId(id);
    let seerrMediaId = null;
    let ownerJellyfinUserId = null;
    let ownerUsername = null;
    let seerrReq = null;
    if (parsed.kind === "local") {
      const req = await getRequestById(db, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      seerrMediaId = req.seerrMediaId;
      ownerJellyfinUserId = req.jellyfinUserId;
    } else {
      seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
      if (!seerrReq) {
        invalidateRequestCaches(user.userId);
        return reply.status(404).send({ errorKey: "seer:errRequestGone", message: "Request no longer exists in Jellyseerr" });
      }
      seerrMediaId = seerrReq.media?.id ?? null;
      if (seerrReq.requestedBy?.id) {
        const rows = await db.query(
          `SELECT jellyfin_user_id, username FROM seer_user_settings WHERE jellyseerr_user_id = ? ORDER BY jellyfin_user_id ASC LIMIT 1`,
          seerrReq.requestedBy.id
        );
        ownerJellyfinUserId = rows[0]?.jellyfin_user_id ?? null;
        ownerUsername = rows[0]?.username ?? null;
      }
    }
    if (!seerrMediaId) return reply.status(400).send({ message: "No Jellyseerr media linked" });
    if (!user.isAdmin && ownerJellyfinUserId && ownerJellyfinUserId !== user.userId) {
      return reply.status(403).send({ message: "Not your request" });
    }
    const res = await fetch(`${config.seerrUrl}/api/v1/media/${seerrMediaId}/${target}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey },
      body: JSON.stringify({ is4k: false }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      const text2 = await res.text().catch(() => "");
      return reply.status(502).send({
        message: `Jellyseerr mark ${target} failed: ${res.status} ${text2.slice(0, 200)}`
      });
    }
    const localStatus = target === "available" ? "available" : target === "partial" ? "partially_available" : "unavailable";
    const extra = target === "available" ? { completedAt: /* @__PURE__ */ new Date() } : void 0;
    if (parsed.kind === "local") {
      await updateRequestStatus(db, parsed.id, localStatus, extra);
    } else if (seerrReq?.media && ownerJellyfinUserId) {
      const existing = await db.query(
        `SELECT id FROM seer_requests WHERE seerr_request_id = ? ORDER BY id ASC LIMIT 1`,
        seerrReq.id
      );
      if (existing.length > 0) {
        await updateRequestStatus(db, existing[0].id, localStatus, extra);
      } else if (target === "available") {
        await insertAvailablePin(db, config, seerrReq, {
          jellyfinUserId: ownerJellyfinUserId,
          username: ownerUsername ?? user.username
        });
      }
    }
    invalidateRequestCaches(user.userId);
    return { success: true, target };
  });
  app.post("/requests/:id/retry-delete", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const req = await getRequestById(db, id);
    if (!req) return reply.status(404).send({ message: "Request not found" });
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Not your request" });
    }
    if (req.status !== "delete_failed" && req.status !== "deleting") {
      return reply.status(400).send({ message: "Request is not in a deletable state" });
    }
    await updateRequestStatus(db, id, "deleting", { lastError: "" });
    await enqueueCleanup(db, {
      action: "delete",
      mediaType: req.mediaType,
      tmdbId: req.tmdbId,
      title: req.title,
      seerrRequestId: req.seerrRequestId,
      seerrMediaId: req.seerrMediaId,
      deleteFiles: true,
      requestId: id,
      jellyfinUserId: req.jellyfinUserId
    });
    kickWorkerNow();
    return { success: true };
  });
}
async function insertAvailablePin(db, config, seerrReq, owner) {
  const media = seerrReq.media;
  if (!media) return;
  const detail = await fetchSeerrTmdbDetail(config, media.mediaType, media.tmdbId);
  const seasons = seerrReq.seasons?.map((s) => s.seasonNumber).filter((n) => typeof n === "number") ?? [];
  await db.execute(
    `INSERT INTO seer_requests
      (id, jellyfin_user_id, username, media_type, tmdb_id, title, poster_path,
       backdrop_path, overview, year, seasons, status, seerr_request_id,
       seerr_media_id, seerr_media_status, sent_at, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?,
             ${db.sql.now()}, ${db.sql.now()}, ${db.sql.now()}, ${db.sql.now()})`,
    uuid(),
    owner.jellyfinUserId,
    owner.username,
    media.mediaType,
    media.tmdbId,
    detail?.title ?? detail?.name ?? `#${seerrReq.id}`,
    detail?.posterPath ?? null,
    detail?.backdropPath ?? null,
    detail?.overview ?? null,
    (detail?.releaseDate ?? detail?.firstAirDate ?? "").slice(0, 4) || null,
    seasons.length > 0 ? JSON.stringify(seasons) : null,
    seerrReq.id,
    media.id,
    media.status ?? null
  );
}

// server/routes-requests-forget.ts
var FORGETTABLE = /* @__PURE__ */ new Set(["failed", "delete_failed"]);
async function deleteSeerrRequest(config, seerrRequestId) {
  await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "DELETE",
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  }).catch(() => {
  });
}
function registerRequestForgetRoute(app, db, getWorkerConfig2) {
  app.post("/requests/:id/forget", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const parsed = parseRequestId(id);
    const config = await getWorkerConfig2();
    if (parsed.kind === "local") {
      const req = await getRequestById(db, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }
      if (!FORGETTABLE.has(req.status)) {
        return reply.status(409).send({ errorKey: "seer:errNotForgettable", message: "Only requests to check can be removed alone" });
      }
      if (config && req.seerrRequestId) await deleteSeerrRequest(config, req.seerrRequestId);
      await cancelCleanupsForRequest(db, parsed.id);
      await deleteRequestById(db, parsed.id);
      invalidateRequestCaches(req.jellyfinUserId);
      if (req.jellyfinUserId !== user.userId) invalidateRequestCaches(user.userId);
      return { success: true };
    }
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrReq = await fetchSeerrRequestById(config, parsed.seerrId);
    if (!seerrReq) {
      invalidateRequestCaches(user.userId);
      return { success: true };
    }
    if (!user.isAdmin) {
      const rows = await db.query(
        `SELECT jellyseerr_user_id FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
        user.userId
      );
      const myId = rows[0]?.jellyseerr_user_id ?? null;
      if (!myId || seerrReq.requestedBy?.id !== myId) {
        return reply.status(403).send({ message: "Not your request" });
      }
    }
    await deleteSeerrRequest(config, seerrReq.id);
    invalidateRequestCaches(user.userId);
    return { success: true };
  });
}

// server/titles/request-listener.ts
var listener = null;
function onTitleRequested(fn) {
  listener = fn;
}
function announceTitleRequested(userId, title) {
  const fn = listener;
  if (!fn) return;
  void Promise.resolve().then(() => fn(userId, title)).catch(() => {
  });
}

// server/request-submit.ts
async function submitRequest(db, getWorkerConfig2, user, body, origin = null) {
  if (!body.mediaType || !body.tmdbId || !body.title) {
    return { status: 400, body: { message: "mediaType, tmdbId, and title are required" } };
  }
  const settings = await getOrCreateUserSettings(db, user.userId, user.username);
  if (settings.blocked) {
    return { status: 403, body: { errorKey: "seer:errUserBlocked", message: "User is blocked" } };
  }
  let isAnime = false;
  const config = await getWorkerConfig2();
  const needDetail = !!config && (body.mediaType === "tv" || !config.allowMaskedRequests);
  const detail = needDetail && config ? await fetchMediaDetail(config.seerrUrl, config.seerrApiKey, body.mediaType, body.tmdbId) : null;
  if (body.mediaType === "tv" && detail && isAnimeFromKeywords(detail)) isAnime = true;
  if (config && detail && !config.allowMaskedRequests) {
    const tags = parseTagSet(await getBlocklistedTags(config.seerrUrl, config.seerrApiKey));
    if (isMaskedTitle(detail, tags)) {
      return { status: 403, body: { errorKey: "seer:errMaskedDenied", message: "Masked title" } };
    }
  }
  if (body.mediaType === "movie" && !settings.allowMovies) {
    return { status: 403, body: { errorKey: "seer:errMoviesDenied", message: "Movies denied" } };
  }
  if (body.mediaType === "tv" && isAnime && !settings.allowAnime) {
    return { status: 403, body: { errorKey: "seer:errAnimeDenied", message: "Anime denied" } };
  }
  if (body.mediaType === "tv" && !isAnime && !settings.allowTv) {
    return { status: 403, body: { errorKey: "seer:errTvDenied", message: "TV denied" } };
  }
  const limit = effectiveDailyLimit(settings.dailyLimit, config?.defaultDailyLimit ?? null);
  if (limit !== null) {
    const todayCount = await countRequestsToday(db, user.userId);
    if (todayCount >= limit) {
      return {
        status: 429,
        body: { errorKey: "seer:errQuotaReached", limit, message: `Daily quota reached (${limit})` }
      };
    }
  }
  if (body.mediaType === "tv" && body.seasons?.length) {
    const existing = await findExistingTvRequest(db, user.userId, body.tmdbId);
    if (existing) {
      const existingSeasons = new Set(existing.seasons ?? []);
      const newSeasons = body.seasons.filter((s) => !existingSeasons.has(s));
      if (newSeasons.length === 0) {
        return { status: 409, body: { message: "All seasons already requested", existing } };
      }
      const merged = [...existing.seasons ?? [], ...newSeasons].sort((a, b) => a - b);
      await addSeasonsToRequest(db, existing.id, merged);
      await createRequest(db, {
        jellyfinUserId: user.userId,
        username: user.username,
        mediaType: body.mediaType,
        tmdbId: body.tmdbId,
        title: body.title,
        posterPath: body.posterPath,
        backdropPath: body.backdropPath,
        overview: body.overview,
        year: body.year,
        seasons: newSeasons,
        profileId: body.profileId ?? existing.profileId,
        isAnime,
        origin
      });
      const updated = await getRequestById(db, existing.id);
      invalidateRequestCaches(user.userId);
      markLocallyPending(body.mediaType, body.tmdbId);
      kickWorkerNow();
      announceTitleRequested(user.userId, { mediaType: body.mediaType, tmdbId: body.tmdbId });
      return { status: 201, body: updated };
    }
  }
  const dup = await findDuplicate(db, user.userId, body.tmdbId, body.mediaType, body.seasons);
  if (dup) {
    return { status: 409, body: { message: "A request for this media is already active", existing: dup } };
  }
  const req = await createRequest(db, {
    jellyfinUserId: user.userId,
    username: user.username,
    mediaType: body.mediaType,
    tmdbId: body.tmdbId,
    title: body.title,
    posterPath: body.posterPath,
    backdropPath: body.backdropPath,
    overview: body.overview,
    year: body.year,
    seasons: body.seasons,
    profileId: body.profileId,
    isAnime,
    origin
  });
  invalidateRequestCaches(user.userId);
  markLocallyPending(body.mediaType, body.tmdbId);
  kickWorkerNow();
  announceTitleRequested(user.userId, { mediaType: body.mediaType, tmdbId: body.tmdbId });
  return { status: 201, body: req };
}

// server/routes-requests.ts
function registerRequestRoutes(app, db, getWorkerConfig2) {
  registerRequestReadRoutes(app, db, getWorkerConfig2);
  registerRequestActionRoutes(app, db, getWorkerConfig2);
  registerRequestForgetRoute(app, db, getWorkerConfig2);
  app.post("/requests", async (request, reply) => {
    const result = await submitRequest(db, getWorkerConfig2, getUser(request), request.body);
    return reply.status(result.status).send(result.body);
  });
  app.delete("/requests/:id", async (request, reply) => {
    const { id } = request.params;
    const user = getUser(request);
    const body = request.body ?? {};
    const deleteFiles = body.deleteFiles === true;
    const parsed = parseRequestId(id);
    if (parsed.kind === "local") {
      const req = await getRequestById(db, parsed.id);
      if (!req) return reply.status(404).send({ message: "Request not found" });
      if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
        return reply.status(403).send({ message: "Not your request" });
      }
      const reqSeasons = req.seasons ?? [];
      const isSeasonSpecific = req.mediaType === "tv" && !!body.seasons && body.seasons.length > 0;
      const removing = isSeasonSpecific ? body.seasons : req.mediaType === "tv" && reqSeasons.length > 0 ? reqSeasons : null;
      const remaining = isSeasonSpecific ? reqSeasons.filter((s) => !removing.includes(s)) : [];
      const partial = isSeasonSpecific && remaining.length > 0;
      await enqueueCleanup(db, {
        action: "delete",
        mediaType: req.mediaType,
        tmdbId: req.tmdbId,
        title: req.title,
        // En partiel on préserve la demande Jellyseerr et la ligne locale
        // (les saisons conservées restent suivies) ; on agit uniquement sur *arr.
        seerrRequestId: partial ? null : req.seerrRequestId,
        seerrMediaId: req.seerrMediaId,
        deleteFiles,
        seasons: removing,
        requestId: partial ? null : parsed.id,
        // Propriétaire réel : un admin peut supprimer la demande d'un tiers,
        // et c'est SON cache à lui qu'il faut invalider, pas celui de tout le monde.
        jellyfinUserId: req.jellyfinUserId
      });
      if (partial) {
        await addSeasonsToRequest(db, parsed.id, remaining);
      } else {
        await updateRequestStatus(db, parsed.id, "deleting");
      }
      invalidateRequestCaches(user.userId);
      kickWorkerNow();
      return { success: true, status: partial ? "updated" : "deleting" };
    }
    const config = await getWorkerConfig2();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const done = await deleteSeerrOnlyRequest(db, config, user, parsed.seerrId, { seasons: body.seasons, deleteFiles });
    if (!done.ok) return reply.status(done.code).send({ message: done.message });
    invalidateRequestCaches(user.userId);
    kickWorkerNow();
    return { success: true, status: done.status };
  });
}

// server/routes-bulk.ts
function getUser2(request) {
  return request.user;
}
function registerBulkRoutes(app, db, getWorkerConfig2) {
  app.post("/requests/bulk-delete", async (request, reply) => {
    const user = getUser2(request);
    const body = request.body;
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return reply.status(400).send({ message: "ids array required" });
    }
    let deleted = 0;
    let errors = 0;
    for (const id of body.ids.slice(0, 50)) {
      try {
        const parsed = parseRequestId(id);
        if (parsed.kind === "seerr") {
          const config = await getWorkerConfig2();
          const done = config ? await deleteSeerrOnlyRequest(db, config, user, parsed.seerrId, { deleteFiles: false }) : null;
          if (done?.ok) deleted++;
          else errors++;
          continue;
        }
        const req = await getRequestById(db, id);
        if (!req) {
          errors++;
          continue;
        }
        if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
          errors++;
          continue;
        }
        if (req.status === "deleting" || req.status === "processing") {
          errors++;
          continue;
        }
        await updateRequestStatus(db, id, "deleting");
        await enqueueCleanup(db, {
          action: "delete",
          mediaType: req.mediaType,
          tmdbId: req.tmdbId,
          title: req.title,
          seerrRequestId: req.seerrRequestId,
          seerrMediaId: req.seerrMediaId,
          // Cohérent avec la suppression unitaire : on arrête le suivi sans
          // supprimer les fichiers (lib partagée). Scopé aux saisons de la demande
          // pour ne jamais toucher d'autres saisons de la série.
          deleteFiles: false,
          seasons: req.mediaType === "tv" && req.seasons && req.seasons.length > 0 ? req.seasons : null,
          requestId: id,
          jellyfinUserId: req.jellyfinUserId
        });
        deleted++;
      } catch {
        errors++;
      }
    }
    if (deleted > 0) kickWorkerNow();
    return { success: true, deleted, errors };
  });
  app.post("/requests/bulk-retry", async (request, reply) => {
    const user = getUser2(request);
    const body = request.body;
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return reply.status(400).send({ message: "ids array required" });
    }
    const newProfileId = body.profileId;
    const config = await getWorkerConfig2();
    let retried = 0;
    let errors = 0;
    for (const id of body.ids.slice(0, 50)) {
      try {
        const req = await getRequestById(db, id);
        if (!req) {
          errors++;
          continue;
        }
        if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
          errors++;
          continue;
        }
        if (["deleting", "processing", "available"].includes(req.status)) {
          errors++;
          continue;
        }
        if (config) {
          if (req.seerrRequestId) {
            await fetch(`${config.seerrUrl}/api/v1/request/${req.seerrRequestId}`, {
              method: "DELETE",
              headers: { "X-Api-Key": config.seerrApiKey },
              signal: AbortSignal.timeout(1e4)
            }).catch(() => {
            });
          }
          if (req.seerrMediaId) {
            await fetch(`${config.seerrUrl}/api/v1/media/${req.seerrMediaId}`, {
              method: "DELETE",
              headers: { "X-Api-Key": config.seerrApiKey },
              signal: AbortSignal.timeout(1e4)
            }).catch(() => {
            });
          }
        }
        await deleteRequestById(db, id);
        const newReq = await createRequest(db, {
          jellyfinUserId: req.jellyfinUserId,
          username: req.username,
          mediaType: req.mediaType,
          tmdbId: req.tmdbId,
          title: req.title,
          posterPath: req.posterPath,
          backdropPath: req.backdropPath,
          overview: req.overview,
          year: req.year,
          seasons: req.seasons,
          priority: 1,
          profileId: newProfileId !== void 0 ? newProfileId : req.profileId,
          origin: originOf(req)
        });
        retried++;
      } catch {
        errors++;
      }
    }
    if (retried > 0) kickWorkerNow();
    return { success: true, retried, errors };
  });
}

// server/routes-profiles.ts
var TIMEOUT = 3e4;
function registerProfileRoutes(app, getPluginConfig2, getSeerrConfig) {
  app.get("/profiles", async () => {
    const config = getPluginConfig2();
    const profiles = config.profiles ?? [];
    return { profiles };
  });
  app.get("/profiles/options", async (_request, reply) => {
    const seerr = getSeerrConfig();
    if (!seerr) return reply.status(503).send({ message: "Seerr not configured" });
    try {
      const [radarr, sonarr2] = await Promise.all([
        fetchArrOptions(seerr, "radarr"),
        fetchArrOptions(seerr, "sonarr")
      ]);
      console.log(`[SeerProfiles] Found ${radarr.length} Radarr, ${sonarr2.length} Sonarr`);
      return { radarr, sonarr: sonarr2 };
    } catch (err) {
      console.error("[SeerProfiles] Failed to fetch options:", err);
      return reply.status(502).send({
        message: err instanceof Error ? err.message : "Failed to fetch quality options"
      });
    }
  });
}
async function fetchArrOptions(seerr, type) {
  const headers = { "X-Api-Key": seerr.seerrApiKey };
  let servers = [];
  try {
    const serviceRes = await fetch(`${seerr.seerrUrl}/api/v1/service/${type}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT)
    });
    if (serviceRes.ok) {
      servers = await serviceRes.json();
    } else {
      const settingsRes = await fetch(`${seerr.seerrUrl}/api/v1/settings/${type}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        servers = settings.map((s, i) => ({
          id: s.id ?? i,
          name: s.name ?? `${type} ${i}`,
          isDefault: s.isDefault ?? i === 0,
          is4k: s.is4k ?? false
        }));
      }
    }
  } catch (err) {
    console.warn(`[SeerProfiles] Failed to list ${type} servers:`, err instanceof Error ? err.message : err);
    return [];
  }
  const nonFourK = servers.filter((s) => !s.is4k);
  const results = await Promise.allSettled(
    nonFourK.map(async (s) => {
      const detailRes = await fetch(`${seerr.seerrUrl}/api/v1/service/${type}/${s.id}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (!detailRes.ok) return { ...s, profiles: [], rootFolders: [], tags: [] };
      const detail = await detailRes.json();
      const profiles = detail.profiles ?? [];
      const rootFolders = detail.rootFolders ?? [];
      const tags = detail.tags ?? [];
      console.log(`[SeerProfiles] ${type}/${s.id} "${s.name}": ${profiles.length} profiles, ${tags.length} tags`);
      return {
        id: s.id,
        name: s.name,
        isDefault: s.isDefault,
        profiles,
        tags,
        rootFolders: rootFolders.map((f) => ({ id: f.id, path: f.path }))
      };
    })
  );
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

// server/users-overview.ts
async function loadSettings(db) {
  const rows = await db.query(`SELECT * FROM seer_user_settings`);
  return new Map(rows.map((r) => {
    const s = rowToUserSettings(r);
    return [normalizeJellyfinId(s.jellyfinUserId), s];
  }));
}
async function loadStats(db) {
  const rows = await db.query(
    `SELECT jellyfin_user_id,
       SUM(CASE WHEN created_at >= ${db.sql.startOfToday()} AND status NOT IN ('failed','deleted') THEN 1 ELSE 0 END) AS today,
       SUM(CASE WHEN status != 'deleted' THEN 1 ELSE 0 END) AS total
     FROM seer_requests GROUP BY jellyfin_user_id`
  );
  const out = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const key = normalizeJellyfinId(r.jellyfin_user_id);
    const prev = out.get(key) ?? { today: 0, total: 0 };
    out.set(key, { today: prev.today + Number(r.today ?? 0), total: prev.total + Number(r.total ?? 0) });
  }
  return out;
}
async function lastKnownName(db, jellyfinUserId) {
  const rows = await db.query(
    `SELECT username FROM seer_requests WHERE jellyfin_user_id = ? ORDER BY created_at DESC, id ASC LIMIT 1`,
    jellyfinUserId
  ).catch(() => []);
  return rows[0]?.username || jellyfinUserId;
}
function defaultSettings(id, name) {
  return {
    jellyfinUserId: id,
    username: name,
    blocked: false,
    dailyLimit: null,
    allowMovies: true,
    allowTv: true,
    allowAnime: true,
    jellyseerrUserId: null,
    jellyseerrLastSync: null,
    createdAt: null,
    updatedAt: null
  };
}
var seerrRef = (s) => s ? { id: s.id, name: s.name, requestCount: s.requestCount } : null;
async function buildUsersOverview(db, cfg, defaults) {
  const [snap, settings, stats] = await Promise.all([
    collectUserSync(db, cfg),
    loadSettings(db),
    loadStats(db)
  ]);
  const seerrById = new Map((snap.seerr ?? []).map((s) => [s.id, s]));
  const toDto = (s, account) => {
    const key = normalizeJellyfinId(s.jellyfinUserId);
    const st = stats.get(key) ?? { today: 0, total: 0 };
    return {
      ...s,
      username: account?.name || s.username,
      requestsToday: st.today,
      requestsTotal: st.total,
      activeRequests: snap.activeRequests.get(key) ?? 0,
      jellyfin: account ? { isAdmin: account.isAdmin, isDisabled: account.isDisabled, imageTag: account.imageTag, lastActivityDate: account.lastActivityDate } : null,
      link: linkStateOf(s, snap.seerr),
      seerr: seerrRef(s.jellyseerrUserId ? seerrById.get(s.jellyseerrUserId) : void 0)
    };
  };
  const users = snap.accounts ? snap.accounts.map((a) => toDto(settings.get(normalizeJellyfinId(a.id)) ?? defaultSettings(a.id, a.name), a)) : [...settings.values()].map((s) => toDto(s, null));
  users.sort((a, b) => a.username.localeCompare(b.username, void 0, { sensitivity: "base" }));
  const plan = snap.plan;
  const gone = await Promise.all((plan?.gone ?? []).map(async (g) => ({
    jellyfinUserId: g.id,
    username: g.username === g.id ? await lastKnownName(db, g.id) : g.username,
    activeRequests: g.activeRequests,
    seerr: seerrRef(g.seerrId ? seerrById.get(g.seerrId) : void 0)
  })));
  return {
    users,
    sync: {
      last: getLastUserSync(),
      running: isUserSyncRunning(),
      autoEveryMinutes: AUTO_SYNC_EVERY_MINUTES,
      pending: plan ? pendingFixes(plan) : 0,
      jellyfinError: snap.jellyfinError,
      seerrError: snap.seerrError
    },
    attention: {
      gone,
      orphanSeerr: (plan?.orphanSeerr ?? []).map((o) => ({
        ...seerrRef(o),
        email: o.email,
        placeholder: (o.email ?? "").toLowerCase().endsWith(PLACEHOLDER_DOMAIN)
      })),
      missingSeerr: (plan?.missingSeerr ?? []).map((m) => ({ jellyfinUserId: m.id, username: m.username }))
    },
    defaults
  };
}

// server/routes-users.ts
function normalizeDailyLimit(raw) {
  if (raw === void 0) return void 0;
  if (raw === null || raw === "") return null;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n === 0) return null;
  return n < 0 ? -1 : n;
}
function registerUsersRoutes(app, db, getWorkerConfig2, requireAdmin, getDefaultDailyLimit) {
  app.get("/admin/users", { preHandler: requireAdmin }, async () => {
    const cfg = await getWorkerConfig2();
    return buildUsersOverview(
      db,
      cfg ? { seerrUrl: cfg.seerrUrl, seerrApiKey: cfg.seerrApiKey } : null,
      { dailyLimit: getDefaultDailyLimit() }
    );
  });
  app.put("/admin/users/:jellyfinUserId", { preHandler: requireAdmin }, async (request) => {
    const { jellyfinUserId } = request.params;
    const body = request.body ?? {};
    const current = await getUserSettings(db, jellyfinUserId);
    if (!current) {
      const name = typeof body.username === "string" && body.username.trim() || jellyfinUserId;
      await getOrCreateUserSettings(db, jellyfinUserId, name);
    }
    await updateUserSettings(db, jellyfinUserId, {
      blocked: body.blocked,
      dailyLimit: normalizeDailyLimit(body.dailyLimit),
      allowMovies: body.allowMovies,
      allowTv: body.allowTv,
      allowAnime: body.allowAnime
    });
    return getUserSettings(db, jellyfinUserId);
  });
}

// server/routes-user-sync.ts
var SEERR_OWNER_ID2 = 1;
var errorText2 = (err) => err instanceof Error ? err.message : String(err);
function registerUserSyncRoutes(app, db, getWorkerConfig2, requireAdmin) {
  const seerCfg = async () => {
    const cfg = await getWorkerConfig2();
    return cfg ? { seerrUrl: cfg.seerrUrl, seerrApiKey: cfg.seerrApiKey } : null;
  };
  app.post("/admin/users/sync", { preHandler: requireAdmin }, async (request) => {
    const body = request.body ?? {};
    const importMissing2 = Array.isArray(body.importMissing) ? body.importMissing.filter((id) => typeof id === "string") : body.importMissing === true;
    return runUserSync(db, await seerCfg(), { trigger: "manual", importMissing: importMissing2 });
  });
  app.post("/admin/users/:jellyfinUserId/link", { preHandler: requireAdmin }, async (request, reply) => {
    const cfg = await seerCfg();
    if (!cfg) return reply.status(503).send({ message: "Jellyseerr n'est pas configur\xE9" });
    const { jellyfinUserId } = request.params;
    const settings = await getUserSettings(db, jellyfinUserId);
    const account = (await fetchJellyfinAccounts(db).catch(() => [])).find((a) => normalizeJellyfinId(a.id) === normalizeJellyfinId(jellyfinUserId));
    try {
      const seerrId = await resolveJellyseerrUserId(
        cfg,
        db,
        jellyfinUserId,
        account?.name || settings?.username || jellyfinUserId
      );
      invalidateRequestCaches(jellyfinUserId);
      return { seerrId };
    } catch (err) {
      const errorKey = err instanceof SeerrAccountError ? `seer:admErr_${err.code.replace(/-/g, "_")}` : void 0;
      return reply.status(502).send({ message: errorText2(err), errorKey });
    }
  });
  app.delete("/admin/users/:jellyfinUserId", { preHandler: requireAdmin }, async (request, reply) => {
    const { jellyfinUserId } = request.params;
    let accounts;
    try {
      accounts = await fetchJellyfinAccounts(db);
    } catch (err) {
      return reply.status(503).send({ message: `Jellyfin injoignable : ${errorText2(err)}` });
    }
    if (accounts.some((a) => normalizeJellyfinId(a.id) === normalizeJellyfinId(jellyfinUserId))) {
      return reply.status(409).send({ message: "Ce compte existe encore dans Jellyfin" });
    }
    await db.execute(`DELETE FROM seer_user_settings WHERE jellyfin_user_id = ?`, jellyfinUserId);
    invalidateRequestCaches(jellyfinUserId);
    return { ok: true };
  });
  app.delete("/admin/seerr-users/:seerrId", { preHandler: requireAdmin }, async (request, reply) => {
    const cfg = await seerCfg();
    if (!cfg) return reply.status(503).send({ message: "Jellyseerr n'est pas configur\xE9" });
    const seerrId = Number(request.params.seerrId);
    if (!Number.isInteger(seerrId) || seerrId <= 0) return reply.status(400).send({ message: "Identifiant invalide" });
    if (seerrId === SEERR_OWNER_ID2) return reply.status(403).send({ message: "Le propri\xE9taire de Jellyseerr ne se supprime pas" });
    const linked = await db.query(
      `SELECT jellyfin_user_id FROM seer_user_settings WHERE jellyseerr_user_id = ?`,
      seerrId
    );
    if (linked.length > 0) {
      const alive = new Set((await fetchJellyfinAccounts(db).catch(() => [])).map((a) => normalizeJellyfinId(a.id)));
      if (linked.some((l) => alive.has(normalizeJellyfinId(l.jellyfin_user_id)))) {
        return reply.status(409).send({ message: "Ce compte Jellyseerr sert encore un compte Jellyfin" });
      }
    }
    try {
      await deleteJellyseerrUser(cfg, seerrId);
    } catch (err) {
      return reply.status(502).send({ message: errorText2(err) });
    }
    await db.execute(
      `UPDATE seer_user_settings SET updated_at = ${db.sql.now()}, jellyseerr_user_id = NULL, jellyseerr_last_sync = NULL WHERE jellyseerr_user_id = ?`,
      seerrId
    );
    invalidateRequestCaches();
    return { ok: true };
  });
}

// server/seerr-ownership.ts
async function pickBestUsernameFor(db, jellyfinUserId, fallback) {
  const isUuid = /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i;
  const rows = await db.query(
    `SELECT username FROM seer_requests
     WHERE jellyfin_user_id = ? AND username IS NOT NULL AND username <> ''
     ORDER BY created_at DESC, id ASC LIMIT 50`,
    jellyfinUserId
  );
  for (const r of rows) {
    if (r.username && !isUuid.test(r.username) && r.username !== jellyfinUserId) {
      return r.username;
    }
  }
  const settings = await db.query(
    `SELECT username FROM seer_user_settings WHERE jellyfin_user_id = ? LIMIT 1`,
    jellyfinUserId
  );
  if (settings[0]?.username && !isUuid.test(settings[0].username) && settings[0].username !== jellyfinUserId) {
    return settings[0].username;
  }
  return rows[0]?.username || fallback;
}
async function reassignSeerrRequestOwnership(config, seerrRequestId, targetUserId, localMedia) {
  const headers = { "Content-Type": "application/json", "X-Api-Key": config.seerrApiKey };
  const cur = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  });
  if (cur.status === 404) {
    if (!localMedia.tmdbId) throw new Error("missing local tmdbId for re-creation");
    const createBody2 = {
      mediaType: localMedia.mediaType,
      mediaId: localMedia.tmdbId,
      userId: targetUserId
    };
    if (localMedia.seasons?.length) createBody2.seasons = localMedia.seasons;
    const postRes2 = await fetch(`${config.seerrUrl}/api/v1/request`, {
      method: "POST",
      headers,
      body: JSON.stringify(createBody2),
      signal: AbortSignal.timeout(15e3)
    });
    if (!postRes2.ok || postRes2.status === 202) {
      const text2 = await postRes2.text().catch(() => "");
      throw new Error(`re-create missing failed (${postRes2.status}): ${text2.slice(0, 200)}`);
    }
    const created2 = await postRes2.json();
    return { method: "create-missing", newRequestId: created2.id };
  }
  if (!cur.ok) {
    throw new Error(`GET request ${seerrRequestId} failed: ${cur.status}`);
  }
  const req = await cur.json();
  if (req.requestedBy?.id === targetUserId) return { method: "skip" };
  const putBody = {
    mediaType: req.media?.mediaType,
    userId: targetUserId
  };
  if (req.serverId != null) putBody.serverId = req.serverId;
  if (req.profileId != null) putBody.profileId = req.profileId;
  if (req.rootFolder) putBody.rootFolder = req.rootFolder;
  if (req.languageProfileId != null) putBody.languageProfileId = req.languageProfileId;
  if (req.tags?.length) putBody.tags = req.tags;
  const putRes = await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(putBody),
    signal: AbortSignal.timeout(15e3)
  });
  if (putRes.ok) {
    const updated = await putRes.json().catch(() => null);
    if (updated?.requestedBy?.id === targetUserId) {
      return { method: "put" };
    }
  }
  if (putRes.status === 409) {
    throw new Error("Jellyseerr ne change plus l'auteur d'une demande d\xE9j\xE0 valid\xE9e \u2014 seulement celles en attente");
  }
  if (!req.media?.tmdbId || !req.media?.mediaType) {
    throw new Error("missing media info for recreate");
  }
  await fetch(`${config.seerrUrl}/api/v1/request/${seerrRequestId}`, {
    method: "DELETE",
    headers: { "X-Api-Key": config.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  }).catch(() => {
  });
  const createBody = {
    mediaType: req.media.mediaType,
    mediaId: req.media.tmdbId,
    userId: targetUserId
  };
  if (req.seasons?.length) createBody.seasons = req.seasons.map((s) => s.seasonNumber);
  if (req.serverId != null) createBody.serverId = req.serverId;
  if (req.profileId != null) createBody.profileId = req.profileId;
  if (req.rootFolder) createBody.rootFolder = req.rootFolder;
  if (req.languageProfileId != null) createBody.languageProfileId = req.languageProfileId;
  if (req.tags?.length) createBody.tags = req.tags;
  const postRes = await fetch(`${config.seerrUrl}/api/v1/request`, {
    method: "POST",
    headers,
    body: JSON.stringify(createBody),
    signal: AbortSignal.timeout(15e3)
  });
  if (!postRes.ok || postRes.status === 202) {
    const text2 = await postRes.text().catch(() => "");
    throw new Error(`recreate failed (${postRes.status}): ${text2.slice(0, 200)}`);
  }
  const created = await postRes.json();
  return { method: "recreate", newRequestId: created.id };
}

// server/routes-ownership.ts
function registerOwnershipRoutes(app, db, getWorkerConfig2, requireAdmin) {
  app.post(
    "/admin/sync-requests-ownership",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const config = await getWorkerConfig2();
      if (!config) return reply.status(503).send({ message: "Seerr not configured" });
      try {
        await invalidateStaleJellyseerrCache(config, db);
      } catch {
      }
      let alreadyOk = 0;
      let reassigned = 0;
      let recreated = 0;
      let orphansCreated = 0;
      let failed = 0;
      const usersTouched = /* @__PURE__ */ new Set();
      const errors = [];
      const rows = await db.query(
        `SELECT id, jellyfin_user_id, username, seerr_request_id, seerr_media_id, media_type, tmdb_id, seasons
         FROM seer_requests
         WHERE seerr_request_id IS NOT NULL
           AND status NOT IN ('deleted','deleting','delete_failed')`
      );
      const distinctUsers = /* @__PURE__ */ new Map();
      for (const r of rows) {
        if (distinctUsers.has(r.jellyfin_user_id)) continue;
        const best = await pickBestUsernameFor(db, r.jellyfin_user_id, r.username);
        distinctUsers.set(r.jellyfin_user_id, best);
      }
      const targetByJellyfin = /* @__PURE__ */ new Map();
      for (const [jfUserId, jfUsername] of distinctUsers) {
        try {
          const seerUserId = await resolveJellyseerrUserId(config, db, jfUserId, jfUsername);
          targetByJellyfin.set(jfUserId, seerUserId);
        } catch {
          try {
            const placeholder = await createPlaceholderJellyseerrUser(config, jfUsername);
            await updateUserSettings(db, jfUserId, {
              jellyseerrUserId: placeholder.id,
              jellyseerrLastSync: /* @__PURE__ */ new Date(),
              username: jfUsername
            });
            targetByJellyfin.set(jfUserId, placeholder.id);
            orphansCreated++;
          } catch (err) {
            errors.push({
              requestId: jfUserId,
              reason: err instanceof Error ? err.message : "placeholder creation failed"
            });
          }
        }
      }
      for (const r of rows) {
        if (!r.seerr_request_id) continue;
        const target = targetByJellyfin.get(r.jellyfin_user_id);
        if (!target) {
          failed++;
          continue;
        }
        let parsedSeasons = null;
        if (r.seasons) {
          try {
            parsedSeasons = typeof r.seasons === "string" ? JSON.parse(r.seasons) : r.seasons;
          } catch {
            parsedSeasons = null;
          }
        }
        try {
          const result = await reassignSeerrRequestOwnership(
            config,
            r.seerr_request_id,
            target,
            {
              mediaType: r.media_type,
              tmdbId: r.tmdb_id,
              seasons: parsedSeasons
            }
          );
          if (result.method === "skip") {
            alreadyOk++;
          } else if (result.method === "create-missing") {
            recreated++;
            usersTouched.add(r.jellyfin_user_id);
            if (result.newRequestId) {
              await db.execute(
                `UPDATE seer_requests SET updated_at = ${db.sql.now()}, seerr_request_id = ? WHERE id = ?`,
                result.newRequestId,
                r.id
              );
            }
          } else {
            reassigned++;
            usersTouched.add(r.jellyfin_user_id);
            if (result.method === "recreate" && result.newRequestId) {
              await db.execute(
                `UPDATE seer_requests SET updated_at = ${db.sql.now()}, seerr_request_id = ? WHERE id = ?`,
                result.newRequestId,
                r.id
              );
            }
          }
        } catch (err) {
          failed++;
          errors.push({
            requestId: r.id,
            reason: err instanceof Error ? err.message : "reassign failed"
          });
        }
      }
      for (const uid of usersTouched) invalidateRequestCaches(uid);
      return {
        total: rows.length,
        reassigned,
        recreated,
        alreadyOk,
        orphansCreated,
        failed,
        errors: errors.slice(0, 20)
        // limiter le payload
      };
    }
  );
}

// server/routes-connection.ts
var TIMEOUT_MS = 8e3;
function cleanUrl(raw) {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
async function probeArr(seerrUrl2, apiKey, type) {
  try {
    const res = await fetch(`${seerrUrl2}/api/v1/settings/${type}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!res.ok) return "unreachable";
    const servers = await res.json();
    const main = servers.find((s) => s.isDefault) ?? servers[0];
    if (!main) return "missing";
    const server = {
      hostname: String(main.hostname ?? ""),
      port: Number(main.port),
      apiKey: String(main.apiKey ?? ""),
      useSsl: !!main.useSsl,
      baseUrl: String(main.baseUrl ?? "")
    };
    const ping = await fetch(`${buildArrUrl(server)}/api/v3/system/status`, {
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    return ping.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}
async function probeJellyfin(seerrUrl2, apiKey) {
  try {
    const res = await fetch(`${seerrUrl2}/api/v1/settings/jellyfin/users`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    return res.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}
async function testSeerrConnection(rawUrl, rawKey) {
  const url = cleanUrl(rawUrl);
  const apiKey = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!url) return { ok: false, error: "bad-url", version: null, arr: null, jellyfin: null };
  let version = null;
  try {
    const res = await fetch(`${url}/api/v1/status`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { ok: false, error: "unreachable", version: null, arr: null, jellyfin: null };
    version = (await res.json()).version ?? null;
  } catch {
    return { ok: false, error: "unreachable", version: null, arr: null, jellyfin: null };
  }
  try {
    const res = await fetch(`${url}/api/v1/settings/main`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "invalid-key", version, arr: null, jellyfin: null };
    if (!res.ok) return { ok: false, error: "unreachable", version, arr: null, jellyfin: null };
  } catch {
    return { ok: false, error: "unreachable", version, arr: null, jellyfin: null };
  }
  const [sonarr2, radarr, jellyfin] = await Promise.all([
    probeArr(url, apiKey, "sonarr"),
    probeArr(url, apiKey, "radarr"),
    probeJellyfin(url, apiKey)
  ]);
  return { ok: true, error: null, version, arr: { sonarr: sonarr2, radarr }, jellyfin };
}
function registerConnectionRoutes(app, requireAdmin) {
  app.post("/admin/test-connection", { preHandler: requireAdmin }, async (request) => {
    const body = request.body ?? {};
    return testSeerrConnection(body.url, body.apiKey);
  });
}

// server/availability.ts
var THEATRICAL_WINDOW_DAYS = 180;
var RECENT_WINDOW_DAYS = 120;
function daysBetween(from, to) {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const a = new Date(ay, am - 1, ad).getTime();
  const b = new Date(by, bm - 1, bd).getTime();
  return Math.round((b - a) / 864e5);
}
var RANK = { physical: 0, digital: 1, streaming: 2, theatrical: 3 };
function buildChannels(meta, today) {
  const raw = [
    ["physical", meta.physicalDate],
    ["digital", meta.digitalDate],
    ["theatrical", meta.theatricalDate]
  ];
  const channels = [];
  for (const [id, date] of raw) {
    if (!date) continue;
    const released = date <= today;
    if (released) {
      const window = id === "theatrical" ? THEATRICAL_WINDOW_DAYS : RECENT_WINDOW_DAYS;
      if (daysBetween(date, today) > window) continue;
    }
    channels.push({ id, date, released });
  }
  const hasDigital = channels.some((c) => c.id === "digital" && c.released);
  if (!hasDigital && (meta.providerIds?.length ?? 0) > 0) {
    channels.push({ id: "streaming", date: null, released: true });
  }
  return channels.sort((a, b) => {
    if (a.released !== b.released) return a.released ? -1 : 1;
    if (a.released) return RANK[a.id] - RANK[b.id];
    return (a.date ?? "").localeCompare(b.date ?? "");
  });
}
function kindOf(channels, meta, today) {
  const first = channels[0];
  if (!first) {
    return meta.releaseDate && meta.releaseDate > today ? "upcoming" : "released";
  }
  if (first.released) return first.id === "theatrical" ? "theatrical" : "released";
  return first.id === "digital" ? "digital_soon" : "upcoming";
}
function outlookOf(meta, today, channels) {
  const outOfTheaters = meta.digitalDate != null && meta.digitalDate <= today || meta.physicalDate != null && meta.physicalDate <= today || (meta.providerIds?.length ?? 0) > 0;
  if (outOfTheaters) return "likely";
  if (channels.some((c) => c.released)) return "unlikely";
  return channels.length === 0 ? "likely" : "not_yet";
}
function classifyAvailability(meta, today = todayString()) {
  const base = {
    mediaType: meta.mediaType,
    tmdbId: meta.tmdbId,
    theatricalDate: meta.theatricalDate,
    digitalDate: meta.digitalDate,
    physicalDate: meta.physicalDate,
    providerIds: meta.providerIds ?? []
  };
  if (meta.mediaType === "tv") {
    const notAired = meta.releaseDate && meta.releaseDate > today || !meta.releaseDate && isPlanned(meta.tmdbStatus);
    return {
      ...base,
      // Rien qui ne soit pas encore diffusé ne peut être « en streaming ».
      channels: notAired ? [] : buildChannels(meta, today),
      outlook: notAired ? "not_yet" : "likely",
      kind: notAired ? "not_aired" : "released",
      date: notAired ? meta.releaseDate : null,
      obtainable: !notAired
    };
  }
  const channels = buildChannels(meta, today);
  const kind = kindOf(channels, meta, today);
  const outlook = outlookOf(meta, today, channels);
  const date = channels[0]?.date ?? (meta.releaseDate && meta.releaseDate > today ? meta.releaseDate : null);
  return {
    ...base,
    channels,
    outlook,
    kind,
    date: kind === "released" && channels.length === 0 ? null : date,
    obtainable: outlook === "likely"
  };
}
function isPlanned(tmdbStatus) {
  const status = (tmdbStatus ?? "").toLowerCase();
  return status === "planned" || status === "in production" || status === "rumored";
}

// server/routes-availability.ts
var MAX_ITEMS2 = 120;
var FETCH_BUDGET = 12;
function registerAvailabilityRoutes(app, db, getWorkerConfig2) {
  app.post("/availability", async (request) => {
    const body = request.body ?? {};
    const asked = Array.isArray(body.items) ? body.items : [];
    const raw = asked.slice(0, MAX_ITEMS2);
    if (asked.length > MAX_ITEMS2) {
      console.warn(`[Seer] /availability : ${asked.length} titres demand\xE9s, ${MAX_ITEMS2} trait\xE9s`);
    }
    const refs = [];
    for (const it of raw) {
      const tmdbId = Number(it?.tmdbId);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) continue;
      if (it?.mediaType !== "movie" && it?.mediaType !== "tv") continue;
      refs.push({ mediaType: it.mediaType, tmdbId });
    }
    if (refs.length === 0) return { results: [] };
    const config = await getWorkerConfig2();
    const region = typeof body.region === "string" && /^[a-z]{2}$/i.test(body.region) ? body.region.toUpperCase() : DEFAULT_REGION;
    const { meta, missing } = await resolveTmdbMeta(db, config, refs, {
      maxFetch: FETCH_BUDGET,
      region
    });
    if (missing.length > 0) scheduleTmdbBackfill(db, config, missing, region);
    const results = [];
    for (const ref of refs) {
      const m = meta.get(tmdbKey(ref));
      if (m) results.push(classifyAvailability(m));
    }
    return { results, pending: missing.length };
  });
  app.get("/series/gaps", async () => {
    const seasons = await partialSeriesSeasons(await getWorkerConfig2());
    const items = {};
    for (const [tmdbId, states] of seasons) {
      const gaps = gapsOf(states);
      if (gaps) items[tmdbId] = gaps;
    }
    return { items };
  });
}

// server/routes-progress.ts
var PROGRESS_TTL_MS = 1e4;
function registerProgressRoutes(app, db, getWorkerConfig2, requireAdmin) {
  app.get("/downloads", { preHandler: requireAdmin }, async () => {
    const config = await getWorkerConfig2();
    const empty = {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      items: [],
      total: 0,
      unreachable: []
    };
    if (!config) return empty;
    return fetchServerQueue(config);
  });
  app.get("/requests/progress", async (request) => {
    const user = getUser(request);
    const config = await getWorkerConfig2();
    if (!config) return { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), items: [] };
    return cached(`seer-cache:${user.userId}:progress`, PROGRESS_TTL_MS, async () => {
      const rows = await loadMergedRows(db, config, user, (err, msg) => app.log?.warn?.({ err }, msg));
      return progressOf(config, hydrateRows(rows, /* @__PURE__ */ new Map(), user));
    });
  });
}
async function progressOf(config, list) {
  const requests = list.filter((r) => IN_FLIGHT.has(r.status));
  const verdicts = await arrVerdicts(config, requests);
  const items = [];
  for (const r of requests) {
    const verdict = verdicts.get(r.id);
    if (!verdict || !verdict.download && verdict.status === r.status) continue;
    items.push({
      id: r.id,
      tmdbId: r.tmdbId,
      mediaType: r.mediaType,
      status: verdict.status,
      download: verdict.download ?? void 0,
      downloads: verdict.downloads
    });
  }
  return { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), items };
}

// server/calendar-everyone.ts
var LOCAL_PENDING_STATUSES2 = [
  "queued",
  "processing",
  "retry_pending",
  "failed",
  "deleting",
  "delete_failed"
];
var EVERYONE_ROWS_KEY = "seer:rows:everyone";
async function buildEveryoneRows(db, cfg, log) {
  const localPendingRows = await db.query(
    `SELECT * FROM seer_requests
     WHERE status IN (${LOCAL_PENDING_STATUSES2.map(() => "?").join(",")})
     ORDER BY created_at DESC, id ASC`,
    ...LOCAL_PENDING_STATUSES2
  );
  const localPending = localPendingRows.map(rowToRequest);
  const localBySeerrId = /* @__PURE__ */ new Map();
  const allLocalRows = await db.query(
    `SELECT * FROM seer_requests WHERE seerr_request_id IS NOT NULL`
  );
  for (const row of allLocalRows) {
    const r = rowToRequest(row);
    if (r.seerrRequestId) localBySeerrId.set(r.seerrRequestId, r);
  }
  let seerrRows = [];
  let seerrUnreachable = false;
  const seasonStatesP = partialSeriesSeasons(cfg);
  try {
    const all = await fetchAllSeerrRequests(cfg, null);
    seerrRows = all.rows;
  } catch (err) {
    seerrUnreachable = true;
    log?.(err, "Seerr fetch (tous) failed, falling back to local only");
  }
  return assembleRows(db, { seerrRows, localPending, localBySeerrId, seerrUnreachable }, seasonStatesP);
}
function loadEveryoneRows(db, cfg, log) {
  return cached(EVERYONE_ROWS_KEY, 6e4, () => buildEveryoneRows(db, cfg, log), { staleMs: 6e5 });
}

// server/routes-requests-all.ts
var PROGRESS_TTL_MS2 = 1e4;
async function requesterResolver(db) {
  const rows = await db.query(
    `SELECT jellyfin_user_id, username, jellyseerr_user_id FROM seer_user_settings WHERE jellyseerr_user_id IS NOT NULL`
  ).catch(() => []);
  const byId = new Map(rows.map((r) => [Number(r.jellyseerr_user_id), r]));
  return (sr) => {
    const by = sr.requestedBy;
    const known = by ? byId.get(by.id) : void 0;
    return {
      jellyfinUserId: known?.jellyfin_user_id ?? by?.jellyfinUserId ?? "",
      username: known?.username || by?.jellyfinUsername || by?.displayName || by?.username || (by ? `#${by.id}` : "?")
    };
  };
}
function registerAllRequestsRoutes(app, db, getWorkerConfig2, requireAdmin) {
  const warn = (err, msg) => app.log?.warn?.({ err }, msg);
  app.get("/admin/requests", { preHandler: requireAdmin }, async (request) => {
    const user = getUser(request);
    const query = request.query;
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const config = await getWorkerConfig2();
    if (!config) {
      const local = await getAllRequests(db, { page, limit, mediaType: query.type });
      return { ...local, results: local.results.map(localToUnified) };
    }
    const rows = await loadEveryoneRows(db, config, warn);
    return requestsPage(
      db,
      config,
      rows,
      user,
      { page, limit, status: query.status, type: query.type, q: query.q, byRequester: true },
      await requesterResolver(db)
    );
  });
  app.get("/admin/requests/progress", { preHandler: requireAdmin }, async (request) => {
    const user = getUser(request);
    const config = await getWorkerConfig2();
    if (!config) return { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), items: [] };
    return cached("seer:progress:everyone", PROGRESS_TTL_MS2, async () => {
      const rows = await loadEveryoneRows(db, config, warn);
      return progressOf(config, hydrateRows(rows, /* @__PURE__ */ new Map(), user, await requesterResolver(db)));
    });
  });
}

// server/calendar-types.ts
var DATE_RE2 = /^\d{4}-\d{2}-\d{2}$/;
function isDayString(v) {
  return typeof v === "string" && DATE_RE2.test(v);
}
function addDays(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
function makeItemId(mediaType, tmdbId, kind, date) {
  return `${mediaType}:${tmdbId}:${kind}:${date}`;
}
function sortCalendarItems(items) {
  return items.sort((a, b) => a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1);
}
function capPerSeries(items, max) {
  const seen = /* @__PURE__ */ new Map();
  const out = [];
  for (const item of items) {
    if (item.mediaType !== "tv") {
      out.push(item);
      continue;
    }
    const n = (seen.get(item.tmdbId) ?? 0) + 1;
    seen.set(item.tmdbId, n);
    if (n <= max) out.push(item);
  }
  return out;
}
function capPerSeriesFuture(items, max, today) {
  const seen = /* @__PURE__ */ new Map();
  const out = [];
  for (const item of items) {
    if (item.mediaType !== "tv" || item.date < today) {
      out.push(item);
      continue;
    }
    const n = (seen.get(item.tmdbId) ?? 0) + 1;
    seen.set(item.tmdbId, n);
    if (n <= max) out.push(item);
  }
  return out;
}

// server/calendar-freshness.ts
function isDateless(m) {
  return !m.releaseDate && !m.digitalDate && !m.theatricalDate && !m.physicalDate && !m.nextAirDate;
}
function needsDateRefresh(m, now = Date.now()) {
  if (!isDateless(m)) return false;
  const expires = Date.parse(m.expiresAt);
  return !Number.isFinite(expires) || expires <= now;
}
function needsTraitsRefresh(m) {
  return !m.originalLanguage;
}

// server/calendar-personal.ts
var FETCH_BUDGET2 = 25;
var MAX_PER_SERIES = 3;
var SETTLED_MEDIA_STATUS = /* @__PURE__ */ new Set([5]);
function collectRequestRefs(rows, includeSettled) {
  const refs = /* @__PURE__ */ new Map();
  const statusByKey = /* @__PURE__ */ new Map();
  for (const sr of rows.seerrRows) {
    if (!sr.media?.tmdbId) continue;
    const ref = { mediaType: sr.media.mediaType, tmdbId: sr.media.tmdbId };
    const key = tmdbKey(ref);
    if (!includeSettled && sr.media.mediaType === "movie" && SETTLED_MEDIA_STATUS.has(sr.media.status ?? 0)) continue;
    refs.set(key, ref);
    if (!statusByKey.has(key)) {
      const local = rows.localBySeerrId.get(sr.id);
      statusByKey.set(key, {
        status: resolveLiveStatus(sr, local, rows.seasonStates?.get(sr.media.tmdbId)),
        requestId: local?.id ?? `seerr-${sr.id}`
      });
    }
  }
  for (const l of rows.localOnly) {
    if (!l.tmdbId) continue;
    const key = tmdbKey({ mediaType: l.mediaType, tmdbId: l.tmdbId });
    refs.set(key, { mediaType: l.mediaType, tmdbId: l.tmdbId });
    if (!statusByKey.has(key)) statusByKey.set(key, { status: l.status, requestId: l.id });
  }
  return { refs, statusByKey };
}
async function buildPersonalCalendar(db, cfg, rows, opts) {
  const region = opts.region ?? DEFAULT_REGION;
  const { refs, statusByKey } = collectRequestRefs(rows, opts.includeSettled ?? false);
  const list = Array.from(refs.values());
  const { meta, missing } = await resolveTmdbMeta(db, cfg, list, {
    maxFetch: opts.maxFetch ?? FETCH_BUDGET2,
    region
  });
  const undated = list.filter((ref) => {
    const m = meta.get(tmdbKey(ref));
    return !!m && needsDateRefresh(m);
  });
  const toFill = [...missing, ...undated];
  const untyped = list.filter((ref) => {
    const m = meta.get(tmdbKey(ref));
    return !!m && !needsDateRefresh(m) && needsTraitsRefresh(m);
  });
  if (toFill.length > 0 || untyped.length > 0) {
    scheduleTmdbBackfill(db, cfg, [...toFill, ...untyped], region);
  }
  const items = [];
  for (const ref of list) {
    const m = meta.get(tmdbKey(ref));
    if (!m) continue;
    const ctx = statusByKey.get(tmdbKey(ref));
    for (const item of metaToCalendarItems(m, opts.from, opts.to)) {
      items.push({
        ...item,
        requestId: ctx?.requestId ?? null,
        requestStatus: ctx?.status ?? null
      });
    }
  }
  return {
    from: opts.from,
    to: opts.to,
    items: capPerSeries(sortCalendarItems(items), MAX_PER_SERIES),
    /* Des lignes de repli (Jellyseerr muet) rendent le résultat incomplet au
     * même titre que des fiches manquantes : TTL court + sondage du client,
     * jusqu'à ce que la vraie liste revienne. */
    partial: toFill.length > 0 || rows.seerrUnreachable === true
  };
}
function metaToCalendarItems(m, from, to) {
  const out = [];
  const push = (date, kind, season, episode) => {
    if (!date || date < from || date > to) return;
    out.push({
      id: makeItemId(m.mediaType, m.tmdbId, kind, date),
      date,
      mediaType: m.mediaType,
      tmdbId: m.tmdbId,
      title: m.title,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      overview: m.overview,
      kind,
      seasonNumber: season ?? null,
      episodeNumber: episode ?? null,
      networks: m.networks,
      providerIds: m.providerIds,
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: m.isAnime ?? false
    });
  };
  if (m.mediaType === "movie") {
    push(m.digitalDate, "digital");
    push(m.theatricalDate, "theatrical");
    push(m.physicalDate, "physical");
    if (out.length === 0) push(m.releaseDate, "premiere");
  } else {
    push(m.nextAirDate, "episode", m.nextSeason, m.nextEpisode);
    if (m.releaseDate && (!m.nextAirDate || m.releaseDate !== m.nextAirDate)) {
      push(m.releaseDate, "premiere");
    }
  }
  return out;
}

// server/calendar-providers.ts
var EPISODE_FETCH_BUDGET = 30;
var MEDIA_STATUS_BLOCKLISTED2 = 6;
async function buildProviderEpisodes(db, cfg, rows, opts) {
  const refs = [];
  const posters = /* @__PURE__ */ new Map();
  for (const r of rows) {
    if (!r.id || r.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED2) continue;
    refs.push({ mediaType: "tv", tmdbId: r.id });
    posters.set(r.id, r);
  }
  if (refs.length === 0) return { items: [], partial: false };
  const { meta, missing } = await resolveTmdbMeta(db, cfg, refs, {
    maxFetch: EPISODE_FETCH_BUDGET,
    region: opts.region
  });
  if (missing.length > 0) scheduleTmdbBackfill(db, cfg, missing, opts.region);
  const items = [];
  for (const ref of refs) {
    const m = meta.get(tmdbKey(ref));
    const date = m?.nextAirDate;
    if (!m || !date || date < opts.from || date > opts.to) continue;
    const src = posters.get(ref.tmdbId);
    items.push({
      id: makeItemId("tv", ref.tmdbId, "episode", date),
      date,
      mediaType: "tv",
      tmdbId: ref.tmdbId,
      title: m.title || src?.name || "",
      posterPath: m.posterPath ?? src?.posterPath ?? null,
      backdropPath: m.backdropPath ?? src?.backdropPath ?? null,
      overview: m.overview ?? src?.overview ?? null,
      kind: "episode",
      seasonNumber: m.nextSeason,
      episodeNumber: m.nextEpisode,
      networks: m.networks,
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: m.isAnime ?? false,
      // Les vraies plateformes de la série, pas celles qu'on a demandées.
      providerIds: m.providerIds ?? [],
      requestId: null,
      requestStatus: null
    });
  }
  return { items, partial: missing.length > 0 };
}

// server/calendar-store-sources.ts
var MEDIA_STATUS_BLOCKLISTED3 = 6;
var PAGES = 3;
var SRC_TTL_MS = 36e5;
var SRC_STALE_MS = 6 * 36e5;
var TMDB_STATUS_RETURNING = "0";
var UNION_CHUNK = 8;
var UNION_PROVIDERS_MAX = 16;
var PRIORITY_PROVIDER_IDS = [8, 119, 337, 283, 350, 381, 415, 1899];
async function discover(cfg, path, params, page) {
  const qs = new URLSearchParams({ ...params, page: String(page) });
  const res = await fetch(`${cfg.seerrUrl}/api/v1/discover/${path}?${qs}`, {
    headers: { "X-Api-Key": cfg.seerrApiKey },
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) throw new Error(`discover/${path} \u2192 ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}
async function discoverPages(cfg, path, params) {
  const pages = await mapLimitStrict(
    Array.from({ length: PAGES }, (_, i) => i + 1),
    3,
    (page) => discover(cfg, path, params, page)
  );
  return pages.flat();
}
async function discoverUpcomingMovies(cfg) {
  return cached(
    "seer:src:mov-up",
    SRC_TTL_MS,
    () => discoverPages(cfg, "movies/upcoming", {}),
    { staleMs: SRC_STALE_MS }
  );
}
async function discoverRecentMovies(cfg, from, to) {
  return cached(
    `seer:src:mov-recent:${from}:${to}`,
    SRC_TTL_MS,
    () => discoverPages(cfg, "movies", {
      sortBy: "primary_release_date.desc",
      primaryReleaseDateGte: from,
      primaryReleaseDateLte: to
    }),
    { staleMs: SRC_STALE_MS }
  );
}
async function discoverTvFirsts(cfg, from) {
  return cached(
    `seer:src:tv-first:${from}`,
    SRC_TTL_MS,
    () => discoverPages(cfg, "tv", {
      sortBy: "first_air_date.asc",
      firstAirDateGte: from
    }),
    { staleMs: SRC_STALE_MS }
  );
}
async function discoverTvReturning(cfg) {
  return cached(
    "seer:src:tv-ret",
    SRC_TTL_MS,
    () => discoverPages(cfg, "tv", {
      sortBy: "popularity.desc",
      status: TMDB_STATUS_RETURNING
    }),
    { staleMs: SRC_STALE_MS }
  );
}
async function discoverTvReturningByProviders(cfg, ids, region) {
  if (ids.length === 0) return [];
  const key = [...ids].sort((a, b) => a - b).join("-");
  return cached(
    `seer:src:tv-prov:${key}:${region}`,
    SRC_TTL_MS,
    () => discoverPages(cfg, "tv", {
      watchProviders: ids.join("|"),
      watchRegion: region,
      sortBy: "first_air_date.desc",
      status: TMDB_STATUS_RETURNING
    }),
    { staleMs: SRC_STALE_MS }
  );
}
async function discoverTvTopProviders(cfg, region) {
  const ids = await topRegionProviderIds(cfg, region);
  const chunks = [];
  for (let i = 0; i < ids.length; i += UNION_CHUNK) chunks.push(ids.slice(i, i + UNION_CHUNK));
  const buckets = await mapLimitStrict(chunks, 2, (c) => discoverTvReturningByProviders(cfg, c, region));
  return buckets.flat();
}
function discoverRowsToItems(rows, type, from, to) {
  const out = [];
  for (const r of rows) {
    if (!r.id) continue;
    if (r.mediaInfo?.status === MEDIA_STATUS_BLOCKLISTED3) continue;
    const date = toDayString(r.releaseDate ?? r.firstAirDate);
    if (!date || date < from || date > to) continue;
    const mediaType = r.mediaType === "tv" || r.mediaType === "movie" ? r.mediaType : type;
    const kind = mediaType === "movie" ? "theatrical" : "premiere";
    out.push({
      id: makeItemId(mediaType, r.id, kind, date),
      date,
      mediaType,
      tmdbId: r.id,
      title: r.title ?? r.name ?? "",
      posterPath: r.posterPath ?? null,
      backdropPath: r.backdropPath ?? null,
      overview: r.overview ?? null,
      kind,
      seasonNumber: null,
      episodeNumber: null,
      networks: null,
      voteAverage: typeof r.voteAverage === "number" ? r.voteAverage : null,
      popularity: typeof r.popularity === "number" ? r.popularity : null,
      originalLanguage: r.originalLanguage ?? null,
      isAnime: detectAnime(r),
      // Complété par l'enrichissement final du build : recopier la plateforme
      // demandée jurerait qu'un film est sur toutes les plateformes cochées.
      providerIds: [],
      requestId: null,
      requestStatus: null
    });
  }
  return out;
}
async function topRegionProviderIds(cfg, region) {
  return cached(
    `seer:src:top-prov:${region}`,
    24 * 36e5,
    async () => {
      const catalog = [];
      let pannes = 0;
      for (const path of ["tv", "movies"]) {
        try {
          const res = await fetch(
            `${cfg.seerrUrl}/api/v1/watchproviders/${path}?watchRegion=${region}`,
            { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
          );
          if (!res.ok) throw new Error(`watchproviders/${path} \u2192 ${res.status}`);
          const data = await res.json();
          for (const p of Array.isArray(data) ? data : []) {
            if (typeof p.id === "number" && !catalog.includes(p.id)) catalog.push(p.id);
          }
        } catch {
          pannes++;
        }
      }
      if (pannes === 2) throw new Error("watchproviders : aucun catalogue ne r\xE9pond");
      const out = [];
      for (const id of PRIORITY_PROVIDER_IDS) {
        if (catalog.includes(id) && !out.includes(id)) out.push(id);
      }
      for (const id of catalog) {
        if (out.length >= UNION_PROVIDERS_MAX) break;
        if (!out.includes(id)) out.push(id);
      }
      return out.slice(0, UNION_PROVIDERS_MAX);
    }
  );
}

// server/calendar-store-build.ts
var REQUESTS_FETCH_BUDGET = 60;
var MAX_STORE_ITEMS = 4e3;
async function buildCalendarStore(db, cfg, region, from, to, warn) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  let degraded = false;
  const fail = (name) => (err) => {
    degraded = true;
    warn?.(err, `[seer] source \xAB ${name} \xBB en \xE9chec \u2014 calendrier ma\xEEtre incomplet`);
  };
  const [movUp, movRecent, tvFirsts, tvReturning, tvProviders, sonarrEps, rows] = await Promise.all([
    sourceOrFallback(discoverUpcomingMovies(cfg), [], fail("films \xE0 venir")),
    sourceOrFallback(discoverRecentMovies(cfg, from, today), [], fail("films r\xE9cents")),
    sourceOrFallback(discoverTvFirsts(cfg, from), [], fail("d\xE9buts de s\xE9ries")),
    sourceOrFallback(discoverTvReturning(cfg), [], fail("s\xE9ries en cours")),
    sourceOrFallback(discoverTvTopProviders(cfg, region), [], fail("plateformes")),
    sourceOrFallback(sonarrWindowEpisodes(cfg, from, to), [], fail("calendrier Sonarr")),
    // Ne lève jamais : repli local interne + drapeau seerrUnreachable.
    loadEveryoneRows(db, cfg, warn)
  ]);
  if (rows.seerrUnreachable === true) degraded = true;
  const requests = await buildPersonalCalendar(db, cfg, rows, {
    from,
    to,
    includeSettled: true,
    maxFetch: REQUESTS_FETCH_BUDGET,
    region
  });
  const requestItems = requests.items.map((it) => ({
    ...it,
    requestId: null,
    requestStatus: null
  }));
  const { items: sonarrItems, missing: sonarrMissing } = await sonarrEpisodesToItems(db, sonarrEps, from, to);
  if (sonarrMissing.length > 0) scheduleTmdbBackfill(db, cfg, sonarrMissing, region);
  const seriesRows = dedupeRows([...tvReturning, ...tvProviders]);
  const episodes = await buildProviderEpisodes(db, cfg, seriesRows, { region, from, to });
  const discoverItems = [
    ...discoverRowsToItems(movUp, "movie", from, to),
    ...discoverRowsToItems(movRecent, "movie", from, to),
    ...discoverRowsToItems(tvFirsts, "tv", from, to)
  ];
  const merged = dedupeStoreItems([
    ...requestItems,
    ...sonarrItems,
    ...episodes.items,
    ...discoverItems
  ]);
  await enrichFromMeta(db, cfg, merged, region);
  let items = sortCalendarItems(merged);
  if (items.length > MAX_STORE_ITEMS) {
    warn?.(null, `[seer] store ${region} tronqu\xE9 : ${items.length} \u2192 ${MAX_STORE_ITEMS} entr\xE9es`);
    items = items.slice(0, MAX_STORE_ITEMS);
  }
  const res = await attachAirTimes(cfg, { from, to, items, partial: false });
  return {
    region,
    from,
    to,
    items: res.items,
    partial: requests.partial || episodes.partial || sonarrMissing.length > 0 || degraded,
    builtAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function sourceOrFallback(p, fallback, onFail) {
  try {
    return await p;
  } catch (err) {
    onFail(err);
    return fallback;
  }
}
function dedupeRows(rows) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const r of rows) {
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}
function dedupeStoreItems(items) {
  const byKey = /* @__PURE__ */ new Map();
  const identifiedDays = /* @__PURE__ */ new Set();
  const anonymous = [];
  for (const it of items) {
    if (it.kind === "episode" && (it.seasonNumber == null || it.episodeNumber == null)) {
      anonymous.push(it);
      continue;
    }
    const key = it.kind === "episode" ? `${it.mediaType}:${it.tmdbId}:S${it.seasonNumber}E${it.episodeNumber}` : `${it.mediaType}:${it.tmdbId}:${it.kind}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, it);
    else if (!prev.airDateUtc && it.airDateUtc) byKey.set(key, it);
  }
  for (const it of byKey.values()) {
    if (it.kind === "episode") identifiedDays.add(`${it.tmdbId}:${it.date}`);
  }
  for (const it of anonymous) {
    const key = `${it.mediaType}:${it.tmdbId}:episode:${it.date}`;
    if (identifiedDays.has(`${it.tmdbId}:${it.date}`) || byKey.has(key)) continue;
    byKey.set(key, it);
  }
  return Array.from(byKey.values());
}
async function sonarrEpisodesToItems(db, eps, from, to) {
  if (eps.length === 0) return { items: [], missing: [] };
  const refs = Array.from(new Set(eps.map((e) => e.tmdbId))).map((tmdbId) => ({ mediaType: "tv", tmdbId }));
  const { meta, missing } = await resolveTmdbMeta(db, null, refs, { maxFetch: 0 });
  const items = [];
  for (const e of eps) {
    const m = meta.get(tmdbKey({ mediaType: "tv", tmdbId: e.tmdbId }));
    if (!m || !m.title) continue;
    const date = e.airDate ?? e.airDateUtc.slice(0, 10);
    if (date < from || date > to) continue;
    items.push({
      id: makeItemId("tv", e.tmdbId, "episode", date),
      date,
      mediaType: "tv",
      tmdbId: e.tmdbId,
      title: m.title,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      overview: m.overview,
      kind: "episode",
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      airDateUtc: e.airDateUtc,
      networks: m.networks,
      providerIds: m.providerIds ?? [],
      voteAverage: m.voteAverage ?? null,
      popularity: m.popularity ?? null,
      originalLanguage: m.originalLanguage ?? null,
      isAnime: detectAnimeLoose(m),
      requestId: null,
      requestStatus: null
    });
  }
  return { items, missing };
}
async function enrichFromMeta(db, cfg, items, region) {
  const refs = items.map((i) => ({ mediaType: i.mediaType, tmdbId: i.tmdbId }));
  const { meta } = await resolveTmdbMeta(db, cfg, refs, { maxFetch: 0, region });
  for (const it of items) {
    const m = meta.get(tmdbKey({ mediaType: it.mediaType, tmdbId: it.tmdbId }));
    if (!m) continue;
    if (it.providerIds.length === 0 && m.providerIds?.length) it.providerIds = m.providerIds;
    if (it.voteAverage == null && m.voteAverage != null) it.voteAverage = m.voteAverage;
    if (it.popularity == null && m.popularity != null) it.popularity = m.popularity;
    if (!it.originalLanguage && m.originalLanguage) it.originalLanguage = m.originalLanguage;
    if (it.isAnime !== true && detectAnimeLoose(m)) it.isAnime = true;
  }
}

// server/calendar-store.ts
var STORE_TTL_MS = 6 * 36e5;
var STORE_STALE_MS = 24 * 36e5;
var STORE_PARTIAL_TTL_MS = 6e4;
var PAST_GRID_MARGIN_DAYS = 7;
var FUTURE_DAYS = 180;
var seenRegions = /* @__PURE__ */ new Set([DEFAULT_REGION]);
function calendarStoreHorizon(today) {
  const [y, m] = today.split("-").map(Number);
  const prevFirst = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  return { from: addDays(prevFirst, -PAST_GRID_MARGIN_DAYS), to: addDays(today, FUTURE_DAYS) };
}
async function getCalendarStore(db, cfg, region, warn) {
  const reg = /^[A-Z]{2}$/.test(region) ? region : DEFAULT_REGION;
  seenRegions.add(reg);
  const { from, to } = calendarStoreHorizon(todayString());
  return cached(
    `seer:store:${reg}:${from}`,
    STORE_TTL_MS,
    () => buildCalendarStore(db, cfg, reg, from, to, warn),
    {
      staleMs: STORE_STALE_MS,
      ttlFor: (s) => s.partial ? STORE_PARTIAL_TTL_MS : STORE_TTL_MS
    }
  );
}
function initCalendarStoreMaintenance(db, getCfg, warn) {
  let stopped = false;
  const warm = async () => {
    if (stopped) return;
    const cfg = await getCfg();
    if (!cfg) return;
    for (const region of seenRegions) {
      if (stopped) return;
      await getCalendarStore(db, cfg, region, warn).catch((err) => {
        warn?.(err, `[seer] \xE9chec du pr\xE9chauffage du calendrier (${region})`);
      });
    }
  };
  const boot2 = setTimeout(() => {
    void warm();
  }, 15e3);
  const tick2 = setInterval(() => {
    void warm();
  }, 30 * 6e4);
  boot2.unref?.();
  tick2.unref?.();
  return () => {
    stopped = true;
    clearTimeout(boot2);
    clearInterval(tick2);
  };
}

// server/calendar-requested.ts
async function requestedIds(db) {
  return cached(
    "seer:requested:index",
    6e4,
    async () => {
      const rows = await db.query(
        `SELECT DISTINCT media_type, tmdb_id FROM seer_requests WHERE tmdb_id > 0`
      );
      return new Set(rows.map((r) => `${r.media_type}:${Number(r.tmdb_id)}`));
    },
    { staleMs: 6e5 }
  );
}
async function markRequested(db, items) {
  if (items.length === 0) return;
  try {
    const demandes = await requestedIds(db);
    if (demandes.size === 0) return;
    for (const item of items) {
      if (demandes.has(`${item.mediaType}:${item.tmdbId}`)) {
        item.requestStatus = item.requestStatus ?? "processing";
      }
    }
  } catch {
  }
}

// server/calendar-service.ts
var GLOBAL_MAX_PER_SERIES = 2;
function sliceStore(store2, from, to) {
  const out = [];
  for (const it of store2.items) {
    if (it.date < from || it.date > to) continue;
    out.push({ ...it });
  }
  return out;
}
async function buildGlobalFromStore(db, cfg, opts, warn) {
  const store2 = await getCalendarStore(db, cfg, opts.region, warn);
  const from = opts.from < store2.from ? store2.from : opts.from;
  const to = opts.to > store2.to ? store2.to : opts.to;
  let items = from <= to ? sliceStore(store2, from, to) : [];
  if (opts.mediaType !== "both") {
    items = items.filter((i) => i.mediaType === opts.mediaType);
  }
  if (opts.providerIds.length > 0) {
    items = items.filter((i) => i.providerIds.some((id) => opts.providerIds.includes(id)));
  }
  items = capPerSeriesFuture(sortCalendarItems(items), GLOBAL_MAX_PER_SERIES, todayString());
  await markRequested(db, items);
  return { from: opts.from, to: opts.to, items, partial: store2.partial };
}

// server/calendar-personal-store.ts
var PERSONAL_MAX_PER_SERIES = 3;
async function buildPersonalFromStore(db, cfg, rows, opts, warn) {
  const region = opts.region ?? DEFAULT_REGION;
  const store2 = await getCalendarStore(db, cfg, region, warn);
  if (opts.from < store2.from || opts.to > store2.to) {
    const res = await buildPersonalCalendar(db, cfg, rows, opts);
    return attachAirTimes(cfg, res);
  }
  const { refs, statusByKey } = collectRequestRefs(rows, opts.includeSettled ?? false);
  const slice = sliceStore(store2, opts.from, opts.to).filter(
    (it) => refs.has(`${it.mediaType}:${it.tmdbId}`)
  );
  for (const it of slice) {
    const ctx = statusByKey.get(`${it.mediaType}:${it.tmdbId}`);
    if (ctx) {
      it.requestId = ctx.requestId;
      it.requestStatus = ctx.status;
    }
  }
  const covered2 = new Set(slice.map((it) => `${it.mediaType}:${it.tmdbId}`));
  const residual = new Set([...refs.keys()].filter((k) => !covered2.has(k)));
  let residualItems = [];
  let residualPartial = false;
  if (residual.size > 0) {
    const res = await buildPersonalCalendar(db, cfg, rowsSubset(rows, residual), opts);
    const timed = await attachAirTimes(cfg, res);
    residualItems = timed.items;
    residualPartial = timed.partial;
  }
  const items = capPerSeriesFuture(
    sortCalendarItems([...slice, ...residualItems]),
    PERSONAL_MAX_PER_SERIES,
    todayString()
  );
  return {
    from: opts.from,
    to: opts.to,
    items,
    partial: store2.partial || residualPartial
  };
}
function rowsSubset(rows, keep) {
  return {
    ...rows,
    seerrRows: rows.seerrRows.filter(
      (sr) => sr.media?.tmdbId && keep.has(`${sr.media.mediaType}:${sr.media.tmdbId}`)
    ),
    localOnly: rows.localOnly.filter(
      (l) => l.tmdbId && keep.has(`${l.mediaType}:${l.tmdbId}`)
    )
  };
}

// server/search/status-map.ts
var MEDIA_STATUS = {
  UNKNOWN: 1,
  PENDING: 2,
  PROCESSING: 3,
  PARTIALLY_AVAILABLE: 4,
  AVAILABLE: 5,
  BLOCKLISTED: 6,
  DELETED: 7
};
var PAGE_SIZE2 = 100;
var INCREMENTAL_EVERY_MS = 6e4;
var FULL_EVERY_MS2 = 6 * 36e5;
var FULL_CONCURRENCY = 3;
var statuses = /* @__PURE__ */ new Map();
var lastFull = 0;
var lastIncremental = 0;
var newestSeen = "";
var running = null;
var retryAfter = 0;
var RETRY_MS = 6e4;
function statusOf(mediaType, tmdbId) {
  return statuses.get(`${mediaType}:${tmdbId}`);
}
function noteStatus(mediaType, tmdbId, status) {
  if (typeof status === "number" && status > 0) statuses.set(`${mediaType}:${tmdbId}`, status);
}
function statusMapReady() {
  return lastFull > 0;
}
function statusMapStale() {
  lastIncremental = 0;
}
async function fetchPage2(cfg, skip, take = PAGE_SIZE2) {
  const res = await fetch(
    `${cfg.seerrUrl}/api/v1/media?take=${take}&skip=${skip}&filter=all&sort=modified`,
    { headers: { "X-Api-Key": cfg.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
  );
  if (!res.ok) throw new Error(`GET /media ${res.status}`);
  return await res.json();
}
function absorb(rows, into) {
  for (const row of rows ?? []) {
    if (typeof row.tmdbId !== "number" || row.mediaType !== "movie" && row.mediaType !== "tv") continue;
    if (typeof row.status === "number") into.set(`${row.mediaType}:${row.tmdbId}`, row.status);
    if (row.updatedAt && row.updatedAt > newestSeen) newestSeen = row.updatedAt;
  }
}
async function fullReload(cfg) {
  const first = await fetchPage2(cfg, 0);
  const fresh = /* @__PURE__ */ new Map();
  absorb(first.results, fresh);
  const total = first.pageInfo?.results ?? 0;
  const skips = [];
  for (let skip = PAGE_SIZE2; skip < total; skip += PAGE_SIZE2) skips.push(skip);
  const pages = await mapLimit(skips, FULL_CONCURRENCY, (skip) => fetchPage2(cfg, skip));
  for (const page of pages) absorb(page?.results, fresh);
  statuses.clear();
  for (const [k, v] of fresh) statuses.set(k, v);
  lastFull = Date.now();
  lastIncremental = lastFull;
}
async function incremental(cfg) {
  const since = newestSeen;
  const page = await fetchPage2(cfg, 0, 50);
  absorb(page.results, statuses);
  lastIncremental = Date.now();
  const rows = page.results ?? [];
  if (rows.length === 50 && rows.every((r) => (r.updatedAt ?? "") > since)) lastFull = 0;
}
function refreshStatusMap(cfg) {
  if (running) return;
  const now = Date.now();
  if (now < retryAfter) return;
  const needFull = now - lastFull > FULL_EVERY_MS2;
  if (!needFull && now - lastIncremental < INCREMENTAL_EVERY_MS) return;
  running = (needFull ? fullReload(cfg) : incremental(cfg)).catch((err) => {
    console.warn(`[Vigie] Statuts des m\xE9dias indisponibles : ${err instanceof Error ? err.message : err}`);
    retryAfter = Date.now() + RETRY_MS;
  }).finally(() => {
    running = null;
  });
}

// server/item-states.ts
function mediaStatusOf(mediaType, tmdbId) {
  return correctedStatus(mediaType, tmdbId, statusOf(mediaType, tmdbId));
}
function withoutDeletedFile(fact, tmdbId, season) {
  if (!fact?.hasFile || season == null) return fact;
  return goneFromJellyfin("tv", tmdbId) || goneSeasonsOf(tmdbId).has(season) ? { ...fact, hasFile: false } : fact;
}
var NO_FACTS = { byEpisode: /* @__PURE__ */ new Map(), byDay: /* @__PURE__ */ new Map() };
var NO_QUEUE = { episodes: /* @__PURE__ */ new Map(), movies: /* @__PURE__ */ new Map() };
function merge(prev, next) {
  if (!prev) return { stalled: next.stalled, percent: next.percent, validating: next.validating };
  return { stalled: prev.stalled && next.stalled, percent: prev.percent ?? next.percent, validating: prev.validating && next.validating };
}
function indexQueue(entries) {
  const index = { episodes: /* @__PURE__ */ new Map(), movies: /* @__PURE__ */ new Map() };
  for (const e of entries) {
    if (e.tmdbId == null) continue;
    if (e.source === "radarr") {
      index.movies.set(e.tmdbId, merge(index.movies.get(e.tmdbId), e));
    } else if (e.seasonNumber != null && e.episodeNumber != null) {
      const key = episodeKey(e.tmdbId, e.seasonNumber, e.episodeNumber);
      index.episodes.set(key, merge(index.episodes.get(key), e));
    }
  }
  return index;
}
var WAITING2 = /* @__PURE__ */ new Set([
  "queued",
  "processing",
  "sent_to_seer",
  "approved",
  "unavailable",
  "retry_pending",
  "downloading",
  "partially_available"
]);
function fromQueue(q) {
  if (!q) return null;
  return q.stalled ? "stalled" : q.validating ? "importing" : "downloading";
}
function fromRequest(status, seriesLevel = false) {
  if (!status || !WAITING2.has(status)) return null;
  return seriesLevel && status === "partially_available" ? "partial" : "requested";
}
function episodeState(fact, queued2, fallback) {
  if (fact?.hasFile) return "available";
  const inQueue = fromQueue(queued2);
  if (inQueue) return inQueue;
  if (fact) return fact.monitored ? "requested" : null;
  return fallback;
}
function movieState(mediaStatus, queued2, fallback) {
  if (mediaStatus === 5) return "available";
  const inQueue = fromQueue(queued2);
  if (inQueue) return inQueue;
  if (mediaStatus === 2 || mediaStatus === 3) return "requested";
  return fallback;
}
function stateOfItem(item, facts, queue, today) {
  const request = fromRequest(item.requestStatus);
  if (item.mediaType === "movie") {
    const queued3 = queue.movies.get(item.tmdbId);
    const state3 = movieState(mediaStatusOf("movie", item.tmdbId), queued3, request);
    return { state: state3, percent: state3 === "downloading" ? queued3?.percent ?? null : null };
  }
  const media = mediaStatusOf("tv", item.tmdbId);
  const fallback = media === 5 ? item.date <= today ? "available" : null : media === 2 || media === 3 ? "requested" : request;
  if (item.kind !== "episode" || item.seasonNumber == null || item.episodeNumber == null) {
    const series = media === 4 ? "partial" : fallback === "requested" ? fromRequest(item.requestStatus, true) ?? fallback : fallback;
    return { state: series, percent: null };
  }
  const key = episodeKey(item.tmdbId, item.seasonNumber, item.episodeNumber);
  let fact = facts.byEpisode.get(key);
  if (!fact) {
    const sameDay = facts.byDay.get(`${item.tmdbId}:${item.date}`);
    if (sameDay?.length === 1) fact = sameDay[0];
  }
  fact = withoutDeletedFile(fact, item.tmdbId, item.seasonNumber);
  const queued2 = queue.episodes.get(key);
  const state2 = episodeState(fact, queued2, fallback);
  return { state: state2, percent: state2 === "downloading" ? queued2?.percent ?? null : null };
}
async function attachItemStates(cfg, res, today) {
  if (res.items.length === 0) return res;
  const hasEpisodes = res.items.some((i) => i.kind === "episode");
  const [facts, queue] = await Promise.all([
    hasEpisodes ? sonarrWindowFacts(cfg, addDays(res.from, -1), addDays(res.to, 1)).catch(() => NO_FACTS) : Promise.resolve(NO_FACTS),
    queueSnapshot(cfg).then((s) => indexQueue(s.items)).catch(() => NO_QUEUE)
  ]);
  return {
    ...res,
    items: res.items.map((item) => ({ ...item, ...stateOfItem(item, facts, queue, today) }))
  };
}
async function seriesEpisodeStates(cfg, tmdbId) {
  const [facts, queue] = await Promise.all([
    sonarrSeriesFacts(cfg, tmdbId),
    queueSnapshot(cfg).then((s) => indexQueue(s.items)).catch(() => NO_QUEUE)
  ]);
  const states = {};
  const percents = {};
  const byDay = /* @__PURE__ */ new Map();
  const seasons = /* @__PURE__ */ new Set();
  for (const [key, raw] of facts) {
    const season = Number(/^S(\d+)E/.exec(key)?.[1]);
    const fact = withoutDeletedFile(raw, tmdbId, season) ?? raw;
    const queued2 = queue.episodes.get(`${tmdbId}:${key}`);
    const state2 = episodeState(fact, queued2, null);
    if (state2) states[key] = state2;
    if (state2 === "downloading" && queued2?.percent != null) percents[key] = Math.round(queued2.percent);
    if (fact.airDate) byDay.set(fact.airDate, [...byDay.get(fact.airDate) ?? [], key]);
    if (season > 0) seasons.add(season);
  }
  const dates = {};
  for (const [day, keys2] of byDay) if (keys2.length === 1) dates[day] = keys2[0];
  return { tracked: facts.size > 0, states, percents, dates, seasons: [...seasons].sort((a, b) => a - b) };
}

// server/routes-calendar.ts
var PERSONAL_TTL_MS = 15 * 6e4;
var PERSONAL_STALE_MS = 6 * 36e5;
var PARTIAL_TTL_MS = 1e4;
var EVERYONE_FETCH_BUDGET = 60;
var MAX_PROVIDERS = 8;
var DEFAULT_WINDOW_DAYS = 90;
var MAX_WINDOW_DAYS = 370;
function readWindow(q) {
  const today = todayString();
  const from = isDayString(q.from) ? q.from : today;
  const fallback = addDays(from, DEFAULT_WINDOW_DAYS);
  const to = isDayString(q.to) ? q.to : fallback;
  const hardMax = addDays(from, MAX_WINDOW_DAYS);
  return { from, to: to > hardMax ? hardMax : to < from ? from : to };
}
function readRegion(q) {
  return typeof q.region === "string" && /^[a-z]{2}$/i.test(q.region) ? q.region.toUpperCase() : DEFAULT_REGION;
}
var EMPTY = (from, to) => ({ from, to, items: [], partial: false });
function registerCalendarRoutes(app, db, getWorkerConfig2) {
  const warn = (err, msg) => app.log?.warn?.({ err }, msg);
  const stopMaintenance = initCalendarStoreMaintenance(db, getWorkerConfig2, warn);
  app.addHook("onClose", async () => stopMaintenance());
  app.get("/calendar/personal", async (request) => {
    const user = getUser(request);
    const q = request.query;
    const { from, to } = readWindow(q);
    const includeSettled = q.all === "1";
    const everyone = q.everyone === "1";
    const region = readRegion(q);
    const config = await getWorkerConfig2();
    if (!config) return EMPTY(from, to);
    const key = everyone ? `seer:cal:everyone:${region}:${from}:${to}:${includeSettled ? "all" : "up"}` : `seer-cache:${user.userId}:cal:${region}:${from}:${to}:${includeSettled ? "all" : "up"}`;
    const res = await cached(
      key,
      PERSONAL_TTL_MS,
      async () => {
        const rows = everyone ? await loadEveryoneRows(db, config, warn) : await cached(
          rowsCacheKey(user.userId),
          6e4,
          () => buildMergedRows(db, config, user, warn),
          { staleMs: 6e5 }
        );
        return buildPersonalFromStore(db, config, rows, {
          from,
          to,
          includeSettled,
          region,
          maxFetch: everyone ? EVERYONE_FETCH_BUDGET : void 0
        }, warn);
      },
      {
        staleMs: PERSONAL_STALE_MS,
        ttlFor: (value) => value.partial ? PARTIAL_TTL_MS : PERSONAL_TTL_MS
      }
    );
    return attachItemStates(config, res, todayString());
  });
  app.get("/calendar/global", async (request) => {
    const q = request.query;
    const { from, to } = readWindow(q);
    const config = await getWorkerConfig2();
    if (!config) return EMPTY(from, to);
    const providerIds = String(q.providerIds ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, MAX_PROVIDERS);
    const mediaType = q.mediaType === "movie" || q.mediaType === "tv" ? q.mediaType : "both";
    const res = await buildGlobalFromStore(db, config, {
      providerIds,
      mediaType,
      region: readRegion(q),
      from,
      to
    }, warn);
    return attachItemStates(config, res, todayString());
  });
  app.get("/calendar/airtimes", async (request) => {
    const q = request.query;
    const tmdbId = Number(q.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) return { times: {} };
    const config = await getWorkerConfig2();
    if (!config) return { times: {} };
    try {
      const times = await sonarrSeriesAirTimes(config, tmdbId);
      return { times: Object.fromEntries(times) };
    } catch {
      return { times: {} };
    }
  });
  app.get("/episodes/states", async (request) => {
    const tmdbId = Number(request.query.tmdbId);
    const empty = { tracked: false, states: {}, percents: {}, dates: {}, seasons: [] };
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) return empty;
    const config = await getWorkerConfig2();
    if (!config) return empty;
    try {
      return await seriesEpisodeStates(config, tmdbId);
    } catch {
      return empty;
    }
  });
  app.get("/calendar/providers", async (request) => {
    const q = request.query;
    const config = await getWorkerConfig2();
    if (!config) return { results: [] };
    const region = readRegion(q);
    try {
      return await cached(`seer:providers:all:${region}`, 24 * 36e5, async () => {
        const merged = /* @__PURE__ */ new Map();
        let pannes = 0;
        for (const path of ["tv", "movies"]) {
          try {
            const res = await fetch(
              `${config.seerrUrl}/api/v1/watchproviders/${path}?watchRegion=${region}`,
              { headers: { "X-Api-Key": config.seerrApiKey }, signal: AbortSignal.timeout(1e4) }
            );
            if (!res.ok) throw new Error(`watchproviders/${path} \u2192 ${res.status}`);
            const data = await res.json();
            for (const p of Array.isArray(data) ? data : []) {
              if (typeof p.id !== "number" || !p.name || merged.has(p.id)) continue;
              merged.set(p.id, { id: p.id, name: p.name, logoPath: p.logoPath ?? null });
            }
          } catch {
            pannes++;
          }
        }
        if (pannes === 2) throw new Error("watchproviders : aucun catalogue ne r\xE9pond");
        return { results: Array.from(merged.values()) };
      });
    } catch {
      return { results: [] };
    }
  });
}

// server/user-marks.ts
var MARK_LIBRARY = 1;
var MARK_WATCHED = 2;
var MARK_WATCHLIST = 4;
var MARK_LIKED = 8;
function vigieType(type) {
  if (type === "Movie" || type === "movie") return "movie";
  if (type === "Series" || type === "series" || type === "tv") return "tv";
  return null;
}
function tmdbOf(ids) {
  if (!ids) return null;
  for (const [key, value] of Object.entries(ids)) {
    if (key.toLowerCase() !== "tmdb" || !value) continue;
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}
function buildMarks(library, likes, ratings) {
  const byKey = /* @__PURE__ */ new Map();
  const entry = (type, id) => {
    const key = `${type}:${id}`;
    let found = byKey.get(key);
    if (!found) {
      found = [type, id, 0, 0];
      byKey.set(key, found);
    }
    return found;
  };
  for (const item of library) {
    const type = vigieType(item.Type);
    const id = tmdbOf(item.ProviderIds);
    if (!type || id === null) continue;
    const e = entry(type, id);
    let bits = MARK_LIBRARY;
    if (item.UserData?.Played) bits |= MARK_WATCHED;
    if (item.UserData?.Likes === true) bits |= MARK_WATCHLIST;
    if (item.UserData?.IsFavorite) bits |= MARK_LIKED;
    e[2] |= bits;
  }
  for (const like of likes) {
    const type = vigieType(like.mediaType);
    if (type && like.tmdbId > 0) entry(type, like.tmdbId)[2] |= MARK_LIKED;
  }
  for (const rating of ratings) {
    const type = vigieType(rating.mediaType);
    const score2 = Math.round(rating.score);
    if (type && rating.tmdbId > 0 && score2 >= 1 && score2 <= 10) entry(type, rating.tmdbId)[3] = score2;
  }
  return [...byKey.values()].filter((e) => e[2] !== 0 || e[3] !== 0);
}
var TTL_MS = 6e4;
async function fetchLibrary(db, userId) {
  const creds = await jellyfinCredentials(db);
  if (!creds) return [];
  const params = new URLSearchParams({
    Recursive: "true",
    IncludeItemTypes: "Movie,Series",
    Fields: "ProviderIds",
    HasTmdbId: "true",
    EnableImages: "false",
    EnableUserData: "true"
  });
  const res = await fetch(`${creds.url}/Users/${encodeURIComponent(userId)}/Items?${params}`, {
    headers: jellyfinAuthHeaders(creds.apiKey),
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) throw new Error(`Jellyfin GET /Users/{id}/Items a r\xE9pondu ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.Items) ? data.Items : [];
}
async function readRows(db, sql, userId) {
  try {
    return await db.query(sql, userId);
  } catch {
    return [];
  }
}
async function userMarks(db, userId) {
  return cached(`vigie:marks:${userId}`, TTL_MS, async () => {
    const [library, likes, ratings] = await Promise.all([
      fetchLibrary(db, userId).catch(() => []),
      readRows(
        db,
        "SELECT mediaType, tmdbId FROM user_likes WHERE jellyfinUserId = ?",
        userId
      ),
      // La note d'un TITRE, pas d'un épisode ; une note en cours de retrait n'en est plus une.
      readRows(
        db,
        "SELECT mediaType, tmdbId, score FROM user_ratings WHERE jellyfinUserId = ? AND deletedAt IS NULL AND seasonNumber = 0 AND episodeNumber = 0",
        userId
      )
    ]);
    const num5 = (v) => Number(v);
    return {
      items: buildMarks(
        library,
        likes.map((l) => ({ mediaType: l.mediaType, tmdbId: num5(l.tmdbId) })),
        ratings.map((r) => ({ mediaType: r.mediaType, tmdbId: num5(r.tmdbId), score: num5(r.score) }))
      )
    };
  });
}

// server/routes-misc.ts
function registerMiscRoutes(app, db, getWorkerConfig2, requireAdmin) {
  app.get("/marks", async (request) => {
    const userId = getUser(request).userId;
    if (request.query.fresh === "1") invalidate(`vigie:marks:${userId}`);
    return userMarks(db, userId);
  });
  const providerCache = /* @__PURE__ */ new Map();
  app.post("/check-providers", async (request, reply) => {
    const body = request.body;
    if (!body.items || !Array.isArray(body.items)) return reply.status(400).send({ message: "items array required" });
    const config = await getWorkerConfig2();
    if (!config) return reply.status(503).send({ message: "Seerr not configured" });
    const seerrUrl2 = config.seerrUrl;
    const apiKey = config.seerrApiKey;
    const result = {};
    const toFetch = [];
    for (const item of body.items.slice(0, 200)) {
      const key = `${item.mediaType}-${item.tmdbId}`;
      const cached3 = providerCache.get(key);
      if (cached3 && Date.now() < cached3.expires) {
        result[item.tmdbId] = cached3.providers;
      } else {
        toFetch.push(item);
      }
    }
    const BATCH2 = 5;
    for (let i = 0; i < toFetch.length; i += BATCH2) {
      const batch = toFetch.slice(i, i + BATCH2);
      const responses = await Promise.allSettled(
        batch.map(async (item) => {
          const res = await fetch(`${seerrUrl2}/api/v1/${item.mediaType}/${item.tmdbId}`, {
            headers: { "X-Api-Key": apiKey },
            signal: AbortSignal.timeout(8e3)
          });
          if (!res.ok) return { tmdbId: item.tmdbId, mediaType: item.mediaType, providers: [] };
          const data = await res.json();
          const region = data.watchProviders?.find((w) => w.iso_3166_1 === "FR") ?? data.watchProviders?.find((w) => w.iso_3166_1 === "US");
          const ids = region?.flatrate?.map((p) => p.id ?? p.providerId ?? 0).filter(Boolean) ?? [];
          return { tmdbId: item.tmdbId, mediaType: item.mediaType, providers: ids };
        })
      );
      for (const r of responses) {
        if (r.status === "fulfilled" && r.value) {
          const { tmdbId, mediaType, providers } = r.value;
          result[tmdbId] = providers;
          providerCache.set(`${mediaType}-${tmdbId}`, { providers, expires: Date.now() + 7 * 864e5 });
        }
      }
    }
    return result;
  });
  app.get("/queue/status", async (request) => {
    const user = request.user;
    const status = await getQueueStatus(db, user.isAdmin ? void 0 : user.userId);
    return { ...status, workerRunning: isWorkerRunning() };
  });
  app.get("/stats", async (request) => {
    const user = request.user;
    if (user.isAdmin) {
      const [personal, global] = await Promise.all([getUserStats(db, user.userId), getGlobalStats(db)]);
      return { personal, global };
    }
    return { personal: await getUserStats(db, user.userId) };
  });
  app.post("/worker/trigger", { preHandler: requireAdmin }, async () => {
    const config = await getWorkerConfig2();
    if (!config) return { message: "Seerr not configured" };
    const next = await getQueueStatus(db);
    return { workerRunning: isWorkerRunning(), processing: next.processing, queued: next.queued, triggered: true };
  });
}

// server/routes-proxy.ts
import { Readable } from "stream";

// server/proxy-allowlist.ts
var READABLE = [
  /^api\/v1\/discover\/(movies|tv)(\/[\w-]+)*$/,
  /^api\/v1\/discover\/trending$/,
  /^api\/v1\/search$/,
  /^api\/v1\/(movie|tv)\/\d+(\/similar)?$/,
  /^api\/v1\/tv\/\d+\/season\/\d+$/,
  /^api\/v1\/person\/\d+(\/combined_credits)?$/,
  /^api\/v1\/collection\/\d+$/
];
function isReadableSeerrPath(method, path) {
  return (method === "GET" || method === "HEAD") && READABLE.some((re) => re.test(path));
}

// server/live/media-info.ts
function requestFacts(info) {
  if (!info || !Array.isArray(info.requests)) return void 0;
  return info.requests.filter((r) => typeof r?.status === "number").map((r) => ({
    status: r.status,
    is4k: r.is4k === true,
    seasons: (r.seasons ?? []).map((s) => s?.seasonNumber).filter((n) => typeof n === "number")
  }));
}
function correctMediaInfo(mediaType, tmdbId, info) {
  const source = info ?? void 0;
  const facts = factsFor(mediaType, tmdbId, {
    requests: requestFacts(source),
    downloading: Array.isArray(source?.downloadStatus) && source.downloadStatus.length > 0
  });
  const status = correctMediaStatus(mediaType, source?.status, facts);
  let seasons = source?.seasons;
  if (mediaType === "tv" && Array.isArray(seasons)) {
    let touched = false;
    const next = seasons.map((s) => {
      if (typeof s?.seasonNumber !== "number") return s;
      const corrected = correctSeasonStatus(s.seasonNumber, s.status, facts);
      if (corrected === s.status) return s;
      touched = true;
      return { ...s, status: corrected };
    });
    if (touched) seasons = next;
  }
  const gone = facts.library.state === "gone";
  const dropItem = gone && source?.jellyfinMediaId != null;
  if (status === source?.status && seasons === source?.seasons && !dropItem) return source;
  if (!source) return status === void 0 ? void 0 : { status };
  return {
    ...source,
    status,
    ...seasons !== source.seasons ? { seasons } : {},
    ...dropItem ? { jellyfinMediaId: null } : {}
  };
}
function withCorrectedInfo(mediaType, tmdbId, detail) {
  const info = correctMediaInfo(mediaType, tmdbId, detail.mediaInfo ?? void 0);
  return info === detail.mediaInfo ? detail : { ...detail, mediaInfo: info };
}
function correctListItem(item, fallbackType) {
  const type = item?.mediaType === "movie" || item?.mediaType === "tv" ? item.mediaType : fallbackType;
  const id = Number(item?.id);
  if (!type || !Number.isSafeInteger(id) || id <= 0) return item;
  const info = correctMediaInfo(type, id, item.mediaInfo);
  return info === item.mediaInfo ? item : { ...item, mediaInfo: info };
}

// server/live/catalog-correct.ts
var DETAIL = /^api\/v1\/(movie|tv)\/(\d+)$/;
var SIMILAR = /^api\/v1\/(movie|tv)\/\d+\/similar$/;
var DISCOVER = /^api\/v1\/discover\/(movies|tv)(\/|$)/;
function carriesTitles(path) {
  return DETAIL.test(path) || SIMILAR.test(path) || DISCOVER.test(path) || /^api\/v1\/discover\/trending$/.test(path) || /^api\/v1\/search$/.test(path) || /^api\/v1\/collection\/\d+$/.test(path) || /^api\/v1\/person\/\d+\/combined_credits$/.test(path);
}
function mapList(list, fallback) {
  if (!Array.isArray(list)) return { list, changed: false };
  let changed = false;
  const next = list.map((item) => {
    if (!item || typeof item !== "object") return item;
    const fixed = correctListItem(item, fallback);
    if (fixed !== item) changed = true;
    return fixed;
  });
  return { list: changed ? next : list, changed };
}
function correctCatalog(path, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const page = data;
  const detail = DETAIL.exec(path);
  if (detail) {
    const type = detail[1];
    const info = correctMediaInfo(type, Number(detail[2]), page.mediaInfo);
    return info === page.mediaInfo ? data : { ...page, mediaInfo: info };
  }
  const similar = SIMILAR.exec(path);
  const discover2 = DISCOVER.exec(path);
  const fallback = similar ? similar[1] : discover2 ? discover2[1] === "movies" ? "movie" : "tv" : void 0;
  const out = { ...page };
  let changed = false;
  for (const [field, type] of [["results", fallback], ["parts", "movie"], ["cast", void 0], ["crew", void 0]]) {
    const r = mapList(page[field], type);
    if (r.changed) {
      out[field] = r.list;
      changed = true;
    }
  }
  return changed ? out : data;
}

// server/routes-proxy.ts
var PROXY_TTL_MS = 5 * 6e4;
function registerProxyRoutes(app, getConfig) {
  app.get("/seerr/*", async (request, reply) => {
    const wildcard = request.params["*"];
    if (!wildcard || !isReadableSeerrPath(request.method, wildcard)) {
      return reply.status(403).send({ message: "Only catalogue reads are proxied" });
    }
    const config = getConfig();
    const seerrUrl2 = config.url?.replace(/\/$/, "");
    const apiKey = config.apiKey;
    if (!seerrUrl2 || !apiKey) return reply.status(503).send({ message: "Seerr not configured" });
    const query = request.query;
    const isDiscoverMovies = /^api\/v1\/discover\/movies(\/|$)/.test(wildcard);
    const isDiscoverTv = /^api\/v1\/discover\/tv(\/|$)/.test(wildcard);
    const isDiscover = isDiscoverMovies || isDiscoverTv;
    const isSearchLike = /^api\/v1\/discover\/trending/.test(wildcard) || /^api\/v1\/search/.test(wildcard);
    const isFilterable = isDiscover || isSearchLike;
    const showBlocked = query._showBlocked === "1" || query._showBlocked === "true";
    const blocklistedTags = isFilterable && request.method === "GET" ? await getBlocklistedTags(seerrUrl2, apiKey) : "";
    const blockedSet = parseTagSet(blocklistedTags);
    const blockedActive = blockedSet.size > 0;
    const qsParts = [];
    let hasExcludeKeywords = false;
    for (const [k, v] of Object.entries(query)) {
      if (k === "_lang" || k === "_showBlocked") continue;
      if (k === "excludeKeywords") hasExcludeKeywords = true;
      qsParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    if (isDiscover && blockedActive && !showBlocked && !hasExcludeKeywords) {
      qsParts.push(`excludeKeywords=${encodeURIComponent(blocklistedTags)}`);
    }
    const qs = qsParts.join("&");
    const targetUrl = `${seerrUrl2}/${wildcard}${qs ? `?${qs}` : ""}`;
    const headers = { "X-Api-Key": apiKey };
    if (query._lang) headers["Accept-Language"] = query._lang;
    const cacheable = request.method === "GET" && isFilterable;
    const cacheKey = cacheable ? `seer:proxy:${targetUrl}:${headers["Accept-Language"] ?? ""}` : null;
    if (cacheKey) {
      const hit = peek(cacheKey);
      if (hit) {
        reply.header("content-type", "application/json");
        return reply.send(correctCatalog(wildcard, hit));
      }
    }
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        signal: AbortSignal.timeout(15e3)
      });
      const ct = response.headers.get("content-type");
      const shouldHandleJson = isFilterable && blockedActive && response.ok && (ct ?? "").includes("application/json");
      if (shouldHandleJson) {
        const data = await response.json().catch(() => null);
        if (data && Array.isArray(data.results)) {
          if (showBlocked) {
            const { blockedCount } = await filterResultsByTags(
              seerrUrl2,
              apiKey,
              isDiscover ? [] : data.results,
              // discover déjà non-filtré ici → compteur via search-like
              blockedSet
            );
            data.blockedCount = isDiscover ? 0 : blockedCount;
          } else if (isSearchLike) {
            const { kept, blockedCount } = await filterResultsByTags(
              seerrUrl2,
              apiKey,
              data.results,
              blockedSet
            );
            data.results = kept;
            data.blockedCount = blockedCount;
          } else {
            const before = data.results.length;
            data.results = data.results.filter(
              (item) => item?.mediaInfo?.status !== MEDIA_STATUS_BLOCKLISTED
            );
            data.blockedCount = before - data.results.length;
          }
          data.blockedActive = blockedActive;
        }
        if (cacheKey && response.ok && data) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ? correctCatalog(wildcard, data) : {});
      }
      const json = (ct ?? "").includes("application/json");
      if (response.ok && json && (cacheKey || carriesTitles(wildcard))) {
        const data = await response.json().catch(() => null);
        if (data && cacheKey) put(cacheKey, data, PROXY_TTL_MS);
        reply.status(response.status);
        reply.header("content-type", "application/json");
        return reply.send(data ? correctCatalog(wildcard, data) : {});
      }
      reply.status(response.status);
      if (ct) reply.header("content-type", ct);
      if (!response.body) return reply.send();
      return reply.send(Readable.fromWeb(response.body));
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return reply.status(504).send({ message: "Seerr timeout" });
      }
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy failed" });
    }
  });
}

// server/search/fold.ts
var LIGATURES = {
  "\u0153": "oe",
  "\xE6": "ae",
  "\xDF": "ss",
  "\xF8": "o",
  "\u0142": "l",
  "\u0111": "d"
};
function foldText(input) {
  return input.toLowerCase().replace(/[œæßøłđ]/g, (c) => LIGATURES[c] ?? c).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function tokenize(input) {
  const folded = foldText(input);
  return folded === "" ? [] : folded.split(" ");
}
var STOPWORDS = /* @__PURE__ */ new Set([
  "le",
  "la",
  "les",
  "l",
  "un",
  "une",
  "des",
  "du",
  "de",
  "d",
  "au",
  "aux",
  "et",
  "the",
  "a",
  "an",
  "of",
  "and",
  "in",
  "on"
]);
function significantTokens(tokens) {
  const kept = tokens.filter((t) => !STOPWORDS.has(t));
  return kept.length > 0 ? kept : [...tokens];
}
var ELIDED = /* @__PURE__ */ new Set(["d", "l", "j", "m", "n", "s", "t", "c", "qu"]);
function nameForms(folded) {
  const space = folded.indexOf(" ");
  if (space < 0 || !ELIDED.has(folded.slice(0, space))) return [folded];
  return [folded, folded.slice(0, space) + folded.slice(space + 1)];
}
function onlyThroughElision(names, tokens) {
  return names.some((name) => {
    const words2 = name.split(" ");
    for (let i = 1; i < words2.length - 1; i++) {
      if (ELIDED.has(words2[i]) && tokens.includes(words2[i] + words2[i + 1])) return true;
    }
    return false;
  });
}
function editDistance(a, b, max) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (la === 0 || lb === 0) return Math.max(la, lb) > max ? max + 1 : Math.max(la, lb);
  let before = new Array(lb + 1).fill(0);
  let previous = Array.from({ length: lb + 1 }, (_, j) => j);
  let current = new Array(lb + 1).fill(0);
  for (let i = 1; i <= la; i++) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    [before, previous, current] = [previous, current, before];
  }
  return previous[lb] > max ? max + 1 : previous[lb];
}

// server/search/query.ts
var MOVIE_HINTS = /* @__PURE__ */ new Set(["film", "films", "movie", "movies"]);
var TV_HINTS = /* @__PURE__ */ new Set(["serie", "series", "show", "shows", "tv", "feuilleton"]);
var ANIME_HINTS = /* @__PURE__ */ new Set(["anime", "animes", "manga", "mangas"]);
var SEASON_WORDS = /* @__PURE__ */ new Set(["saison", "season", "staffel", "temporada"]);
var SEASON_CODE = /^s\d{1,2}(e\d{1,3})?$/;
function yearOf(word, maxYear) {
  const m = /^\(?((?:19|20)\d\d)\)?$/.exec(word);
  if (!m) return null;
  const year = Number(m[1]);
  return year <= maxYear ? year : null;
}
function parseQuery(input, now = /* @__PURE__ */ new Date()) {
  const raw = input.replace(/\s+/g, " ").trim();
  const words2 = raw === "" ? [] : raw.split(" ");
  const maxYear = now.getFullYear() + 3;
  let year = null;
  let type = null;
  let anime = false;
  const inParens = words2.findIndex((w) => /^\(\d{4}\)$/.test(w) && yearOf(w, maxYear) !== null);
  if (inParens >= 0 && words2.length > 1) {
    year = yearOf(words2[inParens], maxYear);
    words2.splice(inParens, 1);
  }
  for (let changed = true; changed && words2.length > 1; ) {
    changed = false;
    const first = foldText(words2[0]);
    const last = foldText(words2[words2.length - 1]);
    const beforeLast = words2.length > 2 ? foldText(words2[words2.length - 2]) : "";
    if (type === null && (MOVIE_HINTS.has(last) || TV_HINTS.has(last))) {
      type = MOVIE_HINTS.has(last) ? "movie" : "tv";
      words2.pop();
    } else if (type === null && (MOVIE_HINTS.has(first) || TV_HINTS.has(first))) {
      type = MOVIE_HINTS.has(first) ? "movie" : "tv";
      words2.shift();
    } else if (!anime && (ANIME_HINTS.has(last) || ANIME_HINTS.has(first))) {
      anime = true;
      if (ANIME_HINTS.has(last)) words2.pop();
      else words2.shift();
    } else if (year === null && yearOf(words2[words2.length - 1], maxYear) !== null) {
      year = yearOf(words2.pop(), maxYear);
    } else if (SEASON_CODE.test(last)) {
      type = type ?? "tv";
      words2.pop();
    } else if (words2.length > 2 && SEASON_WORDS.has(beforeLast) && /^\d{1,2}$/.test(last)) {
      type = type ?? "tv";
      words2.splice(words2.length - 2, 2);
    } else {
      break;
    }
    changed = true;
  }
  const text2 = words2.join(" ");
  return { raw, text: text2, tokens: tokenize(text2), year, type, anime };
}

// server/search/title-index.ts
var MAX_ENTRIES = 6e4;
var MAX_PREFIX_TOKENS = 300;
var MIN_PREFIX = 2;
var DOMINANCE = 6;
function entryWeight(e) {
  return Math.log10(1 + e.voteCount) * 3 + Math.log10(1 + e.popularity);
}
function isAnimeOf(genreIds, originalLanguage) {
  return genreIds.includes(16) && (originalLanguage === "ja" || originalLanguage === "ko" || originalLanguage === "zh");
}
var TitleIndex = class {
  list = [];
  byKey = /* @__PURE__ */ new Map();
  postings = /* @__PURE__ */ new Map();
  vocabWeight = /* @__PURE__ */ new Map();
  sorted = [];
  byInitial = /* @__PURE__ */ new Map();
  dirty = false;
  size() {
    return this.list.length;
  }
  get(key) {
    const i = this.byKey.get(key);
    return i === void 0 ? void 0 : this.list[i];
  }
  /** Ajoute ou complète un titre. Les noms déjà connus restent : un titre ne s'oublie pas. */
  upsert(r) {
    if (!r.title && !r.originalTitle) return;
    const key = `${r.mediaType}:${r.tmdbId}`;
    let index = this.byKey.get(key);
    let entry;
    if (index === void 0) {
      if (this.list.length >= MAX_ENTRIES) return;
      entry = {
        key,
        mediaType: r.mediaType,
        tmdbId: r.tmdbId,
        titles: /* @__PURE__ */ new Map(),
        originalTitle: null,
        releaseDate: null,
        year: null,
        popularity: 0,
        voteCount: 0,
        voteAverage: 0,
        posterPath: null,
        backdropPath: null,
        originalLanguage: null,
        genreIds: [],
        isAnime: false,
        names: [],
        tokens: /* @__PURE__ */ new Set()
      };
      index = this.list.length;
      this.list.push(entry);
      this.byKey.set(key, index);
    } else {
      entry = this.list[index];
    }
    if (r.title) entry.titles.set(r.lang, r.title);
    entry.originalTitle = r.originalTitle ?? entry.originalTitle;
    entry.releaseDate = r.releaseDate ?? entry.releaseDate;
    entry.year = entry.releaseDate ? Number(entry.releaseDate.slice(0, 4)) || null : entry.year;
    entry.popularity = r.popularity || entry.popularity;
    entry.voteCount = r.voteCount || entry.voteCount;
    entry.voteAverage = r.voteAverage || entry.voteAverage;
    entry.posterPath = r.posterPath ?? entry.posterPath;
    entry.backdropPath = r.backdropPath ?? entry.backdropPath;
    entry.originalLanguage = r.originalLanguage ?? entry.originalLanguage;
    if (r.genreIds.length > 0) entry.genreIds = r.genreIds;
    entry.isAnime = isAnimeOf(entry.genreIds, entry.originalLanguage);
    const weight = entryWeight(entry);
    const forms = [r.title, r.originalTitle].flatMap((name) => name ? nameForms(foldText(name)) : []);
    for (const folded of forms) {
      if (folded === "" || entry.names.includes(folded)) continue;
      entry.names.push(folded);
      for (const token of folded.split(" ")) {
        if ((this.vocabWeight.get(token) ?? -1) < weight) this.vocabWeight.set(token, weight);
        if (entry.tokens.has(token)) continue;
        entry.tokens.add(token);
        const list = this.postings.get(token);
        if (list === void 0) {
          this.postings.set(token, [index]);
          this.dirty = true;
        } else {
          list.push(index);
        }
      }
    }
  }
  rebuild() {
    if (!this.dirty) return;
    this.sorted = [...this.postings.keys()].sort();
    this.byInitial = /* @__PURE__ */ new Map();
    for (const token of this.sorted) {
      const initial = token[0];
      const bucket = this.byInitial.get(initial);
      if (bucket) bucket.push(token);
      else this.byInitial.set(initial, [token]);
    }
    this.dirty = false;
  }
  /** Les mots du vocabulaire qui commencent par `prefix`, les plus porteurs d'abord. */
  complete(prefix) {
    this.rebuild();
    if (prefix.length < MIN_PREFIX) return this.postings.has(prefix) ? [prefix] : [];
    let lo = 0;
    let hi = this.sorted.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (this.sorted[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    const out = [];
    for (let i = lo; i < this.sorted.length && this.sorted[i].startsWith(prefix); i++) out.push(this.sorted[i]);
    if (out.length <= MAX_PREFIX_TOKENS) return out;
    return out.sort((a, b) => (this.vocabWeight.get(b) ?? 0) - (this.vocabWeight.get(a) ?? 0)).slice(0, MAX_PREFIX_TOKENS);
  }
  /**
   * Le mot connu le plus proche d'un mot inconnu — mêmes garde-fous que le
   * moteur de la bibliothèque, calibrés sur du bruit réel : cinq lettres au
   * moins, première lettre juste, une faute jusqu'à sept lettres, deux au-delà.
   * Un mot collé (« spiderman ») se décolle s'il se coupe en deux mots connus.
   */
  correctToken(token) {
    this.rebuild();
    if (this.postings.has(token) || token.length < 5 || /\d/.test(token)) return null;
    const max = token.length >= 8 ? 2 : 1;
    let best = null;
    let bestDistance = max + 1;
    let bestWeight = -1;
    for (const candidate of this.byInitial.get(token[0]) ?? []) {
      if (Math.abs(candidate.length - token.length) > max) continue;
      const d = editDistance(token, candidate, max);
      const w = this.vocabWeight.get(candidate) ?? 0;
      if (d < bestDistance || d === bestDistance && d <= max && w > bestWeight) {
        best = candidate;
        bestDistance = d;
        bestWeight = w;
      }
    }
    if (best !== null && bestDistance <= max) return best;
    for (let cut = 3; cut <= token.length - 3; cut++) {
      const left = token.slice(0, cut);
      const right = token.slice(cut);
      if (this.postings.has(left) && this.postings.has(right)) return `${left} ${right}`;
    }
    return null;
  }
  /**
   * Un mot CONNU, mais seulement par des titres obscurs, à une lettre d'un mot
   * cent fois plus porteur : c'est presque toujours une faute. « interstelar »
   * est le titre d'un film de 2014 à deux votes — celui qui le tape cherche
   * « Interstellar ». Sans ce garde-fou, il suffisait qu'une recherche fasse
   * entrer ce titre obscur dans l'index pour que la faute cesse d'être corrigée.
   * Le titre tapé reste trouvable : la recherche complète interroge aussi la
   * requête telle quelle, et « Rechercher quand même » la rétablit.
   */
  dominantNeighbor(token) {
    this.rebuild();
    if (token.length < 5 || /\d/.test(token)) return null;
    let best = null;
    let bestWeight = (this.vocabWeight.get(token) ?? 0) + DOMINANCE;
    for (const candidate of this.byInitial.get(token[0]) ?? []) {
      if (candidate === token || Math.abs(candidate.length - token.length) > 1) continue;
      const weight = this.vocabWeight.get(candidate) ?? 0;
      if (weight < bestWeight || editDistance(token, candidate, 1) > 1) continue;
      best = candidate;
      bestWeight = weight;
    }
    return best;
  }
  postingsOf(token, isLast) {
    const out = new Set(this.postings.get(token) ?? []);
    if (isLast) {
      for (const word of this.complete(token)) {
        for (const i of this.postings.get(word) ?? []) out.add(i);
      }
    }
    return out;
  }
  /**
   * Les titres dont les noms contiennent les mots de la requête — le dernier
   * pouvant être un début de mot. `allowFix` à faux : pas de correction.
   */
  lookup(tokens, limit = 200, allowFix = true) {
    const words2 = significantTokens(tokens);
    if (words2.length === 0) return { hits: [], corrected: null, replacements: [] };
    const direct = this.match(words2, limit);
    if (!allowFix) return { hits: direct, corrected: null, replacements: [] };
    const whole = direct.length > 0 && direct[0].matched === words2.length;
    const replacements = [];
    const fixed = words2.flatMap((word, i) => {
      let fix = null;
      if (this.postings.has(word)) fix = this.dominantNeighbor(word);
      else if (!whole && !(i === words2.length - 1 && this.complete(word).length > 0)) fix = this.correctToken(word);
      if (fix === null) return [word];
      replacements.push([word, fix]);
      return fix.split(" ");
    });
    if (replacements.length === 0) return { hits: direct, corrected: null, replacements: [] };
    const corrected = this.match(fixed, limit);
    if (corrected.length === 0 || corrected[0].matched < (direct[0]?.matched ?? 0)) {
      return { hits: direct, corrected: null, replacements: [] };
    }
    return { hits: corrected, corrected: fixed, replacements };
  }
  match(words2, limit) {
    const sets = words2.map((w, i) => this.postingsOf(w, i === words2.length - 1));
    const counts = /* @__PURE__ */ new Map();
    for (const set of sets) for (const i of set) counts.set(i, (counts.get(i) ?? 0) + 1);
    const hits = [];
    const need = words2.length === 1 ? 1 : Math.max(1, words2.length - 1);
    for (const [i, matched] of counts) if (matched >= need) hits.push({ entry: this.list[i], matched });
    hits.sort((a, b) => b.matched - a.matched || entryWeight(b.entry) - entryWeight(a.entry));
    return hits.slice(0, limit);
  }
  /** Tout l'index — pour la persistance. */
  entries() {
    return this.list;
  }
  /** Repartir de zéro (la liste de blocage a changé). */
  clear() {
    this.list = [];
    this.byKey = /* @__PURE__ */ new Map();
    this.postings = /* @__PURE__ */ new Map();
    this.vocabWeight = /* @__PURE__ */ new Map();
    this.sorted = [];
    this.byInitial = /* @__PURE__ */ new Map();
    this.dirty = false;
  }
};

// server/search/remote.ts
var TTL_MS2 = 10 * 6e4;
var STALE_MS = 60 * 6e4;
var str = (v) => typeof v === "string" && v !== "" ? v : null;
var num2 = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
function toRemoteMedia(r, rank = 0) {
  const mediaType = r.mediaType === "movie" || r.mediaType === "tv" ? r.mediaType : null;
  const id = num2(r.id);
  if (!mediaType || id <= 0) return null;
  const info = r.mediaInfo;
  return {
    mediaType,
    id,
    title: str(r.title) ?? str(r.name) ?? "",
    originalTitle: str(r.originalTitle) ?? str(r.originalName),
    releaseDate: str(r.releaseDate) ?? str(r.firstAirDate),
    posterPath: str(r.posterPath),
    backdropPath: str(r.backdropPath),
    overview: str(r.overview),
    voteAverage: num2(r.voteAverage),
    voteCount: num2(r.voteCount),
    popularity: num2(r.popularity),
    genreIds: Array.isArray(r.genreIds) ? r.genreIds.filter((g) => typeof g === "number") : [],
    originalLanguage: str(r.originalLanguage),
    status: typeof info?.status === "number" ? info.status : void 0,
    rank
  };
}
function toRemotePerson(r, rank) {
  const id = num2(r.id);
  const name = str(r.name);
  if (id <= 0 || !name) return null;
  const knownFor = Array.isArray(r.knownFor) ? r.knownFor.map((m) => toRemoteMedia(m)).filter((m) => m !== null) : [];
  return {
    id,
    name,
    profilePath: str(r.profilePath),
    popularity: num2(r.popularity),
    department: str(r.knownForDepartment),
    knownFor,
    rank
  };
}
async function fetchSearchPage(cfg, text2, page, lang) {
  const url = `${cfg.seerrUrl}/api/v1/search?query=${encodeURIComponent(text2)}&page=${page}&language=${encodeURIComponent(lang)}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang },
    signal: AbortSignal.timeout(8e3)
  });
  if (!res.ok) throw new Error(`Jellyseerr /search ${res.status}`);
  return await res.json();
}
async function remoteSearch(cfg, text2, page, lang, showBlocked, knownSafe = () => false) {
  const key = `vigie:remote:${lang}:${showBlocked ? 1 : 0}:${page}:${foldText(text2)}`;
  const result = await cached(key, TTL_MS2, async () => {
    const raw = await fetchSearchPage(cfg, text2, page, lang);
    const results = (Array.isArray(raw.results) ? raw.results : []).map((r, rank) => ({ r, rank }));
    const tags = await getBlocklistedTags(cfg.seerrUrl, cfg.seerrApiKey);
    const blocked = parseTagSet(tags);
    let kept = results;
    let blockedCount = 0;
    let masked = /* @__PURE__ */ new Set();
    if (blocked.size > 0) {
      const isSafe = ({ r }) => (r.mediaType === "movie" || r.mediaType === "tv") && typeof r.id === "number" && knownSafe(r.mediaType, r.id) && r.mediaInfo?.status !== 6;
      const unknown = results.filter((x) => !isSafe(x));
      const filtered = await filterResultsByTags(cfg.seerrUrl, cfg.seerrApiKey, unknown.map((x) => x.r), blocked);
      const survivors = new Set(filtered.kept);
      masked = new Set(unknown.filter((x) => !survivors.has(x.r)).map((x) => x.r));
      if (!showBlocked) kept = results.filter((x) => !masked.has(x.r));
      blockedCount = filtered.blockedCount;
    }
    const media = [];
    const people = [];
    for (const { r, rank } of kept) {
      if (r.mediaType === "person") {
        const person = toRemotePerson(r, rank);
        if (person) people.push(person);
      } else {
        const m = toRemoteMedia(r, rank);
        if (m) media.push(masked.has(r) ? { ...m, masked: true } : m);
      }
    }
    for (const m of media) noteStatus(m.mediaType, m.id, m.status);
    return { media, people, totalPages: num2(raw.totalPages), blockedCount, blockedActive: blocked.size > 0 };
  }, { staleMs: STALE_MS });
  return result;
}

// server/search/title-store.ts
var FLUSH_EVERY_MS = 3e4;
var FLUSH_AT = 400;
var BATCH = 200;
var pending = [];
var flushTimer = null;
function num3(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function rowToRecord(row) {
  return {
    mediaType: row.media_type === "tv" ? "tv" : "movie",
    tmdbId: num3(row.tmdb_id),
    lang: String(row.lang ?? "en"),
    title: String(row.title ?? ""),
    originalTitle: row.original_title ?? null,
    releaseDate: row.release_date ?? null,
    popularity: num3(row.popularity),
    voteCount: num3(row.vote_count),
    voteAverage: num3(row.vote_average),
    posterPath: row.poster_path ?? null,
    backdropPath: row.backdrop_path ?? null,
    originalLanguage: row.original_language ?? null,
    genreIds: String(row.genre_ids ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0)
  };
}
async function loadTitles(db, index) {
  const rows = await db.query(`SELECT * FROM seer_search_titles`);
  for (const row of rows) index.upsert(rowToRecord(row));
  return rows.length;
}
var TITLE_KEY = ["media_type", "tmdb_id", "lang"];
var TITLE_COLUMNS = [
  ...TITLE_KEY,
  "title",
  "original_title",
  "release_date",
  "popularity",
  "vote_count",
  "vote_average",
  "poster_path",
  "backdrop_path",
  "original_language",
  "genre_ids",
  "updated_at"
];
var TITLE_UPDATE = TITLE_COLUMNS.filter((c) => !TITLE_KEY.includes(c));
function round(n, digits) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
async function writeBatch(db, records) {
  for (const part of chunk(records, BATCH)) {
    const now = db.sql.dateParam(/* @__PURE__ */ new Date());
    const values = part.flatMap((r) => [
      r.mediaType,
      r.tmdbId,
      r.lang.slice(0, 8),
      r.title.slice(0, 500),
      r.originalTitle?.slice(0, 500) ?? null,
      r.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate) ? r.releaseDate : null,
      // Les arrondis que faisaient les colonnes DECIMAL(10,3) et DECIMAL(3,1) de MariaDB.
      round(Math.min(r.popularity, 9999999), 3),
      r.voteCount,
      round(Math.min(r.voteAverage, 10), 1),
      r.posterPath,
      r.backdropPath,
      r.originalLanguage?.slice(0, 10) ?? null,
      r.genreIds.join(",").slice(0, 120) || null,
      now
    ]);
    await db.execute(db.sql.upsert({ table: "seer_search_titles", columns: TITLE_COLUMNS, rows: part.length, conflict: TITLE_KEY, update: TITLE_UPDATE }), ...values);
  }
}
async function flushTitles(db) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pending.length === 0) return;
  const batch = pending;
  pending = [];
  try {
    await writeBatch(db, batch);
  } catch (err) {
    console.warn(`[Vigie] Index de recherche non enregistr\xE9 : ${err instanceof Error ? err.message : err}`);
  }
}
function queueTitles(db, records) {
  pending.push(...records);
  if (pending.length >= FLUSH_AT) {
    void flushTitles(db);
    return;
  }
  if (!flushTimer) flushTimer = setTimeout(() => {
    void flushTitles(db);
  }, FLUSH_EVERY_MS);
}
async function readMeta(db, key) {
  const rows = await db.query(
    `SELECT meta_value FROM seer_search_meta WHERE meta_key = ?`,
    key
  );
  return rows[0]?.meta_value ?? null;
}
async function writeMeta(db, key, value) {
  await db.execute(
    db.sql.upsert({
      table: "seer_search_meta",
      columns: ["meta_key", "meta_value", "updated_at"],
      conflict: ["meta_key"],
      update: ["meta_value", "updated_at"]
    }),
    key,
    value.slice(0, 500),
    db.sql.dateParam(/* @__PURE__ */ new Date())
  );
}
async function clearTitles(db) {
  pending = [];
  await db.execute(`DELETE FROM seer_search_titles`);
}

// server/search/title-crawl.ts
var ANIME_KEYWORD = "210024";
function sources(today) {
  return [
    { endpoint: "movies", query: "sortBy=popularity.desc", pages: 60, light: 10 },
    { endpoint: "movies", query: "sortBy=vote_count.desc", pages: 100 },
    { endpoint: "tv", query: "sortBy=popularity.desc", pages: 40, light: 10 },
    { endpoint: "tv", query: "sortBy=vote_count.desc", pages: 60 },
    { endpoint: "tv", query: `keywords=${ANIME_KEYWORD}&sortBy=vote_count.desc`, pages: 20, light: 3 },
    { endpoint: "movies", query: `keywords=${ANIME_KEYWORD}&sortBy=vote_count.desc`, pages: 8 },
    { endpoint: "movies", query: `primaryReleaseDateGte=${today}&sortBy=popularity.desc`, pages: 10, light: 10 },
    { endpoint: "tv", query: `firstAirDateGte=${today}&sortBy=popularity.desc`, pages: 5, light: 5 }
  ];
}
var CRAWL_LANGS = ["fr", "en"];
var FULL_EVERY_MS3 = 3 * 864e5;
var LIGHT_EVERY_MS = 864e5;
var CHECK_EVERY_MS = 36e5;
var CONCURRENCY4 = 2;
var MIN_BUILT = 1e3;
var state = "idle";
var crawling = false;
var nextCheck = 0;
var fullAt = 0;
var lightAt = 0;
var crawlTags = null;
function todayIso() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toRecord(raw, lang, fallbackType) {
  const media = toRemoteMedia({ ...raw, mediaType: raw.mediaType ?? fallbackType });
  if (!media || !media.title) return null;
  return {
    mediaType: media.mediaType,
    tmdbId: media.id,
    lang,
    title: media.title,
    originalTitle: media.originalTitle,
    releaseDate: media.releaseDate,
    popularity: media.popularity,
    voteCount: media.voteCount,
    voteAverage: media.voteAverage,
    posterPath: media.posterPath,
    backdropPath: media.backdropPath,
    originalLanguage: media.originalLanguage,
    genreIds: media.genreIds
  };
}
async function fetchDiscover(cfg, source, page, lang, tags) {
  const exclude = tags ? `&excludeKeywords=${encodeURIComponent(tags)}` : "";
  const res = await fetch(
    `${cfg.seerrUrl}/api/v1/discover/${source.endpoint}?page=${page}&${source.query}${exclude}`,
    { headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang }, signal: AbortSignal.timeout(1e4) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const type = source.endpoint === "movies" ? "movie" : "tv";
  return (data.results ?? []).map((r) => toRecord(r, lang, type)).filter((r) => r !== null);
}
async function crawl(db, cfg, index, mode, tags) {
  const jobs = [];
  for (const lang of CRAWL_LANGS) {
    for (const source of sources(todayIso())) {
      const pages = mode === "full" ? source.pages : source.light ?? 0;
      for (let page = 1; page <= pages; page++) jobs.push({ source, page, lang });
    }
  }
  const started = Date.now();
  let learned = 0;
  await mapLimit(jobs, CONCURRENCY4, async ({ source, page, lang }) => {
    const records = await fetchDiscover(cfg, source, page, lang, tags);
    for (const r of records) index.upsert(r);
    queueTitles(db, records);
    learned += records.length;
  });
  await flushTitles(db);
  const now = Date.now();
  if (mode === "full") {
    fullAt = now;
    await writeMeta(db, "crawl_full_at", String(now));
  }
  lightAt = now;
  await writeMeta(db, "crawl_light_at", String(now));
  await writeMeta(db, "crawl_tags", tags);
  crawlTags = tags;
  console.log(`[Vigie] Index de recherche : ${learned} fiches lues (${mode}) en ${Math.round((now - started) / 1e3)} s \u2014 ${index.size()} titres`);
}
function launch(db, cfg, index, mode, tags) {
  if (crawling) return;
  crawling = true;
  void crawl(db, cfg, index, mode, tags).catch((err) => console.warn(`[Vigie] Construction de l'index interrompue : ${err instanceof Error ? err.message : err}`)).finally(() => {
    crawling = false;
  });
}
async function boot(db, cfg, index) {
  const [count, full, light, tags] = await Promise.all([
    loadTitles(db, index),
    readMeta(db, "crawl_full_at"),
    readMeta(db, "crawl_light_at"),
    readMeta(db, "crawl_tags")
  ]);
  fullAt = Number(full) || 0;
  lightAt = Number(light) || 0;
  crawlTags = tags;
  if (count < MIN_BUILT) fullAt = 0;
}
async function check(db, cfg, index) {
  const tags = await getBlocklistedTags(cfg.seerrUrl, cfg.seerrApiKey);
  if (crawlTags !== null && tags !== crawlTags) {
    index.clear();
    await clearTitles(db);
    fullAt = 0;
  }
  const now = Date.now();
  if (now - fullAt > FULL_EVERY_MS3) launch(db, cfg, index, "full", tags);
  else if (now - lightAt > LIGHT_EVERY_MS) launch(db, cfg, index, "light", tags);
}
function ensureTitleIndex(db, cfg, index) {
  if (state === "booting") return;
  if (state === "idle") {
    state = "booting";
    void boot(db, cfg, index).catch((err) => console.warn(`[Vigie] Index de recherche illisible : ${err instanceof Error ? err.message : err}`)).finally(() => {
      state = "ready";
      nextCheck = 0;
      ensureTitleIndex(db, cfg, index);
    });
    return;
  }
  const now = Date.now();
  if (crawling || now < nextCheck) return;
  nextCheck = now + CHECK_EVERY_MS;
  void check(db, cfg, index).catch(() => {
    nextCheck = now + 6e4;
  });
}
function titleIndexBuilding() {
  return state !== "ready" || crawling;
}

// server/search/rank.ts
var TEXT_ALL_WORDS = 650;
var TEXT_KEY_WORDS = 560;
var FIX_PENALTY = 80;
var TEXT_EXACT_TITLE = 1e3 - FIX_PENALTY;
function covered(words2, wanted, lastIsPrefix) {
  let found = 0;
  for (let i = 0; i < wanted.length; i++) {
    const w = wanted[i];
    const prefix = lastIsPrefix && i === wanted.length - 1;
    if (words2.some((x) => x === w || prefix && x.startsWith(w))) found++;
  }
  return found;
}
function textScore(names, tokens) {
  if (tokens.length === 0) return 0;
  const phrase = tokens.join(" ");
  const key = significantTokens(tokens);
  const lastIsKey = key[key.length - 1] === tokens[tokens.length - 1];
  let best = 0;
  for (const name of names) {
    if (name === phrase) return 1e3;
    if (name.startsWith(phrase)) {
      best = Math.max(best, 880 - Math.min(80, name.length - phrase.length));
      continue;
    }
    const words2 = name.split(" ");
    const density = (n, span) => Math.round(span * n / Math.max(words2.length, 1));
    if (covered(words2, tokens, true) === tokens.length) {
      best = Math.max(best, TEXT_ALL_WORDS + density(tokens.length, 150));
      continue;
    }
    const found = covered(words2, key, lastIsKey);
    if (found === key.length) best = Math.max(best, TEXT_KEY_WORDS + density(key.length, 80));
    else if (found > 0) best = Math.max(best, Math.round(399 * found / key.length));
  }
  return best;
}
function popularityScore(voteCount, popularity) {
  return Math.round(70 * Math.log10(1 + voteCount) + 25 * Math.log10(1 + popularity));
}
function remoteRankScore(rank) {
  return rank === null || rank === void 0 ? 0 : Math.max(0, 80 - 4 * rank);
}
function scoreMediaWithText(item, text2, query) {
  let score2 = text2 === 0 && item.remoteRank !== null && item.remoteRank !== void 0 ? 150 : text2;
  score2 += popularityScore(item.voteCount, item.popularity) + remoteRankScore(item.remoteRank);
  if (query.year !== null && item.year !== null) {
    const gap = Math.abs(query.year - item.year);
    score2 += gap === 0 ? 500 : gap === 1 ? 150 : -250;
  }
  if (query.type !== null) score2 += query.type === item.mediaType ? 300 : -400;
  if (query.anime && item.isAnime) score2 += 300;
  if (item.voteCount < 5 && text2 < 1e3) score2 -= 100;
  return score2;
}
function scorePerson(name, popularity, tokens, remoteRank) {
  const text2 = textScore([name], tokens);
  const normalized = text2 >= TEXT_KEY_WORDS ? 800 : text2;
  return normalized + Math.round(150 * Math.log10(1 + popularity * 10)) + remoteRankScore(remoteRank) * 2;
}

// server/search/service.ts
var titleIndex = new TitleIndex();
var FULL_TTL_MS = 6e4;
var PARTIAL_TTL_MS2 = 5e3;
var LOCAL_LIMIT = 80;
function fromEntry(e, lang) {
  const title = e.titles.get(lang) ?? e.titles.get("en") ?? e.originalTitle ?? [...e.titles.values()][0] ?? "";
  return {
    key: e.key,
    mediaType: e.mediaType,
    tmdbId: e.tmdbId,
    title,
    originalTitle: e.originalTitle,
    names: e.names,
    releaseDate: e.releaseDate,
    year: e.year,
    posterPath: e.posterPath,
    backdropPath: e.backdropPath,
    overview: null,
    voteAverage: e.voteAverage,
    voteCount: e.voteCount,
    popularity: e.popularity,
    genreIds: e.genreIds,
    originalLanguage: e.originalLanguage,
    isAnime: e.isAnime,
    remoteStatus: void 0,
    remoteRank: null,
    text: 0,
    score: 0
  };
}
function fromRemote(m) {
  const names = [m.title, m.originalTitle].filter((n) => !!n).map(foldText).filter((n) => n !== "").flatMap(nameForms);
  const year = m.releaseDate ? Number(m.releaseDate.slice(0, 4)) || null : null;
  const isAnime = m.genreIds.includes(16) && ["ja", "ko", "zh"].includes(m.originalLanguage ?? "");
  return {
    key: `${m.mediaType}:${m.id}`,
    mediaType: m.mediaType,
    tmdbId: m.id,
    title: m.title,
    originalTitle: m.originalTitle,
    names: [...new Set(names)],
    releaseDate: m.releaseDate,
    year,
    posterPath: m.posterPath,
    backdropPath: m.backdropPath,
    overview: m.overview,
    voteAverage: m.voteAverage,
    voteCount: m.voteCount,
    popularity: m.popularity,
    genreIds: m.genreIds,
    originalLanguage: m.originalLanguage,
    isAnime,
    remoteStatus: m.status,
    remoteRank: m.rank,
    text: 0,
    score: 0,
    ...m.masked ? { masked: true } : {}
  };
}
function merge2(into, c) {
  const known = into.get(c.key);
  if (!known) {
    into.set(c.key, c);
    return;
  }
  const ranks = [known.remoteRank, c.remoteRank].filter((r) => r !== null);
  into.set(c.key, {
    ...known,
    ...c,
    names: [.../* @__PURE__ */ new Set([...known.names, ...c.names])],
    remoteRank: ranks.length > 0 ? Math.min(...ranks) : null,
    // Masqué pour l'une des deux sources (tapée ou corrigée) : masqué.
    ...known.masked || c.masked ? { masked: true } : {}
  });
}
function recordOf(m, lang) {
  return {
    mediaType: m.mediaType,
    tmdbId: m.id,
    lang,
    title: m.title,
    originalTitle: m.originalTitle,
    releaseDate: m.releaseDate,
    popularity: m.popularity,
    voteCount: m.voteCount,
    voteAverage: m.voteAverage,
    posterPath: m.posterPath,
    backdropPath: m.backdropPath,
    originalLanguage: m.originalLanguage,
    genreIds: m.genreIds
  };
}
function rewrite(parsed, replacements) {
  const map = new Map(replacements);
  return parsed.tokens.map((t) => map.get(t) ?? t).join(" ");
}
function score(candidates, parsed, fixed) {
  let fixWon = false;
  const scored = [...candidates].map((c) => {
    const typed = textScore(c.names, parsed.tokens);
    const viaFix = fixed ? textScore(c.names, fixed) - FIX_PENALTY : -1;
    const text2 = Math.max(typed, viaFix);
    return { c: { ...c, text: text2, score: scoreMediaWithText(c, text2, parsed) }, viaFix: viaFix > typed };
  });
  scored.sort((a, b) => b.c.score - a.c.score);
  if (scored.length > 0) fixWon = scored[0].viaFix;
  const anyFull = scored.some((s) => s.c.text >= TEXT_KEY_WORDS);
  const media = scored.map((s) => s.c).filter((c) => !(anyFull && c.text < TEXT_KEY_WORDS && c.remoteRank === null)).filter((c) => !(c.text === 0 && onlyThroughElision(c.names, parsed.tokens)));
  return { media, fixWon };
}
function warmSearch(ctx) {
  ensureTitleIndex(ctx.db, ctx.cfg, titleIndex);
  refreshStatusMap(ctx.cfg);
  refreshLocalPending(ctx.db);
}
var EMPTY2 = (parsed) => ({
  parsed,
  searched: parsed.text,
  correction: null,
  media: [],
  people: [],
  hasMore: false,
  blockedCount: 0,
  blockedActive: false,
  complete: true
});
function instantSearch(ctx, q, opts) {
  warmSearch(ctx);
  const parsed = parseQuery(q);
  if (parsed.tokens.length === 0) return EMPTY2(parsed);
  const lookup = titleIndex.lookup(parsed.tokens, LOCAL_LIMIT, !opts.exact);
  const fixedText = lookup.replacements.length > 0 ? rewrite(parsed, lookup.replacements) : null;
  const { media, fixWon } = score(lookup.hits.map((h) => fromEntry(h.entry, opts.lang)), parsed, fixedText ? tokenize(fixedText) : null);
  const correction = fixWon ? fixedText : null;
  return { ...EMPTY2(parsed), searched: correction ?? parsed.text, correction, media, complete: false };
}
async function tryRemote(ctx, text2, opts) {
  if (text2.trim() === "") return null;
  try {
    return await remoteSearch(
      ctx.cfg,
      text2,
      opts.page,
      opts.lang,
      opts.showBlocked,
      (mediaType, id) => titleIndex.get(`${mediaType}:${id}`) !== void 0
    );
  } catch {
    return null;
  }
}
async function computeFull(ctx, q, opts) {
  const parsed = parseQuery(q);
  if (parsed.tokens.length === 0) return EMPTY2(parsed);
  const lookup = titleIndex.lookup(parsed.tokens, LOCAL_LIMIT, !opts.exact);
  const fixedText = lookup.replacements.length > 0 ? rewrite(parsed, lookup.replacements) : null;
  const [typed, fixed] = await Promise.all([
    tryRemote(ctx, parsed.text, opts),
    fixedText ? tryRemote(ctx, fixedText, opts) : Promise.resolve(null)
  ]);
  const pages = [typed, fixed].filter((p) => p !== null);
  const all = /* @__PURE__ */ new Map();
  if (opts.page === 1) for (const h of lookup.hits) merge2(all, fromEntry(h.entry, opts.lang));
  for (const page of pages) for (const m of page.media) merge2(all, fromRemote(m));
  if (parsed.year !== null && parsed.text !== parsed.raw && opts.page === 1) {
    const found = [...all.values()].some((c) => c.year === parsed.year && textScore(c.names, parsed.tokens) >= TEXT_KEY_WORDS);
    if (!found) {
      const raw = await tryRemote(ctx, parsed.raw, opts);
      if (raw) {
        pages.push(raw);
        for (const m of raw.media) merge2(all, fromRemote(m));
      }
    }
  }
  {
    const learned = pages.flatMap((p) => p.media).filter((m) => m.title && !m.masked).map((m) => recordOf(m, opts.lang));
    for (const r of learned) titleIndex.upsert(r);
    if (learned.length > 0) queueTitles(ctx.db, learned);
  }
  const fixedTokens = fixedText ? tokenize(fixedText) : null;
  const { media, fixWon } = score(all.values(), parsed, fixedTokens);
  const correction = fixWon ? fixedText : null;
  const tokens = correction ? fixedTokens : parsed.tokens;
  const people = /* @__PURE__ */ new Map();
  for (const page of pages) {
    for (const p of page.people) {
      if (people.has(p.id)) continue;
      people.set(p.id, {
        id: p.id,
        name: p.name,
        profilePath: p.profilePath,
        popularity: p.popularity,
        department: p.department,
        knownFor: p.knownFor.map(fromRemote),
        score: scorePerson(foldText(p.name), p.popularity, tokens, p.rank)
      });
    }
  }
  const main = (correction ? fixed : typed) ?? typed ?? fixed;
  return {
    parsed,
    searched: correction ?? parsed.text,
    correction,
    media,
    people: [...people.values()].sort((a, b) => b.score - a.score),
    hasMore: (main?.totalPages ?? 0) > opts.page,
    blockedCount: pages.reduce((n, p) => n + p.blockedCount, 0),
    blockedActive: pages.some((p) => p.blockedActive),
    complete: true
  };
}
function fullKey(q, opts) {
  return `vigie:full:${opts.lang}:${opts.showBlocked ? 1 : 0}:${opts.exact ? 1 : 0}:${opts.page}:${foldText(q)}`;
}
function fullSearch(ctx, q, opts) {
  warmSearch(ctx);
  const ttl = titleIndexBuilding() && titleIndex.size() === 0 ? PARTIAL_TTL_MS2 : FULL_TTL_MS;
  return cached(fullKey(q, opts), ttl, () => computeFull(ctx, q, opts));
}
function fullIfReady(ctx, q, opts) {
  const hit = peek(fullKey(q, opts));
  if (hit) return hit;
  void fullSearch(ctx, q, opts).catch(() => void 0);
  return void 0;
}

// server/titles/title-state.ts
var MAX_TITLE_KEYS = 60;
var KEY = /^(movie|tv):([1-9]\d{0,9})$/;
var LABELS = {
  fr: {
    requested: "Demand\xE9",
    partial: "En partie",
    available: "Disponible",
    masked: "Masqu\xE9",
    request: "Demander",
    seasons: "Choisir les saisons",
    moreSeasons: "Demander d'autres saisons",
    page: "Voir dans le catalogue"
  },
  en: {
    requested: "Requested",
    partial: "Partly here",
    available: "Available",
    masked: "Hidden",
    request: "Request",
    seasons: "Choose seasons",
    moreSeasons: "Request more seasons",
    page: "View in catalog"
  }
};
function labelsFor(lang) {
  return lang === "fr" ? LABELS.fr : LABELS.en;
}
function parseTitleKeys(raw) {
  if (typeof raw !== "string") return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const part of raw.split(",")) {
    const m = KEY.exec(part.trim());
    if (!m || seen.has(m[0])) continue;
    const tmdbId = Number(m[2]);
    if (!Number.isSafeInteger(tmdbId)) continue;
    seen.add(m[0]);
    out.push({ key: m[0], mediaType: m[1], tmdbId });
    if (out.length >= MAX_TITLE_KEYS) break;
  }
  return out;
}
function seasonsHref(tmdbId) {
  return `/discover?request=tv:${tmdbId}`;
}
function mediaHref(mediaType, tmdbId) {
  return `/discover?media=${mediaType}:${tmdbId}`;
}
function titlePage(mediaType, tmdbId, rights, lang) {
  if (!rights.movies && !rights.tv) return void 0;
  return { label: labelsFor(lang).page, href: mediaHref(mediaType, tmdbId) };
}
function titleBadge(status, lang) {
  const l = labelsFor(lang);
  if (status === MEDIA_STATUS.PENDING || status === MEDIA_STATUS.PROCESSING) return { label: l.requested, tone: "info" };
  if (status === MEDIA_STATUS.PARTIALLY_AVAILABLE) return { label: l.partial, tone: "success" };
  if (status === MEDIA_STATUS.AVAILABLE) return { label: l.available, tone: "success" };
  if (status === MEDIA_STATUS.BLOCKLISTED) return { label: l.masked, tone: "neutral" };
  return null;
}
function titleStateFor(mediaType, tmdbId, status, rights, lang) {
  const l = labelsFor(lang);
  const badge = titleBadge(status, lang);
  let request = null;
  const masked = status === MEDIA_STATUS.BLOCKLISTED;
  if (masked && !rights.masked) return { badge, request };
  if (mediaType === "movie") {
    if (rights.movies && (badge === null || masked)) request = { mode: "direct", label: l.request };
  } else if (rights.tv && status !== MEDIA_STATUS.AVAILABLE) {
    request = { mode: "open", label: badge === null || masked ? l.seasons : l.moreSeasons, href: seasonsHref(tmdbId) };
  }
  return { badge, request };
}

// server/search/present.ts
function toSearchItem(c, status) {
  const movie = c.mediaType === "movie";
  const opt = (v) => v === null ? void 0 : v;
  return {
    id: c.tmdbId,
    mediaType: c.mediaType,
    ...movie ? { title: c.title, originalTitle: opt(c.originalTitle), releaseDate: opt(c.releaseDate) } : { name: c.title, originalName: opt(c.originalTitle), firstAirDate: opt(c.releaseDate) },
    posterPath: opt(c.posterPath),
    backdropPath: opt(c.backdropPath),
    overview: opt(c.overview),
    voteAverage: c.voteAverage || void 0,
    voteCount: c.voteCount || void 0,
    popularity: c.popularity || void 0,
    genreIds: c.genreIds,
    originalLanguage: opt(c.originalLanguage),
    ...status !== void 0 ? { mediaInfo: { status } } : {},
    ...c.masked ? { masked: true } : {}
  };
}
var LABELS2 = {
  fr: { movie: "Film", series: "S\xE9rie", release: "sortie le" },
  en: { movie: "Movie", series: "Series", release: "out" }
};
function inLibrary(status) {
  return status === MEDIA_STATUS.PARTIALLY_AVAILABLE || status === MEDIA_STATUS.AVAILABLE;
}
function inLibraryOrBlocked(status) {
  return status === MEDIA_STATUS.PARTIALLY_AVAILABLE || status === MEDIA_STATUS.AVAILABLE || status === MEDIA_STATUS.BLOCKLISTED;
}
function shortDate(iso, lang) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}
function toProviderItem(c, status, lang, today) {
  const l = lang === "fr" ? LABELS2.fr : LABELS2.en;
  const kind = c.mediaType === "movie" ? "movie" : "series";
  const upcoming = c.releaseDate !== null && c.releaseDate > today;
  const kindLabel = kind === "movie" ? l.movie : l.series;
  const subtitle = upcoming && c.releaseDate ? `${kindLabel} \xB7 ${l.release} ${shortDate(c.releaseDate, lang)}` : c.year !== null ? `${kindLabel} \xB7 ${c.year}` : kindLabel;
  const badge = titleBadge(status, lang);
  return {
    id: c.key,
    kind,
    tmdbId: c.tmdbId,
    title: c.title,
    year: c.year,
    subtitle,
    imageUrl: c.posterPath ? `https://image.tmdb.org/t/p/w185${c.posterPath}` : null,
    href: `/discover?media=${c.mediaType}:${c.tmdbId}`,
    badge
  };
}

// server/search/respond.ts
var TOP_SINGLE_WORD = 800;
var GROUP_LIMIT = 40;
var TMDB_FIRST_CHOICES = 5;
var PEOPLE_LIMIT = 10;
var NOTABLE_VOTES = 30;
var NOTABLE_POPULARITY = 3;
function statusFor(c) {
  const known = correctedStatus(c.mediaType, c.tmdbId, statusOf(c.mediaType, c.tmdbId) ?? c.remoteStatus);
  const settled = known !== void 0 && known !== MEDIA_STATUS.UNKNOWN && known !== MEDIA_STATUS.DELETED;
  if (!settled && isLocallyPending(c.key)) return MEDIA_STATUS.PENDING;
  return known;
}
function visible(media, showMasked) {
  if (!showMasked) return media.filter((c) => !c.masked && statusFor(c) !== MEDIA_STATUS.BLOCKLISTED);
  return media.map((c) => statusFor(c) === MEDIA_STATUS.BLOCKLISTED && !c.masked ? { ...c, masked: true } : c);
}
function toPerson(p) {
  return {
    id: p.id,
    mediaType: "person",
    name: p.name,
    profilePath: p.profilePath ?? void 0,
    knownForDepartment: p.department ?? void 0,
    popularity: p.popularity,
    knownFor: [...p.knownFor].sort((a, b) => b.voteCount - a.voteCount).filter((c) => statusFor(c) !== MEDIA_STATUS.BLOCKLISTED).map((c) => toSearchItem(c, statusFor(c)))
  };
}
function facetNamed(facets, query) {
  const q = foldText(query);
  return facets.some((f) => foldText(f.label) === q);
}
function presentHub(ranked, page, facets, indexing, startedAt, showMasked = false) {
  const media = visible(ranked.media, showMasked);
  const tokens = tokenize(ranked.searched);
  const facetQuery = facetNamed(facets, ranked.parsed.raw);
  const bestMedia = media[0];
  const bestPerson = ranked.people[0];
  const personText = bestPerson ? textScore([foldText(bestPerson.name)], tokens) : 0;
  const needed = significantTokens(tokens).length <= 1 ? TOP_SINGLE_WORD : TEXT_ALL_WORDS;
  let top = null;
  if (page !== 1 || facetQuery) {
    top = null;
  } else if (bestPerson && personText >= TEXT_KEY_WORDS && (!bestMedia || bestPerson.score > bestMedia.score)) {
    top = { kind: "person", person: toPerson(bestPerson) };
  } else if (bestMedia && bestMedia.text >= needed) {
    top = { kind: "media", item: toSearchItem(bestMedia, statusFor(bestMedia)) };
  } else if (!media.some((c) => c.text >= TEXT_KEY_WORDS)) {
    const first = media.filter((c) => c.remoteRank !== null && c.remoteRank < TMDB_FIRST_CHOICES).sort((a, b) => b.voteCount - a.voteCount)[0];
    if (first) top = { kind: "media", item: toSearchItem(first, statusFor(first)) };
  }
  const topKey = top?.kind === "media" ? `${top.item.mediaType}:${top.item.id}` : null;
  const rest = media.filter((c) => c.key !== topKey);
  return {
    query: ranked.parsed.raw,
    searched: ranked.searched,
    correction: ranked.correction,
    year: ranked.parsed.year,
    type: ranked.parsed.type,
    complete: ranked.complete,
    top,
    movies: rest.filter((c) => c.mediaType === "movie").slice(0, GROUP_LIMIT).map((c) => toSearchItem(c, statusFor(c))),
    series: rest.filter((c) => c.mediaType === "tv").slice(0, GROUP_LIMIT).map((c) => toSearchItem(c, statusFor(c))),
    people: ranked.people.filter((p) => top?.kind !== "person" || p.id !== top.person.id).slice(0, PEOPLE_LIMIT).map(toPerson),
    facets,
    page,
    hasMore: ranked.hasMore,
    blockedCount: ranked.blockedCount,
    blockedActive: ranked.blockedActive,
    indexing,
    tookMs: Date.now() - startedAt
  };
}
function presentProvider(ranked, type, limit, lang, today) {
  const media = visible(ranked.media, false);
  const best = media.reduce((m, c) => Math.max(m, c.text), 0);
  const threshold = best >= 1e3 ? TOP_SINGLE_WORD : TEXT_ALL_WORDS;
  const libraryHasIt = media.some((c) => c.text >= TEXT_EXACT_TITLE && inLibrary(statusFor(c)));
  const statusesKnown = statusMapReady();
  const items = media.filter((c) => statusesKnown || c.remoteRank !== null).filter((c) => c.text >= threshold).filter((c) => !libraryHasIt || c.voteCount >= NOTABLE_VOTES || c.popularity >= NOTABLE_POPULARITY).filter((c) => type === null || type === "movie" === (c.mediaType === "movie")).filter((c) => !inLibraryOrBlocked(statusFor(c))).filter((c) => !c.masked).slice(0, limit).map((c) => toProviderItem(c, statusFor(c), lang, today));
  const q = ranked.parsed.raw;
  return {
    query: q,
    correction: ranked.correction,
    complete: ranked.complete && statusesKnown,
    items,
    moreHref: q ? `/discover?q=${encodeURIComponent(q)}` : null
  };
}

// server/search/facets.ts
var GENRES = [
  { id: 28, movie: true, tv: false, fr: "Action", en: "Action" },
  { id: 12, movie: true, tv: false, fr: "Aventure", en: "Adventure" },
  { id: 10759, movie: false, tv: true, fr: "Action & Aventure", en: "Action & Adventure" },
  { id: 16, movie: true, tv: true, fr: "Animation", en: "Animation", also: ["dessin anime", "dessins animes", "cartoon"] },
  { id: 35, movie: true, tv: true, fr: "Com\xE9die", en: "Comedy", also: ["humour"] },
  { id: 80, movie: true, tv: true, fr: "Crime", en: "Crime", also: ["policier", "polar"] },
  { id: 99, movie: true, tv: true, fr: "Documentaire", en: "Documentary", also: ["docu"] },
  { id: 18, movie: true, tv: true, fr: "Drame", en: "Drama" },
  { id: 10751, movie: true, tv: true, fr: "Familial", en: "Family", also: ["famille"] },
  { id: 14, movie: true, tv: false, fr: "Fantastique", en: "Fantasy", also: ["fantasy"] },
  { id: 36, movie: true, tv: false, fr: "Histoire", en: "History", also: ["historique"] },
  { id: 27, movie: true, tv: false, fr: "Horreur", en: "Horror", also: ["epouvante"] },
  { id: 10762, movie: false, tv: true, fr: "Enfants", en: "Kids", also: ["jeunesse"] },
  { id: 10402, movie: true, tv: false, fr: "Musique", en: "Music", also: ["musical"] },
  { id: 9648, movie: true, tv: true, fr: "Myst\xE8re", en: "Mystery", also: ["enquete"] },
  { id: 10749, movie: true, tv: false, fr: "Romance", en: "Romance", also: ["romantique"] },
  { id: 878, movie: true, tv: false, fr: "Science-Fiction", en: "Science Fiction", also: ["sf", "scifi", "sci fi"] },
  { id: 10765, movie: false, tv: true, fr: "Science-Fiction & Fantastique", en: "Sci-Fi & Fantasy" },
  { id: 53, movie: true, tv: false, fr: "Thriller", en: "Thriller", also: ["suspense"] },
  { id: 10752, movie: true, tv: false, fr: "Guerre", en: "War" },
  { id: 10768, movie: false, tv: true, fr: "Guerre & Politique", en: "War & Politics" },
  { id: 37, movie: true, tv: true, fr: "Western", en: "Western" },
  { id: 10764, movie: false, tv: true, fr: "T\xE9l\xE9r\xE9alit\xE9", en: "Reality", also: ["tele realite", "realite"] },
  { id: 10767, movie: false, tv: true, fr: "Talk-show", en: "Talk" }
];
var MIN_PREFIX2 = 3;
var MAX_FACETS = 6;
function matches(name, query) {
  const folded = foldText(name);
  return folded === query || query.length >= MIN_PREFIX2 && folded.startsWith(query);
}
function genreFacets(query, lang) {
  const q = foldText(query);
  if (q.length < 2) return [];
  const out = [];
  for (const g of GENRES) {
    const names = [g.fr, g.en, ...g.also ?? []];
    if (!names.some((n) => matches(n, q))) continue;
    const label = lang === "fr" ? g.fr : g.en;
    if (g.movie) out.push({ kind: "genre", id: g.id, mediaType: "movie", label });
    if (g.tv) out.push({ kind: "genre", id: g.id, mediaType: "tv", label });
  }
  return out.slice(0, MAX_FACETS);
}
function regionOf(lang) {
  const map = { fr: "FR", en: "US", de: "DE", es: "ES", it: "IT", pt: "BR", ja: "JP" };
  return map[lang] ?? "US";
}
var providersKey = (region) => `vigie:providers:${region}`;
async function providerList(cfg, region) {
  return cached(providersKey(region), 864e5, async () => {
    const all = /* @__PURE__ */ new Map();
    for (const kind of ["movies", "tv"]) {
      const res = await fetch(`${cfg.seerrUrl}/api/v1/watchproviders/${kind}?watchRegion=${region}`, {
        headers: { "X-Api-Key": cfg.seerrApiKey },
        signal: AbortSignal.timeout(8e3)
      });
      if (!res.ok) continue;
      for (const p of await res.json()) {
        if (typeof p.id === "number" && p.name && !all.has(p.id)) all.set(p.id, p);
      }
    }
    return [...all.values()].sort((a, b) => (a.displayPriority ?? 999) - (b.displayPriority ?? 999));
  }, { staleMs: 7 * 864e5 });
}
async function providerFacets(cfg, query, lang, wait) {
  const q = foldText(query);
  if (q.length < MIN_PREFIX2) return [];
  try {
    const region = regionOf(lang);
    let list = peek(providersKey(region), true);
    if (list === void 0) {
      const loading = providerList(cfg, region);
      if (!wait) {
        void loading.catch(() => void 0);
        return [];
      }
      list = await loading;
    }
    return list.filter((p) => matches(p.name ?? "", q) || foldText(p.name ?? "").split(" ").some((w) => w.length >= 3 && w === q)).slice(0, 3).map((p) => ({ kind: "provider", id: p.id, label: p.name, logoPath: p.logoPath ?? null }));
  } catch {
    return [];
  }
}

// server/search/person-credits.ts
var CREDITS_TTL_MS = 30 * 6e4;
var CREDITS_STALE_MS = 6 * 36e5;
var SELF = /^(himself|herself|themselves|self|lui-même|elle-même|eux-mêmes)\b/i;
var CREW_JOBS = /* @__PURE__ */ new Set(["Director", "Screenplay", "Writer", "Creator", "Novel", "Story"]);
var ROLE_JOBS = {
  Director: /* @__PURE__ */ new Set(["Director"]),
  Writer: /* @__PURE__ */ new Set(["Screenplay", "Writer", "Novel", "Story", "Teleplay", "Author"]),
  Creator: /* @__PURE__ */ new Set(["Creator"]),
  Producer: /* @__PURE__ */ new Set(["Producer", "Executive Producer"]),
  Composer: /* @__PURE__ */ new Set(["Original Music Composer", "Music", "Composer"])
};
var KNOWN_JOBS = /* @__PURE__ */ new Set([...CREW_JOBS, ...Object.values(ROLE_JOBS).flatMap((jobs) => [...jobs])]);
function readRole(raw) {
  if (raw === "Actor" || raw === "GuestStar") return "Actor";
  return typeof raw === "string" && Object.prototype.hasOwnProperty.call(ROLE_JOBS, raw) ? raw : null;
}
var TALK_OR_NEWS = /* @__PURE__ */ new Set([10767, 10763]);
var str2 = (v) => typeof v === "string" && v.trim() !== "" ? v : null;
var num4 = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
function toCredit(r, crew) {
  const mediaType = r.mediaType === "movie" || r.mediaType === "tv" ? r.mediaType : null;
  const id = num4(r.id);
  if (!mediaType || id <= 0) return null;
  const role = crew ? str2(r.job) : str2(r.character);
  if (!crew && role && SELF.test(role)) return null;
  if (crew && !KNOWN_JOBS.has(String(r.job ?? ""))) return null;
  const genres = Array.isArray(r.genreIds) ? r.genreIds : [];
  if (genres.some((g) => typeof g === "number" && TALK_OR_NEWS.has(g))) return null;
  const info = r.mediaInfo;
  return {
    mediaType,
    id,
    title: str2(r.title) ?? str2(r.name) ?? "",
    releaseDate: str2(r.releaseDate) ?? str2(r.firstAirDate),
    posterPath: str2(r.posterPath),
    voteCount: num4(r.voteCount),
    popularity: num4(r.popularity),
    role,
    crew,
    status: typeof info?.status === "number" ? info.status : void 0
  };
}
function matchesRole(credit, role) {
  if (role === null) return false;
  if (role === "Actor") return !credit.crew;
  return credit.crew && (ROLE_JOBS[role]?.has(credit.role ?? "") ?? false);
}
function pickCredits(credits, role) {
  const byKey = /* @__PURE__ */ new Map();
  for (const credit of credits) {
    const matches2 = matchesRole(credit, role);
    if (!matches2 && credit.crew && !CREW_JOBS.has(credit.role ?? "")) continue;
    const key = `${credit.mediaType}:${credit.id}`;
    const known = byKey.get(key);
    if (!known || matches2 && !known.matches) byKey.set(key, { credit, matches: matches2 });
  }
  return [...byKey.values()];
}
async function seerrGet(cfg, path, lang) {
  const res = await fetch(`${cfg.seerrUrl}${path}`, {
    headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang },
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) throw new Error(`Jellyseerr ${path.split("?")[0]} ${res.status}`);
  return await res.json();
}
async function personCredits(cfg, personId, lang) {
  return cached(`vigie:person:v2:${personId}:${lang}`, CREDITS_TTL_MS, async () => {
    const raw = await seerrGet(cfg, `/api/v1/person/${personId}/combined_credits?language=${lang}`, lang);
    const all = [
      ...Array.isArray(raw.cast) ? raw.cast.map((r) => toCredit(r, false)) : [],
      ...Array.isArray(raw.crew) ? raw.crew.map((r) => toCredit(r, true)) : []
    ];
    const credits = all.filter((c) => c !== null && c.title !== "");
    for (const c of credits) noteStatus(c.mediaType, c.id, c.status);
    return credits;
  }, { staleMs: CREDITS_STALE_MS });
}
async function resolvePerson(cfg, name, tmdbId, lang) {
  if (tmdbId !== null) return tmdbId;
  const folded = foldText(name);
  if (!folded) return null;
  const page = await remoteSearch(cfg, name, 1, lang, true);
  const exact = page.people.filter((p) => foldText(p.name) === folded);
  const best = (exact.length > 0 ? exact : page.people.slice(0, 1)).sort((a, b) => b.popularity - a.popularity)[0];
  return best?.id ?? null;
}
var LABELS3 = {
  fr: { movie: "Film", series: "S\xE9rie" },
  en: { movie: "Movie", series: "Series" }
};
var JOB_LABELS = {
  fr: {
    Director: "R\xE9alisation",
    Screenplay: "Sc\xE9nario",
    Writer: "Sc\xE9nario",
    Teleplay: "Sc\xE9nario",
    Novel: "Roman",
    Story: "Histoire",
    Author: "Auteur",
    Creator: "Cr\xE9ation",
    Producer: "Production",
    "Executive Producer": "Production ex\xE9cutive",
    "Original Music Composer": "Musique",
    Music: "Musique",
    Composer: "Musique"
  },
  en: {
    Director: "Director",
    Screenplay: "Screenplay",
    Writer: "Writer",
    Teleplay: "Teleplay",
    Novel: "Novel",
    Story: "Story",
    Author: "Author",
    Creator: "Creator",
    Producer: "Producer",
    "Executive Producer": "Executive Producer",
    "Original Music Composer": "Music",
    Music: "Music",
    Composer: "Music"
  }
};
function creditLabel(c, lang) {
  if (!c.role) return null;
  if (!c.crew) return c.role;
  return JOB_LABELS[lang === "fr" ? "fr" : "en"][c.role] ?? c.role;
}
function toItem(c, status, lang) {
  const l = lang === "fr" ? LABELS3.fr : LABELS3.en;
  const kind = c.mediaType === "movie" ? "movie" : "series";
  const year = c.releaseDate ? Number(c.releaseDate.slice(0, 4)) || null : null;
  const subtitle = [kind === "movie" ? l.movie : l.series, year, creditLabel(c, lang)].filter(Boolean).join(" \xB7 ");
  return {
    id: `${c.mediaType}:${c.id}`,
    kind,
    tmdbId: c.id,
    title: c.title,
    year,
    subtitle: subtitle.slice(0, 120),
    imageUrl: c.posterPath ? `https://image.tmdb.org/t/p/w185${c.posterPath}` : null,
    href: `/discover?media=${c.mediaType}:${c.id}`,
    // Les mots de l'affiche du hub, les mêmes que sur toutes les cartes de Tentacle.
    badge: titleBadge(status, lang)
  };
}
async function personProvider(cfg, q) {
  const empty = { query: q.name, correction: null, complete: true, items: [], moreHref: null };
  const personId = await resolvePerson(cfg, q.name, q.tmdbId, q.lang);
  if (personId === null) return empty;
  const credits = await personCredits(cfg, personId, q.lang);
  const items = pickCredits(credits, q.role).filter(({ credit: c }) => q.type === null || q.type === "movie" === (c.mediaType === "movie")).map(({ credit: c, matches: matches2 }) => ({ c, matches: matches2, status: correctedStatus(c.mediaType, c.id, statusOf(c.mediaType, c.id) ?? c.status) })).filter(({ status }) => !inLibraryOrBlocked(status)).sort((a, b) => Number(b.matches) - Number(a.matches) || b.c.voteCount - a.c.voteCount || b.c.popularity - a.c.popularity).slice(0, q.limit).map(({ c, status }) => toItem(c, status, q.lang));
  return { ...empty, items, moreHref: `/discover?person=${personId}` };
}

// server/search/collection-parts.ts
var PARTS_TTL_MS = 30 * 6e4;
var PARTS_STALE_MS = 6 * 36e5;
var str3 = (v) => typeof v === "string" && v.trim() !== "" ? v.trim() : null;
function toPart(r) {
  const id = typeof r.id === "number" && Number.isInteger(r.id) && r.id > 0 ? r.id : 0;
  const title = str3(r.title) ?? str3(r.name);
  if (id === 0 || title === null) return null;
  const date = str3(r.releaseDate);
  const info = r.mediaInfo;
  return {
    id,
    title,
    releaseDate: date !== null && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null,
    posterPath: str3(r.posterPath),
    status: typeof info?.status === "number" ? info.status : void 0
  };
}
var LABELS4 = {
  fr: { requested: "Demand\xE9", processing: "En cours", upcoming: "\xC0 venir", missing: "Pas sur le serveur", release: "Sortie le" },
  en: { requested: "Requested", processing: "In progress", upcoming: "Upcoming", missing: "Not on the server", release: "Out" }
};
function shortDate2(iso, lang) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}
function toCollectionItem(p, status, lang, today) {
  const l = lang === "fr" ? LABELS4.fr : LABELS4.en;
  const upcoming = p.releaseDate === null || p.releaseDate > today;
  const year = p.releaseDate ? Number(p.releaseDate.slice(0, 4)) || null : null;
  const subtitle = upcoming ? p.releaseDate ? `${l.release} ${shortDate2(p.releaseDate, lang)}` : null : year !== null ? String(year) : null;
  const badge = status === MEDIA_STATUS.PENDING ? { label: l.requested, tone: "info" } : status === MEDIA_STATUS.PROCESSING ? { label: l.processing, tone: "warning" } : { label: upcoming ? l.upcoming : l.missing, tone: "neutral" };
  return {
    id: `movie:${p.id}`,
    kind: "movie",
    title: p.title,
    year,
    subtitle,
    imageUrl: p.posterPath ? `https://image.tmdb.org/t/p/w185${p.posterPath}` : null,
    href: `/discover?media=movie:${p.id}`,
    badge,
    tmdbId: p.id
  };
}
function missingParts(parts, statusFor2) {
  return parts.map((part) => ({ part, status: statusFor2(part) })).filter(({ status }) => !inLibraryOrBlocked(status)).sort((a, b) => {
    const left = a.part.releaseDate ?? "9999";
    const right = b.part.releaseDate ?? "9999";
    return left < right ? -1 : left > right ? 1 : 0;
  });
}
async function collectionParts(cfg, collectionId, lang) {
  return cached(`vigie:collection:${collectionId}:${lang}`, PARTS_TTL_MS, async () => {
    const res = await fetch(`${cfg.seerrUrl}/api/v1/collection/${collectionId}?language=${lang}`, {
      headers: { "X-Api-Key": cfg.seerrApiKey, "Accept-Language": lang },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) throw new Error(`Jellyseerr collection ${res.status}`);
    const raw = await res.json();
    const parts = (Array.isArray(raw.parts) ? raw.parts : []).map(toPart).filter((p) => p !== null);
    for (const p of parts) noteStatus("movie", p.id, p.status);
    return parts;
  }, { staleMs: PARTS_STALE_MS });
}
async function collectionProvider(cfg, q) {
  const parts = await collectionParts(cfg, q.collectionId, q.lang);
  const items = missingParts(parts, (p) => correctedStatus("movie", p.id, statusOf("movie", p.id) ?? p.status)).slice(0, q.limit).map(({ part, status }) => toCollectionItem(part, status, q.lang, q.today));
  return { query: String(q.collectionId), correction: null, complete: true, items, moreHref: null };
}

// server/routes-search.ts
var MAX_QUERY = 120;
var MAX_PAGE = 20;
function readLang(raw) {
  return typeof raw === "string" && /^[a-z]{2}$/i.test(raw) ? raw.toLowerCase() : "en";
}
function todayIso2() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
async function registerSearchRoutes(app, db, getWorkerConfig2) {
  async function context() {
    const cfg = await getWorkerConfig2();
    return cfg ? { db, cfg } : null;
  }
  void context().then((ctx) => {
    if (ctx) warmSearch(ctx);
  }).catch(() => void 0);
  app.get("/search", async (request, reply) => {
    const startedAt = Date.now();
    const query = request.query;
    const q = (query.q ?? "").slice(0, MAX_QUERY);
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const opts = {
      lang: readLang(query.lang),
      page: Math.min(Math.max(1, Number(query.page) || 1), MAX_PAGE),
      showBlocked: query.showBlocked === "1",
      exact: query.exact === "1"
    };
    const instant = query.mode === "instant";
    const ranked = instant ? instantSearch(ctx, q, opts) : await fullSearch(ctx, q, opts);
    const facets = opts.page === 1 && q.trim().length >= 2 ? [...genreFacets(q, opts.lang), ...await providerFacets(ctx.cfg, q, opts.lang, !instant)] : [];
    return presentHub(ranked, opts.page, facets, titleIndexBuilding(), startedAt, opts.showBlocked);
  });
  app.get("/search/provider", async (request, reply) => {
    const query = request.query;
    const q = (query.q ?? "").slice(0, MAX_QUERY);
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const lang = readLang(query.lang);
    const type = query.type === "movie" || query.type === "series" ? query.type : null;
    const limit = Math.min(Math.max(1, Number(query.limit) || 8), 20);
    const opts = { lang, page: 1, showBlocked: false };
    const ranked = fullIfReady(ctx, q, opts) ?? instantSearch(ctx, q, opts);
    return presentProvider(ranked, type, limit, lang, todayIso2());
  });
  app.get("/search/person", async (request, reply) => {
    const query = request.query;
    const name = (query.name ?? "").trim().slice(0, MAX_QUERY);
    const tmdb = Number(query.tmdb);
    const tmdbId = Number.isInteger(tmdb) && tmdb > 0 ? tmdb : null;
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const empty = { query: name, correction: null, complete: true, items: [], moreHref: null };
    if (!name && tmdbId === null) return empty;
    try {
      return await personProvider(ctx.cfg, {
        name,
        tmdbId,
        lang: readLang(query.lang),
        limit: Math.min(Math.max(1, Number(query.limit) || 20), 40),
        type: query.type === "movie" || query.type === "series" ? query.type : null,
        role: readRole(query.role)
      });
    } catch {
      return empty;
    }
  });
  app.get("/search/collection", async (request, reply) => {
    const query = request.query;
    const tmdb = Number(query.tmdb);
    const ctx = await context();
    if (!ctx) return reply.status(503).send({ message: "Vigie is not configured" });
    const empty = { query: String(query.tmdb ?? ""), correction: null, complete: true, items: [], moreHref: null };
    if (!Number.isInteger(tmdb) || tmdb <= 0) return empty;
    try {
      return await collectionProvider(ctx.cfg, {
        collectionId: tmdb,
        lang: readLang(query.lang),
        limit: Math.min(Math.max(1, Number(query.limit) || 20), 40),
        today: todayIso2()
      });
    } catch {
      return empty;
    }
  });
}

// server/titles/title-rights.ts
function readLang2(raw) {
  return typeof raw === "string" && /^[a-z]{2}$/i.test(raw) ? raw.toLowerCase() : "en";
}
async function rightsOf(db, userId, cfg) {
  const masked = cfg?.allowMaskedRequests === true;
  const settings = await getUserSettings(db, userId).catch(() => null);
  if (!settings) return { movies: true, tv: true, masked };
  if (settings.blocked) return { movies: false, tv: false };
  return { movies: settings.allowMovies, tv: settings.allowTv || settings.allowAnime, masked };
}

// src/utils/media-status.ts
var MEDIA_STATUS_DELETED = 7;
function isRequestedSeasonStatus(status) {
  return status !== void 0 && status >= 2 && status !== MEDIA_STATUS_DELETED;
}

// src/utils/season-locks.ts
function holds(request) {
  return request.status !== 3 && request.status !== 4;
}
function seasonLocks(info, localSeasons) {
  const map = /* @__PURE__ */ new Map();
  const deleted = /* @__PURE__ */ new Set();
  for (const s of info?.seasons ?? []) {
    if (s.status === MEDIA_STATUS_DELETED) deleted.add(s.seasonNumber);
    else if (isRequestedSeasonStatus(s.status)) map.set(s.seasonNumber, s.status);
  }
  if (info?.status !== MEDIA_STATUS_DELETED) {
    for (const r of info?.requests ?? []) {
      if (!holds(r)) continue;
      for (const se of r.seasons ?? []) {
        if (deleted.has(se.seasonNumber)) continue;
        const existing = map.get(se.seasonNumber);
        if (existing === void 0 || existing < 3) map.set(se.seasonNumber, 3);
      }
    }
  }
  for (const sn of localSeasons ?? []) {
    if (deleted.has(sn)) continue;
    const existing = map.get(sn);
    if (existing === void 0 || existing < 3) map.set(sn, 3);
  }
  return map;
}

// src/utils/request-seasons.ts
function requestableSeasons(seasons, specials) {
  const regular = seasons.filter((s) => s.seasonNumber > 0);
  if (!specials) return regular;
  return [...regular, ...seasons.filter((s) => s.seasonNumber === 0 && (s.episodeCount ?? 0) > 0)];
}

// server/titles/title-seasons.ts
var MAX_REQUESTED_SEASONS = 100;
var LABELS5 = {
  fr: { requested: "Demand\xE9e", partial: "En partie", available: "Disponible" },
  en: { requested: "Requested", partial: "Partly here", available: "Available" }
};
function seasonBadge(lock, lang) {
  const l = lang === "fr" ? LABELS5.fr : LABELS5.en;
  if (lock === MEDIA_STATUS.AVAILABLE) return { label: l.available, tone: "success" };
  if (lock === MEDIA_STATUS.PARTIALLY_AVAILABLE) return { label: l.partial, tone: "success" };
  return lock === void 0 ? null : { label: l.requested, tone: "info" };
}
function titleSeasons(detail, localSeasons, rights, opts) {
  const locks = seasonLocks(detail.mediaInfo, localSeasons);
  const masked = detail.mediaInfo?.status === MEDIA_STATUS.BLOCKLISTED && rights.masked !== true;
  const open = rights.tv && !masked;
  return requestableSeasons(detail.seasons ?? [], opts.specials).map((season) => {
    const lock = locks.get(season.seasonNumber);
    return {
      number: season.seasonNumber,
      name: typeof season.name === "string" && season.name.trim() !== "" ? season.name.trim().slice(0, 80) : null,
      episodeCount: typeof season.episodeCount === "number" ? season.episodeCount : null,
      badge: seasonBadge(lock, opts.lang),
      requestable: open && lock === void 0
    };
  });
}
function parseRequestedSeasons(raw) {
  if (!Array.isArray(raw)) return null;
  const out = /* @__PURE__ */ new Set();
  for (const value of raw) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1e3) out.add(value);
    if (out.size >= MAX_REQUESTED_SEASONS) break;
  }
  return out.size > 0 ? [...out].sort((a, b) => a - b) : null;
}
function freeSeasons(chosen, seasons) {
  const free = new Set(seasons.filter((s) => s.requestable).map((s) => s.number));
  return chosen.filter((n) => free.has(n));
}

// server/titles/title-messages.ts
var FR = {
  requested: (title) => `\xAB ${title} \xBB est demand\xE9 \u2014 vous serez pr\xE9venu \xE0 son arriv\xE9e.`,
  blocked: "Votre compte ne peut pas faire de demandes.",
  moviesDenied: "Votre compte ne peut pas demander de films.",
  masked: "Ce titre est masqu\xE9 : sa demande n'est pas ouverte.",
  quota: (limit) => `Limite atteinte : ${limit} demande${limit > 1 ? "s" : ""} par jour.`,
  already: "Ce titre est d\xE9j\xE0 demand\xE9.",
  failed: "La demande n'a pas abouti.",
  unreachable: "Jellyseerr ne r\xE9pond pas pour l'instant."
};
var EN = {
  requested: (title) => `\u201C${title}\u201D requested \u2014 you'll be notified when it arrives.`,
  blocked: "Your account can't make requests.",
  moviesDenied: "Your account can't request movies.",
  masked: "This title is hidden: it can't be requested.",
  quota: (limit) => `Limit reached: ${limit} request${limit > 1 ? "s" : ""} per day.`,
  already: "This title has already been requested.",
  failed: "The request didn't go through.",
  unreachable: "Jellyseerr isn't answering right now."
};
function words(lang) {
  return lang === "fr" ? FR : EN;
}
function requestedMessage(title, lang) {
  return words(lang).requested(title);
}
function unreachableMessage(lang) {
  return words(lang).unreachable;
}
function refusalMessage(status, body, lang) {
  const w = words(lang);
  if (status === 409) return w.already;
  if (body.errorKey === "seer:errUserBlocked") return w.blocked;
  if (body.errorKey === "seer:errMoviesDenied") return w.moviesDenied;
  if (body.errorKey === "seer:errMaskedDenied") return w.masked;
  if (body.errorKey === "seer:errQuotaReached" && typeof body.limit === "number") return w.quota(body.limit);
  return w.failed;
}

// server/routes-titles-seasons.ts
var TV_KEY = /^tv:([1-9]\d{0,9})$/;
async function readSeasons(db, cfg, user, tmdbId, lang) {
  const raw = await fetchMediaDetail(cfg.seerrUrl, cfg.seerrApiKey, "tv", tmdbId);
  if (!raw?.name) return null;
  const detail = withCorrectedInfo("tv", tmdbId, raw);
  const [local, rights, specials] = await Promise.all([
    localRequestedSeasons(db, user.userId, tmdbId).catch(() => []),
    rightsOf(db, user.userId, cfg),
    specialSeasonsQuick(cfg.seerrUrl, cfg.seerrApiKey)
  ]);
  return { detail, seasons: titleSeasons(detail, local, rights, { specials, lang }) };
}
function registerTitleSeasonRoutes(app, db, getWorkerConfig2) {
  app.get("/titles/seasons", async (request) => {
    const query = request.query;
    const match = typeof query.key === "string" ? TV_KEY.exec(query.key) : null;
    const lang = readLang2(query.lang);
    if (!match) return { seasons: [] };
    const cfg = await getWorkerConfig2();
    const read = cfg ? await readSeasons(db, cfg, getUser(request), Number(match[1]), lang) : null;
    if (!read) return { ok: false, message: unreachableMessage(lang), seasons: [] };
    return { seasons: read.seasons };
  });
}
async function requestSeasons(db, getWorkerConfig2, user, tmdbId, chosen, lang, origin = null) {
  const cfg = await getWorkerConfig2();
  if (!cfg) return { ok: false, message: unreachableMessage(lang) };
  const read = await readSeasons(db, cfg, user, tmdbId, lang);
  if (!read) return { ok: false, message: unreachableMessage(lang) };
  const rights = await rightsOf(db, user.userId, cfg);
  const known = read.detail.mediaInfo?.status;
  const seasons = freeSeasons(chosen, read.seasons);
  if (seasons.length === 0) {
    return { ok: false, message: refusalMessage(409, {}, lang), state: titleStateFor("tv", tmdbId, known, rights, lang) };
  }
  const { detail } = read;
  const result = await submitRequest(db, getWorkerConfig2, user, {
    mediaType: "tv",
    tmdbId,
    title: detail.name,
    posterPath: detail.posterPath ?? null,
    backdropPath: detail.backdropPath ?? null,
    overview: detail.overview ?? null,
    year: detail.firstAirDate ? detail.firstAirDate.slice(0, 4) : null,
    seasons
  }, origin);
  if (result.status !== 201) return { ok: false, message: refusalMessage(result.status, result.body, lang) };
  const after = known === MEDIA_STATUS.PARTIALLY_AVAILABLE ? known : MEDIA_STATUS.PENDING;
  return { ok: true, message: requestedMessage(detail.name, lang), state: titleStateFor("tv", tmdbId, after, rights, lang) };
}

// server/titles/my-titles.ts
var MAX_MY_TITLES = 50;
var WAITING3 = /* @__PURE__ */ new Set([
  "queued",
  "processing",
  "sent_to_seer",
  "approved",
  "unavailable",
  "retry_pending"
]);
var RANK2 = { pending: 1, blocked: 2, importing: 3, arriving: 4 };
var still = (state2) => ({ state: state2, percent: null, etaSeconds: null });
function etaOf(download) {
  const eta = download.etaSeconds;
  return download.status === "downloading" && typeof eta === "number" && Number.isFinite(eta) && eta > 0 ? Math.round(eta) : null;
}
function arriving(download) {
  if (download.stalled) return still("blocked");
  if (download.validating) return still("importing");
  const percent = download.percent;
  return {
    state: "arriving",
    percent: typeof percent === "number" && Number.isFinite(percent) ? Math.round(percent * 10) / 10 : null,
    etaSeconds: etaOf(download)
  };
}
function verdictOf(request, arr) {
  const status = arr?.status ?? request.status;
  const download = arr ? arr.download : request.download ?? null;
  if (status === "downloading") return download ? arriving(download) : still("arriving");
  if (status === "partially_available") return download ? arriving(download) : null;
  return WAITING3.has(status) ? still("pending") : null;
}
function yearOf2(raw) {
  const year = raw && /^\d{4}/.test(raw) ? Number(raw.slice(0, 4)) : NaN;
  return Number.isInteger(year) ? year : null;
}
function myTitles(requests, verdicts) {
  const byKey = /* @__PURE__ */ new Map();
  for (const request of requests) {
    if (!(request.tmdbId > 0)) continue;
    const verdict = verdictOf(request, verdicts.get(request.id));
    if (!verdict) continue;
    const key = `${request.mediaType}:${request.tmdbId}`;
    const seasons = request.mediaType === "tv" && request.seasons?.length ? request.seasons : null;
    const known = byKey.get(key);
    if (!known) {
      if (byKey.size >= MAX_MY_TITLES) continue;
      byKey.set(key, {
        key,
        title: request.title,
        year: yearOf2(request.year),
        imageUrl: request.posterPath ? `https://image.tmdb.org/t/p/w185${request.posterPath}` : null,
        seasons: seasons ? [...new Set(seasons)].sort((a, b) => a - b) : null,
        ...verdict
      });
      continue;
    }
    if (known.seasons && seasons) known.seasons = [.../* @__PURE__ */ new Set([...known.seasons, ...seasons])].sort((a, b) => a - b);
    else known.seasons = null;
    if (RANK2[verdict.state] > RANK2[known.state]) Object.assign(known, verdict);
  }
  return [...byKey.values()];
}

// server/routes-titles.ts
var MINE_TTL_MS = 1e4;
var MINE_META_BUDGET = 10;
function registerTitleRoutes(app, db, getWorkerConfig2) {
  app.get("/titles/state", async (request) => {
    const query = request.query;
    const keys2 = parseTitleKeys(query.keys);
    const cfg = await getWorkerConfig2();
    if (!cfg || keys2.length === 0) return { items: {} };
    refreshStatusMap(cfg);
    refreshLocalPending(db);
    const lang = readLang2(query.lang);
    const rights = await rightsOf(db, getUser(request).userId, cfg);
    const items = {};
    for (const k of keys2) {
      const status = statusFor({ key: k.key, mediaType: k.mediaType, tmdbId: k.tmdbId, remoteStatus: void 0 });
      const state2 = titleStateFor(k.mediaType, k.tmdbId, status, rights, lang);
      const page = titlePage(k.mediaType, k.tmdbId, rights, lang);
      items[k.key] = page ? { ...state2, page } : state2;
    }
    return { items };
  });
  app.post("/titles/request", async (request, reply) => {
    const body = request.body ?? {};
    const mediaType = body.mediaType === "movie" || body.mediaType === "tv" ? body.mediaType : null;
    const tmdbId = Number(body.tmdbId);
    if (!mediaType || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
      return reply.status(400).send({ ok: false, message: "mediaType and tmdbId are required" });
    }
    const lang = readLang2(body.lang);
    const origin = readRequestOrigin(body);
    if (mediaType === "tv") {
      const seasons = parseRequestedSeasons(body.seasons);
      if (!seasons) return { href: seasonsHref(tmdbId) };
      return requestSeasons(db, getWorkerConfig2, getUser(request), tmdbId, seasons, lang, origin);
    }
    const cfg = await getWorkerConfig2();
    if (!cfg) return { ok: false, message: unreachableMessage(lang) };
    const user = getUser(request);
    const rights = await rightsOf(db, user.userId, cfg);
    const detail = await fetchMediaDetail(cfg.seerrUrl, cfg.seerrApiKey, "movie", tmdbId);
    if (!detail?.title) return { ok: false, message: unreachableMessage(lang) };
    const known = correctMediaInfo("movie", tmdbId, detail.mediaInfo)?.status;
    const liftable = known === MEDIA_STATUS.BLOCKLISTED && cfg.allowMaskedRequests === true;
    if (known !== void 0 && known >= MEDIA_STATUS.PENDING && known <= MEDIA_STATUS.BLOCKLISTED && !liftable) {
      noteStatus("movie", tmdbId, known);
      return { ok: false, message: refusalMessage(409, {}, lang), state: titleStateFor("movie", tmdbId, known, rights, lang) };
    }
    const result = await submitRequest(db, getWorkerConfig2, user, {
      mediaType: "movie",
      tmdbId,
      title: detail.title,
      posterPath: detail.posterPath ?? null,
      backdropPath: detail.backdropPath ?? null,
      overview: detail.overview ?? null,
      year: detail.releaseDate ? detail.releaseDate.slice(0, 4) : null
    }, origin);
    if (result.status === 201) {
      return {
        ok: true,
        message: requestedMessage(detail.title, lang),
        state: titleStateFor("movie", tmdbId, MEDIA_STATUS.PENDING, rights, lang)
      };
    }
    return { ok: false, message: refusalMessage(result.status, result.body, lang) };
  });
  app.get("/titles/access", async (request) => {
    const cfg = await getWorkerConfig2();
    if (!cfg) return { request: false };
    const rights = await rightsOf(db, getUser(request).userId, cfg);
    return { request: rights.movies || rights.tv };
  });
  app.get("/titles/mine", async (request) => {
    const user = getUser(request);
    const origin = readOriginFilter(request.query.origin);
    const cfg = await getWorkerConfig2();
    if (!cfg) return { items: [] };
    const key = `seer-cache:${user.userId}:mine${origin === void 0 ? "" : `:origin=${origin}`}`;
    return cached(key, MINE_TTL_MS, async () => {
      const rows = await loadMergedRows(db, cfg, user, (err, msg) => app.log?.warn?.({ err }, msg));
      const { meta, missing } = await resolveTmdbMeta(db, cfg, collectTmdbRefs(rows), { maxFetch: 0 });
      const requests = ofOrigin(hydrateRows(rows, meta, user), origin);
      const verdicts = await arrVerdicts(cfg, requests).catch(() => /* @__PURE__ */ new Map());
      let items = myTitles(requests, verdicts);
      const waiting = new Set(items.map((i) => i.key));
      const absent = missing.filter((ref) => waiting.has(tmdbKey(ref)));
      if (absent.length > 0) {
        const filled = await resolveTmdbMeta(db, cfg, absent, { maxFetch: MINE_META_BUDGET });
        for (const [k, v] of filled.meta) meta.set(k, v);
        items = myTitles(ofOrigin(hydrateRows(rows, meta, user), origin), verdicts);
      }
      return { items };
    });
  });
}

// server/titles/title-gaps.ts
var MAX_GAP_KEYS = 60;
var MAX_GAP_LOOKUPS = 24;
function hasGapsToTell(status) {
  return status === MEDIA_STATUS.PARTIALLY_AVAILABLE;
}
function seriesGaps(detail, localSeasons, rights, opts) {
  const locks = seasonLocks(detail.mediaInfo, localSeasons);
  return titleSeasons(detail, localSeasons, rights, opts).filter((season) => {
    const lock = locks.get(season.number);
    return lock !== MEDIA_STATUS.AVAILABLE && lock !== MEDIA_STATUS.PARTIALLY_AVAILABLE;
  });
}

// server/routes-titles-gaps.ts
var DETAIL_TTL_MS = 6e4;
var LOOKUP_CONCURRENCY = 4;
function tvDetail(cfg, tmdbId) {
  return cached(`seer:gaps:tv:${tmdbId}`, DETAIL_TTL_MS, async () => {
    const detail = await fetchMediaDetail(cfg.seerrUrl, cfg.seerrApiKey, "tv", tmdbId);
    if (!detail?.name) throw new Error(`Jellyseerr GET /tv/${tmdbId} : rien`);
    return detail;
  });
}
function registerTitleGapRoutes(app, db, getWorkerConfig2) {
  app.get("/titles/gaps", async (request) => {
    const query = request.query;
    const keys2 = parseTitleKeys(query.keys).filter((k) => k.mediaType === "tv").slice(0, MAX_GAP_KEYS);
    const cfg = await getWorkerConfig2();
    if (!cfg || keys2.length === 0) return { items: {} };
    refreshStatusMap(cfg);
    refreshLocalPending(db);
    const partial = keys2.filter((k) => hasGapsToTell(statusFor({ key: k.key, mediaType: k.mediaType, tmdbId: k.tmdbId, remoteStatus: void 0 }))).slice(0, MAX_GAP_LOOKUPS);
    if (partial.length === 0) return { items: {} };
    const lang = readLang2(query.lang);
    const user = getUser(request);
    const [rights, specials] = await Promise.all([
      rightsOf(db, user.userId, cfg),
      specialSeasonsQuick(cfg.seerrUrl, cfg.seerrApiKey)
    ]);
    const items = {};
    await mapLimit(partial, LOOKUP_CONCURRENCY, async (k) => {
      const [detail, local] = await Promise.all([
        tvDetail(cfg, k.tmdbId),
        localRequestedSeasons(db, user.userId, k.tmdbId).catch(() => [])
      ]);
      const seasons = seriesGaps(withCorrectedInfo("tv", k.tmdbId, detail), local, rights, { specials, lang });
      if (seasons.length > 0) items[k.key] = { seasons };
    });
    return { items };
  });
}

// server/live/jellyfin-check.ts
var isReal = (it) => it.LocationType !== "Virtual";
var LIMIT = 50;
function tmdbOf2(ids) {
  if (!ids) return null;
  for (const [key, value] of Object.entries(ids)) if (key.toLowerCase() === "tmdb" && value) return value;
  return null;
}
var typeOf = (t) => t.mediaType === "movie" ? "Movie" : "Series";
async function session(db) {
  const creds = await jellyfinCredentials(db);
  if (!creds) return null;
  const accounts = await fetchJellyfinAccounts(db);
  const admin = accounts.find((a) => a.isAdmin && !a.isDisabled);
  if (!admin) return null;
  return { base: creds.url, headers: jellyfinAuthHeaders(creds.apiKey), userId: admin.id };
}
async function getItems(s, query, timeoutMs) {
  const res = await fetch(`${s.base}/Users/${encodeURIComponent(s.userId)}/Items?${query}`, {
    headers: s.headers,
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`Jellyfin GET /Items ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data.Items) ? data.Items : [];
  return { items, total: typeof data.TotalRecordCount === "number" ? data.TotalRecordCount : items.length };
}
async function findByTmdb(s, t) {
  const params = new URLSearchParams({
    Recursive: "true",
    IncludeItemTypes: typeOf(t),
    AnyProviderIdEquals: `Tmdb.${t.tmdbId}`,
    Fields: "ProviderIds",
    EnableImages: "false",
    EnableUserData: "false",
    Limit: String(LIMIT)
  });
  const { items, total } = await getItems(s, params.toString(), 8e3);
  const match = items.find((it) => tmdbOf2(it.ProviderIds) === String(t.tmdbId));
  if (match) return match;
  const filtered = items.every((it) => tmdbOf2(it.ProviderIds) === String(t.tmdbId));
  return filtered && total <= LIMIT ? null : void 0;
}
async function wholeIndex(s) {
  const params = new URLSearchParams({
    Recursive: "true",
    IncludeItemTypes: "Movie,Series",
    HasTmdbId: "true",
    Fields: "ProviderIds",
    EnableImages: "false",
    EnableUserData: "false"
  });
  const { items } = await getItems(s, params.toString(), 3e4);
  const out = /* @__PURE__ */ new Map();
  for (const it of items) {
    const tmdb = tmdbOf2(it.ProviderIds);
    const type = it.Type === "Movie" ? "movie" : it.Type === "Series" ? "tv" : null;
    if (tmdb && type && !out.has(`${type}:${tmdb}`)) out.set(`${type}:${tmdb}`, it);
  }
  return out;
}
async function seasonsOf2(s, seriesId) {
  const params = new URLSearchParams({
    userId: s.userId,
    IsMissing: "false",
    Fields: "",
    EnableImages: "false",
    EnableUserData: "false"
  });
  const res = await fetch(`${s.base}/Shows/${encodeURIComponent(seriesId)}/Episodes?${params}`, {
    headers: s.headers,
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) throw new Error(`Jellyfin GET /Shows/{id}/Episodes ${res.status}`);
  const data = await res.json();
  const out = /* @__PURE__ */ new Set();
  for (const ep of data.Items ?? []) {
    if (isReal(ep) && typeof ep.ParentIndexNumber === "number") out.add(ep.ParentIndexNumber);
  }
  return out;
}
async function checkInJellyfin(db, targets) {
  const out = /* @__PURE__ */ new Map();
  const keyOf = (t) => `${t.mediaType}:${t.tmdbId}`;
  let s = null;
  try {
    s = await session(db);
  } catch {
    s = null;
  }
  if (!s) {
    for (const t of targets) out.set(keyOf(t), null);
    return out;
  }
  let index = null;
  for (const t of targets) {
    try {
      let item = await findByTmdb(s, t);
      if (item === void 0) {
        index ??= await wholeIndex(s);
        item = index.get(keyOf(t)) ?? null;
      }
      if (!item?.Id || !isReal(item)) {
        out.set(keyOf(t), { present: false, presentSeasons: t.mediaType === "tv" ? /* @__PURE__ */ new Set() : void 0 });
        continue;
      }
      if (t.mediaType === "tv") {
        const presentSeasons = await seasonsOf2(s, item.Id);
        out.set(keyOf(t), { present: presentSeasons.size > 0, presentSeasons });
      } else {
        out.set(keyOf(t), { present: true });
      }
    } catch {
      out.set(keyOf(t), null);
    }
  }
  return out;
}

// server/live/library-store.ts
function sameLibrarySignature(a, b) {
  return !!a && !!b && a.total === b.total && a.departed === b.departed && a.last === b.last;
}
function ms(v) {
  return readStoredDate(v)?.getTime() ?? null;
}
var ROWS_SQL = `
  SELECT CASE WHEN contentKey LIKE 'e:t:%' THEN rtrim(contentKey, '0123456789') ELSE contentKey END AS k,
         MAX(CASE WHEN removedAt IS NULL THEN 1 ELSE 0 END) AS present,
         MAX(removedAt) AS departedAt
  FROM library_known_id
  WHERE contentKey LIKE 'm:t:%' OR contentKey LIKE 'e:t:%'
  GROUP BY k`;
function coreLibraryStore(db) {
  let warned2 = false;
  const unusable = (err) => {
    if (!warned2) {
      warned2 = true;
      console.warn(
        `[VigieLive] Liste des items de Jellyfin du serveur illisible \u2014 les suppressions ne seront vues que par Jellyseerr : ${err instanceof Error ? err.message : err}`
      );
    }
    return null;
  };
  return {
    async signature() {
      try {
        const [row] = await db.query(
          "SELECT COUNT(*) AS total, COUNT(removedAt) AS departed, MAX(removedAt) AS last FROM library_known_id"
        );
        warned2 = false;
        return { total: Number(row?.total ?? 0), departed: Number(row?.departed ?? 0), last: ms(row?.last) };
      } catch (err) {
        return unusable(err);
      }
    },
    async rows() {
      try {
        const rows = await db.query(ROWS_SQL);
        return rows.filter((r) => typeof r.k === "string").map((r) => ({ key: r.k, present: Number(r.present) === 1, departedAt: ms(r.departedAt) }));
      } catch (err) {
        return unusable(err);
      }
    }
  };
}

// server/live/local-requests.ts
var CLOSED = ["deleted", "deleting", "delete_failed"];
async function forgetLocalRequests(db, seerrRequestIds, reason) {
  const ids = [...new Set(seerrRequestIds.filter((n) => Number.isSafeInteger(n) && n > 0))];
  if (ids.length === 0) return 0;
  let closed = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk2 = ids.slice(i, i + 200);
    closed += await db.execute(
      `UPDATE seer_requests SET updated_at = ${db.sql.now()}, status = 'deleted', last_error = ?
       WHERE seerr_request_id IN (${chunk2.map(() => "?").join(", ")})
         AND status NOT IN (${CLOSED.map(() => "?").join(", ")})`,
      reason,
      ...chunk2,
      ...CLOSED
    );
  }
  return closed;
}
async function openLocalRequestsFor(db, mediaType, tmdbId) {
  const rows = await db.query(
    `SELECT * FROM seer_requests WHERE media_type = ? AND tmdb_id = ?
       AND status NOT IN (${CLOSED.map(() => "?").join(", ")})
     ORDER BY created_at ASC, id ASC`,
    mediaType,
    tmdbId,
    ...CLOSED
  );
  return rows.map(rowToRequest);
}

// server/live/live-sync.ts
var TICK_MS = 5e3;
var ACTIVE_EVERY_MS = 1e4;
var IDLE_EVERY_MS = 6e4;
var ACTIVE_WINDOW_MS = 5 * 6e4;
var RECHECK_MS = 2 * 6e4;
var CHECKS_PER_PASS = 8;
var timer2 = null;
var deps = null;
var lastActivity = 0;
var lastRun = 0;
var busy = false;
var librarySig = null;
var seerrUrl = null;
function markActivity(now = Date.now()) {
  const idle = now - lastActivity >= ACTIVE_WINDOW_MS;
  lastActivity = now;
  if (idle && deps && !busy) lastRun = 0;
}
function liveGeneration() {
  return liveState.generation;
}
function startLiveSync(d) {
  if (timer2) return;
  deps = d;
  timer2 = setInterval(() => {
    void tick();
  }, TICK_MS);
  timer2.unref?.();
  setTimeout(() => {
    void tick(true);
  }, 3e3).unref?.();
}
function stopLiveSync() {
  if (timer2) clearInterval(timer2);
  timer2 = null;
  deps = null;
}
async function tick(force = false) {
  const d = deps;
  if (!d || busy) return;
  const now = Date.now();
  const every = now - lastActivity < ACTIVE_WINDOW_MS ? ACTIVE_EVERY_MS : IDLE_EVERY_MS;
  if (!force && now - lastRun < every) return;
  busy = true;
  lastRun = now;
  try {
    await runPass(d, now);
  } catch (err) {
    console.warn("[VigieLive] Passe interrompue :", err);
  } finally {
    busy = false;
  }
}
async function runPass(d, now = Date.now()) {
  const libraryChanged = await refreshLibrary(d.store);
  const checked = await confirmDepartures(d.db, now);
  const cfg = await d.getWorkerConfig();
  if (!cfg) return;
  if (cfg.seerrUrl !== seerrUrl) {
    if (seerrUrl !== null) requestIndex.reset();
    seerrUrl = cfg.seerrUrl;
  }
  const change = await requestIndex.poll(cfg, now);
  if (change) await applyIndexChange(d.db, cfg, change);
  if (libraryChanged || checked) {
    invalidate("vigie:marks");
    if (!change) invalidateRequestCaches();
  }
  if (d.afterPass) await d.afterPass(cfg, now);
}
async function refreshLibrary(store2) {
  const sig = await store2.signature();
  if (sig === null) return liveState.setLibrary(null);
  if (sameLibrarySignature(sig, librarySig) && liveState.libraryReadable) return false;
  const rows = await store2.rows();
  if (rows === null) return liveState.setLibrary(null);
  librarySig = sig;
  return liveState.setLibrary(rows);
}
function departuresToCheck(now) {
  const out = [];
  for (const dep of liveState.departures()) {
    if (now - dep.at >= SETTLE_MS) continue;
    const key = `${dep.mediaType}:${dep.tmdbId}`;
    const check2 = liveState.checks.get(key);
    if (check2 && check2.at >= dep.at && now - check2.at < RECHECK_MS) continue;
    out.push({ mediaType: dep.mediaType, tmdbId: dep.tmdbId, seasons: dep.mediaType === "tv" ? dep.seasons : void 0 });
  }
  return out.slice(0, CHECKS_PER_PASS);
}
async function confirmDepartures(db, now) {
  const targets = departuresToCheck(now);
  if (targets.length === 0) return false;
  const results = await checkInJellyfin(db, targets);
  let changed = false;
  for (const [key, result] of results) {
    if (!result) continue;
    changed = liveState.setCheck(key, { at: Date.now(), present: result.present, presentSeasons: result.presentSeasons }) || changed;
  }
  return changed;
}
async function applyIndexChange(db, cfg, change) {
  if (change.deleted.length > 0) {
    const forgotten = await forgetLocalRequests(db, change.deleted.map((r) => r.id), "Demande supprim\xE9e c\xF4t\xE9 Jellyseerr");
    if (forgotten > 0) refreshLocalPending(db, true);
    const titles = change.deleted.map((r) => `${r.mediaType}:${r.tmdbId}#${r.id}`).join(", ");
    console.log(`[VigieLive] Demande(s) supprim\xE9e(s) dans Jellyseerr : ${titles} \u2014 ${forgotten} ligne(s) de la file close(s)`);
  }
  invalidateRequestCaches();
  statusMapStale();
  refreshStatusMap(cfg);
}

// server/live/auto-forget-plan.ts
function madeBefore(createdAt, at) {
  return createdAt == null || !Number.isFinite(createdAt) || createdAt <= at;
}
var FORGET_GRACE_MS = 10 * 6e4;
var MASS_WINDOW_MS = 60 * 6e4;
var MASS_TITLES = 20;
function forgetCandidates({ departures, options, now, graceMs = FORGET_GRACE_MS }) {
  if (!options.enabled || options.since === null) return { kind: "none" };
  const since = options.since;
  const recent = departures.filter((d) => d.at >= since && now - d.at <= MASS_WINDOW_MS);
  if (recent.length > MASS_TITLES) return { kind: "mass", count: recent.length };
  const ready = departures.filter((d) => d.at >= since && now - d.at >= graceMs);
  return ready.length > 0 ? { kind: "ready", departures: ready } : { kind: "none" };
}
function planJobs(dep, requests) {
  const jobs = [];
  for (const r of requests) {
    if (!isLiveRequest(r) || !madeBefore(r.createdAt, dep.at)) continue;
    const base = { localId: r.localId, jellyfinUserId: r.jellyfinUserId };
    if (dep.mediaType === "movie") {
      jobs.push({ ...base, seerrRequestId: r.seerrRequestId, seasons: null, whole: true });
      continue;
    }
    if (r.seasons.length === 0) {
      if (dep.whole) jobs.push({ ...base, seerrRequestId: r.seerrRequestId, seasons: null, whole: true });
      continue;
    }
    const gone = r.seasons.filter((s) => dep.seasons.includes(s));
    if (gone.length === 0) continue;
    const whole = gone.length === r.seasons.length || r.status === REQUEST.COMPLETED;
    jobs.push({ ...base, seerrRequestId: whole ? r.seerrRequestId : null, seasons: gone, whole });
  }
  return jobs;
}

// server/live/auto-forget.ts
var msOf = (iso) => {
  const ms2 = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms2) ? ms2 : null;
};
var COOLDOWN_MS = 15 * 6e4;
var MASS_WARN_EVERY_MS = 60 * 6e4;
var TITLES_PER_PASS = 5;
function forgetOptionsOf(config) {
  const since = Number(config.deleteRequestsWithMediaSince);
  return {
    enabled: config.deleteRequestsWithMedia === true,
    since: Number.isFinite(since) && since > 0 ? since : null
  };
}
async function titleOf(db, dep, fallback) {
  if (fallback) return fallback;
  const meta = await getTmdbMetaBulk(db, [{ mediaType: dep.mediaType, tmdbId: dep.tmdbId }]).catch(() => null);
  return meta?.get(`${dep.mediaType}:${dep.tmdbId}`)?.title || `${dep.mediaType === "movie" ? "Film" : "S\xE9rie"} #${dep.tmdbId}`;
}
async function hasPendingCleanup(db, seerrRequestId) {
  const rows = await db.query(
    "SELECT COUNT(*) AS n FROM seer_cleanup_queue WHERE status = 'pending' AND seerr_request_id = ?",
    seerrRequestId
  );
  return Number(rows[0]?.n ?? 0) > 0;
}
function createAutoForget(db, readConfig) {
  const handled = /* @__PURE__ */ new Map();
  let lastMassWarn = 0;
  return async function autoForget(_cfg, now) {
    const options = forgetOptionsOf(readConfig());
    if (!options.enabled || !requestIndex.ready || !liveState.libraryReadable) return;
    for (const [key, at] of handled) if (now - at > COOLDOWN_MS) handled.delete(key);
    const plan = forgetCandidates({ departures: liveState.departures(), options, now });
    if (plan.kind === "mass") {
      if (now - lastMassWarn > MASS_WARN_EVERY_MS) {
        lastMassWarn = now;
        console.warn(
          `[VigieLive] ${plan.count} titres partis de Jellyfin en moins d'une heure : trop pour \xEAtre une suppression voulue (disque ou partage d\xE9branch\xE9 ?). Aucune demande n'est supprim\xE9e automatiquement.`
        );
      }
      return;
    }
    if (plan.kind !== "ready") return;
    const targets = plan.departures.filter((d) => !handled.has(`${d.mediaType}:${d.tmdbId}`)).filter((d) => (requestIndex.requestsFor(d.mediaType, d.tmdbId) ?? []).some((r) => isLiveRequest(r) && madeBefore(msOf(r.createdAt), d.at))).slice(0, TITLES_PER_PASS);
    if (targets.length === 0) return;
    const checks = await checkInJellyfin(db, targets.map((d) => ({ mediaType: d.mediaType, tmdbId: d.tmdbId, seasons: d.seasons })));
    let enqueued = 0;
    for (const dep of targets) {
      const key = `${dep.mediaType}:${dep.tmdbId}`;
      const check2 = checks.get(key);
      if (!check2) continue;
      handled.set(key, now);
      let effective = dep;
      if (dep.mediaType === "movie" || dep.whole) {
        if (check2.present) continue;
      } else {
        const gone = dep.seasons.filter((s) => !check2.presentSeasons?.has(s));
        if (gone.length === 0) continue;
        effective = { ...dep, seasons: gone };
      }
      enqueued += await forgetTitle(db, effective);
    }
    if (enqueued > 0) {
      invalidateRequestCaches();
      kickWorkerNow();
    }
  };
}
async function forgetTitle(db, dep) {
  const indexed = requestIndex.requestsFor(dep.mediaType, dep.tmdbId) ?? [];
  const locals = await openLocalRequestsFor(db, dep.mediaType, dep.tmdbId);
  const localBySeerr = new Map(locals.filter((l) => l.seerrRequestId).map((l) => [l.seerrRequestId, l]));
  const requests = indexed.map((r) => {
    const local = localBySeerr.get(r.id) ?? null;
    return {
      seerrRequestId: r.id,
      status: r.status,
      seasons: r.seasons,
      is4k: r.is4k,
      localId: local?.id ?? null,
      jellyfinUserId: local?.jellyfinUserId ?? r.requestedBy.jellyfinUserId,
      createdAt: msOf(r.createdAt)
    };
  });
  const jobs = planJobs(dep, requests);
  if (jobs.length === 0) return 0;
  const title = await titleOf(db, dep, locals[0]?.title ?? null);
  let count = 0;
  for (const job of jobs) {
    if (job.seerrRequestId !== null && await hasPendingCleanup(db, job.seerrRequestId)) continue;
    await enqueueCleanup(db, {
      action: "delete",
      mediaType: dep.mediaType,
      tmdbId: dep.tmdbId,
      title,
      seerrRequestId: job.seerrRequestId,
      deleteFiles: false,
      seasons: job.seasons,
      requestId: job.whole ? job.localId : null,
      jellyfinUserId: job.jellyfinUserId
    });
    if (job.localId) {
      if (job.whole) await updateRequestStatus(db, job.localId, "deleting");
      else {
        const local = locals.find((l) => l.id === job.localId);
        const remaining = (local?.seasons ?? []).filter((s) => !(job.seasons ?? []).includes(s));
        if (remaining.length > 0) await addSeasonsToRequest(db, job.localId, remaining);
      }
    }
    count++;
  }
  const what = dep.mediaType === "movie" || dep.whole ? "supprim\xE9" : `saison(s) ${dep.seasons.join(", ")} supprim\xE9e(s)`;
  console.log(`[VigieLive] \xAB ${title} \xBB ${what} de Jellyfin \u2014 ${count} demande(s) retir\xE9e(s) de Jellyseerr et de Vigie (option \xAB avec le titre \xBB)`);
  return count;
}

// server/live/routes-live.ts
function registerLiveRoutes(app) {
  app.get("/sync/state", async () => ({ generation: liveGeneration() }));
}

// server/index.ts
var __pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));
function getPluginConfig(ctx) {
  return readPluginConfig(__pluginDir, ctx.pluginId);
}
async function getWorkerConfig(ctx) {
  const config = getPluginConfig(ctx);
  const url = config.url;
  const apiKey = config.apiKey;
  if (!url || !apiKey) return null;
  const profiles = config.profiles ?? [];
  return {
    seerrUrl: url.replace(/\/$/, ""),
    seerrApiKey: apiKey,
    interval: 6e4,
    syncEvery: 2,
    profiles,
    autoApprove: config.autoApprove === true,
    defaultDailyLimit: defaultDailyLimit(config),
    allowMaskedRequests: config.allowMaskedRequests === true
  };
}
async function seerBackend(app, ctx) {
  const db = await openVigieDb(ctx);
  if (!db) return;
  applyNavLabel(__pluginDir, ctx.pluginId, navLabelsOf(getPluginConfig(ctx)));
  onTitleRequested(ctx.recommendations?.titleRequested ?? null);
  startWorker(db, () => getWorkerConfig(ctx));
  startLiveSync({
    db,
    store: coreLibraryStore(db),
    getWorkerConfig: () => getWorkerConfig(ctx),
    afterPass: createAutoForget(db, () => getPluginConfig(ctx))
  });
  void getWorkerConfig(ctx).then((w) => w ? specialSeasonsEnabled(w.seerrUrl, w.seerrApiKey) : false).catch(() => false);
  app.addHook("onClose", async () => {
    stopWorker();
    stopLiveSync();
  });
  app.addHook("preHandler", ctx.requireAuth);
  app.addHook("onRequest", async () => {
    markActivity();
  });
  app.get("/config", async (request) => {
    const config = getPluginConfig(ctx);
    const user = request.user;
    const worker = await getWorkerConfig(ctx);
    const requests = {
      specialSeasons: worker ? await specialSeasonsQuick(worker.seerrUrl, worker.seerrApiKey) : false,
      maskedRequests: config.allowMaskedRequests === true
    };
    if (user?.isAdmin) {
      return { ...config, navLabels: navLabelsOf(config), isAdmin: true, ...requests };
    }
    return {
      url: config.url || "",
      enabled: !!config.enabled,
      hasApiKey: !!config.apiKey,
      isAdmin: false,
      navLabels: navLabelsOf(config),
      ...requests
    };
  });
  app.put("/config", { preHandler: ctx.requireAdmin }, async (request, reply) => {
    const saved = writePluginConfig(__pluginDir, ctx.pluginId, request.body);
    if (!saved) return reply.status(404).send({ error: "Plugin not found in installed.json" });
    return saved;
  });
  registerProxyRoutes(app, () => getPluginConfig(ctx));
  const gwc = () => getWorkerConfig(ctx);
  registerRequestRoutes(app, db, gwc);
  registerBulkRoutes(app, db, gwc);
  registerProfileRoutes(app, () => getPluginConfig(ctx), () => {
    const c = getPluginConfig(ctx);
    const url = c.url;
    const apiKey = c.apiKey;
    if (!url || !apiKey) return null;
    return { seerrUrl: url.replace(/\/$/, ""), seerrApiKey: apiKey };
  });
  registerUsersRoutes(app, db, gwc, ctx.requireAdmin, () => defaultDailyLimit(getPluginConfig(ctx)));
  registerUserSyncRoutes(app, db, gwc, ctx.requireAdmin);
  registerOwnershipRoutes(app, db, gwc, ctx.requireAdmin);
  registerConnectionRoutes(app, ctx.requireAdmin);
  registerAvailabilityRoutes(app, db, gwc);
  registerProgressRoutes(app, db, gwc, ctx.requireAdmin);
  registerAllRequestsRoutes(app, db, gwc, ctx.requireAdmin);
  registerCalendarRoutes(app, db, gwc);
  registerMiscRoutes(app, db, gwc, ctx.requireAdmin);
  await registerSearchRoutes(app, db, gwc);
  registerTitleRoutes(app, db, gwc);
  registerTitleSeasonRoutes(app, db, gwc);
  registerTitleGapRoutes(app, db, gwc);
  registerLiveRoutes(app);
  console.log("[SeerBackend] Routes registered");
}
export {
  seerBackend as default
};
