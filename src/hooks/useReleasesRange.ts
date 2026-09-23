import { useCallback, useEffect, useState } from "react";
import {
  today, addDays, startOfWeek, startOfMonth, endOfMonth, monthGridBounds,
} from "../utils/calendar-groups";

/*
 * La navigation de l'agenda appartient à la PAGE, plus aux vues.
 *
 * Quand chaque vue gardait son propre curseur, tout élargissement de fenêtre
 * changeait la clé de requête, le squelette remplaçait la vue, et son état
 * partait avec elle : « semaine précédente » revenait à la semaine courante.
 * Remonté ici, le curseur survit à n'importe quel rechargement.
 *
 * Et la plage AFFICHÉE est couverte au montage comme à chaque navigation —
 * les vues ne la signalaient qu'au clic, si bien que la fenêtre initiale
 * démarrait à aujourd'hui : un samedi, le lundi au vendredi de la semaine en
 * cours n'avaient jamais été demandés au serveur.
 */

/** La semaine ou le mois : les deux vues qui ont un curseur. */
export type ReleasesView = "week" | "month";

export interface MonthCursor {
  year: number;
  month: number;
}

/** Fenêtre future initiale — élargie ensuite au fil de la navigation. */
const INITIAL_FUTURE_DAYS = 90;

function currentMonthCursor(): MonthCursor {
  const ref = today();
  return { year: Number(ref.slice(0, 4)), month: Number(ref.slice(5, 7)) - 1 };
}

export function useReleasesRange(view: ReleasesView) {
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(today()));
  /* Toujours le mois COURANT — la vue mois sautait au mois du premier item,
   * pendant que la semaine restait sur la semaine courante : deux vues
   * ouvertes sur deux périodes différentes, sans que rien ne l'explique. */
  const [monthCursor, setMonthCursor] = useState<MonthCursor>(currentMonthCursor);

  /* Fenêtre de données : arrondie à des bornes de mois pour que sept clics de
   * semaine ne fabriquent pas sept clés de requête, élargie seulement — jamais
   * rétrécie, ce qui garde les allers-retours en cache. */
  const [range, setRange] = useState(() => ({
    from: startOfMonth(addDays(startOfMonth(today()), -1)),
    to: endOfMonth(addDays(today(), INITIAL_FUTURE_DAYS)),
  }));

  const coverRange = useCallback((wantFrom: string, wantTo: string) => {
    const from = startOfMonth(wantFrom);
    const to = endOfMonth(wantTo);
    setRange((cur) => {
      const f = from < cur.from ? from : cur.from;
      const t = to > cur.to ? to : cur.to;
      return f === cur.from && t === cur.to ? cur : { from: f, to: t };
    });
  }, []);

  useEffect(() => {
    if (view === "week") {
      coverRange(weekAnchor, addDays(weekAnchor, 6));
    } else {
      const bounds = monthGridBounds(monthCursor.year, monthCursor.month);
      coverRange(bounds.from, bounds.to);
    }
  }, [view, weekAnchor, monthCursor, coverRange]);

  return {
    range,
    weekAnchor,
    monthCursor,
    goWeek: useCallback((delta: number) => {
      setWeekAnchor((a) => addDays(a, delta * 7));
    }, []),
    goThisWeek: useCallback(() => setWeekAnchor(startOfWeek(today())), []),
    goMonth: useCallback((delta: number) => {
      setMonthCursor((c) => {
        const d = new Date(c.year, c.month + delta, 1);
        return { year: d.getFullYear(), month: d.getMonth() };
      });
    }, []),
    goThisMonth: useCallback(() => setMonthCursor(currentMonthCursor()), []),
  };
}
