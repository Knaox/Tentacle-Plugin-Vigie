/* ------------------------------------------------------------------ */
/*  Vigie — Trier ses demandes : trois questions, pas treize statuts    */
/* ------------------------------------------------------------------ */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { pill } from "../styles/pills";
import { segment, SEGMENT_GROUP } from "../styles/pills";
import { CloseIcon, SearchIcon } from "../components/ui/icons";
import type { RequestGroup } from "./requestGroups";

export type RequestsFilter = "all" | RequestGroup | "server";
export type RequestsType = "all" | "movie" | "tv";

interface Props {
  filter: RequestsFilter;
  onFilter: (f: RequestsFilter) => void;
  counts: Record<RequestGroup, number>;
  total: number;
  type: RequestsType;
  onType: (t: RequestsType) => void;
  query: string;
  onQuery: (q: string) => void;
  /** Administrateurs : la file entière du serveur. */
  showServer: boolean;
  selecting: boolean;
  onToggleSelecting: () => void;
}

export const RequestsToolbar = memo(function RequestsToolbar(props: Props) {
  const { filter, onFilter, counts, total, type, onType, query, onQuery, showServer, selecting, onToggleSelecting } = props;
  const { t } = useTranslation("seer");
  const chips: Array<{ id: RequestsFilter; label: string; count?: number }> = [
    { id: "all", label: t("seer:reqFilterAll"), count: total },
    { id: "active", label: t("seer:reqFilterActive"), count: counts.active },
    { id: "available", label: t("seer:reqFilterAvailable"), count: counts.available },
    ...(counts.attention > 0 ? [{ id: "attention" as const, label: t("seer:reqFilterAttention"), count: counts.attention }] : []),
    ...(showServer ? [{ id: "server" as const, label: t("seer:serverQueue") }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {chips.map((chip) => (
          <button key={chip.id} type="button" role="tab" aria-selected={filter === chip.id} onClick={() => onFilter(chip.id)} className={`${pill(filter === chip.id)} min-h-[36px] shrink-0`}>
            {chip.label}
            {chip.count !== undefined && <span className="tabular-nums opacity-70">{chip.count}</span>}
          </button>
        ))}
      </div>
      {filter !== "server" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-full bg-tentacle-surface-2 px-4 ring-1 ring-tentacle-border-subtle focus-within:ring-2 focus-within:ring-[rgba(var(--brand-rgb),0.6)] sm:max-w-sm">
            <SearchIcon className="h-4 w-4 shrink-0 text-tentacle-text-quaternary" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={t("seer:searchRequestsPlaceholder")}
              aria-label={t("seer:searchRequestsPlaceholder")}
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-tentacle-text-primary outline-none placeholder:text-tentacle-text-quaternary [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button type="button" onClick={() => onQuery("")} aria-label={t("seer:clearSearch")} className="text-tentacle-text-quaternary hover:text-tentacle-text-primary">
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className={SEGMENT_GROUP} role="tablist" aria-label={t("seer:mediaType")}>
            {(["all", "movie", "tv"] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={type === v} onClick={() => onType(v)} className={`${segment(type === v)} min-h-[32px]`}>
                {v === "all" ? t("seer:filterAllType") : v === "movie" ? t("seer:filterMovies") : t("seer:filterSeries")}
              </button>
            ))}
          </div>
          <button type="button" onClick={onToggleSelecting} className={`${pill(selecting)} ml-auto min-h-[36px]`}>
            {selecting ? t("seer:bulkCancel") : t("seer:bulkSelect")}
          </button>
        </div>
      )}
    </div>
  );
});
