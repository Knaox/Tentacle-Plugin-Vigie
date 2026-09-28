/*
 * Vigie — les gestes de l'affiche : le survol, la feuille de l'appui long.
 * Les mêmes mots que les cartes de Tentacle (espace `cards`) : le survol
 * d'un titre se lit pareil ici et sur la recherche ou les recommandations.
 */
export default {
  markWatchlistPending: "Dans ma liste dès son arrivée",
  gestureAddToWatchlist: "Ajouter à ma liste",
  gestureRemoveFromWatchlist: "Retirer de ma liste",
  gestureAddOnArrival: "Ajouter à ma liste dès son arrivée",
  gestureRemoveOnArrival: "Ne plus l'ajouter à son arrivée",
  gestureWatchlistAdded: "Ajouté à ma liste.",
  gestureOnArrivalAdded: "Il entrera dans ma liste dès son arrivée.",
  gestureWatchlistFailed: "Ma liste n'a pas pu être modifiée.",
  gestureRatingFailed: "La note n'a pas pu être enregistrée.",
  gestureYourRating: "Votre note",
  gestureRateAria: "Noter {{score}} sur 10",
  gestureRemoveRatingAria: "Retirer votre note ({{score}}/10)",
  gestureRateTitle: "Noter ce titre",
  gestureRateHint: "Touchez une étoile — la moitié gauche vaut une demi-étoile.",
  gestureMoreInfo: "Plus d'infos",
} as const;
