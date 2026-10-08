/**
 * Ce que la publication écrit dans l'entrée du registre — logique pure, testée
 * (registry-entry.test.mjs).
 *
 * Les serveurs Tentacle jusqu'à 1.24 ne lisent PAS `minTentacleVersion`, et se
 * partagent en deux familles :
 * - A (1.4.0 → 1.19.2) télécharge TOUJOURS `versions[0]` ; `latestVersion`
 *   n'est que son étiquette (et une étiquette qui diffère vaut « mise à jour ») ;
 * - B (1.19.3 → 1.24.0) prend l'entrée de `latestVersion`, sinon `versions[0]`.
 * Les deux retombent sur `downloadUrl` / `checksum` / `version` de PREMIER
 * niveau quand l'entrée choisie n'a pas d'archive — sans contrôle d'intégrité.
 *
 * D'où les invariants (vérifiés aussi sur le registre entier,
 * verify-registry.mjs) : `latestVersion` = la plus récente version que ces
 * serveurs « aveugles » peuvent prendre ; c'est `versions[0]` ; elle porte
 * archive ET empreinte ; l'entrée n'a rien au premier niveau. Les serveurs à
 * partir de 1.25 ignorent `latestVersion` et choisissent eux-mêmes.
 */

/** Le premier serveur qui vérifie `minTentacleVersion`. */
export const FIRST_CHECKING_SERVER = "1.25.0";

function parts(version) {
  return String(version ?? "0").trim().replace(/^v/i, "").split(/[-+]/)[0].split(".").map((n) => parseInt(n, 10) || 0);
}

/** Négatif si a < b, positif si a > b. */
export function compareVersions(a, b) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length, 3); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Un serveur d'avant 1.25 peut-il prendre cette version ? Sans exigence : oui. */
export function blindServersCanTake(entry) {
  return !entry.minTentacleVersion || compareVersions(entry.minTentacleVersion, FIRST_CHECKING_SERVER) < 0;
}

/**
 * Une version qui déclare tourner sur SQLite (`storage.sqlite` du manifeste)
 * ne tourne QUE sur un serveur 1.25 ou plus récent : son plancher doit le
 * dire. Sans lui, elle deviendrait `latestVersion` et les serveurs 1.24 —
 * sur MariaDB, sans interface de stockage — l'installeraient.
 */
export function assertStorageFloor(manifest, minTentacleVersion) {
  const sqlite = manifest?.storage?.sqlite === true;
  if (sqlite && compareVersions(minTentacleVersion ?? "0", FIRST_CHECKING_SERVER) < 0) {
    throw new Error(
      `plugin.json déclare storage.sqlite mais minTentacleVersion vaut « ${minTentacleVersion ?? "(absent)"} » : `
      + `il faut ${FIRST_CHECKING_SERVER} au moins`,
    );
  }
}

/**
 * Pose `entry` (nouvelle ou republiée) dans `plugin.versions` et recalcule
 * `latestVersion`. Rend le plugin modifié ; lève une erreur plutôt que
 * d'écrire un registre où `latestVersion` ne désignerait rien.
 */
export function applyVersion(plugin, entry) {
  const versions = (Array.isArray(plugin.versions) ? plugin.versions : []).filter((v) => v.version !== entry.version);
  versions.push(entry);
  versions.sort((a, b) => compareVersions(b.version, a.version));
  const legacy = versions.find(blindServersCanTake);
  if (!legacy) {
    throw new Error(`Aucune version que les serveurs d'avant ${FIRST_CHECKING_SERVER} puissent prendre : latestVersion ne désignerait rien`);
  }
  if (!legacy.downloadUrl || !legacy.checksum) {
    throw new Error(`La version ${legacy.version} servie aux serveurs d'avant ${FIRST_CHECKING_SERVER} n'a pas d'archive ou d'empreinte`);
  }
  plugin.versions = [legacy, ...versions.filter((v) => v !== legacy)];
  plugin.latestVersion = legacy.version;
  // Le premier niveau serait le repli des anciens serveurs, sans empreinte : jamais.
  for (const field of TOP_LEVEL_FALLBACKS) delete plugin[field];
  assertRegistryEntry(plugin);
  return plugin;
}

/** Ce que les anciens serveurs liraient au premier niveau faute d'archive dans l'entrée. */
export const TOP_LEVEL_FALLBACKS = ["downloadUrl", "checksum", "version"];

/** Ce que télécharge un serveur de la famille A, et l'étiquette qu'il affiche. */
export function familyAPick(plugin) {
  return { archive: plugin.versions?.[0], label: plugin.latestVersion };
}

/** Ce que télécharge un serveur de la famille B. */
export function familyBPick(plugin) {
  const versions = plugin.versions ?? [];
  return versions.find((v) => v.version === plugin.latestVersion) ?? versions[0];
}

/**
 * Les invariants d'une entrée publiée, tels que les deux familles les lisent.
 * Lève une erreur qui dit lequel manque.
 */
export function assertRegistryEntry(plugin) {
  const id = plugin.id ?? plugin.pluginId ?? plugin.name ?? "?";
  const fail = (why) => { throw new Error(`Registre, « ${id} » : ${why}`); };
  const versions = Array.isArray(plugin.versions) ? plugin.versions : [];
  if (versions.length === 0) fail("aucune version publiée");
  for (const field of TOP_LEVEL_FALLBACKS) {
    if (plugin[field] !== undefined) fail(`champ « ${field} » au premier niveau (repli sans empreinte des anciens serveurs)`);
  }
  const a = familyAPick(plugin);
  const b = familyBPick(plugin);
  if (!a.archive || a.archive !== b) fail("versions[0] n'est pas l'entrée de latestVersion : les deux familles divergent");
  if (a.label !== a.archive.version) fail("l'étiquette (latestVersion) ne correspond pas à l'archive (versions[0])");
  if (!blindServersCanTake(a.archive)) fail(`la version ${a.archive.version} servie aux anciens serveurs exige ${a.archive.minTentacleVersion}`);
  if (!a.archive.downloadUrl || !a.archive.checksum) fail(`la version ${a.archive.version} n'a pas d'archive ou d'empreinte`);
  const newerLegacy = versions.find((v) => blindServersCanTake(v) && compareVersions(v.version, a.archive.version) > 0);
  if (newerLegacy) fail(`latestVersion (${a.archive.version}) n'est pas la plus récente compatible (${newerLegacy.version})`);
}
