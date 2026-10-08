import { test } from "node:test";
import assert from "node:assert/strict";
import { applyVersion, assertRegistryEntry, blindServersCanTake, compareVersions, familyAPick, familyBPick } from "./registry-entry.mjs";

/*
 * Un serveur 1.24 ne doit JAMAIS se voir proposer une version qui exige 1.25 :
 * il prend `latestVersion`, sinon `versions[0]`.
 */

const v = (version, minTentacleVersion) => ({ version, minTentacleVersion, downloadUrl: `u-${version}`, checksum: `c-${version}` });
const published = () => ({ id: "seer", latestVersion: "1.24.1", versions: [v("1.24.1", "0.9.0"), v("1.24.0", "0.9.0")] });

/**
 * Ce que choisit un ancien serveur — les DEUX familles doivent donner la même
 * version, compatible, et l'étiquette de A doit être celle de son archive.
 */
function blindPick(p) {
  const a = familyAPick(p);
  const b = familyBPick(p);
  assert.equal(a.archive, b, "familles A et B divergent");
  assert.equal(a.label, a.archive.version, "étiquette de A ≠ son archive");
  assert.ok(blindServersCanTake(a.archive), "version servie incompatible");
  return b;
}

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
  assert.equal(plugin.versions[0].version, "1.24.1", "l'archive de la famille A est compatible elle aussi");
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

test("la version servie aux anciens serveurs doit porter archive ET empreinte", () => {
  const noChecksum = { ...v("1.24.2", "0.9.0"), checksum: "" };
  assert.throws(() => applyVersion(published(), noChecksum), /pas d'archive ou d'empreinte/);
});

test("rien au premier niveau : ni archive, ni empreinte, ni version de repli", () => {
  const plugin = applyVersion({ ...published(), downloadUrl: "u-old", checksum: "c-old", version: "0.1.0" }, v("1.25.0", "1.25.0"));
  for (const field of ["downloadUrl", "checksum", "version"]) assert.equal(plugin[field], undefined);
});

test("les invariants refusent un registre retouché à la main", () => {
  const ok = applyVersion(published(), v("1.25.0", "1.25.0"));
  assert.doesNotThrow(() => assertRegistryEntry(ok));
  assert.throws(() => assertRegistryEntry({ ...ok, versions: [ok.versions[1], ok.versions[0], ...ok.versions.slice(2)] }), /divergent/);
  assert.throws(() => assertRegistryEntry({ ...ok, latestVersion: "1.25.0" }), /divergent|étiquette/);
  assert.throws(() => assertRegistryEntry({ ...ok, downloadUrl: "x" }), /premier niveau/);
  const tooNew = { id: "seer", latestVersion: "1.25.0", versions: [v("1.25.0", "1.25.0")] };
  assert.throws(() => assertRegistryEntry(tooNew), /exige 1\.25\.0/);
});
