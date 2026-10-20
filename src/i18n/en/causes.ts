/*
 * Pourquoi un titre est bloqué, en anglais — mêmes mots que les avis
 * (server/arrival/blocked-texts.ts), tenus par le test miroir.
 */
export default {
  dtBlocked_sample: "The file received is only a sample, not the full title. An administrator needs to step in.",
  dtBlocked_notUpgrade: "A version of equal or better quality is already in place, so the new file isn't kept. An administrator needs to step in.",
  dtBlocked_alreadyHere: "This file is already in the library. An administrator needs to step in.",
  dtBlocked_unrecognized: "The server doesn't recognise the file it received and can't file it on its own. An administrator needs to step in.",
  dtBlocked_missingEpisodes: "The file received is missing some of the expected episodes. An administrator needs to step in.",
  dtBlocked_notVideo: "The file received isn't a playable video. An administrator needs to step in.",
  dtBlocked_qualityRejected: "The file received doesn't match the wanted quality or language. An administrator needs to step in.",
  dtBlocked_diskSpace: "The server is out of disk space to store this title. An administrator needs to step in.",
  dtBlocked_fileAccess: "The server doesn't have permission to store the file it received. An administrator needs to step in.",
  dtBlocked_busyFile: "The file received is still being prepared. This will sort itself out: the server keeps retrying on its own, nothing for you to do.",
  dtBlocked_awaitingTitle: "The episode just aired: the server is waiting for its official title before filing it. This will sort itself out: the server keeps retrying on its own, nothing for you to do.",
  dtBlocked_importRefused: "The file arrived, but the server won't add it to the library. If nothing changes, an administrator will need to step in.",
  dtBlocked_noSource: "Not enough people are sharing this file right now, so the transfer has stalled. This will sort itself out: the file will be searched for again automatically, nothing for you to do.",
  dtBlocked_transferFailed: "The transfer failed; the server is looking for another source. This will sort itself out: the file will be searched for again automatically, nothing for you to do.",
  dtBlocked_clientUnreachable: "The server can't reach its transfer software. If nothing changes, an administrator will need to step in.",
  dtBlocked_paused: "The transfer was paused on the server. An administrator needs to step in.",
  dtBlocked_notFound: "No source has been found for this title yet. This will sort itself out: the file will be searched for again automatically, nothing for you to do.",
  dtBlocked_unknown: "Something is keeping this title from arriving. If nothing changes, an administrator will need to step in.",
} as const;
