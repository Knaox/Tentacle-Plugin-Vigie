import { useTranslation } from "react-i18next";
import type { SeerrSeason } from "../api/types";
import type { SeriesEpisodeStates } from "../api/types-releases";
import type { TitleStatus } from "../utils/title-state";
import { seasonName } from "../utils/media-helpers";
import { EpisodeList } from "./EpisodeList";
import { StateBadge } from "./ui/StateBadge";
import { CheckIcon, ChevronDown } from "./ui/icons";

interface SeasonRowProps {
  tvId: number;
  season: SeerrSeason;
  /** Où en est la saison (depuis ses épisodes quand Sonarr la suit) — `null` : libre. */
  status: TitleStatus | null;
  /** Mode demande : une case à cocher pour les saisons encore libres. */
  selectable: boolean;
  checked: boolean;
  onToggle: () => void;
  expanded: boolean;
  onExpandToggle: () => void;
  /** « S1E2 » → instant ISO, quand Sonarr suit la série. */
  airTimes?: Map<string, string>;
  episodeStates?: SeriesEpisodeStates;
  /** TMDB et Sonarr numérotent pareil ; sinon les épisodes se retrouvent par leur date. */
  sameNumbering?: boolean;
}

/**
 * Une saison : la cocher pour la demander (si elle est libre), lire son état,
 * la déplier sur ses épisodes — chacun avec sa date et son propre état.
 */
export function SeasonRow({
  tvId, season, status, selectable, checked, onToggle, expanded, onExpandToggle, airTimes, episodeStates, sameNumbering = true,
}: SeasonRowProps) {
  const { t } = useTranslation("seer");
  const free = status === null;
  const canCheck = selectable && free;

  return (
    <div className={`overflow-hidden rounded-2xl ring-1 transition-colors ${
      checked ? "bg-[var(--brand-soft)] ring-[rgba(var(--brand-rgb),0.45)]" : expanded ? "bg-tentacle-fill-subtle ring-tentacle-border-strong" : "bg-tentacle-fill-subtle ring-tentacle-border-subtle"
    }`}>
      <div className="flex min-h-[60px] items-center gap-2 pr-1.5">
        <button
          type="button"
          onClick={canCheck ? onToggle : onExpandToggle}
          aria-pressed={canCheck ? checked : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
        >
          {selectable && (
            canCheck ? (
              <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                checked ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-tentacle-border-strong"
              }`}>
                {checked && <CheckIcon className="h-3.5 w-3.5" />}
              </span>
            ) : <span aria-hidden className="w-5 shrink-0" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-tentacle-text-primary">{seasonName(season.name, season.seasonNumber, t)}</span>
            <span className="block text-xs text-tentacle-text-tertiary">
              {t("seer:episodeCount", { count: season.episodeCount })}
              {season.airDate && <> · {season.airDate.slice(0, 4)}</>}
            </span>
          </span>
        </button>

        {status && <StateBadge status={status} variant="chip" className="shrink-0" />}

        <button
          type="button"
          onClick={onExpandToggle}
          aria-expanded={expanded}
          aria-label={t("seer:episodesTitle")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-tentacle-text-tertiary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-tentacle-border-subtle px-3 pb-1" style={{ animation: "fadeIn 200ms ease" }}>
          <EpisodeList tvId={tvId} seasonNumber={season.seasonNumber} airTimes={airTimes} episodeStates={episodeStates} sameNumbering={sameNumbering} />
        </div>
      )}
    </div>
  );
}
