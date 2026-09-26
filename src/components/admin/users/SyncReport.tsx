/* ------------------------------------------------------------------ */
/*  Vigie — Ce que la dernière synchro a fait                           */
/* ------------------------------------------------------------------ */

/*
 * L'ancien bouton ne laissait qu'un toast : « 2 nouveau(x), 5 synchronisé(s),
 * 0 lien(s) cassé(s) nettoyé(s)… », sans un nom. Chaque correction est
 * listée ici, nommément, et chaque échec avec sa raison.
 */

import { useTranslation } from "react-i18next";
import type { UserSyncReport } from "../../../api/types";

function Group({ title, names, tone = "muted" }: { title: string; names: string[]; tone?: "muted" | "error" }) {
  if (names.length === 0) return null;
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide ${tone === "error" ? "text-tentacle-status-error-fg" : "text-tentacle-text-tertiary"}`}>
        {title} · {names.length}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-tentacle-text-secondary">{names.join(", ")}</p>
    </div>
  );
}

export function SyncReport({ report }: { report: UserSyncReport }) {
  const { t } = useTranslation("seer");
  const groups = [
    { title: t("seer:admReportCreated"), names: report.created },
    { title: t("seer:admReportRenamed"), names: report.renamed.map((r) => `${r.from} → ${r.to}`) },
    { title: t("seer:admReportLinked"), names: report.linked },
    { title: t("seer:admReportAdopted"), names: report.adopted ?? [] },
    { title: t("seer:admReportUnlinked"), names: report.unlinked },
    { title: t("seer:admReportRemoved"), names: report.removed },
    { title: t("seer:admReportImported"), names: report.imported },
  ];
  const nothing = groups.every((g) => g.names.length === 0) && report.failures.length === 0;

  return (
    <details className="group rounded-xl bg-tentacle-fill-faint ring-1 ring-tentacle-border-subtle">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-tentacle-text-secondary [&::-webkit-details-marker]:hidden">
        {t("seer:admReportTitle")}
        <span className="text-xs text-tentacle-text-quaternary">
          {t("seer:admReportDuration", { seconds: (report.durationMs / 1000).toFixed(1) })}
          <span aria-hidden className="ml-2 inline-block transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-tentacle-border-subtle px-4 py-3">
        {nothing && <p className="text-sm text-tentacle-text-tertiary">{t("seer:admReportNothing")}</p>}
        {groups.map((g) => <Group key={g.title} title={g.title} names={g.names} />)}
        <Group
          title={t("seer:admReportFailures")}
          names={report.failures.map((f) => `${f.username} (${f.reason})`)}
          tone="error"
        />
      </div>
    </details>
  );
}
