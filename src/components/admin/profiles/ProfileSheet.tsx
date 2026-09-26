/* ------------------------------------------------------------------ */
/*  Vigie — Fenêtre d'un profil de qualité                              */
/* ------------------------------------------------------------------ */

/*
 * Un profil, c'est un nom que l'utilisateur choisit à la demande (« 4K »,
 * « Animés VOSTFR »…) et ce qu'il envoie à Jellyseerr : pour quels médias,
 * quel serveur, quelle qualité, quel dossier, quels tags. Les champs Radarr
 * ou Sonarr n'apparaissent que pour les médias qu'ils servent.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArrServerInfo, ProfileTargetMedia, SeerProfile } from "../../../api/types";
import { CTA_PRIMARY, CTA_PRIMARY_HALO, CTA_SECONDARY, CTA_SIZE_MD, INPUT_BASE } from "../../../styles/cta";
import { Segmented } from "../../ui/Segmented";
import { Sheet } from "../../ui/Sheet";
import { FieldLabel, Hint } from "../adminKit";
import { ArrPicker } from "./ArrPicker";
import { TARGETS, usesRadarr, usesSonarr } from "./profileSummary";
import { TagPicker } from "./TagPicker";

const TARGET_LABEL: Record<ProfileTargetMedia, string> = {
  all: "seer:admTargetAll", movie: "seer:admTargetMovie", tv: "seer:admTargetTv", anime: "seer:admTargetAnime",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-tentacle-fill-faint p-4 ring-1 ring-tentacle-border-subtle">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-tentacle-text-tertiary">{title}</h3>
      {children}
    </section>
  );
}

export function ProfileSheet({ profile, isNew, radarr, sonarr, saving, onSave, onClose }: {
  profile: SeerProfile | null;
  isNew: boolean;
  radarr: readonly ArrServerInfo[];
  sonarr: readonly ArrServerInfo[];
  saving: boolean;
  onSave: (profile: SeerProfile) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("seer");
  const [draft, setDraft] = useState<SeerProfile | null>(profile);
  useEffect(() => { setDraft(profile); }, [profile]);
  if (!draft) return null;

  const set = (patch: Partial<SeerProfile>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const target = draft.targetMediaType ?? "all";
  const valid = draft.name.trim() !== "";

  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title={isNew ? t("seer:admProfileNew") : t("seer:admProfileEditTitle")}
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>{t("seer:cancel")}</button>
          <button
            type="button"
            onClick={() => onSave({ ...draft, name: draft.name.trim() })}
            disabled={!valid || saving}
            className={`${CTA_PRIMARY} ${CTA_SIZE_MD}`}
            style={CTA_PRIMARY_HALO}
          >
            {saving ? t("seer:saving") : t("seer:save")}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="vigie-profile-name">{t("seer:admProfileName")}</FieldLabel>
          <input
            id="vigie-profile-name"
            type="text"
            value={draft.name}
            maxLength={40}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={t("seer:profileNamePlaceholder")}
            className={INPUT_BASE}
          />
          <Hint>{t("seer:admProfileNameHint")}</Hint>
        </div>

        <div>
          <FieldLabel>{t("seer:profileTarget")}</FieldLabel>
          <Segmented
            value={target}
            onChange={(targetMediaType) => set({ targetMediaType })}
            ariaLabel={t("seer:profileTarget")}
            size="sm"
            stretch="always"
            options={TARGETS.map((value) => ({ value, label: t(TARGET_LABEL[value]) }))}
          />
        </div>

        {usesRadarr(target) && (
          <Section title={t("seer:admProfileRadarr")}>
            <ArrPicker
              kind="radarr"
              servers={radarr}
              value={{ serverId: draft.radarrServerId, profileId: draft.radarrProfileId, rootFolder: draft.radarrRootFolder }}
              onChange={(v) => set({ radarrServerId: v.serverId, radarrProfileId: v.profileId, radarrRootFolder: v.rootFolder })}
            />
          </Section>
        )}
        {usesSonarr(target) && (
          <Section title={t(target === "anime" ? "seer:admProfileSonarrAnime" : "seer:admProfileSonarr")}>
            <ArrPicker
              kind="sonarr"
              servers={sonarr}
              value={{ serverId: draft.sonarrServerId, profileId: draft.sonarrProfileId, rootFolder: draft.sonarrRootFolder }}
              onChange={(v) => set({ sonarrServerId: v.serverId, sonarrProfileId: v.profileId, sonarrRootFolder: v.rootFolder })}
            />
          </Section>
        )}

        <Section title={t("seer:profileTags")}>
          <p className="mb-3 text-[13px] leading-relaxed text-tentacle-text-tertiary">{t("seer:profileTagsHint")}</p>
          <TagPicker servers={[...radarr, ...sonarr]} value={draft.tags} onChange={(tags) => set({ tags })} />
        </Section>
      </div>
    </Sheet>
  );
}
