/* ------------------------------------------------------------------ */
/*  Vigie — Des pages pleines pour un profil restreint                  */
/* ------------------------------------------------------------------ */

/*
 * Le hub compte vingt cases par page : la grille du parcours place chaque
 * titre d'après son rang (page × 20), une rangée de l'accueil montre la page 1.
 * Une page filtrée garderait donc ses trous. Pour un profil restreint, les
 * pages d'un même parcours (même chemin, mêmes filtres, même langue) sont
 * tirées d'UN FLUX : les pages de Jellyseerr lues dans l'ordre, filtrées, et
 * les titres permis découpés à nouveau en pages de vingt.
 *
 *   - le total annoncé grandit avec le flux : ce qui est lu, plus une page
 *     d'avance tant qu'il en reste — l'ascenseur ne promet jamais une page
 *     qu'on ne saurait pas remplir. Lu à la fin, il devient exact ;
 *   - lecture bornée par requête (`SCAN_BUDGET`) : une page qu'on n'a pas pu
 *     remplir se dit la DERNIÈRE (total ramené à elle), la suivante requête
 *     reprend la lecture là où elle s'est arrêtée ;
 *   - un flux par compte et par parcours, deux minutes au plus : un contrôle
 *     parental changé compte vite, et le flux se refait à l'identique (les
 *     pages de Jellyseerr sont en cache mutualisé) ;
 *   - les requêtes d'un même flux passent l'une après l'autre (le hub en
 *     envoie trois à la fois) : jamais deux lectures de la même page.
 *
 * Les réponses portent `vigieDense: true` : le hub sait que leur total peut
 * grandir (src/browse/useSparseCatalog.ts).
 */

export const DENSE_PAGE_SIZE = 20;
/** Pages de Jellyseerr lues au plus pour une requête. */
export const SCAN_BUDGET = 8;
/** TMDB ne sert pas au-delà de la page 500 ; un flux s'arrête aussi à mille titres. */
const MAX_UPSTREAM_PAGES = 500;
const MAX_KEPT = 1000;
const MAX_AGE_MS = 2 * 60_000;
const MAX_STREAMS = 64;

export interface UpstreamPage {
  totalPages?: number;
  results?: unknown[];
  [field: string]: unknown;
}

/** Une page de Jellyseerr (`null` : panne), et ce qu'un profil en garde. */
export type LoadPage = (page: number) => Promise<UpstreamPage | null>;
export type KeepResults = (results: unknown[]) => Promise<unknown[]>;

interface Stream {
  kept: unknown[];
  next: number;
  done: boolean;
  /** Les champs de la première page (compteurs du blocage par tags…), sans ses titres. */
  head: Record<string, unknown> | null;
  createdAt: number;
  lock: Promise<unknown>;
}

const streams = new Map<string, Stream>();

function streamFor(key: string, now: number): Stream {
  for (const [k, s] of streams) if (now - s.createdAt > MAX_AGE_MS) streams.delete(k);
  let s = streams.get(key);
  if (!s) {
    while (streams.size >= MAX_STREAMS) streams.delete(streams.keys().next().value as string);
    s = { kept: [], next: 1, done: false, head: null, createdAt: now, lock: Promise.resolve() };
    streams.set(key, s);
  }
  return s;
}

/** Lit le flux jusqu'à `need` titres, la fin, ou le budget ; faux si Jellyseerr a lâché. */
async function fill(s: Stream, need: number, load: LoadPage, keep: KeepResults): Promise<boolean> {
  let scanned = 0;
  while (!s.done && s.kept.length < need && scanned < SCAN_BUDGET) {
    const up = await load(s.next);
    if (!up || !Array.isArray(up.results)) return false;
    scanned++;
    if (!s.head) {
      const { results: _results, page: _page, totalPages: _tp, totalResults: _tr, ...head } = up;
      s.head = head;
    }
    s.kept.push(...(await keep(up.results)));
    const last = Math.min(Number(up.totalPages) || 1, MAX_UPSTREAM_PAGES);
    s.next++;
    if (s.next > last || up.results.length === 0 || s.kept.length >= MAX_KEPT) s.done = true;
  }
  return true;
}

export type DenseOutcome =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false };

/** La page `page` du flux `key`, pleine autant que possible. */
export async function densePage(key: string, page: number, load: LoadPage, keep: KeepResults): Promise<DenseOutcome> {
  const s = streamFor(key, Date.now());
  const run = s.lock.then(async (): Promise<DenseOutcome> => {
    const from = (page - 1) * DENSE_PAGE_SIZE;
    const need = from + DENSE_PAGE_SIZE;
    const alive = await fill(s, need, load, keep);
    const results = s.kept.slice(from, need);
    // Jellyseerr a lâché avant de remplir la page : une panne, que le hub retente.
    if (!alive && results.length < DENSE_PAGE_SIZE) return { ok: false };
    let totalResults: number;
    if (s.done) totalResults = s.kept.length;
    else if (s.kept.length >= need) totalResults = s.kept.length + DENSE_PAGE_SIZE;
    else totalResults = from + results.length; // budget épuisé : cette page est la dernière, pour l'instant
    const totalPages = Math.max(1, Math.ceil(totalResults / DENSE_PAGE_SIZE));
    return { ok: true, data: { ...(s.head ?? {}), page, totalPages, totalResults, results, vigieDense: true } };
  });
  s.lock = run.catch(() => undefined);
  return run;
}

/** Pour les tests : on repart sans flux. */
export function resetDenseStreams(): void {
  streams.clear();
}
