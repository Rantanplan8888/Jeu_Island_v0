# Équilibrage d'Island par simulations

Premiers résultats des parties simulées entre bots, à 4 joueurs, avec le vrai moteur.
Rien ici ne change les règles du jeu en ligne : les variantes sont des options du moteur
(`makeRules({...})`) que seules les simulations utilisent.

## Lancer les simulations

```sh
npm run sim -- 600              # tournoi mixte avec les règles actuelles
npm run sim:variantes -- 600    # toutes les variantes de sim/sweep.ts, en parallèle
npm run sim:partie -- 3 colon pillard tortue sprint   # une partie tour par tour
```

## Les bots

Tous les bots partagent la même mécanique (estimer la menace adverse, garder une réserve de
défense, chercher l'attaque la plus rentable, construire). Une stratégie n'est qu'un jeu de
réglages, dans `sim/bots.ts` :

| Stratégie | Idée |
|---|---|
| Colon | Prendre au plus vite les îles neutres les moins chères (soldat + mercenaire). |
| Bâtisseur | Mines partout d'abord, attaques à partir du tour 4. |
| Pillard | Viser les îles adverses mal défendues plutôt que les neutres. |
| Tortue | Tours, baraque, grosse réserve de défense, peu d'attaques. |
| Sprint final | Mines partout, puis économiser l'or les 3 derniers tours et tout lancer en mercenaires au tour 30. |
| Équilibré | Un peu de tout, avec un raid au dernier tour mais sans économiser avant. |
| Sans mercenaires | Témoin : soldats et baraques uniquement. |

Chaque partie tire 4 stratégies au hasard et les place au hasard sur les sièges.
Avec 4 joueurs, une stratégie neutre gagne 25 % de ses parties.

## Résultats avec les règles actuelles (600 parties)

| Stratégie | Victoires |
|---|---|
| Sprint final | 69 % |
| Équilibré | 34 % |
| Colon | 23 % |
| Pillard | 23 % |
| Tortue | 17 % |
| Bâtisseur | 10 % |
| Sans mercenaires | 0 % |

### 1. Le raid du dernier tour décide la partie

Les attaques du tour 30 comptent pour le score et personne ne peut répondre. Garder son or
et tout lancer en mercenaires au dernier tour suffit à gagner. Test sur 800 parties, en
ajoutant ou retirant seulement le raid final :

| Stratégie | Sans raid | Avec raid |
|---|---|---|
| Colon | 22 % | 53 % |
| Mines partout | 19 % | 57 % |

### 2. Le joueur de plus petit identifiant gagne les égalités entre attaquants

Quand deux joueurs attaquent la même île avec la même force, la règle actuelle donne l'île
au plus petit identifiant. C'est fréquent (les deux joueurs envoient « juste assez »).
Sur 200 parties entre bots identiques : sur ~1 500 égalités, P0 en gagne 746, P1 544,
P2 189 et P3 aucune. Un tirage propre à chaque île et à chaque tour (option
`attackerTieBreak: 'draw'`) rend ces victoires équitables.

### 3. Le plateau défavorise la 4e capitale

La 4e capitale placée est en moyenne la plus proche des autres (3,4 cases contre 4,1 pour la
3e) et a le moins d'îles neutres à proximité (8,4 contre 11,6 pour la 1re).
Elle gagne 15 à 17 % des parties au lieu de 25 %, quelle que soit la variante de règles.

### 4. Sans mercenaires, on ne gagne pas

Le bot qui n'utilise que des soldats gagne 0 % de ses parties : 3 de force pour 2 or contre
1 or + 1 bois pour 1 de force, l'écart est trop grand.

## Variantes testées (600 parties chacune, égalités tirées au sort)

« Écart » = écart-type des taux de victoire entre stratégies (plus bas = plus équilibré).
« Tête » = tour moyen à partir duquel le futur vainqueur ne quitte plus la première place.

| Variante | Écart | Tête | Meilleure stratégie |
|---|---|---|---|
| Règles actuelles | 20 % | 14 | Sprint final 69 % |
| Égalités tirées au sort | 20 % | 15 | Sprint final 69 % |
| Il faut un soldat survivant pour occuper | **11 %** | 9 | Tortue 46 % |
| Mercenaire à 3 or | 19 % | 14 | Sprint final 63 % |
| Mercenaire de force 2 | 19 % | 15 | Sprint final 62 % |
| Mercenaire à 2 or + 1 bois | 18 % | 8 | Colon 56 % |
| Mine à +1 or | 17 % | 14 | Sprint final 55 % |
| Mine à 5 bois | 19 % | 14 | Sprint final 67 % |
| Îles neutres plus fortes (+2) | 19 % | 14 | Sprint final 65 % |
| Mur de capitale à 5 | 21 % | 15 | Sprint final 71 % |
| Tour à +5 | 21 % | 15 | Sprint final 70 % |
| Occupation + mercenaire à 3 or | 12 % | 10 | Tortue 50 % |
| Occupation + mine à +1 or | 13 % | 10 | Tortue 48 % |
| Occupation + tour à +5 | 13 % | 9 | Tortue 51 % |

Seule la règle d'occupation casse le raid final. Elle fait passer la domination du côté de la
Tortue et rend la partie plus vite jouée (le vainqueur mène dès le tour 9 au lieu de 14).

## Limites

- Les bots sont des heuristiques, pas des joueurs parfaits. Une stratégie qui gagne contre eux
  peut perdre contre un humain qui s'adapte.
- Les bots voient la réserve d'or des adversaires et en déduisent la menace ; ils ne bluffent pas.
- Une seule taille de partie (4 joueurs, 30 tours, plateau par défaut).
