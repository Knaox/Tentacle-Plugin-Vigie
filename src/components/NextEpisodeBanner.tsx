import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { HubContext } from "../hub/HubContext";
import type { SeerrEpisode } from "../api/types";
import type { CalendarScope } from "../calendar/CalendarView";
import {
  formatAirDateLong, formatAirTime, localDayFromUtc, relativeAirLabel, daysUntil,
} from "../utils/episode-dates";
import { backdropUrl } from "../utils/media-helpers";
import { STATUS_STYLE } from "../styles/status";

/**
 * Bannière « Prochain épisode » : SxEy + titre + date complète localisée
 * + badge countdown. Affichée pour les séries en cours (nextEpisodeToAir TMDB).
 *
 * Quand Sonarr suit la série, l'heure exacte s'ajoute — et la date affichée
 * devient la vraie : celle de TMDB est celle du fuseau de la chaîne d'origine.
 */
export function NextEpisodeBanner({
  episode, airDateUtc, scope,
}: {
  episode: SeerrEpisode;
  airDateUtc?: string | null;
  /** Le calendrier où l'épisode figure : celui du serveur s'il est suivi. */
  scope?: CalendarScope;
}) {
  const { t } = useTranslation("seer");
  // Dans le hub : le calendrier, sur la semaine de cet épisode, est à un clic.
  const hub = useContext(HubContext);
  if (!episode.airDate) return null;

  const airDate = localDayFromUtc(airDateUtc) ?? episode.airDate;
  const time = formatAirTime(airDateUtc);
  const days = daysUntil(airDate);
  const relative = relativeAirLabel(airDate, t);
  const still = backdropUrl(episode.stillPath, "w300");
  const code = `S${episode.seasonNumber}E${episode.episodeNumber}`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[rgba(var(--brand-rgb),0.25)] bg-gradient-to-r from-[rgba(var(--brand-rgb),0.15)] via-[rgba(var(--brand-rgb),0.05)] to-transparent">
      <div className="flex items-center gap-4 p-4">
        {/* Vignette épisode */}
        {still ? (
          <img
            src={still}
            alt=""
            loading="lazy"
            className="hidden h-16 w-28 flex-shrink-0 rounded-lg object-cover sm:block"
          />
        ) : (
          <div className="hidden h-16 w-28 flex-shrink-0 items-center justify-center rounded-lg bg-tentacle-fill-subtle sm:flex">
            <svg className="h-6 w-6 text-tentacle-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v12.75c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-tentacle-brand-light">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {t("seer:nextEpisodeTitle")}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-tentacle-text-primary">
            <span className="text-tentacle-text-tertiary">{code}</span>
            {episode.name && <span> · {episode.name}</span>}
          </p>
          <p className="mt-0.5 text-xs capitalize text-tentacle-text-tertiary">
            {time
              ? t("seer:episodeAirTime", { date: formatAirDateLong(airDate), time })
              : formatAirDateLong(airDate)}
          </p>
        </div>

        {/* Countdown */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          {relative && (
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                days != null && days <= 1
                  ? STATUS_STYLE.available.chip
                  : STATUS_STYLE.approved.chip
              }`}
            >
              {relative}
            </span>
          )}
          {hub && (
            <button
              type="button"
              onClick={() => hub.openCalendar(airDate, scope)}
              className="min-h-[32px] rounded-full px-2 text-xs font-semibold text-[var(--brand-light)] underline-offset-2 hover:underline"
            >
              {t("seer:openCalendar")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
