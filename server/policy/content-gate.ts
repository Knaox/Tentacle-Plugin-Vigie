/* ------------------------------------------------------------------ */
/*  Vigie — Le contrôle parental du cœur, une seule porte               */
/* ------------------------------------------------------------------ */

/*
 * Le cœur (Tentacle ≥ 1.30.0) prête aux extensions un pont, `ctx.contentPolicy`,
 * qui dit ce qu'un compte peut voir d'un titre EXTÉRIEUR à la bibliothèque
 * (TMDB) — Jellyfin décide, le cœur traduit, Vigie applique. C'est ici, et
 * seulement ici, que Vigie l'appelle (docs/CONTROLE-PARENTAL.md) :
 *
 *   - pont absent (cœur d'avant) : rien ne change — le contrôle parental
 *     n'existait pas ;
 *   - compte non restreint : chemin court, `restrictionFor` rend `null`, la
 *     route sert sa réponse d'avant sans un appel de plus ;
 *   - pont qui lève : fermé à l'échec — liste vide, titre refusé. Jamais
 *     « libre faute de savoir ».
 *
 * L'identité est celle que le cœur pose sur la requête : un invité de la
 * Famille qui demande à son propre nom est jugé sur SA politique.
 */

export type ExternalMediaType = "movie" | "tv";

export interface ExternalTitle {
  mediaType: ExternalMediaType;
  tmdbId: number;
}

/** Le pont tel que le § 5 du contrat le décrit (champ optionnel du contexte). */
export interface ContentPolicyBridge {
  isRestricted(userId: string): Promise<boolean>;
  filterExternalTitles(userId: string, titles: ExternalTitle[]): Promise<ExternalTitle[]>;
  allowsExternalTitle(userId: string, title: ExternalTitle): Promise<boolean>;
}

/** Ce qu'une route sait d'un compte restreint : ses deux questions. */
export interface Restriction {
  /**
   * Garde, dans l'ordre, les éléments permis. `keyOf` rend le titre d'un
   * élément, ou `null` pour ce qui n'en est pas un (une personne) — gardé.
   */
  filter<T>(items: readonly T[], keyOf: (item: T) => ExternalTitle | null): Promise<T[]>;
  allows(title: ExternalTitle): Promise<boolean>;
}

let bridge: ContentPolicyBridge | null = null;

/** Branché au démarrage (index.ts) ; `null` : un cœur d'avant, sans pont. */
export function setContentPolicy(next: Partial<ContentPolicyBridge> | null | undefined): void {
  const complete = next
    && typeof next.isRestricted === "function"
    && typeof next.filterExternalTitles === "function"
    && typeof next.allowsExternalTitle === "function";
  bridge = complete ? (next as ContentPolicyBridge) : null;
}

export function titleKey(t: ExternalTitle): string {
  return `${t.mediaType}:${t.tmdbId}`;
}

/** Un titre lisible, ou rien — jamais une clé inventée. */
export function asTitle(mediaType: unknown, tmdbId: unknown): ExternalTitle | null {
  if (mediaType !== "movie" && mediaType !== "tv") return null;
  const id = Number(tmdbId);
  return Number.isSafeInteger(id) && id > 0 ? { mediaType, tmdbId: id } : null;
}

/** Le titre d'une clé « movie:603 » des réponses de Vigie. */
export function titleFromKey(key: unknown): ExternalTitle | null {
  if (typeof key !== "string") return null;
  const at = key.indexOf(":");
  return at < 0 ? null : asTitle(key.slice(0, at), key.slice(at + 1));
}

function warn(what: string, err: unknown): void {
  // Ni compte ni titre dans le journal : la raison seule.
  console.warn(`[vigie-policy] ${what} : pont en échec, refus (${err instanceof Error ? err.name : "erreur"})`);
}

function restrictionOf(b: ContentPolicyBridge, userId: string): Restriction {
  return {
    async filter<T>(items: readonly T[], keyOf: (item: T) => ExternalTitle | null): Promise<T[]> {
      const keys = items.map(keyOf);
      const unique = new Map<string, ExternalTitle>();
      for (const k of keys) if (k) unique.set(titleKey(k), k);
      if (unique.size === 0) return items.filter((_, i) => keys[i] === null);
      let allowed: Set<string>;
      try {
        const kept = await b.filterExternalTitles(userId, [...unique.values()]);
        allowed = new Set((Array.isArray(kept) ? kept : []).flatMap((t) => {
          const k = asTitle(t?.mediaType, t?.tmdbId);
          return k ? [titleKey(k)] : [];
        }));
      } catch (err) {
        warn("filterExternalTitles", err);
        allowed = new Set();
      }
      return items.filter((_, i) => {
        const k = keys[i];
        return k === null || allowed.has(titleKey(k));
      });
    },
    async allows(title: ExternalTitle): Promise<boolean> {
      try {
        return (await b.allowsExternalTitle(userId, title)) === true;
      } catch (err) {
        warn("allowsExternalTitle", err);
        return false;
      }
    },
  };
}

/** Tout refuser : un compte qu'on ne sait pas juger. */
const CLOSED: Restriction = {
  async filter<T>(items: readonly T[], keyOf: (item: T) => ExternalTitle | null) {
    return items.filter((item) => keyOf(item) === null);
  },
  async allows() {
    return false;
  },
};

/**
 * La restriction du compte, ou `null` s'il n'en a aucune (pont absent, compte
 * libre) : la route garde alors sa réponse d'avant, telle quelle.
 */
export async function restrictionFor(userId: string | null | undefined): Promise<Restriction | null> {
  const b = bridge;
  if (!b) return null;
  if (typeof userId !== "string" || userId === "") return CLOSED;
  try {
    if ((await b.isRestricted(userId)) === false) return null;
  } catch (err) {
    warn("isRestricted", err);
    return CLOSED;
  }
  return restrictionOf(b, userId);
}

/** Ce titre est-il permis au compte ? Vrai sans pont ou pour un compte libre. */
export async function allowsTitle(userId: string | null | undefined, title: ExternalTitle): Promise<boolean> {
  const r = await restrictionFor(userId);
  return r === null || r.allows(title);
}

/**
 * Même question pour un titre tel qu'un corps de requête le donne : illisible,
 * il n'est permis qu'à un compte libre (ou sans pont) — jamais deviné.
 */
export async function allowsRawTitle(
  userId: string | null | undefined,
  raw: { mediaType?: unknown; tmdbId?: unknown },
): Promise<boolean> {
  const t = asTitle(raw.mediaType, raw.tmdbId);
  return t ? allowsTitle(userId, t) : (await restrictionFor(userId)) === null;
}

/** Les éléments permis au compte ; la liste elle-même (même référence) s'il est libre. */
export async function filterTitles<T>(
  userId: string | null | undefined,
  items: T[],
  keyOf: (item: T) => ExternalTitle | null,
): Promise<T[]> {
  const r = await restrictionFor(userId);
  return r === null ? items : r.filter(items, keyOf);
}
