import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../../api/types-releases";
import { ReleaseEntry } from "./ReleaseEntry";
import { ICON_BUTTON } from "../../styles/pills";

/** Les flèches de semaine : 44 px au doigt, 36 à la souris. */
const NAV_BUTTON = ICON_BUTTON.replace("h-9 w-9", "h-11 w-11 sm:h-9 sm:w-9");
import { weekDays, weekHeading, today, startOfWeek } from "../../utils/calendar-groups";
import { parseAirDate } from "../../utils/episode-dates";
import { getCurrentLanguage } from "../../utils/media-helpers";
import { collapseSeriesInDay, type CollapsedItem } from "../../utils/calendar-collapse";

interface Props {
  items: CalendarItem[];
  /** Lundi de la semaine affichée — l'état vit dans la page, pas ici : il
   *  survit ainsi aux rechargements qui démontaient la vue. */
  anchor: string;
  onShift: (deltaWeeks: number) => void;
  onToday: () => void;
  onOpen?: (item: CalendarItem) => void;
}

/**
 * La semaine — la vue qui répond à « qu'est-ce qui sort cette semaine », la
 * question qu'on se pose réellement.
 *
 * Sept colonnes sur écran large. Sur un téléphone, sept colonnes feraient
 * 53 pixels chacune : la semaine s'y empile donc verticalement, un jour après
 * l'autre, avec exactement les mêmes cartes. Même information, réorganisée —
 * pas une version dégradée, et surtout aucun défilement horizontal.
 */
export function ReleaseWeekView({ items, anchor, onShift, onToday, onOpen }: Props) {
  const { t } = useTranslation("seer");

  const days = useMemo(() => weekDays(anchor), [anchor]);
  const ref = today();

  /* Repli des saisons publiées d'un coup : sans lui, un drop d'une plateforme
   * remplit une journée entière avec dix fois le même titre. */
  const byDate = useMemo(() => {
    const raw = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const bucket = raw.get(it.date);
      if (bucket) bucket.push(it);
      else raw.set(it.date, [it]);
    }
    const out = new Map<string, CollapsedItem[]>();
    for (const [date, list] of raw) out.set(date, collapseSeriesInDay(list));
    return out;
  }, [items]);

  const isCurrentWeek = anchor === startOfWeek(ref);

  return (
    <div className="pb-10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={() => onShift(-1)} aria-label={t("seer:releasesWeekPrev")} className={NAV_BUTTON}>
          <Chevron dir="left" />
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-tentacle-text-primary">
            {weekHeading(anchor)}
          </span>
          {!isCurrentWeek && (
            <button
              onClick={onToday}
              className="h-9 shrink-0 rounded-full bg-tentacle-fill-subtle px-3 text-xs font-semibold text-tentacle-text-secondary ring-1 ring-tentacle-border-subtle transition-colors hover:bg-tentacle-fill-medium sm:h-auto sm:px-2.5 sm:py-1 sm:text-[11px] sm:font-medium"
            >
              {t("seer:releasesThisWeek")}
            </button>
          )}
        </div>

        <button onClick={() => onShift(1)} aria-label={t("seer:releasesWeekNext")} className={NAV_BUTTON}>
          <Chevron dir="right" />
        </button>
      </div>

      {/* Sept colonnes seulement quand elles sont assez larges pour qu'une
          affiche reste reconnaissable (~130 px). En dessous, la grille se
          replie : 3 colonnes, puis 2, puis les jours empilés. Sept colonnes de
          93 px donneraient des vignettes illisibles et des titres coupés au
          troisième caractère — autant empiler. */}
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
        {days.map((date) => (
          <DayColumn
            key={date}
            date={date}
            items={byDate.get(date) ?? []}
            isToday={date === ref}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  date, items, isToday, onOpen,
}: {
  date: string;
  items: CollapsedItem[];
  isToday: boolean;
  onOpen?: (item: CalendarItem) => void;
}) {
  const parsed = parseAirDate(date);
  const lang = getCurrentLanguage();
  const weekday = parsed ? new Intl.DateTimeFormat(lang, { weekday: "short" }).format(parsed) : "";
  const dayNum = parsed ? parsed.getDate() : "";

  // Un jour vide reste visible en large (la grille garde ses sept colonnes),
  // mais disparaît en étroit où il n'apporterait qu'une ligne inutile.
  if (items.length === 0) {
    return (
      <div className="hidden min-h-[64px] rounded-lg bg-tentacle-fill-faint p-2 lg:block">
        <DayHeader weekday={weekday} dayNum={dayNum} isToday={isToday} />
      </div>
    );
  }

  return (
    <section
      className={`rounded-lg p-2 ${
        isToday
          ? "bg-[var(--surface-2)] ring-1 ring-[rgba(var(--brand-rgb),0.5)]"
          : "bg-tentacle-fill-faint"
      }`}
    >
      <DayHeader weekday={weekday} dayNum={dayNum} isToday={isToday} />
      <div className="mt-2 space-y-1.5">
        {items.map((item) => (
          <ReleaseEntry key={item.id} item={item} density="week" onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function DayHeader({ weekday, dayNum, isToday }: { weekday: string; dayNum: number | string; isToday: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-tentacle-text-quaternary">
        {weekday}
      </span>
      <span
        className={`text-sm font-bold tabular-nums ${
          isToday ? "text-[var(--brand-light)]" : "text-tentacle-text-secondary"
        }`}
      >
        {dayNum}
      </span>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={dir === "left" ? "M15.75 19.5 8.25 12l7.5-7.5" : "m8.25 4.5 7.5 7.5-7.5 7.5"}
      />
    </svg>
  );
}
