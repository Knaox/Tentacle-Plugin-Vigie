/* ------------------------------------------------------------------ */
/*  Vigie — Page d'administration                                       */
/* ------------------------------------------------------------------ */

/*
 * Trois onglets — Réglages, Utilisateurs, Profils de qualité — sous un
 * en-tête qui dit ce qu'est l'extension et si elle est branchée. Rien à
 * « enregistrer » en bas de page : chaque réglage s'enregistre dès qu'on le
 * touche, ou depuis la fenêtre qui l'édite.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CTA_SECONDARY, CTA_SIZE_MD } from "../../styles/cta";
import { LayersIcon, SlidersIcon, UsersIcon } from "../ui/icons";
import { Segmented } from "../ui/Segmented";
import { AdminHeader } from "./AdminHeader";
import { Card } from "./adminKit";
import { ProfilesTab } from "./profiles/ProfilesTab";
import { SettingsTab } from "./SettingsTab";
import { useSeerAdminConfig } from "./useSeerAdminConfig";
import { UsersTab } from "./users/UsersTab";

type Tab = "settings" | "users" | "profiles";

export function SeerConfigPage() {
  const { t } = useTranslation("seer");
  const state = useSeerAdminConfig();
  const [tab, setTab] = useState<Tab>("settings");

  if (state.loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card title={t("seer:admLoadError")}>
          <button type="button" onClick={() => void state.reload()} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>
            {t("seer:admRetry")}
          </button>
        </Card>
      </div>
    );
  }
  if (!state.config) {
    return <div className="mx-auto h-64 max-w-4xl animate-pulse rounded-3xl bg-tentacle-fill-subtle" aria-busy />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <AdminHeader state={state} />
      <Segmented
        value={tab}
        onChange={setTab}
        ariaLabel={t("seer:admTabsLabel")}
        stretch="mobile"
        size="adaptive"
        options={[
          { value: "settings", label: t("seer:admTabSettings"), icon: <SlidersIcon className="h-4 w-4" /> },
          { value: "users", label: t("seer:admTabUsers"), icon: <UsersIcon className="h-4 w-4" /> },
          { value: "profiles", label: t("seer:admTabProfiles"), short: t("seer:admTabProfilesShort"), icon: <LayersIcon className="h-4 w-4" /> },
        ]}
      />
      {tab === "settings" && <SettingsTab state={state} />}
      {tab === "users" && <UsersTab />}
      {tab === "profiles" && <ProfilesTab state={state} />}
    </div>
  );
}
