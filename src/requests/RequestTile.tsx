/* ------------------------------------------------------------------ */
/*  Vigie — Une demande en vignette (bandeau de l'accueil)             */
/* ------------------------------------------------------------------ */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import type { ProgressItem } from "../api/types-releases";
import { posterUrl } from "../utils/media-helpers";
import { statusText } from "../utils/state-labels";
import { useInterpolatedProgress } from "../hooks/useDownloadProgress";
import { StateBadge } from "../components/ui/StateBadge";
import { PHRASE_TONE, requestView } from "./requestPhrase";

/**
 * Le même dessin qu'une affiche du catalogue : l'état en bandeau au pied de
 * l'affiche (son filet avance quand le titre arrive), et sous le titre la
 * nuance — « En attente de validation », « Reste 12 min ».
 */
export const RequestTile = memo(function RequestTile({ request, progress, receivedAt, onOpen }: {
  request: LocalRequest;
  progress?: ProgressItem;
  receivedAt: string | null;
  onOpen: (request: LocalRequest) => void;
}) {
  const { t } = useTranslation("seer");
  const { status, detail } = requestView(request, progress);
  const live = useInterpolatedProgress(progress?.download, receivedAt);
  // L'avancement interpolé, pas seulement le dernier mesuré : le filet glisse.
  const shown = status && status.state === "downloading" && live.percent !== null ? { ...status, percent: live.percent } : status;
  const poster = posterUrl(request.posterPath);
  const typeLine = [request.mediaType === "tv" ? t("seer:typeSeries") : t("seer:typeMovie"), request.year].filter(Boolean).join(" · ");
  const label = [request.title, shown ? statusText(shown, t) : "", detail ? t(detail.key, detail.params) : ""].filter(Boolean).join(" — ");

  return (
    <button type="button" onClick={() => onOpen(request)} aria-label={label} className="group block w-full text-left focus-visible:outline-none">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle group-focus-visible:ring-2 group-focus-visible:ring-[rgba(var(--brand-rgb),0.8)]">
        {poster
          ? <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
          : <span className="flex h-full items-end p-3 pb-8 text-sm font-semibold text-tentacle-text-tertiary">{request.title}</span>}
        {shown && <StateBadge status={shown} variant="band" />}
      </div>
      <p className="mt-2 truncate text-[13px] font-semibold leading-5 text-tentacle-text-primary">{request.title}</p>
      <p className={`mt-0.5 truncate text-xs ${detail ? PHRASE_TONE[detail.tone].text : "text-tentacle-text-tertiary"}`}>
        {detail ? t(detail.key, detail.params) : typeLine}
      </p>
    </button>
  );
});
