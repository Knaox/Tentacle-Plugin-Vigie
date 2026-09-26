/* ------------------------------------------------------------------ */
/*  Vigie — Confirmer une action qui ne se défait pas                   */
/* ------------------------------------------------------------------ */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "../ui/Sheet";
import { CTA_DANGER, CTA_PRIMARY, CTA_SECONDARY, CTA_SIZE_MD } from "../../styles/cta";

export function ConfirmSheet({ open, title, body, confirmLabel, danger, busy, onConfirm, onClose, children }: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation("seer");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>
            {t("seer:cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`${danger ? CTA_DANGER : CTA_PRIMARY} ${CTA_SIZE_MD}`}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      )}
    >
      <p className="text-sm leading-relaxed text-tentacle-text-secondary">{body}</p>
      {children && <div className="mt-4">{children}</div>}
    </Sheet>
  );
}
