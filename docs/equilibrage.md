# Équilibrage d'Island par simulations

Parties simulées entre bots, à 4 joueurs, avec le vrai moteur. Les variantes sont des options
du moteur (`makeRules({...})`) ; seules celles validées sont devenues les règles par défaut.

## Troisième tour : revenus décroissants (12 novembre)

Option `incomeDecay: { threshold, rate }`, **adoptée avec 6 îles et 10 % par île** : au-delà de `threshold` îles,
tous les revenus du joueur sont multipliés par 1 / (1 + rate × (îles − threshold)), arrondis.

Exemple d'un empire type (capitale, ses 5 voisines, puis des îles simples), en or par tour :

| Îles | Sans règle | 6 îles / 5 % | 6 îles / 10 % | 6 îles / 15 % | 6 îles / 20 % |
|---|---|---|---|---|---|
| 6 | 10 | 10 | 10 | 10 | 10 |
| 8 | 12 | 11 | 10 | 9 | 9 |
| 10 | 14 | 12 | 10 | 9 | 8 |
| 15 | 19 | 13 | 10 | 8 | 7 |

À 10 % par île, le revenu plafonne : une île simple de plus ne rapporte plus rien, mais elle compte
toujours pour la victoire. Au-delà de 10 %, s'agrandir fait baisser le revenu.

| Variante (800 parties, règles validées) | Écart | Tête | Fins anticipées | Éliminations | Meilleures stratégies |
|---|---|---|---|---|---|
| Sans revenus décroissants | 13 % | 8 | 15 % | 0,83 | Colon 45 %, Pillard 41 % |
| Dès 6 îles, 5 % | 12 % | 9 | 3 % | 0,33 | Colon 43 %, Pillard 41 % |
| **Dès 6 îles, 10 %** | **11 %** | **10** | **1 %** | **0,20** | Pillard 40 %, Colon 39 % |
| Dès 8 îles, 10 % | 12 % | 10 | 1 % | 0,23 | Colon 42 %, Pillard 39 % |
| Dès 6 îles, 15 % | 10 % | 11 | 0 % | 0,16 | Pillard 39 %, Colon 35 % |
| Dès 6 îles, 20 % | 10 % | 12 | 0 % | 0,17 | Pillard 40 %, Colon 34 % |
| Dès 5 îles, 25 % | 9 % | 13 | 0 % | 0,14 | Bâtisseur 36 %, Colon 32 % |
| Dès 6 îles, 30 % | 9 % | 14 | 0 % | 0,15 | Pillard 35 %, Bâtisseur 32 % |
| Dès 4 îles, 30 % | 9 % | 14 | 0 % | 0,09 | Bâtisseur 41 %, Tortue 33 % |

Constats :

- Même douce, la règle supprime presque les fins anticipées et les éliminations : les parties
  vont jusqu'au bout et le vainqueur se détache plus tard.
- Plus la pente est forte, plus les stratégies se valent, mais au-delà de 10 % s'agrandir
  appauvrit, ce qui risque d'être frustrant.
- Avec une pente très forte (4 îles, 30 %), l'avantage passe aux stratégies économiques.
- Le Sprint final et l'Équilibré restent faibles partout : c'est sans doute la limite de ces
  deux bots plus qu'un problème de règles.

## Deuxième tour : règles validées (12 novembre)

Règles adoptées après le premier tour d'analyse :

1. Il faut qu'au moins un soldat survive pour occuper une île conquise.
2. Pas plus de mercenaires que de soldats dans une attaque.
3. Deux attaquants à égalité de force : l'attaque échoue, le défenseur garde l'île.
4. Capitales placées à intervalles réguliers sur un anneau, et plateau choisi parmi 24 pour
   répartir équitablement les îles libres.

Les bots ont aussi été améliorés : ils recrutent des soldats sur l'île de départ d'une attaque
(les recrues peuvent attaquer le même tour). Les chiffres ci-dessous sont donc à comparer entre
eux, pas avec ceux du premier tour.

| Variante (600 parties) | Écart | Tête | Fins anticipées | Victoires par siège | Meilleures stratégies |
|---|---|---|---|---|---|
| Anciennes règles | 16 % | 11 | 8 % | 27/26/24/23 | Sprint final 45 %, Colon 43 % |
| **Règles validées** | **12 %** | 8 | 15 % | 27/25/24/24 | Colon 43 %, Pillard 40 % |
| + mercenaire à 3 or | 13 % | 8 | 16 % | 26/27/23/23 | Pillard 44 %, Colon 39 % |
| + 1 mercenaire pour 2 soldats | 15 % | 8 | 19 % | 26/23/28/23 | Pillard 47 %, Colon 46 % |
| + mine à +1 or | 14 % | 8 | 14 % | 22/24/26/28 | Pillard 47 %, Colon 44 % |
| + îles neutres plus fortes | 13 % | 8 | 16 % | 25/26/27/23 | Pillard 43 %, Colon 41 % |
| + mur de capitale à 5 | 13 % | 8 | 9 % | 25/24/25/27 | Pillard 43 %, Colon 41 % |
| + tour à +5 | 12 % | 8 | 11 % | 27/24/25/25 | Colon 41 %, Pillard 39 % |
| + tour à 2 bois | 12 % | 8 | 16 % | 27/24/24/25 | Colon 42 %, Pillard 40 % |
| + 5 soldats au départ | 14 % | 8 | 14 % | 23/23/28/27 | Colon 47 %, Pillard 40 % |
| + symbole à +2 | 14 % | 8 | 30 % | 23/25/26/26 | Pillard 47 %, Colon 40 % |

Constats :

- Le raid du dernier tour ne marche plus : le Sprint final tombe de 45 % à 20 %.
- Les places sont équitables : chaque siège gagne entre 24 et 27 % des parties
  (la 4e capitale gagnait 15 à 17 % avant).
- Le nouveau point faible est **l'effet boule de neige** : s'étendre le plus vite possible
  (Colon, Pillard) gagne 40 à 43 % des parties, et le vainqueur est en tête dès le tour 8 en
  moyenne. Chaque île conquise rapporte tout de suite et pour toujours, sans contrepartie.
- Aucun des réglages de prix ou de défense testés ne corrige cet effet. Il faudrait une règle
  qui freine les gros empires (entretien par île, revenus décroissants, bonus de rattrapage…).

## Premier tour : règles d'origine

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

### Résultats avec les règles d'origine (600 parties)

| Stratégie | Victoires |
|---|---|
| Sprint final | 69 % |
| Équilibré | 34 % |
| Colon | 23 % |
| Pillard | 23 % |
| Tortue | 17 % |
| Bâtisseur | 10 % |
| Sans mercenaires | 0 % |

#### 1. Le raid du dernier tour décide la partie

Les attaques du tour 30 comptent pour le score et personne ne peut répondre. Garder son or
et tout lancer en mercenaires au dernier tour suffit à gagner. Test sur 800 parties, en
ajoutant ou retirant seulement le raid final :

| Stratégie | Sans raid | Avec raid |
|---|---|---|
| Colon | 22 % | 53 % |
| Mines partout | 19 % | 57 % |

#### 2. Le joueur de plus petit identifiant gagne les égalités entre attaquants

Quand deux joueurs attaquent la même île avec la même force, la règle actuelle donne l'île
au plus petit identifiant. C'est fréquent (les deux joueurs envoient « juste assez »).
Sur 200 parties entre bots identiques : sur ~1 500 égalités, P0 en gagne 746, P1 544,
P2 189 et P3 aucune. Un tirage propre à chaque île et à chaque tour (option
`attackerTieBreak: 'draw'`) rend ces victoires équitables.

#### 3. Le plateau défavorise la 4e capitale

La 4e capitale placée est en moyenne la plus proche des autres (3,4 cases contre 4,1 pour la
3e) et a le moins d'îles neutres à proximité (8,4 contre 11,6 pour la 1re).
Elle gagne 15 à 17 % des parties au lieu de 25 %, quelle que soit la variante de règles.

#### 4. Sans mercenaires, on ne gagne pas

Le bot qui n'utilise que des soldats gagne 0 % de ses parties : 3 de force pour 2 or contre
1 or + 1 bois pour 1 de force, l'écart est trop grand.

### Variantes testées (600 parties chacune, égalités tirées au sort)

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
