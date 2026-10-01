import { test } from "node:test";
import assert from "node:assert/strict";
import { freeSeasons, parseRequestedSeasons, titleSeasons } from "./title-seasons";

/*
 * La feuille des saisons d'un client qui ne montre pas nos pages : chaque
 * saison dit où elle en est avec les mots du hub, et seules les saisons
 * libres se demandent — les verrous de la fiche, à l'identique.
 */

const season = (n: number, episodeCount = 10) => ({ id: n, seasonNumber: n, name: n === 0 ? "Épisodes spéciaux" : `Saison ${n}`, episodeCount });
const SEASONS = [season(0, 3), season(1), season(2), season(3), season(4)];
const ALL = { tv: true };
const FR = { specials: false, lang: "fr" };

test("une série jamais demandée : toutes ses saisons numérotées se demandent, dans l'ordre", () => {
  const out = titleSeasons({ seasons: SEASONS }, [], ALL, FR);
  assert.deepEqual(out.map((s) => s.number), [1, 2, 3, 4]);
  assert.ok(out.every((s) => s.requestable && s.badge === null));
  assert.deepEqual(out[0], { number: 1, name: "Saison 1", episodeCount: 10, badge: null, requestable: true });
});

test("les épisodes spéciaux viennent en dernier, quand Jellyseerr les laisse demander", () => {
  const out = titleSeasons({ seasons: SEASONS }, [], ALL, { specials: true, lang: "fr" });
  assert.deepEqual(out.map((s) => s.number), [1, 2, 3, 4, 0]);
});

test("là, en partie, demandée chez Jellyseerr ou dans notre file : verrouillée, et dite", () => {
  const mediaInfo = {
    status: 4,
    seasons: [
      { id: 1, seasonNumber: 1, status: 5 },
      { id: 2, seasonNumber: 2, status: 4 },
      // Sonarr la connaît sans que personne l'ait demandée : elle reste libre.
      { id: 4, seasonNumber: 4, status: 1 },
    ],
    requests: [{ id: 9, status: 2, seasons: [{ seasonNumber: 3 }] }],
  };
  const out = titleSeasons({ seasons: SEASONS, mediaInfo }, [], ALL, FR);
  assert.deepEqual(out.map((s) => [s.number, s.badge?.label ?? null, s.requestable]), [
    [1, "Disponible", false],
    [2, "En partie", false],
    [3, "Demandée", false],
    [4, null, true],
  ]);
  // La file locale verrouille aussitôt, avant que Jellyseerr ne la connaisse.
  const queued = titleSeasons({ seasons: SEASONS }, [4], ALL, { specials: false, lang: "en" });
  assert.deepEqual(queued.find((s) => s.number === 4)?.badge, { label: "Requested", tone: "info" });
  assert.equal(queued.find((s) => s.number === 4)?.requestable, false);
});

test("sans droit sur les séries, ou une série masquée : on dit où elle en est, rien ne se demande", () => {
  assert.ok(titleSeasons({ seasons: SEASONS }, [], { tv: false }, FR).every((s) => !s.requestable));
  const masked = { status: 6 };
  assert.ok(titleSeasons({ seasons: SEASONS, mediaInfo: masked }, [], ALL, FR).every((s) => !s.requestable));
  // L'administrateur permet les titres masqués : elles redeviennent libres.
  assert.ok(titleSeasons({ seasons: SEASONS, mediaInfo: masked }, [], { tv: true, masked: true }, FR).every((s) => s.requestable));
});

test("les saisons d'une demande : entières, dédoublonnées, croissantes", () => {
  assert.deepEqual(parseRequestedSeasons([3, 1, 1, 2.5, "4", -1, 2]), [1, 2, 3]);
  assert.equal(parseRequestedSeasons([]), null);
  assert.equal(parseRequestedSeasons("1,2"), null);
});

test("ne part que ce qui se demande encore", () => {
  const out = titleSeasons({ seasons: SEASONS }, [2], ALL, FR);
  assert.deepEqual(freeSeasons([1, 2, 3, 9], out), [1, 3]);
});
