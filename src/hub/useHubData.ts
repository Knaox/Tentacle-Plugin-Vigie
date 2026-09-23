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

import { useMemo } from "react";
import { useMyRequests } from "../hooks/useRequests";
import { useRequestsProgress } from "../hooks/useDownloadProgress";
import { usePersonalCalendar } from "../hooks/useReleases";
import { addDays, today } from "../utils/calendar-groups";
import { applyLocalDays } from "../utils/calendar-localtime";
import { countByGroup } from "../requests/requestGroups";

/* Une page large : la plupart des comptes tiennent en une seule. */
export const REQUESTS_PAGE_SIZE = 100;

export function useHubData() {
  const requests = useMyRequests(1, REQUESTS_PAGE_SIZE);
  const list = useMemo(() => requests.data?.results ?? [], [requests.data]);
  const hasArriving = list.some((r) => r.status === "downloading" || r.status === "partially_available");
  const progress = useRequestsProgress(hasArriving);
  const counts = useMemo(() => countByGroup(requests.data?.stats?.byStatus), [requests.data]);

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
