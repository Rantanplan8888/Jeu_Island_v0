# Island – choix retenus dans le moteur

Ce document complète les règles (version 5) avec les décisions appliquées par le code.
Les points marqués **(proposition)** n'ont pas encore été validés et peuvent changer.
Toutes les valeurs numériques se règlent dans `engine/src/rules.ts`.

## Rappel des règles appliquées

- Départ : 3 soldats sur la capitale, 3 or, 3 bois.
- Soldat : 1 or + 1 bois, force 1. Mercenaire : 2 or, force 3, disparaît après l'attaque.
- Revenus : île normale 1/1, symbole bois 3 bois, symbole or 3 or, capitale 3/3.
- Bâtiments : mine (3 bois, +2 or), scierie (2 or, +2 bois), baraque (4 bois, +1 soldat par tour à partir du tour suivant), port (3 bois), tour (3 bois, +3 défense), université (5 bois, sans effet pour l'instant).
- Combat : l'attaquant gagne s'il est strictement plus fort ; il perd la force du défenseur, moins 1 s'il a au moins le double.
- Capitale capturée : perd son mur et son statut, garde ses deux symboles. Un bâtiment de l'île conquise d'un adversaire est détruit, au choix de l'attaquant.

## Points tranchés

1. **Portée 2 (proposition)** : 1 or par unité (soldat ou mercenaire), gratuit si l'île de départ a un port.
2. **Défense (proposition)** : soldats présents + 3 (mur de capitale) + 3 (tour). Un seul bâtiment de chaque type par île.
3. **Technologies (proposition)** : reportées à une version ultérieure.
4. **Attaques simultanées (proposition)** :
   - force combinée = plus fort + 50 % de la somme des autres, arrondie à l'inférieur ;
   - le plus fort supporte 4/5 des pertes, les autres se partagent 1/5 au prorata de leur force ;
   - chaque part est arrondie au-dessus et plafonnée à la force de l'attaquant ;
   - les survivants d'un attaquant secondaire rentrent sur leur île de départ (s'il la possède encore) ;
   - à force égale entre deux attaquants, l'identifiant du joueur départage.
5. **Victoire (proposition)** : partie de 30 tours ; à la fin, le joueur qui a le plus d'îles gagne (puis le plus de soldats). Victoire anticipée s'il ne reste qu'un joueur ou si un joueur possède toutes les capitales de départ.
6. **Ressources (proposition)** : une réserve commune par joueur.
7. **Égalité de force (proposition)** : le défenseur gagne.
8. **Attaque ratée (proposition)** : tous les attaquants meurent ; le défenseur perd la force de l'attaquant (moins 1 s'il avait le double). Le mur et la tour absorbent ces pertes en premier.
9. **Recrutement et déplacements (proposition)** : on recrute sur n'importe laquelle de ses îles. On peut déplacer des soldats vers une de ses îles adjacente (portée 2 avec un port). Des soldats déplacés ne peuvent pas attaquer le même tour.
10. **Ordre de résolution (proposition)** : recrutements, constructions, déplacements, départ des attaques, batailles simultanées, production des baraques, revenus. Les soldats partis attaquer ne défendent pas leur île cette nuit-là.
11. **Survivants et mercenaires** : après une victoire, les pertes sont d'abord absorbées par les mercenaires ; restent sur l'île conquise au plus le nombre de soldats envoyés.

## Plateau

Grille hexagonale ; deux îles sont adjacentes si elles sont sur des cases voisines.
Le plateau compte environ 12 cases par joueur, dont environ 60 % portent une île.
Les capitales sont réparties le plus loin possible les unes des autres et ont toujours des îles voisines.
Les îles vierges ont plus de soldats quand elles sont loin des capitales ou qu'elles ont des symboles.
