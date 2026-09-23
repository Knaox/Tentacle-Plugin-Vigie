import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "../../api/types-releases";
import type { CollapsedItem } from "../../utils/calendar-collapse";
import { posterUrl } from "../../utils/media-helpers";
import { KIND_I18N, KIND_ICON, episodeLabel } from "../../utils/calendar-kind";
import { formatAirTime } from "../../utils/episode-dates";
import { groupStatus } from "../../utils/title-state";
import { statusText } from "../../utils/state-labels";
import { StateBadge } from "../ui/StateBadge";
import { PlatformBadges } from "../PlatformBadges";
import { PosterImage } from "../PosterImage";

/**
 * Une sortie dans l'agenda. Affiche, titre, épisode, heure, plateformes — et
 * où en est CET épisode : demandé, en route, bloqué, disponible. C'est ce qui
 * manquait : « la saison 4 est demandée » ne disait pas si l'épisode 18, sorti
 * hier, était arrivé. Un filet de la couleur de l'état borde l'entrée : une
 * semaine se parcourt d'un regard.
 *
 * Deux densités : `week` (colonne de semaine, l'affiche a de la place) et
 * `month` (case de grille mensuelle, ~90 px de large — texte seul, le point de
 * tête prend la couleur de l'état ; le mot complet est dans le libellé).
 */

interface Props {
  item: CollapsedItem;
  density?: "week" | "month";
  onOpen?: (item: CalendarItem) => void;
}

export const ReleaseEntry = memo(function ReleaseEntry({ item, density = "week", onOpen }: Props) {
  const { t } = useTranslation("seer");
  const status = groupStatus(item.group);
  // Une saison lâchée d'un coup s'affiche « S5E1–E8 », pas dix fois le titre.
  const ep = item.rangeLabel ?? episodeLabel(item.seasonNumber, item.episodeNumber);
  const label = [`${item.title}${ep ? ` ${ep}` : ""}`, t(KIND_I18N[item.kind]), status ? statusText(status, t) : ""]
    .filter(Boolean).join(" — ");
  const edge = status ? { boxShadow: `inset 3px 0 0 var(--vg-${status.state}-solid)` } : undefined;

  if (density === "month") {
    return (
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        title={label}
        aria-label={label}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
      >
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-full ${status ? "" : "bg-tentacle-fill-strong"}`}
          style={status ? { background: `var(--vg-${status.state}-solid)` } : undefined}
        />
        <span className="truncate text-[10px] leading-tight text-tentacle-text-secondary">{item.title}</span>
      </button>
    );
  }

  // 40 × 56 dans une case de calendrier : la miniature suffit.
  const poster = posterUrl(item.posterPath, "w154");
  const KindIcon = KIND_ICON[item.kind];
  const time = formatAirTime(item.airDateUtc);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      aria-label={label}
      style={edge}
      className="group flex w-full gap-2 rounded-lg bg-tentacle-fill-subtle p-1.5 text-left ring-1 ring-tentacle-border-subtle transition-colors duration-150 hover:bg-tentacle-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
    >
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-tentacle-surface-2">
        {poster && <PosterImage src={poster} width={40} height={56} />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-tentacle-text-primary">
          {item.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded bg-tentacle-fill-soft px-1 py-px text-[10px] font-semibold text-tentacle-text-secondary">
            <KindIcon className="h-3 w-3" />
            {ep || t(KIND_I18N[item.kind])}
          </span>
          {/* L'heure quand Sonarr la connaît — sinon rien, jamais d'invention. */}
          {time && <span className="text-[10px] tabular-nums text-tentacle-text-tertiary">{time}</span>}
          <PlatformBadges providerIds={item.providerIds} max={2} size="sm" />
        </div>

        {status && <StateBadge status={status} variant="text" className="mt-1 !text-[11px]" />}
      </div>
    </button>
  );
});
