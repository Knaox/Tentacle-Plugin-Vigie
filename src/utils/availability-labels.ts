import type {
  AvailabilityChannel, AvailabilityOutlook, AvailabilityVerdict, ChannelId,
} from "../api/types-releases";
import { formatAirDateShort, parseAirDate } from "./episode-dates";

/**
 * Le vocabulaire des canaux de sortie, en un seul endroit.
 *
 * Aucune couleur ici : un canal se reconnaît à son icône (cf. ChannelLine),
 * la couleur ne dit que l'état d'un titre.
 *
 * Le mot « Disponible » est proscrit : sur Mes demandes il signifie « dans ta
 * bibliothèque ». On nomme le canal, jamais l'état de possession.
 */

/** « 3 sept. » — l'année n'est utile que si la sortie déborde sur l'an prochain. */
export function shortDate(date: string): string {
  const parsed = parseAirDate(date);
  if (!parsed) return date;
  const full = formatAirDateShort(date);
  return parsed.getFullYear() === new Date().getFullYear()
    ? full.replace(/\s*\d{4}$/, "").replace(/,\s*$/, "")
    : full;
}

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/*
 * Deux registres par canal : le libellé COURT tient sous une affiche de grille
 * (une poignée de caractères, sans date quand elle est passée — « depuis le
 * 25 juin » n'apprend rien à qui veut juste savoir si ça existe), le libellé
 * LONG est une phrase complète pour la fiche détaillée et l'infobulle.
 */
const SHORT: Record<ChannelId, { out: string; soon: string }> = {
  physical: { out: "seer:availPhysicalOut", soon: "seer:availPhysicalSoon" },
  digital: { out: "seer:availDigitalOut", soon: "seer:availOnlineOn" },
  streaming: { out: "seer:availStreamingNow", soon: "seer:availStreamingNow" },
  theatrical: { out: "seer:availStillInTheaters", soon: "seer:availTheatricalSoon" },
};

const LONG: Record<ChannelId, { out: string; soon: string }> = {
  physical: { out: "seer:availPhysicalOutLong", soon: "seer:availPhysicalSoonLong" },
  digital: { out: "seer:availDigitalOutLong", soon: "seer:availOnlineOnLong" },
  streaming: { out: "seer:availStreamingNowLong", soon: "seer:availStreamingNowLong" },
  theatrical: { out: "seer:availInTheatersLong", soon: "seer:availTheatricalSoonLong" },
};

export function channelLabel(channel: AvailabilityChannel, t: Translate, long = false): string {
  const table = long ? LONG : SHORT;
  const key = channel.released ? table[channel.id].out : table[channel.id].soon;
  return t(key, { date: channel.date ? shortDate(channel.date) : "" });
}

const OUTLOOK_I18N: Record<AvailabilityOutlook, string> = {
  likely: "seer:availOutlookLikely",
  unlikely: "seer:availOutlookUnlikely",
  not_yet: "seer:availOutlookNotYet",
};

/**
 * La phrase qui répond à « est-ce que ça va marcher ? ». On oriente sans jamais
 * promettre : aucun pourcentage, aucun engagement — seulement ce que la
 * présence ou l'absence d'une sortie hors salle laisse raisonnablement espérer.
 */
export function outlookLabel(verdict: AvailabilityVerdict, t: Translate): string | null {
  /* Un titre sans le moindre canal connu n'a rien à dire : se taire vaut mieux
   * que rassurer à tort tout le catalogue ancien. */
  if (verdict.channels.length === 0) return null;
  return t(OUTLOOK_I18N[verdict.outlook]);
}


/**
 * Ni en salle, ni en streaming, ni annoncé nulle part — et pourtant rien
 * n'empêche de le demander.
 *
 * Ces titres n'affichaient rien du tout, ce qui se lisait comme un oubli plutôt
 * que comme une absence d'information. On le dit donc, mais sobrement : c'est
 * la seule mention qui relève de la déduction et non d'une date connue.
 */
export function isUncharted(verdict: AvailabilityVerdict | null | undefined): boolean {
  if (!verdict) return false;
  return (verdict.channels?.length ?? 0) === 0 && verdict.outlook === "likely";
}


