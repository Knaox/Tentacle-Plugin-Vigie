/* ------------------------------------------------------------------ */
/*  Vigie — Fenêtre « Connexion à Jellyseerr »                          */
/* ------------------------------------------------------------------ */

/*
 * L'adresse, la clé, et le verdict du test à côté des champs : connecté à
 * quelle version, clé refusée, adresse muette — puis Sonarr et Radarr, qui
 * annoncent désormais les arrivées. Le test porte sur ce qui est SAISI, pas
 * sur ce qui est enregistré (cf. routes-connection.ts côté serveur) ; une clé
 * retouchée après un test réussi n'est plus donnée pour vérifiée.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import { CTA_PRIMARY, CTA_PRIMARY_HALO, CTA_SECONDARY, CTA_SIZE_MD, INPUT_BASE } from "../../styles/cta";
import { EyeIcon, EyeOffIcon } from "../ui/icons";
import { Sheet } from "../ui/Sheet";
import { Chip, FieldLabel, Hint } from "./adminKit";
import { testConnection, verdictKey, type ArrProbe, type ConnectionTest } from "./connectionTest";
import type { SeerAdminState } from "./useSeerAdminConfig";

const ARR_TONE: Record<ArrProbe, "success" | "neutral" | "error"> = { ok: "success", missing: "neutral", unreachable: "error" };
const ARR_TEXT: Record<ArrProbe, string> = { ok: "seer:admArrOk", missing: "seer:admArrMissing", unreachable: "seer:admArrUnreachable" };

export function ArrChips({ test }: { test: ConnectionTest }) {
  const { t } = useTranslation("seer");
  if (!test.ok || !test.arr) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {(["sonarr", "radarr"] as const).map((kind) => (
        <Chip key={kind} tone={ARR_TONE[test.arr![kind]]} dot>
          {t(ARR_TEXT[test.arr![kind]], { name: kind === "sonarr" ? "Sonarr" : "Radarr" })}
        </Chip>
      ))}
    </div>
  );
}

export function ConnectionSheet({ open, onClose, state }: { open: boolean; onClose: () => void; state: SeerAdminState }) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const saved = state.config;
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<{ running: boolean; result: ConnectionTest | null; subject: string | null }>(
    { running: false, result: null, subject: null },
  );

  // À chaque ouverture : la connexion enregistrée, et son dernier verdict.
  useEffect(() => {
    if (!open || !saved) return;
    setUrl(saved.url);
    setApiKey(saved.apiKey);
    setShowKey(false);
    setTest({ running: false, result: state.health.result, subject: `${saved.url}\n${saved.apiKey}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!saved) return null;
  const subject = `${url.trim()}\n${apiKey.trim()}`;
  const result = test.subject === subject ? test.result : null;
  const changed = url.trim() !== saved.url || apiKey.trim() !== saved.apiKey;

  const run = async () => {
    setTest((s) => ({ ...s, running: true }));
    setTest({ running: false, result: await testConnection(url.trim(), apiKey.trim()), subject });
  };
  const save = async () => {
    const ok = await state.save({ url: url.trim(), apiKey: apiKey.trim() });
    toast.show(ok ? "success" : "error", t(ok ? "seer:admSaved" : "seer:configSaveError"));
    if (ok) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("seer:admConnectionTitle")}
      footer={(
        <div className="flex flex-wrap items-center justify-end gap-2">
          {changed && !result?.ok && (
            <p className="mr-auto text-[13px] text-tentacle-status-warning-fg">{t("seer:admTestUntested")}</p>
          )}
          <button type="button" onClick={onClose} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>{t("seer:cancel")}</button>
          <button type="button" onClick={() => void save()} disabled={!changed || state.saving} className={`${CTA_PRIMARY} ${CTA_SIZE_MD}`} style={CTA_PRIMARY_HALO}>
            {state.saving ? t("seer:saving") : t("seer:save")}
          </button>
        </div>
      )}
    >
      <p className="text-sm leading-relaxed text-tentacle-text-tertiary">{t("seer:admConnectionDesc")}</p>

      <div className="mt-5 space-y-4">
        <div>
          <FieldLabel htmlFor="vigie-url">{t("seer:urlLabel")}</FieldLabel>
          <div className="flex gap-2">
            <input
              id="vigie-url" type="url" inputMode="url" autoComplete="off" spellCheck={false}
              value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("seer:urlPlaceholder")}
              className={`${INPUT_BASE} min-w-0 flex-1`}
            />
            <button type="button" onClick={() => void run()} disabled={!url.trim() || test.running} className={`${CTA_SECONDARY} ${CTA_SIZE_MD} h-11 shrink-0`}>
              {test.running ? t("seer:statusTesting") : t("seer:testButton")}
            </button>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="vigie-key">{t("seer:apiKeyLabel")}</FieldLabel>
          <div className="relative">
            <input
              id="vigie-key" type={showKey ? "text" : "password"} autoComplete="off" spellCheck={false}
              value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={t("seer:apiKeyPlaceholder")}
              className={`${INPUT_BASE} pr-12 font-mono`}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? t("seer:admHideKey") : t("seer:admShowKey")}
              aria-pressed={showKey}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary"
            >
              {showKey ? <EyeOffIcon className="h-[18px] w-[18px]" /> : <EyeIcon className="h-[18px] w-[18px]" />}
            </button>
          </div>
          {result && (
            <Hint tone={result.ok ? "success" : "error"}>{t(verdictKey(result), { version: result.version })}</Hint>
          )}
        </div>

        {result?.ok && result.arr && (
          <div className="rounded-xl bg-tentacle-fill-faint px-4 py-3 ring-1 ring-tentacle-border-subtle">
            <ArrChips test={result} />
            <p className="mt-2 text-[13px] leading-relaxed text-tentacle-text-tertiary">{t("seer:admArrHint")}</p>
          </div>
        )}

        {/* Non-affiliation — au plus près du champ où l'on colle l'adresse de SON Jellyseerr. */}
        <p className="text-xs leading-relaxed text-tentacle-text-quaternary">
          {t("seer:notAffiliated")}{" "}
          <a href="https://github.com/fallenbagel/jellyseerr" target="_blank" rel="noreferrer noopener" className="text-[var(--brand-light)] underline underline-offset-2">
            {t("seer:notAffiliatedLink")}
          </a>
        </p>
      </div>
    </Sheet>
  );
}
