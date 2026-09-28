/* ------------------------------------------------------------------ */
/*  Vigie — Ce que le compte a fait de chaque titre, pour les affiches */
/* ------------------------------------------------------------------ */

/*
 * Une lecture pour tout le hub (route `/marks`, cf. server/user-marks.ts) :
 * dans la bibliothèque, vu, dans « Ma liste », aimé, et sa note. Relue à la
 * minute et au retour sur la fenêtre — un épisode fini dans Tentacle, puis
 * Vigie rouvert, doit dire « Vu ». Une réponse absente (serveur Tentacle ou
 * Jellyfin injoignable) ne marque simplement rien.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { backendFetch } from "../api/seer-client";

/* Mêmes bits que le serveur (server/user-marks.ts). */
const LIBRARY = 1;
const WATCHED = 2;
const WATCHLIST = 4;
const LIKED = 8;

export interface TitleMarks {
  library: boolean;
  watched: boolean;
  watchlist: boolean;
  liked: boolean;
  /** Sa note, 1..10 (une demi-étoile par point) ; `null` : pas notée. */
  score: number | null;
}

type MarkEntry = ["movie" | "tv", number, number, number];

const MarksContext = createContext<ReadonlyMap<string, TitleMarks>>(new Map());

export function toMarks(bits: number, score: number): TitleMarks {
  return {
    library: (bits & LIBRARY) !== 0,
    watched: (bits & WATCHED) !== 0,
    watchlist: (bits & WATCHLIST) !== 0,
    liked: (bits & LIKED) !== 0,
    score: score >= 1 && score <= 10 ? score : null,
  };
}

export function UserMarksProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["vigie-marks"],
    queryFn: ({ signal }) => backendFetch<{ items: MarkEntry[] }>("/marks", { signal }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const map = useMemo(() => {
    const next = new Map<string, TitleMarks>();
    for (const [type, id, bits, score] of data?.items ?? []) next.set(`${type}:${id}`, toMarks(bits, score));
    return next;
  }, [data]);
  return <MarksContext.Provider value={map}>{children}</MarksContext.Provider>;
}

/** Les marques d'un titre ; `null` quand le compte n'en a fait encore rien. */
export function useTitleMarks(item: { id: number; mediaType: string }): TitleMarks | null {
  return useContext(MarksContext).get(`${item.mediaType}:${item.id}`) ?? null;
}
