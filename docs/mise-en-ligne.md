# Mise en ligne d'Island

Trois services, tous gratuits pour un petit groupe :

- **GitHub** : le code, les tests, le déploiement automatique de Supabase et la résolution du matin.
- **Supabase** (projet `zodxkoiuvewnpzcjtbiu`) : comptes, parties, ordres secrets, fonction serveur `game`.
- **Netlify** : héberge l'appli que les joueurs installent sur leur téléphone.

## 1. Secrets GitHub (une seule fois)

Dans le dépôt GitHub : *Settings → Secrets and variables → Actions → New repository secret*.

| Nom | Où le trouver |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → avatar en haut à droite → *Account preferences* → *Access Tokens* → *Generate new token* |
| `SUPABASE_DB_PASSWORD` | le mot de passe de base de données choisi à la création du projet |
| `CRON_SECRET` | une longue phrase au hasard, inventée (elle protège la résolution du matin) |

Ensuite, onglet *Actions* → *Déployer Supabase* → *Run workflow*. Le déploiement se relance tout seul
à chaque modification de `supabase/` ou du moteur de règles.

Si Supabase a désactivé les anciennes clés (« legacy API keys ») sur le projet, ajouter aussi dans
Supabase → *Edge Functions → Secrets* un secret `SERVICE_KEY` contenant une clé secrète `sb_secret_…`.

## 2. Réglages Supabase

- *Authentication → Sign In / Providers → Email* : pour une partie entre amis, on peut décocher
  « Confirm email » (sinon chaque joueur doit cliquer le lien reçu par e-mail ; l'envoi d'e-mails
  intégré de Supabase est limité à quelques messages par heure).
- *Authentication → URL Configuration* : mettre l'adresse Netlify du site dans « Site URL ».

## 3. Netlify

*Add new site → Import an existing project → GitHub →* ce dépôt. Rien à régler : `netlify.toml` contient tout.
Sur le téléphone : ouvrir l'adresse du site, puis « Ajouter à l'écran d'accueil ».

## Résolution des tours

Le workflow *Résolution quotidienne* s'exécute chaque jour à 5 h UTC (6 h à Paris en hiver, 7 h en été)
et résout toutes les parties en cours. L'hôte d'une partie peut aussi forcer la résolution depuis l'écran
du rapport (« Résoudre le tour maintenant »), pratique pour tester.

## Connexions

L'appli ne contacte que son propre site (Netlify) et le projet Supabase : c'est imposé par la politique de
sécurité du contenu (CSP) dans `app/index.html` et `netlify.toml`. Pas de publicité, de statistiques,
de polices ou de bibliothèques chargées depuis d'autres sites.
