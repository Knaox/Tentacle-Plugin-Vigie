import { test } from "node:test";
import assert from "node:assert/strict";
import { IDLE, previewDeadline, reducePreview, type PreviewEvent, type PreviewState } from "./machine";
import { previewDelayOf } from "./timing";

/*
 * Les règles de Damien, tenues par la machine : rien ne se demande pendant un
 * balayage ou un défilement, rien ne s'agrandit sans de quoi montrer, jamais
 * avant le délai (600 ms face à un hôte d'avant, celui choisi dans Tentacle
 * sinon), et un flux bloqué ne montre jamais rien.
 */

const run = (events: PreviewEvent[], from: PreviewState = IDLE) => events.reduce(reducePreview, from);

test("l'intention : 200 ms de survol ET un pointeur arrêté depuis 100 ms", () => {
  let s = run([{ type: "start", at: 0 }]);
  assert.equal(previewDeadline(s), 200);
  s = run([{ type: "move", at: 150 }, { type: "tick", at: 200 }], s);
  assert.equal(s.phase, "intent", "un mouvement à 150 ms repousse la demande");
  assert.equal(previewDeadline(s), 250);
  s = run([{ type: "tick", at: 250 }], s);
  assert.equal(s.phase, "fetching");
  assert.equal(s.attempt, 1);
});

test("un balayage (mouvements continus) ne demande jamais rien", () => {
  let s = run([{ type: "start", at: 0 }]);
  for (let at = 50; at <= 3000; at += 50) s = run([{ type: "move", at }, { type: "tick", at }], s);
  assert.equal(s.phase, "intent");
  assert.equal(s.attempt, 0);
});

const fetching = () => run([{ type: "start", at: 0 }, { type: "tick", at: 200 }]);

test("révélée au plus tôt à 600 ms, avec la première image", () => {
  let s = run([{ type: "found", at: 300 }, { type: "videoReady", at: 400 }], fetching());
  assert.equal(s.phase, "buffering");
  assert.equal(previewDeadline(s), 600);
  s = run([{ type: "tick", at: 600 }], s);
  assert.equal(s.phase, "shown");
});

test("révélée sur l'image du titre quand le flux coule — jamais sur un flux bloqué", () => {
  const found = run([{ type: "found", at: 300 }], fetching());
  const stillOnly = run([{ type: "stillReady", at: 350 }, { type: "tick", at: 900 }], found);
  assert.equal(stillOnly.phase, "buffering", "l'image seule ne suffit pas : le flux doit couler");
  const flowing = run([{ type: "fragment", at: 950 }], stillOnly);
  assert.equal(flowing.phase, "shown");
  // La vidéo n'arrive jamais : la mini-carte s'efface à l'échéance (8 s après le flux).
  const stuck = run([{ type: "tick", at: 300 + 8000 }], flowing);
  assert.equal(stuck.phase, "over");
  assert.equal(stuck.failed, true);
});

test("pas de bande-annonce : rien ne bouge, sans échec retenu", () => {
  const s = run([{ type: "missing", at: 400 }], fetching());
  assert.equal(s.phase, "over");
  assert.equal(s.failed, false);
});

test("un refus passager attend l'échéance, deux fois au plus", () => {
  let s = run([{ type: "retry", at: 300, retryAt: 2300 }], fetching());
  assert.equal(previewDeadline(s), 2300);
  s = run([{ type: "tick", at: 2300 }], s);
  assert.equal(s.attempt, 2, "une nouvelle demande à l'échéance");
  s = run([{ type: "retry", at: 2400, retryAt: 4400 }, { type: "tick", at: 4400 }, { type: "retry", at: 4500, retryAt: 6500 }], s);
  assert.equal(s.phase, "over");
});

test("une erreur de lecture finit l'aperçu et se retient ; la fin aussi, sans échec", () => {
  const shown = run([{ type: "found", at: 300 }, { type: "videoReady", at: 400 }, { type: "tick", at: 600 }], fetching());
  assert.equal(run([{ type: "fail", at: 900 }], shown).failed, true);
  const ended = run([{ type: "ended", at: 5000 }], shown);
  assert.equal(ended.phase, "over");
  assert.equal(ended.failed, false);
});

test("l'arrêt du survol remet tout au repos, et un nouveau survol repart de zéro", () => {
  const s = run([{ type: "found", at: 300 }, { type: "stop", at: 500 }], fetching());
  assert.equal(s.phase, "idle");
  assert.equal(previewDeadline(s), null);
  const again = run([{ type: "start", at: 1000 }], s);
  assert.equal(again.phase, "intent");
  assert.equal(again.since, 1000);
});

test("le délai que l'hôte dit fixe l'intention et la révélation du cycle (800 ms : demande à 400)", () => {
  let s = run([{ type: "start", at: 0, delayMs: 800 }]);
  assert.equal(previewDeadline(s), 400);
  s = run([{ type: "tick", at: 399 }], s);
  assert.equal(s.phase, "intent");
  s = run([{ type: "tick", at: 400 }, { type: "found", at: 450 }, { type: "videoReady", at: 600 }], s);
  assert.equal(s.phase, "buffering");
  assert.equal(previewDeadline(s), 800);
  assert.equal(run([{ type: "tick", at: 800 }], s).phase, "shown");
});

test("un délai court garde le plancher de 200 ms ; un hôte d'avant, l'ancien rendez-vous", () => {
  assert.equal(previewDeadline(run([{ type: "start", at: 0, delayMs: 500 }])), 200);
  assert.equal(previewDeadline(run([{ type: "start", at: 0, delayMs: 2000 }])), 1600);
  assert.equal(previewDeadline(run([{ type: "start", at: 0 }])), 200);
});

test("le délai de l'hôte : un choix connu, sinon celui d'un hôte d'avant", () => {
  assert.equal(previewDelayOf(1200), 1200);
  for (const raw of [undefined, null, "800", 700, Number.NaN]) assert.equal(previewDelayOf(raw), 600);
});
