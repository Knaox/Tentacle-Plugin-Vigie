/* ------------------------------------------------------------------ */
/*  Vigie — Onglet « Profils de qualité »                               */
/* ------------------------------------------------------------------ */

/*
 * Chaque profil en une carte qui dit ce qu'il règle (serveur, qualité,
 * dossier, tags) sans l'ouvrir ; on l'édite dans sa fenêtre. Choisir le
 * profil par défaut, en ajouter, en supprimer : chaque geste s'enregistre.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerProfile } from "../../../api/types";
import { useProfileOptions } from "../../../hooks/useProfiles";
import { useToast } from "../../../hooks/useToast";
import { CTA_DANGER, CTA_GHOST, CTA_PRIMARY, CTA_PRIMARY_HALO, CTA_SECONDARY, CTA_SIZE_MD, CTA_SIZE_SM } from "../../../styles/cta";
import { LayersIcon, PlusIcon, StarIcon } from "../../ui/icons";
import { Card, Chip } from "../adminKit";
import { ConfirmSheet } from "../ConfirmSheet";
import type { SeerAdminConfig, SeerAdminState } from "../useSeerAdminConfig";
import { arrChoice, emptyProfile, tagLabels, upsertProfile, usesRadarr, usesSonarr, withDefault, type ArrChoice } from "./profileSummary";
import { ProfileSheet } from "./ProfileSheet";

const TARGET_LABEL = { all: "seer:admTargetAll", movie: "seer:admTargetMovie", tv: "seer:admTargetTv", anime: "seer:admTargetAnime" } as const;

export function ProfilesTab({ state }: { state: SeerAdminState }) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const config = state.config as SeerAdminConfig;
  const { data: options, error } = useProfileOptions();
  const [editing, setEditing] = useState<{ profile: SeerProfile; isNew: boolean } | null>(null);
  const [removing, setRemoving] = useState<SeerProfile | null>(null);
  const radarr = options?.radarr ?? [];
  const sonarr = options?.sonarr ?? [];

  const persist = async (profiles: SeerProfile[], done?: () => void) => {
    const ok = await state.save({ profiles });
    toast.show(ok ? "success" : "error", t(ok ? "seer:admSaved" : "seer:configSaveError"));
    if (ok) done?.();
  };

  const line = (label: string, choice: ArrChoice) => [
    label,
    choice.server ? `${choice.server.name} · ${choice.quality ?? t("seer:admProfileQualityDefault")}` : t("seer:admProfileNoServer"),
    choice.folder,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <Card
        title={t("seer:profilesTitle")}
        description={t("seer:admProfilesDesc")}
        action={(
          <button type="button" onClick={() => setEditing({ profile: emptyProfile(), isNew: true })} className={`${CTA_PRIMARY} ${CTA_SIZE_MD} gap-2`} style={CTA_PRIMARY_HALO}>
            <PlusIcon className="h-4 w-4" />
            {t("seer:profileAdd")}
          </button>
        )}
      >
        {error ? (
          <p className="rounded-xl bg-tentacle-status-warning-bg px-4 py-3 text-[13px] text-tentacle-status-warning-fg">
            {t("seer:admProfileOptionsError", { error: (error as Error).message })}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {radarr.map((s) => <Chip key={`r${s.id}`}>Radarr · {s.name}</Chip>)}
            {sonarr.map((s) => <Chip key={`s${s.id}`}>Sonarr · {s.name}</Chip>)}
          </div>
        )}
      </Card>

      {config.profiles.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-tentacle-fill-subtle px-6 py-12 text-center ring-1 ring-tentacle-border-subtle">
          <LayersIcon className="h-10 w-10 text-tentacle-text-quaternary" />
          <p className="mt-3 text-base font-semibold text-tentacle-text-primary">{t("seer:admProfilesEmptyTitle")}</p>
          <p className="mt-1 max-w-sm text-sm text-tentacle-text-tertiary">{t("seer:profilesEmpty")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {config.profiles.map((p) => {
            const target = p.targetMediaType ?? "all";
            const tags = tagLabels([...radarr, ...sonarr], p.tags);
            return (
              <li key={p.id} className="flex flex-col rounded-2xl bg-tentacle-fill-subtle p-5 ring-1 ring-tentacle-border-subtle">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-base font-semibold text-tentacle-text-primary">{p.name || t("seer:admProfileUnnamed")}</p>
                  {p.isDefault && <Chip tone="brand"><StarIcon className="h-3 w-3" />{t("seer:profileDefault")}</Chip>}
                  <Chip>{t(TARGET_LABEL[target])}</Chip>
                </div>
                <div className="mt-3 space-y-1 text-[13px] text-tentacle-text-secondary">
                  {usesRadarr(target) && <p className="truncate">{line("Radarr", arrChoice(radarr, p.radarrServerId, p.radarrProfileId, p.radarrRootFolder))}</p>}
                  {usesSonarr(target) && <p className="truncate">{line("Sonarr", arrChoice(sonarr, p.sonarrServerId, p.sonarrProfileId, p.sonarrRootFolder))}</p>}
                  {tags.length > 0 && <p className="truncate text-tentacle-text-tertiary">{t("seer:profileTags")} : {tags.join(", ")}</p>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-tentacle-border-subtle pt-3">
                  <button type="button" onClick={() => setEditing({ profile: p, isNew: false })} className={`${CTA_SECONDARY} ${CTA_SIZE_SM}`}>
                    {t("seer:admProfileEdit")}
                  </button>
                  {!p.isDefault && (
                    <button type="button" disabled={state.saving} onClick={() => void persist(withDefault(config.profiles, p.id))} className={`${CTA_GHOST} ${CTA_SIZE_SM}`}>
                      {t("seer:admProfileMakeDefault")}
                    </button>
                  )}
                  <button type="button" onClick={() => setRemoving(p)} className={`${CTA_DANGER} ${CTA_SIZE_SM} ml-auto`}>
                    {t("seer:delete")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ProfileSheet
        profile={editing?.profile ?? null}
        isNew={editing?.isNew ?? false}
        radarr={radarr}
        sonarr={sonarr}
        saving={state.saving}
        onSave={(profile) => void persist(upsertProfile(config.profiles, profile), () => setEditing(null))}
        onClose={() => setEditing(null)}
      />
      <ConfirmSheet
        open={removing !== null}
        danger
        title={t("seer:admProfileDeleteTitle", { name: removing?.name || t("seer:admProfileUnnamed") })}
        body={t("seer:admProfileDeleteBody")}
        confirmLabel={t("seer:delete")}
        busy={state.saving}
        onConfirm={() => removing && void persist(config.profiles.filter((p) => p.id !== removing.id), () => setRemoving(null))}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
