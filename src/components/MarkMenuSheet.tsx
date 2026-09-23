import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import { STATUS_STYLE } from "../styles/status";
import { CHROME_BOTTOM } from "../utils/host-chrome";
import { useOverlay } from "../hooks/useOverlay";

export type MarkTarget = "available" | "partial" | "processing" | "unknown";

interface MarkMenuSheetProps {
  request: LocalRequest;
  onSelect: (target: MarkTarget) => void;
  onClose: () => void;
}

interface MarkOption {
  target: MarkTarget;
  labelKey: string;
  tvOnly?: boolean;
  color: string;
  iconPaths: string[];
}

// Les 4 états réels de l'API Jellyseerr (POST /media/{id}/{status}).
// Couleurs via styles/status.ts — thémées (les text-*-300 en dur étaient
// illisibles sur surface claire).
const OPTIONS: MarkOption[] = [
  {
    target: "available", labelKey: "seer:markAsAvailable", color: STATUS_STYLE.available.text,
    iconPaths: ["M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  },
  {
    target: "partial", labelKey: "seer:markAsPartial", tvOnly: true, color: STATUS_STYLE.partially_available.text,
    iconPaths: [
      "M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z",
      "M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z",
    ],
  },
  {
    target: "processing", labelKey: "seer:markAsProcessing", color: STATUS_STYLE.processing.text,
    iconPaths: ["M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"],
  },
  {
    // « unknown » côté API : Jellyseerr repasse le média à l'état demandé
    target: "unknown", labelKey: "seer:markAsUnknown", color: STATUS_STYLE.approved.text,
    iconPaths: ["M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"],
  },
];

/**
 * Sélecteur de statut « Marquer comme », rendu au NIVEAU PAGE (comme
 * SeasonActionModal) et non dans la carte : les wrappers animés des cartes
 * (animation fill forwards → transform/opacity) créent des stacking contexts
 * qui faisaient passer l'ancien dropdown SOUS les cartes suivantes (menu
 * illisible et non cliquable). Bottom sheet sur mobile, centré en ≥sm.
 */
export function MarkMenuSheet({ request, onSelect, onClose }: MarkMenuSheetProps) {
  const { t } = useTranslation("seer");

  useOverlay(true, onClose);

  const options = OPTIONS.filter((o) => !o.tvOnly || request.mediaType === "tv");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center"
      style={{ animation: "fadeIn 200ms ease forwards" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("seer:markAs")}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-tentacle-border-subtle bg-tentacle-surface-dropdown shadow-2xl sm:mx-4 sm:rounded-2xl"
        style={{
          animation: "fadeSlideUp 250ms cubic-bezier(0.22,1,0.36,1) forwards",
          // La barre de l'hôte (mobile) recouvrait la dernière option de la
          // feuille — celle qu'on vise le plus souvent, en bas de liste.
          paddingBottom: `calc(max(env(safe-area-inset-bottom), 8px) + ${CHROME_BOTTOM})`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-tentacle-border-subtle px-5 pb-3 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tentacle-text-tertiary">
            {t("seer:markAs")}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-tentacle-text-primary">{request.title}</p>
        </div>

        <div className="flex flex-col py-1">
          {options.map((o) => (
            <button
              key={o.target}
              onClick={() => onSelect(o.target)}
              className={`flex min-h-[48px] items-center gap-3 px-5 text-left text-sm font-medium transition-colors hover:bg-tentacle-fill-soft active:bg-tentacle-fill-medium focus:outline-none focus-visible:bg-tentacle-fill-soft ${o.color}`}
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                {o.iconPaths.map((d) => (
                  <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />
                ))}
              </svg>
              {t(o.labelKey)}
            </button>
          ))}
        </div>

        <div className="border-t border-tentacle-border-subtle p-2">
          <button
            onClick={onClose}
            className="min-h-[48px] w-full rounded-xl text-sm font-medium text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-secondary active:bg-tentacle-fill-medium"
          >
            {t("seer:cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
