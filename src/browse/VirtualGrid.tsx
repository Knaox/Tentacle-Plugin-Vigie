/* ------------------------------------------------------------------ */
/*  Vigie — La grille virtualisée                                      */
/* ------------------------------------------------------------------ */

/*
 * Seules les rangées à l'écran (et trois de part et d'autre) existent dans la
 * page ; les autres ne sont qu'une hauteur réservée. Dix mille titres
 * défilent donc aussi vite que vingt : aucune affiche hors écran n'est ni
 * décodée ni gardée en mémoire, et l'ascenseur a sa vraie taille dès le
 * premier chargement.
 *
 * Toutes les rangées ont la MÊME hauteur, calculée depuis la largeur : rien
 * à mesurer, rien qui saute. La grille suit le défilement de la fenêtre (celui
 * de la page du plugin), lu au plus une fois par image.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const GAP_X = 12;
const GAP_Y = 20;
/* Titre + ligne du canal sous l'affiche, jusqu'à deux lignes (cf. PosterCard). */
const CAPTION = 64;
const OVERSCAN_ROWS = 3;

export function columnsFor(width: number): number {
  if (width < 640) return 3;
  if (width < 768) return 4;
  if (width < 1024) return 5;
  if (width < 1280) return 6;
  if (width < 1600) return 7;
  return 8;
}

interface VirtualGridProps {
  count: number;
  renderItem: (index: number) => ReactNode;
  /** Les cases à charger : visibles, plus la marge. */
  onRange: (from: number, to: number) => void;
  /** Faux quand la vue est cachée : on ne suit plus le défilement. */
  active: boolean;
}

export const VirtualGrid = memo(function VirtualGrid({ count, renderItem, onRange, active }: VirtualGridProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [rows, setRows] = useState({ first: 0, last: 8 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columns = columnsFor(width || window.innerWidth);
  const cardWidth = width > 0 ? (width - GAP_X * (columns - 1)) / columns : 150;
  const rowHeight = Math.round(cardWidth * 1.5 + CAPTION + GAP_Y);
  const rowCount = Math.ceil(count / columns);

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const first = Math.max(0, Math.floor(-top / rowHeight) - OVERSCAN_ROWS);
    const last = Math.min(rowCount - 1, Math.floor((window.innerHeight - top) / rowHeight) + OVERSCAN_ROWS);
    setRows((cur) => (cur.first === first && cur.last === last ? cur : { first, last }));
  }, [rowHeight, rowCount]);

  useEffect(() => {
    if (!active) return;
    measure();
    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [active, measure]);

  useEffect(() => {
    if (active) onRange(rows.first * columns, (rows.last + 1) * columns - 1);
  }, [active, rows, columns, onRange]);

  const visible: number[] = [];
  for (let r = rows.first; r <= Math.min(rows.last, rowCount - 1); r++) visible.push(r);

  return (
    <div ref={box} className="relative w-full" style={{ height: rowCount * rowHeight }}>
      {visible.map((row) => (
        <div
          key={row}
          className="absolute inset-x-0 top-0 grid"
          style={{
            transform: `translateY(${row * rowHeight}px)`,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            columnGap: GAP_X,
            height: rowHeight - GAP_Y,
          }}
        >
          {Array.from({ length: columns }, (_, col) => {
            const index = row * columns + col;
            return index < count ? <div key={index} className="min-w-0">{renderItem(index)}</div> : null;
          })}
        </div>
      ))}
    </div>
  );
});
