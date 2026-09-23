/* ------------------------------------------------------------------ */
/*  Vigie — Le meilleur résultat, en grand                             */
/* ------------------------------------------------------------------ */

/*
 * Quand la requête désigne clairement un titre (« dune », « interstelar »),
 * il mérite mieux qu'une affiche parmi d'autres : son image, son résumé, et
 * l'action qui répond à la question qu'on se pose — Demander s'il n'est pas
 * là, Regarder s'il y est —, son état et, s'il n'est là qu'en partie, ce qui
 * lui manque. Une personne (« nolan ») s'y montre avec ce pour quoi on la
 * connaît.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import type { SearchPerson } from "../api/types-search";
import { backdropUrl, mediaTitle, mediaYear, posterUrl, profileUrl } from "../utils/media-helpers";
import { mediaStateOf } from "../utils/media-status";
import { navigateToMedia } from "../utils/navigate-media";
import { CTA_PRIMARY, CTA_SECONDARY, CTA_SIZE_MD } from "../styles/cta";
import { useHub } from "../hub/HubContext";
import { useTitleGaps, useTitleStatus } from "../hub/TitleStates";
import { gapText } from "../utils/series-gaps";
import { StateBadge } from "../components/ui/StateBadge";
import { PlayIcon, PlusIcon, StarIcon, UserIcon } from "../components/ui/icons";

export const TopMediaResult = memo(function TopMediaResult({ item }: { item: SeerrSearchResult }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const title = mediaTitle(item);
  const state = mediaStateOf(item.mediaInfo?.status);
  const status = useTitleStatus(item);
  const gaps = useTitleGaps(item);
  const gap = status?.state === "partial" ? gapText(gaps, t, "long") : null;
  const backdrop = backdropUrl(item.backdropPath, "w780");
  const poster = posterUrl(item.posterPath, "w342");
  const meta = [
    item.mediaType === "tv" ? t("seer:typeSeries") : t("seer:typeMovie"),
    mediaYear(item),
  ].filter(Boolean).join(" · ");
  const open = () => hub.openMedia(item);

  return (
    <article className="relative overflow-hidden rounded-3xl bg-tentacle-surface-1 ring-1 ring-tentacle-border-subtle">
      {backdrop && (
        <img src={backdrop} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-40" />
      )}
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(90deg, var(--surface-1) 0%, rgba(var(--scrim-media-rgb),0.35) 60%, transparent 100%)" }} />
      {/* Tout le panneau ouvre la fiche ; les boutons d'action passent au-dessus. */}
      <button type="button" onClick={open} aria-label={t("seer:openDetails", { title })} className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(var(--brand-rgb),0.7)]" />
      <div className="pointer-events-none relative z-10 flex gap-4 p-4 sm:gap-6 sm:p-6">
        {poster && <img src={poster} alt="" className="h-36 w-24 shrink-0 rounded-xl object-cover shadow-tentacle-elev-2 sm:h-48 sm:w-32" />}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--brand-light)]">{t("seer:topResult")}</p>
          <h2 className="mt-1 line-clamp-2 text-xl font-bold leading-tight text-tentacle-text-primary sm:text-3xl">{title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-tentacle-text-secondary">
            <span>{meta}</span>
            {(item.voteAverage ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1"><StarIcon className="h-3.5 w-3.5 text-[var(--seer-st-rating-solid)]" />{item.voteAverage?.toFixed(1)}</span>
            )}
          </p>
          {status && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <StateBadge status={status} variant="chip" />
              {gap && <span className="text-xs font-medium text-tentacle-text-secondary">{gap}</span>}
            </div>
          )}
          {item.overview && <p className="mt-2 hidden text-sm leading-relaxed text-tentacle-text-tertiary sm:line-clamp-2">{item.overview}</p>}
          <div className="pointer-events-auto mt-3 flex flex-wrap gap-2">
            {state === "available" || state === "partial" ? (
              <button type="button" onClick={() => void navigateToMedia(item.id, item.mediaType)} className={`${CTA_PRIMARY} ${CTA_SIZE_MD} gap-2`}>
                <PlayIcon className="h-4 w-4" />{t("seer:watch")}
              </button>
            ) : state === null && item.mediaType === "movie" ? (
              <button type="button" onClick={() => hub.quickRequest(item)} className={`${CTA_PRIMARY} ${CTA_SIZE_MD} gap-2`}>
                <PlusIcon className="h-4 w-4" />{t("seer:request")}
              </button>
            ) : state === null ? (
              <button type="button" onClick={open} className={`${CTA_PRIMARY} ${CTA_SIZE_MD} gap-2`}>
                <PlusIcon className="h-4 w-4" />{t("seer:chooseSeasons")}
              </button>
            ) : (
              <span className="inline-flex h-10 items-center rounded-full bg-tentacle-fill-soft px-4 text-sm font-semibold text-tentacle-text-secondary">
                {t(state === "processing" ? "seer:stateProcessing" : "seer:stateRequested")}
              </span>
            )}
            <button type="button" onClick={open} className={`${CTA_SECONDARY} ${CTA_SIZE_MD}`}>{t("seer:moreInfo")}</button>
          </div>
        </div>
      </div>
    </article>
  );
});

export const TopPersonResult = memo(function TopPersonResult({ person }: { person: SearchPerson }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const photo = profileUrl(person.profilePath, "w185");
  const known = person.knownFor.slice(0, 4);

  return (
    <article className="flex flex-col gap-4 rounded-3xl bg-tentacle-surface-1 p-4 ring-1 ring-tentacle-border-subtle sm:flex-row sm:items-center sm:p-6">
      <button type="button" onClick={() => hub.openPerson(person.id)} className="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-none">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-tentacle-surface-2 ring-2 ring-[rgba(var(--brand-rgb),0.5)] sm:h-24 sm:w-24">
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <UserIcon className="h-9 w-9 text-tentacle-text-disabled" />}
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--brand-light)]">{t("seer:topResult")}</span>
          <span className="mt-1 block truncate text-xl font-bold text-tentacle-text-primary sm:text-2xl">{person.name}</span>
          {person.knownForDepartment && <span className="block text-sm text-tentacle-text-tertiary">{t(`seer:dept_${person.knownForDepartment}`, person.knownForDepartment)}</span>}
          <span className="mt-2 inline-flex text-sm font-semibold text-[var(--brand-light)]">{t("seer:seeFilmography")} →</span>
        </span>
      </button>
      {known.length > 0 && (
        <div className="flex gap-2">
          {known.map((m) => (
            <button key={`${m.mediaType}:${m.id}`} type="button" onClick={() => hub.openMedia(m)} title={mediaTitle(m)} className="w-16 shrink-0 overflow-hidden rounded-lg bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle sm:w-20">
              {m.posterPath ? <img src={posterUrl(m.posterPath, "w185")} alt={mediaTitle(m)} className="aspect-[2/3] w-full object-cover" /> : <span className="block aspect-[2/3]" />}
            </button>
          ))}
        </div>
      )}
    </article>
  );
});
