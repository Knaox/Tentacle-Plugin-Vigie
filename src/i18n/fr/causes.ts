/*
 * Pourquoi un titre est bloqué — les MÊMES mots que les avis envoyés au
 * compte (server/arrival/blocked-texts.ts), cause puis ce qu'il faut en
 * attendre. Le test miroir (src/requests/blockedPhrase.test.ts) les tient
 * octet pour octet : une phrase se change aux deux endroits.
 *
 * Les clés suivent les identifiants du serveur (liste fermée) : jamais renommées.
 */
export default {
  dtBlocked_sample: "Le fichier reçu n'est qu'un extrait, pas le titre complet. Un administrateur doit intervenir.",
  dtBlocked_notUpgrade: "Une version de qualité égale ou meilleure est déjà en place : le fichier reçu n'est pas gardé. Un administrateur doit intervenir.",
  dtBlocked_alreadyHere: "Ce fichier est déjà présent dans la bibliothèque. Un administrateur doit intervenir.",
  dtBlocked_unrecognized: "Le serveur ne reconnaît pas le fichier reçu et ne peut pas le ranger seul. Un administrateur doit intervenir.",
  dtBlocked_missingEpisodes: "Le fichier reçu ne contient pas tous les épisodes attendus. Un administrateur doit intervenir.",
  dtBlocked_notVideo: "Le fichier reçu n'est pas une vidéo lisible. Un administrateur doit intervenir.",
  dtBlocked_qualityRejected: "Le fichier reçu ne correspond pas à la qualité ou à la langue voulues. Un administrateur doit intervenir.",
  dtBlocked_diskSpace: "Le serveur manque d'espace disque pour ranger ce titre. Un administrateur doit intervenir.",
  dtBlocked_fileAccess: "Le serveur n'a pas les droits pour ranger le fichier reçu. Un administrateur doit intervenir.",
  dtBlocked_busyFile: "Le fichier reçu est encore en cours de préparation. Patientez : le serveur réessaie tout seul, Vigie vous préviendra.",
  dtBlocked_awaitingTitle: "L'épisode vient de sortir : le serveur attend son titre officiel pour le ranger. Patientez : le serveur réessaie tout seul, Vigie vous préviendra.",
  dtBlocked_importRefused: "Le fichier est arrivé, mais le serveur refuse de le ranger. Si rien ne bouge, un administrateur devra intervenir.",
  dtBlocked_noSource: "Plus personne ne partage ce titre pour l'instant : le transfert est à l'arrêt. Si rien ne bouge, un administrateur devra intervenir.",
  dtBlocked_transferFailed: "Le transfert a échoué ; le serveur cherche une autre source. Patientez : le serveur réessaie tout seul, Vigie vous préviendra.",
  dtBlocked_clientUnreachable: "Le serveur n'arrive plus à joindre son logiciel de transfert. Si rien ne bouge, un administrateur devra intervenir.",
  dtBlocked_paused: "Le transfert a été mis en pause sur le serveur. Un administrateur doit intervenir.",
  dtBlocked_notFound: "Aucune source n'a été trouvée pour ce titre pour l'instant. Patientez : le serveur réessaie tout seul, Vigie vous préviendra.",
  dtBlocked_unknown: "Quelque chose empêche ce titre d'arriver. Si rien ne bouge, un administrateur devra intervenir.",
} as const;
