# Mise en ligne d'Island

Trois services, tous gratuits pour un petit groupe :

- **GitHub** : le code, les tests, le déploiement automatique de Supabase et la résolution de minuit.
- **Supabase** (projet `zodxkoiuvewnpzcjtbiu`) : comptes, parties, ordres secrets, fonction serveur `game`.
- **Netlify** : héberge l'appli que les joueurs installent sur leur téléphone.

## 1. Secrets GitHub (une seule fois)

Dans le dépôt GitHub : *Settings → Secrets and variables → Actions → New repository secret*.

| Nom | Où le trouver |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → avatar en haut à droite → *Account preferences* → *Access Tokens* → *Generate new token* |
| `SUPABASE_DB_PASSWORD` | le mot de passe de base de données choisi à la création du projet |
| `CRON_SECRET` | une longue phrase au hasard, inventée (elle protège la résolution de minuit) |

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

Chaque tour a une échéance : **minuit, heure de Paris** (au moins une heure après le début du tour,
sinon c'est le minuit suivant). Le workflow *Résolution quotidienne* passe à 22 h 05 et 23 h 05 UTC
(soit minuit cinq à Paris, en hiver comme en été) et résout les parties dont l'échéance est passée.
GitHub peut retarder ces tâches de quelques minutes.

Chaque joueur peut aussi valider ses ordres avec « Je suis prêt ✓ » : dès que tous les joueurs encore
en jeu sont prêts, le tour est résolu tout de suite et le suivant commence, avec pour échéance le
prochain minuit. L'hôte peut enfin forcer la résolution depuis l'écran du rapport
(« Résoudre le tour maintenant »).

## Connexions

L'appli ne contacte que son propre site (Netlify) et le projet Supabase : c'est imposé par la politique de
sécurité du contenu (CSP) dans `app/index.html` et `netlify.toml`. Pas de publicité, de statistiques,
de polices ou de bibliothèques chargées depuis d'autres sites.
