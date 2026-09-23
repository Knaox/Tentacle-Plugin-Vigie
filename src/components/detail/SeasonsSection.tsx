/* ------------------------------------------------------------------ */
/*  Vigie — Les saisons d'une série : leur état, et les demander        */
/* ------------------------------------------------------------------ */

/*
 * UNE liste pour tout : chaque saison dit où elle en est (depuis ses
 * épisodes quand Sonarr suit la série — « En partie » pour une saison en
 * cours de diffusion), se déplie sur ses épisodes et leur propre état, et se
 * coche si elle est encore libre. Le bouton de demande n'apparaît que s'il
 * reste quelque chose à demander.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSeason } from "../../api/types";
import type { SeriesEpisodeStates } from "../../api/types-releases";
import { numberingMatches, seasonStatus } from "../../utils/season-status";
import { CTA_PRIMARY, CTA_PRIMARY_HALO } from "../../styles/cta";
import { SeasonRow } from "../SeasonRow";
import { ProfileSelector } from "../ProfileSelector";

interface Props {
  tvId: number;
  seasons: SeerrSeason[];
  /** Numéro de saison → statut Jellyseerr (cf. seasonLocks). */
  locks: Map<number, number>;
  episodeStates?: SeriesEpisodeStates;
  airTimes: Map<string, string>;
  onRequest: (seasons: number[], profileId: string | null) => void;
  requesting: boolean;
  isAnime: boolean;
  defaultProfileId?: string | null;
}

export function SeasonsSection({
  tvId, seasons, locks, episodeStates, airTimes, onRequest, requesting, isAnime, defaultProfileId,
}: Props) {
  const { t } = useTranslation("seer");
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [profileId, setProfileId] = useState<string | null>(defaultProfileId ?? null);

  const shown = seasons.filter((s) => s.seasonNumber > 0);
  // Un animé en une saison chez TMDB, en quatre chez Sonarr : les épisodes se
  // retrouvent par leur date, la saison garde l'état que Jellyseerr lui donne.
  const sameNumbering = numberingMatches(episodeStates, shown.length);
  const rows = shown.map((season) => ({
    season,
    status: seasonStatus(season.seasonNumber, season.episodeCount, locks.get(season.seasonNumber), episodeStates, sameNumbering),
  }));
  // Libre : ni là, ni demandée chez Jellyseerr (les épisodes n'y changent rien).
  const free = rows.filter((r) => locks.get(r.season.seasonNumber) === undefined).map((r) => r.season.seasonNumber);
  const allChosen = free.length > 0 && free.every((n) => selected.has(n));

  const toggle = (n: number) => setSelected((cur) => {
    const next = new Set(cur);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });

  return (
    <div className="space-y-3">
      {free.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSelected(allChosen ? new Set() : new Set(free))}
            className="min-h-[36px] rounded-full px-3 text-[13px] font-semibold text-[var(--brand-light)] transition-colors hover:bg-tentacle-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
          >
            {allChosen ? t("seer:selectNone") : t("seer:quickSeasonsAll", { count: free.length })}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {rows.map(({ season, status }) => (
          <SeasonRow
            key={season.seasonNumber}
            tvId={tvId}
            season={season}
            // Une saison libre n'a pas d'état ; une saison prise, le sien.
            status={free.includes(season.seasonNumber) ? null : status ?? { state: "requested", percent: null }}
            selectable={free.length > 0}
            checked={selected.has(season.seasonNumber)}
            onToggle={() => toggle(season.seasonNumber)}
            expanded={expanded === season.seasonNumber}
            onExpandToggle={() => setExpanded((cur) => (cur === season.seasonNumber ? null : season.seasonNumber))}
            airTimes={airTimes}
            episodeStates={episodeStates}
            sameNumbering={sameNumbering}
          />
        ))}
      </div>

      {free.length > 0 && (
        <div className="space-y-3 pt-1">
          <ProfileSelector mediaType="tv" isAnime={isAnime} selectedId={profileId} onChange={setProfileId} />
          <button
            type="button"
            onClick={() => onRequest([...selected].sort((a, b) => a - b), profileId)}
            disabled={selected.size === 0 || requesting}
            style={CTA_PRIMARY_HALO}
            className={`${CTA_PRIMARY} min-h-[48px] w-full`}
          >
            {requesting ? t("seer:sending")
              : selected.size === 0 ? t("seer:selectSeasonsPrompt")
                : t("seer:requestSeasons", { count: selected.size })}
          </button>
        </div>
      )}
    </div>
  );
}
