/* ------------------------------------------------------------------ */
/*  Vigie — L'état de la page d'administration                          */
/* ------------------------------------------------------------------ */

/*
 * Chaque réglage s'enregistre dès qu'on le touche (interrupteur, limite) ou
 * depuis la fenêtre qui l'édite (connexion, nom de l'onglet, profils) : plus
 * de bouton « Enregistrer » en bas de page, qu'on oubliait. `health` est le
 * dernier test de la connexion ENREGISTRÉE — l'en-tête et la carte de
 * connexion le lisent.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { backendFetch } from "../../api/seer-client";
import type { SeerProfile } from "../../api/types";
import { testConnection, type ConnectionTest } from "./connectionTest";

export interface NavLabels {
  fr: string;
  en: string;
}

export interface SeerAdminConfig {
  url: string;
  apiKey: string;
  enabled: boolean;
  autoApprove: boolean;
  /** Limite quotidienne par défaut ; 0 = aucune. */
  userLimit: number;
  navLabels: NavLabels;
  profiles: SeerProfile[];
}

function labelsOf(raw: unknown): NavLabels {
  if (typeof raw === "string") return { fr: raw, en: raw };
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    fr: typeof input.fr === "string" ? input.fr : "",
    en: typeof input.en === "string" ? input.en : "",
  };
}

function fromServer(data: Record<string, unknown>): SeerAdminConfig {
  const limit = Number(data.userLimit);
  return {
    url: typeof data.url === "string" ? data.url : "",
    apiKey: typeof data.apiKey === "string" ? data.apiKey : "",
    enabled: data.enabled === true,
    autoApprove: data.autoApprove === true,
    userLimit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0,
    navLabels: labelsOf(data.navLabels ?? data.navLabel),
    profiles: Array.isArray(data.profiles) ? (data.profiles as SeerProfile[]) : [],
  };
}

export function useSeerAdminConfig() {
  const qc = useQueryClient();
  const [config, setConfig] = useState<SeerAdminConfig | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState<{ running: boolean; result: ConnectionTest | null }>({ running: false, result: null });
  // L'enregistrement part de la DERNIÈRE configuration connue, même si deux
  // réglages changent dans la même seconde.
  const latest = useRef<SeerAdminConfig | null>(null);

  const checkHealth = useCallback(async (c: Pick<SeerAdminConfig, "url" | "apiKey">) => {
    if (!c.url || !c.apiKey) {
      setHealth({ running: false, result: null });
      return;
    }
    setHealth((h) => ({ ...h, running: true }));
    setHealth({ running: false, result: await testConnection(c.url, c.apiKey) });
  }, []);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const loaded = fromServer(await backendFetch<Record<string, unknown>>("/config"));
      latest.current = loaded;
      setConfig(loaded);
      void checkHealth(loaded);
    } catch {
      setLoadError(true);
    }
  }, [checkHealth]);

  useEffect(() => { void load(); }, [load]);

  /** Enregistre un changement ; `false` si le serveur l'a refusé (rien n'a changé). */
  const save = useCallback(async (patch: Partial<SeerAdminConfig>): Promise<boolean> => {
    const base = latest.current;
    if (!base) return false;
    const next = { ...base, ...patch };
    latest.current = next;
    setConfig(next);
    setSaving(true);
    try {
      const saved = fromServer(await backendFetch<Record<string, unknown>>("/config", {
        method: "PUT",
        body: JSON.stringify(next),
      }));
      latest.current = saved;
      setConfig(saved);
      // Le nom d'onglet et l'état « configuré » se relisent partout ; les
      // profils et les comptes dépendent de l'adresse et de la clé.
      void qc.invalidateQueries({ queryKey: ["seer-is-admin"] });
      if (patch.url !== undefined || patch.apiKey !== undefined) {
        void qc.invalidateQueries({ queryKey: ["seer-profile-options"] });
        void qc.invalidateQueries({ queryKey: ["seer-admin-users"] });
        void checkHealth(saved);
      }
      return true;
    } catch {
      latest.current = base;
      setConfig(base);
      return false;
    } finally {
      setSaving(false);
    }
  }, [qc, checkHealth]);

  return { config, loadError, reload: load, save, saving, health, recheck: () => config && checkHealth(config) };
}

export type SeerAdminState = ReturnType<typeof useSeerAdminConfig>;
