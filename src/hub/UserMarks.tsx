/* ------------------------------------------------------------------ */
/*  Vigie — Ce que le compte a fait de chaque titre, pour les affiches */
/* ------------------------------------------------------------------ */

/*
 * Une lecture pour tout le hub (route `/marks`, cf. server/user-marks.ts) :
 * dans la bibliothèque, vu, dans « Ma liste », aimé, et sa note. Relue à la
 * minute et au retour sur la fenêtre — un épisode fini dans Tentacle, puis
 * Vigie rouvert, doit dire « Vu ». Une réponse absente (serveur Tentacle ou
 * Jellyfin injoignable) ne marque simplement rien.
 *
 * Deux listes de Tentacle la précisent, parce que les gestes de l'affiche les
 * réécrivent sur-le-champ (cf. useTitleGestures) : les NOTES du compte, et
 * les titres mis de côté jusqu'à leur arrivée (« Ma liste à l'arrivée »).
 * Chargées, elles font foi : la note qu'on vient de poser se voit aussitôt.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { backendFetch } from "../api/seer-client";
import { tentacleApiFetch } from "../utils/tentacle-fetch";
import { CORE_RATINGS_KEY, MARKS_KEY, PENDING_KEY, type CoreRating } from "../hooks/useTitleGestures";
import { mergeMarks, type MarkEntry, type TitleMarks } from "./marks-merge";

export { toMarks, type TitleMarks } from "./marks-merge";

const MarksContext = createContext<ReadonlyMap<string, TitleMarks>>(new Map());

export function UserMarksProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: MARKS_KEY,
    queryFn: ({ signal }) => backendFetch<{ items: MarkEntry[] }>("/marks", { signal }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  // `null` (Tentacle ne répond pas, serveur d'avant ces routes) : les marques du serveur suffisent.
  const { data: ratings } = useQuery({
    queryKey: CORE_RATINGS_KEY,
    queryFn: () => tentacleApiFetch<CoreRating[]>("/api/ratings"),
    staleTime: 60_000,
  });
  const { data: pending } = useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => tentacleApiFetch<string[]>("/api/watchlist/pending"),
    staleTime: 60_000,
  });
  const map = useMemo(
    () => mergeMarks(data?.items ?? [], Array.isArray(ratings) ? ratings : null, Array.isArray(pending) ? pending : null),
    [data, ratings, pending],
  );
  return <MarksContext.Provider value={map}>{children}</MarksContext.Provider>;
}

/** Les marques d'un titre ; `null` quand le compte n'en a fait encore rien. */
export function useTitleMarks(item: { id: number; mediaType: string }): TitleMarks | null {
  return useContext(MarksContext).get(`${item.mediaType}:${item.id}`) ?? null;
}
