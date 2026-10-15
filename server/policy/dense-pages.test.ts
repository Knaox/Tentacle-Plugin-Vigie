import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { DENSE_PAGE_SIZE, SCAN_BUDGET, densePage, resetDenseStreams, type UpstreamPage } from "./dense-pages";

/*
 * Des pages PLEINES pour un profil restreint : la grille du hub place chaque
 * titre à son rang (page × 20) — une page filtrée y laisserait des trous.
 */

/** Un catalogue de `pages` pages de vingt numéros ; `calls` compte les lectures. */
function catalog(pages: number) {
  const calls: number[] = [];
  const load = async (n: number): Promise<UpstreamPage | null> => {
    calls.push(n);
    if (n > pages) return { totalPages: pages, results: [] };
    return { totalPages: pages, blockedActive: true, results: Array.from({ length: 20 }, (_, i) => (n - 1) * 20 + i + 1) };
  };
  return { load, calls };
}
/** Le profil ne garde qu'un numéro sur `every`. */
const keepEvery = (every: number) => async (r: unknown[]) => r.filter((x) => (x as number) % every === 0);
const ids = (o: Awaited<ReturnType<typeof densePage>>) => (o.ok ? (o.data.results as number[]) : null);

beforeEach(() => resetDenseStreams());

test("une page restreinte est pleine : les titres permis se suivent, sans trou ni doublon", async () => {
  const { load } = catalog(10);
  const p1 = await densePage("k", 1, load, keepEvery(3));
  const p2 = await densePage("k", 2, load, keepEvery(3));
  assert.equal(ids(p1)!.length, DENSE_PAGE_SIZE);
  assert.deepEqual(ids(p1)!.slice(0, 3), [3, 6, 9]);
  assert.equal(ids(p2)![0], 63);
  assert.ok(p1.ok && p1.data.vigieDense === true && p1.data.blockedActive === true);
});

test("le total grandit avec le flux (une page d'avance), exact à la fin", async () => {
  const { load } = catalog(3); // 60 titres, 30 permis
  const p1 = await densePage("k", 1, load, keepEvery(2));
  assert.ok(p1.ok);
  assert.equal(p1.data.totalResults, 40); // 20 lus dans 2 pages… plus une page d'avance
  const p2 = await densePage("k", 2, load, keepEvery(2));
  assert.ok(p2.ok);
  assert.equal(p2.data.totalResults, 30);
  assert.equal(p2.data.totalPages, 2);
  assert.equal(ids(p2)!.length, 10);
});

test("les pages déjà lues ne se relisent pas : la page 2 reprend où la 1 s'est arrêtée", async () => {
  const { load, calls } = catalog(10);
  await densePage("k", 1, load, keepEvery(2));
  await densePage("k", 2, load, keepEvery(2));
  assert.deepEqual(calls, [1, 2, 3, 4]);
});

test("des requêtes simultanées du même flux ne lisent jamais deux fois la même page", async () => {
  const { load, calls } = catalog(10);
  const [a, b, c] = await Promise.all([1, 2, 3].map((p) => densePage("k", p, load, keepEvery(2))));
  assert.deepEqual([ids(a)![0], ids(b)![0], ids(c)![0]], [2, 42, 82]);
  assert.deepEqual(calls, [1, 2, 3, 4, 5, 6]);
});

test("budget épuisé : la page se dit la dernière, la requête suivante reprend la lecture", async () => {
  const { load, calls } = catalog(100);
  const sparse = async (r: unknown[]) => r.filter((x) => (x as number) % 100 === 0); // un par cinq pages
  const first = await densePage("k", 1, load, sparse);
  assert.equal(calls.length, SCAN_BUDGET);
  assert.ok(first.ok);
  assert.equal(ids(first)!.length, 1);
  assert.equal(first.data.totalResults, 1);
  assert.equal(first.data.totalPages, 1);
  const again = await densePage("k", 1, load, sparse);
  assert.equal(calls.length, 2 * SCAN_BUDGET);
  assert.ok(again.ok && (again.data.results as number[]).length === 3);
});

test("Jellyseerr qui lâche avant de remplir la page : une panne, pas une page à trous", async () => {
  const load = async (n: number) => (n === 1 ? { totalPages: 5, results: Array.from({ length: 20 }, (_, i) => i + 1) } : null);
  const out = await densePage("k", 1, load, keepEvery(2));
  assert.equal(out.ok, false);
});

test("deux parcours, deux flux", async () => {
  const { load } = catalog(5);
  await densePage("a", 1, load, keepEvery(2));
  const other = await densePage("b", 1, load, keepEvery(5));
  assert.deepEqual(ids(other)!.slice(0, 2), [5, 10]);
});
