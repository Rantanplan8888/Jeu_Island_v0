/**
 * Constantes des règles d'Island (version 5 + propositions retenues).
 * Tout ce qui est réglable se trouve ici pour pouvoir être ajusté facilement.
 *
 * `DEFAULT_RULES` regroupe toutes les valeurs. Les fonctions du moteur acceptent
 * un jeu de règles optionnel (`Rules`) pour pouvoir tester des variantes
 * (simulations d'équilibrage) sans toucher aux règles par défaut.
 */
import type { BuildingType, Resources } from './types.ts';

export interface Rules {
  soldierCost: Resources;
  soldierForce: number;
  mercenaryCost: Resources;
  mercenaryForce: number;
  /** Supplément d'or par unité (soldat ou mercenaire) pour une attaque à portée 2 sans port. */
  range2GoldPerUnit: number;
  capitalWallDefense: number;
  towerDefense: number;
  startingResources: Resources;
  startingSoldiers: number;
  /** Part des pertes supportée par le vainqueur lors d'une attaque simultanée. */
  winnerLossShare: number;
  /** Part de la force des attaquants secondaires prise en compte. */
  secondaryForceShare: number;
  /**
   * Départage de deux attaquants de même force sur une île :
   * - 'defender' : personne ne prend l'île, l'attaque échoue (règle retenue) ;
   * - 'playerId' : le plus petit identifiant de joueur gagne (ancienne règle) ;
   * - 'draw' : tirage déterministe propre à chaque île et à chaque tour.
   */
  attackerTieBreak: 'defender' | 'playerId' | 'draw';
  /**
   * Revenus décroissants (null = désactivé ; par défaut dès 6 îles, 10 % par île) : au-delà de `threshold` îles, les revenus
   * totaux sont multipliés par 1 / (1 + rate × (îles − threshold)), arrondis.
   */
  incomeDecay: { threshold: number; rate: number } | null;
  /**
   * Brouillard de guerre (null = carte entièrement visible). Jusqu'à `fullRange` cases
   * d'une de ses îles, on voit tout ; jusqu'à `partialRange`, on voit l'île, son propriétaire
   * et ses symboles, mais pas ses soldats ni ses bâtiments ; au-delà, seulement le propriétaire
   * de chaque île si `ownersBeyond` est vrai, sinon rien.
   */
  fog: { fullRange: number; partialRange: number; ownersBeyond: boolean } | null;
  /** Coût d'un espion (une île révélée par tour, à l'aube). null = pas d'espion. */
  spyCost: Resources | null;
  /** Nombre maximal de mercenaires par soldat dans une attaque (null = sans limite). */
  mercenariesPerSoldier: number | null;
  /**
   * Si vrai, une île n'est prise que si au moins un soldat survit pour l'occuper :
   * une attaque de mercenaires seuls tue les défenseurs mais l'île reste à son propriétaire.
   */
  occupationRequiresSoldier: boolean;
  buildings: Record<BuildingType, { cost: Resources; label: string }>;
  mineGold: number;
  sawmillWood: number;
  barracksSoldiers: number;
  /** Revenus d'une île : de base, et avec le symbole correspondant (la capitale a les deux). */
  baseIncome: number;
  symbolIncome: number;
  /** Durée par défaut d'une partie, en tours (un tour par jour). */
  maxTurns: number;
  /** Défense des îles vierges au départ (soldats + tour éventuelle). */
  plainDefenses: readonly number[];
  /** Île avec un symbole (bois ou or). */
  bonusDefenses: readonly number[];
  /** Île avec les deux symboles. */
  bothDefenses: readonly number[];
  /** Île avec un bâtiment déjà construit. */
  buildingDefenses: readonly number[];
}

export const DEFAULT_RULES: Rules = {
  soldierCost: { gold: 1, wood: 1 },
  soldierForce: 1,
  mercenaryCost: { gold: 2, wood: 0 },
  mercenaryForce: 3,
  range2GoldPerUnit: 1,
  capitalWallDefense: 3,
  towerDefense: 3,
  startingResources: { gold: 3, wood: 3 },
  startingSoldiers: 3,
  winnerLossShare: 4 / 5,
  secondaryForceShare: 0.5,
  attackerTieBreak: 'defender',
  mercenariesPerSoldier: 1,
  spyCost: { gold: 1, wood: 0 },
  fog: { fullRange: 1, partialRange: 2, ownersBeyond: true },
  incomeDecay: { threshold: 6, rate: 0.1 },
  occupationRequiresSoldier: true,
  buildings: {
    mine: { cost: { gold: 0, wood: 3 }, label: 'Mine' },
    sawmill: { cost: { gold: 2, wood: 0 }, label: 'Scierie' },
    barracks: { cost: { gold: 0, wood: 4 }, label: 'Baraque' },
    port: { cost: { gold: 0, wood: 3 }, label: 'Port' },
    tower: { cost: { gold: 0, wood: 3 }, label: 'Tour' },
    university: { cost: { gold: 0, wood: 5 }, label: 'Université' },
  },
  mineGold: 2,
  sawmillWood: 2,
  barracksSoldiers: 1,
  baseIncome: 1,
  symbolIncome: 3,
  maxTurns: 30,
  plainDefenses: [2, 3, 4],
  bonusDefenses: [5, 6],
  bothDefenses: [8, 9, 10],
  buildingDefenses: [4, 5, 6],
};

/** Crée un jeu de règles à partir des règles par défaut et de quelques changements. */
export function makeRules(overrides: Partial<Rules> = {}): Rules {
  return { ...DEFAULT_RULES, ...overrides };
}

// Valeurs par défaut exportées individuellement (compatibilité avec l'application).
export const SOLDIER_COST = DEFAULT_RULES.soldierCost;
export const SOLDIER_FORCE = DEFAULT_RULES.soldierForce;
export const MERCENARY_COST = DEFAULT_RULES.mercenaryCost;
export const MERCENARY_FORCE = DEFAULT_RULES.mercenaryForce;
export const RANGE2_GOLD_PER_UNIT = DEFAULT_RULES.range2GoldPerUnit;
export const CAPITAL_WALL_DEFENSE = DEFAULT_RULES.capitalWallDefense;
export const TOWER_DEFENSE = DEFAULT_RULES.towerDefense;
export const STARTING_RESOURCES = DEFAULT_RULES.startingResources;
export const STARTING_SOLDIERS = DEFAULT_RULES.startingSoldiers;
export const WINNER_LOSS_SHARE = DEFAULT_RULES.winnerLossShare;
export const SECONDARY_FORCE_SHARE = DEFAULT_RULES.secondaryForceShare;
export const BUILDINGS = DEFAULT_RULES.buildings;
export const MINE_GOLD = DEFAULT_RULES.mineGold;
export const SAWMILL_WOOD = DEFAULT_RULES.sawmillWood;
export const BARRACKS_SOLDIERS = DEFAULT_RULES.barracksSoldiers;
export const DEFAULT_MAX_TURNS = DEFAULT_RULES.maxTurns;
export const PLAIN_DEFENSES = DEFAULT_RULES.plainDefenses;
export const BONUS_DEFENSES = DEFAULT_RULES.bonusDefenses;
export const BOTH_DEFENSES = DEFAULT_RULES.bothDefenses;
export const BUILDING_DEFENSES = DEFAULT_RULES.buildingDefenses;
