import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { AvailabilityChannel, AvailabilityVerdict } from "../api/types-releases";
import {
  CHANNEL_STYLE, cardChannels, channelLabel, hasSignal, isUncharted,
  outlookLabel, shortDate, verdictTooltip,
} from "../utils/availability-labels";
import { STATUS_STYLE } from "../styles/status";

/**
 * Par où un titre est sorti — et donc ce qu'une demande peut espérer.
 *
 * Les canaux se CUMULENT : un film peut être encore à l'affiche et déjà pressé
 * en Blu-ray. La version précédente n'en montrait qu'un, et faisait disparaître
 * le plus utile des deux ; pire, un film sorti en vidéo retombait sur
 * « récupérable », c'est-à-dire sur rien du tout. On empile donc jusqu'à deux
 * mentions, la plus probante en tête.
 *
 * Un titre sans canal à signaler n'affiche toujours rien : le mot « Disponible »
 * appartient aux demandes (« c'est dans ta bibliothèque ») et le catalogue
 * ancien n'a pas à être bruité.
 */

interface Props {
  verdict: AvailabilityVerdict | null | undefined;
  /** `card` : compact sous le titre. `detail` : phrase complète. */
  variant?: "card" | "detail";
  /**
   * Titre déjà dans la bibliothèque. On tait alors « Potentiellement
   * disponible » : la carte porte déjà « Disponible » sur son affiche, et les
   * deux mentions côte à côte se contrediraient.
   */
  inLibrary?: boolean;
}

export const AvailabilityPill = memo(function AvailabilityPill({
  verdict, variant = "card", inLibrary,
}: Props) {
  const { t } = useTranslation("seer");

  /* Les séries n'ont pas de canaux : leur seul obstacle est une diffusion qui
   * n'a pas commencé, et il vaut la peine d'être dit. */
  if (!hasSignal(verdict) || !verdict) return null;
  const channels = verdict.channels ?? [];

  /* Aucune sortie connue nulle part : on le dit plutôt que de laisser une carte
   * muette, qui se lit comme un oubli. Sauf s'il est déjà dans la bibliothèque. */
  if (isUncharted(verdict)) {
    if (inLibrary) return null;
    return <Uncharted t={t} long={variant === "detail"} />;
  }

  if (variant === "detail") {
    // « La demande a de bonnes chances d'aboutir » n'a pas de sens pour un
    // titre qui est déjà sur le serveur.
    const outlook = inLibrary ? null : outlookLabel(verdict, t);
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {channels.length > 0
            ? channels.map((c) => <Chip key={c.id} channel={c} t={t} long />)
            : <NotAired verdict={verdict} t={t} long />}
        </div>
        {outlook && (
          <p className="text-center text-[11px] leading-relaxed text-tentacle-text-quaternary">{outlook}</p>
        )}
      </div>
    );
  }

  const shown = cardChannels(verdict);

  /* Le détail complet vit dans l'infobulle, hors d'atteinte au clavier et pour
   * un lecteur d'écran : il est donc aussi porté par le libellé accessible. */
  const detail = verdictTooltip(verdict, t);

  return (
    <span className="mt-0.5 flex flex-col items-start gap-0.5" title={detail} aria-label={detail}>
      {shown.length > 0
        ? shown.map((c) => <Chip key={c.id} channel={c} t={t} />)
        : <NotAired verdict={verdict} t={t} />}
    </span>
  );
});

type Translate = (key: string, opts?: Record<string, unknown>) => string;

function Chip({ channel, t, long }: { channel: AvailabilityChannel; t: Translate; long?: boolean }) {
  const style = CHANNEL_STYLE[channel.id];
  const label = channelLabel(channel, t, long);
  return long ? (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${style}`}>
      <Dot />
      {label}
    </span>
  ) : (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${style}`}
    >
      <Dot />
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * Aucune sortie connue — mais rien n'interdit d'essayer.
 *
 * Volontairement en retrait : c'est la seule mention qui relève de la déduction
 * et non d'une date. Elle ne doit pas se disputer l'attention avec « En Blu-ray »
 * ou « En streaming », qui reposent, eux, sur un fait.
 */
function Uncharted({ t, long }: { t: Translate; long?: boolean }) {
  const label = t(long ? "seer:availUnchartedLong" : "seer:availUncharted");
  const style = "bg-tentacle-fill-subtle text-tentacle-text-tertiary";

  return long ? (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${style}`}>
      <Dot />
      {label}
    </span>
  ) : (
    <span
      className={`mt-0.5 inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${style}`}
      title={t("seer:availUnchartedLong")}
    >
      <Dot />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Série dont la diffusion n'a pas commencé — aucun canal, mais un obstacle réel. */
function NotAired({ verdict, t, long }: { verdict: AvailabilityVerdict; t: Translate; long?: boolean }) {
  const date = verdict.date ? shortDate(verdict.date) : "";
  const label = !date
    ? t("seer:availNotAiredYet")
    : t(long ? "seer:availAirsOnLong" : "seer:availAirsOn", { date });

  return long ? (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLE.queued.chip}`}
    >
      <Dot />
      {label}
    </span>
  ) : (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE.queued.chip}`}
    >
      <Dot />
      <span className="truncate">{label}</span>
    </span>
  );
}

function Dot() {
  return <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />;
}
