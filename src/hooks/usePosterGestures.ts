/* ------------------------------------------------------------------ */
/*  Vigie — Les gestes d'une affiche : ce que le survol et la feuille offrent */
/* ------------------------------------------------------------------ */

/*
 * LA liste des gestes d'une affiche, pour ses deux entrées : le calque du
 * survol (souris) et la feuille de l'appui long (doigt). C'est la grammaire
 * des cartes de Tentacle (`externalCardOverlay.ts` du cœur), pour qu'un titre
 * se lise pareil ici, sur la recherche ou sur les recommandations :
 *
 *   - en tête du plateau, UNE action primaire : « Demander » (un film, d'un
 *     geste), « Choisir les saisons » (une série pas entièrement là) — ou,
 *     pour un titre déjà là, « Regarder » dans Tentacle ;
 *   - la note, en étoiles (le moteur de notes de Tentacle) ;
 *   - « Ma liste », puis « J'aime » (le cœur) : tout de suite pour un titre
 *     de la bibliothèque, à son arrivée pour un titre absent — le goût des
 *     recommandations de Tentacle compte le cœur aussitôt. Pas de cœur si
 *     Tentacle ne sait pas encore aimer un titre par son tmdb.
 */

import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import type { TitleMarks } from "../hub/UserMarks";
import type { TitleStatus } from "../utils/title-state";
import { libraryIdOf } from "../utils/navigate-media";
import { useOpenInLibrary } from "./useOpenInLibrary";
import { useToast } from "./useToast";
import { useLikesAvailable } from "../hub/UserMarks";
import { useRateTitle, useTitleFavorite, useTitleWatchlist } from "./useTitleGestures";

export interface PosterPrimary {
  kind: "request" | "seasons" | "watch";
  label: string;
  run: () => void;
}

/** Une bascule de l'affiche : tout de suite pour un titre de la bibliothèque, sinon à son arrivée. */
export interface PosterToggle {
  inLibrary: boolean;
  active: boolean;
  label: string;
  toggle: () => void;
}

export interface PosterGestures {
  primary: PosterPrimary | null;
  watchlist: PosterToggle;
  /** Le cœur ; `null` quand Tentacle ne sait pas aimer un titre par son tmdb. */
  favorite: PosterToggle | null;
  rating: {
    value: number | null;
    rate: (score: number) => void;
    clear: () => void;
  };
}

export function usePosterGestures(
  item: SeerrSearchResult,
  status: TitleStatus | null,
  marks: TitleMarks | null,
  onQuickRequest?: (item: SeerrSearchResult) => void,
): PosterGestures {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const openInLibrary = useOpenInLibrary();
  const watchlist = useTitleWatchlist();
  const favorites = useTitleFavorite();
  const likesAvailable = useLikesAvailable();
  const ratings = useRateTitle();

  const here = status?.state === "available" || status?.state === "partial";
  const inLibrary = marks?.library === true || here;
  // Le « + » de toujours : un film pas encore demandé, une série pas entièrement là.
  const requestable = !!onQuickRequest && marks?.library !== true
    && (item.mediaType === "movie" ? status === null : item.mediaType === "tv" && status?.state !== "available");

  let primary: PosterPrimary | null = null;
  if (requestable && onQuickRequest) {
    const tv = item.mediaType === "tv";
    primary = { kind: tv ? "seasons" : "request", label: t(tv ? "seer:chooseSeasons" : "seer:request"), run: () => onQuickRequest(item) };
  } else if (inLibrary) {
    primary = { kind: "watch", label: t("seer:watch"), run: () => void openInLibrary(item.id, item.mediaType, libraryIdOf(item.mediaInfo)) };
  }

  const active = inLibrary ? marks?.watchlist === true : marks?.pending === true;
  const label = inLibrary
    ? t(active ? "seer:gestureRemoveFromWatchlist" : "seer:gestureAddToWatchlist")
    : t(active ? "seer:gestureRemoveOnArrival" : "seer:gestureAddOnArrival");
  const failed = () => toast.show("error", t("seer:gestureWatchlistFailed"));
  const toggle = () => {
    if (active) {
      watchlist.remove.mutate(item, { onError: failed });
      return;
    }
    watchlist.add.mutate(item, {
      onSuccess: (res) => toast.show("success", t(res.state === "listed" ? "seer:gestureWatchlistAdded" : "seer:gestureOnArrivalAdded")),
      onError: failed,
    });
  };

  const liked = marks?.liked === true;
  const favoriteLabel = inLibrary
    ? t(liked ? "seer:gestureRemoveFromFavorites" : "seer:gestureAddToFavorites")
    : t(liked ? "seer:gestureRemoveFavoriteOnArrival" : "seer:gestureAddFavoriteOnArrival");
  const favoriteFailed = () => toast.show("error", t("seer:gestureFavoriteFailed"));
  const toggleFavorite = () => {
    if (liked) {
      favorites.remove.mutate(item, { onError: favoriteFailed });
      return;
    }
    favorites.add.mutate(item, {
      onSuccess: (res) => toast.show("success", t(res.state === "favorited" ? "seer:gestureFavoriteAdded" : "seer:gestureFavoriteOnArrivalAdded")),
      onError: favoriteFailed,
    });
  };

  const ratingFailed = () => toast.show("error", t("seer:gestureRatingFailed"));
  return {
    primary,
    watchlist: { inLibrary, active, label, toggle },
    favorite: likesAvailable ? { inLibrary, active: liked, label: favoriteLabel, toggle: toggleFavorite } : null,
    rating: {
      value: marks?.score ?? null,
      rate: (score) => ratings.rate.mutate({ item, score }, { onError: ratingFailed }),
      clear: () => ratings.clear.mutate(item, { onError: ratingFailed }),
    },
  };
}
