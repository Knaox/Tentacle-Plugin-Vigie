/* ------------------------------------------------------------------ */
/*  Vigie — Les icônes de l'interface                                  */
/* ------------------------------------------------------------------ */

/*
 * Un seul jeu, un seul trait (1,8), un seul endroit : les pages refaites
 * dessinaient chacune leurs flèches et leurs croix, à des épaisseurs
 * différentes. Toutes décoratives — le libellé est porté par le bouton.
 */

interface IconProps {
  className?: string;
}

function Svg({ className = "h-4 w-4", children, fill = false }: IconProps & { children: React.ReactNode; fill?: boolean }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Svg>;
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const ChevronLeft = (p: IconProps) => <Svg {...p}><path d="M15 18l-6-6 6-6" /></Svg>;
export const ChevronRight = (p: IconProps) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>;
export const ChevronDown = (p: IconProps) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const PlusIcon = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const DotsIcon = (p: IconProps) => (
  <Svg {...p} fill><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></Svg>
);
export const PlayIcon = (p: IconProps) => <Svg {...p} fill><path d="M8 5.5v13l10.5-6.5z" /></Svg>;
export const StarIcon = (p: IconProps) => (
  <Svg {...p} fill><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></Svg>
);
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></Svg>
);
export const CompassIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></Svg>
);
export const ListIcon = (p: IconProps) => <Svg {...p}><path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" /></Svg>;
export const FilterIcon = (p: IconProps) => <Svg {...p}><path d="M4 6.5h16M7 12h10M10 17.5h4" /></Svg>;
export const ClockIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const AlertIcon = (p: IconProps) => <Svg {...p}><path d="M12 8.5v4.5M12 16.5h.01" /><path d="M10.3 4.3L2.9 17.2A2 2 0 004.6 20h14.8a2 2 0 001.7-2.8L13.7 4.3a2 2 0 00-3.4 0z" /></Svg>;
export const SparkIcon = (p: IconProps) => <Svg {...p}><path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" /></Svg>;
export const FilmIcon = (p: IconProps) => <Svg {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9.5h4M16.5 9.5h4M3.5 14.5h4M16.5 14.5h4" /></Svg>;
export const TvIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="5.5" width="18" height="12" rx="2.5" /><path d="M8.5 21h7M12 17.5V21" /></Svg>;
export const UserIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.3-3.6 4.2-5.5 7.5-5.5s6.2 1.9 7.5 5.5" /></Svg>;
export const RetryIcon = (p: IconProps) => <Svg {...p}><path d="M4.5 12a7.5 7.5 0 0113.1-5M19.5 12a7.5 7.5 0 01-13.1 5" /><path d="M17.8 3.5v3.8H14M6.2 20.5v-3.8H10" /></Svg>;
export const TrashIcon = (p: IconProps) => <Svg {...p}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" /></Svg>;
export const EyeIcon = (p: IconProps) => <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></Svg>;
export const EyeOffIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 3.5l17 17M10.2 5.7A9.6 9.6 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-2.6 3.4M6.6 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 004.4-1.1M9.9 10a2.8 2.8 0 004 4" /></Svg>;
export const InboxIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 13.5l2.8-8h11.4l2.8 8v5a1.5 1.5 0 01-1.5 1.5h-14a1.5 1.5 0 01-1.5-1.5z" /><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5" /></Svg>;
/* États et canaux de sortie : une forme par sens, la couleur ne dit que l'état. */
export const ArrowDownIcon = (p: IconProps) => <Svg {...p}><path d="M12 4.5v12M6.5 11.5l5.5 5.5 5.5-5.5M5 20h14" /></Svg>;
export const HalfCircleIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 010 16z" fill="currentColor" stroke="none" /></Svg>
);
export const TicketIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 7.5A1.5 1.5 0 015.5 6h13A1.5 1.5 0 0120 7.5v2a2.5 2.5 0 000 5v2a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5v-2a2.5 2.5 0 000-5z" /><path d="M14 6v12" strokeDasharray="1.5 2" /></Svg>
);
export const PlayCircleIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M10.2 8.8v6.4l5-3.2z" fill="currentColor" /></Svg>;
export const DiscIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.2" /></Svg>;
export const DashedCircleIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8" strokeDasharray="3 2.6" /><path d="M12 9v3.5l2 1.5" /></Svg>;
export const LayersIcon = (p: IconProps) => <Svg {...p}><path d="M12 4l8.5 4.5L12 13 3.5 8.5z" /><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5" /></Svg>;
export const SortIcon = (p: IconProps) => <Svg {...p}><path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3" /></Svg>;
