# Island

Jeu de colonisation d'îles au tour par tour, multijoueur, sur téléphone.

## Architecture prévue

| Partie | Technologie | Rôle |
|---|---|---|
| `engine/` | TypeScript pur, testé avec Vitest | Moteur de règles : revenus, combats, attaques simultanées, génération du plateau |
| `app/` (à venir) | React + Vite, PWA installable | Carte des îles, saisie des ordres, rapport de tour |
| `supabase/` (à venir) | Supabase (Postgres, Auth, Edge Functions) | Comptes, parties, ordres secrets, résolution quotidienne automatique |
| Hébergement | Netlify | Sert l'application |

**Aucune connexion extérieure** : l'application ne communique qu'avec Netlify (qui la sert) et le projet Supabase.
Pas de statistiques, publicité, polices ou bibliothèques chargées depuis d'autres sites.
Une politique de sécurité du contenu (CSP) le garantira techniquement.

## Développement

```bash
npm install
npm test        # tests du moteur de règles
npm run typecheck
```

## Règles

Les règles du jeu et les choix retenus pour les points ouverts sont dans [docs/regles.md](docs/regles.md).
