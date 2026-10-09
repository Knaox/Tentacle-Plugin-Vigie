/* ------------------------------------------------------------------ */
/*  Vigie — Lire la liste des items de Jellyfin que tient le serveur    */
/* ------------------------------------------------------------------ */

/*
 * La table `library_known_id` du serveur Tentacle (≥ 1.19.1), lue dans SA
 * base par `ctx.storage` — en lecture seule, jamais écrite. Deux questions :
 *
 *   - l'empreinte (combien de lignes, combien de départs, le dernier) : trois
 *     agrégats sur une table de quelques dizaines de milliers de lignes,
 *     posés à chaque passe — rien ne bouge, rien d'autre n'est lu ;
 *   - le contenu, regroupé PAR FILM ET PAR SAISON par la base elle-même (une
 *     saison est là tant qu'un de ses épisodes l'est) : quelques milliers de
 *     lignes au lieu d'une par épisode, relues seulement quand l'empreinte a
 *     bougé.
 *
 * Une table absente ou illisible (serveur trop ancien) rend `null` : Vigie
 * ne corrige alors rien, comme avant.
 */

import type { VigieDb } from "../storage/vigie-db";
import { readStoredDate } from "../db-helpers";
import type { KeyRow } from "./library-keys";

export interface LibrarySignature {
  total: number;
  departed: number;
  last: number | null;
}

export interface LibraryStore {
  signature(): Promise<LibrarySignature | null>;
  rows(): Promise<KeyRow[] | null>;
}

export function sameLibrarySignature(a: LibrarySignature | null, b: LibrarySignature | null): boolean {
  return !!a && !!b && a.total === b.total && a.departed === b.departed && a.last === b.last;
}

function ms(v: unknown): number | null {
  return readStoredDate(v)?.getTime() ?? null;
}

/* SQLite : `rtrim` retire le numéro d'épisode (« e:t:1399:2:7 » → « e:t:1399:2: »). */
const ROWS_SQL = `
  SELECT CASE WHEN contentKey LIKE 'e:t:%' THEN rtrim(contentKey, '0123456789') ELSE contentKey END AS k,
         MAX(CASE WHEN removedAt IS NULL THEN 1 ELSE 0 END) AS present,
         MAX(removedAt) AS departedAt
  FROM library_known_id
  WHERE contentKey LIKE 'm:t:%' OR contentKey LIKE 'e:t:%'
  GROUP BY k`;

export function coreLibraryStore(db: VigieDb): LibraryStore {
  let warned = false;
  const unusable = (err: unknown) => {
    if (!warned) {
      warned = true;
      console.warn(
        "[VigieLive] Liste des items de Jellyfin du serveur illisible — les suppressions ne seront vues "
        + `que par Jellyseerr : ${err instanceof Error ? err.message : err}`,
      );
    }
    return null;
  };
  return {
    async signature() {
      try {
        const [row] = await db.query<{ total: unknown; departed: unknown; last: unknown }>(
          "SELECT COUNT(*) AS total, COUNT(removedAt) AS departed, MAX(removedAt) AS last FROM library_known_id",
        );
        warned = false;
        return { total: Number(row?.total ?? 0), departed: Number(row?.departed ?? 0), last: ms(row?.last) };
      } catch (err) {
        return unusable(err);
      }
    },
    async rows() {
      try {
        const rows = await db.query<{ k: unknown; present: unknown; departedAt: unknown }>(ROWS_SQL);
        return rows
          .filter((r) => typeof r.k === "string")
          .map((r) => ({ key: r.k as string, present: Number(r.present) === 1, departedAt: ms(r.departedAt) }));
      } catch (err) {
        return unusable(err);
      }
    },
  };
}
