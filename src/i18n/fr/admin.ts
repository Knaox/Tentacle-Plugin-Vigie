export default {
  // Profiles
  profileLabel: "Profil de qualité",
  profileDefault: "Par défaut",
  profilesTitle: "Profils de qualité",
  profileAdd: "Ajouter un profil",
  profilesEmpty: "Aucun profil configuré — les paramètres Jellyseerr par défaut seront utilisés",
  profileNamePlaceholder: "Nom du profil (ex: Full HD, 4K HDR...)",
  profileTarget: "Type de média ciblé",
  profileTags: "Tags personnalisés",
  profileTagsHint: "Si des tags sont sélectionnés, ils remplaceront les tags par défaut sur la demande",
  profileTagManual: "Tag ID...",

  // Config
  statusConnected: "Connecté",
  statusError: "Erreur",
  statusTesting: "Test...",
  statusNotConfigured: "Non configuré",
  urlLabel: "URL de votre Jellyseerr / Overseerr",
  urlPlaceholder: "https://seerr.example.com",
  testButton: "Tester",
  apiKeyLabel: "Clé API",
  apiKeyPlaceholder: "Clé API Jellyseerr / Overseerr",
  toggleEnabled: "Activer Vigie",
  toggleEnabledDesc: "Montre l'onglet dans Tentacle et permet d'y faire des demandes",
  toggleAutoApprove: "Approuver automatiquement",
  toggleAutoApproveDesc: "La demande d'un compte sans droit d'approbation dans Jellyseerr est validée dès son envoi",
  admSpecialSeasons: "Épisodes spéciaux",
  admSpecialSeasonsDesc: "La saison 0 se demande si Jellyseerr l'autorise (Paramètres › Général › autoriser les demandes d'épisodes spéciaux)",
  admSpecialSeasonsOn: "Autorisés",
  admSpecialSeasonsOff: "Non autorisés",
  saving: "Sauvegarde...",
  save: "Sauvegarder",
  configSaveError: "Erreur lors de la sauvegarde",

  // Admin — gestion utilisateurs
  adminUsersAllowMovies: "Films",
  adminUsersAllowTv: "Séries",
  adminUsersAllowAnime: "Animés",
  adminUsersSaved: "Modifications enregistrées",

  // Réassignement des propriétaires de demandes
  adminReassignButton: "Synchroniser les demandes locales",
  adminReassignHint: "Pour chaque demande locale, vérifie le propriétaire côté Jellyseerr et le corrige si besoin. Crée un utilisateur Jellyseerr placeholder si le compte Jellyfin a été supprimé — son historique sera récupéré dès qu'il recrée un compte avec le même nom.",
  adminReassignDone: "{{reassigned}} réassignée(s), {{recreated}} recréée(s), {{orphansCreated}} placeholder(s), {{alreadyOk}} déjà OK, {{failed}} échec(s)",
} as const;
