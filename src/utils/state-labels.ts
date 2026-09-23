/* ------------------------------------------------------------------ */
/*  Vigie — Le mot de chaque état, selon l'endroit où il s'affiche      */
/* ------------------------------------------------------------------ */

import { isMobileWebView } from "./tentacle-fetch";
import type { TitleState, TitleStatus } from "./title-state";

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** L'application mobile : « téléchargement » n'y s'écrit pas (cf. i18n/fr/states.ts). */
function inApp(): boolean {
  try {
    return isMobileWebView();
  } catch {
    return false;
  }
}

/** `short` : sous une affiche étroite ; `long` : partout où il y a la place. */
export function stateLabel(state: TitleState, t: Translate, variant: "long" | "short" = "long"): string {
  switch (state) {
    case "requested":
      return t("seer:stRequested");
    case "downloading":
      if (variant === "short") return t(inApp() ? "seer:stDownloadingShortApp" : "seer:stDownloadingShortWeb");
      return t(inApp() ? "seer:stDownloadingApp" : "seer:stDownloadingWeb");
    case "stalled":
      return t("seer:stStalled");
    case "available":
      return t("seer:stAvailable");
    case "partial":
      return t(variant === "short" ? "seer:stPartialShort" : "seer:stPartial");
  }
}

/** Le mot d'état, avancement compris : « En téléchargement · 45 % ». */
export function statusText(status: TitleStatus, t: Translate): string {
  const label = stateLabel(status.state, t);
  return status.state === "downloading" && status.percent != null
    ? `${label} · ${t("seer:stPercent", { percent: Math.floor(status.percent) })}`
    : label;
}
