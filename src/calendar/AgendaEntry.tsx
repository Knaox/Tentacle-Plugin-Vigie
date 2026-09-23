/* ------------------------------------------------------------------ */
/*  Vigie — Une sortie dans l'agenda                                   */
/* ------------------------------------------------------------------ */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../api/types-releases";
import type { CollapsedItem } from "../utils/calendar-collapse";
import { posterUrl } from "../utils/media-helpers";
import { episodeLabel, KIND_I18N, KIND_ICON } from "../utils/calendar-kind";
import { formatAirTime } from "../utils/episode-dates";
import { groupStatus } from "../utils/title-state";
import { statusText } from "../utils/state-labels";
import { StateBadge } from "../components/ui/StateBadge";
import { ClockIcon } from "../components/ui/icons";

/**
 * Une ligne : l'affiche, le titre, ce qui sort (« S2E4 », « Au cinéma »,
 * « En streaming »), l'heure quand on la connaît, la chaîne — et où en est
 * CETTE sortie : demandé, en route, bloqué, disponible. Visible au téléphone
 * aussi : l'état s'y cachait faute de place à droite. Une saison publiée d'un
 * coup ne fait qu'une ligne (« S5E1–E8 »).
 */
export const AgendaEntry = memo(function AgendaEntry({ item, onOpen }: {
  item: CollapsedItem;
  onOpen: (item: CalendarItem) => void;
}) {
  const { t } = useTranslation("seer");
  const poster = posterUrl(item.posterPath, "w185");
  const what = item.kind === "episode"
    ? item.rangeLabel ?? episodeLabel(item.seasonNumber, item.episodeNumber)
    : t(KIND_I18N[item.kind]);
  const time = formatAirTime(item.airDateUtc);
  const status = groupStatus(item.group);
  const KindIcon = KIND_ICON[item.kind];

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={[item.title, what, status ? statusText(status, t) : ""].filter(Boolean).join(" — ")}
      style={status ? { boxShadow: `inset 3px 0 0 var(--vg-${status.state}-solid)` } : undefined}
      className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-tentacle-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] sm:gap-4"
    >
      <span className="block h-[72px] w-12 shrink-0 overflow-hidden rounded-lg bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle">
        {poster && <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-tentacle-text-primary">{item.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tentacle-text-tertiary">
          <span className="inline-flex items-center gap-1 rounded-full bg-tentacle-fill-soft px-2 py-0.5 text-[11px] font-semibold text-tentacle-text-secondary">
            <KindIcon className="h-3.5 w-3.5" />
            {what}
          </span>
          {time && <span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" />{time}</span>}
          {item.networks && <span className="truncate">{item.networks}</span>}
        </span>
        {status && <StateBadge status={status} variant="chip" className="mt-1.5 sm:hidden" />}
      </span>
      {status && <StateBadge status={status} variant="chip" className="hidden shrink-0 sm:inline-flex" />}
    </button>
  );
});
