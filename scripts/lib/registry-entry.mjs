/**
 * Ce que la publication écrit dans l'entrée du registre — logique pure, testée
 * (registry-entry.test.mjs).
 *
 * Les serveurs Tentacle jusqu'à 1.24 ne lisent PAS `minTentacleVersion` : ils
 * prennent la version désignée par `latestVersion`, et `versions[0]` si elle
 * n'y est pas. Une version qui exige 1.25 ne doit donc jamais être désignée :
 * `latestVersion` reste sur la plus récente version que ces serveurs
 * « aveugles » peuvent prendre, et elle est toujours présente dans `versions`,
 * EN TÊTE (repli des 1.24). Les serveurs à partir de 1.25 ignorent
 * `latestVersion` et choisissent eux-mêmes la plus récente qui leur convient.
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
  plugin.versions = [legacy, ...versions.filter((v) => v !== legacy)];
  plugin.latestVersion = legacy.version;
  return plugin;
}
