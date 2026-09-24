import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../../api/types-releases";
import { ReleaseEntry } from "./ReleaseEntry";
import { ReleaseRow } from "./ReleaseRow";
import { ICON_BUTTON } from "../../styles/pills";
import { monthMatrix, weekdayInitials, today, monthHeading, dayHeading } from "../../utils/calendar-groups";
import { collapseSeriesInDay, type CollapsedItem } from "../../utils/calendar-collapse";
import { useIsPhone } from "../../hooks/useIsPhone";
import { ReleaseMonthCompact } from "./ReleaseMonthCompact";

interface Props {
  items: CalendarItem[];
  /** Mois affiché — l'état vit dans la page : il survit aux rechargements, et
   *  s'ouvre sur le mois COURANT, plus jamais sur celui du premier item (la
   *  semaine, elle, restait sur la semaine courante : deux vues ouvertes sur
   *  deux périodes, sans que rien ne l'explique). */
  cursor: { year: number; month: number };
  onShift: (deltaMonths: number) => void;
  onThisMonth: () => void;
  onOpen?: (item: CalendarItem) => void;
}

/** Entrées visibles dans une case avant le repli « +N ». */
const PER_CELL = 3;

/**
 * Le mois — la vue d'ensemble, **avec les titres**.
 *
 * La version précédente n'affichait que des pastilles de couleur : on voyait
 * qu'il se passait quelque chose le 14 sans savoir quoi, et il fallait cliquer
 * pour l'apprendre. Chaque case porte donc maintenant les titres, repliés
 * au-delà de trois par un « +N » qui ouvre le détail du jour.
 */
export function ReleaseMonthView(props: Props) {
  // Au téléphone, le mois compact (points + liste du jour) : sept colonnes de
  // titres n'y tiennent pas.
  return useIsPhone() ? <ReleaseMonthCompact {...props} /> : <ReleaseMonthGrid {...props} />;
}

function ReleaseMonthGrid({ items, cursor, onShift, onThisMonth, onOpen }: Props) {
  const { t } = useTranslation("seer");
  const ref = today();

  const [openDay, setOpenDay] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const bucket = map.get(it.date);
      if (bucket) bucket.push(it);
      else map.set(it.date, [it]);
    }
    return map;
  }, [items]);

  /* Cases repliées : une saison entière ne remplit pas la journée. */
  const collapsedByDate = useMemo(() => {
    const out = new Map<string, CollapsedItem[]>();
    for (const [date, list] of byDate) out.set(date, collapseSeriesInDay(list));
    return out;
  }, [byDate]);

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const initials = useMemo(() => weekdayInitials(), []);
  const firstOfMonth = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-01`;

  const shift = (delta: number) => {
    setOpenDay(null);
    onShift(delta);
  };

  const isCurrentMonth = ref.startsWith(
    `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`,
  );
  const dayItems = openDay ? byDate.get(openDay) ?? [] : [];

  return (
    <div className="pb-10">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => shift(-1)} aria-label={t("seer:releasesMonthPrev")} className={ICON_BUTTON}>
          <Chevron dir="left" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold capitalize text-tentacle-text-primary">
            {monthHeading(firstOfMonth)}
          </span>
          {!isCurrentMonth && (
            <button
              onClick={() => { setOpenDay(null); onThisMonth(); }}
              className="shrink-0 rounded-full bg-tentacle-fill-subtle px-2.5 py-1 text-[11px] font-medium text-tentacle-text-secondary ring-1 ring-tentacle-border-subtle transition-colors hover:bg-tentacle-fill-medium"
            >
              {t("seer:releasesThisMonth")}
            </button>
          )}
        </div>
        <button onClick={() => shift(1)} aria-label={t("seer:releasesMonthNext")} className={ICON_BUTTON}>
          <Chevron dir="right" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-tentacle-text-quaternary">
        {initials.map((d, i) => <span key={i}>{d}</span>)}
      </div>

      {/* Une sous-grille par semaine, pour pouvoir insérer le détail d'un jour
          JUSTE SOUS sa ligne. Rendu après toute la grille, il apparaissait
          plusieurs centaines de pixels plus bas — hors écran sur téléphone,
          donc invisible au moment même où l'on venait de cliquer. */}
      <div className="space-y-1">
        {weeks.map((week) => (
          <div key={week[0]}>
            <div className="grid grid-cols-7 gap-1">
              {week.map((date) => (
                <MonthCell
                  key={date}
                  date={date}
                  items={collapsedByDate.get(date) ?? []}
                  inMonth={Number(date.slice(5, 7)) === cursor.month + 1}
                  isToday={date === ref}
                  isOpen={date === openDay}
                  onExpand={() => setOpenDay(date === openDay ? null : date)}
                  onOpen={onOpen}
                />
              ))}
            </div>

            {openDay && week.includes(openDay) && dayItems.length > 0 && (
              <div className="mt-1.5" style={{ animation: "fadeSlideUp 200ms ease forwards" }}>
                <h3 className="mb-1.5 text-sm font-semibold text-tentacle-text-secondary">
                  {dayHeading(openDay, t)}
                </h3>
                <div className="space-y-2">
                  {dayItems.map((item) => <ReleaseRow key={item.id} item={item} onOpen={onOpen} />)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthCell({
  date, items, inMonth, isToday, isOpen, onExpand, onOpen,
}: {
  date: string;
  items: CollapsedItem[];
  inMonth: boolean;
  isToday: boolean;
  isOpen: boolean;
  onExpand: () => void;
  onOpen?: (item: CalendarItem) => void;
}) {
  const shown = items.slice(0, PER_CELL);
  const extra = items.length - shown.length;
  const dayNum = Number(date.slice(8, 10));

  return (
    <div
      className={`flex min-h-[76px] flex-col gap-0.5 rounded-lg p-1 transition-colors ${
        isOpen
          ? "bg-[var(--surface-2)] ring-1 ring-[rgba(var(--brand-rgb),0.6)]"
          : items.length > 0
            ? "bg-tentacle-fill-faint"
            : ""
      } ${isToday ? "ring-1 ring-[rgba(var(--brand-rgb),0.45)]" : ""}`}
    >
      <span
        className={`px-1 text-[11px] font-semibold tabular-nums ${
          isToday
            ? "text-[var(--brand-light)]"
            : inMonth
              ? "text-tentacle-text-tertiary"
              : "text-tentacle-text-disabled"
        }`}
      >
        {dayNum}
      </span>

      {shown.map((item) => (
        <ReleaseEntry key={item.id} item={item} density="month" onOpen={onOpen} />
      ))}

      {extra > 0 && (
        <button
          type="button"
          onClick={onExpand}
          className="mt-auto rounded px-1 text-left text-[10px] font-medium text-[var(--brand-light)] transition-colors hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
        >
          +{extra}
        </button>
      )}
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
