import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getMyRequests, deleteRequest, forgetRequest, retryRequest, retryDeleteRequest, getQueueStatus, bulkDeleteRequests, bulkRetryRequests, markRequestStatus } from "../api/seer-client";
import { useToast } from "./useToast";
import type { LocalRequest, LocalRequestsResponse, RequestStatus } from "../api/types";

export function useMyRequests(
  page = 1,
  limit = 20,
  status?: string,
  mediaType?: string,
  q?: string,
) {
  const query = useQuery({
    queryKey: ["seer-my-requests", page, limit, status, mediaType, q],
    queryFn: () => getMyRequests(page, limit, status, mediaType, q),
    staleTime: 60_000,        // 1 min — backend cache de toute façon la liste 60s par user
    gcTime: 30 * 60_000,      // 30 min en mémoire après dernière utilisation
    /* Au tout premier chargement d'une grosse instance, les titres et affiches
     * arrivent par vagues (remplissage en tâche de fond). On repasse plus vite
     * tant qu'il en manque, puis on revient au rythme normal. */
    refetchInterval: (query) =>
      ((query.state.data as LocalRequestsResponse | undefined)?.metaPending ?? 0) > 0 ? 4_000 : 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,  // pas de flash blanc au changement de filtre/page
  });

  // Détecte les passages en retry_pending entre deux refreshes pour alerter l'utilisateur
  const { t } = useTranslation("seer");
  const toast = useToast();
  const previousStatuses = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const results = query.data?.results as LocalRequest[] | undefined;
    if (!results) return;
    const prev = previousStatuses.current;
    let notified = false;
    for (const r of results) {
      const old = prev.get(r.id);
      if (
        old &&
        old !== "retry_pending" &&
        old !== "failed" &&
        r.status === "retry_pending" &&
        !notified
      ) {
        toast.show("error", t("seer:requestRetryNotice"));
        notified = true;
      }
      prev.set(r.id, r.status);
    }
    // Nettoyer les IDs disparus
    const currentIds = new Set(results.map((r) => r.id));
    for (const key of Array.from(prev.keys())) {
      if (!currentIds.has(key)) prev.delete(key);
    }
  }, [query.data, t, toast]);

  return query;
}

/* ── MAJ optimiste des statuts ─────────────────────────────────────────
 * Chaque action (mark, suppression, redemande) se voit INSTANTANÉMENT dans
 * la liste ; la revalidation qui suit reflète l'état réel de Jellyseerr
 * (source de vérité) et confirme — ou corrige — l'affichage. */

type RequestsSnapshot = Array<[readonly unknown[], LocalRequestsResponse | undefined]>;

async function applyOptimisticStatus(
  qc: QueryClient,
  ids: string[],
  status: RequestStatus,
): Promise<RequestsSnapshot> {
  await qc.cancelQueries({ queryKey: ["seer-my-requests"] });
  const snapshot = qc.getQueriesData<LocalRequestsResponse>({
    queryKey: ["seer-my-requests"],
  }) as RequestsSnapshot;
  const idSet = new Set(ids);
  qc.setQueriesData<LocalRequestsResponse>({ queryKey: ["seer-my-requests"] }, (old) =>
    old?.results
      ? { ...old, results: old.results.map((r) => (idSet.has(r.id) ? { ...r, status } : r)) }
      : old,
  );
  return snapshot;
}

/** Retire des demandes de la liste en cache, le temps que le serveur confirme. */
async function removeOptimistic(qc: QueryClient, ids: string[]): Promise<RequestsSnapshot> {
  await qc.cancelQueries({ queryKey: ["seer-my-requests"] });
  const snapshot = qc.getQueriesData<LocalRequestsResponse>({ queryKey: ["seer-my-requests"] }) as RequestsSnapshot;
  const idSet = new Set(ids);
  qc.setQueriesData<LocalRequestsResponse>({ queryKey: ["seer-my-requests"] }, (old) => {
    if (!old?.results) return old;
    const results = old.results.filter((r) => !idSet.has(r.id));
    const gone = old.results.filter((r) => idSet.has(r.id));
    if (gone.length === 0 || !old.stats) return { ...old, results };
    const byStatus = { ...old.stats.byStatus };
    for (const r of gone) byStatus[r.status] = Math.max(0, (byStatus[r.status] ?? 1) - 1);
    return { ...old, results, total: Math.max(0, old.total - gone.length), stats: { ...old.stats, byStatus, total: Math.max(0, old.stats.total - gone.length) } };
  });
  return snapshot;
}

function rollbackOptimistic(qc: QueryClient, snapshot?: RequestsSnapshot): void {
  for (const [key, data] of snapshot ?? []) {
    qc.setQueryData(key as unknown[], data);
  }
}

function invalidateRequests(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
  qc.invalidateQueries({ queryKey: ["seer-queue-status"] });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; seasons?: number[]; deleteFiles?: boolean; full?: boolean }) =>
      deleteRequest(args.id, { seasons: args.seasons, deleteFiles: args.deleteFiles }),
    // Suppression complète → badge « En suppression » immédiat. Une suppression
    // partielle (des saisons restent) ne change pas l'état de la demande.
    onMutate: async (args) => ({
      snapshot: args.full === false ? undefined : await applyOptimisticStatus(qc, [args.id], "deleting"),
    }),
    onError: (_err, _vars, ctx) => rollbackOptimistic(qc, ctx?.snapshot),
    onSettled: () => invalidateRequests(qc),
  });
}

/** Retirer une demande « À vérifier » : elle quitte la liste aussitôt. */
export function useForgetRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => forgetRequest(id),
    onMutate: async (id) => ({ snapshot: await removeOptimistic(qc, [id]) }),
    onError: (_err, _vars, ctx) => rollbackOptimistic(qc, ctx?.snapshot),
    onSettled: () => invalidateRequests(qc),
  });
}

export function useRetryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; seasons?: number[]; profileId?: string | null; forceRedownload?: boolean }) =>
      retryRequest(args.id, { seasons: args.seasons, profileId: args.profileId, forceRedownload: args.forceRedownload }),
    onMutate: async (args) => ({ snapshot: await applyOptimisticStatus(qc, [args.id], "queued") }),
    onError: (_err, _vars, ctx) => rollbackOptimistic(qc, ctx?.snapshot),
    onSettled: () => invalidateRequests(qc),
  });
}

export function useRetryDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retryDeleteRequest(id),
    onMutate: async (id) => ({ snapshot: await applyOptimisticStatus(qc, [id], "deleting") }),
    onError: (_err, _vars, ctx) => rollbackOptimistic(qc, ctx?.snapshot),
    onSettled: () => invalidateRequests(qc),
  });
}

export function useBulkDeleteRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteRequests(ids),
    onMutate: async (ids) => ({ snapshot: await applyOptimisticStatus(qc, ids, "deleting") }),
    onError: (_err, _vars, ctx) => rollbackOptimistic(qc, ctx?.snapshot),
    onSettled: () => invalidateRequests(qc),
  });
}

export function useBulkRetryRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { ids: string[]; profileId?: string | null }) => bulkRetryRequests(args.ids, args.profileId),
    onMutate: async (args) => ({ snapshot: await applyOptimisticStatus(qc, args.ids, "queued") }),
    onError: (_err, _vars, ctx) => rollbackOptimistic(qc, ctx?.snapshot),
    onSettled: () => invalidateRequests(qc),
  });
}

/** Statut local affiché pendant qu'un mark Jellyseerr est en vol.
 * « processing » sans téléchargement actif s'affiche « Demandée » (l'effet
 * réel Jellyseerr) — le badge passe « Téléchargement » si un download démarre. */
const MARK_TO_LOCAL: Record<"available" | "partial" | "processing" | "unknown", RequestStatus> = {
  available: "available",
  partial: "partially_available",
  processing: "unavailable",
  unknown: "unavailable",
};

export function useMarkRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; status: "available" | "partial" | "processing" | "unknown" }) =>
      markRequestStatus(args.id, args.status),
    onMutate: async (args) => ({
      snapshot: await applyOptimisticStatus(qc, [args.id], MARK_TO_LOCAL[args.status]),
    }),
    onError: (_err, _vars, ctx) => rollbackOptimistic(qc, ctx?.snapshot),
    onSettled: () => {
      invalidateRequests(qc);
      qc.invalidateQueries({ queryKey: ["seer-stats-overview"] });
    },
  });
}

export function useQueueStatus() {
  return useQuery({
    queryKey: ["seer-queue-status"],
    queryFn: () => getQueueStatus(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
