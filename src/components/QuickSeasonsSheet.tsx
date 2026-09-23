/* ------------------------------------------------------------------ */
/*  Vigie — Demander des saisons, sans ouvrir la fiche                  */
/* ------------------------------------------------------------------ */

/*
 * Le « + » d'une affiche de série : les saisons qu'on peut encore demander,
 * cochées d'un geste, et « Demander ». Celles qui sont déjà là ou déjà
 * demandées restent visibles, verrouillées, avec leur état — on sait ce qui
 * manque avant de choisir. La fiche complète reste à un clic.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult, SeerrTvDetail } from "../api/types";
import { formatSeerError } from "../api/seer-client";
import { useMediaDetail } from "../hooks/useMediaDetail";
import { useLocalRequestedSeasons } from "../hooks/useLocalRequestedSeasons";
import { useRequestMedia } from "../hooks/useRequestMedia";
import { useToast } from "../hooks/useToast";
import { isRequestedSeasonStatus } from "../utils/media-status";
import { isAnimeTitle, seasonLocks } from "../utils/season-locks";
import { mediaTitle, mediaYear, posterUrl, seasonName } from "../utils/media-helpers";
import type { TitleStatus } from "../utils/title-state";
import { CTA_PRIMARY, CTA_SECONDARY, CTA_SIZE_LG } from "../styles/cta";
import { Sheet } from "./ui/Sheet";
import { StateBadge } from "./ui/StateBadge";
import { CheckIcon } from "./ui/icons";
import { ProfileSelector } from "./ProfileSelector";

function lockStatus(status: number | undefined): TitleStatus | null {
  if (status === 5) return { state: "available", percent: null };
  if (status === 4) return { state: "partial", percent: null };
  return isRequestedSeasonStatus(status) ? { state: "requested", percent: null } : null;
}

export function QuickSeasonsSheet({ item, onClose, onOpenDetail }: {
  item: SeerrSearchResult;
  onClose: () => void;
  onOpenDetail: (item: SeerrSearchResult) => void;
}) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const requestMedia = useRequestMedia();
  const { data, isPending } = useMediaDetail("tv", item.id);
  const detail = data as SeerrTvDetail | undefined;
  const { data: localSeasons } = useLocalRequestedSeasons("tv", item.id);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [profileId, setProfileId] = useState<string | null>(null);

  const title = mediaTitle(item) || detail?.name || t("seer:untitled");
  const locks = useMemo(() => seasonLocks(detail?.mediaInfo, localSeasons), [detail?.mediaInfo, localSeasons]);
  const seasons = (detail?.seasons ?? []).filter((s) => s.seasonNumber > 0);
  const free = seasons.filter((s) => lockStatus(locks.get(s.seasonNumber)) === null).map((s) => s.seasonNumber);
  const allChosen = free.length > 0 && free.every((n) => selected.has(n));
  const poster = posterUrl(item.posterPath ?? detail?.posterPath, "w185");

  const toggle = (n: number) => setSelected((cur) => {
    const next = new Set(cur);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });

  const submit = () => {
    const chosen = [...selected].sort((a, b) => a - b);
    requestMedia.mutate({
      mediaType: "tv", tmdbId: item.id, title,
      posterPath: item.posterPath ?? detail?.posterPath, backdropPath: item.backdropPath ?? detail?.backdropPath,
      overview: item.overview ?? detail?.overview, year: mediaYear(item), seasons: chosen, profileId,
    }, {
      onSuccess: () => {
        toast.show("success", t("seer:quickSeasonsDone", { title, count: chosen.length }), posterUrl(item.posterPath, "w92"));
        onClose();
      },
      onError: (err) => toast.show("error", formatSeerError(err, t, "seer:requestError")),
    });
  };

  const footer = (
    <div className="flex flex-col gap-2 sm:flex-row-reverse">
      <button
        type="button"
        onClick={submit}
        disabled={selected.size === 0 || requestMedia.isPending}
        className={`${CTA_PRIMARY} ${CTA_SIZE_LG} flex-1`}
      >
        {requestMedia.isPending ? t("seer:sending")
          : selected.size === 0 ? t("seer:selectSeasonsPrompt")
            : t("seer:requestSeasons", { count: selected.size })}
      </button>
      <button type="button" onClick={() => onOpenDetail(item)} className={`${CTA_SECONDARY} ${CTA_SIZE_LG}`}>
        {t("seer:moreInfo")}
      </button>
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={title} size="sm" footer={footer}>
      <div className="flex items-center gap-3">
        <span className="block h-[72px] w-12 shrink-0 overflow-hidden rounded-lg bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle">
          {poster && <img src={poster} alt="" className="h-full w-full object-cover" />}
        </span>
        <p className="text-sm text-tentacle-text-tertiary">{t("seer:quickSeasonsHint")}</p>
      </div>

      {isPending ? (
        <div className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-tentacle-fill-subtle" />)}
        </div>
      ) : free.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-tentacle-fill-subtle p-4 text-center text-sm font-semibold text-tentacle-text-secondary">
          {t("seer:allSeasonsRequested")}
        </p>
      ) : (
        <div className="mt-4 space-y-1.5">
          {free.length > 1 && (
            <button
              type="button"
              onClick={() => setSelected(allChosen ? new Set() : new Set(free))}
              aria-pressed={allChosen}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold text-[var(--brand-light)] transition-colors hover:bg-tentacle-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
            >
              <Box checked={allChosen} />
              {t("seer:quickSeasonsAll", { count: free.length })}
            </button>
          )}
          {seasons.map((season) => {
            const status = lockStatus(locks.get(season.seasonNumber));
            const checked = selected.has(season.seasonNumber);
            return (
              <button
                key={season.seasonNumber}
                type="button"
                disabled={status !== null}
                onClick={() => toggle(season.seasonNumber)}
                aria-pressed={status === null ? checked : undefined}
                className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] disabled:cursor-default ${
                  checked ? "bg-[var(--brand-soft)] ring-[rgba(var(--brand-rgb),0.45)]" : "bg-tentacle-fill-subtle ring-tentacle-border-subtle hover:bg-tentacle-fill-soft disabled:hover:bg-tentacle-fill-subtle"
                }`}
              >
                {status === null ? <Box checked={checked} /> : <span aria-hidden className="w-5 shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-tentacle-text-primary">
                    {seasonName(season.name, season.seasonNumber, t)}
                  </span>
                  <span className="block text-xs text-tentacle-text-tertiary">
                    {t("seer:episodeCount", { count: season.episodeCount })}
                    {season.airDate && <> · {season.airDate.slice(0, 4)}</>}
                  </span>
                </span>
                {status && <StateBadge status={status} variant="chip" className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {free.length > 0 && (
        <div className="mt-4">
          <ProfileSelector mediaType="tv" isAnime={isAnimeTitle(detail, item)} selectedId={profileId} onChange={setProfileId} />
        </div>
      )}
    </Sheet>
  );
}

function Box({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
        checked ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-tentacle-border-strong"
      }`}
    >
      {checked && <CheckIcon className="h-3.5 w-3.5" />}
    </span>
  );
}
