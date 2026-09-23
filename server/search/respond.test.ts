import { test } from "node:test";
import assert from "node:assert/strict";
import { presentHub, presentProvider } from "./respond";
import { parseQuery } from "./query";
import type { Candidate } from "./present";
import type { Ranked } from "./service";

const NOW = new Date(2026, 8, 23);

function candidate(partial: Partial<Candidate> & { tmdbId: number; title: string; text: number }): Candidate {
  return {
    key: `movie:${partial.tmdbId}`, mediaType: "movie", originalTitle: null, names: [partial.title.toLowerCase()],
    releaseDate: "2020-01-01", year: 2020, posterPath: "/p.jpg", backdropPath: null, overview: null,
    voteAverage: 7, voteCount: 1000, popularity: 20, genreIds: [], originalLanguage: "en", isAnime: false,
    remoteStatus: undefined, remoteRank: 0, score: partial.text, ...partial,
  };
}

function ranked(query: string, media: Candidate[]): Ranked {
  return {
    parsed: parseQuery(query, NOW), searched: query, correction: null, media, people: [],
    hasMore: false, blockedCount: 0, blockedActive: false, complete: true,
  };
}

const titles = (r: Ranked) => presentProvider(r, null, 8, "fr", "2026-09-23").items.map((i) => i.title);

test("seul ce qui n'est pas sur le serveur est proposé", () => {
  const r = ranked("dune", [
    candidate({ tmdbId: 1, title: "Dune", text: 1000, remoteStatus: 5 }),
    candidate({ tmdbId: 2, title: "Dune", year: 1984, text: 1000 }),
  ]);
  assert.deepEqual(titles(r), ["Dune"]);
  assert.equal(presentProvider(r, null, 8, "fr", "2026-09-23").items[0].id, "movie:2");
});

test("à côté d'un titre que le serveur a déjà, seuls les homonymes et suites connus restent", () => {
  const r = ranked("breaking bad", [
    candidate({ tmdbId: 1, title: "Breaking Bad", text: 1000, remoteStatus: 5 }),
    candidate({ tmdbId: 2, title: "Breaking Bad Wolf", year: null, text: 880, voteCount: 0, popularity: 0.4 }),
    candidate({ tmdbId: 3, title: "Breaking Bad : le film", text: 880, voteCount: 4000, popularity: 30 }),
  ]);
  assert.deepEqual(titles(r), ["Breaking Bad : le film"]);
});

test("l'homonyme obscur d'une faute de frappe ne passe pas quand le vrai titre est là", () => {
  const r = ranked("interstelar", [
    // Atteint par correction : 1000 moins la pénalité.
    candidate({ tmdbId: 1, title: "Interstellar", text: 920, remoteStatus: 5 }),
    candidate({ tmdbId: 2, title: "Interstelar", text: 1000, voteCount: 2, popularity: 0.6 }),
  ]);
  assert.deepEqual(titles(r), []);
});

test("sans rien sur le serveur, un titre exact même obscur reste proposé", () => {
  const r = ranked("interstelar", [
    candidate({ tmdbId: 2, title: "Interstelar", text: 1000, voteCount: 2, popularity: 0.6 }),
  ]);
  assert.deepEqual(titles(r), ["Interstelar"]);
});

test("avant que les statuts soient chargés, un titre de l'index seul n'est pas proposé", () => {
  // Au démarrage, la carte des statuts est vide : « Dune » (2021) pourrait être sur le serveur.
  const r = ranked("dune", [
    candidate({ tmdbId: 1, title: "Dune", text: 1000, remoteRank: null }),
    candidate({ tmdbId: 2, title: "Dune", year: 1984, text: 1000, remoteRank: 3 }),
  ]);
  const response = presentProvider(r, null, 8, "fr", "2026-09-23");
  assert.deepEqual(response.items.map((i) => i.id), ["movie:2"]);
  assert.equal(response.complete, false, "le client doit redemander");
});

test("quand aucun nom ne contient les mots tapés, le plus connu des premiers choix de TMDB est mis en avant", () => {
  const r = ranked("shingeki no kyojin", [
    candidate({ tmdbId: 5, title: "進撃の巨人 -the Musical-", text: 0, remoteRank: 0, voteCount: 2 }),
    candidate({ tmdbId: 1, title: "L'Attaque des Titans : la dernière attaque", text: 0, remoteRank: 3, voteCount: 400 }),
    candidate({ tmdbId: 1429, mediaType: "tv", key: "tv:1429", title: "L'Attaque des Titans", text: 0, remoteRank: 1, voteCount: 7000 }),
  ]);
  const hub = presentHub(r, 1, [], false, Date.now());
  assert.equal(hub.top?.kind, "media");
  assert.equal(hub.top?.kind === "media" ? hub.top.item.id : null, 1429);
});
