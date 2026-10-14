import { test } from "node:test";
import assert from "node:assert/strict";
import { watchPreviewExits, type PreviewExit } from "./exitGuard";

/*
 * Aucune mini-carte orpheline : quand la sortie du pointeur n'arrive pas
 * (iframe quittée vers la barre de Tentacle), la page quittée, la fenêtre
 * effacée ou Échap ferment l'aperçu.
 */

function setup() {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const exits: PreviewExit[] = [];
  const stop = watchPreviewExits(win, doc, (kind) => exits.push(kind));
  return { win, doc, exits, stop };
}

const mouseout = (relatedTarget: unknown) => Object.assign(new Event("mouseout"), { relatedTarget });
const key = (k: string) => Object.assign(new Event("keydown"), { key: k });

test("le pointeur quitte le document (mouseout sans relatedTarget) : fermé", () => {
  const { win, exits } = setup();
  win.dispatchEvent(mouseout({}));
  assert.deepEqual(exits, [], "passer d'un élément à l'autre dans la page ne ferme rien");
  win.dispatchEvent(mouseout(null));
  assert.deepEqual(exits, ["away"]);
});

test("la fenêtre perd le focus ou la page se cache : fermé", () => {
  const { win, doc, exits } = setup();
  win.dispatchEvent(new Event("blur"));
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(exits, ["away"], "une page encore visible ne ferme rien");
  doc.visibilityState = "hidden";
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(exits, ["away", "away"]);
});

test("Échap ferme, les autres touches non", () => {
  const { win, exits } = setup();
  win.dispatchEvent(key("Enter"));
  win.dispatchEvent(key("Escape"));
  assert.deepEqual(exits, ["escape"]);
});

test("le filet ne vit que le temps de la session", () => {
  const { win, doc, exits, stop } = setup();
  stop();
  win.dispatchEvent(mouseout(null));
  win.dispatchEvent(new Event("blur"));
  win.dispatchEvent(key("Escape"));
  doc.visibilityState = "hidden";
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(exits, []);
});
