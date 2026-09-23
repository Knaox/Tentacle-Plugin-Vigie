export default {
  pluginName: "Vigie — Demandes de médias",
  pluginDescription: "Demandez films et séries, suivez leur arrivée et voyez les prochaines sorties. Se connecte à votre instance Jellyseerr / Overseerr — projet indépendant, non affilié à Jellyseerr.",
  notAffiliated: "Vigie est un plugin indépendant, sans aucun lien avec les projets Jellyseerr et Overseerr.",
  notAffiliatedLink: "Projet officiel Jellyseerr",

  // Navigation — « Catalogue » et non « Découvrir » : on y trouve ce qui n'est
  // PAS encore dans la bibliothèque, et on peut le demander.
  navDiscover: "Catalogue",
  navRequests: "Mes demandes",
  navMyRequests: "Mes demandes",
  navConfig: "Configuration Vigie",
  navSeer: "Vigie",
  navNotifications: "Notifications",
  navStats: "Statistiques",

  // Media types
  typeMovie: "Film",
  typeSeries: "Série",
  typeAnime: "Animé",
  untitled: "Sans titre",
  noImage: "Pas d'image",

  // Statuses
  statusQueued: "En attente",
  statusProcessing: "Traitement",
  statusRequested: "Demandé",
  statusSentToSeer: "Envoyé",
  statusApproved: "Approuvé",
  statusDownloading: "En route",
  statusAvailable: "Disponible",
  statusPartiallyAvailableBadge: "Partiellement dispo.",
  statusRetryPending: "Nouvelle tentative",
  statusUnavailable: "Demandée",
  statusFailed: "Échec",
  statusDeleting: "En suppression",
  statusDeleteFailed: "Échec suppression",
  statusDeleted: "Supprimée",
  statusCancelled: "Annulé",
  status_queued: "En attente",
  status_processing: "Traitement",
  status_sent_to_seer: "Envoyé",
  status_approved: "Approuvé",
  status_downloading: "En route",
  status_partially_available: "Partiellement disponible",
  status_available: "Disponible",
  status_retry_pending: "Nouvelle tentative",
  status_unavailable: "Demandée",
  status_failed: "Échec",
  status_deleting: "En suppression",
  status_delete_failed: "Échec suppression",
  status_deleted: "Supprimée",

  // Status badges (for media cards)
  statusPending: "En attente",
  statusPartiallyAvailable: "Partiel",
} as const;
