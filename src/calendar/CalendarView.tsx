/* ------------------------------------------------------------------ */
/*  Vigie — Le calendrier des sorties                                  */
/* ------------------------------------------------------------------ */

/*
 * Trois questions, un sélecteur : ce qui sort POUR MOI (mes demandes), pour
 * tout le serveur (ce que les autres attendent), ou tout court (les sorties
 * de la région, mes demandes comprises). Trois façons de le lire : la
 * semaine (la vue de toujours, la question qu'on se pose vraiment), la liste
 * jour après jour, le mois.
 */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../api/types-releases";
import { useGlobalCalendar, usePersonalCalendar } from "../hooks/useReleases";
import { useReleasesFilters } from "../hooks/useReleasesFilters";
import { useReleasesRange } from "../hooks/useReleasesRange";
import { matchesReleaseFilters, sortReleases, activeReleasesFilterCount } from "../utils/calendar-filter";
import { applyLocalDays } from "../utils/calendar-localtime";
import { addDays, today } from "../utils/calendar-groups";
import { calendarAsMedia } from "../utils/as-media";
import { useHub } from "../hub/HubContext";
import { EmptyState } from "../components/EmptyState";
import { ReleaseWeekView } from "../components/releases/ReleaseWeekView";
import { ReleaseMonthView } from "../components/releases/ReleaseMonthView";
import { ReleasesFilterSheet } from "../components/releases/ReleasesFilterSheet";
import { CalendarSkeleton } from "../components/releases/CalendarSkeleton";
import { segment, SEGMENT_GROUP } from "../styles/pills";
import { CTA_PRIMARY, CTA_SECONDARY, CTA_SIZE_MD } from "../styles/cta";
import { FilterIcon } from "../components/ui/icons";
import { AgendaList } from "./AgendaList";

export type CalendarScope = "mine" | "everyone" | "all";
export type CalendarLayout = "week" | "list" | "month";

const LIST_DAYS = 60;

export function CalendarView({ active }: { active: boolean }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const [scope, setScope] = useState<CalendarScope>("mine");
  const [layout, setLayout] = useState<CalendarLayout>("week");
  const [listDays, setListDays] = useState(LIST_DAYS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const releasesFilters = useReleasesFilters();
  const nav = useReleasesRange(layout === "month" ? "month" : "week");

  // La liste part d'une semaine en arrière (les sorties récentes, repliées) ;
  // la semaine et le mois suivent leur curseur.
  const from = today();
  const range = layout === "list" ? { from: addDays(from, -7), to: addDays(from, listDays) } : nav.range;

  const personal = usePersonalCalendar(range.from, range.to, active, true, scope === "everyone");
  const global = useGlobalCalendar(range.from, range.to, active && scope === "all");

  // « Tout » = les sorties de la région ET les siennes, sans doublon — la
  // version des demandes d'abord : c'est elle qui porte le statut.
  const source = useMemo(() => {
    if (scope !== "all") return personal.data?.items ?? [];
    const seen = new Set<string>();
    const out: CalendarItem[] = [];
    for (const item of [...(personal.data?.items ?? []), ...(global.data?.items ?? [])]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }, [scope, personal.data, global.data]);

  // « Seulement mes demandes » n'a de sens qu'en « Tout ».
  const filters = useMemo(
    () => (scope === "all" ? releasesFilters.filters : { ...releasesFilters.filters, requestedOnly: false }),
    [scope, releasesFilters.filters],
  );
  const items = useMemo(
    () => sortReleases(applyLocalDays(source).filter((i) => matchesReleaseFilters(i, filters)), filters.sortBy),
    [source, filters],
  );
  const filterCount = activeReleasesFilterCount(filters);

  const pending = personal.isPending || (scope === "all" && global.isPending);
  const partial = !!(personal.data?.partial || (scope === "all" && global.data?.partial));
  const open = useCallback((item: CalendarItem) => hub.openMedia(calendarAsMedia(item)), [hub]);

  const scopes: Array<{ id: CalendarScope; label: string }> = [
    { id: "mine", label: t("seer:scopeMine") },
    { id: "everyone", label: t("seer:scopeEveryone") },
    { id: "all", label: t("seer:scopeAll") },
  ];
  const layouts: Array<{ id: CalendarLayout; label: string }> = [
    { id: "week", label: t("seer:releasesViewWeek") },
    { id: "list", label: t("seer:releasesViewList") },
    { id: "month", label: t("seer:releasesViewMonth") },
  ];

  const empty = scope === "mine" && filterCount === 0
    ? { title: t("seer:calendarEmptyMine"), hint: t("seer:calendarEmptyMineHint") }
    : filterCount > 0
      ? { title: t("seer:releasesEmptyFiltered"), hint: t("seer:releasesEmptyFilteredHint") }
      : { title: t("seer:releasesEmptyGlobal"), hint: undefined };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className={`${SEGMENT_GROUP} max-w-full overflow-x-auto`} role="tablist" aria-label={t("seer:calendarScope")}>
          {scopes.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={scope === s.id} onClick={() => setScope(s.id)} className={`${segment(scope === s.id)} min-h-[32px] whitespace-nowrap`}>
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setFiltersOpen(true)} className={`${CTA_SECONDARY} h-9 gap-1.5 px-3 text-xs`}>
          <FilterIcon className="h-4 w-4" />
          {t("seer:filterTitle")}
          {filterCount > 0 && <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-tentacle-brand px-1 text-[10px] font-bold text-tentacle-cta-brand-fg">{filterCount}</span>}
        </button>
        <div className={`${SEGMENT_GROUP} ml-auto`} role="tablist" aria-label={t("seer:calendarLayout")}>
          {layouts.map((l) => (
            <button key={l.id} type="button" role="tab" aria-selected={layout === l.id} onClick={() => setLayout(l.id)} className={`${segment(layout === l.id)} min-h-[32px]`}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-tentacle-text-tertiary">{t(`seer:scopeHint_${scope}`)}</p>
      {partial && <p className="text-xs text-tentacle-text-quaternary">{t("seer:releasesBuilding")}</p>}

      {pending && items.length === 0 ? (
        <CalendarSkeleton view={layout === "month" ? "month" : "week"} />
      ) : items.length === 0 ? (
        // Rien sur toute la période chargée (des mois) : on le dit, et l'on
        // propose d'élargir plutôt que de montrer une grille vide.
        <EmptyState
          title={empty.title}
          subtitle={empty.hint}
          action={scope === "mine" && filterCount === 0
            ? <button type="button" onClick={() => setScope("all")} className={`${CTA_PRIMARY} ${CTA_SIZE_MD}`}>{t("seer:seeAllReleases")}</button>
            : undefined}
        />
      ) : layout === "week" ? (
        <ReleaseWeekView items={items} anchor={nav.weekAnchor} onShift={nav.goWeek} onToday={nav.goThisWeek} onOpen={open} />
      ) : layout === "month" ? (
        <ReleaseMonthView items={items} cursor={nav.monthCursor} onShift={nav.goMonth} onThisMonth={nav.goThisMonth} onOpen={open} />
      ) : (
        <>
          <AgendaList items={items} onOpen={open} />
          <div className="flex justify-center pt-2">
            <button type="button" onClick={() => setListDays((d) => d + LIST_DAYS)} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>
              {t("seer:loadMoreDays", { count: LIST_DAYS })}
            </button>
          </div>
        </>
      )}

      <ReleasesFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onToggleProvider={releasesFilters.toggleProvider}
        onClearProviders={releasesFilters.clearProviders}
        onMediaFilterChange={releasesFilters.setMediaFilter}
        onRatingMinChange={releasesFilters.setRatingMin}
        onLanguageChange={releasesFilters.setOriginalLanguage}
        onSortByChange={releasesFilters.setSortBy}
        onRequestedOnlyChange={releasesFilters.setRequestedOnly}
        showRequestedOnly={scope === "all"}
        onReset={releasesFilters.reset}
        activeCount={filterCount}
        resultCount={pending ? null : items.length}
      />
    </div>
  );
}
