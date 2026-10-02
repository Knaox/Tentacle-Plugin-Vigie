import { test } from "node:test";
import assert from "node:assert/strict";
import type { EpisodeFact } from "./sonarr-episodes";
import { decideAdvance, isDowngrade, seasonFacts, type AdvanceInput } from "./arr-advance-plan";

/*
 * Ce que Sonarr et Radarr font dire à Vigie, sans attendre Jellyseerr : le
 * statut d'une demande et ce qu'on annonce — une fois, jamais deux.
 */

const ep = (hasFile: boolean, monitored = true): EpisodeFact => ({ hasFile, monitored });

function facts(entries: Array<[string, EpisodeFact]>): Map<string, EpisodeFact> {
  return new Map(entries);
}

const movie = (over: Partial<AdvanceInput>): AdvanceInput => ({
  status: "approved", mediaType: "movie", notifiedSeasons: null, inQueue: false, ...over,
});

const series = (over: Partial<AdvanceInput>): AdvanceInput => ({
  status: "approved", mediaType: "tv", notifiedSeasons: null, inQueue: false, ...over,
});

test("le film rangé par Radarr est annoncé tout de suite, une seule fois", () => {
  const d = decideAdvance(movie({ status: "downloading", movieHasFile: true }));
  assert.equal(d.status, "available");
  assert.equal(d.completed, true);
  assert.equal(d.notifyMovie, true);
  assert.deepEqual(d.notified, [0]);

  const again = decideAdvance(movie({ status: "downloading", movieHasFile: true, notifiedSeasons: [0] }));
  assert.equal(again.notifyMovie, false);
  assert.equal(again.notified, null);
});

test("le film qui entre dans la file part « en route »", () => {
  const d = decideAdvance(movie({ status: "sent_to_seer", inQueue: true }));
  assert.equal(d.status, "downloading");
  assert.equal(d.notifyDownloading, true);
  // Déjà en route : rien à redire.
  assert.equal(decideAdvance(movie({ status: "downloading", inQueue: true })).status, null);
});

test("un téléchargement abandonné sans fichier redevient une attente, sans notification", () => {
  const d = decideAdvance(movie({ status: "downloading", movieHasFile: false }));
  assert.equal(d.status, "unavailable");
  assert.equal(d.notifyDownloading || d.notifyMovie, false);
});

test("Radarr muet : rien ne bouge", () => {
  assert.deepEqual(decideAdvance(movie({ status: "downloading", movieHasFile: null })).status, null);
});

test("les saisons se comptent d'après les fichiers de Sonarr", () => {
  const f = facts([
    ["S1E1", ep(true)], ["S1E2", ep(true)],
    ["S2E1", ep(true)], ["S2E2", ep(false)],
    ["S3E1", ep(false)],
    ["S0E1", ep(false)],
  ]);
  const all = seasonFacts(f, null);
  assert.deepEqual(all.considered, [1, 2, 3]);
  assert.deepEqual(all.complete, [1]);
  assert.deepEqual(all.started, [1, 2]);
  assert.deepEqual(seasonFacts(f, [2]).considered, [2]);
});

test("un épisode que Sonarr ne suit plus ne bloque pas sa saison", () => {
  const f = facts([["S1E1", ep(true)], ["S1E2", ep(false, false)]]);
  assert.deepEqual(seasonFacts(f, [1]).complete, [1]);
});

test("chaque saison demandée est annoncée à son arrivée, la demande close à la dernière", () => {
  const f = facts([["S1E1", ep(true)], ["S2E1", ep(false)]]);
  const first = decideAdvance(series({ status: "downloading", seasons: seasonFacts(f, [1, 2]) }));
  assert.deepEqual(first.notifySeasons, [1]);
  assert.deepEqual(first.notified, [1]);
  assert.equal(first.status, "partially_available");

  const done = facts([["S1E1", ep(true)], ["S2E1", ep(true)]]);
  const last = decideAdvance(series({ status: "partially_available", notifiedSeasons: [1], seasons: seasonFacts(done, [1, 2]) }));
  assert.deepEqual(last.notifySeasons, [2]);
  assert.deepEqual(last.notified, [1, 2]);
  assert.equal(last.status, "available");
  assert.equal(last.completed, true);
});

test("les saisons déjà annoncées par Jellyseerr ne le sont pas deux fois", () => {
  const f = facts([["S1E1", ep(true)], ["S2E1", ep(true)]]);
  const d = decideAdvance(series({ status: "partially_available", notifiedSeasons: [1, 2], seasons: seasonFacts(f, [1, 2]) }));
  assert.deepEqual(d.notifySeasons, []);
  assert.equal(d.notified, null);
  assert.equal(d.status, "available");
});

test("une saison en cours de diffusion reste « en partie » jusqu'à son dernier épisode", () => {
  const f = facts([["S4E1", ep(true)], ["S4E2", ep(true)], ["S4E3", ep(false)]]);
  const d = decideAdvance(series({ status: "downloading", seasons: seasonFacts(f, [4]) }));
  assert.equal(d.status, "partially_available");
  assert.deepEqual(d.notifySeasons, []);
});

test("jamais de recul : une demande disponible en partie ne redevient pas « en téléchargement »", () => {
  const f = facts([["S1E1", ep(true)], ["S2E1", ep(false)]]);
  const d = decideAdvance(series({ status: "partially_available", notifiedSeasons: [1], inQueue: true, seasons: seasonFacts(f, [1, 2]) }));
  assert.equal(d.status, null);
  assert.equal(d.notifyDownloading, false);
  assert.equal(isDowngrade("partially_available", "downloading"), true);
  assert.equal(isDowngrade("approved", "sent_to_seer"), false);
  assert.equal(isDowngrade("available", "deleted"), false);
});

test("« en route » n'est jamais annoncé après une saison arrivée", () => {
  const f = facts([["S1E1", ep(false)]]);
  const d = decideAdvance(series({ status: "approved", notifiedSeasons: [2], inQueue: true, seasons: seasonFacts(f, [1]) }));
  assert.equal(d.status, "downloading");
  assert.equal(d.notifyDownloading, false);
});

test("série que Sonarr ne suit pas : seule la file parle", () => {
  assert.equal(decideAdvance(series({ inQueue: true, seasons: null })).status, "downloading");
  assert.equal(decideAdvance(series({ inQueue: false, seasons: null })).status, null);
});

/* Le texte des annonces : le serveur Tentacle reconnaît une disponibilité à
 * « sur Tentacle TV » et lit les saisons en tête (seerAvailabilityGuard.ts). */
test("les annonces gardent le format que le serveur Tentacle sait lire", async () => {
  const { arrivalNotifications } = await import("./arr-advance");
  const req = {
    id: "r1", jellyfinUserId: "u1", username: "u", mediaType: "tv" as const, tmdbId: 1, title: "The Bear",
    posterPath: null, backdropPath: null, overview: null, year: null, seasons: [1, 2, 3], notifiedSeasons: [1],
    status: "partially_available" as const, seerrRequestId: 1, seerrMediaId: 1, seerrMediaStatus: 4,
    retryCount: 0, maxRetries: 10, lastError: null, priority: 0, createdAt: "", updatedAt: "",
    sentAt: null, completedAt: null, pendingCleanupId: null, profileId: null, isAnime: false,
    origin: null, platform: null,
  };
  const [season] = arrivalNotifications(req, {
    status: null, completed: false, notifyDownloading: false, notifyMovie: false, notifySeasons: [2], notified: [1, 2],
  });
  assert.equal(season.body, "Saison 2 est sortie sur Tentacle TV (2/3 saisons)");
  assert.match(season.body, /^Saisons?\s+2\b/);

  const [film, departure] = arrivalNotifications({ ...req, mediaType: "movie", title: "Dune", seasons: null }, {
    status: "available", completed: true, notifyDownloading: true, notifyMovie: true, notifySeasons: [], notified: [0],
  }).reverse();
  assert.equal(film.body, "« Dune » est sorti sur Tentacle TV");
  // Le départ n'est pas une disponibilité, et ne dit jamais « téléchargement ».
  assert.equal(departure.body.includes("sur Tentacle TV"), false);
  assert.equal(/t[ée]l[ée]charg/i.test(departure.body), false);
});
