/* ------------------------------------------------------------------ */
/*  Vigie — Noter un titre, le mettre dans Ma liste (par Tentacle)      */
/* ------------------------------------------------------------------ */

/*
 * Deux gestes de l'affiche qui n'appartiennent pas à Vigie : la NOTE vit dans
 * le moteur de notes de Tentacle (`/api/ratings`, par tmdb), « MA LISTE »
 * aussi (`/api/watchlist/tmdb`) — y compris pour un titre qui n'est pas
 * encore là, mis de côté jusqu'à son arrivée. Vigie les appelle comme le
 * ferait n'importe quelle carte de Tentacle, et la note posée ici se retrouve
 * sur la fiche, les recommandations et toutes les cartes.
 *
 * Les deux listes (notes du compte, titres mis de côté) se lisent une fois
 * pour tout le hub (cf. UserMarks) ; les gestes les réécrivent aussitôt, et
 * défont leur écriture si Tentacle refuse.
 */

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { backendFetch } from "../api/seer-client";
import { tentacleApiSend } from "../utils/tentacle-fetch";

export const CORE_RATINGS_KEY = ["vigie-core-ratings"] as const;
export const PENDING_KEY = ["vigie-pending"] as const;
export const MARKS_KEY = ["vigie-marks"] as const;

/** Une note du compte, telle que Tentacle la rend (`GET /api/ratings`). */
export interface CoreRating {
  mediaType: "movie" | "series" | "episode";
  tmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  score: number;
}

export interface TitleRef {
  id: number;
  mediaType: string;
}

function coreType(item: TitleRef): "movie" | "series" {
  return item.mediaType === "tv" ? "series" : "movie";
}

function tmdbType(item: TitleRef): "movie" | "tv" {
  return item.mediaType === "tv" ? "tv" : "movie";
}

/** La clé d'un titre dans les listes de Tentacle et dans nos marques. */
export function titleKeyOf(item: TitleRef): string {
  return `${tmdbType(item)}:${item.id}`;
}

/**
 * Relit les marques en sautant le cache du serveur (une minute) : après un
 * « Ma liste » posé sur un titre DÉJÀ là, c'est Jellyfin qui le dit.
 */
export function refreshMarks(qc: QueryClient): void {
  void qc.fetchQuery({ queryKey: MARKS_KEY, queryFn: () => backendFetch("/marks?fresh=1"), staleTime: 0 }).catch(() => undefined);
}

/** Poser ou retirer SA note (1..10, une demi-étoile par point). */
export function useRateTitle() {
  const qc = useQueryClient();
  const matches = (r: CoreRating, item: TitleRef) =>
    r.mediaType === coreType(item) && r.tmdbId === item.id && r.seasonNumber === 0 && r.episodeNumber === 0;

  const patch = async (item: TitleRef, score: number | null) => {
    await qc.cancelQueries({ queryKey: CORE_RATINGS_KEY });
    const previous = qc.getQueryData<CoreRating[] | null>(CORE_RATINGS_KEY);
    qc.setQueryData<CoreRating[] | null>(CORE_RATINGS_KEY, (old) => {
      const rest = (old ?? []).filter((r) => !matches(r, item));
      return score === null ? rest : [{ mediaType: coreType(item), tmdbId: item.id, seasonNumber: 0, episodeNumber: 0, score }, ...rest];
    });
    return { previous };
  };
  const restore = (ctx: { previous?: CoreRating[] | null } | undefined) => {
    if (ctx) qc.setQueryData(CORE_RATINGS_KEY, ctx.previous);
  };

  const rate = useMutation({
    mutationFn: ({ item, score }: { item: TitleRef; score: number }) =>
      tentacleApiSend("/api/ratings", "PUT", { mediaType: coreType(item), tmdbId: item.id, score }),
    onMutate: ({ item, score }) => patch(item, score),
    onError: (_e, _v, ctx) => restore(ctx),
  });
  const clear = useMutation({
    mutationFn: (item: TitleRef) => {
      const q = new URLSearchParams({ mediaType: coreType(item), tmdbId: String(item.id), seasonNumber: "0", episodeNumber: "0" });
      return tentacleApiSend(`/api/ratings/item?${q.toString()}`, "DELETE");
    },
    onMutate: (item) => patch(item, null),
    onError: (_e, _v, ctx) => restore(ctx),
  });
  return { rate, clear };
}

type MarkEntry = ["movie" | "tv", number, number, number];
const LIBRARY_BIT = 1;
const WATCHLIST_BIT = 4;

/**
 * « Ma liste » d'un titre par son tmdb : déjà là, il y entre tout de suite ;
 * absent, il est mis de côté et y entrera à son arrivée. Le retrait défait
 * l'un ou l'autre. L'écriture optimiste va là où l'affiche lit : le signet
 * des marques pour un titre de la bibliothèque, la liste des titres mis de
 * côté pour un titre absent.
 */
export function useTitleWatchlist() {
  const qc = useQueryClient();
  const patch = async (item: TitleRef, listed: boolean) => {
    await qc.cancelQueries({ queryKey: PENDING_KEY });
    await qc.cancelQueries({ queryKey: MARKS_KEY });
    const previous = qc.getQueryData<string[] | null>(PENDING_KEY);
    const previousMarks = qc.getQueryData<{ items: MarkEntry[] }>(MARKS_KEY);
    const key = titleKeyOf(item);
    const here = previousMarks?.items.find(([type, id]) => `${type}:${id}` === key);
    if (here && (here[2] & LIBRARY_BIT) !== 0) {
      qc.setQueryData<{ items: MarkEntry[] }>(MARKS_KEY, (old) => old && {
        items: old.items.map((e) => (`${e[0]}:${e[1]}` === key
          ? [e[0], e[1], listed ? e[2] | WATCHLIST_BIT : e[2] & ~WATCHLIST_BIT, e[3]] : e)),
      });
    } else {
      qc.setQueryData<string[] | null>(PENDING_KEY, (old) => {
        const rest = (old ?? []).filter((k) => k !== key);
        return listed ? [key, ...rest] : rest;
      });
    }
    return { previous, previousMarks };
  };
  const restore = (ctx: { previous?: string[] | null; previousMarks?: { items: MarkEntry[] } } | undefined) => {
    if (!ctx) return;
    qc.setQueryData(PENDING_KEY, ctx.previous);
    if (ctx.previousMarks) qc.setQueryData(MARKS_KEY, ctx.previousMarks);
  };

  const add = useMutation({
    mutationFn: (item: TitleRef) =>
      tentacleApiSend<{ state: "listed" | "pending" }>("/api/watchlist/tmdb", "PUT", { mediaType: tmdbType(item), tmdbId: item.id }),
    onMutate: (item) => patch(item, true),
    onError: (_e, _v, ctx) => restore(ctx),
    onSuccess: (res, item) => {
      if (res.state !== "listed") return;
      // Il était déjà là : il est dans Ma liste, plus rien n'attend son arrivée.
      qc.setQueryData<string[] | null>(PENDING_KEY, (old) => (old ?? []).filter((k) => k !== titleKeyOf(item)));
      refreshMarks(qc);
    },
  });
  const remove = useMutation({
    mutationFn: (item: TitleRef) =>
      tentacleApiSend<{ state: "none" }>(`/api/watchlist/tmdb/${tmdbType(item)}/${item.id}`, "DELETE"),
    onMutate: (item) => patch(item, false),
    onError: (_e, _v, ctx) => restore(ctx),
    onSuccess: () => refreshMarks(qc),
  });
  return { add, remove };
}
