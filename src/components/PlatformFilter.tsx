import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { pill } from "../styles/pills";
import { PLATFORMS } from "../utils/platforms";
import { useCalendarProviders } from "../hooks/useReleases";
import { providerInitials, providerLogoUrl } from "../hooks/useProviderCatalog";

interface PlatformFilterProps {
  selected: number[];
  onToggle: (id: number) => void;
}

/** Repli tant que le catalogue n'est pas chargé, et sur instance non configurée. */
const FALLBACK = PLATFORMS.map((p) => ({ id: p.id, name: p.name, logoPath: null }));

/** Plateformes montrées d'emblée ; le reste est accessible par la recherche. */
const VISIBLE = 14;

/**
 * Les plateformes de streaming, en sélection multiple.
 *
 * La liste était figée à onze entrées écrites en dur, alors que le catalogue
 * de la région en compte quatre-vingts : impossible de filtrer sur ADN, Arte,
 * Molotov ou Shadowz. On lit désormais le catalogue réel, les plus courantes
 * en tête, le reste par la recherche — sans allonger le panneau, puisqu'on
 * n'affiche qu'une poignée d'entrées tant qu'on ne cherche pas.
 *
 * La sélection multiple fonctionne comme un OU : cocher Netflix et Disney+
 * montre ce qui est sur l'une OU l'autre.
 */
export function PlatformFilter({ selected, onToggle }: PlatformFilterProps) {
  const { t } = useTranslation("seer");
  const { data } = useCalendarProviders();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const catalog = data?.results?.length ? data.results : FALLBACK;

  /* Les plus courantes d'abord, puis l'ordre alphabétique. Les plateformes
   * déjà cochées remontent : une sélection ne doit jamais se retrouver
   * cachée derrière « Afficher tout ». */
  const ordered = useMemo(() => {
    const popular = new Set(PLATFORMS.map((p) => p.id));
    const chosen = new Set(selected);
    const rank = (id: number) => (chosen.has(id) ? 0 : popular.has(id) ? 1 : 2);
    return [...catalog].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  }, [catalog, selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? ordered.filter((p) => p.name.toLowerCase().includes(q)) : ordered;
  }, [ordered, search]);

  const shown = search || showAll ? filtered : filtered.slice(0, VISIBLE);
  const hidden = filtered.length - shown.length;

  return (
    <div>
      {catalog.length > VISIBLE && (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("seer:filterPlatformSearch")}
          aria-label={t("seer:filterPlatformSearch")}
          className="mb-3 h-10 w-full rounded-full bg-tentacle-fill-subtle px-4 text-sm text-tentacle-text-primary outline-none ring-1 ring-tentacle-border-subtle transition-shadow placeholder:text-tentacle-text-quaternary focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.6)]"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {shown.map((p) => {
          const active = selected.includes(p.id);
          const logo = providerLogoUrl(p.logoPath);
          return (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              aria-pressed={active}
              className={`${pill(active)} inline-flex items-center gap-1.5`}
            >
              {/* Le logo se reconnaît avant que le nom ne se lise ; les
                  initiales évitent le trou quand TMDB n'en fournit pas. */}
              {logo ? (
                <img
                  src={logo} alt="" aria-hidden loading="lazy"
                  className="h-5 w-5 shrink-0 rounded-md object-cover ring-1 ring-tentacle-border-subtle"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-tentacle-fill-medium text-[8px] font-bold text-tentacle-text-secondary ring-1 ring-tentacle-border-subtle"
                >
                  {providerInitials(p.name)}
                </span>
              )}
              {p.name}
            </button>
          );
        })}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="min-h-[36px] rounded-full px-3.5 text-[13px] font-semibold text-[var(--brand-light)] transition-colors hover:bg-tentacle-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
          >
            {t("seer:filterPlatformMore", { count: hidden })}
          </button>
        )}
      </div>
    </div>
  );
}
