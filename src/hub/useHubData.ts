/* ------------------------------------------------------------------ */
/*  Vigie — Ce que le hub sait avant même qu'on choisisse un onglet     */
/* ------------------------------------------------------------------ */

/*
 * Trois lectures, faites UNE fois pour tout le hub : les demandes (et leurs
 * compteurs), leur avancement réel quand quelque chose arrive, et les sorties
 * des sept prochains jours. L'accueil en tire ses bandeaux « Vos demandes »
 * et « Cette semaine », les onglets leurs pastilles — c'est ce qui fait
 * penser au calendrier : il dit, sur l'onglet même, combien de sorties
 * attendent cette semaine.
 */

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LocalRequest, RequestStatus } from "../api/types";
import type { ProgressItem } from "../api/types-releases";
import { useMyRequests } from "../hooks/useRequests";
import { useRequestsProgress } from "../hooks/useDownloadProgress";
import { usePersonalCalendar } from "../hooks/useReleases";
import { addDays, today } from "../utils/calendar-groups";
import { applyLocalDays } from "../utils/calendar-localtime";
import { countByGroup } from "../requests/requestGroups";

/* Une page large : la plupart des comptes tiennent en une seule. */
export const REQUESTS_PAGE_SIZE = 100;

/* Ce qui attend encore Sonarr ou Radarr : le suivi en direct le surveille. */
const IN_FLIGHT: ReadonlySet<RequestStatus> = new Set(["approved", "unavailable", "downloading", "partially_available"]);
const NO_LIVE: ReadonlyMap<string, ProgressItem> = new Map();

/** Des demandes, avec le statut que leur donnent Sonarr et Radarr — il prime sur celui de la liste. */
export function withLiveStatus(list: LocalRequest[], live: ReadonlyMap<string, ProgressItem>): LocalRequest[] {
  if (live.size === 0) return list;
  return list.map((r) => {
    const status = live.get(r.id)?.status;
    return status && status !== r.status ? { ...r, status } : r;
  });
}

export function useHubData() {
  const qc = useQueryClient();
  const requests = useMyRequests(1, REQUESTS_PAGE_SIZE);
  const raw = useMemo(() => requests.data?.results ?? [], [requests.data]);
  const inFlight = raw.some((r) => IN_FLIGHT.has(r.status));
  const tracked = useRequestsProgress(inFlight);
  /* Un suivi arrêté (plus rien n'attend) garde ses dernières données : elles
   * ne doivent plus contredire la liste. */
  const progress = useMemo(() => (inFlight ? tracked : { ...tracked, byId: NO_LIVE }), [inFlight, tracked]);
  const list = useMemo(() => withLiveStatus(raw, progress.byId), [raw, progress.byId]);
  const counts = useMemo(() => countByGroup(requests.data?.stats?.byStatus), [requests.data]);

  /* Sonarr ou Radarr disent une demande arrivée : la liste, ses sections et
   * ses compteurs le rattrapent aussitôt — le serveur rend le même verdict. */
  const announced = useRef(new Set<string>());
  useEffect(() => {
    const arrivals = raw
      .map((r) => ({ r, status: progress.byId.get(r.id)?.status }))
      .filter(({ r, status }) => (status === "available" || status === "partially_available") && status !== r.status)
      .map(({ r, status }) => `${r.id}:${status}`)
      .filter((key) => !announced.current.has(key));
    if (arrivals.length === 0) return;
    for (const key of arrivals) announced.current.add(key);
    void qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
  }, [raw, progress.byId, qc]);

  const from = today();
  const to = addDays(from, 6);
  const week = usePersonalCalendar(from, to, true, true, false);
  const weekItems = useMemo(
    () => applyLocalDays(week.data?.items ?? []).filter((i) => i.date >= from && i.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [week.data, from, to],
  );

  return { requests, list, progress, counts, weekItems, weekPending: week.isPending };
}

export type HubData = ReturnType<typeof useHubData>;
