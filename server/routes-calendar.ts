/* ------------------------------------------------------------------ */
/*  Seer Plugin — Routes du calendrier des sorties                     */
/* ------------------------------------------------------------------ */

/*
 * Les deux vues se servent du CALENDRIER MAÎTRE (calendar-store) : construit
 * une fois par région pour toute l'instance, tranché ici par fenêtre et par
 * utilisateur. Le global n'a plus de cache de réponse — le store EST le
 * cache, et l'ancienne clé par combinaison de filtres multipliait les entrées
 * froides pour un même contenu.
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { cached } from "./cache";
import { getUser, type WorkerCfg } from "./seerr-unified";
import { buildMergedRows, type MergedRows } from "./requests-list";
import { buildPersonalFromStore } from "./calendar-personal-store";
import { buildEveryoneRows } from "./calendar-everyone";
import { buildGlobalFromStore } from "./calendar-service";
import { initCalendarStoreMaintenance } from "./calendar-store";
import { isDayString, addDays, type CalendarResponse } from "./calendar-types";
import { todayString } from "./tmdb-fetch";
import { rowsCacheKey } from "./routes-requests-read";
import { DEFAULT_REGION } from "./tmdb-resolver";
import { sonarrSeriesAirTimes } from "./sonarr-schedule";
import { attachItemStates } from "./item-states";

/** Le personnel bouge avec les demandes ; le store maître vit sa propre vie. */
const PERSONAL_TTL_MS = 15 * 60_000;
const PERSONAL_STALE_MS = 6 * 3_600_000;
/**
 * Une réponse incomplète ne vaut pas un quart d'heure : le remplissage de fond
 * la complète en moins d'une minute. La garder aussi longtemps — puis six heures
 * de service périmé par-dessus — faisait qu'une carence passagère survivait à
 * la journée, et qu'une bascule vers « Toutes les demandes » redonnait
 * indéfiniment la première réponse tronquée.
 */
const PARTIAL_TTL_MS = 10_000;
/**
 * « Tout le monde » brasse les demandes de toute l'instance, dont beaucoup n'ont
 * jamais transité par le plugin et manquent donc en mémoire. Le budget de
 * récupération immédiate y est plus large — sans excès : chaque fiche coûte un
 * aller-retour, et le reste part de toute façon en tâche de fond.
 */
const EVERYONE_FETCH_BUDGET = 60;
/** Plafond de plateformes combinables — au-delà, le filtre ne filtre plus. */
const MAX_PROVIDERS = 8;

const DEFAULT_WINDOW_DAYS = 90;
/** Fenêtre plafonnée : sans borne, un `to=2099-01-01` déclencherait un scan inutile. */
const MAX_WINDOW_DAYS = 370;

function readWindow(q: { from?: string; to?: string }): { from: string; to: string } {
  const today = todayString();
  const from = isDayString(q.from) ? q.from : today;
  const fallback = addDays(from, DEFAULT_WINDOW_DAYS);
  const to = isDayString(q.to) ? q.to : fallback;
  const hardMax = addDays(from, MAX_WINDOW_DAYS);
  return { from, to: to > hardMax ? hardMax : to < from ? from : to };
}

function readRegion(q: { region?: string }): string {
  return typeof q.region === "string" && /^[a-z]{2}$/i.test(q.region)
    ? q.region.toUpperCase()
    : DEFAULT_REGION;
}

const EMPTY = (from: string, to: string): CalendarResponse => ({ from, to, items: [], partial: false });

export function registerCalendarRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  getWorkerConfig: () => Promise<WorkerCfg | null>,
): void {
  const warn = (err: unknown, msg: string) => app.log?.warn?.({ err }, msg);

  /* Préchauffage + entretien du calendrier maître. Branché ici plutôt que
   * dans index.ts, déjà au-delà du budget de lignes du projet. */
  const stopMaintenance = initCalendarStoreMaintenance(prisma, getWorkerConfig, warn);
  app.addHook("onClose", async () => stopMaintenance());

  /* ── Les sorties des demandes — les miennes, ou celles de tout le monde ── */
  app.get("/calendar/personal", async (request) => {
    const user = getUser(request);
    const q = request.query as {
      from?: string; to?: string; all?: string; everyone?: string; region?: string;
    };
    const { from, to } = readWindow(q);
    const includeSettled = q.all === "1";
    const everyone = q.everyone === "1";
    const region = readRegion(q);

    const config = await getWorkerConfig();
    if (!config) return EMPTY(from, to);

    /* Vue « tout le monde » : le résultat ne dépend d'aucun utilisateur, donc
     * une seule entrée de cache sert toute l'instance. La vue personnelle,
     * elle, reste préfixée par le compte. La région fait partie de la clé :
     * elle décide des plateformes affichées sur chaque entrée. */
    const key = everyone
      ? `seer:cal:everyone:${region}:${from}:${to}:${includeSettled ? "all" : "up"}`
      : `seer-cache:${user.userId}:cal:${region}:${from}:${to}:${includeSettled ? "all" : "up"}`;

    const res = await cached(
      key,
      PERSONAL_TTL_MS,
      async () => {
        // Réutilise la liste déjà chargée : arriver depuis « Mes demandes »
        // ne coûte alors aucun appel réseau.
        const rows: MergedRows = everyone
          ? await cached(
              "seer:rows:everyone",
              60_000,
              () => buildEveryoneRows(prisma, config, warn),
              { staleMs: 600_000 },
            )
          : await cached(
              rowsCacheKey(user.userId),
              60_000,
              () => buildMergedRows(prisma, config, user, warn),
              { staleMs: 600_000 },
            );
        return buildPersonalFromStore(prisma, config, rows, {
          from, to, includeSettled, region,
          maxFetch: everyone ? EVERYONE_FETCH_BUDGET : undefined,
        }, warn);
      },
      {
        staleMs: PERSONAL_STALE_MS,
        ttlFor: (value) => (value.partial ? PARTIAL_TTL_MS : PERSONAL_TTL_MS),
      },
    );
    // L'état de chaque sortie se lit à la minute, hors du cache d'un quart d'heure.
    return attachItemStates(config, res, todayString());
  });

  /* ── Tout ce qui sort — indépendant des demandes ──
   *
   * Pas de cached() ici : la tranche d'un store en mémoire coûte une boucle,
   * et la pastille « demandé » doit rester à jour à la minute. */
  app.get("/calendar/global", async (request) => {
    const q = request.query as {
      providerIds?: string; mediaType?: string;
      region?: string; from?: string; to?: string;
    };
    const { from, to } = readWindow(q);

    const config = await getWorkerConfig();
    if (!config) return EMPTY(from, to);

    /* Params encore envoyés par un bundle client antérieur — le client actuel
     * filtre tout chez lui et ne les envoie plus. */
    const providerIds = String(q.providerIds ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, MAX_PROVIDERS);
    const mediaType = q.mediaType === "movie" || q.mediaType === "tv" ? q.mediaType : "both";

    const res = await buildGlobalFromStore(prisma, config, {
      providerIds, mediaType, region: readRegion(q), from, to,
    }, warn);
    return attachItemStates(config, res, todayString());
  });

  /* ── Heures de diffusion d'une série, pour la fiche détaillée ──
   *
   * TMDB ne donne que la date. Sonarr connaît l'instant, mais uniquement pour
   * les séries qu'il suit : une réponse vide signifie « on ne sait pas », et la
   * fiche affiche alors la date seule plutôt qu'une heure inventée. */
  app.get("/calendar/airtimes", async (request) => {
    const q = request.query as { tmdbId?: string };
    const tmdbId = Number(q.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) return { times: {} };

    const config = await getWorkerConfig();
    if (!config) return { times: {} };

    try {
      const times = await sonarrSeriesAirTimes(config, tmdbId);
      return { times: Object.fromEntries(times) };
    } catch {
      // Sonarr muet : réponse vide NON cachée — la fiche affiche la date
      // seule, et le prochain passage retentera au lieu de resservir le vide.
      return { times: {} };
    }
  });

  /* ── Catalogue des plateformes de la région ──
   *
   * Les deux catalogues (films et séries) sont FUSIONNÉS : ils ne se recouvrent
   * pas entièrement, et un film peut être proposé par une plateforme absente de
   * la liste séries. Sans la fusion, son logo manquerait sans raison visible.
   * Le sélecteur de plateforme comme les vignettes lisent la même table. */
  app.get("/calendar/providers", async (request) => {
    const q = request.query as { region?: string };
    const config = await getWorkerConfig();
    if (!config) return { results: [] };

    const region = readRegion(q);

    try {
      return await cached(`seer:providers:all:${region}`, 24 * 3_600_000, async () => {
        const merged = new Map<number, { id: number; name: string; logoPath: string | null }>();
        let pannes = 0;

        for (const path of ["tv", "movies"] as const) {
          try {
            const res = await fetch(
              `${config.seerrUrl}/api/v1/watchproviders/${path}?watchRegion=${region}`,
              { headers: { "X-Api-Key": config.seerrApiKey }, signal: AbortSignal.timeout(10_000) },
            );
            if (!res.ok) throw new Error(`watchproviders/${path} → ${res.status}`);
            const data = (await res.json()) as Array<{ id?: number; name?: string; logoPath?: string }>;
            for (const p of Array.isArray(data) ? data : []) {
              if (typeof p.id !== "number" || !p.name || merged.has(p.id)) continue;
              merged.set(p.id, { id: p.id, name: p.name, logoPath: p.logoPath ?? null });
            }
          } catch { pannes++; /* un catalogue indisponible ne doit pas vider l'autre */ }
        }
        // Les DEUX catalogues muets = panne : lever, ne pas graver un sélecteur
        // de plateformes vide pour vingt-quatre heures.
        if (pannes === 2) throw new Error("watchproviders : aucun catalogue ne répond");

        return { results: Array.from(merged.values()) };
      });
    } catch {
      // Réponse vide NON cachée : le prochain ouvrage du filtre retentera.
      return { results: [] };
    }
  });
}
