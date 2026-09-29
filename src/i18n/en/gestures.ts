/*
 * Vigie — poster gestures: the hover layer, the long-press sheet. The same
 * words as Tentacle's cards (`cards` namespace): a title's hover reads the
 * same here and on search or recommendations.
 */
export default {
  markWatchlistPending: "In my list once it arrives",
  gestureAddToWatchlist: "Add to my list",
  gestureRemoveFromWatchlist: "Remove from my list",
  gestureAddOnArrival: "Add to my list when it arrives",
  gestureRemoveOnArrival: "Don't add it when it arrives",
  gestureWatchlistAdded: "Added to my list.",
  gestureOnArrivalAdded: "It will join my list as soon as it arrives.",
  gestureWatchlistFailed: "My list couldn't be updated.",
  gestureAddToFavorites: "Add to favorites",
  gestureRemoveFromFavorites: "Remove from favorites",
  gestureAddFavoriteOnArrival: "Add to favorites when it arrives",
  gestureRemoveFavoriteOnArrival: "Don't add it to favorites when it arrives",
  gestureFavoriteAdded: "Added to favorites.",
  gestureFavoriteOnArrivalAdded: "Liked — it will join your favorites as soon as it arrives.",
  gestureFavoriteFailed: "Favorites couldn't be updated.",
  gestureRatingFailed: "The rating couldn't be saved.",
  gestureYourRating: "Your rating",
  gestureRateAria: "Rate {{score}} out of 10",
  gestureRemoveRatingAria: "Remove your rating ({{score}}/10)",
  gestureRateTitle: "Rate this title",
  gestureRateHint: "Tap a star — its left half counts as half a star.",
  gestureMoreInfo: "More info",
} as const;
