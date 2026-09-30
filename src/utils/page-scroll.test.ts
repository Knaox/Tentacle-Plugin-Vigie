import { test } from "node:test";
import assert from "node:assert/strict";
import { PAGE_BOX_CLASS, isIosWebView, keyboardInset, pageScrollCss } from "./page-scroll";

/*
 * Dans la WebView iOS de l'application, le défilement principal de la page
 * perdait son élan (0,992 par ms mesuré, contre 0,998 pour une liste native) :
 * la page de Vigie y défile désormais dans sa propre boîte, et là seulement.
 */

const bridge = { postMessage: () => {} };

test("WebView iOS : le pont React Native ET WebKit", () => {
  assert.equal(isIosWebView({ ReactNativeWebView: bridge, webkit: { messageHandlers: {} } }), true);
});

test("WebView Android : le pont sans WebKit — le document garde la main", () => {
  // Chromium garde, lui, son élan natif sur le document, et l'étirement
  // d'Android 12 n'existe que sur le défileur racine.
  assert.equal(isIosWebView({ ReactNativeWebView: bridge }), false);
});

test("web et bureau : ni pont ni boîte", () => {
  assert.equal(isIosWebView({}), false);
  // Safari a WebKit, mais pas le pont de l'application.
  assert.equal(isIosWebView({ webkit: { messageHandlers: {} } }), false);
});

test("un pont sans postMessage n'est pas un pont", () => {
  assert.equal(isIosWebView({ ReactNativeWebView: {}, webkit: { messageHandlers: {} } }), false);
});

test("la boîte défile, le document non", () => {
  const css = pageScrollCss();
  assert.match(css, /html,body\{height:100%;overflow:hidden;overscroll-behavior:none;\}/);
  assert.match(css, new RegExp(`\\.${PAGE_BOX_CLASS}\\{[^}]*overflow-y:auto`));
  // Le rebond reste à la boîte : il ne remonte pas à la page entière.
  assert.match(css, /overscroll-behavior-y:contain/);
});

test("la boîte n'est pas `fixed` : les feuilles de la page restent au-dessus de ce qui est posé à côté", () => {
  // `fixed` crée un contexte d'empilement : les filtres du catalogue passaient
  // sous le bouton « Revenir en haut ».
  const box = pageScrollCss().split(`.${PAGE_BOX_CLASS}`)[1];
  assert.match(box, /position:absolute/);
  assert.doesNotMatch(box, /position:fixed/);
});

test("le bas de la boîte suit le clavier", () => {
  assert.match(pageScrollCss(), /bottom:var\(--vg-keyboard,0px\)/);
});

test("clavier : ce qu'il couvre du viewport", () => {
  assert.equal(keyboardInset(874, 874, 0), 0, "pas de clavier");
  assert.equal(keyboardInset(874, 538, 0), 336, "clavier ouvert");
  assert.equal(keyboardInset(874, 538, 40), 296, "viewport visuel décalé par iOS");
  assert.equal(keyboardInset(874, 900, 0), 0, "jamais négatif");
});
