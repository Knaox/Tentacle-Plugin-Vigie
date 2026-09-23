import { test } from "node:test";
import assert from "node:assert/strict";
import { groupStatus, mergeStatus, stateFromMedia, stateFromRequest, strongest } from "./title-state";
import type { DownloadProgress, ProgressItem } from "../api/types-releases";

const download = (over: Partial<DownloadProgress> = {}): DownloadProgress => ({
  percent: 45, size: 100, sizeLeft: 55, etaSeconds: 60, estimatedCompletionAt: null,
  status: "downloading", validating: false, title: null, seasonNumber: null, episodeNumber: null, ...over,
});

const progress = (over: Partial<DownloadProgress> = {}): ProgressItem => ({
  id: "r1", tmdbId: 1, mediaType: "tv", status: "downloading", download: download(over),
});

test("une fiche Jellyseerr dit en un mot où en est le titre", () => {
  assert.equal(stateFromMedia({ status: 5 })?.state, "available");
  assert.equal(stateFromMedia({ status: 4 })?.state, "partial");
  assert.equal(stateFromMedia({ status: 3 })?.state, "requested");
  assert.equal(stateFromMedia({ status: 2 })?.state, "requested");
  assert.equal(stateFromMedia({ status: 1 }), null);
  assert.equal(stateFromMedia(undefined), null);
});

test("ce qui descend se voit, avancement compris — et ce qui coince est bloqué", () => {
  const moving = stateFromMedia({ status: 3, downloadStatus: [{ status: "downloading", size: 200, sizeLeft: 50 }] });
  assert.deepEqual(moving, { state: "downloading", percent: 75 });
  assert.equal(stateFromMedia({ status: 3, downloadStatus: [{ status: "warning" }] })?.state, "stalled");
  // Un seul épisode qui avance suffit : ce n'est pas bloqué.
  assert.equal(stateFromMedia({ status: 3, downloadStatus: [{ status: "warning" }, { status: "downloading" }] })?.state, "downloading");
});

test("une demande : attente, route, blocage, arrivée — jamais « échec » pour un blocage", () => {
  assert.equal(stateFromRequest({ status: "sent_to_seer" })?.state, "requested");
  assert.equal(stateFromRequest({ status: "unavailable" })?.state, "requested");
  assert.deepEqual(stateFromRequest({ status: "downloading" }, progress()), { state: "downloading", percent: 45 });
  assert.equal(stateFromRequest({ status: "downloading" }, progress({ stalled: true }))?.state, "stalled");
  assert.equal(stateFromRequest({ status: "partially_available" })?.state, "partial");
  assert.equal(stateFromRequest({ status: "partially_available" }, progress())?.state, "downloading");
  assert.equal(stateFromRequest({ status: "available" })?.state, "available");
  assert.equal(stateFromRequest({ status: "deleted" }), null);
  // La demande parle de ses saisons : le serveur la dit « en partie » quand elles le sont.
  assert.equal(stateFromRequest({ status: "partially_available" })?.state, "partial");
});

test("la saison 5 demandée d'une série en partie là : la demande attend, l'affiche dit « en partie »", () => {
  // Le serveur rend « approved » : rien de ce qui a été demandé n'est là.
  const mine = stateFromRequest({ status: "approved" });
  assert.equal(mine?.state, "requested");
  // L'affiche, elle, parle de la série — en partie là.
  assert.equal(mergeStatus({ state: "partial", percent: null }, mine)?.state, "partial");
});

test("une série en partie là reste « en partie », quoi qu'en dise sa demande", () => {
  const partial = { state: "partial" as const, percent: null };
  assert.equal(mergeStatus(partial, { state: "requested", percent: null })?.state, "partial");
  assert.equal(mergeStatus(partial, { state: "available", percent: null })?.state, "partial");
  // Ce qui arrive se voit toujours, avec son avancement.
  assert.equal(mergeStatus(partial, { state: "downloading", percent: 12 })?.state, "downloading");
});

test("sur une affiche : Jellyseerr « disponible » l'emporte, sinon ce qu'on sait de sa demande", () => {
  const available = { state: "available" as const, percent: null };
  const arrivingMine = { state: "downloading" as const, percent: 30 };
  assert.equal(mergeStatus(available, arrivingMine)?.state, "available");
  assert.deepEqual(mergeStatus({ state: "requested", percent: null }, arrivingMine), arrivingMine);
  assert.equal(mergeStatus({ state: "partial", percent: null }, { state: "requested", percent: null })?.state, "partial");
  assert.equal(mergeStatus(null, { state: "stalled", percent: 12 })?.state, "stalled");
});

test("une saison là, une autre seulement demandée : la série est en partie là", () => {
  const here = { state: "available" as const, percent: null };
  const asked = { state: "requested" as const, percent: null };
  assert.equal(strongest(here, asked)?.state, "partial");
  assert.equal(strongest(asked, { state: "partial", percent: null })?.state, "partial");
  assert.equal(strongest(asked, asked)?.state, "requested");
  assert.equal(strongest(here, here)?.state, "available");
});

test("deux saisons demandées : celle qui arrive se voit avant celle qui est là", () => {
  const here = { state: "available" as const, percent: null };
  const moving = { state: "downloading" as const, percent: 20 };
  assert.deepEqual(strongest(here, moving), moving);
  assert.equal(strongest({ state: "requested", percent: null }, here)?.state, "partial");
});

test("une saison publiée d'un coup : l'état du groupe dit l'essentiel", () => {
  const ep = (state: "requested" | "downloading" | "stalled" | "available" | null, percent: number | null = null) =>
    ({ state, percent, requestStatus: null });
  assert.equal(groupStatus([ep("available"), ep("available")])?.state, "available");
  assert.equal(groupStatus([ep("available"), ep("requested")])?.state, "partial");
  assert.deepEqual(groupStatus([ep("downloading", 20), ep("downloading", 60), ep("available")]), { state: "downloading", percent: 40 });
  assert.equal(groupStatus([ep("downloading", 20), ep("stalled")])?.state, "stalled");
  assert.equal(groupStatus([ep(null), ep(null)]), null);
});
