import { useTranslation } from "react-i18next";
import type { SeriesEpisodeStates } from "../api/types-releases";
import { useTvSeasonEpisodes } from "../hooks/useTvSeasonEpisodes";
import { airTimeKey } from "../hooks/useAirTimes";
import { episodeStatus } from "../utils/season-status";
import {
  formatAirDateShort, formatAirTime, localDayFromUtc, relativeAirLabel, daysUntil,
} from "../utils/episode-dates";
import { StateBadge } from "./ui/StateBadge";

/**
 * Épisodes d'une saison dépliée : numéro, titre, date de diffusion localisée
 * — et l'état de CHAQUE épisode quand Sonarr suit la série : disponible, en
 * route (avec son avancement), bloqué, demandé. « La saison 4 est demandée »
 * ne disait pas si l'épisode 18 était arrivé.
 *
 * Quand Sonarr suit la série, la date affichée est la VRAIE : celle de TMDB est
 * celle du fuseau de la chaîne, et tombe souvent un jour trop tard.
 */
interface Props {
  tvId: number;
  seasonNumber: number;
  /** « S1E2 » → instant ISO. Vide quand Sonarr ne connaît pas la série. */
  airTimes?: Map<string, string>;
  /** L'état de chaque épisode, d'après Sonarr. */
  episodeStates?: SeriesEpisodeStates;
  /** Faux : TMDB et Sonarr ne numérotent pas pareil, l'épisode se retrouve par sa date. */
  sameNumbering?: boolean;
}

export function EpisodeList({ tvId, seasonNumber, airTimes, episodeStates, sameNumbering = true }: Props) {
  const { t } = useTranslation("seer");
  const { data: episodes, isLoading, isError } = useTvSeasonEpisodes(tvId, seasonNumber);

  if (isLoading) {
    return (
      <div className="space-y-2 py-2" aria-hidden>
        {/* Statique : un squelette n'a pas à s'animer (règle GPU du projet). */}
        {[0, 1, 2].map((i) => <div key={i} className="h-11 rounded-xl bg-tentacle-fill-subtle" />)}
      </div>
    );
  }

  if (isError || !episodes || episodes.length === 0) {
    return <p className="py-3 text-center text-xs text-tentacle-text-quaternary">{t("seer:noEpisodeDates")}</p>;
  }

  return (
    <ul className="divide-y divide-tentacle-border-subtle">
      {episodes.map((ep) => {
        const season = ep.seasonNumber ?? seasonNumber;
        const at = airTimes?.get(airTimeKey(season, ep.episodeNumber));
        // Le jour réel prime : l'heure de Sonarr peut le faire basculer.
        const airDate = localDayFromUtc(at) ?? ep.airDate;
        const time = formatAirTime(at);
        const days = daysUntil(airDate);
        const upcoming = days != null && days >= 0;
        // La date de la chaîne (celle de TMDB), la même que celle que Sonarr retient.
        const status = episodeStatus(episodeStates, season, ep.episodeNumber, ep.airDate, sameNumbering);
        return (
          <li key={ep.id} className="flex min-h-[52px] items-center gap-3 py-2">
            <span className={`w-7 shrink-0 text-right text-xs font-bold tabular-nums ${upcoming ? "text-[var(--brand-light)]" : "text-tentacle-text-tertiary"}`}>
              {ep.episodeNumber}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[13px] font-semibold ${upcoming ? "text-tentacle-text-primary" : "text-tentacle-text-secondary"}`}>
                {ep.name || t("seer:episodeFallback", { number: ep.episodeNumber })}
              </p>
              {airDate && (
                <p className="text-[11px] text-tentacle-text-tertiary">
                  {time ? t("seer:episodeAirTime", { date: formatAirDateShort(airDate), time }) : formatAirDateShort(airDate)}
                  {upcoming && status && <span className="font-semibold text-[var(--brand-light)]"> · {relativeAirLabel(airDate, t)}</span>}
                </p>
              )}
            </div>
            {status ? (
              <StateBadge status={status} variant="chip" className="shrink-0" />
            ) : upcoming ? (
              <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-light)]">
                {relativeAirLabel(airDate, t)}
              </span>
            ) : !airDate ? (
              <span className="shrink-0 text-[11px] text-tentacle-text-quaternary">{t("seer:dateTba")}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
