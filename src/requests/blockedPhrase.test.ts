import { test } from "node:test";
import assert from "node:assert/strict";
import { blockedPhrase, requestView } from "./requestPhrase";
import frCauses from "../i18n/fr/causes";
import enCauses from "../i18n/en/causes";
import { CAUSES, type BlockedCause } from "../../server/arrival/blocked-causes";
import { blockedSentence } from "../../server/arrival/blocked-texts";
import type { LocalRequest } from "../api/types";

/*
 * Le hub dit un blocage avec les MÊMES mots que l'avis envoyé au compte :
 * miroir octet pour octet de server/arrival/blocked-texts.ts.
 */

test("chaque cause du serveur a sa phrase dans le hub, identique à l'avis, en français et en anglais", () => {
  const ids = Object.keys(CAUSES) as BlockedCause[];
  for (const cause of ids) {
    assert.equal((frCauses as Record<string, string>)[`dtBlocked_${cause}`], blockedSentence(cause, "fr"), `fr:${cause}`);
    assert.equal((enCauses as Record<string, string>)[`dtBlocked_${cause}`], blockedSentence(cause, "en"), `en:${cause}`);
  }
  // Rien de plus que la liste fermée.
  assert.equal(Object.keys(frCauses).length, ids.length);
  assert.equal(Object.keys(enCauses).length, ids.length);
});

test("une demande bloquée dit sa cause ; une cause inconnue (serveur plus récent) garde la phrase d'avant", () => {
  assert.deepEqual(blockedPhrase("sample"), { key: "seer:dtBlocked_sample", tone: "warning" });
  assert.deepEqual(blockedPhrase("venueDuFutur"), { key: "seer:dtStalled", tone: "warning" });
  assert.deepEqual(blockedPhrase(undefined), { key: "seer:dtStalled", tone: "warning" });

  const request = { status: "downloading", retryCount: 0, maxRetries: 10, completedAt: null } as unknown as LocalRequest;
  const download = { percent: 100, size: 1, sizeLeft: 0, etaSeconds: null, estimatedCompletionAt: null, status: "warning",
    validating: false, stalled: true, stalledCount: 1, blockedCause: "diskSpace", title: null, seasonNumber: null, episodeNumber: null };
  const view = requestView(request, { download } as never);
  assert.equal(view.status?.state, "stalled");
  assert.equal(view.detail?.key, "seer:dtBlocked_diskSpace");
});
