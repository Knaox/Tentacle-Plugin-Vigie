import { test } from "node:test";
import assert from "node:assert/strict";
import { CTA_HERO, CTA_HERO_STYLE, CTA_PRIMARY } from "./cta";

/*
 * Le bouton principal des héros de Vigie porte le dégradé de marque des
 * bannières du cœur — par la variable de l'hôte, avec un repli au même
 * dégradé pour un hôte d'avant le jeton — et garde les gestes du bouton
 * principal (transformation à l'appui, anneau de focus).
 */

test("le dégradé vient de l'hôte, avec un repli au même dégradé profond", () => {
  const bg = String(CTA_HERO_STYLE.backgroundImage);
  assert.match(bg, /^var\(--cta-brand-gradient, linear-gradient\(120deg, var\(--brand-dark\) 0%, var\(--brand-accent-dark, #DB2777\) 100%\)\)$/);
  assert.equal(CTA_HERO_STYLE.color, "var(--cta-brand-fg, #FFFFFF)");
});

test("ni la pilule blanche, ni une ombre animée ; les gestes du bouton principal", () => {
  assert.ok(!CTA_HERO.includes("bg-tentacle-cta-primary"));
  assert.ok(!/transition-(all|shadow)/.test(CTA_HERO));
  for (const gesture of ["hover:-translate-y-0.5", "active:scale-[0.98]", "focus-visible:ring-2", "rounded-full"]) {
    assert.ok(CTA_HERO.includes(gesture) && CTA_PRIMARY.includes(gesture), gesture);
  }
});
