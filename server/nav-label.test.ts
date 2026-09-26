import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanNavLabel, displayNameWithLabel, manifestWithLabel, DEFAULT_NAV_LABEL, NAV_LABEL_MAX } from "./nav-label";

/*
 * Le nom de l'onglet voyage par deux fichiers que le serveur Tentacle relit
 * (cf. nav-label.ts) : ce qu'on y écrit doit être exactement ce que les
 * clients déjà installés savent afficher.
 */

const MANIFEST = {
  id: "seer",
  name: "Vigie — Jellyseerr (unofficial)",
  navItems: [
    { path: "/discover", icon: "compass", labels: { en: "Vigie", fr: "Vigie" } },
    { path: "/admin/plugins/seer", icon: "settings", admin: true, labels: { en: "Settings", fr: "Paramètres" } },
  ],
};

test("le nom est nettoyé, borné, et garde les accents", () => {
  assert.equal(cleanNavLabel("  Demandes\n  de   films  "), "Demandes de films");
  assert.equal(cleanNavLabel("Séries & Films"), "Séries & Films");
  assert.equal(cleanNavLabel("x".repeat(40)).length, NAV_LABEL_MAX);
  assert.equal(cleanNavLabel(42), "");
});

test("un tiret entouré d'espaces ne coupe plus le nom sur mobile", () => {
  assert.equal(cleanNavLabel("Films - Séries"), "Films · Séries");
  assert.equal(cleanNavLabel("Films — Séries"), "Films · Séries");
  // Sans espaces autour, c'est un trait d'union : on n'y touche pas.
  assert.equal(cleanNavLabel("Ciné-club"), "Ciné-club");
});

test("le manifeste reçoit le nom voulu, l'entrée d'administration garde le sien", () => {
  const next = manifestWithLabel(MANIFEST, "Demandes");
  assert.ok(next);
  assert.deepEqual(next.navItems?.[0].labels, { en: "Demandes", fr: "Demandes" });
  assert.deepEqual(next.navItems?.[1].labels, { en: "Settings", fr: "Paramètres" });
});

test("rien à écrire quand le manifeste porte déjà le nom", () => {
  assert.equal(manifestWithLabel(MANIFEST, ""), null);
  assert.equal(manifestWithLabel(MANIFEST, DEFAULT_NAV_LABEL), null);
});

test("le nom affiché de l'extension suit l'onglet, sa devise reste", () => {
  assert.equal(displayNameWithLabel(MANIFEST.name, "Demandes"), "Demandes — Jellyseerr (unofficial)");
  assert.equal(displayNameWithLabel(MANIFEST.name, ""), "Vigie — Jellyseerr (unofficial)");
  assert.equal(displayNameWithLabel(undefined, "Demandes"), "Demandes — Jellyseerr (unofficial)");
});
