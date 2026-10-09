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
import { applyNavLabel, cleanNavLabels } from "./nav-label";

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
export function normalizeConfig(body: unknown, previous: PluginConfig = {}): PluginConfig {
  const input = (body && typeof body === "object" ? body : {}) as PluginConfig;
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
    deleteRequestsWithMediaSince: forget
      ? (previous.deleteRequestsWithMedia === true && Number.isFinite(since) && since > 0 ? since : Date.now())
      : null,
    userLimit: Number.isFinite(limit) && limit > 0 ? limit : 0,
    // Un nom par langue ; l'ancienne forme (un seul nom) est reprise pour les deux.
    navLabels: cleanNavLabels(input.navLabels ?? legacyLabel),
    profiles: Array.isArray(input.profiles) ? input.profiles : [],
  };
}

/** Les noms d'onglet d'une configuration, ancienne forme comprise. */
export function navLabelsOf(config: PluginConfig) {
  return cleanNavLabels(config.navLabels ?? config.navLabel);
}

/** Enregistre la configuration et applique le nom d'onglet. `null` : extension introuvable. */
export function writePluginConfig(pluginDir: string, pluginId: string, body: unknown): PluginConfig | null {
  const path = installedPath(pluginDir);
  if (!existsSync(path)) return null;
  const installed = JSON.parse(readFileSync(path, "utf-8"));
  const entry = findEntry(installed, pluginId);
  if (!entry) return null;
  const config = normalizeConfig(body, (entry.config as PluginConfig | undefined) ?? {});
  entry.config = config;
  const tmp = `${path}.vigie-${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(installed, null, 2));
  renameSync(tmp, path);
  applyNavLabel(pluginDir, pluginId, config.navLabels);
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
