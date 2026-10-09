/* ------------------------------------------------------------------ */
/*  Vigie — Onglet « Réglages » de l'administration                     */
/* ------------------------------------------------------------------ */

/*
 * Trois groupes : la connexion (Jellyseerr, Sonarr, Radarr — l'état de
 * chacun d'un coup d'œil), Vigie dans Tentacle (l'onglet, son nom), les
 * demandes (auto-approbation, limite par défaut). Un interrupteur ou un
 * compteur s'enregistre de lui-même ; la connexion et le nom de l'onglet
 * s'éditent dans leur fenêtre.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import { labelFor } from "../../utils/nav-labels";
import { AlertIcon, CheckIcon, ClockIcon, CompassIcon, EyeIcon, EyeOffIcon, FilmIcon, LinkIcon, TrashIcon, TvIcon, UsersIcon } from "../ui/icons";
import { useSpecialSeasons } from "../../hooks/useIsAdmin";
import { Chip, Stepper, Switch } from "./adminKit";
import { Group, NavLabelPill, Row } from "./adminRows";
import type { ArrProbe } from "./connectionTest";
import { ConnectionSheet } from "./ConnectionSheet";
import { LabelSheet } from "./LabelSheet";
import type { SeerAdminConfig, SeerAdminState } from "./useSeerAdminConfig";

const LIMIT_SAVE_DELAY_MS = 700;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function SettingsTab({ state }: { state: SeerAdminState }) {
  const { t, i18n } = useTranslation("seer");
  const toast = useToast();
  const specialSeasons = useSpecialSeasons();
  const config = state.config as SeerAdminConfig;
  const [sheet, setSheet] = useState<"connection" | "label" | null>(null);
  const [limit, setLimit] = useState(config.userLimit);

  const commit = async (patch: Partial<SeerAdminConfig>) => {
    const ok = await state.save(patch);
    toast.show(ok ? "success" : "error", t(ok ? "seer:admSaved" : "seer:configSaveError"));
  };

  // Le compteur s'enregistre quand on a fini de cliquer, pas à chaque clic.
  useEffect(() => { setLimit(config.userLimit); }, [config.userLimit]);
  useEffect(() => {
    if (limit === config.userLimit) return;
    const id = setTimeout(() => void commit({ userLimit: limit }), LIMIT_SAVE_DELAY_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const health = state.health.result;
  const configured = config.url !== "" && config.apiKey !== "";
  let jellyseerr;
  if (!configured) jellyseerr = <Chip dot>{t("seer:statusNotConfigured")}</Chip>;
  else if (state.health.running && !health) jellyseerr = <Chip dot>{t("seer:statusTesting")}</Chip>;
  else if (health?.ok) jellyseerr = <Chip tone="success" dot>{health.version ? t("seer:admVersion", { version: health.version }) : t("seer:statusConnected")}</Chip>;
  else if (health) jellyseerr = <Chip tone="error" dot>{t("seer:statusError")}</Chip>;

  const arrChip = (kind: "sonarr" | "radarr") => {
    const probe: ArrProbe | undefined = health?.ok ? health.arr?.[kind] : undefined;
    if (!probe) return <Chip>{t("seer:admArrUnknown")}</Chip>;
    const tone = probe === "ok" ? "success" : probe === "missing" ? "neutral" : "error";
    return <Chip tone={tone} dot>{t(`seer:admArrShort_${probe}`)}</Chip>;
  };

  const jellyfin = health?.ok ? health.jellyfin : undefined;
  const jellyfinChip = !jellyfin
    ? <Chip>{t("seer:admArrUnknown")}</Chip>
    : <Chip tone={jellyfin === "ok" ? "success" : "error"} dot>{t(jellyfin === "ok" ? "seer:admArrShort_ok" : "seer:admArrShort_unreachable")}</Chip>;

  const labels = config.navLabels;
  return (
    <div className="space-y-7">
      <Group title={t("seer:admGroupConnection")} caption={t("seer:admArrHint")}>
        <Row
          icon={<LinkIcon className="h-[18px] w-[18px]" />}
          title="Jellyseerr"
          description={configured ? hostOf(config.url) : t("seer:admConnectionNotSet")}
          trailing={jellyseerr}
          onClick={() => setSheet("connection")}
          ariaLabel={t("seer:admConnectionTitle")}
        />
        <Row icon={<TvIcon className="h-[18px] w-[18px]" />} title="Sonarr" description={t("seer:admSonarrRole")} trailing={arrChip("sonarr")} />
        <Row icon={<FilmIcon className="h-[18px] w-[18px]" />} title="Radarr" description={t("seer:admRadarrRole")} trailing={arrChip("radarr")} />
        <Row icon={<UsersIcon className="h-[18px] w-[18px]" />} title={t("seer:admJellyfinFromSeerr")} description={t("seer:admJellyfinRole")} trailing={jellyfinChip} />
      </Group>
      {jellyfin === "unreachable" && (
        <p className="-mt-4 flex gap-2 rounded-2xl bg-tentacle-status-warning-bg px-4 py-3 text-[13px] leading-relaxed text-tentacle-status-warning-fg">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {t("seer:admJellyfinBroken")}
        </p>
      )}

      <Group title={t("seer:admDisplayTitle")}>
        <Row
          icon={<EyeIcon className="h-[18px] w-[18px]" />}
          title={t("seer:toggleEnabled")}
          description={t("seer:toggleEnabledDesc")}
          trailing={<Switch checked={config.enabled} label={t("seer:toggleEnabled")} disabled={state.saving} onChange={(enabled) => void commit({ enabled })} />}
        />
        <Row
          icon={<CompassIcon className="h-[18px] w-[18px]" />}
          title={t("seer:admNavLabel")}
          description={t("seer:admNavLabelSummary", { fr: labelFor(labels, "fr"), en: labelFor(labels, "en") })}
          trailing={<span className="hidden sm:inline-flex"><NavLabelPill label={labelFor(labels, i18n.language)} size="sm" /></span>}
          onClick={() => setSheet("label")}
          ariaLabel={t("seer:admNavLabel")}
        />
      </Group>

      <Group title={t("seer:admRequestsTitle")}>
        <Row
          icon={<CheckIcon className="h-[18px] w-[18px]" />}
          title={t("seer:toggleAutoApprove")}
          description={t("seer:toggleAutoApproveDesc")}
          trailing={<Switch checked={config.autoApprove} label={t("seer:toggleAutoApprove")} disabled={state.saving} onChange={(autoApprove) => void commit({ autoApprove })} />}
        />
        <Row
          icon={<EyeOffIcon className="h-[18px] w-[18px]" />}
          title={t("seer:toggleMaskedRequests")}
          description={t("seer:toggleMaskedRequestsDesc")}
          trailing={<Switch checked={config.allowMaskedRequests} label={t("seer:toggleMaskedRequests")} disabled={state.saving} onChange={(allowMaskedRequests) => void commit({ allowMaskedRequests })} />}
        />
        <Row
          icon={<TrashIcon className="h-[18px] w-[18px]" />}
          title={t("seer:toggleDeleteWithMedia")}
          description={t("seer:toggleDeleteWithMediaDesc")}
          trailing={<Switch checked={config.deleteRequestsWithMedia} label={t("seer:toggleDeleteWithMedia")} disabled={state.saving} onChange={(deleteRequestsWithMedia) => void commit({ deleteRequestsWithMedia })} />}
        />
        {/* Réglé dans Jellyseerr, pas ici : on dit seulement ce qu'il en est. */}
        <Row
          icon={<TvIcon className="h-[18px] w-[18px]" />}
          title={t("seer:admSpecialSeasons")}
          description={t("seer:admSpecialSeasonsDesc")}
          trailing={<Chip tone={specialSeasons ? "success" : "neutral"} dot>{t(specialSeasons ? "seer:admSpecialSeasonsOn" : "seer:admSpecialSeasonsOff")}</Chip>}
        />
        <Row
          icon={<ClockIcon className="h-[18px] w-[18px]" />}
          title={t("seer:admDefaultLimit")}
          description={t("seer:admDefaultLimitHint")}
          trailing={(
            <Stepper
              value={limit}
              onChange={setLimit}
              decreaseLabel={t("seer:admDecrease")}
              increaseLabel={t("seer:admIncrease")}
            />
          )}
        />
      </Group>

      <ConnectionSheet open={sheet === "connection"} onClose={() => setSheet(null)} state={state} />
      <LabelSheet open={sheet === "label"} onClose={() => setSheet(null)} state={state} />
    </div>
  );
}
