/*
 * Les cinq états d'un titre, et les nuances qui les précisent.
 *
 * « Téléchargement » n'apparaît QUE dans les clés `*Web` : `stateLabel` ne
 * les lit jamais dans l'application mobile, qui prend les clés `*App`.
 * Là-bas le mot est proscrit — il s'y lit comme une distribution de contenu
 * hors boutique (CLAUDE.md de Tentacle, « Mobile ») ; sur le web et le
 * bureau, c'est le mot juste.
 *
 * « Bloqué », jamais « échec » : un téléchargement qui coince attend une source.
 */
export default {
  stRequested: "Demandé",
  stDownloadingWeb: "En téléchargement",
  stDownloadingApp: "En route",
  stDownloadingShortWeb: "Téléchargement",
  stDownloadingShortApp: "En route",
  stStalled: "Bloqué",
  stAvailable: "Disponible",
  stPartial: "Disponible en partie",
  stPartialShort: "En partie",
  stPercent: "{{percent}} %",
  stStalledHint: "N'avance plus pour l'instant — il reprendra dès qu'une source revient",
  stStalledSome_one: "{{count}} élément bloqué",
  stStalledSome_other: "{{count}} éléments bloqués",
  stStateOf: "{{title}} — {{state}}",

  // Canaux de sortie, en une ligne sous l'affiche
  chTheater: "Au cinéma",
  chTheaterOn: "Au cinéma le {{date}}",
  chStreaming: "En streaming",
  chStreamingOn: "En streaming le {{date}}",
  chPhysical: "En Blu-ray",
  chPhysicalOn: "Blu-ray le {{date}}",
  chUncharted: "Potentiellement disponible",
  chAirsOn: "Diffusion le {{date}}",
  chNotAired: "Pas encore diffusé",
  chReleaseOn: "Sortie le {{date}}",

  // Titres d'un parcours : ils suivent le type affiché
  type_movies: "Films",
  type_tv: "Séries",
  type_anime: "Animés",
  titleAll_movies: "Tous les films",
  titleAll_tv: "Toutes les séries",
  titleAll_anime: "Tous les animés",
  titlePopular_movies: "Films populaires",
  titlePopular_tv: "Séries populaires",
  titlePopular_anime: "Animés populaires",
  titleTop_movies: "Films les mieux notés",
  titleTop_tv: "Séries les mieux notées",
  titleTop_anime: "Animés les mieux notés",
  titleUpcoming_movies: "Bientôt au cinéma",
  titleUpcoming_tv: "Séries à venir",
  titleUpcoming_anime: "Animés à venir",

  // Barre d'un parcours
  sortLabel: "Trier",
  sortOptPopular: "Popularité",
  sortOptRating: "Mieux notés",
  sortOptNewest: "Plus récents",
  sortOptOldest: "Plus anciens",
  sortOptTitle: "Titre (A → Z)",
  filtersAdvanced: "Filtres avancés",
  filtersActive_one: "Filtres avancés — {{count}} actif",
  filtersActive_other: "Filtres avancés — {{count}} actifs",
  removeFilter: "Retirer {{label}}",
  clearAllFilters: "Tout effacer",
  tabCatalog: "Catalogue",
  browseCatalog: "Parcourir le catalogue",
  browseCatalogHint: "Tous les titres, triés et filtrés comme vous voulez",
  // La nuance d'une demande, sous son état
  dtSending: "Envoi de la demande…",
  dtAwaitingApproval: "En attente de validation",
  dtSearching: "Recherche d'une source",
  dtNotFound: "Pas encore trouvé — il arrivera dès qu'une source existe",
  dtRetrySoon: "Nouvel essai bientôt ({{count}}/{{max}})",
  dtFinishing: "Presque là — vérification",
  dtStalled: "N'avance plus pour l'instant",
  dtRemaining: "Reste {{eta}}",
  dtPartialHere: "Déjà là en partie",
  dtArrivedOn: "Arrivé le {{date}}",
  backToTab: "Retour à {{tab}}",
  scopeMineShort: "Les miennes",
  scopeEveryoneShort: "Le serveur",
  scopeAllShort: "Toutes",
  // Demande rapide de saisons (le « + » d'une affiche de série)
  quickSeasonsHint: "Cochez les saisons à demander. Celles qui sont déjà là ou déjà demandées sont verrouillées.",
  quickSeasonsAll: "Toutes les saisons libres ({{count}})",
  quickSeasonsDone_one: "« {{title}} » : {{count}} saison demandée",
  quickSeasonsDone_other: "« {{title}} » : {{count}} saisons demandées",
  quickRequestSeasons: "Demander des saisons de {{title}}",
} as const;
