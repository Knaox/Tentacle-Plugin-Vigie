import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { liveState } from "./live-state";
import { requestIndex } from "./request-index";
import type { IndexedRequest } from "./request-index-model";
import { correctCatalog } from "./catalog-correct";
import { correctMediaInfo } from "./media-info";
import { resolveLiveStatus } from "./request-row";
import { REQUEST, STATUS } from "./title-truth";
import { resolveRequestStatus } from "../request-status";
import { seasonLocks } from "../../src/utils/season-locks";

/*
 * La même règle, là où le hub et « Mes demandes » lisent l'état d'un titre :
 * les pages de catalogue et les fiches relayées, les lignes de demandes.
 */

const LONG_AGO = Date.now() - 3_600_000;
/** Faites la veille du départ : les demandes d'avant. */
const BEFORE = new Date(LONG_AGO - 86_400_000).toISOString();
const AFTER = new Date(LONG_AGO + 60_000).toISOString();
const indexed = (id: number, tmdbId: number, status: number, mediaType: "movie" | "tv" = "movie", seasons: number[] = []): IndexedRequest => ({
  id, status, is4k: false, mediaType, tmdbId, seasons,
  requestedBy: { seerrUserId: 1, jellyfinUserId: "u1", name: null }, createdAt: BEFORE, updatedAt: null, mediaStatus: 5,
});

beforeEach(() => {
  liveState.reset();
  requestIndex.reset();
  // 603 : film supprimé il y a une heure (acquis) ; 604 : là ; 1399 : saison 2 supprimée.
  liveState.setLibrary([
    { key: "m:t:603", present: false, departedAt: LONG_AGO },
    { key: "m:t:604", present: true, departedAt: null },
    { key: "e:t:1399:1", present: true, departedAt: null },
    { key: "e:t:1399:2", present: false, departedAt: LONG_AGO },
  ]);
  requestIndex.seed([indexed(1, 603, REQUEST.COMPLETED), indexed(2, 1399, REQUEST.COMPLETED, "tv", [1, 2])]);
});

test("une page de catalogue : le film supprimé n'est plus « Disponible », le cache n'est pas touché", () => {
  const page = {
    page: 1,
    results: [
      { id: 603, mediaType: "movie", mediaInfo: { status: 5, jellyfinMediaId: "j603" } },
      { id: 604, mediaType: "movie", mediaInfo: { status: 5 } },
      { id: 999, mediaType: "movie" },
    ],
  };
  const frozen = JSON.stringify(page);
  const out = correctCatalog("api/v1/discover/movies", page);
  // Sa demande d'avant ne le retient plus : il se redemande.
  assert.deepEqual(out.results[0].mediaInfo, { status: STATUS.DELETED, jellyfinMediaId: null });
  assert.equal(out.results[1], page.results[1], "rien à corriger : le même objet");
  assert.equal(out.results[2], page.results[2]);
  assert.equal(JSON.stringify(page), frozen, "la page en cache reste celle de Jellyseerr");
});

test("une fiche de série : la saison supprimée se redemande, la série « en partie »", () => {
  const detail = {
    id: 1399,
    mediaInfo: {
      status: 5,
      seasons: [{ seasonNumber: 1, status: 5 }, { seasonNumber: 2, status: 5 }],
      requests: [{ id: 2, status: REQUEST.COMPLETED, createdAt: BEFORE, seasons: [{ seasonNumber: 1 }, { seasonNumber: 2 }] }],
    },
  };
  const out = correctCatalog("api/v1/tv/1399", detail);
  assert.equal(out.mediaInfo.status, STATUS.PARTIALLY_AVAILABLE);
  assert.deepEqual(out.mediaInfo.seasons.map((s) => s.status), [STATUS.AVAILABLE, STATUS.DELETED]);
  assert.equal(seasonLocks(out.mediaInfo as never, []).has(2), false, "la feuille des saisons la laisse redemander");
  // Redemandée : demandée.
  const again = correctMediaInfo("tv", 1399, {
    ...detail.mediaInfo,
    requests: [...detail.mediaInfo.requests, { id: 3, status: REQUEST.PENDING, createdAt: AFTER, seasons: [{ seasonNumber: 2 }] }],
  });
  assert.deepEqual(again?.seasons?.map((s) => s.status), [STATUS.AVAILABLE, STATUS.PENDING]);
  // Sans demande, la saison est libre : la feuille la laisse redemander.
  const noRequest = correctMediaInfo("tv", 1399, { status: 5, seasons: [{ seasonNumber: 1, status: 5 }, { seasonNumber: 2, status: 5 }], requests: [] });
  assert.deepEqual(noRequest?.seasons?.map((s) => s.status), [STATUS.AVAILABLE, STATUS.DELETED]);
  assert.equal(seasonLocks(noRequest as never, []).has(2), false);
  assert.equal(seasonLocks(noRequest as never, []).get(1), STATUS.AVAILABLE);
});

test("un titre que Jellyfin a et que Jellyseerr ne connaît pas encore : là", () => {
  assert.deepEqual(correctMediaInfo("movie", 604, undefined), { status: STATUS.AVAILABLE });
  assert.equal(correctMediaInfo("movie", 999, undefined), undefined);
});

test("« Mes demandes » : supprimé de Jellyfin, la demande d'avant est supprimée — une redemande attend", () => {
  const row = { status: REQUEST.COMPLETED, createdAt: BEFORE, media: { tmdbId: 603, mediaType: "movie", status: 5 } };
  assert.equal(resolveLiveStatus(row, { status: "available" }), "deleted");
  // Synchro nocturne de Jellyseerr passée (supprimé pour lui aussi) : supprimée de même.
  assert.equal(resolveLiveStatus({ ...row, media: { ...row.media, status: 7 } }, { status: "available" }), "deleted");
  // Une redemande, faite après la suppression : elle attend (en validation, ou validée).
  requestIndex.seed([indexed(1, 603, REQUEST.COMPLETED), { ...indexed(5, 603, REQUEST.PENDING), createdAt: AFTER }]);
  assert.equal(resolveLiveStatus({ ...row, status: REQUEST.PENDING, createdAt: AFTER }, null), "sent_to_seer");
  assert.equal(resolveLiveStatus({ ...row, status: REQUEST.APPROVED, createdAt: AFTER }, null), "approved");
  // Là dans Jellyfin : disponible.
  assert.equal(resolveLiveStatus({ status: REQUEST.COMPLETED, media: { tmdbId: 604, mediaType: "movie", status: 5 } }, null), "available");
});

test("« Mes demandes » : une saison supprimée ne compte plus pour arrivée, même terminée", () => {
  const row = {
    status: REQUEST.COMPLETED,
    seasons: [{ seasonNumber: 1, status: REQUEST.COMPLETED }, { seasonNumber: 2, status: REQUEST.COMPLETED }],
    media: { tmdbId: 1399, mediaType: "tv", status: 5, seasons: [{ seasonNumber: 1, status: 5 }, { seasonNumber: 2, status: 5 }] },
  };
  assert.equal(resolveLiveStatus(row, null), "partially_available");
});

test("l'épingle « Disponible » ne vaut que si Jellyfin ne dit rien du titre", () => {
  const lost = { status: REQUEST.COMPLETED, media: { status: 7 } };
  assert.equal(resolveRequestStatus(lost, { status: "available" }), "available");
  assert.equal(resolveRequestStatus(lost, { status: "available" }, undefined, "gone"), "deleted");
  // Un titre que la liste du serveur ne connaît pas (« Marquer comme disponible » d'un
  // titre que Jellyfin n'identifie pas) garde l'ancienne épingle ; sans elle, Jellyseerr
  // l'a vu partir : sa demande terminée est consommée, comme il le dit.
  const unknownTitle = { status: REQUEST.COMPLETED, media: { tmdbId: 42, mediaType: "movie", status: 7 } };
  assert.equal(resolveLiveStatus(unknownTitle, { status: "available" }), "available");
  assert.equal(resolveLiveStatus(unknownTitle, null), "deleted");
  // Une demande qui attend encore, elle, attend.
  assert.equal(resolveLiveStatus({ ...unknownTitle, status: REQUEST.APPROVED }, null), "approved");
});
