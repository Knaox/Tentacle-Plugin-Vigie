/* ------------------------------------------------------------------ */
/*  Vigie — Actions groupées sur les demandes                          */
/* ------------------------------------------------------------------ */

/*
 * La barre flotte au-dessus de la barre d'onglets de l'hôte ; ses boutons font
 * 44 px au doigt (32 avant) et parlent le langage des autres actions de Vigie
 * — le rouge « supprimer » vient des jetons d'état, lisible dans les deux
 * thèmes. La redemande groupée demande son profil dans une feuille, comme
 * toutes les surfaces de Vigie.
 */

import { useTranslation } from "react-i18next";
import { ProfileSelector } from "./ProfileSelector";
import { Sheet } from "./ui/Sheet";
import { CTA_DANGER, CTA_GHOST, CTA_PRIMARY, CTA_PRIMARY_HALO, CTA_SECONDARY } from "../styles/cta";
import { CHROME_BOTTOM } from "../utils/host-chrome";

interface RequestsBulkBarProps {
  count: number;
  deleting: boolean;
  retrying: boolean;
  onBulkDelete: () => void;
  onOpenRetryModal: () => void;
  onCancel: () => void;
}

/** Barre flottante des actions groupées (fond opaque avec fallback thème). */
export function RequestsBulkBar({
  count, deleting, retrying, onBulkDelete, onOpenRetryModal, onCancel,
}: RequestsBulkBarProps) {
  const { t } = useTranslation("seer");
  return (
    <div
      className="fixed inset-x-3 z-40 mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-tentacle-border-subtle bg-tentacle-surface-dropdown p-2 shadow-2xl backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:w-auto sm:max-w-none sm:-translate-x-1/2 sm:gap-3 sm:px-3"
      style={{ bottom: `calc(0.75rem + ${CHROME_BOTTOM})` }}
    >
      <button type="button" onClick={onBulkDelete} disabled={deleting} className={`${CTA_DANGER} h-11 min-w-0 flex-1 px-3 sm:h-10 sm:flex-none sm:px-4`}>
        <span className="truncate">{deleting ? "…" : t("seer:bulkDelete", { count })}</span>
      </button>
      <button type="button" onClick={onOpenRetryModal} disabled={retrying} className={`${CTA_SECONDARY} h-11 min-w-0 flex-1 px-3 sm:h-10 sm:flex-none sm:px-4`}>
        <span className="truncate">{retrying ? "…" : t("seer:bulkRetry", { count })}</span>
      </button>
      <button type="button" onClick={onCancel} className={`${CTA_GHOST} h-11 shrink-0 px-3 sm:h-10`}>
        {t("seer:bulkCancel")}
      </button>
    </div>
  );
}

interface BulkRetryModalProps {
  count: number;
  profileId: string | null;
  onProfileChange: (id: string | null) => void;
  retrying: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Choix du profil de qualité avant une redemande groupée. */
export function BulkRetryModal({
  count, profileId, onProfileChange, retrying, onConfirm, onClose,
}: BulkRetryModalProps) {
  const { t } = useTranslation("seer");
  const footer = (
    <div className="flex items-center gap-2 sm:justify-end">
      <button type="button" onClick={onClose} className={`${CTA_SECONDARY} h-11 flex-1 px-4 sm:h-10 sm:flex-none`}>
        {t("seer:cancel")}
      </button>
      <button type="button" onClick={onConfirm} disabled={retrying} style={CTA_PRIMARY_HALO} className={`${CTA_PRIMARY} h-11 flex-1 px-4 sm:h-10 sm:flex-none`}>
        {retrying ? "…" : t("seer:seasonActionConfirm")}
      </button>
    </div>
  );
  return (
    <Sheet open onClose={onClose} title={t("seer:bulkRetry", { count })} size="sm" footer={footer}>
      <div className="pb-1">
        <ProfileSelector showAll selectedId={profileId} onChange={onProfileChange} />
      </div>
    </Sheet>
  );
}
