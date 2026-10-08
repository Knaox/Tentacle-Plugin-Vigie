import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupeStoreItems, sourceOrFallback } from "./calendar-store-build";
import { calendarStoreHorizon } from "./calendar-store";
import { detectAnimeLoose } from "./tmdb-traits";
import { capPerSeriesFuture, makeItemId, type CalendarItem, type CalendarKind } from "./calendar-types";

/*
 * Le seul filet du code serveur (aucun typecheck n'y passe) : les invariants
 * du calendrier maître. Le plus traître est la dédup d'épisodes — TMDB date un
 * épisode au jour de la chaîne d'origine, Sonarr au jour réel, souvent la
 * VEILLE : deux « entrées » pour une seule diffusion si on se fie aux ids.
 */

function item(over: Partial<CalendarItem> & { tmdbId: number; date: string; kind: CalendarKind }): CalendarItem {
  const mediaType = over.mediaType ?? "tv";
  return {
    id: makeItemId(mediaType, over.tmdbId, over.kind, over.date),
    mediaType,
    title: `Titre ${over.tmdbId}`,
    posterPath: null, backdropPath: null, overview: null,
    seasonNumber: null, episodeNumber: null,
    networks: null, providerIds: [],
    requestId: null, requestStatus: null,
    ...over,
  };
}

test("le même épisode daté à un jour d'écart ne fait qu'une entrée — Sonarr gagne", () => {
  const tmdb = item({ tmdbId: 42, date: "2026-08-14", kind: "episode", seasonNumber: 1, episodeNumber: 5 });
  const sonarr = item({
    tmdbId: 42, date: "2026-08-13", kind: "episode",
    seasonNumber: 1, episodeNumber: 5, airDateUtc: "2026-08-13T15:15:00Z",
  });
  for (const ordre of [[tmdb, sonarr], [sonarr, tmdb]]) {
    const out = dedupeStoreItems(ordre);
    assert.equal(out.length, 1);
    assert.equal(out[0].airDateUtc, "2026-08-13T15:15:00Z");
  }
});

test("deux épisodes distincts de la même série restent deux entrées", () => {
  const e5 = item({ tmdbId: 42, date: "2026-08-13", kind: "episode", seasonNumber: 1, episodeNumber: 5 });
  const e6 = item({ tmdbId: 42, date: "2026-08-20", kind: "episode", seasonNumber: 1, episodeNumber: 6 });
  assert.equal(dedupeStoreItems([e5, e6]).length, 2);
});

test("même film, même canal : le premier arrivé gagne (les fiches passent avant la découverte)", () => {
  const fiche = item({ tmdbId: 7, mediaType: "movie", date: "2026-08-01", kind: "theatrical", title: "Fiche" });
  const discover = item({ tmdbId: 7, mediaType: "movie", date: "2026-08-03", kind: "theatrical", title: "Découverte" });
  const out = dedupeStoreItems([fiche, discover]);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "Fiche");
});

test("deux canaux différents du même film restent deux entrées", () => {
  const salle = item({ tmdbId: 7, mediaType: "movie", date: "2026-06-01", kind: "theatrical" });
  const streaming = item({ tmdbId: 7, mediaType: "movie", date: "2026-08-20", kind: "digital" });
  assert.equal(dedupeStoreItems([salle, streaming]).length, 2);
});

test("un épisode anonyme s'efface devant l'épisode identifié du même jour, pas des autres", () => {
  const identifie = item({
    tmdbId: 42, date: "2026-08-13", kind: "episode",
    seasonNumber: 1, episodeNumber: 5, airDateUtc: "2026-08-13T15:15:00Z",
  });
  const anonymeMemeJour = item({ tmdbId: 42, date: "2026-08-13", kind: "episode" });
  const anonymeAutreJour = item({ tmdbId: 42, date: "2026-08-27", kind: "episode" });

  const out = dedupeStoreItems([identifie, anonymeMemeJour, anonymeAutreJour]);
  assert.equal(out.length, 2);
  assert.ok(out.some((i) => i.episodeNumber === 5));
  assert.ok(out.some((i) => i.date === "2026-08-27" && i.episodeNumber === null));
});

test("detectAnimeLoose : le verdict stocké fait foi, la fiche froide retombe sur langue + genre", () => {
  // Verdict posé à l'écriture (mots-clés vus) : rien à recalculer.
  assert.equal(detectAnimeLoose({ isAnime: true }), true);
  // Fiche d'avant la colonne : is_anime = 0, mais langue et genres parlent.
  assert.equal(detectAnimeLoose({ isAnime: false, originalLanguage: "ja", genreIds: [16, 10759] }), true);
  // Pixar : animation occidentale — le genre seul ne suffit jamais.
  assert.equal(detectAnimeLoose({ isAnime: false, originalLanguage: "en", genreIds: [16] }), false);
  // Rien ne le laisse penser : non.
  assert.equal(detectAnimeLoose({ isAnime: false, originalLanguage: "ja", genreIds: [18] }), false);
});

test("l'horizon du store couvre le mois précédent (grille comprise) et six mois devant", () => {
  assert.deepEqual(calendarStoreHorizon("2026-08-15"), { from: "2026-06-24", to: "2027-02-11" });
  // Passage d'année : janvier remonte à novembre de l'année d'avant.
  assert.deepEqual(calendarStoreHorizon("2026-01-05"), { from: "2025-11-24", to: "2026-07-04" });
});

test("sourceOrFallback : l'échec devient un repli marqué, le succès passe intact", async () => {
  const marques: unknown[] = [];

  const ok = await sourceOrFallback(Promise.resolve(["a", "b"]), [], () => { marques.push("non"); });
  assert.deepEqual(ok, ["a", "b"]);
  assert.equal(marques.length, 0);

  const ko = await sourceOrFallback(
    Promise.reject(new Error("guichet muet")),
    ["repli"],
    (err) => { marques.push(err); },
  );
  assert.deepEqual(ko, ["repli"]);
  assert.ok(marques[0] instanceof Error);
});

test("capPerSeriesFuture : le passé n'est jamais élagué, le futur reste plafonné", () => {
  const serie = (date: string, ep: number) =>
    item({ tmdbId: 9, date, kind: "episode", seasonNumber: 1, episodeNumber: ep });
  const items = [
    serie("2026-08-10", 1), serie("2026-08-11", 2), serie("2026-08-12", 3), // passé
    serie("2026-08-15", 4), serie("2026-08-16", 5), serie("2026-08-17", 6), // futur
    item({ tmdbId: 7, mediaType: "movie", date: "2026-09-01", kind: "digital" }), // film : jamais compté
  ];
  const out = capPerSeriesFuture(items, 2, "2026-08-15");
  assert.deepEqual(
    out.map((i) => i.date),
    ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-15", "2026-08-16", "2026-09-01"],
  );
});
