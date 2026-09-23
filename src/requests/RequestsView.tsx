/* ------------------------------------------------------------------ */
/*  Vigie — Mes demandes                                               */
/* ------------------------------------------------------------------ */

/*
 * Trois sections, dans l'ordre où l'on s'en soucie : ce qui arrive, ce qui
 * est là, ce qui coince. Chaque demande dit en une phrase où elle en est ;
 * une série qui attend un épisode dit quand il sort, d'un clic vers le
 * calendrier. Les archives (supprimées) restent repliées en bas.
 */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import { usePersonalCalendar } from "../hooks/useReleases";
import { useBulkDeleteRequests, useBulkRetryRequests } from "../hooks/useRequests";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useToast } from "../hooks/useToast";
import { addDays, today } from "../utils/calendar-groups";
import { applyLocalDays } from "../utils/calendar-localtime";
import { episodeLabel } from "../utils/calendar-kind";
import { shortDayLabel } from "../utils/day-label";
import { useHub } from "../hub/HubContext";
import type { HubData } from "../hub/useHubData";
import { EmptyState } from "../components/EmptyState";
import { DownloadsPanel } from "../components/DownloadsPanel";
import { RequestsBulkBar, BulkRetryModal } from "../components/RequestsBulkUI";
import { CTA_PRIMARY, CTA_SIZE_MD, CTA_SECONDARY } from "../styles/cta";
import { SectionHeader } from "../components/ui/Rail";
import { GROUP_ORDER, groupRequests, type RequestGroup } from "./requestGroups";
import { RequestRow } from "./RequestRow";
import { RequestsToolbar, type RequestsFilter, type RequestsType } from "./RequestsToolbar";
import { useRequestActions } from "./useRequestActions";
import { useMoreRequests } from "./useMoreRequests";

const TITLE: Record<RequestGroup, string> = {
  active: "seer:groupActive", available: "seer:groupAvailable", attention: "seer:groupAttention", archived: "seer:groupArchived",
};

export function RequestsView({ data, active }: { data: HubData; active: boolean }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const actions = useRequestActions();
  const [filter, setFilter] = useState<RequestsFilter>("all");
  const [type, setType] = useState<RequestsType>("all");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRetry, setBulkRetry] = useState(false);
  const [bulkProfile, setBulkProfile] = useState<string | null>(null);
  const bulkDelete = useBulkDeleteRequests();
  const bulkRetryMutation = useBulkRetryRequests();

  // Chercher ou filtrer charge TOUTES les pages : on ne rate rien de ce qu'on cherche.
  const pages = data.requests.data?.pages ?? 1;
  const [shownPages, setShownPages] = useState(1);
  const wantAll = query.trim() !== "" || filter !== "all" || type !== "all";
  const more = useMoreRequests(wantAll ? pages : shownPages);
  const all = useMemo(() => [...data.list, ...more.requests], [data.list, more.requests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return all.filter((r) => (type === "all" || r.mediaType === type) && (q === "" || r.title.toLocaleLowerCase().includes(q)));
  }, [all, type, query]);
  const isArriving = useCallback((id: string) => data.progress.byId.has(id), [data.progress.byId]);
  const groups = useMemo(() => groupRequests(filtered, isArriving), [filtered, isArriving]);

  // Le prochain épisode de chaque série suivie, sur un mois.
  const from = today();
  const month = usePersonalCalendar(from, addDays(from, 30), active, true, false);
  const nextRelease = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of applyLocalDays(month.data?.items ?? []).sort((a, b) => a.date.localeCompare(b.date))) {
      if (item.date < from || map.has(item.tmdbId)) continue;
      const what = item.kind === "episode" ? episodeLabel(item.seasonNumber, item.episodeNumber) : "";
      map.set(item.tmdbId, [shortDayLabel(item.date, t), what].filter(Boolean).join(" · "));
    }
    return map;
  }, [month.data, from, t]);

  const toggle = useCallback((id: string) => {
    setSelected((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); };

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
  const noRequests = !data.requests.isPending && data.list.length === 0;
  const visibleGroups = filter === "all" || filter === "server" ? GROUP_ORDER : [filter];

  const renderRow = (request: LocalRequest) => (
    <RequestRow
      key={request.id}
      request={request}
      progress={data.progress.byId.get(request.id)}
      receivedAt={data.progress.updatedAt}
      nextRelease={request.mediaType === "tv" ? nextRelease.get(request.tmdbId) ?? null : null}
      onAction={actions.run}
      onMenu={actions.openMenu}
      onNextRelease={() => hub.setTab("calendar")}
      selectable={selecting}
      selected={selected.has(request.id)}
      onToggleSelect={toggle}
    />
  );

  if (noRequests) {
    return (
      <EmptyState
        title={t("seer:requestsEmptyTitle")}
        subtitle={t("seer:requestsEmptyHint")}
        action={<button type="button" onClick={() => hub.setTab("discover")} className={`${CTA_PRIMARY} ${CTA_SIZE_MD}`}>{t("seer:discoverButton")}</button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <RequestsToolbar
        filter={filter} onFilter={(f) => { setFilter(f); stopSelecting(); }} counts={data.counts} total={total}
        type={type} onType={setType} query={query} onQuery={setQuery} showServer={isAdmin}
        selecting={selecting} onToggleSelecting={() => (selecting ? stopSelecting() : setSelecting(true))}
      />

      {filter === "server" ? <DownloadsPanel active={active} /> : (
        <>
          {visibleGroups.map((group) => {
            const list = groups.get(group) ?? [];
            if (list.length === 0) return null;
            const archived = group === "archived" && filter === "all";
            return (
              <section key={group}>
                <SectionHeader title={t(TITLE[group])} count={list.length} />
                {archived && !showArchived ? (
                  <button type="button" onClick={() => setShowArchived(true)} className={`${CTA_SECONDARY} h-10 px-4 text-sm`}>{t("seer:showArchived", { count: list.length })}</button>
                ) : (
                  <ul className="space-y-1">{list.map(renderRow)}</ul>
                )}
              </section>
            );
          })}
          {filtered.length === 0 && <EmptyState title={t("seer:requestsNothingFiltered")} />}
          {!wantAll && shownPages < pages && (
            <div className="flex justify-center">
              <button type="button" onClick={() => setShownPages((p) => p + 1)} disabled={more.loading} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>
                {more.loading ? t("seer:loading") : t("seer:loadMoreRequests")}
              </button>
            </div>
          )}
        </>
      )}

      {selecting && selected.size > 0 && (
        <RequestsBulkBar
          count={selected.size}
          deleting={bulkDelete.isPending}
          retrying={bulkRetryMutation.isPending}
          onBulkDelete={() => bulkDelete.mutate([...selected], {
            onSuccess: (r) => { toast.show("success", t("seer:bulkDeleteSuccess", { count: r.deleted })); stopSelecting(); },
            onError: () => toast.show("error", t("seer:bulkError")),
          })}
          onOpenRetryModal={() => setBulkRetry(true)}
          onCancel={stopSelecting}
        />
      )}
      {bulkRetry && (
        <BulkRetryModal
          count={selected.size}
          profileId={bulkProfile}
          onProfileChange={setBulkProfile}
          retrying={bulkRetryMutation.isPending}
          onConfirm={() => bulkRetryMutation.mutate({ ids: [...selected], profileId: bulkProfile }, {
            onSuccess: (r) => { toast.show("success", t("seer:bulkRetrySuccess", { count: r.retried })); stopSelecting(); setBulkRetry(false); },
            onError: () => toast.show("error", t("seer:bulkError")),
          })}
          onClose={() => setBulkRetry(false)}
        />
      )}
      {actions.modals}
    </div>
  );
}
