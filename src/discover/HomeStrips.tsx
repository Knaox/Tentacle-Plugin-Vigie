/* ------------------------------------------------------------------ */
/*  Vigie — Les deux bandeaux personnels de l'accueil                  */
/* ------------------------------------------------------------------ */

/*
 * Le catalogue et les demandes sur la même page : en arrivant, on voit
 * d'abord où en sont SES demandes (ce qui arrive, ce qui vient d'arriver),
 * puis ce qui sort cette semaine — ses séries en priorité, sinon ce que tout
 * le monde attend. Chaque bandeau mène à son onglet : on n'a plus à deviner
 * que le calendrier existe, il se présente lui-même.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { LocalRequest } from "../api/types";
import type { CalendarItem } from "../api/types-releases";
import { useGlobalCalendar } from "../hooks/useReleases";
import { addDays, today } from "../utils/calendar-groups";
import { applyLocalDays } from "../utils/calendar-localtime";
import { calendarAsMedia, requestAsMedia } from "../utils/as-media";
import { calendarStatus } from "../utils/title-state";
import { episodeLabel, KIND_I18N } from "../utils/calendar-kind";
import { shortDayLabel } from "../utils/day-label";
import { groupOf, recentlyArrived } from "../requests/requestGroups";
import { RequestTile } from "../requests/RequestTile";
import { Rail } from "../components/ui/Rail";
import { PosterCard } from "../components/ui/PosterCard";
import { CalendarIcon, InboxIcon, SearchIcon, SparkIcon } from "../components/ui/icons";
import { useHub } from "../hub/HubContext";
import type { HubData } from "../hub/useHubData";

const MAX_TILES = 14;

export const MyRequestsStrip = memo(function MyRequestsStrip({ data }: { data: HubData }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const { list, progress } = data;
  const shown = useMemo(() => {
    const now = Date.now();
    const arriving = list.filter((r) => groupOf(r, progress.byId.has(r.id)) === "active");
    const arrived = list.filter((r) => recentlyArrived(r, now) && groupOf(r, progress.byId.has(r.id)) !== "active");
    return [...arriving, ...arrived].slice(0, MAX_TILES);
  }, [list, progress.byId]);

  if (data.requests.isPending) return null;
  if (list.length === 0) return <HowItWorks />;
  if (shown.length === 0) return null;

  const open = (request: LocalRequest) => hub.openMedia(requestAsMedia(request));
  return (
    <Rail
      title={t("seer:stripRequests")}
      subtitle={t("seer:stripRequestsHint", { count: data.counts.active })}
      icon={<InboxIcon className="h-5 w-5" />}
      action={{ label: t("seer:seeAll"), onClick: () => hub.setTab("requests") }}
    >
      {shown.map((request) => (
        <RequestTile key={request.id} request={request} progress={progress.byId.get(request.id)} receivedAt={progress.updatedAt} onOpen={open} />
      ))}
    </Rail>
  );
});

/** Premier passage, aucune demande : trois gestes, dits une fois. */
function HowItWorks() {
  const { t } = useTranslation("seer");
  const steps = [
    { icon: <SearchIcon className="h-5 w-5" />, title: t("seer:howSearch"), text: t("seer:howSearchText") },
    { icon: <SparkIcon className="h-5 w-5" />, title: t("seer:howRequest"), text: t("seer:howRequestText") },
    { icon: <CalendarIcon className="h-5 w-5" />, title: t("seer:howWatch"), text: t("seer:howWatchText") },
  ];
  return (
    <section aria-label={t("seer:howTitle")} className="rounded-3xl bg-tentacle-surface-1 p-5 ring-1 ring-tentacle-border-subtle sm:p-6" style={{ backgroundImage: "radial-gradient(120% 140% at 0% 0%, rgba(var(--brand-rgb),0.16), transparent 60%)" }}>
      <h2 className="text-lg font-bold text-tentacle-text-primary">{t("seer:howTitle")}</h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-light)]">{step.icon}</span>
            <span>
              <span className="block text-sm font-semibold text-tentacle-text-primary">{step.title}</span>
              <span className="block text-sm text-tentacle-text-tertiary">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ribbonOf(item: CalendarItem, t: (k: string) => string): string {
  const day = shortDayLabel(item.date, t);
  const what = item.kind === "episode" ? episodeLabel(item.seasonNumber, item.episodeNumber) : t(KIND_I18N[item.kind]);
  return what ? `${day} · ${what}` : day;
}

/** Une entrée par titre : trois épisodes d'une même série ne prennent qu'une place. */
function onePerTitle(items: readonly CalendarItem[]): CalendarItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.mediaType}:${item.tmdbId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Ce qu'on a envie de demander, pas ce qui passe tous les soirs : les talk-shows
 * et émissions quotidiennes (The View, Late Night…) sont parmi les plus
 * « populaires » de TMDB et remplissaient le bandeau. Ils se reconnaissent à
 * leur longévité — trentième saison, cent-douzième épisode.
 */
function worthRequesting(item: CalendarItem): boolean {
  if (item.kind !== "episode" && item.kind !== "premiere") return true;
  return (item.seasonNumber ?? 0) <= 10 && (item.episodeNumber ?? 0) <= 40;
}

export const ThisWeekStrip = memo(function ThisWeekStrip({ data }: { data: HubData }) {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const mine = useMemo(() => onePerTitle(data.weekItems), [data.weekItems]);
  const from = today();
  // Rien pour soi cette semaine : ce que tout le monde attend, les plus populaires.
  const global = useGlobalCalendar(from, addDays(from, 6), !data.weekPending && mine.length === 0);
  const popular = useMemo(() => onePerTitle(
    applyLocalDays(global.data?.items ?? [])
      .filter((i) => i.date >= from && i.posterPath && worthRequesting(i))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 40),
  ).slice(0, MAX_TILES).sort((a, b) => a.date.localeCompare(b.date)), [global.data, from]);

  const personal = mine.length > 0;
  const items = personal ? mine.slice(0, MAX_TILES) : popular;
  if (items.length === 0) return null;

  return (
    <Rail
      title={personal ? t("seer:stripWeekMine") : t("seer:stripWeekAll")}
      subtitle={personal ? t("seer:stripWeekMineHint", { count: data.weekItems.length }) : t("seer:stripWeekAllHint")}
      icon={<CalendarIcon className="h-5 w-5" />}
      action={{ label: t("seer:openCalendar"), short: t("seer:seeAll"), onClick: () => hub.setTab("calendar") }}
    >
      {items.map((item) => (
        <PosterCard key={item.id} item={calendarAsMedia(item)} onOpen={hub.openMedia} caption={ribbonOf(item, t)} status={calendarStatus(item)} />
      ))}
    </Rail>
  );
});
