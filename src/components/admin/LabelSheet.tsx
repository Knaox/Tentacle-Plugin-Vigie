/* ------------------------------------------------------------------ */
/*  Vigie — Fenêtre « Nom de l'onglet » : un nom par langue             */
/* ------------------------------------------------------------------ */

/*
 * Le nom français et le nom anglais, chacun sous l'onglet tel qu'il paraîtra
 * dans la barre de Tentacle. Une langue laissée vide prend le nom de
 * l'autre ; sur téléphone, l'onglet ne porte qu'un nom — le français (cf.
 * server/nav-label.ts). Quelques suggestions qui disent ce qu'on vient y
 * faire, pour ne pas partir d'une page blanche.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import { CTA_GHOST, CTA_PRIMARY, CTA_PRIMARY_HALO, CTA_SECONDARY, CTA_SIZE_MD, INPUT_BASE } from "../../styles/cta";
import { pill } from "../../styles/pills";
import { DEFAULT_NAV_LABEL, LABEL_SUGGESTIONS, NAV_LABEL_MAX, shownLabels, type NavLabels } from "../../utils/nav-labels";
import { Sheet } from "../ui/Sheet";
import { FieldLabel } from "./adminKit";
import { NavLabelPill } from "./adminRows";
import type { SeerAdminState } from "./useSeerAdminConfig";

const LANGS = [
  { key: "fr", label: "seer:admLangFr" },
  { key: "en", label: "seer:admLangEn" },
] as const;

export function LabelSheet({ open, onClose, state }: { open: boolean; onClose: () => void; state: SeerAdminState }) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const [labels, setLabels] = useState<NavLabels>({ fr: "", en: "" });

  useEffect(() => {
    if (open && state.config) setLabels(state.config.navLabels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!state.config) return null;
  const saved = state.config.navLabels;
  const shown = shownLabels(labels);
  const changed = labels.fr.trim() !== saved.fr || labels.en.trim() !== saved.en;
  const isSuggestion = (s: NavLabels) => shown.fr === s.fr && shown.en === s.en;

  const save = async () => {
    const ok = await state.save({ navLabels: { fr: labels.fr.trim(), en: labels.en.trim() } });
    toast.show(ok ? "success" : "error", t(ok ? "seer:admSaved" : "seer:configSaveError"));
    if (ok) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("seer:admNavLabel")}
      footer={(
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setLabels({ fr: "", en: "" })}
            disabled={labels.fr === "" && labels.en === ""}
            className={`${CTA_GHOST} ${CTA_SIZE_MD} mr-auto`}
          >
            {t("seer:admNavLabelReset")}
          </button>
          <button type="button" onClick={onClose} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>{t("seer:cancel")}</button>
          <button type="button" onClick={() => void save()} disabled={!changed || state.saving} className={`${CTA_PRIMARY} ${CTA_SIZE_MD}`} style={CTA_PRIMARY_HALO}>
            {state.saving ? t("seer:saving") : t("seer:save")}
          </button>
        </div>
      )}
    >
      <p className="text-sm leading-relaxed text-tentacle-text-tertiary">{t("seer:admNavLabelHint")}</p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tentacle-text-tertiary">{t("seer:admNavLabelSuggestions")}</p>
        <div className="flex flex-wrap gap-2">
          {LABEL_SUGGESTIONS.map((s) => (
            <button
              key={s.fr}
              type="button"
              aria-pressed={isSuggestion(s)}
              onClick={() => setLabels(s.fr === DEFAULT_NAV_LABEL ? { fr: "", en: "" } : { ...s })}
              className={pill(isSuggestion(s))}
            >
              {s.fr === s.en ? s.fr : `${s.fr} · ${s.en}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {LANGS.map(({ key, label }) => (
          <div key={key} className="rounded-2xl bg-tentacle-fill-faint p-4 ring-1 ring-tentacle-border-subtle">
            <FieldLabel
              htmlFor={`vigie-label-${key}`}
              trailing={(
                <span className="text-xs tabular-nums text-tentacle-text-quaternary">
                  {t("seer:admNavLabelCount", { count: Array.from(labels[key]).length, max: NAV_LABEL_MAX })}
                </span>
              )}
            >
              {t(label)}
            </FieldLabel>
            <input
              id={`vigie-label-${key}`}
              type="text"
              value={labels[key]}
              maxLength={NAV_LABEL_MAX}
              lang={key}
              onChange={(e) => setLabels((l) => ({ ...l, [key]: e.target.value }))}
              placeholder={shownLabels({ ...labels, [key]: "" })[key]}
              className={INPUT_BASE}
            />
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-tentacle-text-quaternary">{t("seer:admNavLabelPreview")}</span>
              <NavLabelPill label={shown[key]} size="sm" />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-tentacle-text-tertiary">{t("seer:admNavLabelPhone")}</p>
    </Sheet>
  );
}
