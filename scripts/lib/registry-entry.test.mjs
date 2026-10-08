import { test } from "node:test";
import assert from "node:assert/strict";
import { applyVersion, blindServersCanTake, compareVersions } from "./registry-entry.mjs";

/*
 * Un serveur 1.24 ne doit JAMAIS se voir proposer une version qui exige 1.25 :
 * il prend `latestVersion`, sinon `versions[0]`.
 */

const v = (version, minTentacleVersion) => ({ version, minTentacleVersion, downloadUrl: `u-${version}`, checksum: `c-${version}` });
const published = () => ({ id: "seer", latestVersion: "1.24.1", versions: [v("1.24.1", "0.9.0"), v("1.24.0", "0.9.0")] });

/** Ce que choisit un serveur 1.24 (pluginManager.ts:181 de la 1.24.0). */
const blindPick = (p) => p.versions.find((x) => x.version === p.latestVersion) ?? p.versions[0];

test("comparaison de versions", () => {
  assert.ok(compareVersions("1.25.0", "1.24.9") > 0);
  assert.ok(compareVersions("1.9.0", "1.10.0") < 0);
  assert.equal(compareVersions("v1.2.0", "1.2.0"), 0);
  assert.ok(blindServersCanTake(v("1.0.0", undefined)));
  assert.ok(!blindServersCanTake(v("1.25.0", "1.25.0")));
});

test("publier une version qui exige 1.25 laisse latestVersion sur une version compatible", () => {
  const plugin = applyVersion(published(), v("1.25.0", "1.25.0"));
  assert.equal(plugin.latestVersion, "1.24.1");
  assert.equal(blindPick(plugin).version, "1.24.1");
  assert.equal(plugin.versions[0].version, "1.24.1", "le repli d'un 1.24 (versions[0]) est compatible lui aussi");
  assert.deepEqual(plugin.versions.map((x) => x.version).sort(), ["1.24.0", "1.24.1", "1.25.0"]);
});

test("une version compatible avec tous avance latestVersion, même après une version 1.25", () => {
  const plugin = applyVersion(applyVersion(published(), v("1.25.0", "1.25.0")), v("1.24.2", "0.9.0"));
  assert.equal(plugin.latestVersion, "1.24.2");
  assert.equal(blindPick(plugin).checksum, "c-1.24.2");
});

test("latestVersion existe toujours dans versions, republication comprise", () => {
  let plugin = published();
  for (const entry of [v("1.25.0", "1.25.0"), v("1.26.0", "1.25.0"), v("1.25.0", "1.25.0")]) {
    plugin = applyVersion(plugin, entry);
    assert.ok(plugin.versions.some((x) => x.version === plugin.latestVersion));
  }
  assert.equal(plugin.versions.filter((x) => x.version === "1.25.0").length, 1, "une republication remplace, sans doublon");
});

test("aucune version compatible : refus, plutôt qu'un registre qui ne désigne rien", () => {
  assert.throws(() => applyVersion({ id: "x", versions: [] }, v("2.0.0", "1.25.0")), /latestVersion ne désignerait rien/);
});
