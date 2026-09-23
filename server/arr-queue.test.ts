import { test } from "node:test";
import assert from "node:assert/strict";
import { isStalledRecord } from "./arr-queue";

test("la file *arr dit bloqué ce qui n'avancera plus tout seul", () => {
  assert.equal(isStalledRecord({ status: "warning" }), true);
  assert.equal(isStalledRecord({ status: "paused" }), true);
  assert.equal(isStalledRecord({ status: "completed", trackedDownloadState: "importBlocked" }), true);
  assert.equal(isStalledRecord({ status: "completed", trackedDownloadState: "importFailed" }), true);
  assert.equal(isStalledRecord({ status: "downloading", trackedDownloadStatus: "error" }), true);
});

test("ce qui avance, attend son heure ou se range n'est pas bloqué", () => {
  assert.equal(isStalledRecord({ status: "downloading", trackedDownloadState: "downloading" }), false);
  assert.equal(isStalledRecord({ status: "delay" }), false);
  assert.equal(isStalledRecord({ status: "queued" }), false);
  assert.equal(isStalledRecord({ status: "completed", trackedDownloadState: "importPending" }), false);
  assert.equal(isStalledRecord({ status: "completed", trackedDownloadState: "importing" }), false);
});
