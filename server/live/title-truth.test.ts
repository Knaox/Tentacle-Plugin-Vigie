import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NO_SEASONS, REQUEST, STATUS, UNKNOWN_LIBRARY, correctMediaStatus, correctSeasonStatus,
  type LibraryFact, type RequestFact, type TitleFacts,
} from "./title-truth";

/*
 * La règle, cas par cas — celle que dit l'administrateur :
 *   « un titre supprimé de Jellyfin ne s'affiche pas Disponible mais Demandé,
 *     si la demande est toujours dans Jellyseerr ; sans demande, il se
 *     redemande ».
 */

const gone: LibraryFact = { state: "gone", goneSeasons: NO_SEASONS, presentSeasons: NO_SEASONS };
const present: LibraryFact = { state: "present", goneSeasons: NO_SEASONS, presentSeasons: NO_SEASONS };
const req = (status: number, seasons: number[] = [], is4k = false): RequestFact => ({ status, seasons, is4k });
const facts = (library: LibraryFact, requests: RequestFact[] | null, extra: Partial<TitleFacts> = {}): TitleFacts => ({
  library, requests, queued: false, ...extra,
});

test("supprimé de Jellyfin, demande toujours là (terminée comprise) : Demandé", () => {
  assert.equal(correctMediaStatus("movie", STATUS.AVAILABLE, facts(gone, [req(REQUEST.COMPLETED)])), STATUS.PENDING);
  assert.equal(correctMediaStatus("movie", STATUS.AVAILABLE, facts(gone, [req(REQUEST.APPROVED)])), STATUS.PENDING);
  assert.equal(correctMediaStatus("movie", STATUS.AVAILABLE, facts(gone, [req(REQUEST.PENDING)])), STATUS.PENDING);
  // Quelque chose redescend : en cours.
  assert.equal(correctMediaStatus("movie", STATUS.AVAILABLE, facts(gone, [req(REQUEST.APPROVED)], { downloading: true })), STATUS.PROCESSING);
});

test("supprimé de Jellyfin, plus aucune demande : il se redemande (supprimé)", () => {
  assert.equal(correctMediaStatus("movie", STATUS.AVAILABLE, facts(gone, [])), STATUS.DELETED);
  // Refusée, en échec, en 4K : ne retiennent rien.
  assert.equal(correctMediaStatus("movie", STATUS.AVAILABLE, facts(gone, [req(REQUEST.DECLINED), req(REQUEST.FAILED), req(REQUEST.APPROVED, [], true)])), STATUS.DELETED);
  assert.equal(correctMediaStatus("tv", STATUS.PARTIALLY_AVAILABLE, facts(gone, [])), STATUS.DELETED);
});

test("supprimé, demandes inconnues (Jellyseerr muet) : ce que Jellyseerr dit d'une demande vaut encore", () => {
  assert.equal(correctMediaStatus("movie", STATUS.AVAILABLE, facts(gone, null)), STATUS.DELETED);
  assert.equal(correctMediaStatus("movie", STATUS.PROCESSING, facts(gone, null)), STATUS.PROCESSING);
  // …sauf la file de Vigie, qui le sait.
  assert.equal(correctMediaStatus("movie", STATUS.AVAILABLE, facts(gone, null, { queued: true })), STATUS.PENDING);
});

test("masqué : rien ne le change", () => {
  assert.equal(correctMediaStatus("movie", STATUS.BLOCKLISTED, facts(gone, [])), STATUS.BLOCKLISTED);
  assert.equal(correctMediaStatus("movie", STATUS.BLOCKLISTED, facts(present, [])), STATUS.BLOCKLISTED);
});

test("là dans Jellyfin : disponible, quoi que Jellyseerr n'ait pas encore vu", () => {
  assert.equal(correctMediaStatus("movie", undefined, facts(present, [])), STATUS.AVAILABLE);
  assert.equal(correctMediaStatus("movie", STATUS.DELETED, facts(present, [])), STATUS.AVAILABLE);
  assert.equal(correctMediaStatus("movie", STATUS.PROCESSING, facts(present, [req(REQUEST.APPROVED)])), STATUS.AVAILABLE);
  assert.equal(correctMediaStatus("movie", STATUS.AVAILABLE, facts(present, [])), STATUS.AVAILABLE);
  // Une série en a au moins une saison : en partie.
  assert.equal(correctMediaStatus("tv", STATUS.UNKNOWN, facts(present, [])), STATUS.PARTIALLY_AVAILABLE);
});

test("une série dont une saison est partie n'est plus là en entier", () => {
  const partial: LibraryFact = { state: "present", goneSeasons: new Set([2]), presentSeasons: new Set([1]) };
  assert.equal(correctMediaStatus("tv", STATUS.AVAILABLE, facts(partial, [])), STATUS.PARTIALLY_AVAILABLE);
  // La saison partie : demandée si une demande la couvre, sinon libre.
  assert.equal(correctSeasonStatus(2, STATUS.AVAILABLE, facts(partial, [req(REQUEST.COMPLETED, [1, 2])])), STATUS.PENDING);
  assert.equal(correctSeasonStatus(2, STATUS.AVAILABLE, facts(partial, [req(REQUEST.COMPLETED, [1])])), STATUS.DELETED);
  assert.equal(correctSeasonStatus(2, STATUS.AVAILABLE, facts(partial, [])), STATUS.DELETED);
  // La saison restée : inchangée.
  assert.equal(correctSeasonStatus(1, STATUS.AVAILABLE, facts(partial, [])), STATUS.AVAILABLE);
  // En file chez Vigie (pas encore chez Jellyseerr) : demandée.
  assert.equal(correctSeasonStatus(2, STATUS.AVAILABLE, facts(partial, [], { queued: true, queuedSeasons: new Set([2]) })), STATUS.PENDING);
});

test("Jellyfin n'en dit rien : Jellyseerr fait foi, au fil des demandes", () => {
  // La demande a été supprimée dans Jellyseerr : il se redemande tout de suite.
  assert.equal(correctMediaStatus("movie", STATUS.PENDING, facts(UNKNOWN_LIBRARY, [])), STATUS.UNKNOWN);
  assert.equal(correctMediaStatus("movie", STATUS.PROCESSING, facts(UNKNOWN_LIBRARY, [req(REQUEST.DECLINED)])), STATUS.UNKNOWN);
  assert.equal(correctMediaStatus("movie", STATUS.PENDING, facts(UNKNOWN_LIBRARY, [req(REQUEST.PENDING)])), STATUS.PENDING);
  // Demandes inconnues : on ne conclut rien.
  assert.equal(correctMediaStatus("movie", STATUS.PENDING, facts(UNKNOWN_LIBRARY, null)), STATUS.PENDING);
  // Supprimé pour Jellyseerr (sa synchro), demande toujours là : Demandé.
  assert.equal(correctMediaStatus("movie", STATUS.DELETED, facts(UNKNOWN_LIBRARY, [req(REQUEST.COMPLETED)])), STATUS.PENDING);
  assert.equal(correctMediaStatus("movie", STATUS.DELETED, facts(UNKNOWN_LIBRARY, [])), STATUS.DELETED);
  // Rien à dire d'un titre inconnu.
  assert.equal(correctMediaStatus("movie", undefined, facts(UNKNOWN_LIBRARY, [])), undefined);
  assert.equal(correctMediaStatus("movie", STATUS.AVAILABLE, facts(UNKNOWN_LIBRARY, [])), STATUS.AVAILABLE);
});

test("une saison : demandée puis supprimée de la demande — libre", () => {
  const unknown = facts(UNKNOWN_LIBRARY, [req(REQUEST.APPROVED, [1])]);
  assert.equal(correctSeasonStatus(2, STATUS.PENDING, unknown), STATUS.UNKNOWN);
  assert.equal(correctSeasonStatus(1, STATUS.PENDING, unknown), STATUS.PENDING);
  assert.equal(correctSeasonStatus(1, STATUS.PENDING, facts(UNKNOWN_LIBRARY, null)), STATUS.PENDING);
});

test("saisons d'une série partie en entier : comme ses demandes le disent", () => {
  const all = facts(gone, [req(REQUEST.APPROVED, [1])]);
  assert.equal(correctSeasonStatus(1, STATUS.AVAILABLE, all), STATUS.PENDING);
  assert.equal(correctSeasonStatus(2, STATUS.AVAILABLE, all), STATUS.DELETED);
  assert.equal(correctSeasonStatus(3, STATUS.UNKNOWN, all), STATUS.UNKNOWN);
});
