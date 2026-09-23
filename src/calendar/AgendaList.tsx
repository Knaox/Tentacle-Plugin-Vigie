/* ------------------------------------------------------------------ */
/*  Vigie — L'agenda, jour après jour                                  */
/* ------------------------------------------------------------------ */

/*
 * Ce qu'on se demande devant un calendrier, c'est « qu'est-ce qui sort
 * bientôt ? » : une liste par jour y répond mieux qu'une grille, au téléphone
 * comme sur un grand écran. Chaque jour garde son en-tête accroché en haut en
 * défilant ; les jours sans rien ne prennent pas de place. Les sorties des
 * derniers jours restent à un clic, repliées au-dessus.
 */

import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../api/types-releases";
import { addDays, groupByDay, today } from "../utils/calendar-groups";
import { collapseSeriesInDay } from "../utils/calendar-collapse";
import { longDayLabel } from "../utils/day-label";
import { CTA_SECONDARY } from "../styles/cta";
import { ChevronDown } from "../components/ui/icons";
import { AgendaEntry } from "./AgendaEntry";

export const AgendaList = memo(function AgendaList({ items, onOpen }: {
  items: CalendarItem[];
  onOpen: (item: CalendarItem) => void;
}) {
  const { t } = useTranslation("seer");
  const [showPast, setShowPast] = useState(false);
  const ref = today();
  const days = useMemo(() => groupByDay(items), [items]);
  const past = days.filter((d) => d.date < ref);
  const coming = days.filter((d) => d.date >= ref);

  return (
    <div className="space-y-4">
      {past.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast} className={`${CTA_SECONDARY} h-9 gap-1.5 px-4 text-xs`}>
            {showPast ? t("seer:hidePastReleases") : t("seer:showPastReleases", { count: past.reduce((n, d) => n + d.items.length, 0) })}
            <ChevronDown className={`h-4 w-4 transition-transform ${showPast ? "rotate-180" : ""}`} />
          </button>
          {showPast && <div className="mt-3 space-y-4 opacity-80">{past.map((d) => <Day key={d.date} date={d.date} list={d.items} onOpen={onOpen} />)}</div>}
        </div>
      )}
      {coming.map((d) => <Day key={d.date} date={d.date} list={d.items} onOpen={onOpen} />)}
    </div>
  );
});

const Day = memo(function Day({ date, list, onOpen }: { date: string; list: CalendarItem[]; onOpen: (item: CalendarItem) => void }) {
  const { t } = useTranslation("seer");
  const ref = today();
  const isToday = date === ref;
  const special = isToday ? t("seer:releasesToday") : date === addDays(ref, 1) ? t("seer:releasesTomorrow") : null;
  const long = longDayLabel(date);
  const heading = special ?? long.charAt(0).toUpperCase() + long.slice(1);
  return (
    <section aria-label={long}>
      {/* Sous la barre d'onglets du hub, elle-même accrochée en haut. */}
      <h3 className="sticky top-[49px] z-10 -mx-4 flex items-baseline gap-2 bg-tentacle-surface-0 px-4 py-2 md:-mx-8 md:px-8">
        <span className={`text-base font-bold ${isToday ? "text-[var(--brand-light)]" : "text-tentacle-text-primary"}`}>
          {heading}
        </span>
        {special && <span className="text-sm text-tentacle-text-tertiary">{long}</span>}
        <span className="ml-auto text-xs tabular-nums text-tentacle-text-quaternary">{t("seer:releasesCount", { count: list.length })}</span>
      </h3>
      <div className="space-y-0.5">
        {collapseSeriesInDay(list).map((item) => <AgendaEntry key={item.id} item={item} onOpen={onOpen} />)}
      </div>
    </section>
  );
});
