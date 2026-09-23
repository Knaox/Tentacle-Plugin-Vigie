/*
 * The five states of a title, and the details that refine them.
 *
 * "Download" only appears in the `*Web` keys: `stateLabel` never reads them in
 * the mobile app, which takes the `*App` keys instead — the word is banned
 * there (Tentacle's CLAUDE.md, "Mobile"); on web and desktop it is the right
 * word.
 *
 * "Stuck", never "failed": a download that stalls is waiting for a source.
 */
export default {
  stRequested: "Requested",
  stDownloadingWeb: "Downloading",
  stDownloadingApp: "On its way",
  stDownloadingShortWeb: "Downloading",
  stDownloadingShortApp: "On its way",
  stStalled: "Stuck",
  stAvailable: "Available",
  stPartial: "Partially available",
  stPartialShort: "Partial",
  stPercent: "{{percent}}%",
  stStalledHint: "Not moving for now — it resumes as soon as a source is back",
  stStalledSome_one: "{{count}} item stuck",
  stStalledSome_other: "{{count}} items stuck",
  stStateOf: "{{title}} — {{state}}",

  chTheater: "In theaters",
  chTheaterOn: "In theaters {{date}}",
  chStreaming: "Streaming",
  chStreamingOn: "Streaming {{date}}",
  chPhysical: "On Blu-ray",
  chPhysicalOn: "Blu-ray {{date}}",
  chUncharted: "Possibly available",
  chAirsOn: "Airs {{date}}",
  chNotAired: "Not aired yet",
  chReleaseOn: "Out {{date}}",
} as const;
