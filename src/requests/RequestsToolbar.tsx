/* ------------------------------------------------------------------ */
/*  Vigie — Trier ses demandes : trois questions, pas treize statuts    */
/* ------------------------------------------------------------------ */

/*
 * Au téléphone, deux rangées au lieu de trois : les états ET le type (Films,
 * Séries — un second toucher revient à « tout ») dans la même rangée de
 * pastilles, puis la recherche, avec le mode sélection réduit à son icône.
 * Au-delà de 640 px, rien ne change.
 */

import { memo, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { pill } from "../styles/pills";
import { Segmented } from "../components/ui/Segmented";
import { CloseIcon, SearchIcon, SelectIcon } from "../components/ui/icons";
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
    ...(counts.partial > 0 ? [{ id: "partial" as const, label: t("seer:reqFilterPartial"), count: counts.partial }] : []),
    { id: "available", label: t("seer:reqFilterAvailable"), count: counts.available },
    ...(counts.attention > 0 ? [{ id: "attention" as const, label: t("seer:reqFilterAttention"), count: counts.attention }] : []),
    ...(showServer ? [{ id: "server" as const, label: t("seer:serverQueue") }] : []),
  ];
  const types: Array<{ id: Exclude<RequestsType, "all">; label: string }> = [
    { id: "movie", label: t("seer:filterMovies") },
    { id: "tv", label: t("seer:filterSeries") },
  ];
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };
  // Tailles COMPOSÉES dans la base (cf. `pillSm`) : ajoutées derrière, c'est
  // l'ordre de la feuille générée qui aurait tranché, pas celui de l'attribut.
  const selectClass = selecting
    ? pill(true).replace("min-h-[36px]", "min-h-[44px] shrink-0 sm:ml-auto sm:min-h-[36px]")
    : pill(false)
      .replace("min-h-[36px]", "min-h-[44px] w-11 shrink-0 sm:ml-auto sm:min-h-[36px] sm:w-auto")
      .replace("px-3.5", "px-0 sm:px-3.5");

  return (
    <div className="space-y-3">
      {/* `py-1` : une rangée qui défile rogne tout ce qui dépasse, anneaux des
          puces compris — elles paraissaient coupées en haut et en bas. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {chips.map((chip) => (
          <button key={chip.id} type="button" role="tab" aria-selected={filter === chip.id} onClick={() => onFilter(chip.id)} className={`${pill(filter === chip.id)} min-h-[36px] shrink-0`}>
            {chip.label}
            {chip.count !== undefined && <span className="tabular-nums opacity-70">{chip.count}</span>}
          </button>
        ))}
        {filter !== "server" && (
          <>
            <span aria-hidden className="my-2 w-px shrink-0 bg-tentacle-border-subtle sm:hidden" />
            {types.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={type === item.id}
                onClick={() => onType(type === item.id ? "all" : item.id)}
                className={`${pill(type === item.id)} min-h-[36px] shrink-0 sm:hidden`}
              >
                {item.label}
              </button>
            ))}
          </>
        )}
      </div>
      {filter !== "server" && (
        <div className="flex items-center gap-2 sm:flex-wrap">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-tentacle-surface-2 pl-4 pr-1 ring-1 ring-tentacle-border-subtle focus-within:ring-2 focus-within:ring-[rgba(var(--brand-rgb),0.6)] sm:h-10 sm:min-w-[200px] sm:max-w-sm">
            <SearchIcon className="h-4 w-4 shrink-0 text-tentacle-text-quaternary" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("seer:searchRequestsPlaceholder")}
              aria-label={t("seer:searchRequestsPlaceholder")}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              // 16 px au téléphone : en dessous, iOS zoome la page au focus.
              className="h-full min-w-0 flex-1 bg-transparent text-base text-tentacle-text-primary outline-none placeholder:text-tentacle-text-quaternary sm:text-sm [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button type="button" onClick={() => onQuery("")} aria-label={t("seer:clearSearch")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-tentacle-text-quaternary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary">
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <Segmented
            ariaLabel={t("seer:mediaType")}
            value={type}
            onChange={onType}
            size="sm"
            className="hidden sm:inline-flex"
            options={[
              { value: "all", label: t("seer:filterAllType") },
              { value: "movie", label: t("seer:filterMovies") },
              { value: "tv", label: t("seer:filterSeries") },
            ]}
          />
          <button
            type="button"
            onClick={onToggleSelecting}
            aria-label={selecting ? t("seer:bulkCancel") : t("seer:bulkSelect")}
            className={selectClass}
          >
            {selecting ? t("seer:bulkCancel") : (
              <>
                <SelectIcon className="h-5 w-5 sm:hidden" />
                <span className="hidden sm:inline">{t("seer:bulkSelect")}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
});
