/* ------------------------------------------------------------------ */
/*  Vigie — La fiche d'un compte                                        */
/* ------------------------------------------------------------------ */

/*
 * Tout ce que Vigie règle pour un compte, au même endroit : bloquer ses
 * demandes, ce qu'il peut demander, sa limite quotidienne (celle par défaut,
 * aucune, ou la sienne), et son compte Jellyseerr — relié, absent, ou supprimé
 * de l'autre côté, avec le moyen de le relier tout de suite.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminUserRow } from "../../../api/types";
import { useLinkAdminUser, useUpdateAdminUser } from "../../../hooks/useAdminUsers";
import { useToast } from "../../../hooks/useToast";
import { formatSeerError } from "../../../api/seer-client";
import { relativeTime } from "../../../utils/relative-time";
import { CTA_PRIMARY, CTA_PRIMARY_HALO, CTA_SECONDARY, CTA_SIZE_MD, CTA_SIZE_SM } from "../../../styles/cta";
import { LinkIcon } from "../../ui/icons";
import { Segmented } from "../../ui/Segmented";
import { Sheet } from "../../ui/Sheet";
import { Chip, Stepper, ToggleRow } from "../adminKit";
import { UserAvatar } from "./UserAvatar";
import { dailyLimitFor, limitModeOf, type LimitMode } from "./userFilters";

interface Draft {
  blocked: boolean;
  allowMovies: boolean;
  allowTv: boolean;
  allowAnime: boolean;
  mode: LimitMode;
  custom: number;
}

function draftOf(user: AdminUserRow): Draft {
  return {
    blocked: user.blocked,
    allowMovies: user.allowMovies,
    allowTv: user.allowTv,
    allowAnime: user.allowAnime,
    mode: limitModeOf(user.dailyLimit),
    custom: user.dailyLimit !== null && user.dailyLimit > 0 ? user.dailyLimit : 3,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-tentacle-border-subtle py-4 first:border-t-0">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-tentacle-text-tertiary">{title}</h3>
      {children}
    </section>
  );
}

export function UserEditSheet({ user, defaultLimit, onClose }: {
  user: AdminUserRow | null;
  defaultLimit: number | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("seer");
  const toast = useToast();
  const update = useUpdateAdminUser();
  const link = useLinkAdminUser();
  const [draft, setDraft] = useState<Draft | null>(user ? draftOf(user) : null);

  // Remis à zéro quand on ouvre un AUTRE compte — pas quand la liste se relit
  // (relier le compte Jellyseerr la relit) : la saisie en cours resterait perdue.
  const userId = user?.jellyfinUserId ?? null;
  useEffect(() => { setDraft(user ? draftOf(user) : null); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user || !draft) return null;

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const seen = relativeTime(user.jellyfin?.lastActivityDate, i18n.language);
  const save = () => {
    update.mutate({
      jellyfinUserId: user.jellyfinUserId,
      patch: {
        blocked: draft.blocked,
        allowMovies: draft.allowMovies,
        allowTv: draft.allowTv,
        allowAnime: draft.allowAnime,
        dailyLimit: dailyLimitFor(draft.mode, draft.custom),
        username: user.username,
      },
    }, {
      onSuccess: () => { toast.show("success", t("seer:adminUsersSaved")); onClose(); },
      onError: (err) => toast.show("error", t("seer:admActionFailed", { error: formatSeerError(err, t) })),
    });
  };

  const seerrText = user.link === "linked"
    ? t("seer:admSeerrLinkedDesc", { name: user.seerr?.name ?? `#${user.jellyseerrUserId}`, id: user.jellyseerrUserId })
    : user.link === "stale" ? t("seer:admSeerrStaleDesc") : t("seer:admSeerrUnlinkedDesc");

  return (
    <Sheet
      open
      onClose={onClose}
      title={user.username}
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>{t("seer:cancel")}</button>
          <button type="button" onClick={save} disabled={update.isPending} className={`${CTA_PRIMARY} ${CTA_SIZE_MD}`} style={CTA_PRIMARY_HALO}>
            {update.isPending ? t("seer:saving") : t("seer:save")}
          </button>
        </div>
      )}
    >
      <div className="flex items-center gap-4 pb-4">
        <UserAvatar userId={user.jellyfinUserId} name={user.username} imageTag={user.jellyfin?.imageTag} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {user.jellyfin?.isAdmin && <Chip tone="brand">{t("seer:admChipAdmin")}</Chip>}
            {user.jellyfin?.isDisabled && <Chip>{t("seer:admChipDisabled")}</Chip>}
            {user.blocked && <Chip tone="error">{t("seer:admChipBlocked")}</Chip>}
          </div>
          {seen && <p className="mt-1 text-[13px] text-tentacle-text-tertiary">{t("seer:admLastSeen", { when: seen })}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pb-4">
        {[
          [user.requestsToday, t("seer:admStatsToday")],
          [user.activeRequests, t("seer:admStatsActive")],
          [user.requestsTotal, t("seer:admStatsTotal")],
        ].map(([value, label]) => (
          <div key={String(label)} className="rounded-xl bg-tentacle-fill-faint px-3 py-2 text-center ring-1 ring-tentacle-border-subtle">
            <p className="text-lg font-bold tabular-nums text-tentacle-text-primary">{value}</p>
            <p className="text-[11px] text-tentacle-text-tertiary">{label}</p>
          </div>
        ))}
      </div>

      <Section title={t("seer:admAccessTitle")}>
        <ToggleRow label={t("seer:admBlockedToggle")} description={t("seer:admBlockedDesc")} checked={draft.blocked} onChange={(blocked) => set({ blocked })} />
      </Section>

      <Section title={t("seer:admAllowTitle")}>
        <ToggleRow label={t("seer:adminUsersAllowMovies")} checked={draft.allowMovies} onChange={(allowMovies) => set({ allowMovies })} disabled={draft.blocked} />
        <ToggleRow label={t("seer:adminUsersAllowTv")} checked={draft.allowTv} onChange={(allowTv) => set({ allowTv })} disabled={draft.blocked} />
        <ToggleRow label={t("seer:adminUsersAllowAnime")} checked={draft.allowAnime} onChange={(allowAnime) => set({ allowAnime })} disabled={draft.blocked} />
      </Section>

      <Section title={t("seer:admLimitTitle")}>
        <Segmented
          value={draft.mode}
          onChange={(mode) => set({ mode })}
          ariaLabel={t("seer:admLimitTitle")}
          size="sm"
          stretch="always"
          className="mt-2"
          options={[
            { value: "default", label: defaultLimit ? t("seer:admLimitDefault", { value: defaultLimit }) : t("seer:admLimitDefaultNone") },
            { value: "unlimited", label: t("seer:admLimitUnlimited") },
            { value: "custom", label: t("seer:admLimitCustom") },
          ]}
        />
        {draft.mode === "custom" && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <label htmlFor="vigie-user-limit" className="text-sm text-tentacle-text-secondary">{t("seer:admLimitValue")}</label>
            <Stepper id="vigie-user-limit" value={draft.custom} min={1} onChange={(custom) => set({ custom })}
              decreaseLabel={t("seer:admDecrease")} increaseLabel={t("seer:admIncrease")} />
          </div>
        )}
      </Section>

      <Section title={t("seer:admSeerrTitle")}>
        <p className={`mt-1 text-sm leading-relaxed ${user.link === "stale" ? "text-tentacle-status-warning-fg" : "text-tentacle-text-secondary"}`}>
          {seerrText}
        </p>
        {user.link !== "linked" && (
          <button
            type="button"
            disabled={link.isPending}
            onClick={() => link.mutate(user.jellyfinUserId, {
              onSuccess: () => toast.show("success", t("seer:admLinkDone")),
              onError: (err) => toast.show("error", t("seer:admActionFailed", { error: formatSeerError(err, t) })),
            })}
            className={`${CTA_SECONDARY} ${CTA_SIZE_SM} mt-3 gap-2`}
          >
            <LinkIcon className="h-4 w-4" />
            {link.isPending ? "…" : t("seer:admLinkNow")}
          </button>
        )}
      </Section>
    </Sheet>
  );
}
