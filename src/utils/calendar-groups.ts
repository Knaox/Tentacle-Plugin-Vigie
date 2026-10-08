import type { CalendarItem } from "../api/types-releases";
import { parseAirDate, formatAirDateLong } from "./episode-dates";
import { getCurrentLanguage } from "./media-helpers";

/**
 * Toutes les dates sont des chaînes 'YYYY-MM-DD'. On ne les convertit jamais
 * avec `new Date(chaîne)` — cette forme est lue en temps universel et décale
 * l'affichage d'un jour en soirée. `parseAirDate` fait le découpage manuel.
 */

export interface DayGroup {
  date: string;
  items: CalendarItem[];
}

export function groupByDay(items: readonly CalendarItem[]): DayGroup[] {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const bucket = map.get(item.date);
    if (bucket) bucket.push(item);
    else map.set(item.date, [item]);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, list]) => ({ date, items: list }));
}

/** Aujourd'hui en 'YYYY-MM-DD' local. */
export function today(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addDays(day: string, delta: number): string {
  const parsed = parseAirDate(day);
  if (!parsed) return day;
  const next = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + delta);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${p(next.getMonth() + 1)}-${p(next.getDate())}`;
}

/** En-tête de jour : « Aujourd'hui », « Demain », sinon la date complète. */
export function dayHeading(
  date: string,
  t: (k: string) => string,
): string {
  const ref = today();
  if (date === ref) return t("seer:releasesToday");
  if (date === addDays(ref, 1)) return t("seer:releasesTomorrow");
  return formatAirDateLong(date);
}

/** « août 2026 » — séparateur de mois dans la liste. */
export function monthHeading(date: string): string {
  const parsed = parseAirDate(date);
  if (!parsed) return "";
  return new Intl.DateTimeFormat(getCurrentLanguage(), { month: "long", year: "numeric" }).format(parsed);
}

/** Premier jour du mois contenant `date`. */
export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Dernier jour du mois contenant `date`. */
export function endOfMonth(date: string): string {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(y, m, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

/**
 * Bornes de la GRILLE d'un mois : première et dernière cellule de
 * `monthMatrix`, cellules des mois voisins comprises. C'est cette plage-là
 * que la vue affiche réellement — la couvrir au 1er du mois laissait vides
 * les cases du lundi au bord de grille.
 */
export function monthGridBounds(year: number, month: number): { from: string; to: string } {
  const weeks = monthMatrix(year, month);
  return { from: weeks[0][0], to: weeks[weeks.length - 1][6] };
}

/** Lundi de la semaine contenant `date`. La semaine commence le lundi en France. */
export function startOfWeek(date: string): string {
  const parsed = parseAirDate(date);
  if (!parsed) return date;
  // getDay() : 0 = dimanche. On ramène lundi à 0.
  const offset = (parsed.getDay() + 6) % 7;
  return addDays(date, -offset);
}

/** Les sept jours de la semaine contenant `date`, du lundi au dimanche. */
export function weekDays(date: string): string[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** « 11 – 17 août 2026 » — l'intitulé d'une semaine, mois répété seulement si besoin. */
export function weekHeading(date: string): string {
  const days = weekDays(date);
  const from = parseAirDate(days[0]);
  const to = parseAirDate(days[6]);
  if (!from || !to) return "";

  const lang = getCurrentLanguage();
  const sameMonth = from.getMonth() === to.getMonth();
  const left = new Intl.DateTimeFormat(lang, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" }).format(from);
  const right = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(to);
  return `${left} – ${right}`;
}

/**
 * Matrice d'un mois pour la vue grille : semaines commençant le lundi,
 * cellules des mois voisins comprises pour que la grille reste pleine.
 */
export function monthMatrix(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  // getDay() : 0 = dimanche. On veut lundi en tête.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);

  const p = (n: number) => String(n).padStart(2, "0");
  const weeks: string[][] = [];

  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      week.push(`${cur.getFullYear()}-${p(cur.getMonth() + 1)}-${p(cur.getDate())}`);
    }
    weeks.push(week);
    // Six lignes ne sont nécessaires que pour les mois qui débordent vraiment.
    const last = week[6];
    if (w >= 4 && Number(last.slice(5, 7)) !== month + 1) break;
  }
  return weeks;
}

/** Initiales des jours de la semaine, lundi d'abord, dans la langue courante. */
export function weekdayInitials(): string[] {
  const fmt = new Intl.DateTimeFormat(getCurrentLanguage(), { weekday: "short" });
  // 2024-01-01 était un lundi.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
}
