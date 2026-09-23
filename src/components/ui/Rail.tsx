/* ------------------------------------------------------------------ */
/*  Vigie — Une rangée qui défile, et son titre                        */
/* ------------------------------------------------------------------ */

/*
 * Le motif des applications de films, pour une raison simple : il montre
 * BEAUCOUP en peu de hauteur, et chaque rangée annonce ce qu'elle contient
 * avant qu'on la parcoure. Au doigt, la rangée glisse et s'aimante aux cartes ;
 * à la souris, deux flèches apparaissent au survol — jamais de barre de
 * défilement horizontale au milieu de la page.
 */

import { Children, memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "./icons";

export function SectionHeader({ title, subtitle, count, action, icon }: {
  title: string;
  subtitle?: string;
  count?: number | null;
  /** « Tout voir », « Ouvrir le calendrier »… */
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-tentacle-text-primary sm:text-xl">
          {icon && <span className="text-[var(--brand-light)]">{icon}</span>}
          <span className="truncate">{title}</span>
          {count != null && count > 0 && (
            <span className="text-sm font-semibold tabular-nums text-tentacle-text-quaternary">{count}</span>
          )}
        </h2>
        {subtitle && <p className="mt-0.5 truncate text-xs text-tentacle-text-tertiary sm:text-sm">{subtitle}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--brand-light)] transition-colors hover:bg-tentacle-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.6)]"
        >
          {action.label}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface RailProps {
  title: string;
  subtitle?: string;
  count?: number | null;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
  children: ReactNode;
  /** Largeur d'une carte : affiches, vignettes 16:9, ou portraits (distribution). */
  itemWidth?: "poster" | "wide" | "person";
}

const WIDTH = {
  poster: "w-[132px] sm:w-[152px] lg:w-[168px]",
  wide: "w-[260px] sm:w-[300px]",
  person: "w-[84px] sm:w-[96px]",
} as const;

export const Rail = memo(function Rail({ title, subtitle, count, action, icon, children, itemWidth = "poster" }: RailProps) {
  const { t } = useTranslation("seer");
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [measure]);

  // Les cartes arrivent après le montage : les flèches se recalculent avec elles.
  const childCount = Children.count(children);
  useEffect(() => { measure(); }, [childCount, measure]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="group/rail">
      <SectionHeader title={title} subtitle={subtitle} count={count} action={action} icon={icon} />
      <div className="relative">
        <div
          ref={scroller}
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 md:-mx-8 md:scroll-px-8 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* `Children.map` garde les clés des cartes : une rangée qui se
              réordonne ne remonte pas ses affiches. */}
          {Children.map(children, (child) => (
            <div className={`shrink-0 snap-start ${WIDTH[itemWidth]}`}>{child}</div>
          ))}
        </div>
        {!edges.start && (
          <RailArrow dir="left" label={t("seer:railPrevious")} onClick={() => page(-1)} />
        )}
        {!edges.end && (
          <RailArrow dir="right" label={t("seer:railNext")} onClick={() => page(1)} />
        )}
      </div>
    </section>
  );
});

function RailArrow({ dir, label, onClick }: { dir: "left" | "right"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-[30%] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-tentacle-surface-modal text-tentacle-text-primary opacity-0 shadow-tentacle-elev-2 ring-1 ring-tentacle-border-subtle transition-opacity duration-200 hover:bg-tentacle-surface-3 focus-visible:opacity-100 group-hover/rail:opacity-100 [@media(hover:hover)]:flex ${
        dir === "left" ? "-left-2 md:-left-4" : "-right-2 md:-right-4"
      }`}
    >
      {dir === "left" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </button>
  );
}
