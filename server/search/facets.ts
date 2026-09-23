/* ------------------------------------------------------------------ */
/*  Vigie — Chercher un genre, une plateforme                          */
/* ------------------------------------------------------------------ */

/*
 * « comédie », « horreur », « netflix », « disney » ne sont pas des titres.
 * Ce sont des façons de PARCOURIR : la recherche les propose en pastilles, qui
 * ouvrent le catalogue déjà filtré. Tout se décide en mémoire — la liste des
 * genres est fixe, celle des plateformes se relit une fois par jour.
 */

import { cached, peek } from "../cache";
import type { WorkerCfg } from "../seerr-unified";
import { foldText } from "./fold";

export type Facet =
  | { kind: "genre"; id: number; mediaType: "movie" | "tv"; label: string }
  | { kind: "provider"; id: number; label: string; logoPath: string | null };

interface GenreDef { id: number; movie: boolean; tv: boolean; fr: string; en: string; also?: string[] }

/* Les genres TMDB, avec leurs noms dans les deux langues de l'interface et
 * quelques synonymes que l'on tape vraiment (« sf », « dessin animé »). */
const GENRES: GenreDef[] = [
  { id: 28, movie: true, tv: false, fr: "Action", en: "Action" },
  { id: 12, movie: true, tv: false, fr: "Aventure", en: "Adventure" },
  { id: 10759, movie: false, tv: true, fr: "Action & Aventure", en: "Action & Adventure" },
  { id: 16, movie: true, tv: true, fr: "Animation", en: "Animation", also: ["dessin anime", "dessins animes", "cartoon"] },
  { id: 35, movie: true, tv: true, fr: "Comédie", en: "Comedy", also: ["humour"] },
  { id: 80, movie: true, tv: true, fr: "Crime", en: "Crime", also: ["policier", "polar"] },
  { id: 99, movie: true, tv: true, fr: "Documentaire", en: "Documentary", also: ["docu"] },
  { id: 18, movie: true, tv: true, fr: "Drame", en: "Drama" },
  { id: 10751, movie: true, tv: true, fr: "Familial", en: "Family", also: ["famille"] },
  { id: 14, movie: true, tv: false, fr: "Fantastique", en: "Fantasy", also: ["fantasy"] },
  { id: 36, movie: true, tv: false, fr: "Histoire", en: "History", also: ["historique"] },
  { id: 27, movie: true, tv: false, fr: "Horreur", en: "Horror", also: ["epouvante"] },
  { id: 10762, movie: false, tv: true, fr: "Enfants", en: "Kids", also: ["jeunesse"] },
  { id: 10402, movie: true, tv: false, fr: "Musique", en: "Music", also: ["musical"] },
  { id: 9648, movie: true, tv: true, fr: "Mystère", en: "Mystery", also: ["enquete"] },
  { id: 10749, movie: true, tv: false, fr: "Romance", en: "Romance", also: ["romantique"] },
  { id: 878, movie: true, tv: false, fr: "Science-Fiction", en: "Science Fiction", also: ["sf", "scifi", "sci fi"] },
  { id: 10765, movie: false, tv: true, fr: "Science-Fiction & Fantastique", en: "Sci-Fi & Fantasy" },
  { id: 53, movie: true, tv: false, fr: "Thriller", en: "Thriller", also: ["suspense"] },
  { id: 10752, movie: true, tv: false, fr: "Guerre", en: "War" },
  { id: 10768, movie: false, tv: true, fr: "Guerre & Politique", en: "War & Politics" },
  { id: 37, movie: true, tv: true, fr: "Western", en: "Western" },
  { id: 10764, movie: false, tv: true, fr: "Téléréalité", en: "Reality", also: ["tele realite", "realite"] },
  { id: 10767, movie: false, tv: true, fr: "Talk-show", en: "Talk" },
];

const MIN_PREFIX = 3;
const MAX_FACETS = 6;

/** Le texte plié commence-t-il par la requête — ou la requête par un mot du nom ? */
function matches(name: string, query: string): boolean {
  const folded = foldText(name);
  return folded === query || (query.length >= MIN_PREFIX && folded.startsWith(query));
}

export function genreFacets(query: string, lang: string): Facet[] {
  const q = foldText(query);
  if (q.length < 2) return [];
  const out: Facet[] = [];
  for (const g of GENRES) {
    const names = [g.fr, g.en, ...(g.also ?? [])];
    if (!names.some((n) => matches(n, q))) continue;
    const label = lang === "fr" ? g.fr : g.en;
    if (g.movie) out.push({ kind: "genre", id: g.id, mediaType: "movie", label });
    if (g.tv) out.push({ kind: "genre", id: g.id, mediaType: "tv", label });
  }
  return out.slice(0, MAX_FACETS);
}

interface ProviderRow { id?: number; name?: string; logoPath?: string; displayPriority?: number }

/** Région des plateformes selon la langue — la même table que le catalogue. */
export function regionOf(lang: string): string {
  const map: Record<string, string> = { fr: "FR", en: "US", de: "DE", es: "ES", it: "IT", pt: "BR", ja: "JP" };
  return map[lang] ?? "US";
}

const providersKey = (region: string) => `vigie:providers:${region}`;

async function providerList(cfg: WorkerCfg, region: string): Promise<ProviderRow[]> {
  return cached(providersKey(region), 86_400_000, async () => {
    const all = new Map<number, ProviderRow>();
    for (const kind of ["movies", "tv"]) {
      const res = await fetch(`${cfg.seerrUrl}/api/v1/watchproviders/${kind}?watchRegion=${region}`, {
        headers: { "X-Api-Key": cfg.seerrApiKey },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      for (const p of (await res.json()) as ProviderRow[]) {
        if (typeof p.id === "number" && p.name && !all.has(p.id)) all.set(p.id, p);
      }
    }
    return [...all.values()].sort((a, b) => (a.displayPriority ?? 999) - (b.displayPriority ?? 999));
  }, { staleMs: 7 * 86_400_000 });
}

/**
 * Les plateformes dont le nom commence par la requête. `wait` à faux (réponse
 * instantanée) : une liste pas encore lue ne se fait pas attendre, elle se lit
 * en arrière-plan pour la frappe suivante.
 */
export async function providerFacets(cfg: WorkerCfg, query: string, lang: string, wait: boolean): Promise<Facet[]> {
  const q = foldText(query);
  if (q.length < MIN_PREFIX) return [];
  try {
    const region = regionOf(lang);
    let list = peek<ProviderRow[]>(providersKey(region), true);
    if (list === undefined) {
      const loading = providerList(cfg, region);
      if (!wait) { void loading.catch(() => undefined); return []; }
      list = await loading;
    }
    return list
      .filter((p) => matches(p.name ?? "", q) || foldText(p.name ?? "").split(" ").some((w) => w.length >= 3 && w === q))
      .slice(0, 3)
      .map((p) => ({ kind: "provider" as const, id: p.id as number, label: p.name as string, logoPath: p.logoPath ?? null }));
  } catch {
    return [];
  }
}
