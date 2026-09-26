/* ------------------------------------------------------------------ */
/*  Vigie — La liste des comptes                                        */
/* ------------------------------------------------------------------ */

/*
 * Chaque compte sur une ligne lisible : sa photo, son nom, ce qui le
 * distingue (admin, désactivé, bloqué), son lien Jellyseerr, ses demandes du
 * jour. Toute la ligne ouvre sa fiche — les cases à cocher alignées en
 * ligne, qu'on ne savait pas enregistrer, sont parties dans cette fiche.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminUserRow } from "../../../api/types";
import { relativeTime } from "../../../utils/relative-time";
import { INPUT_BASE } from "../../../styles/cta";
import { ChevronRight, SearchIcon } from "../../ui/icons";
import { Segmented } from "../../ui/Segmented";
import { Card, Chip } from "../adminKit";
import { UserAvatar } from "./UserAvatar";
import { effectiveLimit, filterCounts, filterUsers, USER_FILTERS, type UserFilter } from "./userFilters";

const FILTER_LABEL: Record<UserFilter, [string, string?]> = {
  all: ["seer:admFilterAll"],
  linked: ["seer:admFilterLinked"],
  unlinked: ["seer:admFilterUnlinked", "seer:admFilterUnlinkedShort"],
  blocked: ["seer:admFilterBlocked"],
};

export function UserList({ users, defaultLimit, onOpen }: {
  users: AdminUserRow[];
  defaultLimit: number | null;
  onOpen: (user: AdminUserRow) => void;
}) {
  const { t } = useTranslation("seer");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => filterCounts(users), [users]);
  const shown = useMemo(() => filterUsers(users, filter, query), [users, filter, query]);

  return (
    <Card title={t("seer:admTabUsers")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-64">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tentacle-text-quaternary" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("seer:admUsersSearch")}
            aria-label={t("seer:admUsersSearch")}
            className={`${INPUT_BASE} pl-9`}
          />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          ariaLabel={t("seer:admTabUsers")}
          size="sm"
          stretch="mobile"
          options={USER_FILTERS.map((f) => ({
            value: f,
            label: `${t(FILTER_LABEL[f][0])} · ${counts[f]}`,
            short: FILTER_LABEL[f][1] ? `${t(FILTER_LABEL[f][1]!)} · ${counts[f]}` : undefined,
          }))}
        />
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-tentacle-text-tertiary">
          {users.length === 0 ? t("seer:admUsersEmpty") : t("seer:admUsersNone")}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-tentacle-border-subtle">
          {shown.map((user) => (
            <li key={user.jellyfinUserId}>
              <UserRow user={user} defaultLimit={defaultLimit} onOpen={() => onOpen(user)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function UserRow({ user, defaultLimit, onOpen }: { user: AdminUserRow; defaultLimit: number | null; onOpen: () => void }) {
  const { t, i18n } = useTranslation("seer");
  const limit = effectiveLimit(user.dailyLimit, defaultLimit);
  const seen = relativeTime(user.jellyfin?.lastActivityDate, i18n.language);
  const link = user.link === "linked"
    ? t("seer:admLinkLinked", { name: user.seerr?.name ?? `#${user.jellyseerrUserId}` })
    : user.link === "stale" ? t("seer:admLinkStale") : t("seer:admLinkUnlinked");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("seer:admEdit", { name: user.username })}
      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-tentacle-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
    >
      <UserAvatar userId={user.jellyfinUserId} name={user.username} imageTag={user.jellyfin?.imageTag} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-tentacle-text-primary">{user.username}</span>
          {user.jellyfin?.isAdmin && <Chip tone="brand">{t("seer:admChipAdmin")}</Chip>}
          {user.jellyfin?.isDisabled && <Chip>{t("seer:admChipDisabled")}</Chip>}
          {user.blocked && <Chip tone="error">{t("seer:admChipBlocked")}</Chip>}
        </p>
        <p className={`mt-0.5 truncate text-[13px] ${user.link === "stale" ? "text-tentacle-status-warning-fg" : "text-tentacle-text-tertiary"}`}>
          {link}
          {seen && <span className="text-tentacle-text-quaternary"> · {t("seer:admLastSeen", { when: seen })}</span>}
        </p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-[13px] font-medium tabular-nums text-tentacle-text-secondary">
          {limit === null
            ? t("seer:admRequestsToday", { count: user.requestsToday })
            : t("seer:admRequestsTodayLimit", { count: user.requestsToday, limit })}
        </p>
        <p className="text-xs text-tentacle-text-quaternary">{t("seer:admRequestsTotal", { count: user.requestsTotal })}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-tentacle-text-quaternary" />
    </button>
  );
}
