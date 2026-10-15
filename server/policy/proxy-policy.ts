/* ------------------------------------------------------------------ */
/*  Vigie — Le relais du catalogue pour un profil restreint             */
/* ------------------------------------------------------------------ */

/*
 * Ce que le relais (routes-proxy.ts) sert à un compte que le contrôle
 * parental du cœur restreint (docs/CONTROLE-PARENTAL.md) :
 *
 *   - une fiche (`movie/:id`, `tv/:id`) ou les épisodes d'une saison d'une
 *     série interdite : 403 `restricted_title` — le hub dit « Non disponible
 *     pour ce profil » ;
 *   - une liste paginée (découverte, tendances, recherche, titres
 *     semblables) : des pages PLEINES de titres permis (dense-pages.ts) ;
 *   - une saga (`parts`), une filmographie (`cast`, `crew`) : filtrées.
 *
 * Ce qui ne porte aucun titre (la biographie d'une personne) passe : rien
 * n'est servi ici, le relais d'avant s'en charge. Une personne dans une liste
 * reste ; un élément dont on ne lit pas le titre part (fermé à l'échec).
 */

import type { FastifyReply } from "fastify";
import { correctCatalog } from "../live/catalog-correct";
import { readCatalogJson, type Json, type Query } from "../proxy-upstream";
import { asTitle, type ExternalTitle, type Restriction } from "./content-gate";
import { densePage } from "./dense-pages";
import { RESTRICTED_REFUSAL } from "./refusal";

const DETAIL = /^api\/v1\/(movie|tv)\/(\d+)$/;
const SEASON = /^api\/v1\/tv\/(\d+)\/season\/\d+$/;
const DISCOVER = /^api\/v1\/discover\/(movies|tv)(\/|$)/;
const SIMILAR = /^api\/v1\/(movie|tv)\/\d+\/similar$/;
const SEARCH_LIKE = /^api\/v1\/(discover\/trending|search)$/;
const COLLECTION = /^api\/v1\/collection\/\d+$/;
const CREDITS = /^api\/v1\/person\/\d+\/combined_credits$/;

export interface ProxyTarget {
  seerrUrl: string;
  apiKey: string;
  wildcard: string;
  query: Query;
}

type Item = { id?: unknown; mediaType?: unknown };
const PERSON = Symbol("person");

/** Le titre d'un élément de liste ; une personne n'en a pas, l'illisible non plus. */
function itemTitle(item: unknown, fallback?: ExternalTitle["mediaType"]): ExternalTitle | typeof PERSON | null {
  if (!item || typeof item !== "object") return null;
  const { id, mediaType } = item as Item;
  if (mediaType === "person") return PERSON;
  return asTitle(mediaType ?? fallback, id);
}

/** Ce qu'un profil garde d'une liste : ses titres permis et les personnes, dans l'ordre. */
async function keepList(r: Restriction, list: unknown[], fallback?: ExternalTitle["mediaType"]): Promise<unknown[]> {
  const readable = list.filter((i) => itemTitle(i, fallback) !== null);
  return r.filter(readable, (i) => {
    const t = itemTitle(i, fallback);
    return t === PERSON ? null : t;
  });
}

/** Le type des éléments d'une liste qui ne le disent pas (découverte, titres semblables). */
function fallbackOf(wildcard: string): ExternalTitle["mediaType"] | undefined {
  const d = DISCOVER.exec(wildcard);
  if (d) return d[1] === "movies" ? "movie" : "tv";
  const s = SIMILAR.exec(wildcard);
  return s ? (s[1] as ExternalTitle["mediaType"]) : undefined;
}

function sendJson(reply: FastifyReply, status: number, wildcard: string, data: Record<string, unknown>): void {
  reply.status(status);
  reply.header("content-type", "application/json");
  reply.send(correctCatalog(wildcard, data));
}

function failure(reply: FastifyReply, err: unknown): void {
  if (err instanceof DOMException && err.name === "TimeoutError") reply.status(504).send({ message: "Seerr timeout" });
  else reply.status(502).send({ message: "Proxy failed" });
}

/** Une page d'une liste paginée, tirée du flux du compte. */
async function servePaged(reply: FastifyReply, r: Restriction, userId: string, t: ProxyTarget): Promise<void> {
  const page = Math.min(Math.max(1, Number(t.query.page) || 1), 500);
  const { page: _page, ...rest } = t.query;
  const parcours = Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
  const fallback = fallbackOf(t.wildcard);
  let upstreamStatus = 502;
  const outcome = await densePage(
    `${userId}|${t.wildcard}|${parcours}`,
    page,
    async (n) => {
      const res = await readCatalogJson(t.seerrUrl, t.apiKey, t.wildcard, { ...rest, page: String(n) });
      upstreamStatus = res.status;
      return res.data;
    },
    (results) => keepList(r, results, fallback),
  );
  if (!outcome.ok) {
    reply.status(upstreamStatus >= 400 ? upstreamStatus : 502).send({ message: "Seerr page unavailable" });
    return;
  }
  sendJson(reply, 200, t.wildcard, outcome.data);
}

/**
 * Sert la lecture d'un profil restreint ; faux si elle ne porte aucun titre
 * (ou un titre permis, en flux) — le relais d'avant la sert alors.
 */
export async function servePolicied(
  reply: FastifyReply,
  r: Restriction,
  userId: string,
  t: ProxyTarget,
): Promise<boolean> {
  const detail = DETAIL.exec(t.wildcard);
  const season = SEASON.exec(t.wildcard);
  if (detail || season) {
    const title: ExternalTitle = detail
      ? { mediaType: detail[1] as ExternalTitle["mediaType"], tmdbId: Number(detail[2]) }
      : { mediaType: "tv", tmdbId: Number(season![1]) };
    if (await r.allows(title)) return false;
    reply.status(403).send(RESTRICTED_REFUSAL);
    return true;
  }
  try {
    if (DISCOVER.test(t.wildcard) || SIMILAR.test(t.wildcard) || SEARCH_LIKE.test(t.wildcard)) {
      await servePaged(reply, r, userId, t);
      return true;
    }
    const fields = COLLECTION.test(t.wildcard) ? ["parts"] : CREDITS.test(t.wildcard) ? ["cast", "crew"] : null;
    if (!fields) return false;
    const { status, data } = await readCatalogJson(t.seerrUrl, t.apiKey, t.wildcard, t.query);
    if (!data) {
      reply.status(status >= 400 ? status : 502).send({ message: "Seerr page unavailable" });
      return true;
    }
    const out: Json = { ...data };
    for (const field of fields) {
      const list = data[field];
      if (Array.isArray(list)) out[field] = await keepList(r, list, field === "parts" ? "movie" : undefined);
    }
    sendJson(reply, status, t.wildcard, out);
    return true;
  } catch (err) {
    failure(reply, err);
    return true;
  }
}
