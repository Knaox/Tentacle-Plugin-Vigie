import { test } from "node:test";
import assert from "node:assert/strict";
import { CAUSES, classifyBlocked, isBlockedCause, leadingCause, type BlockedCause } from "./blocked-causes";
import { CAUSE_TEXT, RESOLUTION_TEXT, blockedSentence, noticeLang } from "./blocked-texts";

/*
 * Les messages de la file de Sonarr et de Radarr, rangés dans la liste fermée
 * des causes. Messages réels ou tirés des sources de Sonarr v4 / Radarr v5.
 */

const blocked = (message: string, over: { status?: string; trackedDownloadState?: string } = {}) =>
  classifyBlocked({ status: "completed", trackedDownloadState: "importBlocked", messages: [message], ...over });

test("les messages d'import refusé, chacun à sa cause", () => {
  const cases: Array<[string, BlockedCause]> = [
    // Relevé sur le serveur de Damien, 15/10/2026.
    ["Found matching series via grab history, but release was matched to series by ID. Automatic import is not possible. See the FAQ for details.", "unrecognized"],
    ["Sample", "sample"],
    ["Not an upgrade for existing episode file(s)", "notUpgrade"],
    ["Not a Custom Format upgrade for existing movie file(s)", "notUpgrade"],
    ["Episode file already imported at 10/12/2026 21:04:11", "alreadyHere"],
    ["Unable to parse file", "unrecognized"],
    ["Unknown Series", "unrecognized"],
    ["Movie title mismatch, automatic import is not possible", "unrecognized"],
    ["One or more episodes expected in this release were not imported or missing from the release", "missingEpisodes"],
    ["No files found are eligible for import in /downloads/complete/x", "notVideo"],
    ["Caution: Found executable file with extension: '.exe'", "notVideo"],
    ["Not enough free space", "diskSpace"],
    ["Access to the path '/tv/Show' is denied.", "fileAccess"],
    ["Import failed, path does not exist or is not accessible by Sonarr: /downloads/x", "fileAccess"],
    ["Episode has a TBA title and recently aired", "awaitingTitle"],
    ["File is locked, try again later", "busyFile"],
  ];
  for (const [message, cause] of cases) assert.equal(blocked(message), cause, message);
});

test("les messages du transfert, chacun à sa cause", () => {
  const transfer = (message: string, status = "warning") => classifyBlocked({ status, trackedDownloadState: "downloading", messages: [message] });
  assert.equal(transfer("The download is stalled with no connections"), "noSource");
  assert.equal(transfer("qBittorrent is downloading metadata"), "noSource");
  assert.equal(transfer("Unpacking failed, write error or disk is full?"), "diskSpace");
  assert.equal(transfer("Aborted, cannot be completed - https://sabnzbd.org/not-complete", "failed"), "transferFailed");
  assert.equal(transfer("Unable to connect to qBittorrent"), "clientUnreachable");
});

test("sans message : le statut décide, sinon un repli générique — jamais une cause devinée", () => {
  assert.equal(classifyBlocked({ status: "paused", messages: [] }), "paused");
  assert.equal(classifyBlocked({ status: "downloadClientUnavailable", messages: [] }), "clientUnreachable");
  assert.equal(classifyBlocked({ status: "completed", trackedDownloadState: "importBlocked", messages: [] }), "importRefused");
  assert.equal(classifyBlocked({ status: "warning", trackedDownloadState: "failedPending", messages: [] }), "transferFailed");
  assert.equal(classifyBlocked({ status: "warning", messages: ["Quelque chose de jamais vu"] }), "unknown");
});

test("la cause d'un titre : celle qui exige un administrateur d'abord", () => {
  assert.equal(leadingCause(["noSource", "diskSpace"]), "diskSpace");
  assert.equal(leadingCause(["noSource", "transferFailed"]), "noSource");
  assert.equal(leadingCause([]), null);
  assert.equal(isBlockedCause("sample"), true);
  assert.equal(isBlockedCause("toString"), false);
});

test("chaque cause a ses mots en français et en anglais, et dit si elle se résout seule", () => {
  for (const cause of Object.keys(CAUSES) as BlockedCause[]) {
    for (const lang of ["fr", "en"] as const) {
      assert.ok(CAUSE_TEXT[lang][cause]?.length > 10, `${lang}:${cause}`);
      assert.ok(blockedSentence(cause, lang).endsWith(RESOLUTION_TEXT[lang][CAUSES[cause].resolution]));
    }
  }
  assert.equal(blockedSentence("sample", "fr"), "Le fichier reçu n'est qu'un extrait, pas le titre complet. Un administrateur doit intervenir.");
  assert.equal(noticeLang("en-US"), "en");
  assert.equal(noticeLang(null), "fr");
});

test("aucun mot de la famille « téléchargement » : le mobile affiche ces avis", () => {
  const all = [...Object.values(CAUSE_TEXT.fr), ...Object.values(CAUSE_TEXT.en), ...Object.values(RESOLUTION_TEXT.fr), ...Object.values(RESOLUTION_TEXT.en)];
  for (const text of all) assert.doesNotMatch(text, /t[ée]l[ée]charg|download/i, text);
});
