/* ------------------------------------------------------------------ */
/*  Vigie — La synchro des comptes, d'un coup d'œil                     */
/* ------------------------------------------------------------------ */

/*
 * Quand a-t-elle tourné, qu'attend-elle, qu'a-t-elle fait — et les deux
 * gestes qui restent à l'administrateur : la lancer maintenant, et créer
 * dans Jellyseerr les comptes qui n'y sont pas encore (sinon créés à leur
 * première demande). La réattribution des demandes reste un outil à part.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { UsersOverview } from "../../../api/types";
import { useSyncAdminUsers, useSyncRequestsOwnership } from "../../../hooks/useAdminUsers";
import { useToast } from "../../../hooks/useToast";
import { formatSeerError } from "../../../api/seer-client";
import { relativeTime } from "../../../utils/relative-time";
import { CTA_PRIMARY, CTA_PRIMARY_HALO, CTA_SECONDARY, CTA_SIZE_MD, CTA_SIZE_SM } from "../../../styles/cta";
import { RetryIcon } from "../../ui/icons";
import { Card, Chip, Stat } from "../adminKit";
import { ConfirmSheet } from "../ConfirmSheet";
import { SyncReport } from "./SyncReport";

export function SyncCard({ overview }: { overview: UsersOverview }) {
  const { t, i18n } = useTranslation("seer");
  const toast = useToast();
  const sync = useSyncAdminUsers();
  const reassign = useSyncRequestsOwnership();
  const [confirmImport, setConfirmImport] = useState(false);
  const { sync: state, attention, users } = overview;
  const running = state.running || sync.isPending;
  const missing = attention.missingSeerr;
  const toReview = attention.gone.length + attention.orphanSeerr.length;

  const launch = (importMissing: boolean) => {
    sync.mutate(importMissing, {
      onSuccess: (report) => {
        setConfirmImport(false);
        const fixes = report.created.length + report.renamed.length + report.linked.length
          + (report.adopted?.length ?? 0) + report.unlinked.length + report.removed.length;
        if (report.failures.length > 0) toast.show("error", t("seer:admSyncDoneFailures", { count: report.failures.length }));
        else if (report.imported.length > 0) toast.show("success", t("seer:admImportDone", { count: report.imported.length }));
        else if (fixes > 0) toast.show("success", t("seer:admSyncDone", { count: fixes }));
        else toast.show("success", t("seer:admSyncDoneNothing"));
      },
      onError: (err) => toast.show("error", `${t("seer:admSyncFailed")} — ${formatSeerError(err, t)}`),
    });
  };

  const when = relativeTime(state.last?.at, i18n.language);
  const lastLine = state.last && when
    ? t(state.last.trigger === "auto" ? "seer:admSyncLastAuto" : "seer:admSyncLastManual", { when })
    : t("seer:admSyncNever");

  return (
    <Card
      title={t("seer:admSyncTitle")}
      description={t("seer:admSyncDesc")}
      action={(
        <button type="button" onClick={() => launch(false)} disabled={running} className={`${CTA_PRIMARY} ${CTA_SIZE_MD} gap-2`} style={CTA_PRIMARY_HALO}>
          <RetryIcon className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running ? t("seer:admSyncRunning") : t("seer:admSyncNow")}
        </button>
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-tentacle-text-tertiary">
        <span>{lastLine}</span>
        <span aria-hidden>·</span>
        <span>{t("seer:admSyncEvery", { minutes: state.autoEveryMinutes })}</span>
        {state.pending > 0
          ? <Chip tone="warning" dot>{t("seer:admSyncPending", { count: state.pending })}</Chip>
          : !state.jellyfinError && <Chip tone="success" dot>{t("seer:admSyncUpToDate")}</Chip>}
      </div>

      {(state.jellyfinError || state.seerrError) && (
        <div className="mt-3 space-y-1 rounded-xl bg-tentacle-status-warning-bg px-4 py-3 text-[13px] leading-relaxed text-tentacle-status-warning-fg">
          {state.jellyfinError && <p>{t("seer:admJellyfinError", { error: state.jellyfinError })}</p>}
          {state.seerrError && <p>{t("seer:admSeerrError", { error: state.seerrError })}</p>}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value={users.filter((u) => u.jellyfin !== null).length} label={t("seer:admStatAccounts")} />
        <Stat value={users.filter((u) => u.link === "linked").length} label={t("seer:admStatLinked")} />
        <Stat value={missing.length} label={t("seer:admStatMissing")} />
        <Stat value={toReview} label={t("seer:admStatAttention")} tone="warning" />
      </div>

      {missing.length > 0 && !state.seerrError && (
        <button type="button" onClick={() => setConfirmImport(true)} disabled={running} className={`${CTA_SECONDARY} ${CTA_SIZE_MD} mt-4`}>
          {t("seer:admImportMissing", { count: missing.length })}
        </button>
      )}

      <div className="mt-4 space-y-3">
        {state.last && <SyncReport report={state.last} />}
        <details className="group rounded-xl bg-tentacle-fill-faint ring-1 ring-tentacle-border-subtle">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-tentacle-text-secondary [&::-webkit-details-marker]:hidden">
            {t("seer:admAdvanced")} · {t("seer:adminReassignButton")}
            <span aria-hidden className="text-xs text-tentacle-text-quaternary transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="border-t border-tentacle-border-subtle px-4 py-3">
            <p className="text-[13px] leading-relaxed text-tentacle-text-tertiary">{t("seer:adminReassignHint")}</p>
            <button
              type="button"
              disabled={reassign.isPending || !!state.seerrError}
              onClick={() => reassign.mutate(undefined, {
                onSuccess: (r) => toast.show("success", t("seer:adminReassignDone", {
                  reassigned: r.reassigned, recreated: r.recreated, alreadyOk: r.alreadyOk,
                  orphansCreated: r.orphansCreated, failed: r.failed,
                })),
                onError: (err) => toast.show("error", formatSeerError(err, t)),
              })}
              className={`${CTA_SECONDARY} ${CTA_SIZE_SM} mt-3`}
            >
              {reassign.isPending ? "…" : t("seer:adminReassignButton")}
            </button>
          </div>
        </details>
      </div>

      <ConfirmSheet
        open={confirmImport}
        title={t("seer:admImportConfirmTitle")}
        body={t("seer:admImportConfirmBody")}
        confirmLabel={t("seer:admImportMissing", { count: missing.length })}
        busy={sync.isPending}
        onConfirm={() => launch(true)}
        onClose={() => setConfirmImport(false)}
      >
        <p className="text-sm leading-relaxed text-tentacle-text-tertiary">{missing.map((m) => m.username).join(", ")}</p>
      </ConfirmSheet>
    </Card>
  );
}
