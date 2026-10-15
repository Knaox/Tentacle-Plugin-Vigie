import { test } from "node:test";
import assert from "node:assert/strict";
import { coreNotifications, requestNotificationData } from "./core-notification";

const req = { id: "r42", jellyfinUserId: "u1", title: "La Chasse", mediaType: "movie" as const, tmdbId: 603 };

test("un titre arrivé mène à sa fiche, avec repli sur sa demande", () => {
  const data = requestNotificationData(req, { title: "La Chasse", body: "« La Chasse » est sorti sur Tentacle TV" }, "available");
  assert.equal(data.state, "available");
  assert.deepEqual(JSON.parse(String(data.target)), {
    kind: "title", mediaType: "movie", tmdbId: 603,
    fallback: { kind: "extension", pluginId: "seer", path: "/discover", params: { tab: "requests", find: "La Chasse", focus: "r42" } },
  });
});

test("une demande en route mène à « Mes demandes », cherchée sur le titre, la demande en évidence", () => {
  const data = requestNotificationData(req, { title: "La Chasse", body: "« La Chasse » est en route" }, "progress");
  assert.deepEqual(JSON.parse(String(data.target)), {
    kind: "extension", pluginId: "seer", path: "/discover", params: { tab: "requests", find: "La Chasse", focus: "r42" },
  });
  assert.equal(data.type, "request_status");
  assert.equal(data.refId, "r42");
});

test("un cœur d'avant 1.30.0 reçoit la notification d'avant, sans colonne inconnue", async () => {
  const written: Array<Record<string, unknown>> = [];
  const core = { notification: { create: async (args: { data: Record<string, unknown> }) => { written.push(args.data); return null; } } };
  const data = requestNotificationData(req, { title: "t", body: "b" }, "failed");
  await coreNotifications(core, undefined).notification.create({ data });
  await coreNotifications(core, ["target", "state"]).notification.create({ data });
  assert.equal("target" in written[0], false);
  assert.equal("state" in written[0], false);
  assert.equal(written[1].state, "failed");
});
