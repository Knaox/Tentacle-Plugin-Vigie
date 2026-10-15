/* ------------------------------------------------------------------ */
/*  Vigie — Ce qu'on dit d'un blocage, en mots simples (FR / EN)        */
/* ------------------------------------------------------------------ */

/*
 * Une phrase par cause (blocked-causes.ts), puis ce qu'il faut en attendre :
 * patienter, ou qu'un administrateur intervienne. Les avis du compte et le
 * hub (« Mes demandes », i18n `states`) disent les MÊMES mots — un test
 * miroir y veille (blocked-texts.test.ts).
 *
 * Jamais la famille de « téléchargement » / « download » : l'application
 * mobile affiche ces avis, et les relecteurs d'Apple refusent le mot.
 */

import { CAUSES, type BlockedCause, type Resolution } from "./blocked-causes";

export type NoticeLang = "fr" | "en";

export const CAUSE_TEXT: Readonly<Record<NoticeLang, Readonly<Record<BlockedCause, string>>>> = {
  fr: {
    sample: "Le fichier reçu n'est qu'un extrait, pas le titre complet.",
    notUpgrade: "Une version de qualité égale ou meilleure est déjà en place : le fichier reçu n'est pas gardé.",
    alreadyHere: "Ce fichier est déjà présent dans la bibliothèque.",
    unrecognized: "Le serveur ne reconnaît pas le fichier reçu et ne peut pas le ranger seul.",
    missingEpisodes: "Le fichier reçu ne contient pas tous les épisodes attendus.",
    notVideo: "Le fichier reçu n'est pas une vidéo lisible.",
    qualityRejected: "Le fichier reçu ne correspond pas à la qualité ou à la langue voulues.",
    diskSpace: "Le serveur manque d'espace disque pour ranger ce titre.",
    fileAccess: "Le serveur n'a pas les droits pour ranger le fichier reçu.",
    busyFile: "Le fichier reçu est encore en cours de préparation.",
    awaitingTitle: "L'épisode vient de sortir : le serveur attend son titre officiel pour le ranger.",
    importRefused: "Le fichier est arrivé, mais le serveur refuse de le ranger.",
    noSource: "Plus personne ne partage ce titre pour l'instant : le transfert est à l'arrêt.",
    transferFailed: "Le transfert a échoué ; le serveur cherche une autre source.",
    clientUnreachable: "Le serveur n'arrive plus à joindre son logiciel de transfert.",
    paused: "Le transfert a été mis en pause sur le serveur.",
    notFound: "Aucune source n'a été trouvée pour ce titre pour l'instant.",
    unknown: "Quelque chose empêche ce titre d'arriver.",
  },
  en: {
    sample: "The file received is only a sample, not the full title.",
    notUpgrade: "A version of equal or better quality is already in place, so the new file isn't kept.",
    alreadyHere: "This file is already in the library.",
    unrecognized: "The server doesn't recognise the file it received and can't file it on its own.",
    missingEpisodes: "The file received is missing some of the expected episodes.",
    notVideo: "The file received isn't a playable video.",
    qualityRejected: "The file received doesn't match the wanted quality or language.",
    diskSpace: "The server is out of disk space to store this title.",
    fileAccess: "The server doesn't have permission to store the file it received.",
    busyFile: "The file received is still being prepared.",
    awaitingTitle: "The episode just aired: the server is waiting for its official title before filing it.",
    importRefused: "The file arrived, but the server won't add it to the library.",
    noSource: "Nobody is sharing this title right now, so the transfer has stalled.",
    transferFailed: "The transfer failed; the server is looking for another source.",
    clientUnreachable: "The server can't reach its transfer software.",
    paused: "The transfer was paused on the server.",
    notFound: "No source has been found for this title yet.",
    unknown: "Something is keeping this title from arriving.",
  },
};

export const RESOLUTION_TEXT: Readonly<Record<NoticeLang, Readonly<Record<Resolution, string>>>> = {
  fr: {
    self: "Patientez : le serveur réessaie tout seul, Vigie vous préviendra.",
    admin: "Un administrateur doit intervenir.",
    unsure: "Si rien ne bouge, un administrateur devra intervenir.",
  },
  en: {
    self: "Hang tight: the server keeps trying on its own, and Vigie will let you know.",
    admin: "An administrator needs to step in.",
    unsure: "If nothing changes, an administrator will need to step in.",
  },
};

export function noticeLang(raw: string | null | undefined): NoticeLang {
  return raw?.trim().toLowerCase().startsWith("en") ? "en" : "fr";
}

/** Ce qui se passe, puis ce qu'il faut en attendre — le corps d'un avis de blocage. */
export function blockedSentence(cause: BlockedCause, lang: NoticeLang): string {
  return `${CAUSE_TEXT[lang][cause]} ${RESOLUTION_TEXT[lang][CAUSES[cause].resolution]}`;
}
