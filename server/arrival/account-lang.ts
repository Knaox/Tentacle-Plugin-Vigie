/* ------------------------------------------------------------------ */
/*  Vigie — La langue d'un compte, pour lui écrire                      */
/* ------------------------------------------------------------------ */

/*
 * La cloche de Tentacle affiche le corps d'un avis tel quel : il faut
 * l'écrire dans la langue du compte. Tentacle la garde côté serveur
 * (`server_config` → `user_lang_<id>`, réglée par ses clients ; son propre
 * envoi de push la lit au même endroit, `services/pushLang.ts`). Vigie la lit
 * par la base prêtée, comme il tient déjà `content_claims` du cœur. Absente
 * ou illisible : le français, comme le cœur.
 */

import type { VigieQueries } from "../storage/vigie-db";
import { noticeLang, type NoticeLang } from "./blocked-texts";

export async function accountLang(db: VigieQueries, jellyfinUserId: string): Promise<NoticeLang> {
  try {
    const rows = await db.query<{ value: string }>("SELECT value FROM server_config WHERE key = ?", `user_lang_${jellyfinUserId}`);
    return noticeLang(rows[0]?.value);
  } catch {
    return "fr";
  }
}
