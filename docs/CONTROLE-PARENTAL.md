# Vigie et le contrôle parental — le cœur décide, Vigie applique

> Chantier « droits » (2026-10-15). Le contrat fait foi dans le dépôt Tentacle-TV :
> `docs/DROITS-UTILISATEURS.md`, § 1 (principe) et § 5 (pont des extensions). Ce carnet
> dit comment Vigie l'applique, route par route.

## Le principe

- **Jellyfin est la source des droits, le cœur les traduit.** Vigie ne lit aucune note,
  aucune étiquette, aucune politique : il pose une seule question au cœur, par le pont
  `ctx.contentPolicy` (champ OPTIONNEL du contexte des extensions, Tentacle ≥ 1.30.0).
- **Un compte restreint ne voit aucun titre au-dessus de son âge**, par aucun chemin de
  Vigie : découverte, tendances, recherche, fiche, titres semblables, saga, filmographie,
  calendrier, « Mes demandes », contrat `titles` du cœur. **Et il ne peut pas en demander
  un** : refus serveur, à chaque demande.
- **Chemin court** : `isRestricted(userId)` faux ⇒ rien ne change, aucune requête de plus
  (ni au pont, ni à TMDB). Un compte non restreint garde les réponses d'avant à l'octet près.
- **Pont absent** (cœur d'avant 1.30.0) ⇒ comportement d'avant : le contrôle parental
  n'existait pas.
- **Pont qui lève ⇒ refus** (fermé à l'échec) : liste vide, fiche « non disponible pour ce
  profil », demande refusée. Jamais « libre faute de savoir ».
- **Invité de la Famille** : il demande à SON PROPRE NOM (le cœur pose son identité sur
  `request.user`) ; c'est donc SA politique qui compte, sans rien de plus côté Vigie.

Le tout passe par UN module, `server/policy/` : rien n'appelle le pont ailleurs.

## Le refus

Une demande d'un titre interdit répond **403** avec
`{ code: "restricted_title", errorKey: "seer:errRestrictedTitle", message }` (porte unique
`request-submit.ts`). Le contrat `titles` (cartes du cœur, TV) reçoit, lui, la phrase à
afficher (`ok: false`, « Ce titre n'est pas disponible pour ce profil. »). Une fiche
interdite répond **403** `{ code: "restricted_title" }` par le proxy : l'interface dit
« Non disponible pour ce profil », jamais une erreur.

## Relevé des routes (`/api/plugins/seer/…`)

Légende — **L** : liste filtrée (`filterExternalTitles`) ; **F** : fiche gardée
(`allowsExternalTitle`, 403 sinon) ; **D** : demande gardée ; **—** : rien à filtrer (ni
titre rendu, ni demande) ; **A** : administration, non filtrée (voir plus bas).

### Proxy du catalogue (`GET /seerr/api/v1/…`, `routes-proxy.ts`)

| Chemin Jellyseerr | Rend | Règle |
|---|---|---|
| `discover/movies`, `discover/tv` (+ sous-chemins) | pages de titres | **L**, pages REMPLIES (ci-dessous) |
| `discover/trending` | page de titres (+ personnes) | **L**, pages remplies ; personnes gardées |
| `search` | page de titres (+ personnes) | **L**, pages remplies ; personnes gardées |
| `movie/:id`, `tv/:id` | la fiche | **F** |
| `movie/:id/similar`, `tv/:id/similar` | page de titres | **L**, pages remplies |
| `tv/:id/season/:n` | les épisodes d'une saison | **F** sur la série |
| `person/:id` | la biographie | — |
| `person/:id/combined_credits` | `cast[]`, `crew[]` | **L** |
| `collection/:id` | `parts[]` (la saga) | **L** |

**Pages remplies.** Une page filtrée garderait ses trous (la grille du parcours
compte vingt cases par page). Pour un compte restreint, les pages d'un parcours
(même chemin, mêmes filtres, même langue) sont tirées D'UN FLUX : les pages de
Jellyseerr sont lues dans l'ordre, filtrées, et les titres permis découpés en
pages de vingt (`server/policy/dense-pages.ts`). Le total annoncé grandit avec le
flux (ce qui est lu, plus une page d'avance tant qu'il en reste) : l'ascenseur ne
promet jamais une page qu'on ne saurait pas remplir. Lecture bornée par requête ;
flux gardés en mémoire dix minutes, par compte, en nombre limité.

### Routes de Vigie

| Route | Rend / fait | Règle |
|---|---|---|
| `GET /search` | recherche du hub (`top`, `movies`, `series`, `people[].knownFor`) | **L** |
| `GET /search/provider` | contrat `search` du cœur (barre globale) | **L** |
| `GET /search/person` | contrat `search.person` (filmographie) | **L** |
| `GET /search/collection` | contrat `search.collection` (saga) | **L** |
| `GET /titles/state` | pastille et geste par titre (cartes du cœur, TV) | **L** : un titre interdit n'a ni pastille, ni geste, ni fiche |
| `POST /titles/request` | demande (film ; saisons d'une série) | **D** |
| `GET /titles/seasons` | saisons d'une série (feuille de la TV) | **F** : aucune saison |
| `GET /titles/gaps` | saisons manquantes des séries de la bibliothèque | **L** |
| `GET /titles/access` | le compte peut-il demander | — (droit du compte, pas d'un titre) |
| `GET /titles/mine` | titres que le compte attend (« Mes demandes » de la TV) | **L** |
| `POST /requests` | demande du hub | **D** |
| `POST /requests/:id/retry`, `POST /requests/bulk-retry` | renvoi d'une demande | **D** |
| `GET /requests` | « Mes demandes » | **L** |
| `GET /requests/progress` | avancement de mes demandes | **L** |
| `GET /requests/stats`, `/requests/lookup` | comptes, saisons demandées d'un titre | — (aucun titre rendu) |
| `GET /calendar/personal` | sorties de mes demandes (ou de tout le monde) | **L** |
| `GET /calendar/global` | sorties d'une plateforme | **L** |
| `GET /calendar/airtimes`, `/episodes/states` | heures et états des épisodes d'une série | **F** : réponse vide |
| `POST /availability`, `GET /series/gaps`, `GET /marks`, `POST /check-providers` | états et marques de titres DÉJÀ affichés | — (aucun titre rendu seul) |
| `DELETE /requests/:id`, `forget`, `mark`, `bulk-delete`, `retry-delete` | gestes sur ses demandes | — (rien ne s'obtient) |
| `GET /config`, `/profiles*`, `/queue/status`, `/stats`, `/sync/state`, `/vendor/*` | réglages, compteurs | — |
| `/admin/*`, `/downloads`, `PUT /config`, `/worker/trigger` | administration | **A** |

**Administration non filtrée** : les pages d'administration (toutes les demandes,
comptes, file) servent à GÉRER les demandes de tous ; un administrateur qui se serait
posé une note maximale les garde entières. Tout le reste de Vigie, administrateur
compris, applique sa politique.

## Le hub (iframe, WebView)

- **Aucun trou** : la grille du parcours et les rangées de l'accueil reçoivent des pages
  pleines ; la grille lit le total de la page la plus récente marquée `vigieDense`
  (`src/browse/useSparseCatalog.ts`) — un compte libre garde le total de la page 1, comme avant.
- **Aucune erreur** : une fiche ou une feuille de saisons refusée montre « Non disponible pour
  ce profil » (`RestrictedNotice`), sans affiche ni résumé, et ne se redemande pas
  (`utils/restricted.ts`). Une demande refusée dit la même chose (`seer:errRestrictedTitle`).
- Hors de Vigie : les bandes-annonces de la fiche passent par le cœur (`/api/tmdb/trailers`),
  qui les garde lui-même (chantier Filtrage).

## La preuve

- Tests : `server/policy/*.test.ts` (porte, pages pleines, relais, routes, recherche) et
  `src/utils/restricted.test.ts` — `npm test`.
- Banc de bout en bout (`scripts/banc-droits/`) : le VRAI cœur Tentacle d'une branche donnée,
  un Jellyfin 10.11 JETABLE (`droits-vigie-jf`, 18141), un faux Jellyseerr déterministe (18142,
  aucune sortie vers TMDB), Vigie installée depuis `server/index.mjs`. Lancement : voir l'en-tête
  de `banc.mts` (`REPO`, `VIGIE`, `RUN`, depuis `apps/backend` du dépôt Tentacle, par `npx tsx`).
  Relevé du 2026-10-15 :

  | Cœur | Compte | Découverte p1 | Fiche | Saga | Demande hub | Demande carte |
  |---|---|---|---|---|---|---|
  | socle (pont, étape A) | adulte | 20 titres, total 100 | 200 | 2 volets | 201 | acceptée |
  | socle (pont, étape A) | enfant (note max 10) | 0 titre, total 0 | 403 `restricted_title` | 0 volet | 403 `restricted_title` | « Ce titre n'est pas disponible pour ce profil. » |
  | d'avant (sans pont) | enfant | 20 titres, total 100 | 200 | 2 volets | 201 | acceptée |

  À l'étape A, le pont du cœur ne laisse AUCUN titre extérieur à un compte restreint : les
  pages en partie permises (le flux qui remplit) ne se prouvent encore que par les tests.
