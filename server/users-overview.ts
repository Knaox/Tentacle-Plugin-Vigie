/* ------------------------------------------------------------------ */
/*  Vigie — Ce que la page Utilisateurs affiche, en une réponse          */
/* ------------------------------------------------------------------ */

/*
 * La page listait les lignes de Vigie, sans avatar, sans dire si le compte
 * existait encore ni si son lien Jellyseerr tenait. Elle reçoit désormais les
 * comptes Jellyfin tels qu'ils sont, avec l'état du lien, ce que la synchro
 * corrigerait et ce qui attend une décision.
 *
 * Lecture seule : ouvrir la page ne crée ni ne corrige rien — c'est le rôle
 * de la synchro (automatique ou demandée).
 */

import type { VigieDb } from "./storage/vigie-db";
import type { SeerUserSettings } from "./types";
import { rowToUserSettings } from "./db-helpers";
import { normalizeJellyfinId, type JellyfinAccount } from "./jellyfin-users";
import { collectUserSync, getLastUserSync, isUserSyncRunning, AUTO_SYNC_EVERY_MINUTES, type UserSyncReport } from "./user-sync";
import { linkStateOf, pendingFixes, PLACEHOLDER_DOMAIN, type LinkState, type SeerrAccount } from "./user-sync-plan";

type SeerCfg = { seerrUrl: string; seerrApiKey: string };

interface SeerrRef {
  id: number;
  name: string;
  requestCount: number | null;
}

export interface AdminUserDto extends SeerUserSettings {
  requestsToday: number;
  requestsTotal: number;
  activeRequests: number;
  /** `null` : Jellyfin injoignable, ou compte supprimé. */
  jellyfin: Pick<JellyfinAccount, "isAdmin" | "isDisabled" | "imageTag" | "lastActivityDate"> | null;
  link: LinkState;
  seerr: SeerrRef | null;
}

export interface UsersOverview {
  users: AdminUserDto[];
  sync: {
    last: UserSyncReport | null;
    running: boolean;
    autoEveryMinutes: number;
    /** Corrections sûres qu'une synchro appliquerait maintenant. */
    pending: number;
    jellyfinError: string | null;
    seerrError: string | null;
  };
  attention: {
    gone: Array<{ jellyfinUserId: string; username: string; activeRequests: number; seerr: SeerrRef | null }>;
    orphanSeerr: Array<SeerrRef & { email: string | null; placeholder: boolean }>;
    missingSeerr: Array<{ jellyfinUserId: string; username: string }>;
  };
  defaults: { dailyLimit: number | null };
}

async function loadSettings(db: VigieDb): Promise<Map<string, SeerUserSettings>> {
  const rows = await db.query(`SELECT * FROM seer_user_settings`);
  return new Map(rows.map((r) => {
    const s = rowToUserSettings(r);
    return [normalizeJellyfinId(s.jellyfinUserId), s] as const;
  }));
}

async function loadStats(db: VigieDb): Promise<Map<string, { today: number; total: number }>> {
  const rows = await db.query<{ jellyfin_user_id: string; today: unknown; total: unknown }>(
    `SELECT jellyfin_user_id,
       SUM(CASE WHEN created_at >= ${db.sql.startOfToday()} AND status NOT IN ('failed','deleted') THEN 1 ELSE 0 END) AS today,
       SUM(CASE WHEN status != 'deleted' THEN 1 ELSE 0 END) AS total
     FROM seer_requests GROUP BY jellyfin_user_id`,
  );
  const out = new Map<string, { today: number; total: number }>();
  for (const r of rows) {
    const key = normalizeJellyfinId(r.jellyfin_user_id);
    const prev = out.get(key) ?? { today: 0, total: 0 };
    out.set(key, { today: prev.today + Number(r.today ?? 0), total: prev.total + Number(r.total ?? 0) });
  }
  return out;
}

/** Le dernier nom connu d'un demandeur disparu sans ligne à son nom. */
async function lastKnownName(db: VigieDb, jellyfinUserId: string): Promise<string> {
  const rows = await db.query<{ username: string }>(
    `SELECT username FROM seer_requests WHERE jellyfin_user_id = ? ORDER BY created_at DESC LIMIT 1`,
    jellyfinUserId,
  ).catch(() => []);
  return rows[0]?.username || jellyfinUserId;
}

function defaultSettings(id: string, name: string): SeerUserSettings {
  const now = new Date().toISOString();
  return {
    jellyfinUserId: id, username: name, blocked: false, dailyLimit: null,
    allowMovies: true, allowTv: true, allowAnime: true,
    jellyseerrUserId: null, jellyseerrLastSync: null, createdAt: now, updatedAt: now,
  };
}

const seerrRef = (s: SeerrAccount | undefined): SeerrRef | null =>
  s ? { id: s.id, name: s.name, requestCount: s.requestCount } : null;

export async function buildUsersOverview(
  db: VigieDb, cfg: SeerCfg | null, defaults: { dailyLimit: number | null },
): Promise<UsersOverview> {
  const [snap, settings, stats] = await Promise.all([
    collectUserSync(db, cfg), loadSettings(db), loadStats(db),
  ]);
  const seerrById = new Map((snap.seerr ?? []).map((s) => [s.id, s]));

  const toDto = (s: SeerUserSettings, account: JellyfinAccount | null): AdminUserDto => {
    const key = normalizeJellyfinId(s.jellyfinUserId);
    const st = stats.get(key) ?? { today: 0, total: 0 };
    return {
      ...s,
      username: account?.name || s.username,
      requestsToday: st.today,
      requestsTotal: st.total,
      activeRequests: snap.activeRequests.get(key) ?? 0,
      jellyfin: account
        ? { isAdmin: account.isAdmin, isDisabled: account.isDisabled, imageTag: account.imageTag, lastActivityDate: account.lastActivityDate }
        : null,
      link: linkStateOf(s, snap.seerr),
      seerr: seerrRef(s.jellyseerrUserId ? seerrById.get(s.jellyseerrUserId) : undefined),
    };
  };

  // Jellyfin a répondu : ses comptes font la liste. Sinon, ce que Vigie connaît.
  const users = snap.accounts
    ? snap.accounts.map((a) => toDto(settings.get(normalizeJellyfinId(a.id)) ?? defaultSettings(a.id, a.name), a))
    : [...settings.values()].map((s) => toDto(s, null));
  users.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }));

  const plan = snap.plan;
  const gone = await Promise.all((plan?.gone ?? []).map(async (g) => ({
    jellyfinUserId: g.id,
    username: g.username === g.id ? await lastKnownName(db, g.id) : g.username,
    activeRequests: g.activeRequests,
    seerr: seerrRef(g.seerrId ? seerrById.get(g.seerrId) : undefined),
  })));

  return {
    users,
    sync: {
      last: getLastUserSync(),
      running: isUserSyncRunning(),
      autoEveryMinutes: AUTO_SYNC_EVERY_MINUTES,
      pending: plan ? pendingFixes(plan) : 0,
      jellyfinError: snap.jellyfinError,
      seerrError: snap.seerrError,
    },
    attention: {
      gone,
      orphanSeerr: (plan?.orphanSeerr ?? []).map((o) => ({
        ...seerrRef(o)!,
        email: o.email,
        placeholder: (o.email ?? "").toLowerCase().endsWith(PLACEHOLDER_DOMAIN),
      })),
      missingSeerr: (plan?.missingSeerr ?? []).map((m) => ({ jellyfinUserId: m.id, username: m.username })),
    },
    defaults,
  };
}
