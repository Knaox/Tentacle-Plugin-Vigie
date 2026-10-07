# Vigie

Demandez films et séries, suivez leur arrivée, et voyez ce qui sort — un plugin pour
[Tentacle TV](https://github.com/Knaox/Tentacle-TV).

> [!IMPORTANT]
> **Vigie n'est affilié ni au projet Jellyseerr, ni au projet Overseerr, et n'est
> approuvé par aucun des deux.** C'est un plugin indépendant qui se connecte à *votre*
> instance Jellyseerr ou Overseerr, que vous hébergez vous-même.
> Projet officiel Jellyseerr : <https://github.com/fallenbagel/jellyseerr> — projet
> officiel Overseerr : <https://overseerr.dev>.
>
> **Vigie is affiliated with neither the Jellyseerr nor the Overseerr project, and is
> endorsed by neither.** It is an independent plugin that connects to *your own*
> self-hosted Jellyseerr or Overseerr instance.

*(Vigie was previously named « Seer ». Only the display name changed — the plugin
identifier stays `seer`, so existing installations keep working and upgrade in place.)*

## Les trois pages

| Page | À quoi elle sert |
|------|------------------|
| **Catalogue** | Trouver un film ou une série qui n'est *pas* dans la bibliothèque, et le demander |
| **Mes demandes** | Suivre ce qui a été demandé : en attente, en téléchargement (avec l'avancement réel), disponible |
| **Sorties** | Les prochaines dates — celles de vos demandes, ou celles d'une plateforme entière |

## Ce que Vigie apporte

- **Savoir si c'est vraiment sorti.** Un film annoncé « 2026 » peut être au cinéma sans
  exister nulle part ailleurs. Vigie lit les dates de sortie typées de TMDB et signale
  ce qui *empêche* de récupérer un titre : « Au cinéma », « En ligne le 3 sept. »,
  « Sortie le 16 déc. ». Un titre récupérable n'affiche rien de particulier.
- **Un avancement réel.** « En téléchargement » affiche le pourcentage, la taille et le
  temps restant remontés par Sonarr / Radarr via Jellyseerr — sans requête supplémentaire,
  et sans rien interroger quand aucun téléchargement n'est en cours.
- **Un calendrier des sorties.** Vos demandes en attente, ou toutes les sorties d'une
  plateforme (Crunchyroll, Netflix, Disney+, ADN, Canal+… 80 disponibles en France).
- **Une liste de demandes rapide.** Les fiches (titres, affiches, dates) sont mémorisées
  durablement : le chargement ne dépend plus du nombre de demandes.
- **Français et anglais**, thème clair et thème sombre.

## Prérequis

- Tentacle TV ≥ 0.9.0
- Une instance Jellyseerr ou Overseerr en fonctionnement

## Installation

### Depuis la marketplace (recommandé)

1. Ouvrir Tentacle TV en tant qu'administrateur
2. **Admin → Marketplace**
3. Chercher **Vigie**, puis **Installer**
4. **Admin → Vigie** pour renseigner l'adresse et la clé d'API de votre Jellyseerr

### Installation manuelle

1. Télécharger la dernière archive depuis les [releases](https://github.com/Knaox/Tentacle-Plugin-Vigie/releases)
2. L'extraire dans `data/plugins/seer/` sur votre serveur Tentacle
3. Redémarrer le backend

## Développement

```bash
npm install
npm run build      # bundle client + module serveur
npm run typecheck
```

Le build produit `dist/plugin-seer.iife.js` et `server/index.mjs`.

> Le nom du fichier bundle est **imposé par Tentacle TV** : la route qui le sert
> construit le chemin `plugin-<id>.iife.js` à partir de l'identifiant du plugin et
> ignore le champ `entry` du manifeste. Le renommer casserait toutes les installations
> existantes — d'où l'identifiant `seer` conservé.

### Déploiement en développement

Copier `plugin.json`, `dist/plugin-seer.iife.js` et `server/index.mjs` dans
`Tentacle-TV/apps/backend/data/plugins/seer/`, puis redémarrer le backend — le module
serveur est chargé au démarrage.

## Architecture

Bundle **IIFE** unique. Les dépendances partagées sont fournies par l'application hôte
via `window.TentacleShared` et ne sont pas embarquées :

| Externe | Fourni par |
|---------|-----------|
| `react`, `react/jsx-runtime` | `TentacleShared.React`, `TentacleShared.ReactJSXRuntime` |
| `react-i18next` | `TentacleShared.ReactI18next` |
| `@tanstack/react-query` | `TentacleShared.TanStackQuery` |
| `@tentacle-tv/plugins-api` | `TentacleShared.PluginsAPI` |

Le plugin s'enregistre de lui-même au chargement via `window.__tentacle.registerPlugin()`.

Côté serveur, un module Fastify est monté sous `/api/plugins/seer` : il parle à
Jellyseerr avec la clé d'API, qui **ne quitte jamais le serveur**.

## Licence

**GNU AGPL v3.0 ou ultérieure** (`LICENSE`), avec les permissions additionnelles de
`LICENSE-EXCEPTIONS` (boutiques d'applications, bibliothèques de plateforme, marque) —
les mêmes que Tentacle TV, dont Vigie est une extension chargée dans le serveur.
Les versions publiées avant le 7 octobre 2026 (jusqu'à la v1.24.0) restent sous
licence MIT. Le nom et le logo de Tentacle TV relèvent de sa politique de marque
(`TRADEMARK.md` du dépôt Tentacle-TV).
