/* ------------------------------------------------------------------ */
/*  Vigie — La phrase d'état d'une demande                             */
/* ------------------------------------------------------------------ */

/*
 * Une demande se lit en UNE phrase, dans les mots de celui qui l'a faite :
 * « En attente de validation », « En route · 45 % », « Disponible ». Jamais
 * « sent_to_seer », jamais « approved ».
 *
 * Et jamais « téléchargement » : cette page s'affiche aussi dans l'application
 * mobile, où le mot est proscrit (CLAUDE.md, « Mobile ») — il s'y lit comme
 * une distribution de contenu hors boutique.
 */

import type { LocalRequest } from "../api/types";
import type { ProgressItem } from "../api/types-releases";

export type PhraseTone = "brand" | "info" | "success" | "warning" | "error" | "muted";

export interface RequestPhrase {
  key: string;
  tone: PhraseTone;
  params?: Record<string, unknown>;
}

export function requestPhrase(request: LocalRequest, progress?: ProgressItem): RequestPhrase {
  const download = progress?.download;
  switch (request.status) {
    case "queued":
    case "processing":
      return { key: "seer:phraseSending", tone: "info" };
    case "sent_to_seer":
      return { key: "seer:phraseAwaitingApproval", tone: "warning" };
    case "approved":
      return { key: "seer:phraseSearching", tone: "brand" };
    case "unavailable":
      return { key: "seer:phraseNotFoundYet", tone: "brand" };
    case "downloading":
      if (download?.validating) return { key: "seer:phraseFinishing", tone: "brand" };
      return download?.percent != null
        ? { key: "seer:phraseArrivingPercent", tone: "brand", params: { percent: Math.round(download.percent) } }
        : { key: "seer:phraseArriving", tone: "brand" };
    case "partially_available":
      return download ? { key: "seer:phrasePartialArriving", tone: "success" } : { key: "seer:phrasePartial", tone: "success" };
    case "available":
      return { key: "seer:phraseAvailable", tone: "success" };
    case "retry_pending":
      return { key: "seer:phraseRetrySoon", tone: "warning", params: { count: request.retryCount, max: request.maxRetries } };
    case "failed":
      return { key: "seer:phraseFailed", tone: "error" };
    case "deleting":
      return { key: "seer:phraseDeleting", tone: "muted" };
    case "delete_failed":
      return { key: "seer:phraseDeleteFailed", tone: "error" };
    case "deleted":
      return { key: "seer:phraseDeleted", tone: "muted" };
  }
}

/** Couleur du point et du texte d'une phrase — jetons du thème, clair comme sombre. */
export const PHRASE_TONE: Record<PhraseTone, { dot: string; text: string }> = {
  brand: { dot: "bg-tentacle-brand", text: "text-[var(--brand-light)]" },
  info: { dot: "bg-tentacle-status-info", text: "text-tentacle-status-info-fg" },
  success: { dot: "bg-tentacle-status-success", text: "text-tentacle-status-success-fg" },
  warning: { dot: "bg-tentacle-status-warning", text: "text-tentacle-status-warning-fg" },
  error: { dot: "bg-tentacle-status-error", text: "text-tentacle-status-error-fg" },
  muted: { dot: "bg-tentacle-fill-strong", text: "text-tentacle-text-tertiary" },
};
