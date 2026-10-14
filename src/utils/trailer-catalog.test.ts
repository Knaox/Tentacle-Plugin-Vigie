import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogPath, playbackKey, readCatalog, versionLabelKey } from "./trailer-catalog";

const entry = (playback: unknown, extra: Record<string, unknown> = {}) => ({
  scope: { kind: "season", season: 6 }, playback, name: "Rick et Morty - saison 6 Bande-annonce VF",
  version: "localized", type: "trailer", source: "allocine", ...extra,
});

describe("catalogue des bandes-annonces du serveur", () => {
  it("garde YouTube et Dailymotion dans l'ordre du serveur, jamais les locales", () => {
    const read = readCatalog({
      complete: true, language: "fr-FR",
      entries: [entry({ kind: "jellyfin", itemId: "a" }), entry({ kind: "dailymotion", videoId: "x8e90ff" }), entry({ kind: "youtube", ytId: "Way9Dexny3w" }, { version: "original", source: "tmdb" })],
    }, true);
    assert.ok(read);
    assert.deepEqual(read.trailers.map((t) => t.Url), ["https://www.dailymotion.com/video/x8e90ff", "https://www.youtube.com/watch?v=Way9Dexny3w"]);
    assert.deepEqual(read.trailers.map((t) => t.versionKey), ["vf", "vo"]);
    assert.deepEqual(read.trailers[0]?.scope, { kind: "season", season: 6 });
    assert.equal(read.language, "fr-FR");
  });

  it("sans le lecteur complet de l'hôte, Dailymotion est écarté", () => {
    const read = readCatalog({ complete: false, language: "fr", entries: [entry({ kind: "dailymotion", videoId: "x8e90ff" })] }, false);
    assert.equal(read?.trailers.length, 0);
    assert.equal(read?.complete, false);
  });

  it("une réponse illisible vaut « rien », une entrée illisible est écartée", () => {
    assert.equal(readCatalog("<html>", true), null);
    assert.equal(readCatalog({ entries: [entry({ kind: "youtube", ytId: "court" })] }, true)?.trailers.length, 0);
  });

  it("dit VF / VOSTFR / VO à un serveur français, les mots de l'interface ailleurs", () => {
    assert.equal(versionLabelKey("subtitled", "fr"), "vostfr");
    assert.equal(versionLabelKey("localized", "en-US"), "localized");
    assert.equal(versionLabelKey("unknown", "fr"), null);
  });

  it("demande le catalogue d'un titre TMDB et nomme la vidéo cliquée", () => {
    assert.equal(catalogPath("tv", 60625, "fr"), "/api/trailers/catalog?tmdbId=60625&mediaType=tv&lang=fr");
    assert.equal(playbackKey({ kind: "dailymotion", videoId: "x8e90ff" }), "dm:x8e90ff");
  });
});
