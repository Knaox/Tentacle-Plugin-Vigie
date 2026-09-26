/* ------------------------------------------------------------------ */
/*  Vigie — Onglet « Utilisateurs » de l'administration                 */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAdminUsers } from "../../../hooks/useAdminUsers";
import { formatSeerError } from "../../../api/seer-client";
import { CTA_SECONDARY, CTA_SIZE_MD } from "../../../styles/cta";
import { Card } from "../adminKit";
import { AttentionPanel } from "./AttentionPanel";
import { SyncCard } from "./SyncCard";
import { UserEditSheet } from "./UserEditSheet";
import { UserList } from "./UserList";

export function UsersTab() {
  const { t } = useTranslation("seer");
  const { data, isLoading, error, refetch } = useAdminUsers();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!data && isLoading) {
    return (
      <div className="space-y-5" aria-busy>
        {[176, 320].map((h) => (
          <div key={h} style={{ height: h }} className="animate-pulse rounded-2xl bg-tentacle-fill-subtle ring-1 ring-tentacle-border-subtle" />
        ))}
      </div>
    );
  }
  if (!data) {
    return (
      <Card title={t("seer:admLoadError")} description={formatSeerError(error, t)}>
        <button type="button" onClick={() => void refetch()} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>
          {t("seer:admRetry")}
        </button>
      </Card>
    );
  }

  // La fiche lit le compte dans la liste FRAÎCHE : relié à Jellyseerr depuis la
  // fiche, il s'y montre relié sans qu'on la ferme.
  const open = openId ? data.users.find((u) => u.jellyfinUserId === openId) ?? null : null;

  return (
    <div className="space-y-5">
      <SyncCard overview={data} />
      <AttentionPanel overview={data} />
      <UserList users={data.users} defaultLimit={data.defaults.dailyLimit} onOpen={(u) => setOpenId(u.jellyfinUserId)} />
      <UserEditSheet user={open} defaultLimit={data.defaults.dailyLimit} onClose={() => setOpenId(null)} />
    </div>
  );
}
