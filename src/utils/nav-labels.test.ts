import { test } from "node:test";
import assert from "node:assert/strict";
import { labelFor, shownLabels } from "./nav-labels";

test("chaque langue voit son nom, sinon celui de l'autre, sinon « Vigie »", () => {
  assert.equal(labelFor({ fr: "Demander", en: "Request" }, "fr-FR"), "Demander");
  assert.equal(labelFor({ fr: "Demander", en: "Request" }, "en"), "Request");
  assert.equal(labelFor({ fr: "Demander", en: "" }, "en"), "Demander");
  assert.equal(labelFor({ fr: "", en: "" }, "de"), "Vigie");
  assert.deepEqual(shownLabels({ fr: "  ", en: "Add" }), { fr: "Add", en: "Add" });
});
