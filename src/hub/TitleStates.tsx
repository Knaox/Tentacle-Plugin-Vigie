/* ------------------------------------------------------------------ */
/*  Vigie — Ce que l'on sait de SES demandes, pour toutes les affiches   */
/* ------------------------------------------------------------------ */

/*
 * Jellyseerr joint à chaque fiche son statut, pas l'avancement réel ni le
 * blocage. Le hub, lui, suit les demandes de l'utilisateur et leur
 * avancement : cette table les met à disposition de chaque affiche — un titre
 * qu'on a demandé dit partout « 45 % » ou « Bloqué », pas seulement sur
 * « Mes demandes ».
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SeerrSearchResult } from "../api/types";
import { mergeStatus, stateFromMedia, stateFromRequest, strongest, type TitleStatus } from "../utils/title-state";
import type { HubData } from "./useHubData";

const MineContext = createContext<ReadonlyMap<string, TitleStatus>>(new Map());

export function TitleStatesProvider({ data, children }: { data: HubData; children: ReactNode }) {
  const { list, progress } = data;
  const mine = useMemo(() => {
    const map = new Map<string, TitleStatus>();
    for (const request of list) {
      const status = stateFromRequest(request, progress.byId.get(request.id));
      const key = `${request.mediaType}:${request.tmdbId}`;
      const merged = strongest(map.get(key) ?? null, status);
      if (merged) map.set(key, merged);
    }
    return map;
  }, [list, progress.byId]);
  return <MineContext.Provider value={mine}>{children}</MineContext.Provider>;
}

/** L'état d'un titre sur son affiche : Jellyseerr, précisé par sa propre demande. */
export function useTitleStatus(item: Pick<SeerrSearchResult, "id" | "mediaType" | "mediaInfo">): TitleStatus | null {
  const mine = useContext(MineContext).get(`${item.mediaType}:${item.id}`);
  const info = item.mediaInfo;
  return useMemo(() => mergeStatus(stateFromMedia(info), mine), [info, mine]);
}
