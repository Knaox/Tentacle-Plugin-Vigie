/* ------------------------------------------------------------------ */
/*  Vigie — La synchro des comptes : collecte, corrections, rapport     */
/* ------------------------------------------------------------------ */

/*
 * Le plan (user-sync-plan.ts) dit quoi faire ; ici, on va chercher les trois
 * registres, on applique les corrections sûres et on garde le compte rendu de
 * la dernière passe — la page d'administration l'affiche, qu'elle ait été
 * lancée à la main ou par le passage automatique du worker.
 *
 * Une seule passe à la fois : le bouton pressé pendant la passe automatique
 * attend son résultat au lieu d'en lancer une seconde.
 */

import type { PrismaClient } from "@prisma/client";
import { fetchJellyfinAccounts, forgetJellyfinAccounts, normalizeJellyfinId, type JellyfinAccount } from "./jellyfin-users";
import { listAllJellyseerrUsers, resolveJellyseerrUserId, forgetSeerrUserChecks } from "./jellyseerr-user";
import { planUserSync, pendingFixes, type LocalUserRow, type SeerrAccount, type UserSyncPlan } from "./user-sync-plan";
import { getOrCreateUserSettings, updateUserSettings } from "./db";
import { invalidateRequestCaches } from "./cache";

type SeerCfg = { seerrUrl: string; seerrApiKey: string };

export type SyncTrigger = "auto" | "manual";

export interface UserSyncReport {
  at: string;
  trigger: SyncTrigger;
  durationMs: number;
  /** `null` : Jellyfin a répondu ; sinon la raison. Rien n'est retiré sans lui. */
  jellyfinError: string | null;
  seerrError: string | null;
  created: string[];
  renamed: Array<{ from: string; to: string }>;
  linked: string[];
  /** Repris par leur nom : l'ancien compte Jellyseerr d'un compte Jellyfin recréé. */
  adopted: string[];
  /** Liens retirés : le compte Jellyseerr n'existe plus (ou appartenait à un autre). */
  unlinked: string[];
  /** Comptes supprimés de Jellyfin, sans demande en cours : oubliés. */
  removed: string[];
  /** Comptes Jellyseerr créés à la demande de l'administrateur. */
  imported: string[];
  failures: Array<{ username: string; reason: string }>;
}

export interface UserSyncSnapshot {
  accounts: JellyfinAccount[] | null;
  seerr: SeerrAccount[] | null;
  rows: LocalUserRow[];
  activeRequests: Map<string, number>;
  plan: UserSyncPlan | null;
  jellyfinError: string | null;
  seerrError: string | null;
}

/** Une passe automatique toutes les trente minutes (cf. worker.ts). */
export const AUTO_SYNC_EVERY_MINUTES = 30;

let lastReport: UserSyncReport | null = null;
let inflight: Promise<UserSyncReport> | null = null;

export function getLastUserSync(): UserSyncReport | null {
  return lastReport;
}

export function isUserSyncRunning(): boolean {
  return inflight !== null;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function toSeerrAccount(u: {
  id: number; username?: string | null; displayName?: string | null; jellyfinUsername?: string | null;
  email?: string | null; jellyfinUserId?: string | null; requestCount?: number;
}): SeerrAccount {
  return {
    id: u.id,
    name: u.displayName || u.jellyfinUsername || u.username || u.email || `#${u.id}`,
    email: u.email ?? null,
    jellyfinUserId: u.jellyfinUserId || null,
    requestCount: typeof u.requestCount === "number" ? u.requestCount : null,
    aliases: [u.displayName, u.jellyfinUsername, u.username].filter((n): n is string => !!n),
  };
}

/** Les trois registres, et ce que la synchro en ferait — sans rien écrire. */
export async function collectUserSync(prisma: PrismaClient, cfg: SeerCfg | null): Promise<UserSyncSnapshot> {
  const [accountsResult, seerrResult, rows, activeRequests] = await Promise.all([
    fetchJellyfinAccounts(prisma).then(
      (accounts) => ({ accounts, error: null as string | null }),
      (err) => ({ accounts: null, error: errorText(err) }),
    ),
    cfg
      ? listAllJellyseerrUsers(cfg).then(
        (users) => ({ seerr: users.map(toSeerrAccount), error: null as string | null }),
        (err) => ({ seerr: null, error: errorText(err) }),
      )
      : Promise.resolve({ seerr: null, error: "Jellyseerr n'est pas configuré" }),
    loadLocalRows(prisma),
    loadActiveRequests(prisma),
  ]);
  const plan = accountsResult.accounts
    ? planUserSync({ accounts: accountsResult.accounts, seerr: seerrResult.seerr, rows, activeRequests })
    : null;
  return {
    accounts: accountsResult.accounts,
    seerr: seerrResult.seerr,
    rows,
    activeRequests,
    plan,
    jellyfinError: accountsResult.error,
    seerrError: seerrResult.error,
  };
}

async function loadLocalRows(prisma: PrismaClient): Promise<LocalUserRow[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    jellyfin_user_id: string; username: string; jellyseerr_user_id: number | bigint | null;
  }>>(`SELECT jellyfin_user_id, username, jellyseerr_user_id FROM seer_user_settings`);
  return rows.map((r) => ({
    jellyfinUserId: r.jellyfin_user_id,
    username: r.username,
    jellyseerrUserId: r.jellyseerr_user_id === null ? null : Number(r.jellyseerr_user_id),
  }));
}

/** Demandes encore attendues, par compte (identifiant normalisé). */
async function loadActiveRequests(prisma: PrismaClient): Promise<Map<string, number>> {
  const rows = await prisma.$queryRawUnsafe<Array<{ jellyfin_user_id: string; cnt: bigint | number }>>(
    `SELECT jellyfin_user_id, COUNT(*) AS cnt FROM seer_requests
     WHERE status NOT IN ('available', 'failed', 'deleted', 'deleting', 'delete_failed')
     GROUP BY jellyfin_user_id`,
  );
  const out = new Map<string, number>();
  for (const r of rows) {
    const key = normalizeJellyfinId(r.jellyfin_user_id);
    out.set(key, (out.get(key) ?? 0) + Number(r.cnt));
  }
  return out;
}

export interface RunOptions {
  trigger: SyncTrigger;
  /** Créer dans Jellyseerr les comptes qui n'y sont pas (tous, ou ceux-là). */
  importMissing?: boolean | string[];
}

export function runUserSync(prisma: PrismaClient, cfg: SeerCfg | null, opts: RunOptions): Promise<UserSyncReport> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const report = await syncOnce(prisma, cfg, opts);
      lastReport = report;
      return report;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function syncOnce(prisma: PrismaClient, cfg: SeerCfg | null, opts: RunOptions): Promise<UserSyncReport> {
  const started = Date.now();
  // À la main, on veut l'état du moment : pas celui gardé une demi-minute.
  if (opts.trigger === "manual") {
    forgetJellyfinAccounts();
    forgetSeerrUserChecks();
  }
  const snap = await collectUserSync(prisma, cfg);
  const report: UserSyncReport = {
    at: new Date().toISOString(), trigger: opts.trigger, durationMs: 0,
    jellyfinError: snap.jellyfinError, seerrError: snap.seerrError,
    created: [], renamed: [], linked: [], adopted: [], unlinked: [], removed: [], imported: [], failures: [],
  };
  if (snap.plan) await applyPlan(prisma, snap.plan, report);
  if (cfg && snap.plan && opts.importMissing) await importMissing(prisma, cfg, snap.plan, opts.importMissing, report);
  if (pendingFixes(snap.plan ?? emptyPlan()) > 0 || report.imported.length > 0) invalidateRequestCaches();
  report.durationMs = Date.now() - started;
  const touched = report.created.length + report.renamed.length + report.linked.length + report.adopted.length
    + report.unlinked.length + report.removed.length + report.imported.length;
  if (touched > 0 || report.failures.length > 0) {
    console.log(`[SeerUsers] Synchro ${opts.trigger} : ${touched} correction(s), ${report.failures.length} échec(s)`);
  }
  return report;
}

function emptyPlan(): UserSyncPlan {
  return {
    createRows: [], renames: [], clearLinks: [], setLinks: [], removeRows: [],
    gone: [], missingSeerr: [], orphanSeerr: [], disabled: [],
  };
}

async function applyPlan(prisma: PrismaClient, plan: UserSyncPlan, report: UserSyncReport): Promise<void> {
  const attempt = async (username: string, action: () => Promise<void>, onDone: () => void) => {
    try {
      await action();
      onDone();
    } catch (err) {
      report.failures.push({ username, reason: errorText(err) });
    }
  };
  for (const c of plan.createRows) {
    await attempt(c.name, () => getOrCreateUserSettings(prisma, c.id, c.name).then(() => undefined), () => report.created.push(c.name));
  }
  for (const r of plan.renames) {
    await attempt(r.to, () => updateUserSettings(prisma, r.id, { username: r.to }), () => report.renamed.push({ from: r.from, to: r.to }));
  }
  for (const l of plan.clearLinks) {
    await attempt(l.username, () => updateUserSettings(prisma, l.id, { jellyseerrUserId: null, jellyseerrLastSync: null }),
      () => report.unlinked.push(l.username));
  }
  for (const l of plan.setLinks) {
    await attempt(l.username, () => updateUserSettings(prisma, l.id, { jellyseerrUserId: l.seerrId, jellyseerrLastSync: new Date() }),
      () => (l.reason === "name" ? report.adopted : report.linked).push(l.username));
  }
  for (const r of plan.removeRows) {
    // Relu au dernier moment : une demande a pu arriver depuis la collecte.
    await attempt(r.username, async () => {
      await prisma.$executeRawUnsafe(
        `DELETE FROM seer_user_settings WHERE jellyfin_user_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM seer_requests WHERE seer_requests.jellyfin_user_id = seer_user_settings.jellyfin_user_id
               AND status NOT IN ('available', 'failed', 'deleted', 'deleting', 'delete_failed'))`,
        r.id,
      );
    }, () => report.removed.push(r.username));
  }
}

async function importMissing(
  prisma: PrismaClient, cfg: SeerCfg, plan: UserSyncPlan,
  which: true | string[], report: UserSyncReport,
): Promise<void> {
  const wanted = which === true ? null : new Set(which.map(normalizeJellyfinId));
  const targets = plan.missingSeerr.filter((m) => !wanted || wanted.has(normalizeJellyfinId(m.id)));
  for (const t of targets) {
    try {
      await resolveJellyseerrUserId(cfg, prisma, t.id, t.username);
      report.imported.push(t.username);
    } catch (err) {
      report.failures.push({ username: t.username, reason: errorText(err) });
    }
  }
}
