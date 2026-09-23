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
} as const;
