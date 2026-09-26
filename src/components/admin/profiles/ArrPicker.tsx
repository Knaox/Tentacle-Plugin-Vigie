/* ------------------------------------------------------------------ */
/*  Vigie — Choisir serveur, qualité et dossier (Radarr ou Sonarr)      */
/* ------------------------------------------------------------------ */

import { useTranslation } from "react-i18next";
import type { ArrServerInfo } from "../../../api/types";
import { INPUT_BASE } from "../../../styles/cta";
import { FieldLabel } from "../adminKit";

interface Value {
  serverId?: number;
  profileId?: number;
  rootFolder?: string;
}

const SELECT = `${INPUT_BASE} appearance-none bg-[var(--surface-2)] pr-9`;

export function ArrPicker({ kind, servers, value, onChange }: {
  kind: "radarr" | "sonarr";
  servers: readonly ArrServerInfo[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  const { t } = useTranslation("seer");
  const id = `vigie-${kind}`;
  if (servers.length === 0) {
    return <p className="text-[13px] text-tentacle-text-tertiary">{t(kind === "radarr" ? "seer:admProfileNoRadarr" : "seer:admProfileNoSonarr")}</p>;
  }
  const server = servers.find((s) => s.id === value.serverId) ?? servers.find((s) => s.isDefault) ?? servers[0];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {servers.length > 1 && (
        <div className="sm:col-span-2">
          <FieldLabel htmlFor={`${id}-server`}>{t("seer:admProfileServer")}</FieldLabel>
          <select
            id={`${id}-server`}
            value={value.serverId ?? ""}
            onChange={(e) => onChange({ serverId: e.target.value ? Number(e.target.value) : undefined })}
            className={SELECT}
          >
            <option value="">{t("seer:admProfileServerDefault")}</option>
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <FieldLabel htmlFor={`${id}-quality`}>{t("seer:admProfileQuality")}</FieldLabel>
        <select
          id={`${id}-quality`}
          value={value.profileId ?? ""}
          onChange={(e) => onChange({ ...value, profileId: e.target.value ? Number(e.target.value) : undefined })}
          className={SELECT}
        >
          <option value="">{t("seer:admProfileQualityDefault")}</option>
          {server.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-folder`}>{t("seer:admProfileFolder")}</FieldLabel>
        <select
          id={`${id}-folder`}
          value={value.rootFolder ?? ""}
          onChange={(e) => onChange({ ...value, rootFolder: e.target.value || undefined })}
          disabled={server.rootFolders.length === 0}
          className={SELECT}
        >
          <option value="">{t("seer:admProfileFolderDefault")}</option>
          {server.rootFolders.map((f) => <option key={f.id} value={f.path}>{f.path}</option>)}
        </select>
      </div>
    </div>
  );
}
