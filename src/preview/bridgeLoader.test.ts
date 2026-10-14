import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bridgeLoaderClass, rangeHeader } from "./bridgeLoader";

describe("chargeur de hls.js par l'hôte", () => {
  it("traduit la plage d'octets de hls.js (fin exclusive)", () => {
    assert.equal(rangeHeader({}), undefined);
    assert.equal(rangeHeader({ rangeStart: 0, rangeEnd: 0 }), undefined);
    assert.equal(rangeHeader({ rangeStart: 100, rangeEnd: 200 }), "bytes=100-199");
    assert.equal(rangeHeader({ rangeStart: 100 }), "bytes=100-");
  });

  it("rend le texte d'une liste et les octets d'un segment, par l'hôte", async () => {
    const calls: string[] = [];
    const Loader = bridgeLoaderClass(async (url) => {
      calls.push(url);
      return { status: 200, contentType: "", body: new TextEncoder().encode("#EXTM3U").buffer as ArrayBuffer };
    });
    const results: Array<string | ArrayBuffer> = [];
    const callbacks = {
      onSuccess: (response: { data: string | ArrayBuffer }) => { results.push(response.data); },
      onError: () => assert.fail("pas d'erreur attendue"),
      onTimeout: () => assert.fail("pas de délai attendu"),
    };
    new Loader().load({ url: "/api/trailers/hls/x/master.m3u8?t=1", responseType: "" }, {}, callbacks);
    new Loader().load({ url: "/api/trailers/hls/x/s/v0/0.ts?t=1", responseType: "arraybuffer" }, {}, callbacks);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(calls, ["/api/trailers/hls/x/master.m3u8?t=1", "/api/trailers/hls/x/s/v0/0.ts?t=1"]);
    assert.equal(results[0], "#EXTM3U");
    assert.ok(results[1] instanceof ArrayBuffer);
  });

  it("un abandon fait taire une réponse tardive ; un refus est une erreur", async () => {
    let release: (v: { status: number; contentType: string; body: ArrayBuffer }) => void = () => {};
    const Loader = bridgeLoaderClass(() => new Promise((resolve) => { release = resolve; }));
    let called = 0;
    const loader = new Loader();
    loader.load({ url: "/a" }, {}, { onSuccess: () => { called++; }, onError: () => { called++; }, onTimeout: () => { called++; } });
    loader.abort();
    release({ status: 200, contentType: "", body: new ArrayBuffer(1) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(called, 0);

    const Refused = bridgeLoaderClass(async () => ({ status: 403, contentType: "", body: new ArrayBuffer(0) }));
    const codes: number[] = [];
    new Refused().load({ url: "/b" }, {}, { onSuccess: () => {}, onError: (e: { code: number }) => { codes.push(e.code); }, onTimeout: () => {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(codes, [403]);
  });
});
