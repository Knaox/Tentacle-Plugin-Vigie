/* ------------------------------------------------------------------ */
/*  Vigie — Les demandes au-delà de la première page                   */
/* ------------------------------------------------------------------ */

/*
 * La première page (cent demandes) suffit à presque tout le monde et le hub
 * la lit déjà. Pour les autres, les pages suivantes se chargent à la demande
 * — ou d'un coup quand on cherche ou filtre, pour ne rien manquer. Mêmes clés
 * que `useMyRequests` : les mises à jour optimistes (suppression, relance)
 * s'y appliquent aussi.
 */

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getMyRequests } from "../api/seer-client";
import type { LocalRequest } from "../api/types";
import { REQUESTS_PAGE_SIZE } from "../hub/useHubData";

export function useMoreRequests(upToPage: number): { requests: LocalRequest[]; loading: boolean } {
  const pages = useMemo(() => Array.from({ length: Math.max(0, upToPage - 1) }, (_, i) => i + 2), [upToPage]);
  const results = useQueries({
    queries: pages.map((page) => ({
      queryKey: ["seer-my-requests", page, REQUESTS_PAGE_SIZE, undefined, undefined, undefined],
      queryFn: () => getMyRequests(page, REQUESTS_PAGE_SIZE),
      staleTime: 60_000,
    })),
  });
  const requests = results.flatMap((r) => r.data?.results ?? []);
  return { requests, loading: results.some((r) => r.isPending) };
}
