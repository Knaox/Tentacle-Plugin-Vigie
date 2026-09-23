import { test } from "node:test";
import assert from "node:assert/strict";
import { chromeCss } from "./host-chrome";

test("la valeur de l'hôte passe AVANT le repli", () => {
  // Le repli n'est là que pour les hôtes qui ne publient pas la hauteur de leur
  // barre : dès qu'elle existe, c'est elle qui décide, sinon on empilerait une
  // approximation sur une mesure exacte.
  for (const mobile of [true, false]) {
    assert.match(chromeCss(mobile), /var\(--tentacle-chrome-bottom,/);
  }
});

test("cadre web large et bureau : rien n'est réservé", () => {
  // Pas de barre flottante : réserver de la place y creuserait un vide sous
  // chaque pied de panneau.
  assert.match(chromeCss(false), /^:root\{--seer-chrome-bottom:var\(--tentacle-chrome-bottom,0px\);\}/);
});

test("cadre web étroit : la barre d'onglets de l'hôte couvre le bas, on s'en écarte", () => {
  // Tentacle passe à sa mise en page de téléphone sous 768 px : sa barre
  // d'onglets se fixe au bas de l'écran, par-dessus le cadre du plugin.
  assert.match(chromeCss(false), /@media \(max-width:767px\)\{:root\{--seer-chrome-bottom:var\(--tentacle-chrome-bottom,calc\(88px/);
});

test("en WebView mobile, la réserve couvre la barre ET l'encoche", () => {
  const css = chromeCss(true);
  assert.match(css, /88px/);
  assert.match(css, /env\(safe-area-inset-bottom, 0px\)/);
});
