/* ------------------------------------------------------------------ */
/*  Vigie — Où en est une demande, en mots de tous les jours            */
/* ------------------------------------------------------------------ */

/*
 * Treize statuts techniques côté serveur (file locale, envoyée, approuvée,
 * téléchargement, nouvelle tentative…) — et trois questions côté utilisateur :
 * est-ce que ça arrive, est-ce que c'est là, est-ce que ça coince ? La page
 * « Mes demandes » ne parle plus que de ces trois-là.
 *
 * Le détail reste lisible dans la phrase d'état de chaque demande, jamais
 * dans une rangée de filtres techniques.
 */

import type { LocalRequest, RequestStatus } from "../api/types";

export type RequestGroup = "active" | "available" | "attention" | "archived";

export const GROUP_ORDER: readonly RequestGroup[] = ["active", "available", "attention", "archived"];

const ACTIVE: ReadonlySet<RequestStatus> = new Set([
  "queued", "processing", "sent_to_seer", "approved", "unavailable", "downloading", "retry_pending",
]);

/**
 * Le groupe d'une demande. `downloading` : l'avancement réel connu — une série
 * « disponible en partie » qui récupère encore des épisodes est EN COURS, pas
 * rangée parmi ce qui est déjà là.
 */
export function groupOf(request: Pick<LocalRequest, "status">, downloading = false): RequestGroup {
  const { status } = request;
  if (ACTIVE.has(status)) return "active";
  if (status === "partially_available") return downloading ? "active" : "available";
  if (status === "available") return "available";
  if (status === "failed" || status === "delete_failed") return "attention";
  return "archived";
}

/** Plus récente d'abord, dans chaque groupe. */
export function groupRequests(
  requests: readonly LocalRequest[],
  isDownloading: (id: string) => boolean = () => false,
): Map<RequestGroup, LocalRequest[]> {
  const out = new Map<RequestGroup, LocalRequest[]>(GROUP_ORDER.map((g) => [g, []]));
  for (const request of requests) out.get(groupOf(request, isDownloading(request.id)))?.push(request);
  for (const list of out.values()) list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

/** Combien de demandes dans chaque groupe, d'après les statistiques du serveur. */
export function countByGroup(byStatus: Record<string, number> | undefined): Record<RequestGroup, number> {
  const counts: Record<RequestGroup, number> = { active: 0, available: 0, attention: 0, archived: 0 };
  for (const [status, n] of Object.entries(byStatus ?? {})) {
    counts[groupOf({ status: status as RequestStatus })] += n ?? 0;
  }
  return counts;
}

/** Arrivée récemment (sept jours) : de quoi la mettre en avant sur l'accueil. */
export function recentlyArrived(request: LocalRequest, now = Date.now()): boolean {
  if (request.status !== "available" && request.status !== "partially_available") return false;
  const when = Date.parse(request.completedAt ?? request.updatedAt);
  return Number.isFinite(when) && now - when < 7 * 86_400_000;
}
