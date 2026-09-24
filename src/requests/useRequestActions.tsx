/* ------------------------------------------------------------------ */
/*  Vigie — Les gestes sur une demande                                 */
/* ------------------------------------------------------------------ */

/*
 * Réessayer, supprimer, marquer, ajouter des saisons : les mutations et les
 * fenêtres qui les confirment vivent ici, au niveau de la page — jamais dans
 * une carte (une fenêtre posée dans une carte animée passait sous les cartes
 * suivantes). La vue n'a qu'à dire « ce geste, sur cette demande ».
 */

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import { useToast } from "../hooks/useToast";
import { useDeleteRequest, useForgetRequest, useMarkRequestStatus, useRetryDeleteRequest, useRetryRequest } from "../hooks/useRequests";
import { navigateToMedia } from "../utils/navigate-media";
import { requestAsMedia } from "../utils/as-media";
import { SeasonActionModal } from "../components/SeasonActionModal";
import { MarkMenuSheet, type MarkTarget } from "../components/MarkMenuSheet";
import { useHub } from "../hub/HubContext";
import { RequestActionsSheet, type RequestAction } from "./RequestActionsSheet";

export function useRequestActions() {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const hub = useHub();
  const deleteMutation = useDeleteRequest();
  const retryMutation = useRetryRequest();
  const retryDeleteMutation = useRetryDeleteRequest();
  const forgetMutation = useForgetRequest();
  const markMutation = useMarkRequestStatus();
  const [menuFor, setMenuFor] = useState<LocalRequest | null>(null);
  const [modal, setModal] = useState<{ request: LocalRequest; action: "delete" | "retry" } | null>(null);
  const [markFor, setMarkFor] = useState<LocalRequest | null>(null);

  const run = useCallback((action: RequestAction, request: LocalRequest) => {
    switch (action) {
      case "open": hub.openMedia(requestAsMedia(request)); break;
      case "watch": void navigateToMedia(request.tmdbId, request.mediaType); break;
      case "addSeasons":
        hub.openMedia(requestAsMedia(request), { lockedSeasons: request.seasons ?? undefined, defaultProfileId: request.profileId });
        break;
      case "retry": setModal({ request, action: "retry" }); break;
      case "delete": setModal({ request, action: "delete" }); break;
      case "mark": setMarkFor(request); break;
      case "retryDelete":
        retryDeleteMutation.mutate(request.id, {
          onSuccess: () => toast.show("success", t("seer:requestDeleting")),
          onError: () => toast.show("error", t("seer:requestDeleteError")),
        });
        break;
      // Retirer seulement : la demande quitte la liste, rien n'est touché dans
      // Jellyfin, Sonarr ou Radarr — pas de confirmation à cocher, la ligne du
      // menu le dit.
      case "forget":
        forgetMutation.mutate(request.id, {
          onSuccess: () => toast.show("success", t("seer:requestForgotten", { title: request.title })),
          onError: () => toast.show("error", t("seer:requestForgetError")),
        });
        break;
    }
  }, [hub, retryDeleteMutation, forgetMutation, toast, t]);

  const onMark = (request: LocalRequest, status: MarkTarget) => {
    markMutation.mutate({ id: request.id, status }, {
      onSuccess: () => toast.show("success", t("seer:markedSuccess")),
      onError: () => toast.show("error", t("seer:markedError")),
    });
  };

  const onConfirm = (
    request: LocalRequest,
    action: "delete" | "retry",
    seasons?: number[],
    profileId?: string | null,
    options?: { deleteFiles?: boolean; forceRedownload?: boolean },
  ) => {
    if (action === "delete") {
      // Partielle (des saisons de la demande survivent) : l'état ne passe pas « en suppression ».
      const all = request.seasons ?? [];
      const full = !seasons || seasons.length === 0 || seasons.length >= all.length;
      deleteMutation.mutate({ id: request.id, seasons, deleteFiles: options?.deleteFiles, full }, {
        onSuccess: () => toast.show("success", t("seer:requestDeleting")),
        onError: () => toast.show("error", t("seer:requestDeleteError")),
      });
    } else {
      retryMutation.mutate({ id: request.id, seasons, profileId, forceRedownload: options?.forceRedownload }, {
        onSuccess: () => toast.show("success", t("seer:requestRetried")),
        onError: () => toast.show("error", t("seer:requestRetryError")),
      });
    }
  };

  const modals = (
    <>
      {menuFor && <RequestActionsSheet request={menuFor} onAction={run} onClose={() => setMenuFor(null)} />}
      {modal && (
        <SeasonActionModal
          request={modal.request}
          action={modal.action}
          onConfirm={(seasons, profileId, options) => { onConfirm(modal.request, modal.action, seasons, profileId, options); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
      {markFor && (
        <MarkMenuSheet request={markFor} onSelect={(target) => { onMark(markFor, target); setMarkFor(null); }} onClose={() => setMarkFor(null)} />
      )}
    </>
  );

  return { run, openMenu: setMenuFor, modals, busy: retryMutation.isPending || deleteMutation.isPending };
}
