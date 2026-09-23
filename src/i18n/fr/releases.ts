export default {
  // Disponibilité — PAR OÙ un titre est sorti, et ce qu'une demande peut espérer.
  // Ne jamais employer « Disponible » ici : ce mot désigne, sur Mes demandes,
  // un titre déjà téléchargé et présent dans la bibliothèque. On nomme le
  // canal (salle, streaming, Blu-ray), jamais un état de possession.
  availStillInTheaters: "Encore au cinéma",
  availInTheaters: "Au cinéma",
  availInTheatersLong: "Encore au cinéma depuis le {{date}}",
  availTheatricalSoon: "Au cinéma le {{date}}",
  availTheatricalSoonLong: "Sortie en salle le {{date}}",
  availDigitalOut: "En streaming",
  availDigitalOutLong: "Sorti en streaming le {{date}}",
  availOnlineOn: "En streaming le {{date}}",
  availOnlineOnLong: "Sortie en streaming le {{date}}",
  // Sur une plateforme d'abonnement en ce moment, sans date de sortie connue :
  // c'est souvent tout ce qu'on sait d'une série ou d'un animé en cours.
  availStreamingNow: "En streaming",
  availStreamingNowLong: "Regardable en streaming sur abonnement",
  // Aucune sortie connue, nulle part. On le dit plutôt que de laisser une
  // carte muette — qui se lit comme un oubli, pas comme une absence d'info.
  availUncharted: "Potentiellement disponible",
  availUnchartedLong:
    "Aucune sortie connue en salle ni en streaming — une demande peut malgré tout aboutir",
  availPhysicalOut: "En Blu-ray",
  availPhysicalOutLong: "Sorti en DVD / Blu-ray le {{date}}",
  availPhysicalSoon: "Blu-ray le {{date}}",
  availPhysicalSoonLong: "Sortie en DVD / Blu-ray le {{date}}",
  availReleaseOn: "Sortie le {{date}}",
  availReleaseOnLong: "Pas encore sorti — prévu le {{date}}",
  availAirsOn: "Diffusion le {{date}}",
  availAirsOnLong: "Première diffusion le {{date}}",
  availNotAiredYet: "Diffusion pas encore commencée",
  // Les chances d'aboutir, sans jamais les chiffrer ni les promettre.
  availOutlookLikely: "Une version existe : la demande a de bonnes chances d'aboutir.",
  availOutlookUnlikely:
    "Encore en salle uniquement : peu de chances qu'une version circule déjà.",
  availOutlookNotYet: "Rien n'est encore sorti : la demande restera en attente jusque-là.",
  availRequestAnyway: "Demander quand même",
  availRequestAnywayHint:
    "Rien ne pourra arriver avant la sortie. La demande restera en attente jusque-là.",

  // Progression réelle des téléchargements
  progressRemaining: "≈ {{eta}} restantes",
  progressPaused: "En pause",
  // Le fichier est complet mais pas encore rangé dans la bibliothèque.
  // Court dans la puce, qui partage sa ligne avec un titre tronqué.
  statusValidating: "En cours de validation",
  progressValidating: "Arrivé — vérification et rangement en cours",

  // File de téléchargement du serveur (administrateurs)
  downloadsTab: "File du serveur",
  downloadsSubtitle:
    "La file de Sonarr et Radarr : tout ce que le serveur récupère, demandes de tout le monde comprises.",
  downloadsEmpty: "Rien ne descend en ce moment",
  downloadsUnreachable: "{{service}} ne répond pas — cette liste est peut-être incomplète",
  progressSearching: "Recherche d'une source en cours",
  progressEpisodes_one: "{{count}} épisode en cours",
  progressEpisodes_other: "{{count}} épisodes en cours",
  // Détail par saison d'une demande de série
  // Heure réelle d'un épisode, quand Sonarr suit la série
  episodeAirTime: "{{date}} · {{time}}",
  progressSeason: "Saison {{season}}",
  progressSeasonWaiting: "En attente",
  progressNoSeason: "Hors saison",

  // Page Calendrier. Les libellés disent ce que chaque vue MONTRE :
  // « Sorties » partout (page, onglet…) n'évoquait rien et ne distinguait rien.
  navReleases: "Calendrier",
  releasesTitle: "Calendrier",
  releasesSubtitle: "Les dates de sortie de vos demandes et de toutes les plateformes",
  releasesTabPersonal: "Mes demandes",
  releasesOnlyRequested: "Seulement les demandes",
  // Tous les calendriers de la période, contenus non demandés compris.
  releasesTabAll: "Toutes les sorties",
  releasesScopeUpcoming: "Toutes mes demandes",
  releasesScopeAll: "Toutes les demandes",
  // Dit franchement ce que la vue partagée montre : ce que les autres ont
  // demandé. C'est un choix assumé, pas un effet de bord.
  releasesEveryoneHint: "Les demandes de tous les utilisateurs du serveur.",
  releasesEmptyEveryone: "Aucune sortie à venir parmi les demandes du serveur",
  releasesViewWeek: "Semaine",
  releasesViewMonth: "Mois",
  releasesEmptyPersonal: "Aucune sortie à venir parmi vos demandes",
  releasesEmptyPersonalHint:
    "Les titres déjà dans votre bibliothèque n'apparaissent pas ici.",
  releasesEmptyGlobal: "Aucune sortie annoncée sur cette période",
  releasesPartial: "Chargement des dates en cours…",
  // Première construction du calendrier partagé : dire ce qui se passe, pas
  // seulement qu'il faut attendre — les entrées apparaissent au fil de l'eau.
  releasesBuilding:
    "Construction du calendrier en cours — les sorties s'ajoutent au fur et à mesure.",
  // Filtres de l'agenda — plusieurs plateformes à la fois
  releasesFiltersTitle: "Filtres des sorties",
  filterType: "Type",
  releasesFilterPlatformsHint:
    "Une sortie apparaît si au moins une des plateformes cochées la propose.",
  releasesEmptyFiltered: "Aucune sortie sur les plateformes choisies",
  releasesEmptyFilteredHint:
    "Un titre pas encore sorti n'est proposé par aucune plateforme : il n'apparaît donc pas ici.",
  releasesShowResults_one: "Voir {{count}} sortie",
  releasesShowResults_other: "Voir {{count}} sorties",
  releasesFilterAll: "Tout",
  releasesFilterMovies: "Films",
  releasesFilterTv: "Séries",
  releasesToday: "Aujourd'hui",
  releasesTomorrow: "Demain",
  releasesThisMonth: "Ce mois-ci",
  releasesKindDigital: "En streaming",
  releasesKindTheatrical: "Au cinéma",
  releasesKindPhysical: "Blu-ray / DVD",
  releasesKindEpisode: "Épisode",
  releasesKindPremiere: "Sortie",
  releasesRequested: "Demandé",

  // Plateformes de streaming — « où puis-je déjà le regarder »
  streamingOn: "En streaming sur {{platforms}}",
  streamingLabel: "À voir sur",
  streamingNone: "Sur aucune plateforme d'abonnement",
  releasesCount_one: "{{count}} sortie",
  releasesCount_other: "{{count}} sorties",
  releasesMonthPrev: "Mois précédent",
  releasesMonthNext: "Mois suivant",
  releasesWeekPrev: "Semaine précédente",
  releasesWeekNext: "Semaine suivante",
  releasesThisWeek: "Cette semaine",
  releasesWindow30: "30 jours",
  releasesWindow90: "3 mois",
  releasesWindow180: "6 mois",
} as const;
