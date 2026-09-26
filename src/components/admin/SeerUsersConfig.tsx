import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAdminUsers, useUpdateAdminUser, useSyncAdminUsers, useSyncRequestsOwnership } from "../../hooks/useAdminUsers";
import { useToast } from "../../hooks/useToast";
import { formatSeerError } from "../../api/seer-client";
import type { AdminUserRow, UpdateAdminUserBody } from "../../api/types";

interface SeerUsersConfigProps {
  /** Indique si l'URL + la clé API Jellyseerr sont renseignées (sinon le bouton sync est désactivé) */
  seerrConfigured?: boolean;
}

export function SeerUsersConfig({ seerrConfigured = true }: SeerUsersConfigProps) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const { data: overview, isLoading } = useAdminUsers();
  const users = overview?.users;
  const updateMutation = useUpdateAdminUser();
  const syncMutation = useSyncAdminUsers();
  const reassignMutation = useSyncRequestsOwnership();

  const handleSync = () => {
    if (!seerrConfigured) {
      toast.show("error", t("seer:statusNotConfigured"));
      return;
    }
    syncMutation.mutate(undefined, {
      onSuccess: (report) => {
        toast.show("success", t("seer:adminUsersSyncDone", {
          created: report.created.length,
          synced: report.linked.length + report.renamed.length,
          failed: report.failures.length,
          removed: report.removed.length,
          invalidatedLinks: report.unlinked.length,
        }));
      },
      onError: (err) => toast.show("error", formatSeerError(err, t)),
    });
  };

  const handleReassign = () => {
    if (!seerrConfigured) {
      toast.show("error", t("seer:statusNotConfigured"));
      return;
    }
    reassignMutation.mutate(undefined, {
      onSuccess: (data) => {
        toast.show("success", t("seer:adminReassignDone", {
          reassigned: data.reassigned,
          recreated: data.recreated ?? 0,
          alreadyOk: data.alreadyOk,
          orphansCreated: data.orphansCreated,
          failed: data.failed,
        }));
      },
      onError: (err) => toast.show("error", formatSeerError(err, t)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-tentacle-text-primary">{t("seer:adminUsersTitle")}</h3>
          <p className="text-xs text-tentacle-text-quaternary">{t("seer:adminUsersDescription")}</p>
          {users && (
            <p className="mt-1 text-[11px] text-tentacle-text-disabled">
              {t("seer:adminUsersTotal", { count: users.length })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleReassign}
            disabled={reassignMutation.isPending || !seerrConfigured}
            title={!seerrConfigured
              ? t("seer:statusNotConfigured")
              : t("seer:adminReassignHint")}
            className="rounded-tentacle-md bg-tentacle-cta-ghost px-3 py-1.5 text-xs font-medium text-tentacle-text-secondary transition-colors hover:bg-[color:var(--cta-ghost-bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {reassignMutation.isPending ? "..." : t("seer:adminReassignButton")}
          </button>
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending || !seerrConfigured}
            title={!seerrConfigured ? t("seer:statusNotConfigured") : undefined}
            className="rounded-tentacle-md bg-tentacle-cta-ghost px-3 py-1.5 text-xs font-medium text-tentacle-text-secondary transition-colors hover:bg-[color:var(--cta-ghost-bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {syncMutation.isPending ? "..." : t("seer:adminUsersSync")}
          </button>
        </div>
      </div>

      {!seerrConfigured && (
        <p className="rounded-tentacle-md border border-[color:var(--status-warning-bg)] bg-tentacle-status-warning-bg px-4 py-2 text-xs text-tentacle-status-warning-fg">
          {t("seer:adminUsersConfigFirst")}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-tentacle-md bg-tentacle-cta-ghost" />
          ))}
        </div>
      ) : !users || users.length === 0 ? (
        <p className="rounded-tentacle-md bg-tentacle-cta-ghost px-4 py-6 text-center text-sm text-tentacle-text-quaternary">
          {t("seer:adminUsersEmpty")}
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <UserRow
              key={user.jellyfinUserId}
              user={user}
              onSave={async (patch) => {
                await updateMutation.mutateAsync({ jellyfinUserId: user.jellyfinUserId, patch });
                toast.show("success", t("seer:adminUsersSaved"));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  onSave,
}: {
  user: AdminUserRow;
  onSave: (patch: UpdateAdminUserBody) => Promise<unknown>;
}) {
  const { t } = useTranslation("seer");
  const [blocked, setBlocked] = useState(user.blocked);
  const [dailyLimit, setDailyLimit] = useState<string>(
    user.dailyLimit === null ? "" : String(user.dailyLimit),
  );
  const [allowMovies, setAllowMovies] = useState(user.allowMovies);
  const [allowTv, setAllowTv] = useState(user.allowTv);
  const [allowAnime, setAllowAnime] = useState(user.allowAnime);
  const [saving, setSaving] = useState(false);

  // Re-sync local state si props changent (mutation success)
  useEffect(() => { setBlocked(user.blocked); }, [user.blocked]);
  useEffect(() => { setDailyLimit(user.dailyLimit === null ? "" : String(user.dailyLimit)); }, [user.dailyLimit]);
  useEffect(() => { setAllowMovies(user.allowMovies); }, [user.allowMovies]);
  useEffect(() => { setAllowTv(user.allowTv); }, [user.allowTv]);
  useEffect(() => { setAllowAnime(user.allowAnime); }, [user.allowAnime]);

  const limitNum = dailyLimit === "" ? null : Number(dailyLimit);
  const dirty =
    blocked !== user.blocked ||
    limitNum !== user.dailyLimit ||
    allowMovies !== user.allowMovies ||
    allowTv !== user.allowTv ||
    allowAnime !== user.allowAnime;

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await onSave({
        blocked,
        dailyLimit: limitNum,
        allowMovies,
        allowTv,
        allowAnime,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{user.username}</p>
          <p className="truncate text-[10px] text-white/30">
            {user.jellyseerrUserId
              ? `${t("seer:adminUsersSeerrLinked")} #${user.jellyseerrUserId}`
              : t("seer:adminUsersSeerrNotLinked")}
          </p>
          <p className="text-[10px] text-white/40">
            {user.dailyLimit === null
              ? t("seer:adminUsersRequestsTodayUnlimited", { count: user.requestsToday })
              : t("seer:adminUsersRequestsToday", { count: user.requestsToday, limit: user.dailyLimit })}
          </p>
        </div>

        {/* Blocked */}
        <label className="flex items-center gap-1.5 text-xs text-white/70">
          <input
            type="checkbox"
            checked={blocked}
            onChange={(e) => setBlocked(e.target.checked)}
            className="h-4 w-4 rounded accent-red-500"
          />
          {t("seer:adminUsersBlocked")}
        </label>

        {/* Daily limit */}
        <label className="flex items-center gap-1.5 text-xs text-white/70">
          {t("seer:adminUsersDailyLimit")}
          <div className="flex items-stretch overflow-hidden rounded border border-white/10 bg-white/10">
            <input
              type="number"
              min={0}
              value={dailyLimit}
              placeholder="∞"
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-16 bg-transparent px-2 py-1 text-xs text-white outline-none focus:bg-white/5"
            />
            <button
              type="button"
              onClick={() => setDailyLimit("")}
              disabled={dailyLimit === ""}
              title={t("seer:adminUsersUnlimited")}
              className="border-l border-white/10 px-2 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white disabled:text-white/20 disabled:hover:bg-transparent"
            >
              ∞
            </button>
          </div>
        </label>

        {/* Allow toggles */}
        <label className="flex items-center gap-1.5 text-xs text-white/70">
          <input
            type="checkbox"
            checked={allowMovies}
            onChange={(e) => setAllowMovies(e.target.checked)}
            className="h-4 w-4 rounded accent-tentacle-brand"
          />
          {t("seer:adminUsersAllowMovies")}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-white/70">
          <input
            type="checkbox"
            checked={allowTv}
            onChange={(e) => setAllowTv(e.target.checked)}
            className="h-4 w-4 rounded accent-tentacle-brand"
          />
          {t("seer:adminUsersAllowTv")}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-white/70">
          <input
            type="checkbox"
            checked={allowAnime}
            onChange={(e) => setAllowAnime(e.target.checked)}
            className="h-4 w-4 rounded accent-tentacle-brand"
          />
          {t("seer:adminUsersAllowAnime")}
        </label>

        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{ boxShadow: "0 8px 22px rgba(var(--brand-rgb), 0.45)" }} className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black transition-all hover:bg-white/95 disabled:opacity-30"
        >
          {saving ? "..." : t("seer:adminUsersSave")}
        </button>
      </div>
    </div>
  );
}
