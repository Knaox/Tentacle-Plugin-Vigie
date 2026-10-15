import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { gateNotifications } from "./notification-gate";
import { setContentPolicy } from "./content-gate";
import { requestNotificationData } from "../notify/core-notification";

/*
 * Un profil restreint ne reçoit aucun avis d'un titre au-dessus de son âge ;
 * le format des notifications, lui, ne change pas.
 */

afterEach(() => setContentPolicy(null));

function sink() {
  const written: Array<Record<string, unknown>> = [];
  const core = gateNotifications({ notification: { create: async (args) => { written.push(args.data); return null; } } });
  return { core, written };
}
const req = (tmdbId: number, jellyfinUserId = "kid") => ({ id: "r1", title: "T", mediaType: "movie" as const, tmdbId, jellyfinUserId });

test("titre interdit au destinataire : rien n'est écrit ; permis : écrit tel quel", async () => {
  setContentPolicy({
    isRestricted: async (u) => u === "kid",
    filterExternalTitles: async (_u, t) => t.filter((x) => x.tmdbId === 1),
    allowsExternalTitle: async (_u, t) => t.tmdbId === 1,
  });
  const { core, written } = sink();
  await core.notification.create({ data: requestNotificationData(req(2), { title: "t", body: "b" }, "available") });
  const ok = requestNotificationData(req(1), { title: "t", body: "b" }, "available");
  await core.notification.create({ data: ok });
  await core.notification.create({ data: requestNotificationData(req(2, "adult"), { title: "t", body: "b" }, "failed") });
  assert.equal(written.length, 2);
  assert.equal(written[0], ok);
});

test("sans pont, tout passe ; pont qui lève, l'avis se tait", async () => {
  const { core, written } = sink();
  await core.notification.create({ data: requestNotificationData(req(2), { title: "t", body: "b" }, "available") });
  assert.equal(written.length, 1);
  setContentPolicy({
    isRestricted: async () => true,
    filterExternalTitles: async () => { throw new Error("muet"); },
    allowsExternalTitle: async () => { throw new Error("muet"); },
  });
  await core.notification.create({ data: requestNotificationData(req(1), { title: "t", body: "b" }, "available") });
  assert.equal(written.length, 1);
});

test("une notification qui ne parle d'aucun titre passe", async () => {
  setContentPolicy({ isRestricted: async () => true, filterExternalTitles: async () => [], allowsExternalTitle: async () => false });
  const { core, written } = sink();
  await core.notification.create({ data: { jellyfinUserId: "kid", type: "other", title: "t", body: "b" } });
  assert.equal(written.length, 1);
});
