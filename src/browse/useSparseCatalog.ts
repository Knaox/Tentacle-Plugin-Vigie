/* ------------------------------------------------------------------ */
/*  Vigie — Un catalogue à accès direct                                */
/* ------------------------------------------------------------------ */

/*
 * Le défilement infini d'avant chargeait les pages dans l'ordre : pour voir le
 * 800e titre, il fallait avoir chargé (et monté) les 799 précédents. Ici, la
 * grille connaît dès la première page la taille totale du parcours ; chaque
 * case sait à quelle page elle appartient, et SEULES les pages regardées sont
 * demandées — on peut tirer l'ascenseur jusqu'au milieu, ce qui s'affiche se
 * charge, ce qu'on a survolé en route ne coûte rien.
 *
 *   - trois pages en vol au plus (Jellyseerr sature vers huit) ;
 *   - la plus proche du regard d'abord ; une page qu'on a dépassée avant son
 *     tour n'est jamais demandée ;
 *   - le cache de TanStack est la SEULE mémoire des pages : revenir d'une
 *     fiche ne recharge rien, et une demande faite ailleurs (qui marque le
 *     titre « demandé » dans ce cache) se voit aussitôt dans la grille.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BROWSE_PAGE_SIZE, MAX_BROWSE_PAGES } from "../api/client-browse";
import type { SeerrPagedResponse, SeerrSearchResult } from "../api/types";

const CONCURRENCY = 3;
const STALE_MS = 5 * 60_000;
/* Une page sans observateur serait oubliée au bout de cinq minutes : on la
 * garde le temps d'une longue exploration. */
const GC_MS = 30 * 60_000;
const RETRY_MS = 3_000;
const ROOT = "vigie-browse";

export interface SparseCatalog {
  /** Titres du parcours ; `null` tant que la première page n'est pas là. */
  total: number | null;
  /** Le parcours compte plus de titres que les pages accessibles n'en montrent. */
  capped: boolean;
  /** Change à chaque page arrivée ou modifiée — de quoi redessiner la grille. */
  version: number;
  itemAt: (index: number) => SeerrSearchResult | undefined;
  /** Les cases que la grille montre (ou va montrer) : leurs pages seront chargées. */
  ensureRange: (from: number, to: number) => void;
  error: boolean;
  retry: () => void;
}

function totalOf(first: SeerrPagedResponse | undefined): number | null {
  if (!first) return null;
  const pages = Math.min(first.totalPages || 1, MAX_BROWSE_PAGES);
  return Math.min(first.totalResults ?? 0, pages * BROWSE_PAGE_SIZE);
}

type PageLoader = (page: number) => Promise<SeerrPagedResponse>;

/** Un parcours : sa clé et SON chargeur, liés une fois pour toutes. */
function newRun(key: string, load: PageLoader) {
  return { key, load, inflight: new Set<number>(), failedAt: new Map<number, number>(), wanted: [1, 2] };
}

/** `enabled` faux : une source vide qui ne demande rien (la série d'un « Tous » sans équivalent). */
export function useSparseCatalog(key: string, fetchPage: PageLoader, enabled = true): SparseCatalog {
  const qc = useQueryClient();
  const [version, setVersion] = useState(0);
  const [error, setError] = useState(false);
  const run = useRef(newRun(key, fetchPage));
  const fetcher = useRef(fetchPage);
  fetcher.current = fetchPage;

  const pageData = useCallback(
    (page: number) => qc.getQueryData<SeerrPagedResponse>([ROOT, key, page]),
    [qc, key],
  );

  // Toute écriture dans le cache de CE parcours redessine la grille.
  useEffect(() => qc.getQueryCache().subscribe((event) => {
    const qk = event.query.queryKey;
    if (qk[0] === ROOT && qk[1] === key && event.type === "updated") setVersion((v) => v + 1);
  }), [qc, key]);

  const pump = useCallback(() => {
    if (!enabled) return;
    const s = run.current;
    const runKey = s.key;
    while (s.inflight.size < CONCURRENCY) {
      const next = s.wanted.find((p) =>
        !pageData(p) && !s.inflight.has(p) && Date.now() - (s.failedAt.get(p) ?? 0) > RETRY_MS);
      if (next === undefined) return;
      s.inflight.add(next);
      // Le chargeur du parcours, jamais le dernier venu : une page de films
      // ne se charge qu'avec celui des films.
      qc.fetchQuery({ queryKey: [ROOT, runKey, next], queryFn: () => s.load(next), staleTime: STALE_MS, gcTime: GC_MS })
        .then(() => { if (next === 1 && run.current.key === runKey) setError(false); })
        .catch(() => {
          s.failedAt.set(next, Date.now());
          if (next === 1 && run.current.key === runKey) setError(true);
        })
        .finally(() => {
          s.inflight.delete(next);
          if (run.current.key === runKey) pump();
        });
    }
  }, [qc, pageData, enabled]);

  /* Nouveau parcours : on repart de zéro — le cache, lui, garde ce qu'il sait.
   * AVANT les effets de la grille : enfant, elle passe d'ordinaire la première
   * et réclamait ses cases à l'ANCIEN parcours avec le chargeur du nouveau.
   * Une page de films périmée revenait alors pleine de séries, et « Films »
   * les montrait au retour. */
  useLayoutEffect(() => {
    run.current = newRun(key, fetcher.current);
    setError(false);
    setVersion((v) => v + 1);
    pump();
  }, [key, pump]);

  const itemAt = useCallback((index: number) => {
    const page = Math.floor(index / BROWSE_PAGE_SIZE) + 1;
    return pageData(page)?.results?.[index % BROWSE_PAGE_SIZE];
  }, [pageData]);

  const ensureRange = useCallback((from: number, to: number) => {
    const s = run.current;
    const first = Math.floor(Math.max(0, from) / BROWSE_PAGE_SIZE) + 1;
    // Une page d'avance vers le bas : c'est là que le regard va.
    const last = Math.min(Math.floor(Math.max(0, to) / BROWSE_PAGE_SIZE) + 2, MAX_BROWSE_PAGES);
    const center = (first + last) / 2;
    const pages: number[] = [];
    for (let p = first; p <= last; p++) pages.push(p);
    s.wanted = pages.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    pump();
  }, [pump]);

  const retry = useCallback(() => {
    run.current.failedAt.clear();
    setError(false);
    pump();
  }, [pump]);

  const first = pageData(1);
  const total = enabled ? totalOf(first) : 0;
  const capped = total !== null && (first?.totalResults ?? 0) > total;
  return { total, capped, version, itemAt, ensureRange, error: enabled && error, retry };
}
