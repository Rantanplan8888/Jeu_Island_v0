# Island

Jeu de colonisation d'îles au tour par tour, multijoueur, sur téléphone.

## Architecture prévue

| Partie | Technologie | Rôle |
|---|---|---|
| `engine/` | TypeScript pur, testé avec Vitest | Moteur de règles : revenus, combats, attaques simultanées, génération du plateau |
| `app/` | React + Vite, PWA installable (≈ 56 ko compressés) | Carte des îles, saisie des ordres, rapport de tour |
| `supabase/` | Supabase (Postgres + RLS, Auth, Edge Function `game`) | Comptes, parties, ordres secrets, lancement et résolution des tours |
| `.github/workflows/` | GitHub Actions | Tests, déploiement Supabase, résolution chaque matin |
| Hébergement | Netlify | Sert l'application |

**Aucune connexion extérieure** : l'application ne communique qu'avec Netlify (qui la sert) et le projet Supabase.
Pas de statistiques, publicité, polices ou bibliothèques chargées depuis d'autres sites.
Une politique de sécurité du contenu (CSP) le garantit techniquement.

## Développement

```bash
npm install
npm test          # tests du moteur de règles
npm run typecheck
npm run dev       # lance l'appli sur http://localhost:5173 (et sur le réseau local pour un téléphone)
npm run build     # version de production dans app/dist
```

L'appli propose deux modes :

- **en ligne** : chacun joue sur son téléphone avec son compte ; on rejoint une partie avec un code ;
  les ordres restent secrets jusqu'à la résolution du matin ;
- **partie d'essai** sur un seul téléphone, en se le passant, pour découvrir les règles.

## Mise en ligne

Voir [docs/mise-en-ligne.md](docs/mise-en-ligne.md) : secrets GitHub, réglages Supabase et Netlify.

## Règles

Les règles du jeu et les choix retenus pour les points ouverts sont dans [docs/regles.md](docs/regles.md).
