/* ------------------------------------------------------------------ */
/*  Vigie — Tout ce qu'on peut faire d'une demande                     */
/* ------------------------------------------------------------------ */

/*
 * Les cartes n'affichent plus quatre boutons chacune : une action principale
 * (Regarder, Réessayer), et « ⋯ » pour le reste — ici, en grandes lignes
 * faciles à viser, la suppression à part, en rouge, tout en bas.
 */

import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import { Sheet } from "../components/ui/Sheet";
import { CheckIcon, ListIcon, PlayIcon, PlusIcon, RetryIcon, TrashIcon } from "../components/ui/icons";

export type RequestAction = "open" | "watch" | "addSeasons" | "retry" | "mark" | "retryDelete" | "delete";

/** Ce qu'une demande permet, selon où elle en est. */
export function availableActions(request: LocalRequest): RequestAction[] {
  const { status } = request;
  const out: RequestAction[] = ["open"];
  if (status === "available" || status === "partially_available") out.push("watch");
  const tvWithSeasons = request.mediaType === "tv" && (request.seasons?.length ?? 0) > 0;
  if (tvWithSeasons && !["deleting", "processing", "delete_failed"].includes(status)) out.push("addSeasons");
  if (!["processing", "deleting", "delete_failed"].includes(status)) out.push("retry");
  if (request.seerrMediaId && ["downloading", "failed", "approved", "sent_to_seer", "partially_available", "available", "unavailable", "deleted"].includes(status)) {
    out.push("mark");
  }
  if (status === "deleting" || status === "delete_failed") out.push("retryDelete");
  if (!["processing", "deleting"].includes(status)) out.push("delete");
  return out;
}

const ICON: Record<RequestAction, React.ReactNode> = {
  open: <ListIcon className="h-5 w-5" />,
  watch: <PlayIcon className="h-5 w-5" />,
  addSeasons: <PlusIcon className="h-5 w-5" />,
  retry: <RetryIcon className="h-5 w-5" />,
  mark: <CheckIcon className="h-5 w-5" />,
  retryDelete: <TrashIcon className="h-5 w-5" />,
  delete: <TrashIcon className="h-5 w-5" />,
};

export function RequestActionsSheet({ request, onAction, onClose }: {
  request: LocalRequest;
  onAction: (action: RequestAction, request: LocalRequest) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("seer");
  const actions = availableActions(request);
  const label = (a: RequestAction) => t(`seer:action_${a}${a === "retryDelete" && request.status === "deleting" ? "Force" : ""}`);

  return (
    <Sheet open onClose={onClose} title={request.title} size="sm">
      <ul className="space-y-1 pt-1">
        {actions.map((action) => {
          const danger = action === "delete";
          return (
            <li key={action} className={danger ? "mt-2 border-t border-tentacle-border-subtle pt-2" : ""}>
              <button
                type="button"
                onClick={() => { onClose(); onAction(action, request); }}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] ${
                  danger ? "text-tentacle-status-error-fg hover:bg-tentacle-status-error-bg" : "text-tentacle-text-primary hover:bg-tentacle-fill-soft"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${danger ? "bg-tentacle-status-error-bg" : "bg-tentacle-fill-soft text-tentacle-text-secondary"}`}>
                  {ICON[action]}
                </span>
                {label(action)}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
