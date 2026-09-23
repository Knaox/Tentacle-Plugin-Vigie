/* ------------------------------------------------------------------ */
/*  Vigie — Parcourir par plateforme, par genre                        */
/* ------------------------------------------------------------------ */

/*
 * Deux façons de chercher sans savoir quoi : « ce qu'il y a sur Netflix »,
 * « une comédie ». Une tuile ouvre la grille du catalogue déjà filtrée — le
 * même écran que les « Tout voir », avec ses filtres pour affiner.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useCalendarProviders } from "../hooks/useReleases";
import { MOVIE_GENRES } from "../constants/genres";
import { genrePreset, providerPreset } from "../browse/presets";
import { useHub } from "../hub/HubContext";
import { SectionHeader } from "../components/ui/Rail";

const TMDB_LOGO = "https://image.tmdb.org/t/p/w154";
const PLATFORMS_SHOWN = 12;

/* Des dégradés tirés des jetons de marque — jamais une couleur en dur. */
const TONES = [
  "linear-gradient(135deg, rgba(var(--brand-rgb),0.45), rgba(var(--brand-rgb),0.12))",
  "linear-gradient(135deg, rgba(var(--brand-accent-rgb, var(--brand-rgb)),0.40), rgba(var(--brand-rgb),0.10))",
  "linear-gradient(135deg, rgba(var(--brand-rgb),0.30), rgba(var(--brand-accent-rgb, var(--brand-rgb)),0.22))",
  "linear-gradient(135deg, var(--fill-strong), var(--fill-soft))",
];

export const PlatformShortcuts = memo(function PlatformShortcuts() {
  const { t } = useTranslation("seer");
  const hub = useHub();
  const { data } = useCalendarProviders();
  const providers = (data?.results ?? []).filter((p) => p.logoPath).slice(0, PLATFORMS_SHOWN);
  if (providers.length === 0) return null;
  return (
    <section>
      <SectionHeader title={t("seer:byPlatform")} subtitle={t("seer:byPlatformHint")} />
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:-mx-8 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => hub.browse(providerPreset(p.id, p.name))}
            title={p.name}
            aria-label={t("seer:browsePlatform", { name: p.name })}
            className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none sm:w-[88px]"
          >
            <span className="block aspect-square w-full overflow-hidden rounded-2xl ring-1 ring-tentacle-border-subtle transition-transform duration-200 group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-[rgba(var(--brand-rgb),0.8)]">
              <img src={`${TMDB_LOGO}${p.logoPath}`} alt="" loading="lazy" className="h-full w-full object-cover" />
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-tentacle-text-secondary">{p.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
});

export const GenreShortcuts = memo(function GenreShortcuts() {
  const { t } = useTranslation("seer");
  const hub = useHub();
  return (
    <section>
      <SectionHeader title={t("seer:byGenre")} />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {MOVIE_GENRES.filter((g) => g.id !== 10770).map((g, i) => (
          <button
            key={g.id}
            type="button"
            onClick={() => hub.browse(genrePreset(g.id, "movie", t(`seer:${g.key}`)))}
            className="flex h-14 items-end rounded-2xl px-3 pb-2 text-left text-sm font-bold text-tentacle-text-primary ring-1 ring-tentacle-border-subtle transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.7)]"
            style={{ background: TONES[i % TONES.length] }}
          >
            {t(`seer:${g.key}`)}
          </button>
        ))}
      </div>
    </section>
  );
});
