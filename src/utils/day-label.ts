/* ------------------------------------------------------------------ */
/*  Vigie — Un jour, dit court                                         */
/* ------------------------------------------------------------------ */

import { parseAirDate } from "./episode-dates";
import { addDays, today } from "./calendar-groups";
import { getCurrentLanguage } from "./media-helpers";

type Translate = (key: string) => string;

/** « Aujourd'hui », « Demain », sinon « jeu. 25 » — pour une vignette ou une pastille. */
export function shortDayLabel(date: string, t: Translate): string {
  const ref = today();
  if (date === ref) return t("seer:releasesToday");
  if (date === addDays(ref, 1)) return t("seer:releasesTomorrow");
  const parsed = parseAirDate(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat(getCurrentLanguage(), { weekday: "short", day: "numeric" }).format(parsed);
}

/** « jeudi 25 septembre » — un en-tête de jour. */
export function longDayLabel(date: string): string {
  const parsed = parseAirDate(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat(getCurrentLanguage(), { weekday: "long", day: "numeric", month: "long" }).format(parsed);
}
