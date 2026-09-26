/* ------------------------------------------------------------------ */
/*  Vigie — Les tags d'un profil                                        */
/* ------------------------------------------------------------------ */

/* Les tags connus de Sonarr et Radarr se choisissent d'un toucher ; un
 * numéro de tag se saisit à la main quand Jellyseerr ne le liste pas. */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArrServerInfo } from "../../../api/types";
import { CTA_SECONDARY, CTA_SIZE_SM, INPUT_BASE } from "../../../styles/cta";
import { pill, pillSm } from "../../../styles/pills";
import { CloseIcon, PlusIcon } from "../../ui/icons";

export function TagPicker({ servers, value, onChange }: {
  servers: readonly ArrServerInfo[];
  value: number[] | undefined;
  onChange: (tags: number[] | undefined) => void;
}) {
  const { t } = useTranslation("seer");
  const [manual, setManual] = useState("");
  const selected = value ?? [];
  const known = new Map<number, string>();
  for (const s of servers) for (const tag of s.tags ?? []) known.set(tag.id, tag.label);
  const available = [...known.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const extra = selected.filter((id) => !known.has(id));

  // Aucun tag choisi : les tags par défaut de Jellyseerr s'appliquent (cf. worker-send.ts).
  const set = (tags: number[]) => onChange(tags.length > 0 ? tags : undefined);
  const toggle = (id: number) => set(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const add = () => {
    const n = Math.floor(Number(manual.trim()));
    if (Number.isFinite(n) && n > 0 && !selected.includes(n)) set([...selected, n]);
    setManual("");
  };

  return (
    <div>
      {available.length === 0 && extra.length === 0 && (
        <p className="text-[13px] text-tentacle-text-tertiary">{t("seer:admProfileTagsNone")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {available.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={selected.includes(id)} onClick={() => toggle(id)} className={pill(selected.includes(id))}>
            {label}
          </button>
        ))}
        {extra.map((id) => (
          <button key={id} type="button" onClick={() => toggle(id)} className={`${pillSm(true)} gap-1`} aria-label={t("seer:admProfileTagRemove", { id })}>
            #{id}
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={t("seer:profileTagManual")}
          aria-label={t("seer:profileTagManual")}
          className={`${INPUT_BASE} h-9 w-32`}
        />
        <button type="button" onClick={add} disabled={!manual.trim()} className={`${CTA_SECONDARY} ${CTA_SIZE_SM} gap-1`}>
          <PlusIcon className="h-4 w-4" />
          {t("seer:admProfileTagAdd")}
        </button>
      </div>
    </div>
  );
}
