/* ------------------------------------------------------------------ */
/*  Vigie — Une demande en vignette (bandeau de l'accueil)             */
/* ------------------------------------------------------------------ */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import type { ProgressItem } from "../api/types-releases";
import { posterUrl } from "../utils/media-helpers";
import { useInterpolatedProgress } from "../hooks/useDownloadProgress";
import { PHRASE_TONE, requestPhrase } from "./requestPhrase";

/**
 * L'affiche, et en dessous ce qu'on veut savoir d'un coup d'œil : où en est
 * la demande — une phrase, et la barre d'avancement quand quelque chose arrive.
 */
export const RequestTile = memo(function RequestTile({ request, progress, receivedAt, onOpen }: {
  request: LocalRequest;
  progress?: ProgressItem;
  receivedAt: string | null;
  onOpen: (request: LocalRequest) => void;
}) {
  const { t } = useTranslation("seer");
  const phrase = requestPhrase(request, progress);
  const tone = PHRASE_TONE[phrase.tone];
  const live = useInterpolatedProgress(progress?.download, receivedAt);
  const poster = posterUrl(request.posterPath);

  return (
    <button type="button" onClick={() => onOpen(request)} className="group block w-full text-left focus-visible:outline-none">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle group-focus-visible:ring-2 group-focus-visible:ring-[rgba(var(--brand-rgb),0.8)]">
        {poster
          ? <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
          : <span className="flex h-full items-end p-3 text-sm font-semibold text-tentacle-text-tertiary">{request.title}</span>}
        {live.percent !== null && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-[rgba(var(--scrim-media-rgb),0.6)]">
            {/* Une transformation, jamais une largeur : rien ne se repeint (règle GPU). */}
            <span
              className="block h-full origin-left bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]"
              style={{ transform: `scaleX(${Math.max(0.03, live.percent / 100)})`, transition: "transform 900ms linear" }}
            />
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-[13px] font-semibold text-tentacle-text-primary">{request.title}</p>
      <p className={`flex items-center gap-1.5 truncate text-xs font-medium ${tone.text}`}>
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
        <span className="truncate">{t(phrase.key, phrase.params)}</span>
      </p>
    </button>
  );
});
