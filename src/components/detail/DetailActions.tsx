/* ------------------------------------------------------------------ */
/*  Vigie — Les actions d'une fiche, dans son en-tête                  */
/* ------------------------------------------------------------------ */

/*
 * L'action qu'on vient chercher, visible sans défiler : Regarder quand le
 * titre est là, Demander un film, Choisir les saisons d'une série — puis la
 * bande-annonce. Posées sur l'en-tête sombre : boutons blancs et verre,
 * lisibles dans les deux thèmes. Un titre déjà demandé n'a pas de bouton de
 * demande : son badge d'état dit où il en est.
 */

import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaType } from "../../api/types";
import type { RichTrailer } from "../../utils/trailers";
import { navigateToMedia } from "../../utils/navigate-media";
import { openExternal, shouldOpenYouTubeExternally } from "../../utils/external";
import { useProfiles } from "../../hooks/useProfiles";
import { CTA_PRIMARY, CTA_SIZE_LG } from "../../styles/cta";
import { profilesFor } from "../ProfileSelector";
import { ChevronDown, FilmIcon, PlayIcon, PlusIcon } from "../ui/icons";

/** Bouton de verre, sur l'en-tête sombre. */
export const HERO_SECONDARY =
  "inline-flex items-center justify-center rounded-full bg-[var(--vg-glass)] text-sm font-semibold text-tentacle-on-media-primary " +
  "ring-1 ring-[var(--vg-glass-ring)] transition-colors hover:bg-[var(--vg-glass-hover)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.7)] disabled:opacity-50";

export interface MovieRequest {
  requesting: boolean;
  success: boolean;
  /** Faux : pas encore sorti hors salle — la demande attendra. */
  obtainable: boolean;
  isAnime: boolean;
  profileId: string | null;
  onProfile: (id: string | null) => void;
  onRequest: () => void;
}

interface Props {
  mediaType: MediaType;
  tmdbId: number;
  /** Statut Jellyseerr : 4 en partie, 5 là. */
  mediaStatus: number;
  trailers: RichTrailer[];
  onOpenTrailer: () => void;
  /** Un film qui se demande encore. */
  movieRequest?: MovieRequest | null;
  /** Une série dont des saisons se demandent encore : le libellé du bouton qui y mène. */
  seasonsLabel?: string | null;
  onJumpToSeasons?: () => void;
}

export const DetailActions = memo(function DetailActions(props: Props) {
  const { mediaType, tmdbId, mediaStatus, trailers, onOpenTrailer, movieRequest, seasonsLabel, onJumpToSeasons } = props;
  const { t } = useTranslation("seer");
  const [navigating, setNavigating] = useState(false);
  const inLibrary = mediaStatus >= 4;

  const watch = async () => {
    if (navigating) return;
    setNavigating(true);
    try { await navigateToMedia(tmdbId, mediaType); } finally { setNavigating(false); }
  };

  const trailer = () => {
    // macOS DMG : WKWebView retire le Referer → YouTube refuse l'embed, on ouvre le navigateur.
    if (shouldOpenYouTubeExternally() && trailers[0]?.Url) { openExternal(trailers[0].Url); return; }
    onOpenTrailer();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2.5">
        {inLibrary && (
          <button type="button" onClick={() => void watch()} disabled={navigating} className={`${CTA_PRIMARY} ${CTA_SIZE_LG} gap-2`}>
            <PlayIcon className="h-4 w-4" />
            {mediaType === "tv" ? t("seer:libraryGoSeries") : t("seer:libraryGoMovie")}
          </button>
        )}
        {movieRequest && <MovieRequestButton request={movieRequest} />}
        {seasonsLabel && onJumpToSeasons && (
          <button type="button" onClick={onJumpToSeasons} className={`${inLibrary ? HERO_SECONDARY : CTA_PRIMARY} ${CTA_SIZE_LG} gap-2`}>
            <PlusIcon className="h-4 w-4" />
            {seasonsLabel}
          </button>
        )}
        {trailers.length > 0 && (
          <button type="button" onClick={trailer} className={`${HERO_SECONDARY} ${CTA_SIZE_LG} gap-2`}>
            <FilmIcon className="h-4 w-4" />
            {t("seer:watchTrailer")}
          </button>
        )}
      </div>
      {movieRequest && !movieRequest.obtainable && !movieRequest.success && (
        <p className="max-w-xl text-xs leading-relaxed text-tentacle-on-media-secondary">{t("seer:availRequestAnywayHint")}</p>
      )}
    </div>
  );
});

function MovieRequestButton({ request }: { request: MovieRequest }) {
  const { t } = useTranslation("seer");
  const { data } = useProfiles();
  const profiles = profilesFor(data?.profiles ?? [], "movie", request.isAnime);
  const label = request.requesting ? t("seer:requestingMovie")
    : request.success ? t("seer:requestAdded")
      : request.obtainable ? t("seer:request") : t("seer:availRequestAnyway");

  return (
    <>
      <button
        type="button"
        onClick={request.onRequest}
        disabled={request.requesting || request.success}
        className={`${CTA_PRIMARY} ${CTA_SIZE_LG} gap-2`}
      >
        <PlusIcon className="h-4 w-4" />
        {label}
      </button>
      {profiles.length > 0 && (
        <label className="relative inline-flex">
          <span className="sr-only">{t("seer:profileLabel")}</span>
          <select
            value={request.profileId ?? ""}
            onChange={(e) => request.onProfile(e.target.value || null)}
            style={{ colorScheme: "dark" }}
            className={`${HERO_SECONDARY} ${CTA_SIZE_LG} cursor-pointer appearance-none pr-9`}
          >
            <option value="" className="bg-[var(--vg-hero-bg)] text-white">{t("seer:profileDefaultChoice")}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id} className="bg-[var(--vg-hero-bg)] text-white">{p.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tentacle-on-media-secondary" />
        </label>
      )}
    </>
  );
}
