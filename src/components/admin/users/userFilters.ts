/* ------------------------------------------------------------------ */
/*  Vigie — Trier les comptes : filtres, recherche, limite effective    */
/* ------------------------------------------------------------------ */

import type { AdminUserRow } from "../../../api/types";

export type UserFilter = "all" | "linked" | "unlinked" | "blocked";

export const USER_FILTERS: readonly UserFilter[] = ["all", "linked", "unlinked", "blocked"];

export function matchesFilter(user: AdminUserRow, filter: UserFilter): boolean {
  switch (filter) {
    case "linked": return user.link === "linked";
    case "unlinked": return user.link !== "linked";
    case "blocked": return user.blocked;
    default: return true;
  }
}

/** Sans accents ni casse : « éloïse » se trouve en tapant « Eloise ». */
export function foldText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function filterUsers(users: readonly AdminUserRow[], filter: UserFilter, query: string): AdminUserRow[] {
  const q = foldText(query);
  return users.filter((u) => matchesFilter(u, filter) && (q === "" || foldText(u.username).includes(q)));
}

export function filterCounts(users: readonly AdminUserRow[]): Record<UserFilter, number> {
  const counts: Record<UserFilter, number> = { all: 0, linked: 0, unlinked: 0, blocked: 0 };
  for (const u of users) for (const f of USER_FILTERS) if (matchesFilter(u, f)) counts[f]++;
  return counts;
}

/**
 * Le plafond qui s'applique à un compte : le sien, sinon celui par défaut.
 * `-1` sur le compte = illimité. `null` rendu = illimité.
 */
export function effectiveLimit(dailyLimit: number | null, defaultLimit: number | null): number | null {
  if (dailyLimit === -1) return null;
  return dailyLimit ?? defaultLimit;
}

export type LimitMode = "default" | "unlimited" | "custom";

export function limitModeOf(dailyLimit: number | null): LimitMode {
  if (dailyLimit === null) return "default";
  return dailyLimit === -1 ? "unlimited" : "custom";
}

/** La valeur à enregistrer pour un mode et une saisie. */
export function dailyLimitFor(mode: LimitMode, custom: number): number | null {
  if (mode === "default") return null;
  if (mode === "unlimited") return -1;
  return Math.max(1, Math.floor(custom) || 1);
}
