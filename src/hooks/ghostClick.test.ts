import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GHOST_CLICK_WINDOW_MS, swallowGhostClick } from "./ghostClick";

/*
 * Au banc, le clic du relâcher d'un appui long tombait sur le « Demander » de
 * la feuille que l'appui venait d'ouvrir : le titre partait en demande tout
 * seul. Ce clic-là, et lui seul, doit être avalé.
 */

function click(target: EventTarget): Event {
  const e = new Event("click", { bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

test("le clic qui suit l'appui long est avalé, une seule fois", () => {
  const doc = new EventTarget();
  let done = 0;
  swallowGhostClick(doc, () => { done += 1; });

  doc.dispatchEvent(new Event("pointerup"));
  const ghost = click(doc);
  assert.equal(ghost.defaultPrevented, true);
  // Arrêté au document, à la capture : le bouton sous le doigt ne le reçoit pas.
  assert.equal(ghost.cancelBubble, true);
  assert.equal(done, 1);

  const next = click(doc);
  assert.equal(next.defaultPrevented, false, "le toucher suivant passe");
  assert.equal(next.cancelBubble, false);
});

test("sans clic après le relâcher, plus rien n'est retenu passé la fenêtre", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const doc = new EventTarget();
    let done = 0;
    swallowGhostClick(doc, () => { done += 1; });
    doc.dispatchEvent(new Event("pointerup"));
    mock.timers.tick(GHOST_CLICK_WINDOW_MS + 1);
    assert.equal(done, 1);
    assert.equal(click(doc).defaultPrevented, false);
  } finally {
    mock.timers.reset();
  }
});

test("un geste annulé ne retient rien, et un doigt jamais relâché non plus", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const cancelled = new EventTarget();
    let done = 0;
    swallowGhostClick(cancelled, () => { done += 1; });
    cancelled.dispatchEvent(new Event("pointercancel"));
    assert.equal(done, 1);
    assert.equal(click(cancelled).defaultPrevented, false);

    const held = new EventTarget();
    swallowGhostClick(held, () => { done += 1; });
    mock.timers.tick(10_001);
    assert.equal(done, 2);
    assert.equal(click(held).defaultPrevented, false);
  } finally {
    mock.timers.reset();
  }
});
