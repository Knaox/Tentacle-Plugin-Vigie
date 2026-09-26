/* ------------------------------------------------------------------ */
/*  Vigie — Ce que la synchro des comptes doit faire (calcul pur)       */
/* ------------------------------------------------------------------ */

/*
 * Trois registres à tenir d'accord : les comptes Jellyfin (la vérité — qui
 * existe, sous quel nom, activé ou non), les comptes Jellyseerr (au nom de
 * qui partent les demandes), et la table de Vigie qui relie les deux et porte
 * les permissions.
 *
 * L'ancienne synchro ne savait qu'AJOUTER. Un compte supprimé dans Jellyseerr
 * restait « Lié #12 » jusqu'à ce qu'une demande échoue ; un compte supprimé
 * dans Jellyfin restait dans la liste ; un renommage n'apparaissait jamais.
 *
 * Ce module ne touche à rien : il compare et rend un plan. Les corrections
 * sûres (créer une ligne, suivre un renommage, retirer un lien mort, relier un
 * compte trouvé) s'appliquent seules ; ce qui détruit quelque chose (supprimer
 * un compte Jellyseerr, oublier un compte qui a encore des demandes) reste une
 * décision de l'administrateur, et le plan le lui présente.
 */

import { normalizeJellyfinId, type JellyfinAccount } from "./jellyfin-users";

export interface SeerrAccount {
  id: number;
  /** Nom affiché par Jellyseerr (nom d'affichage, puis nom Jellyfin, puis courriel). */
  name: string;
  email: string | null;
  jellyfinUserId: string | null;
  requestCount: number | null;
  /** Tous les noms qu'il porte (Jellyfin, Jellyseerr, affichage) : la reprise par nom les compare. */
  aliases?: string[];
}

export interface LocalUserRow {
  jellyfinUserId: string;
  username: string;
  jellyseerrUserId: number | null;
}

export type LinkState = "linked" | "unlinked" | "stale";

export interface UserRef {
  id: string;
  username: string;
}

export interface UserSyncPlan {
  /** Comptes Jellyfin encore inconnus de Vigie. */
  createRows: Array<{ id: string; name: string }>;
  /** Comptes renommés dans Jellyfin. */
  renames: Array<{ id: string; from: string; to: string }>;
  /** Liens vers un compte Jellyseerr qui n'existe plus. */
  clearLinks: Array<UserRef & { seerrId: number }>;
  /**
   * Comptes Jellyseerr à relier : retrouvés par leur identifiant Jellyfin
   * (`id`), ou repris par leur nom (`name`) — celui d'un compte Jellyfin
   * supprimé puis recréé sous le même nom.
   */
  setLinks: Array<UserRef & { seerrId: number; previous: number | null; reason: "id" | "name" }>;
  /** Comptes supprimés de Jellyfin sans demande en cours : Vigie les oublie. */
  removeRows: UserRef[];
  /** Comptes supprimés de Jellyfin qui ont encore des demandes en cours. */
  gone: Array<UserRef & { activeRequests: number; seerrId: number | null }>;
  /** Comptes Jellyfin actifs sans compte Jellyseerr (créé à la première demande, ou à la main). */
  missingSeerr: UserRef[];
  /** Comptes Jellyseerr dont le compte Jellyfin a disparu, et fantômes créés par Vigie. */
  orphanSeerr: SeerrAccount[];
  /** Comptes désactivés dans Jellyfin. */
  disabled: UserRef[];
}

export interface PlanInput {
  accounts: readonly JellyfinAccount[];
  /** `null` : Jellyseerr injoignable — aucune décision sur les liens. */
  seerr: readonly SeerrAccount[] | null;
  rows: readonly LocalUserRow[];
  /** Identifiant Jellyfin normalisé → nombre de demandes encore en cours. */
  activeRequests: ReadonlyMap<string, number>;
}

/** Les fantômes que Vigie crée pour garder l'historique d'un compte supprimé. */
export const PLACEHOLDER_DOMAIN = "@tentacle.local";

/** Le compte n°1 de Jellyseerr est son propriétaire : jamais proposé à la suppression. */
const SEERR_OWNER_ID = 1;

/** Nombre de corrections qu'une synchro appliquerait sans rien demander. */
export function pendingFixes(plan: UserSyncPlan): number {
  return plan.createRows.length + plan.renames.length + plan.clearLinks.length
    + plan.setLinks.length + plan.removeRows.length;
}

/** L'état du lien d'une ligne, tel qu'il est AUJOURD'HUI (avant correction). */
export function linkStateOf(row: LocalUserRow | undefined, seerr: readonly SeerrAccount[] | null): LinkState {
  if (!row?.jellyseerrUserId) return "unlinked";
  if (!seerr) return "linked";
  return seerr.some((s) => s.id === row.jellyseerrUserId) ? "linked" : "stale";
}

/** Un nom, comparé sans casse ni accents. */
export function nameKey(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function namesOf(s: SeerrAccount): Set<string> {
  const local = (s.email ?? "").split("@")[0];
  return new Set([s.name, local, ...(s.aliases ?? [])].map(nameKey).filter(Boolean));
}

interface Needing { ref: UserRef; account: JellyfinAccount; previous: number | null }

export function planUserSync(input: PlanInput): UserSyncPlan {
  const plan: UserSyncPlan = {
    createRows: [], renames: [], clearLinks: [], setLinks: [], removeRows: [],
    gone: [], missingSeerr: [], orphanSeerr: [], disabled: [],
  };

  const accounts = new Map(input.accounts.map((a) => [normalizeJellyfinId(a.id), a]));
  const rows = new Map(input.rows.map((r) => [normalizeJellyfinId(r.jellyfinUserId), r]));
  const seerrById = new Map((input.seerr ?? []).map((s) => [s.id, s]));
  // Deux comptes Jellyseerr pour un même compte Jellyfin : le plus ancien gagne.
  const seerrByJellyfin = new Map<string, SeerrAccount>();
  for (const s of [...(input.seerr ?? [])].sort((a, b) => a.id - b.id)) {
    const key = normalizeJellyfinId(s.jellyfinUserId);
    if (key && !seerrByJellyfin.has(key)) seerrByJellyfin.set(key, s);
  }

  const needing: Needing[] = [];
  for (const [key, account] of accounts) {
    const row = rows.get(key);
    const ref: UserRef = { id: row?.jellyfinUserId ?? account.id, username: account.name };
    if (!row) plan.createRows.push({ id: account.id, name: account.name });
    else if (account.name && row.username !== account.name) {
      plan.renames.push({ id: row.jellyfinUserId, from: row.username, to: account.name });
    }
    if (account.isDisabled) plan.disabled.push(ref);
    if (!input.seerr) continue;

    const outcome = linkOutcome(row, account, seerrById.get(row?.jellyseerrUserId ?? -1), seerrByJellyfin.get(key), accounts);
    const previous = row?.jellyseerrUserId ?? null;
    if (outcome.clear !== undefined) plan.clearLinks.push({ ...ref, seerrId: outcome.clear });
    if (outcome.set) plan.setLinks.push({ ...ref, seerrId: outcome.set.id, previous, reason: "id" });
    else if (outcome.need) needing.push({ ref, account, previous });
  }

  const adopted = input.seerr ? adoptByName(plan, needing, input.seerr, accounts, rows) : new Set<number>();
  // Sans aucun compte Jellyfin, on ne conclut rien : mieux vaut ne rien
  // retirer que tout retirer sur la foi d'une réponse vide.
  if (accounts.size > 0) planDepartures(plan, input, accounts, rows);
  if (input.seerr) plan.orphanSeerr = orphansOf(input.seerr, accounts, rows, plan, adopted);
  return plan;
}

/**
 * Le lien d'un compte vivant : à garder, à retirer (`clear`), à poser
 * (`set`, retrouvé par son identifiant), ou à trouver (`need`).
 */
function linkOutcome(
  row: LocalUserRow | undefined, account: JellyfinAccount,
  linked: SeerrAccount | undefined, match: SeerrAccount | undefined,
  accounts: ReadonlyMap<string, JellyfinAccount>,
): { clear?: number; set?: SeerrAccount; need: boolean } {
  const linkedId = row?.jellyseerrUserId ?? null;
  let clear: number | undefined;
  if (linkedId !== null && !linked) {
    // Le compte Jellyseerr a été supprimé : le lien est mort.
    clear = linkedId;
  } else if (linked) {
    const owner = normalizeJellyfinId(linked.jellyfinUserId);
    // Sans maître (un fantôme rattaché par son nom), ou maître disparu (le
    // compte Jellyfin a été supprimé puis recréé) : c'est bien le sien.
    if (!owner || owner === normalizeJellyfinId(account.id) || !accounts.has(owner)) return { need: false };
    // Il appartient à un AUTRE compte vivant : les demandes partiraient sous son nom.
    clear = linked.id;
  }
  if (match) return { clear, set: match, need: false };
  return { clear, need: !account.isDisabled };
}

/**
 * Un compte Jellyseerr sans maître vivant, au nom d'un compte Jellyfin qui
 * n'en a pas : c'est le même, supprimé puis recréé dans Jellyfin. On le
 * reprend — avec son historique — au lieu d'en créer un autre et de proposer
 * l'ancien à la suppression. Seulement quand le nom ne désigne qu'un compte
 * de chaque côté : un doute, et rien n'est relié.
 */
function adoptByName(
  plan: UserSyncPlan, needing: readonly Needing[], seerr: readonly SeerrAccount[],
  accounts: ReadonlyMap<string, JellyfinAccount>, rows: ReadonlyMap<string, LocalUserRow>,
): Set<number> {
  const taken = new Set(plan.setLinks.map((l) => l.seerrId));
  for (const [key, row] of rows) if (row.jellyseerrUserId && accounts.has(key)) taken.add(row.jellyseerrUserId);
  const free = seerr.filter((s) => {
    if (s.id === SEERR_OWNER_ID || taken.has(s.id)) return false;
    const owner = normalizeJellyfinId(s.jellyfinUserId);
    return !owner || !accounts.has(owner);
  });
  const byName = new Map<string, SeerrAccount[]>();
  for (const s of free) for (const n of namesOf(s)) byName.set(n, [...(byName.get(n) ?? []), s]);
  const wanted = new Map<string, number>();
  for (const n of needing) wanted.set(nameKey(n.account.name), (wanted.get(nameKey(n.account.name)) ?? 0) + 1);

  const adopted = new Set<number>();
  for (const n of needing) {
    const key = nameKey(n.account.name);
    const candidates = (byName.get(key) ?? []).filter((s) => !adopted.has(s.id));
    if (key && candidates.length === 1 && wanted.get(key) === 1) {
      adopted.add(candidates[0].id);
      plan.setLinks.push({ ...n.ref, seerrId: candidates[0].id, previous: n.previous, reason: "name" });
    } else {
      plan.missingSeerr.push(n.ref);
    }
  }
  return adopted;
}

function planDepartures(
  plan: UserSyncPlan, input: PlanInput,
  accounts: ReadonlyMap<string, JellyfinAccount>, rows: ReadonlyMap<string, LocalUserRow>,
): void {
  const seen = new Set<string>();
  for (const [key, row] of rows) {
    seen.add(key);
    if (accounts.has(key)) continue;
    const active = input.activeRequests.get(key) ?? 0;
    const ref = { id: row.jellyfinUserId, username: row.username };
    if (active === 0) plan.removeRows.push(ref);
    else plan.gone.push({ ...ref, activeRequests: active, seerrId: row.jellyseerrUserId });
  }
  // Un demandeur disparu qui n'a jamais eu de ligne : ses demandes le trahissent.
  for (const [key, active] of input.activeRequests) {
    if (seen.has(key) || accounts.has(key) || active === 0) continue;
    plan.gone.push({ id: key, username: key, activeRequests: active, seerrId: null });
  }
}

function orphansOf(
  seerr: readonly SeerrAccount[], accounts: ReadonlyMap<string, JellyfinAccount>,
  rows: ReadonlyMap<string, LocalUserRow>, plan: UserSyncPlan, adopted: ReadonlySet<number>,
): SeerrAccount[] {
  // Déjà présentés avec leur compte disparu : ne pas les montrer deux fois.
  const shown = new Set(plan.gone.map((g) => g.seerrId).filter((id): id is number => id !== null));
  // Relié à un compte Jellyfin bien vivant (un fantôme rattaché par son nom) : en service.
  const inUse = new Set<number>(adopted);
  for (const [key, row] of rows) if (row.jellyseerrUserId && accounts.has(key)) inUse.add(row.jellyseerrUserId);
  return seerr.filter((s) => {
    if (s.id === SEERR_OWNER_ID || shown.has(s.id) || inUse.has(s.id)) return false;
    const owner = normalizeJellyfinId(s.jellyfinUserId);
    if (owner) return !accounts.has(owner);
    return (s.email ?? "").toLowerCase().endsWith(PLACEHOLDER_DOMAIN);
  });
}
