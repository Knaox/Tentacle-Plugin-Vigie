/* ------------------------------------------------------------------ */
/*  Vigie — La configuration de l'extension (installed.json)            */
/* ------------------------------------------------------------------ */

/*
 * Extrait d'index.ts. La configuration vit dans le `installed.json` du
 * serveur Tentacle, à côté du dossier de l'extension. Elle est gardée en
 * mémoire tant que le fichier ne change pas (sa date de modification fait
 * foi) : elle est lue à chaque requête et à chaque tick du worker.
 */

import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "fs";
import { resolve } from "path";
import { applyNavLabel, cleanNavLabel } from "./nav-label";

export type PluginConfig = Record<string, unknown>;

let cfgCache: { mtimeMs: number; value: PluginConfig } | null = null;

function installedPath(pluginDir: string): string {
  return resolve(pluginDir, "..", "installed.json");
}

function findEntry(installed: unknown, pluginId: string): Record<string, unknown> | undefined {
  if (!Array.isArray(installed)) return undefined;
  return installed.find(
    (p: { pluginId?: string; id?: string }) => p.pluginId === pluginId || p.id === pluginId,
  );
}

export function readPluginConfig(pluginDir: string, pluginId: string): PluginConfig {
  try {
    const path = installedPath(pluginDir);
    if (!existsSync(path)) return {};
    const mtimeMs = statSync(path).mtimeMs;
    if (cfgCache && cfgCache.mtimeMs === mtimeMs) return cfgCache.value;
    const entry = findEntry(JSON.parse(readFileSync(path, "utf-8")), pluginId);
    const value = (entry?.config as PluginConfig | undefined) || {};
    cfgCache = { mtimeMs, value };
    return value;
  } catch {
    return {};
  }
}

/**
 * Ce qu'on enregistre, remis en forme. Le formulaire envoyait l'objet tel
 * quel : une limite saisie « 3.5 » ou négative partait en l'état.
 */
export function normalizeConfig(body: unknown): PluginConfig {
  const input = (body && typeof body === "object" ? body : {}) as PluginConfig;
  const limit = Math.floor(Number(input.userLimit));
  return {
    ...input,
    url: typeof input.url === "string" ? input.url.trim() : "",
    apiKey: typeof input.apiKey === "string" ? input.apiKey.trim() : "",
    enabled: input.enabled === true,
    autoApprove: input.autoApprove === true,
    userLimit: Number.isFinite(limit) && limit > 0 ? limit : 0,
    navLabel: cleanNavLabel(input.navLabel),
    profiles: Array.isArray(input.profiles) ? input.profiles : [],
  };
}

/** Enregistre la configuration et applique le nom d'onglet. `null` : extension introuvable. */
export function writePluginConfig(pluginDir: string, pluginId: string, body: unknown): PluginConfig | null {
  const path = installedPath(pluginDir);
  if (!existsSync(path)) return null;
  const installed = JSON.parse(readFileSync(path, "utf-8"));
  const entry = findEntry(installed, pluginId);
  if (!entry) return null;
  const config = normalizeConfig(body);
  entry.config = config;
  const tmp = `${path}.vigie-${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(installed, null, 2));
  renameSync(tmp, path);
  applyNavLabel(pluginDir, pluginId, config.navLabel);
  return config;
}

/** Le plafond quotidien par défaut (0 = aucun). */
export function defaultDailyLimit(config: PluginConfig): number | null {
  const n = Math.floor(Number(config.userLimit));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Le plafond effectif d'un compte : le sien, sinon celui par défaut.
 * `-1` sur le compte : illimité, quel que soit le défaut. `null` rendu : illimité.
 */
export function effectiveDailyLimit(own: number | null, fallback: number | null): number | null {
  if (own === -1) return null;
  return own ?? fallback;
}
