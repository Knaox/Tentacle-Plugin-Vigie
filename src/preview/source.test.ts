import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreviewSource, decisionOf, streamPathFor, type PreviewResponse, type TrailerPreviewBody } from "./source";
import { placePreview, roomShifts } from "./placement";

/*
 * L'anti-spam (règle de Damien) : UNE demande par titre tant que la décision
 * vaut, une demande partagée par deux survols, rien avant 10 min après un
 * échec de lecture — et la place de la mini-carte, jumelle du cœur.
 */

const BODY: TrailerPreviewBody = {
  path: "/api/trailers/hls/abc/master.m3u8?t=x",
  mimeType: "application/vnd.apple.mpegurl",
  expiresAt: 10_000_000,
  heights: [1080, 720, 360],
  qualities: [
    { height: 1080, path: "/q1080" },
    { height: 720, path: "/q720" },
    { height: 360, path: "/q360" },
  ],
};

function bench(responses: Array<PreviewResponse | null>) {
  let clock = 1_000;
  const calls: string[] = [];
  const source = createPreviewSource(async (title) => {
    calls.push(`${title.mediaType}:${title.tmdbId}`);
    return responses.shift() ?? { status: 404, body: { error: "no_trailer" } };
  }, () => clock);
  return { source, calls, advance: (ms: number) => { clock += ms; } };
}

const MATRIX = { tmdbId: 603, mediaType: "movie" as const };

test("repasser sur une carte ne redemande rien ; deux survols partagent la demande", async () => {
  const { source, calls } = bench([{ status: 200, body: BODY }]);
  const [a, b] = await Promise.all([source.decide(MATRIX), source.decide(MATRIX)]);
  assert.equal(a.kind, "found");
  assert.equal(b.kind, "found");
  for (let i = 0; i < 20; i++) await source.decide(MATRIX);
  assert.deepEqual(calls, ["movie:603"]);
});

test("pas de bande-annonce : retenu, aucune nouvelle demande", async () => {
  const { source, calls } = bench([{ status: 404, body: { error: "no_trailer" } }]);
  assert.equal((await source.decide(MATRIX)).kind, "missing");
  assert.equal((await source.decide(MATRIX)).kind, "missing");
  assert.equal(calls.length, 1);
});

test("429 : on attend Retry-After (borné), puis on redemande", async () => {
  const { source, calls, advance } = bench([{ status: 429, body: { error: "rate_limited", retryAfterS: 3 } }, { status: 200, body: BODY }]);
  const first = await source.decide(MATRIX);
  assert.deepEqual(first, { kind: "retry", retryAt: 4_000 });
  advance(1_000);
  assert.equal((await source.decide(MATRIX)).kind, "retry", "avant l'échéance, rien ne repart");
  advance(2_000);
  assert.equal((await source.decide(MATRIX)).kind, "found");
  assert.equal(calls.length, 2);
  assert.equal(decisionOf({ status: 429, body: { retryAfterS: 600 } }, 0).kind, "retry");
  assert.deepEqual(decisionOf({ status: 429, body: { retryAfterS: 600 } }, 0), { kind: "retry", retryAt: 10_000 });
  assert.deepEqual(decisionOf(null, 0), { kind: "retry", retryAt: 10_000 });
});

test("un flux qui ne se lit pas n'est pas retenté avant 10 min", async () => {
  const { source, calls, advance } = bench([{ status: 200, body: BODY }, { status: 200, body: BODY }]);
  await source.decide(MATRIX);
  source.markFailed(MATRIX);
  advance(9 * 60_000);
  assert.equal((await source.decide(MATRIX)).kind, "missing");
  advance(2 * 60_000);
  assert.equal((await source.decide(MATRIX)).kind, "found");
  assert.equal(calls.length, 2);
});

test("une réponse qui n'est pas un flux du relais ne montre rien", () => {
  assert.equal(decisionOf({ status: 200, body: { ...BODY, path: "https://youtube.com/x" } }, 0).kind, "missing");
  assert.equal(decisionOf({ status: 200, body: "<html>" }, 0).kind, "missing");
});

test("la qualité : 720p sur Retina, 360p sinon, jamais 1080p", () => {
  assert.equal(streamPathFor(BODY, 2), "/q720");
  assert.equal(streamPathFor(BODY, 1), "/q360");
  assert.equal(streamPathFor({ ...BODY, qualities: [{ height: 1080, path: "/q1080" }, { height: 480, path: "/q480" }] }, 2), "/q480");
  assert.equal(streamPathFor({ ...BODY, mimeType: "video/mp4", qualities: [] }, 2), BODY.path);
});

test("la mini-carte : 23 % de la fenêtre (300 à 560 px), centrée sur l'affiche, dans la fenêtre", () => {
  const anchor = { left: 600, top: 300, width: 168, height: 252 };
  const p = placePreview(anchor, { width: 1440, height: 900 });
  assert.ok(p);
  assert.equal(p.width, 331);
  assert.equal(p.videoHeight, 186);
  assert.ok(p.height >= anchor.height + 16);
  assert.equal(p.left, Math.round(684 - p.width / 2));
  // Collée au bord : rentrée à 16 px, et jamais sous la barre collante.
  const edge = placePreview({ left: 0, top: 60, width: 168, height: 252 }, { width: 1440, height: 900, safeTop: 56 });
  assert.equal(edge?.left, 16);
  assert.equal(edge?.top, 72);
  assert.equal(placePreview(anchor, { width: 4000, height: 2000 })?.width, 560);
  assert.equal(placePreview(anchor, { width: 800, height: 900 })?.width, 300);
});

test("les voisines d'une rangée s'écartent du débord de chaque côté", () => {
  assert.deepEqual(roomShifts({ left: 600, top: 0, width: 168, height: 252 }, { left: 518, top: 0, width: 331, height: 300 }), { left: 82, right: 81 });
  assert.deepEqual(roomShifts({ left: 16, top: 0, width: 168, height: 252 }, { left: 16, top: 0, width: 331, height: 300 }), { left: 0, right: 163 });
});
