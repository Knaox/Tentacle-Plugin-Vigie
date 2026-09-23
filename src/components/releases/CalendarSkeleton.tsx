import { Shimmer } from "../SkeletonCard";
import type { ReleasesView } from "../../hooks/useReleasesRange";

/**
 * Le squelette EN FORME de calendrier.
 *
 * La grille d'affiches (SkeletonList) servait ici de silhouette : à l'arrivée
 * des données, six affiches devenaient sept colonnes de jours — un saut de
 * mise en page complet, au moment précis où l'œil cherchait ses repères. La
 * silhouette épouse désormais la vue qu'elle annonce, et n'anime que le calque
 * `transform` du miroitement, comme l'exige la règle GPU du projet.
 */
export function CalendarSkeleton({ view }: { view: ReleasesView }) {
  return view === "month" ? <MonthSkeleton /> : <WeekSkeleton />;
}

function NavBar({ titleWidth }: { titleWidth: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <Shimmer className="h-8 w-8 rounded-lg" />
      <Shimmer className={`h-4 rounded ${titleWidth}`} />
      <Shimmer className="h-8 w-8 rounded-lg" />
    </div>
  );
}

function WeekSkeleton() {
  return (
    <div className="pb-10" aria-hidden>
      <NavBar titleWidth="w-40" />
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="min-h-[64px] rounded-lg bg-tentacle-fill-faint p-2">
            <Shimmer className="h-3.5 w-12 rounded" />
            <div className="mt-2 space-y-1.5">
              <Shimmer className="h-9 w-full rounded" />
              {i % 3 !== 0 && <Shimmer className="h-9 w-full rounded" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthSkeleton() {
  return (
    <div className="pb-10" aria-hidden>
      <NavBar titleWidth="w-28" />
      <div className="grid grid-cols-7 gap-1 pb-1">
        {Array.from({ length: 7 }, (_, i) => (
          <Shimmer key={i} className="mx-auto h-3 w-6 rounded" />
        ))}
      </div>
      <div className="space-y-1">
        {Array.from({ length: 5 }, (_, w) => (
          <div key={w} className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, d) => (
              <div key={d} className="flex min-h-[76px] flex-col gap-1 rounded-lg bg-tentacle-fill-faint p-1">
                <Shimmer className="h-3 w-5 rounded" />
                {(w * 7 + d) % 4 === 1 && <Shimmer className="h-5 w-full rounded" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
