/* ------------------------------------------------------------------ */
/*  Vigie — Ce que l'on sait de SES demandes, pour toutes les affiches   */
/* ------------------------------------------------------------------ */

/*
 * Jellyseerr joint à chaque fiche son statut, pas l'avancement réel ni le
 * blocage. Le hub, lui, suit les demandes de l'utilisateur et leur
 * avancement : cette table les met à disposition de chaque affiche — un titre
 * qu'on a demandé dit partout « 45 % » ou « Bloqué », pas seulement sur
 * « Mes demandes ». Et ce qui manque aux séries en partie là : « il manque
 * 1 saison », partout où l'affiche dit « En partie ».
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SeerrSearchResult } from "../api/types";
import type { SeriesGaps } from "../api/types-releases";
import { useSeriesGapsMap } from "../hooks/useSeriesGaps";
import { mergeStatus, stateFromMedia, stateFromRequest, strongest, type MediaInfoLike, type TitleStatus } from "../utils/title-state";
import type { HubData } from "./useHubData";

const MineContext = createContext<ReadonlyMap<string, TitleStatus>>(new Map());
const GapsContext = createContext<ReadonlyMap<number, SeriesGaps>>(new Map());

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
  const gaps = useSeriesGapsMap();
  return (
    <MineContext.Provider value={mine}>
      <GapsContext.Provider value={gaps}>{children}</GapsContext.Provider>
    </MineContext.Provider>
  );
}

/** Ce qui manque à une série en partie là ; `null` pour un film ou une série complète. */
export function useTitleGaps(item: { id: number; mediaType: string }): SeriesGaps | null {
  const gaps = useContext(GapsContext);
  return item.mediaType === "tv" ? gaps.get(item.id) ?? null : null;
}

/** L'état d'un titre sur son affiche : Jellyseerr, précisé par sa propre demande. */
export function useTitleStatus(item: Pick<SeerrSearchResult, "id" | "mediaType"> & { mediaInfo?: MediaInfoLike }): TitleStatus | null {
  const mine = useContext(MineContext).get(`${item.mediaType}:${item.id}`);
  const info = item.mediaInfo;
  return useMemo(() => mergeStatus(stateFromMedia(info), mine), [info, mine]);
}
