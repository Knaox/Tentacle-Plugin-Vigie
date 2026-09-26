/* ------------------------------------------------------------------ */
/*  Vigie — « il y a 4 min », « hier » : une date dite de près           */
/* ------------------------------------------------------------------ */

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;

/** La date par rapport à maintenant, dans la langue voulue ; `null` si illisible. */
export function relativeTime(iso: string | null | undefined, lang: string, now = Date.now()): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  const diff = (at - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (abs < 45) return rtf.format(0, "second");
  if (abs < 45 * MINUTE) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (abs < 22 * HOUR) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 26 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  if (abs < 320 * DAY) return rtf.format(Math.round(diff / (30 * DAY)), "month");
  return rtf.format(Math.round(diff / (365 * DAY)), "year");
}
