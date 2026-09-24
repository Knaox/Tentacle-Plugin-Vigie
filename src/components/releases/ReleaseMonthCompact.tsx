/* ------------------------------------------------------------------ */
/*  Vigie — Le mois, au téléphone                                      */
/* ------------------------------------------------------------------ */

/*
 * Sept colonnes de titres ne tiennent pas dans 393 px : la vue Mois du bureau
 * y donnait des cases de 48 px, des titres à trois lettres et des cibles de
 * 16 px. Au téléphone, le mois se lit comme le Calendrier d'iOS : une grille
 * compacte où chaque jour dit COMBIEN il sort de choses (des points), et la
 * liste du jour touché juste dessous — la grille entière tient à l'écran, la
 * liste n'est jamais hors de vue.
 *
 * Le jour ouvert d'office : aujourd'hui si le mois le contient, sinon le
 * premier jour qui a des sorties.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../../api/types-releases";
import { ReleaseRow } from "./ReleaseRow";
import { ICON_BUTTON } from "../../styles/pills";
import { ChevronLeft, ChevronRight } from "../ui/icons";
import { monthMatrix, weekdayInitials, today, monthHeading, dayHeading } from "../../utils/calendar-groups";
import { collapseSeriesInDay } from "../../utils/calendar-collapse";

interface Props {
  items: CalendarItem[];
  cursor: { year: number; month: number };
  onShift: (deltaMonths: number) => void;
  onThisMonth: () => void;
  onOpen?: (item: CalendarItem) => void;
}

/** Au-delà, un point de plus ne dirait rien de plus. */
const MAX_DOTS = 3;
/** Le bouton rond des calendriers, en cible de 44 px au doigt. */
const NAV_BUTTON = ICON_BUTTON.replace("h-9 w-9", "h-11 w-11");

export function ReleaseMonthCompact({ items, cursor, onShift, onThisMonth, onOpen }: Props) {
  const { t } = useTranslation("seer");
  const ref = today();
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
  const isCurrentMonth = ref.startsWith(monthPrefix);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const bucket = map.get(it.date);
      if (bucket) bucket.push(it);
      else map.set(it.date, [it]);
    }
    return map;
  }, [items]);

  /* Une saison lâchée d'un coup compte pour UNE sortie du jour. */
  const countByDate = useMemo(() => {
    const out = new Map<string, number>();
    for (const [date, list] of byDate) out.set(date, collapseSeriesInDay(list).length);
    return out;
  }, [byDate]);

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const initials = useMemo(() => weekdayInitials(), []);

  const firstBusy = useMemo(
    () => [...countByDate.keys()].filter((d) => d.startsWith(monthPrefix)).sort()[0] ?? null,
    [countByDate, monthPrefix],
  );
  const [selected, setSelected] = useState<string | null>(null);
  // Nouveau mois (ou données arrivées) : le jour ouvert d'office.
  useEffect(() => {
    setSelected((current) => (current?.startsWith(monthPrefix) ? current : isCurrentMonth ? ref : firstBusy));
  }, [monthPrefix, isCurrentMonth, ref, firstBusy]);

  const dayItems = selected ? byDate.get(selected) ?? [] : [];

  return (
    <div className="pb-10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => onShift(-1)} aria-label={t("seer:releasesMonthPrev")} className={NAV_BUTTON}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-semibold capitalize text-tentacle-text-primary">
            {monthHeading(`${monthPrefix}-01`)}
          </span>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={onThisMonth}
              className="h-9 shrink-0 rounded-full bg-tentacle-fill-subtle px-3 text-xs font-semibold text-tentacle-text-secondary ring-1 ring-tentacle-border-subtle transition-colors active:bg-tentacle-fill-medium"
            >
              {t("seer:releasesThisMonth")}
            </button>
          )}
        </div>
        <button type="button" onClick={() => onShift(1)} aria-label={t("seer:releasesMonthNext")} className={NAV_BUTTON}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-tentacle-text-quaternary">
        {initials.map((d, i) => <span key={i}>{d}</span>)}
      </div>

      <div role="grid" aria-label={monthHeading(`${monthPrefix}-01`)} className="space-y-0.5">
        {weeks.map((week) => (
          <div key={week[0]} role="row" className="grid grid-cols-7">
            {week.map((date) => {
              const count = countByDate.get(date) ?? 0;
              const inMonth = date.startsWith(monthPrefix);
              const isSelected = date === selected;
              const isToday = date === ref;
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`${dayHeading(date, t)} — ${t("seer:releasesCount", { count })}`}
                  onClick={() => setSelected(date)}
                  className="flex h-12 flex-col items-center justify-center gap-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
                      isSelected
                        ? "bg-[var(--brand)] text-white"
                        : isToday
                          ? "text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.55)]"
                          : inMonth
                            ? "text-tentacle-text-primary"
                            : "text-tentacle-text-disabled"
                    }`}
                  >
                    {Number(date.slice(8, 10))}
                  </span>
                  <span aria-hidden className="flex h-1.5 items-center gap-0.5">
                    {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, i) => (
                      <span key={i} className={`h-1.5 w-1.5 rounded-full ${inMonth ? "bg-[var(--brand-light)]" : "bg-tentacle-text-disabled"}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-tentacle-border-subtle pt-4">
        {selected ? (
          <>
            <h3 className="mb-2 flex items-baseline justify-between gap-2 text-sm font-semibold text-tentacle-text-secondary">
              <span className="capitalize">{dayHeading(selected, t)}</span>
              {dayItems.length > 0 && (
                <span className="text-xs font-medium tabular-nums text-tentacle-text-quaternary">
                  {t("seer:releasesCount", { count: dayItems.length })}
                </span>
              )}
            </h3>
            {dayItems.length > 0 ? (
              <div className="space-y-2">
                {dayItems.map((item) => <ReleaseRow key={item.id} item={item} onOpen={onOpen} />)}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-tentacle-text-tertiary">{t("seer:releasesDayEmpty")}</p>
            )}
          </>
        ) : (
          <p className="py-4 text-center text-sm text-tentacle-text-tertiary">{t("seer:releasesPickDay")}</p>
        )}
      </div>
    </div>
  );
}
