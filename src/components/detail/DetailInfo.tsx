/* ------------------------------------------------------------------ */
/*  Vigie — Ce qu'on veut savoir d'un titre, à côté de son histoire     */
/* ------------------------------------------------------------------ */

/*
 * Trois cartes, dans l'ordre des questions : où le regarder tout de suite,
 * par où il est sorti (et donc ce qu'une demande peut espérer), et sa fiche
 * (réalisation, statut, chaîne, studios). En colonne à droite sur grand
 * écran, sous l'histoire au téléphone.
 */

import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SeerrMovieDetail, SeerrTvDetail } from "../../api/types";
import type { AvailabilityChannel, AvailabilityVerdict } from "../../api/types-releases";
import { channelLabel, isUncharted, outlookLabel, shortDate } from "../../utils/availability-labels";
import { getCurrentLanguage } from "../../utils/media-helpers";
import { CalendarIcon, DashedCircleIcon, DiscIcon, PlayCircleIcon, TicketIcon } from "../ui/icons";

export interface WatchProviderEntry {
  logo_path: string;
  provider_id: number;
  provider_name: string;
}

const CHANNEL_ICON: Record<AvailabilityChannel["id"], (p: { className?: string }) => ReactNode> = {
  theatrical: TicketIcon, digital: PlayCircleIcon, streaming: PlayCircleIcon, physical: DiscIcon,
};

const TV_STATUS_KEY: Record<string, string> = {
  "Returning Series": "seer:tvStatusReturning", Planned: "seer:tvStatusPlanned",
  "In Production": "seer:tvStatusInProduction", Ended: "seer:tvStatusEnded",
  Canceled: "seer:tvStatusCancelled", Cancelled: "seer:tvStatusCancelled", Pilot: "seer:tvStatusPilot",
  Released: "seer:prodStatusReleased", "Post Production": "seer:prodStatusPost",
};

/** « ja » → « Japonais » dans la langue de l'interface ; le code lui-même si le navigateur l'ignore. */
function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([getCurrentLanguage()], { type: "language" }).of(code);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function money(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-tentacle-fill-subtle p-4 ring-1 ring-tentacle-border-subtle">
      <h3 className="mb-3 text-sm font-bold text-tentacle-text-primary">{title}</h3>
      {children}
    </section>
  );
}

interface Props {
  detail: SeerrMovieDetail | SeerrTvDetail | undefined;
  mediaType: "movie" | "tv";
  verdict: AvailabilityVerdict | null;
  providers: WatchProviderEntry[] | undefined;
  inLibrary: boolean;
}

export const DetailInfo = memo(function DetailInfo({ detail, mediaType, verdict, providers, inLibrary }: Props) {
  const { t } = useTranslation("seer");
  const movie = mediaType === "movie" ? (detail as SeerrMovieDetail | undefined) : undefined;
  const tv = mediaType === "tv" ? (detail as SeerrTvDetail | undefined) : undefined;

  const director = movie?.credits?.crew?.find((c) => c.job === "Director")?.name;
  const rows: Array<[string, string]> = [];
  if (director) rows.push([t("seer:detailDirector"), director]);
  if (tv?.createdBy?.length) rows.push([t("seer:detailCreator"), tv.createdBy.map((c) => c.name).join(", ")]);
  if (detail?.status) rows.push([t("seer:detailStatus"), TV_STATUS_KEY[detail.status] ? t(TV_STATUS_KEY[detail.status]) : detail.status]);
  if (detail?.originalLanguage) rows.push([t("seer:detailLanguage"), languageName(detail.originalLanguage)]);
  if (tv?.networks?.length) rows.push([t("seer:detailNetwork"), tv.networks.map((n) => n.name).join(", ")]);
  if (movie?.budget) rows.push([t("seer:detailBudget"), money(movie.budget)]);
  if (movie?.revenue) rows.push([t("seer:detailRevenue"), money(movie.revenue)]);
  const studios = detail?.productionCompanies ?? [];

  const channels = verdict?.channels ?? [];
  const outlook = verdict && !inLibrary ? outlookLabel(verdict, t) : null;
  const notAired = verdict?.kind === "not_aired";
  const uncharted = !inLibrary && isUncharted(verdict);

  return (
    <div className="space-y-4">
      {providers && providers.length > 0 && (
        <Card title={t("availableOn")}>
          <ul className="grid grid-cols-2 gap-2">
            {providers.map((p) => (
              <li key={p.provider_id} className="flex min-w-0 items-center gap-2 rounded-xl bg-tentacle-fill-subtle p-1.5 pr-2.5">
                <img src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-tentacle-border-subtle" />
                <span className="min-w-0 truncate text-xs font-semibold text-tentacle-text-secondary">{p.provider_name}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(channels.length > 0 || notAired || uncharted) && (
        <Card title={t("seer:detailReleases")}>
          <ul className="space-y-2.5">
            {channels.map((c) => {
              const Icon = CHANNEL_ICON[c.id];
              return (
                <li key={c.id} className="flex items-start gap-2.5 text-sm text-tentacle-text-secondary">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-tentacle-text-tertiary" />
                  {channelLabel(c, t, true)}
                </li>
              );
            })}
            {channels.length === 0 && notAired && (
              <li className="flex items-start gap-2.5 text-sm text-tentacle-text-secondary">
                <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-tentacle-text-tertiary" />
                {verdict?.date ? t("seer:availAirsOnLong", { date: shortDate(verdict.date) }) : t("seer:availNotAiredYet")}
              </li>
            )}
            {channels.length === 0 && uncharted && (
              <li className="flex items-start gap-2.5 text-sm text-tentacle-text-secondary">
                <DashedCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-tentacle-text-tertiary" />
                {t("seer:availUnchartedLong")}
              </li>
            )}
          </ul>
          {outlook && <p className="mt-3 text-xs leading-relaxed text-tentacle-text-tertiary">{outlook}</p>}
        </Card>
      )}

      {(rows.length > 0 || studios.length > 0) && (
        <Card title={t("seer:detailFacts")}>
          <dl className="space-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <dt className="w-24 shrink-0 text-tentacle-text-tertiary">{label}</dt>
                <dd className="min-w-0 flex-1 text-tentacle-text-secondary">{value}</dd>
              </div>
            ))}
          </dl>
          {studios.length > 0 && (
            <div className={rows.length > 0 ? "mt-3 border-t border-tentacle-border-subtle pt-3" : ""}>
              <p className="mb-2 text-xs font-semibold text-tentacle-text-tertiary">{t("seer:detailStudios")}</p>
              <div className="flex flex-wrap gap-1.5">
                {studios.slice(0, 8).map((co) => (
                  <span key={co.id} className="rounded-full bg-tentacle-fill-soft px-2.5 py-1 text-xs text-tentacle-text-secondary">{co.name}</span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
});
