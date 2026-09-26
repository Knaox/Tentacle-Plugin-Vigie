/* ------------------------------------------------------------------ */
/*  Vigie — Le test de connexion à Jellyseerr (et Sonarr, Radarr)       */
/* ------------------------------------------------------------------ */

import { backendFetch } from "../../api/seer-client";

export type ArrProbe = "ok" | "missing" | "unreachable";

export interface ConnectionTest {
  ok: boolean;
  error: "bad-url" | "unreachable" | "invalid-key" | null;
  version: string | null;
  arr: { sonarr: ArrProbe; radarr: ArrProbe } | null;
  /** Jellyseerr sait-il lister les comptes Jellyfin (et donc les importer) ? */
  jellyfin?: "ok" | "unreachable" | null;
}

/** Éprouve l'adresse et la clé SAISIES, sans rien enregistrer (cf. routes-connection.ts). */
export async function testConnection(url: string, apiKey: string): Promise<ConnectionTest> {
  try {
    return await backendFetch<ConnectionTest>("/admin/test-connection", {
      method: "POST",
      body: JSON.stringify({ url, apiKey }),
    });
  } catch {
    return { ok: false, error: "unreachable", version: null, arr: null, jellyfin: null };
  }
}

/** Le verdict d'un test, en une clé de traduction. */
export function verdictKey(test: ConnectionTest): string {
  if (test.ok) return test.version ? "seer:admTestOk" : "seer:admTestOkNoVersion";
  if (test.error === "bad-url") return "seer:admTestBadUrl";
  if (test.error === "invalid-key") return "seer:admTestInvalidKey";
  return "seer:admTestUnreachable";
}
