import { test } from "node:test";
import assert from "node:assert/strict";
import { hasGapsToTell, seriesGaps } from "./title-gaps";

/*
 * Les trous d'une série que Tentacle a en partie : les saisons qui ne sont
 * pas là, avec les verrous de la feuille des saisons — une saison demandée y
 * reste, dite, sans se redemander ; une saison là n'y est jamais.
 */

const season = (n: number, episodeCount = 10) => ({ id: n, seasonNumber: n, name: n === 0 ? "Épisodes spéciaux" : `Saison ${n}`, episodeCount });
const SEASONS = [season(0, 3), season(1), season(2), season(3), season(4), season(5)];
const ALL = { tv: true };
const FR = { specials: false, lang: "fr" };

test("seule une série en partie là a des trous à dire", () => {
  assert.equal(hasGapsToTell(4), true);
  for (const status of [undefined, 1, 2, 3, 5, 6, 7]) assert.equal(hasGapsToTell(status), false);
});

test("les saisons là, ou là en partie, ne sont pas des trous ; une saison demandée en est un, verrouillé", () => {
  const mediaInfo = {
    status: 4,
    seasons: [
      { id: 1, seasonNumber: 1, status: 5 },
      { id: 2, seasonNumber: 2, status: 5 },
      { id: 3, seasonNumber: 3, status: 4 },
      // Sonarr la connaît sans que personne l'ait demandée : un trou libre.
      { id: 5, seasonNumber: 5, status: 1 },
    ],
    requests: [{ id: 9, status: 2, seasons: [{ seasonNumber: 4 }] }],
  };
  const out = seriesGaps({ seasons: SEASONS, mediaInfo }, [], ALL, FR);
  assert.deepEqual(out.map((s) => [s.number, s.badge?.label ?? null, s.requestable]), [
    [4, "Demandée", false],
    [5, null, true],
  ]);
});

test("la file du compte verrouille aussitôt ; les épisodes spéciaux comptent quand Jellyseerr les laisse demander", () => {
  const mediaInfo = { status: 4, seasons: [{ id: 1, seasonNumber: 1, status: 5 }] };
  const queued = seriesGaps({ seasons: SEASONS, mediaInfo }, [2], ALL, { specials: true, lang: "en" });
  assert.deepEqual(queued.map((s) => [s.number, s.requestable]), [[2, false], [3, true], [4, true], [5, true], [0, true]]);
  assert.deepEqual(queued[0].badge, { label: "Requested", tone: "info" });
});

test("sans droit sur les séries : les trous se disent, rien ne se demande", () => {
  const mediaInfo = { status: 4, seasons: [{ id: 1, seasonNumber: 1, status: 5 }] };
  const out = seriesGaps({ seasons: SEASONS, mediaInfo }, [], { tv: false }, FR);
  assert.deepEqual(out.map((s) => s.number), [2, 3, 4, 5]);
  assert.ok(out.every((s) => !s.requestable));
});

test("une série dont toutes les saisons sont là n'a aucun trou", () => {
  const mediaInfo = { status: 4, seasons: SEASONS.filter((s) => s.seasonNumber > 0).map((s) => ({ id: s.id, seasonNumber: s.seasonNumber, status: 5 })) };
  assert.deepEqual(seriesGaps({ seasons: SEASONS, mediaInfo }, [], ALL, FR), []);
});
