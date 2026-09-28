/* ------------------------------------------------------------------ */
/*  Vigie — Les gestes d'une affiche, au doigt                          */
/* ------------------------------------------------------------------ */

/*
 * L'appui long d'une affiche ouvre cette feuille : exactement ce que le
 * survol offre à la souris (usePosterGestures), dans le même ordre — l'action
 * primaire, la note, « Ma liste » — plus la fiche, à un toucher. Au téléphone
 * le « + » des affiches restait sinon hors d'atteinte : on ne pouvait
 * demander qu'en ouvrant la fiche.
 *
 * Rendue au niveau du hub, jamais dans la carte : les enveloppes animées des
 * rangées créent des contextes d'empilement qui la feraient passer dessous.
 */

import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import { useTitleStatus } from "../hub/TitleStates";
import { useTitleMarks } from "../hub/UserMarks";
import { usePosterGestures } from "../hooks/usePosterGestures";
import { mediaTitle, mediaYear, posterUrl } from "../utils/media-helpers";
import { CTA_SECONDARY, CTA_SIZE_LG } from "../styles/cta";
import { Sheet } from "./ui/Sheet";
import { StateBadge } from "./ui/StateBadge";
import { StarsInput } from "./ui/StarsInput";
import { BookmarkIcon, BookmarkOutlineIcon, PlayIcon, PlusIcon } from "./ui/icons";

export function PosterActionsSheet({ item, onClose, onOpenDetail, onQuickRequest }: {
  item: SeerrSearchResult;
  onClose: () => void;
  onOpenDetail: (item: SeerrSearchResult) => void;
  onQuickRequest?: (item: SeerrSearchResult) => void;
}) {
  const { t } = useTranslation("seer");
  const status = useTitleStatus(item);
  const marks = useTitleMarks(item);
  const { primary, watchlist, rating } = usePosterGestures(item, status, marks, onQuickRequest);
  const title = mediaTitle(item) || t("seer:untitled");
  const year = mediaYear(item);
  const poster = posterUrl(item.posterPath, "w185");

  const footer = (
    <button type="button" onClick={() => onOpenDetail(item)} className={`${CTA_SECONDARY} ${CTA_SIZE_LG} w-full`}>
      {t("seer:gestureMoreInfo")}
    </button>
  );

  return (
    <Sheet open onClose={onClose} title={title} size="sm" footer={footer}>
      <div className="flex items-center gap-3">
        <span className="block h-[72px] w-12 shrink-0 overflow-hidden rounded-lg bg-tentacle-surface-2 ring-1 ring-tentacle-border-subtle">
          {poster && <img src={poster} alt="" className="h-full w-full object-cover" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-tentacle-text-secondary">
            {[item.mediaType === "tv" ? t("seer:typeSeries") : t("seer:typeMovie"), year].filter(Boolean).join(" · ")}
          </p>
          {status && <StateBadge status={status} variant="chip" className="mt-1.5" />}
        </div>
      </div>

      {/* L'action primaire d'abord, au dégradé de marque — celle qui ouvre le plateau du survol. */}
      {primary && (
        <button
          type="button"
          onClick={() => { onClose(); primary.run(); }}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-[15px] font-bold text-tentacle-cta-brand-fg shadow-[0_8px_22px_rgba(var(--brand-rgb),0.4)] transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
        >
          {primary.kind === "watch" ? <PlayIcon className="h-4 w-4" /> : <PlusIcon className="h-5 w-5" />}
          {primary.label}
        </button>
      )}

      <div className="mt-3 rounded-2xl bg-tentacle-fill-subtle px-4 py-3.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-tentacle-text-tertiary">{t("seer:gestureRateTitle")}</p>
        <div className="mt-2.5 flex justify-center">
          <StarsInput value={rating.value} onRate={rating.rate} onClear={rating.clear} size="lg" />
        </div>
        <p className="mt-2 text-center text-xs text-tentacle-text-tertiary">{t("seer:gestureRateHint")}</p>
      </div>

      <button
        type="button"
        onClick={watchlist.toggle}
        aria-pressed={watchlist.active}
        className={`mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)] ${
          watchlist.active
            ? "bg-[var(--brand-soft)] text-tentacle-text-primary ring-[rgba(var(--brand-rgb),0.45)]"
            : "bg-tentacle-fill-subtle text-tentacle-text-primary ring-tentacle-border-subtle hover:bg-tentacle-fill-soft"
        }`}
      >
        {watchlist.active
          ? <BookmarkIcon className="h-5 w-5 shrink-0 text-[var(--brand-light)]" />
          : <BookmarkOutlineIcon className="h-5 w-5 shrink-0 text-tentacle-text-secondary" />}
        {watchlist.label}
      </button>
    </Sheet>
  );
}
