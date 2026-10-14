import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { previewSource } from "./usePreviewEngine";
import { WARM_TIMING as T, resetPreviewWarm, seedFromWarmReply, setPreviewWarmSender, trackPreviewWarm } from "./warm";
import type { PreviewTitle } from "./source";

/*
 * La préparation des affiches à l'écran, jumelle de `previewWarm.ts` du cœur :
 * les affiches visibles partent quand la page se pose, les dernières apparues
 * d'abord, deux fois au plus en dix minutes ; les aperçus prêts de la réponse
 * entrent dans la mémoire des décisions — le survol n'a plus rien à demander.
 */

const BODY = {
  path: "/api/trailers/hls/dm%3Ax8e90ff/master.m3u8?t=x",
  mimeType: "application/vnd.apple.mpegurl",
  expiresAt: Date.now() + 3_600_000,
  heights: [720],
  qualities: [],
};

test("les aperçus prêts de la réponse entrent dans la mémoire des décisions ; le reste est ignoré", () => {
  seedFromWarmReply({
    ready: [
      { subject: { tmdbId: 9001, mediaType: "movie" }, preview: BODY },
      { subject: { tmdbId: 9002, mediaType: "person" }, preview: BODY },
      { subject: { tmdbId: "9003", mediaType: "tv" }, preview: BODY },
      { subject: { tmdbId: 9004, mediaType: "tv" }, preview: { path: "https://ailleurs" } },
    ],
  });
  assert.deepEqual(previewSource.known({ tmdbId: 9001, mediaType: "movie" }), { kind: "found", preview: BODY });
  assert.equal(previewSource.known({ tmdbId: 9003, mediaType: "tv" }), null);
  assert.equal(previewSource.known({ tmdbId: 9004, mediaType: "tv" }), null);
  seedFromWarmReply(null);
});

/** Laisse finir l'envoi en cours (ses promesses) : `setImmediate` n'est pas simulé. */
const drained = () => new Promise<void>((resolve) => setImmediate(resolve));

class FakeObserver {
  static current: FakeObserver | null = null;
  constructor(private readonly callback: (entries: IntersectionObserverEntry[]) => void) {
    FakeObserver.current = this;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  show(elements: object[]) {
    this.callback(elements.map((target) => ({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry));
  }
}

test("les affiches visibles partent quand la page se pose, deux fois au plus, jamais une décision connue", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeObserver;
  try {
    resetPreviewWarm();
    const sends: string[][] = [];
    const ready = new Set<string>();
    setPreviewWarmSender({
      send: async (titles: PreviewTitle[]) => {
        sends.push(titles.map((t) => `${t.mediaType}:${t.tmdbId}`));
        return true;
      },
      isReady: (title) => ready.has(`${title.mediaType}:${title.tmdbId}`),
    });
    const [a, b] = [{}, {}] as unknown as Element[];
    trackPreviewWarm(a, { tmdbId: 1, mediaType: "movie" });
    trackPreviewWarm(b, { tmdbId: 2, mediaType: "tv" });
    FakeObserver.current!.show([a]);
    mock.timers.tick(100);
    FakeObserver.current!.show([b]);
    mock.timers.tick(T.settleMs);
    await drained();
    assert.deepEqual(sends, [["tv:2", "movie:1"]]);
    ready.add("tv:2");
    mock.timers.tick(T.followUpMs);
    await drained();
    assert.deepEqual(sends, [["tv:2", "movie:1"], ["movie:1"]]);
    mock.timers.tick(T.windowMs - T.followUpMs - 1_000);
    await drained();
    assert.equal(sends.length, 2);
  } finally {
    resetPreviewWarm();
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    mock.timers.reset();
  }
});
