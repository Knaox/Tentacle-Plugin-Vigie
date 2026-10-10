/* ------------------------------------------------------------------ */
/*  Vigie — Les demandes de tous les comptes (administrateur)           */
/* ------------------------------------------------------------------ */

/*
 * Le pendant de `useHubData` pour « Tous les comptes » : la première page,
 * l'avancement de ce qui arrive et les compteurs — lus seulement quand
 * l'administrateur ouvre cette vue, jamais autrement. Mêmes clés racines que
 * « Mes demandes » (`seer-my-requests`, `seer-requests-progress`) : les mises
 * à jour optimistes des actions et la synchro en direct s'y appliquent
 * d'office.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllRequests } from "../api/seer-client";
import type { LocalRequestsResponse } from "../api/types";
import type { ProgressItem } from "../api/types-releases";
import { useRequestsProgress } from "../hooks/useDownloadProgress";
import { IN_FLIGHT, REQUESTS_PAGE_SIZE, withLiveStatus } from "../hub/useHubData";
import { countByGroup } from "./requestGroups";

const NO_LIVE: ReadonlyMap<string, ProgressItem> = new Map();

/** La clé d'une page de tous les comptes — partagée avec `useMoreRequests`. */
export const allRequestsKey = (page: number) => ["seer-my-requests", "all", page, REQUESTS_PAGE_SIZE] as const;

export function useAllRequestsData(enabled: boolean) {
  const requests = useQuery({
    queryKey: allRequestsKey(1),
    queryFn: () => getAllRequests(1, REQUESTS_PAGE_SIZE),
    enabled,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    // Tant que des titres manquent (remplissage de fond), on repasse plus vite.
    refetchInterval: (query) => {
      if (!enabled) return false;
      return ((query.state.data as LocalRequestsResponse | undefined)?.metaPending ?? 0) > 0 ? 4_000 : 60_000;
    },
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
  const raw = useMemo(() => requests.data?.results ?? [], [requests.data]);
  const inFlight = enabled && raw.some((r) => IN_FLIGHT.has(r.status));
  const tracked = useRequestsProgress(inFlight, "all");
  // Un suivi arrêté garde ses dernières données : elles ne doivent plus contredire la liste.
  const progress = useMemo(() => (inFlight ? tracked : { ...tracked, byId: NO_LIVE }), [inFlight, tracked]);
  const list = useMemo(() => withLiveStatus(raw, progress.byId), [raw, progress.byId]);
  const counts = useMemo(() => countByGroup(requests.data?.stats?.byStatus), [requests.data]);
  return { requests, list, progress, counts };
}
