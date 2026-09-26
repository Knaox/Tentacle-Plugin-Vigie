/* ------------------------------------------------------------------ */
/*  Vigie — Le nom de l'onglet, choisi par l'administrateur             */
/* ------------------------------------------------------------------ */

/*
 * Le serveur Tentacle ne sait pas renommer l'onglet d'une extension : il lit
 * son nom dans deux fichiers, à chaque appel de `/api/plugins/active`.
 *   - `plugin.json` → `navItems[].labels` : la barre du web et du bureau, le
 *     menu « Plus », les sections du menu Extensions sur mobile ;
 *   - `installed.json` → `name`, dont l'application mobile garde ce qui
 *     précède « — » : l'onglet du téléphone, l'en-tête de l'extension, le
 *     « via … » de la recherche.
 * Ces deux fichiers sont à nous. On y écrit le nom voulu à chaque sauvegarde
 * de la configuration et à chaque démarrage — une mise à jour de l'extension
 * les remplace, et le serveur redémarre justement après. Aucune version du
 * core n'est exigée : les clients déjà installés affichent le nouveau nom à
 * leur prochaine lecture de la liste des extensions.
 *
 * Un nom par langue (français, anglais) : `labels` en porte un par langue, et
 * le web choisit celui de l'utilisateur. `name`, lui, n'en porte qu'un : sur
 * téléphone, l'onglet prend le nom français (l'anglais à défaut).
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { resolve } from "path";

export const DEFAULT_NAV_LABEL = "Vigie";
/** Au-delà, l'onglet déborde de la capsule du bureau et de la barre du téléphone. */
export const NAV_LABEL_MAX = 24;

const NAME_SUFFIX_FALLBACK = " — Jellyseerr (unofficial)";

/**
 * Un nom d'onglet présentable : sans espaces superflus ni caractères de
 * contrôle. Un tiret entouré d'espaces devient un point médian — l'application
 * mobile coupe le nom de l'extension à ce tiret-là (« Films - Séries » ne
 * garderait que « Films »).
 */
export function cleanNavLabel(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+[—–-]\s+/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned).slice(0, NAV_LABEL_MAX).join("").trim();
}

type Manifest = Record<string, unknown> & {
  navItems?: Array<Record<string, unknown>>;
  name?: string;
  tab?: Record<string, unknown>;
};

export interface NavLabels {
  fr: string;
  en: string;
}

/**
 * Les noms d'onglet enregistrés, remis en forme. Accepte l'ancienne forme
 * (une chaîne, un seul nom pour toutes les langues).
 */
export function cleanNavLabels(raw: unknown): NavLabels {
  if (typeof raw === "string") {
    const one = cleanNavLabel(raw);
    return { fr: one, en: one };
  }
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { fr: cleanNavLabel(input.fr), en: cleanNavLabel(input.en) };
}

/** Ce que chaque langue affiche : la sienne, sinon l'autre, sinon « Vigie ». */
export function resolvedLabels(labels: NavLabels): NavLabels {
  return {
    fr: labels.fr || labels.en || DEFAULT_NAV_LABEL,
    en: labels.en || labels.fr || DEFAULT_NAV_LABEL,
  };
}

const sameLabels = (value: unknown, wanted: NavLabels): boolean => {
  const labels = (value ?? {}) as Record<string, unknown>;
  return labels.fr === wanted.fr && labels.en === wanted.en && Object.keys(labels).length === 2;
};

/** Le manifeste portant les noms voulus, ou `null` quand il les porte déjà. */
export function manifestWithLabels(manifest: Manifest, labels: NavLabels): Manifest | null {
  if (!Array.isArray(manifest.navItems)) return null;
  const wanted = resolvedLabels(labels);
  let changed = false;
  const navItems = manifest.navItems.map((item) => {
    // L'entrée « Paramètres » de l'administration garde son nom.
    if (item.admin === true || sameLabels(item.labels, wanted)) return item;
    changed = true;
    return { ...item, labels: { ...wanted } };
  });
  // `tab.labels` : servi par le core, relu par les clients qui le lisent.
  let tab = manifest.tab;
  if (tab && !sameLabels(tab.labels, wanted)) {
    tab = { ...tab, labels: { ...wanted } };
    changed = true;
  }
  return changed ? { ...manifest, navItems, ...(tab ? { tab } : {}) } : null;
}

/** « Vigie — Jellyseerr (unofficial) » devient « <nom> — Jellyseerr (unofficial) ». */
export function displayNameWithLabel(manifestName: string | undefined, label: string): string {
  const wanted = label || DEFAULT_NAV_LABEL;
  const name = manifestName ?? "";
  const dash = name.indexOf(" — ");
  return `${wanted}${dash >= 0 ? name.slice(dash) : NAME_SUFFIX_FALLBACK}`;
}

/** Écriture d'un bloc : le serveur ne lit jamais un fichier à moitié écrit. */
function writeJsonAtomic(path: string, value: unknown): void {
  const tmp = `${path}.vigie-${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}

/**
 * Applique les noms d'onglet aux deux fichiers lus par le serveur. Silencieux
 * quand rien ne change ; ne lève jamais — un nom d'onglet ne doit pas
 * empêcher l'extension de démarrer.
 */
export function applyNavLabel(pluginDir: string, pluginId: string, rawLabels: unknown): void {
  const labels = cleanNavLabels(rawLabels);
  try {
    const manifestPath = resolve(pluginDir, "plugin.json");
    if (!existsSync(manifestPath)) return;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
    let changed = false;
    const nextManifest = manifestWithLabels(manifest, labels);
    if (nextManifest) {
      writeJsonAtomic(manifestPath, nextManifest);
      changed = true;
    }

    const installedPath = resolve(pluginDir, "..", "installed.json");
    if (existsSync(installedPath)) {
      const installed = JSON.parse(readFileSync(installedPath, "utf-8")) as Array<Record<string, unknown>>;
      const entry = installed.find((p) => p.pluginId === pluginId || p.id === pluginId);
      const name = displayNameWithLabel(manifest.name, labels.fr || labels.en);
      if (entry && entry.name !== name) {
        entry.name = name;
        writeJsonAtomic(installedPath, installed);
        changed = true;
      }
    }
    if (changed) {
      const shown = resolvedLabels(labels);
      console.log(`[SeerBackend] Nom de l'onglet : « ${shown.fr} » / « ${shown.en} »`);
    }
  } catch (err) {
    console.warn("[SeerBackend] Nom de l'onglet non appliqué :", err);
  }
}
