/* ------------------------------------------------------------------ */
/*  Vigie — Où en est une demande : un mot d'état, une nuance           */
/* ------------------------------------------------------------------ */

/*
 * Une demande se lit en deux temps :
 *   - son ÉTAT, l'un des cinq mots communs à tout Vigie (demandé, en route,
 *     bloqué, disponible, en partie) — le badge coloré ;
 *   - sa NUANCE, dans les mots de celui qui l'a faite : « En attente de
 *     validation », « Reste 12 min », « Déjà là en partie ». Jamais
 *     « sent_to_seer », jamais « approved ».
 *
 * Ce qui n'est plus une attente (refusée, supprimée) n'a pas d'état : sa
 * nuance, teintée, dit tout. Un téléchargement qui coince n'est JAMAIS un
 * échec : il est « bloqué ».
 */

import type { LocalRequest } from "../api/types";
import type { ProgressItem } from "../api/types-releases";
import { stateFromRequest, type TitleStatus } from "../utils/title-state";
import { formatEta } from "../utils/format-bytes";

export type PhraseTone = "brand" | "info" | "success" | "warning" | "error" | "muted";

export interface RequestPhrase {
  key: string;
  tone: PhraseTone;
  params?: Record<string, unknown>;
}

export interface RequestView {
  /** L'état commun — `null` pour ce qui n'attend plus rien. */
  status: TitleStatus | null;
  /** La nuance ; `null` quand l'état suffit. */
  detail: RequestPhrase | null;
}

function arrivedOn(request: LocalRequest): string | null {
  const when = Date.parse(request.completedAt ?? "");
  return Number.isFinite(when) ? new Date(when).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;
}

export function requestView(request: LocalRequest, progress?: ProgressItem): RequestView {
  const status = stateFromRequest(request, progress);
  const download = progress?.download;
  const muted = (key: string, params?: Record<string, unknown>): RequestPhrase => ({ key, tone: "muted", params });

  switch (request.status) {
    case "queued":
    case "processing":
      return { status, detail: muted("seer:dtSending") };
    case "sent_to_seer":
      return { status, detail: { key: "seer:dtAwaitingApproval", tone: "warning" } };
    case "approved":
      return { status, detail: muted("seer:dtSearching") };
    case "unavailable":
      return { status, detail: muted("seer:dtNotFound") };
    case "retry_pending":
      return { status, detail: muted("seer:dtRetrySoon", { count: request.retryCount, max: request.maxRetries }) };
    case "downloading":
    case "partially_available": {
      if (download?.stalled) return { status, detail: { key: "seer:dtStalled", tone: "warning" } };
      // Le badge dit « En cours d'importation », la barre ce qui se range : rien à ajouter.
      if (download?.validating) return { status, detail: null };
      const eta = formatEta(download?.etaSeconds);
      if (download && (download.stalledCount ?? 0) > 0) {
        return { status, detail: { key: "seer:stStalledSome", tone: "warning", params: { count: download.stalledCount } } };
      }
      if (eta) return { status, detail: muted("seer:dtRemaining", { eta }) };
      if (request.status === "partially_available" && download) return { status, detail: muted("seer:dtPartialHere") };
      return { status, detail: null };
    }
    case "available": {
      const date = arrivedOn(request);
      return { status, detail: date ? muted("seer:dtArrivedOn", { date }) : null };
    }
    case "failed":
      return { status: null, detail: { key: "seer:phraseFailed", tone: "error" } };
    case "deleting":
      return { status: null, detail: muted("seer:phraseDeleting") };
    case "delete_failed":
      return { status: null, detail: { key: "seer:phraseDeleteFailed", tone: "error" } };
    case "deleted":
      return { status: null, detail: muted("seer:phraseDeleted") };
  }
}

/** Couleur du point et du texte d'une nuance — jetons du thème, clair comme sombre. */
export const PHRASE_TONE: Record<PhraseTone, { dot: string; text: string }> = {
  brand: { dot: "bg-tentacle-brand", text: "text-[var(--brand-light)]" },
  info: { dot: "bg-tentacle-status-info", text: "text-tentacle-status-info-fg" },
  success: { dot: "bg-tentacle-status-success", text: "text-tentacle-status-success-fg" },
  warning: { dot: "bg-[var(--vg-stalled-solid)]", text: "text-[var(--vg-stalled-fg)]" },
  error: { dot: "bg-tentacle-status-error", text: "text-tentacle-status-error-fg" },
  muted: { dot: "bg-tentacle-fill-strong", text: "text-tentacle-text-tertiary" },
};
