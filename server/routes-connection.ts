/* ------------------------------------------------------------------ */
/*  Vigie — Tester la connexion avant de l'enregistrer                  */
/* ------------------------------------------------------------------ */

/*
 * Le bouton « Tester » passait par le relais du plugin, qui n'accepte que
 * l'adresse DÉJÀ enregistrée : à la première configuration, le test échouait
 * toujours, et une clé fausse passait pour bonne (`/status` ne la lit pas).
 *
 * On teste ici l'adresse et la clé saisies, sans rien enregistrer : la
 * version de Jellyseerr, la validité de la clé, puis Sonarr et Radarr — ce
 * sont eux qui annoncent désormais les arrivées (arr-advance.ts). La réponse
 * ne rend que des verdicts, jamais le contenu des pages interrogées.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { buildArrUrl, type ArrServerConfig } from "./arr-service";

type ArrProbe = "ok" | "missing" | "unreachable";

export interface ConnectionTest {
  ok: boolean;
  /** `bad-url` · `unreachable` · `invalid-key` */
  error: string | null;
  version: string | null;
  arr: { sonarr: ArrProbe; radarr: ArrProbe } | null;
  /**
   * Jellyseerr sait-il lister les comptes Jellyfin ? Sans cela, aucun compte
   * ne s'importe (constaté le 26 sept. 2026 : erreur 500 au message vide).
   */
  jellyfin: "ok" | "unreachable" | null;
}

const TIMEOUT_MS = 8_000;

function cleanUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function probeArr(seerrUrl: string, apiKey: string, type: "sonarr" | "radarr"): Promise<ArrProbe> {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/settings/${type}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return "unreachable";
    const servers = (await res.json()) as Array<Record<string, unknown>>;
    const main = servers.find((s) => s.isDefault) ?? servers[0];
    if (!main) return "missing";
    const server: ArrServerConfig = {
      hostname: String(main.hostname ?? ""),
      port: Number(main.port),
      apiKey: String(main.apiKey ?? ""),
      useSsl: !!main.useSsl,
      baseUrl: String(main.baseUrl ?? ""),
    };
    const ping = await fetch(`${buildArrUrl(server)}/api/v3/system/status`, {
      headers: { "X-Api-Key": server.apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return ping.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

async function probeJellyfin(seerrUrl: string, apiKey: string): Promise<"ok" | "unreachable"> {
  try {
    const res = await fetch(`${seerrUrl}/api/v1/settings/jellyfin/users`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function testSeerrConnection(rawUrl: unknown, rawKey: unknown): Promise<ConnectionTest> {
  const url = cleanUrl(rawUrl);
  const apiKey = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!url) return { ok: false, error: "bad-url", version: null, arr: null, jellyfin: null };

  let version: string | null = null;
  try {
    const res = await fetch(`${url}/api/v1/status`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { ok: false, error: "unreachable", version: null, arr: null, jellyfin: null };
    version = ((await res.json()) as { version?: string }).version ?? null;
  } catch {
    return { ok: false, error: "unreachable", version: null, arr: null, jellyfin: null };
  }

  // `/status` répond sans clé : c'est une page réservée qui dit si elle est bonne.
  try {
    const res = await fetch(`${url}/api/v1/settings/main`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "invalid-key", version, arr: null, jellyfin: null };
    if (!res.ok) return { ok: false, error: "unreachable", version, arr: null, jellyfin: null };
  } catch {
    return { ok: false, error: "unreachable", version, arr: null, jellyfin: null };
  }

  const [sonarr, radarr, jellyfin] = await Promise.all([
    probeArr(url, apiKey, "sonarr"), probeArr(url, apiKey, "radarr"), probeJellyfin(url, apiKey),
  ]);
  return { ok: true, error: null, version, arr: { sonarr, radarr }, jellyfin };
}

export function registerConnectionRoutes(
  app: FastifyInstance,
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {
  app.post("/admin/test-connection", { preHandler: requireAdmin }, async (request) => {
    const body = (request.body ?? {}) as { url?: unknown; apiKey?: unknown };
    return testSeerrConnection(body.url, body.apiKey);
  });
}
