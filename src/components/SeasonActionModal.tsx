/* ------------------------------------------------------------------ */
/*  Vigie — Supprimer ou redemander une demande, saison par saison      */
/* ------------------------------------------------------------------ */

/*
 * Une feuille, comme toutes les surfaces de Vigie : au téléphone elle monte
 * du bas (on la tire pour la fermer), sur grand écran c'est une fenêtre
 * centrée. Elle en hérite Échap, le voile de l'hôte et le verrou du
 * défilement — la fenêtre maison d'avant n'avait rien de tout cela, et des
 * cibles de 28 px.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import { ProfileSelector } from "./ProfileSelector";
import { Sheet } from "./ui/Sheet";
import { CTA_PRIMARY, CTA_PRIMARY_HALO, CTA_SECONDARY } from "../styles/cta";

interface SeasonActionModalProps {
  request: LocalRequest;
  action: "delete" | "retry";
  onConfirm: (
    seasons?: number[],
    profileId?: string | null,
    options?: { deleteFiles?: boolean; forceRedownload?: boolean },
  ) => void;
  onClose: () => void;
}

export function SeasonActionModal({ request, action, onConfirm, onClose }: SeasonActionModalProps) {
  const { t } = useTranslation("seer");
  const seasons = request.seasons ?? [];
  const hasSeasons = seasons.length > 0;
  const [selected, setSelected] = useState<Set<number>>(new Set(seasons));
  const [profileId, setProfileId] = useState<string | null>(request.profileId ?? null);
  // Suppression : « supprimer le contenu » coché par défaut (supprime aussi les
  // fichiers Sonarr/Radarr). Retry : forcer le re-téléchargement reste décoché.
  const [deleteFiles, setDeleteFiles] = useState(true);
  const [forceRedownload, setForceRedownload] = useState(false);

  const toggle = (s: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const allSelected = !hasSeasons || selected.size === seasons.length;

  const handleConfirm = () => {
    // Saisons explicitement cochées (ou aucune si la demande n'a pas de saisons).
    const explicit = hasSeasons ? Array.from(selected).sort((a, b) => a - b) : undefined;
    // Suppression : TOUJOURS cibler les saisons de CETTE demande, jamais toute la
    // série. `undefined` (= toute la série côté backend) seulement si la demande
    // n'a pas de saisons. Retry : comportement historique conservé.
    const s = action === "delete" ? explicit : (allSelected ? undefined : explicit);
    onConfirm(
      s,
      action === "retry" ? profileId : undefined,
      action === "delete" ? { deleteFiles } : { forceRedownload },
    );
  };

  const title = action === "delete"
    ? (hasSeasons ? t("seer:seasonActionDeleteTitle") : t("seer:confirmDelete"))
    : (hasSeasons ? t("seer:seasonActionRetryTitle") : t("seer:confirmRetry"));

  // L'avertissement n'a de sens que si l'utilisateur active explicitement l'option destructive
  const showWarn = action === "delete" ? deleteFiles : forceRedownload;
  const warn = action === "delete" ? t("seer:seasonActionDeleteWarn") : t("seer:seasonActionRetryWarn");
  const canConfirm = !hasSeasons || selected.size > 0;
  const partialLabel = hasSeasons && selected.size > 0 && !allSelected
    ? ` (S${Array.from(selected).sort((a, b) => a - b).join(", S")})`
    : "";

  const footer = (
    <div className="flex items-center gap-2 sm:justify-end">
      <button type="button" onClick={onClose} className={`${CTA_SECONDARY} h-11 flex-1 px-4 sm:h-10 sm:flex-none`}>
        {t("seer:cancel")}
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canConfirm}
        style={CTA_PRIMARY_HALO}
        className={`${CTA_PRIMARY} h-11 flex-1 px-4 sm:h-10 sm:flex-none`}
      >
        {t("seer:seasonActionConfirm")}{partialLabel}
      </button>
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={title} size="sm" footer={footer}>
      <div className="space-y-4 pb-1">
        {/* Saisons — uniquement pour les séries */}
        {hasSeasons && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {seasons.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  aria-pressed={selected.has(s)}
                  className={`h-10 min-w-[52px] rounded-full px-4 text-sm font-semibold tabular-nums transition-colors ${
                    selected.has(s)
                      ? "bg-tentacle-cta-primary text-tentacle-cta-primary-fg"
                      : "bg-tentacle-fill-soft text-tentacle-text-secondary ring-1 ring-tentacle-border-subtle hover:bg-tentacle-fill-medium hover:text-tentacle-text-primary"
                  }`}
                >
                  S{s}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelected(new Set(seasons))}
              className={`h-11 w-full rounded-full px-4 text-sm font-semibold transition-colors ${
                allSelected
                  ? "bg-[rgba(var(--brand-rgb),0.2)] text-tentacle-brand-light ring-1 ring-[rgba(var(--brand-rgb),0.3)]"
                  : "bg-tentacle-fill-subtle text-tentacle-text-secondary hover:bg-tentacle-fill-medium"
              }`}
            >
              {t("seer:seasonActionAll")}
            </button>
          </div>
        )}

        {/* Profil de qualité — uniquement pour retry */}
        {action === "retry" && (
          <ProfileSelector showAll selectedId={profileId} onChange={setProfileId} />
        )}

        {/* Option destructive — la ligne entière coche la case. */}
        <label className="flex min-h-[56px] cursor-pointer items-start gap-3 rounded-2xl bg-tentacle-fill-subtle px-4 py-3">
          <input
            type="checkbox"
            checked={action === "delete" ? deleteFiles : forceRedownload}
            onChange={(e) => action === "delete" ? setDeleteFiles(e.target.checked) : setForceRedownload(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-tentacle-brand"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-tentacle-text-primary">
              {action === "delete" ? t("seer:deleteAlsoFiles") : t("seer:forceRedownload")}
            </span>
            <span className="mt-0.5 block text-xs text-tentacle-text-tertiary">
              {action === "delete" ? t("seer:deleteAlsoFilesHint") : t("seer:forceRedownloadHint")}
            </span>
          </span>
        </label>

        {showWarn && <p className="text-xs font-medium text-tentacle-status-warning-fg">{warn}</p>}
      </div>
    </Sheet>
  );
}
