import { useState } from "react";
import { useTranslation } from "react-i18next";
import { navigateToMedia } from "../utils/navigate-media";
import { shouldOpenYouTubeExternally, openExternal } from "../utils/external";
import { CTA_PRIMARY, CTA_SECONDARY, CTA_SIZE_LG } from "../styles/cta";
import type { MediaType } from "../api/types";
import type { RichTrailer } from "../utils/trailers";

interface DetailActionBarProps {
  mediaType: MediaType;
  tmdbId: number;
  /** Statut Seerr global du média (4 partiel, 5 dispo). */
  mediaStatus: number;
  trailers: RichTrailer[];
  onOpenTrailer: () => void;
  /** Le titre se demande encore : un bouton mène à la section de demande, plus bas. */
  requestLabel?: string | null;
  onJumpToRequest?: () => void;
}

/**
 * Barre d'actions sous le header du modal :
 *  - « Regarder » (média en bibliothèque) → navigation vers la page média Tentacle ;
 *  - « Bande-annonce » → même comportement que TrailerButton du core : macOS DMG
 *    ouvre le navigateur système, sinon modale d'embed (masqué si aucun trailer).
 */
export function DetailActionBar({
  mediaType, tmdbId, mediaStatus, trailers, onOpenTrailer, requestLabel, onJumpToRequest,
}: DetailActionBarProps) {
  const { t } = useTranslation("seer");
  const [navigating, setNavigating] = useState(false);
  const inLibrary = mediaStatus >= 4;
  const hasTrailers = trailers.length > 0;

  const canJump = !!requestLabel && !!onJumpToRequest;
  if (!inLibrary && !hasTrailers && !canJump) return null;

  const handleWatch = async () => {
    if (navigating) return;
    setNavigating(true);
    try {
      await navigateToMedia(tmdbId, mediaType);
    } finally {
      setNavigating(false);
    }
  };

  const handleTrailer = () => {
    // macOS DMG : WKWebView strip le Referer → YouTube refuse l'embed (153).
    // On ouvre dans le navigateur système, comme le core.
    if (shouldOpenYouTubeExternally() && trailers[0]?.Url) {
      openExternal(trailers[0].Url);
      return;
    }
    onOpenTrailer();
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {inLibrary && (
        <button
          onClick={handleWatch}
          disabled={navigating}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-tentacle-status-success px-5 text-sm font-bold text-tentacle-cta-brand-fg shadow-tentacle-elev-1 transition-all hover:opacity-90 disabled:opacity-60 sm:flex-initial"
        >
          {navigating ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {mediaType === "tv" ? t("seer:libraryGoSeries") : t("seer:libraryGoMovie")}
        </button>
      )}

      {/* L'action qu'on vient chercher, visible sans défiler : la section de
          demande (profil, saisons) est plus bas, ce bouton y mène. */}
      {canJump && (
        <button
          type="button"
          onClick={onJumpToRequest}
          className={`${CTA_PRIMARY} ${CTA_SIZE_LG} flex-1 gap-2 sm:flex-initial`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          {requestLabel}
        </button>
      )}

      {hasTrailers && (
        <button
          onClick={handleTrailer}
          className={`${CTA_SECONDARY} ${CTA_SIZE_LG} flex-1 gap-2 backdrop-blur-sm sm:flex-initial`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v12.75c0 .621.504 1.125 1.125 1.125ZM6 4.5v15m12-15v15M2.25 9h3.75m-3.75 6h3.75m12-6h3.75m-3.75 6h3.75" />
          </svg>
          {t("seer:watchTrailer")}
        </button>
      )}
    </div>
  );
}
