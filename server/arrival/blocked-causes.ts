/* ------------------------------------------------------------------ */
/*  Vigie — Pourquoi un titre est bloqué : une table FERMÉE de causes   */
/* ------------------------------------------------------------------ */

/*
 * Sonarr et Radarr disent pourquoi une entrée de leur file n'avance plus,
 * dans leurs mots (« Sample », « Not an upgrade for existing episode
 * file(s) », « Found matching series via grab history, but release was
 * matched to series by ID. Automatic import is not possible. » — relevé sur
 * le serveur de Damien le 15/10). Ce module les range dans une liste FERMÉE
 * de causes : chacune dit sa phase (transfert ou import), si elle se résout
 * seule, et combien de temps elle doit durer avant qu'on en prévienne le
 * compte. Une cause inconnue n'est jamais devinée : repli générique.
 *
 * Les identifiants voyagent (API, base des avis déjà envoyés, clés i18n du
 * hub) : ils ne se renomment jamais.
 */

export type BlockedCause =
  | "sample" | "notUpgrade" | "alreadyHere" | "unrecognized" | "missingEpisodes" | "notVideo"
  | "qualityRejected" | "diskSpace" | "fileAccess" | "busyFile" | "awaitingTitle" | "importRefused"
  | "noSource" | "transferFailed" | "clientUnreachable" | "paused" | "notFound" | "unknown";

/**
 * Ce qu'il faut en attendre : le fichier sera RECHERCHÉ de nouveau tout seul
 * (Sonarr ou Radarr écartent la source et en cherchent une autre — ou Vigie
 * les y pousse, cf. stalled-research.ts), le serveur réessaie de lui-même,
 * un administrateur doit intervenir, ou on ne sait pas.
 */
export type Resolution = "research" | "self" | "admin" | "unsure";

export interface CauseSpec {
  /** `import` : le fichier est là, le rangement est refusé — l'avis « import refusé ». */
  phase: "import" | "transfer" | "search";
  resolution: Resolution;
  /** Durée pendant laquelle la cause doit tenir avant d'être annoncée (cf. notice-watch.ts). */
  confirmMs: number;
}

const MIN = 60_000;
/*
 * Un refus d'import est stable : Sonarr le relit à chaque rafraîchissement de
 * sa file (une minute) et redit la même chose. Deux minutes = deux lectures
 * concordantes. Un transfert qui coince, lui, repart souvent seul (une source
 * qui revient, un client qui redémarre) : on lui laisse le temps de le faire.
 */
const IMPORT = 2 * MIN;
const TRANSFER = 10 * MIN;

export const CAUSES: Readonly<Record<BlockedCause, CauseSpec>> = {
  sample: { phase: "import", resolution: "admin", confirmMs: IMPORT },
  notUpgrade: { phase: "import", resolution: "admin", confirmMs: IMPORT },
  alreadyHere: { phase: "import", resolution: "admin", confirmMs: IMPORT },
  unrecognized: { phase: "import", resolution: "admin", confirmMs: IMPORT },
  missingEpisodes: { phase: "import", resolution: "admin", confirmMs: IMPORT },
  notVideo: { phase: "import", resolution: "admin", confirmMs: IMPORT },
  qualityRejected: { phase: "import", resolution: "admin", confirmMs: IMPORT },
  diskSpace: { phase: "import", resolution: "admin", confirmMs: IMPORT },
  fileAccess: { phase: "import", resolution: "admin", confirmMs: IMPORT },
  // Fichier verrouillé ou encore décompressé : Sonarr réessaie à la lecture suivante.
  busyFile: { phase: "import", resolution: "self", confirmMs: TRANSFER },
  // Sonarr attend jusqu'à 24 h le titre d'un épisode tout juste diffusé, puis range seul.
  awaitingTitle: { phase: "import", resolution: "self", confirmMs: TRANSFER },
  importRefused: { phase: "import", resolution: "unsure", confirmMs: IMPORT },
  // Plus personne ne partage le fichier : Vigie écarte la source et relance la
  // recherche s'il ne repart pas (arrival/stalled-research.ts).
  noSource: { phase: "transfer", resolution: "research", confirmMs: 20 * MIN },
  // Échec du transfert : la source est écartée, Sonarr ou Radarr en cherchent une autre.
  transferFailed: { phase: "transfer", resolution: "research", confirmMs: TRANSFER },
  clientUnreachable: { phase: "transfer", resolution: "unsure", confirmMs: 15 * MIN },
  paused: { phase: "transfer", resolution: "admin", confirmMs: TRANSFER },
  // Sonarr et Radarr relisent les nouvelles sorties de leurs indexeurs en continu.
  notFound: { phase: "search", resolution: "research", confirmMs: TRANSFER },
  unknown: { phase: "transfer", resolution: "unsure", confirmMs: TRANSFER },
};

/*
 * L'ordre compte : la cause la plus précise d'abord. « Not an upgrade for
 * existing episode file(s) » parle d'un fichier existant mais n'est pas un
 * doublon ; « Unpacking failed » est un échec, pas un fichier occupé.
 */
const PATTERNS: ReadonlyArray<readonly [BlockedCause, RegExp]> = [
  ["diskSpace", /free space|disk space|disk is full|disk full|no space left|not enough space/],
  ["fileAccess", /access to the path|access is denied|permission|read-only|not accessible|does not exist|doesn't exist|could not find (the )?path/],
  ["sample", /\bsample\b/],
  ["notUpgrade", /not an upgrade|not a custom format upgrade/],
  ["alreadyHere", /already imported|already exists|destination already/],
  ["awaitingTitle", /tba title|does not have a title|recently aired/],
  ["missingEpisodes", /missing from the release|expected in this release|were not imported/],
  ["notVideo", /no files found are eligible|no video files|unsupported extension|no audio tracks|executable|dangerous file|archive file|not a valid video/],
  ["unrecognized", /unable to parse|unknown (series|movie)|unable to identify|matched to (series|movie) by id|title mismatch|manual import|automatic import is not possible|invalid season or episode|unexpected considering/],
  ["qualityRejected", /quality|custom format|language|not wanted|cutoff/],
  ["noSource", /stalled|no connections|no peers|no seeds|seeders|downloading metadata/],
  ["clientUnreachable", /unable to (connect|communicate)|client (is )?unavailable|unavailable/],
  ["transferFailed", /fail|abort|cannot be completed|missing articles|repair/],
  ["busyFile", /locked|in use|being used|unpack|extract/],
];

const IMPORT_STATES = new Set(["importBlocked", "importFailed"]);
const FAILED_STATES = new Set(["failed", "failedPending"]);

/** Ce que la file dit d'une entrée bloquée. */
export interface BlockedSignals {
  /** Statut du client (`warning`, `paused`, `downloadClientUnavailable`…). */
  status?: string;
  /** État suivi par Sonarr ou Radarr (`importBlocked`, `failedPending`…). */
  trackedDownloadState?: string;
  /** `errorMessage` puis les `statusMessages`, dans l'ordre de la file. */
  messages: readonly string[];
}

/** La cause d'une entrée bloquée — jamais devinée : sans signal reconnu, `importRefused` ou `unknown`. */
export function classifyBlocked(signals: BlockedSignals): BlockedCause {
  if (signals.status === "paused") return "paused";
  const text = signals.messages.join("\n").toLowerCase();
  if (text) {
    for (const [cause, pattern] of PATTERNS) if (pattern.test(text)) return cause;
  }
  if (signals.status === "downloadClientUnavailable") return "clientUnreachable";
  if (IMPORT_STATES.has(signals.trackedDownloadState ?? "") || signals.status === "completed") return "importRefused";
  if (FAILED_STATES.has(signals.trackedDownloadState ?? "") || signals.status === "failed") return "transferFailed";
  return "unknown";
}

/**
 * La cause d'un titre parmi celles de ses éléments bloqués : celle qui exige
 * un administrateur d'abord (c'est elle qu'il faut dire), puis la première.
 */
export function leadingCause(causes: readonly BlockedCause[]): BlockedCause | null {
  return causes.find((c) => CAUSES[c].resolution === "admin") ?? causes[0] ?? null;
}

export function isBlockedCause(raw: unknown): raw is BlockedCause {
  return typeof raw === "string" && Object.prototype.hasOwnProperty.call(CAUSES, raw);
}
