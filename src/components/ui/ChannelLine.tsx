/* ------------------------------------------------------------------ */
/*  Vigie — Par où le titre est sorti, sous son affiche                */
/* ------------------------------------------------------------------ */

/*
 * « Au cinéma », « En streaming », « Potentiellement disponible » : ce qu'une
 * demande peut espérer, lu d'un coup d'œil. SOUS l'affiche, jamais dessus —
 * sur la page, aucune image ne peut le masquer. Une icône par canal, un texte
 * neutre : la couleur est réservée à l'état (demandé, disponible…), et deux
 * dictionnaires de teintes se contrediraient sur la même carte.
 */

import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { AvailabilityVerdict } from "../../api/types-releases";
import { isUncharted, shortDate } from "../../utils/availability-labels";
import { CalendarIcon, DashedCircleIcon, DiscIcon, PlayCircleIcon, TicketIcon } from "./icons";

type Translate = (key: string, opts?: Record<string, unknown>) => string;

export type ChannelKind = "theater" | "streaming" | "physical" | "upcoming" | "uncharted";

export interface ChannelInfo {
  kind: ChannelKind;
  label: string;
}

const ICON: Record<ChannelKind, (p: { className?: string }) => ReactNode> = {
  theater: TicketIcon,
  streaming: PlayCircleIcon,
  physical: DiscIcon,
  upcoming: CalendarIcon,
  uncharted: DashedCircleIcon,
};

/** Le canal le plus probant d'un verdict, en quelques mots — `null` : rien à dire. */
export function channelOf(verdict: AvailabilityVerdict, t: Translate): ChannelInfo | null {
  const first = verdict.channels?.[0];
  if (first) {
    const date = first.date ? shortDate(first.date) : "";
    switch (first.id) {
      case "theatrical":
        return { kind: "theater", label: first.released ? t("seer:chTheater") : t("seer:chTheaterOn", { date }) };
      case "digital":
        return { kind: "streaming", label: first.released ? t("seer:chStreaming") : t("seer:chStreamingOn", { date }) };
      case "streaming":
        return { kind: "streaming", label: t("seer:chStreaming") };
      case "physical":
        return { kind: "physical", label: first.released ? t("seer:chPhysical") : t("seer:chPhysicalOn", { date }) };
    }
  }
  if (verdict.kind === "not_aired") {
    return { kind: "upcoming", label: verdict.date ? t("seer:chAirsOn", { date: shortDate(verdict.date) }) : t("seer:chNotAired") };
  }
  if (verdict.kind === "upcoming" && verdict.date) {
    return { kind: "upcoming", label: t("seer:chReleaseOn", { date: shortDate(verdict.date) }) };
  }
  if (isUncharted(verdict)) return { kind: "uncharted", label: t("seer:chUncharted") };
  return null;
}

interface Props {
  channel: ChannelInfo | null;
  /** Ce qui s'affiche sans canal : le type et l'année. */
  fallback: string;
  year?: string;
}

export const ChannelLine = memo(function ChannelLine({ channel, fallback, year }: Props) {
  if (!channel) {
    return <p className="mt-0.5 truncate text-xs text-tentacle-text-tertiary">{fallback}</p>;
  }
  const Icon = ICON[channel.kind];
  const unsure = channel.kind === "uncharted";
  return (
    <p className={`mt-0.5 flex items-start gap-1 text-[11px] font-medium leading-4 ${unsure ? "text-tentacle-text-tertiary" : "text-tentacle-text-secondary"}`}>
      <Icon className="mt-px h-3.5 w-3.5 shrink-0 text-tentacle-text-tertiary" />
      <span className="line-clamp-2 min-w-0">
        {channel.label}
        {year && <span className="font-normal text-tentacle-text-quaternary"> · {year}</span>}
      </span>
    </p>
  );
});
