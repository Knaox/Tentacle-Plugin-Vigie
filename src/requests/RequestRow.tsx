/* ------------------------------------------------------------------ */
/*  Vigie — Une demande, en une ligne                                  */
/* ------------------------------------------------------------------ */

/*
 * L'affiche, le titre, l'ÉTAT (le badge commun à tout Vigie : demandé, en
 * route, bloqué, disponible, en partie) et sa nuance — avec la barre
 * d'avancement quand quelque chose arrive, ce qui manque encore quand elle
 * n'est là qu'en partie (parmi SES saisons), et le prochain épisode quand la
 * série en attend un (le calendrier, là où on le cherche). Une seule action à
 * portée de main ; le reste est derrière « ⋯ ». Au téléphone, cette action
 * reste là, réduite à son icône : « Regarder » sans ouvrir la fiche.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import type { ProgressItem } from "../api/types-releases";
import { posterUrl } from "../utils/media-helpers";
import { gapText, restrictGaps } from "../utils/series-gaps";
import { useTitleGaps } from "../hub/TitleStates";
import { CTA_PRIMARY, CTA_SECONDARY } from "../styles/cta";
import { CalendarIcon, CheckIcon, DotsIcon, PlayIcon, RetryIcon } from "../components/ui/icons";
import { RequestProgressBar } from "../components/RequestProgressBar";
import { StateBadge } from "../components/ui/StateBadge";
import { PHRASE_TONE, requestView } from "./requestPhrase";
import type { RequestAction } from "./RequestActionsSheet";

interface Props {
  request: LocalRequest;
  progress?: ProgressItem;
  receivedAt: string | null;
  /** « jeu. 25 · S2E4 » — la prochaine sortie de cette série, si le calendrier en connaît une. */
  nextRelease?: string | null;
  onAction: (action: RequestAction, request: LocalRequest) => void;
  onMenu: (request: LocalRequest) => void;
  onNextRelease?: () => void;
  /** Mode sélection : une case à cocher remplace les actions. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const RequestRow = memo(function RequestRow(props: Props) {
  const { request, progress, receivedAt, nextRelease, onAction, onMenu, onNextRelease, selectable, selected, onToggleSelect } = props;
  const { t } = useTranslation("seer");
  const { status, detail } = requestView(request, progress);
  const gaps = useTitleGaps({ id: request.tmdbId, mediaType: request.mediaType });
  // En partie là : ce qui manque parmi les saisons DEMANDÉES, pas celles de toute la série.
  const gap = !detail && status?.state === "partial" ? gapText(restrictGaps(gaps, request.seasons), t, "long") : null;
  const poster = posterUrl(request.posterPath, "w185");
  const date = new Date(request.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const canSelect = !["deleting", "processing"].includes(request.status);
  const seasons = request.seasons && request.seasons.length > 0
    ? t("seer:seasonsShort", { seasons: request.seasons.join(", "), count: request.seasons.length }) : null;

  const primary = request.status === "available" || request.status === "partially_available"
    ? { action: "watch" as const, label: t("seer:watch"), icon: <PlayIcon className="h-4 w-4" />, style: CTA_PRIMARY }
    : request.status === "failed"
      ? { action: "retry" as const, label: t("seer:retry"), icon: <RetryIcon className="h-4 w-4" />, style: CTA_SECONDARY }
      : null;

  return (
    <li className={`rounded-2xl p-2.5 transition-colors sm:p-3 ${selected ? "bg-[var(--brand-soft)] ring-1 ring-[rgba(var(--brand-rgb),0.5)]" : "hover:bg-tentacle-fill-subtle"}`}>
      <div className="flex items-center gap-3 sm:gap-4">
      {selectable && (
        <button
          type="button"
          onClick={() => canSelect && onToggleSelect?.(request.id)}
          disabled={!canSelect}
          aria-pressed={selected}
          aria-label={t("seer:selectRequest", { title: request.title })}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors disabled:opacity-40 ${selected ? "border-tentacle-brand bg-tentacle-brand text-tentacle-cta-brand-fg" : "border-tentacle-border-strong"}`}
        >
          {selected && <CheckIcon className="h-4 w-4" />}
        </button>
      )}
      {/* En mode sélection, toute la ligne sélectionne : ouvrir la fiche en
          voulant cocher une demande était le piège. */}
      <button
        type="button"
        onClick={() => (selectable ? canSelect && onToggleSelect?.(request.id) : onAction("open", request))}
        aria-pressed={selectable ? selected : undefined}
        disabled={selectable && !canSelect}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none disabled:opacity-60 sm:gap-4"
      >
        <span className="block h-[84px] w-14 shrink-0 overflow-hidden rounded-lg bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle sm:h-24 sm:w-16">
          {poster && <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-tentacle-text-primary">{request.title}</span>
          <span className="mt-0.5 block truncate text-xs text-tentacle-text-tertiary">
            {[request.mediaType === "tv" ? t("seer:typeSeries") : t("seer:typeMovie"), request.year, seasons].filter(Boolean).join(" · ")}
          </span>
          <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {status && <StateBadge status={status} variant="chip" />}
            {detail && (
              <span className={`min-w-0 line-clamp-2 text-xs font-medium sm:truncate ${PHRASE_TONE[detail.tone].text}`}>{t(detail.key, detail.params)}</span>
            )}
            {gap && <span className="min-w-0 text-xs font-medium text-tentacle-text-secondary">{gap}</span>}
          </span>
          {/* L'avancement réel : taille, temps restant, détail par saison. */}
          {progress?.download && (
            <span className="block max-w-md">
              <RequestProgressBar download={progress.download} downloads={progress.downloads} receivedAt={receivedAt} requestedSeasons={request.seasons} />
            </span>
          )}
          {request.status === "failed" && request.lastError && (
            // Deux lignes au téléphone : l'infobulle du bureau ne s'ouvre pas au doigt.
            <span className="mt-1 line-clamp-2 text-xs text-tentacle-text-quaternary sm:block sm:truncate" title={request.lastError}>{request.lastError}</span>
          )}
          {!nextRelease && <span className="mt-1 block text-[11px] text-tentacle-text-quaternary">{t("seer:requestedOn", { date })}</span>}
        </span>
      </button>
      {nextRelease && !selectable && (
        <button type="button" onClick={onNextRelease} className="hidden shrink-0 items-center gap-1.5 rounded-full bg-tentacle-fill-subtle px-3 py-1.5 text-xs font-semibold text-tentacle-text-secondary ring-1 ring-tentacle-border-subtle transition-colors hover:bg-tentacle-fill-medium md:inline-flex">
          <CalendarIcon className="h-3.5 w-3.5 text-[var(--brand-light)]" />{nextRelease}
        </button>
      )}
      {!selectable && primary && (
        <button
          type="button"
          onClick={() => onAction(primary.action, request)}
          aria-label={`${primary.label} — ${request.title}`}
          className={`${primary.style} h-11 w-11 shrink-0 gap-1.5 text-sm sm:h-10 sm:w-auto sm:px-4`}
        >
          {primary.icon}<span className="hidden sm:inline">{primary.label}</span>
        </button>
      )}
      {!selectable && (
        <button
          type="button"
          onClick={() => onMenu(request)}
          aria-label={t("seer:moreActions", { title: request.title })}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-tentacle-text-secondary transition-colors hover:bg-tentacle-fill-soft hover:text-tentacle-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
        >
          <DotsIcon className="h-5 w-5" />
        </button>
      )}
      </div>
      {/* Au téléphone, la pastille de droite n'a pas la place : la date de la
          prochaine sortie passe dessous — et mène, comme elle, à sa semaine. */}
      {nextRelease && !selectable && (
        <button
          type="button"
          onClick={onNextRelease}
          className="ml-[68px] mt-1.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-tentacle-fill-subtle px-3 text-xs font-semibold text-tentacle-text-secondary ring-1 ring-tentacle-border-subtle transition-colors hover:bg-tentacle-fill-medium md:hidden"
        >
          <CalendarIcon className="h-3.5 w-3.5 text-[var(--brand-light)]" />{nextRelease}
        </button>
      )}
    </li>
  );
});
