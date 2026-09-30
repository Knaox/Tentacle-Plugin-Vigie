/* ------------------------------------------------------------------ */
/*  Vigie — Ouvrir un titre disponible dans Tentacle                   */
/* ------------------------------------------------------------------ */

/*
 * « Voir la série », « Regarder le film », « Regarder » : tous mènent à la
 * fiche de la bibliothèque. Quand le titre ne s'y retrouve pas, on le dit —
 * un bouton qui ne fait rien passait pour un bouton cassé.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { navigateToMedia } from "../utils/navigate-media";
import { useToast } from "./useToast";

export function useOpenInLibrary() {
  const { t } = useTranslation("seer");
  const toast = useToast();
  return useCallback(async (tmdbId: number, mediaType: string, knownId?: string | null): Promise<boolean> => {
    const opened = await navigateToMedia(tmdbId, mediaType, knownId);
    if (!opened) toast.show("error", t("seer:libraryNotFound"));
    return opened;
  }, [t, toast]);
}
