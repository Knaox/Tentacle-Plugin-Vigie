/* ------------------------------------------------------------------ */
/*  Vigie — En-tête de l'administration : qui, et est-ce branché        */
/* ------------------------------------------------------------------ */

import { useTranslation } from "react-i18next";
import { DEFAULT_NAV_LABEL, labelFor } from "../../utils/nav-labels";
import { CompassIcon } from "../ui/icons";
import { Chip } from "./adminKit";
import type { SeerAdminState } from "./useSeerAdminConfig";

export function AdminHeader({ state }: { state: SeerAdminState }) {
  const { t, i18n } = useTranslation("seer");
  const { config, health } = state;
  const configured = !!config?.url && !!config?.apiKey;
  const tabLabel = config ? labelFor(config.navLabels, i18n.language) : DEFAULT_NAV_LABEL;

  let status;
  if (!configured) status = <Chip dot>{t("seer:statusNotConfigured")}</Chip>;
  else if (health.running && !health.result) status = <Chip dot>{t("seer:statusTesting")}</Chip>;
  else if (health.result?.ok) status = <Chip tone="success" dot>{t("seer:statusConnected")}</Chip>;
  else if (health.result) status = <Chip tone="error" dot>{t("seer:statusError")}</Chip>;

  return (
    <header className="relative overflow-hidden rounded-3xl p-5 ring-1 ring-tentacle-border-subtle sm:p-6">
      {/* Halo de marque, fixe — rien ne s'anime (règle GPU du projet). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(80% 140% at 0% 0%, rgba(var(--brand-rgb),0.22), transparent 60%), var(--fill-subtle)" }}
      />
      <div className="relative flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-tentacle-on-media-primary shadow-[var(--elev-1)]"
          style={{ background: "linear-gradient(135deg, var(--brand-dark), var(--brand))" }}
        >
          <CompassIcon className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-tentacle-text-primary">Vigie</h1>
          <p className="mt-0.5 text-sm text-tentacle-text-tertiary">
            {t("seer:admSubtitle")}
            {tabLabel !== DEFAULT_NAV_LABEL && (
              <span className="text-tentacle-text-secondary"> · {t("seer:admTabShownAs", { label: tabLabel })}</span>
            )}
          </p>
        </div>
        {status}
      </div>
    </header>
  );
}
