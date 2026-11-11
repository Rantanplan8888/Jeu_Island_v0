# Island

Jeu de colonisation d'îles au tour par tour, multijoueur, sur téléphone.

## Architecture prévue

| Partie | Technologie | Rôle |
|---|---|---|
| `engine/` | TypeScript pur, testé avec Vitest | Moteur de règles : revenus, combats, attaques simultanées, génération du plateau |
| `app/` | React + Vite, PWA installable (≈ 56 ko compressés) | Carte des îles, saisie des ordres, rapport de tour |
| `supabase/` (à venir) | Supabase (Postgres, Auth, Edge Functions) | Comptes, parties, ordres secrets, résolution quotidienne automatique |
| Hébergement | Netlify | Sert l'application |

**Aucune connexion extérieure** : l'application ne communique qu'avec Netlify (qui la sert) et le projet Supabase.
Pas de statistiques, publicité, polices ou bibliothèques chargées depuis d'autres sites.
Une politique de sécurité du contenu (CSP) le garantira techniquement.

## Développement

```bash
npm install
npm test          # tests du moteur de règles
npm run typecheck
npm run dev       # lance l'appli sur http://localhost:5173 (et sur le réseau local pour un téléphone)
npm run build     # version de production dans app/dist
```

Pour l'instant, l'appli propose une **partie d'essai sur un seul téléphone** : chaque joueur saisit ses ordres
à son tour, puis le tour est résolu immédiatement. La partie est gardée dans le téléphone.

## Mise en ligne (Netlify)

Le fichier `netlify.toml` contient tout : commande de build, dossier publié et en-têtes de sécurité.
Sur Netlify : « Add new site » → « Import an existing project » → GitHub → ce dépôt, sans rien changer.
Sur le téléphone, ouvrir l'adresse du site puis « Ajouter à l'écran d'accueil ».

## Règles

Les règles du jeu et les choix retenus pour les points ouverts sont dans [docs/regles.md](docs/regles.md).
