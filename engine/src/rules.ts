/**
 * Constantes des règles d'Island (version 5 + propositions retenues).
 * Tout ce qui est réglable se trouve ici pour pouvoir être ajusté facilement.
 */
import type { BuildingType, Resources } from './types.js';

export const SOLDIER_COST: Resources = { gold: 1, wood: 1 };
export const SOLDIER_FORCE = 1;

export const MERCENARY_COST: Resources = { gold: 2, wood: 0 };
export const MERCENARY_FORCE = 3;

/** Supplément d'or par unité (soldat ou mercenaire) pour une attaque à portée 2 sans port. */
export const RANGE2_GOLD_PER_UNIT = 1;

export const CAPITAL_WALL_DEFENSE = 3;
export const TOWER_DEFENSE = 3;

export const STARTING_RESOURCES: Resources = { gold: 3, wood: 3 };
export const STARTING_SOLDIERS = 3;

/** Part des pertes supportée par le vainqueur lors d'une attaque simultanée. */
export const WINNER_LOSS_SHARE = 4 / 5;
/** Part de la force des attaquants secondaires prise en compte. */
export const SECONDARY_FORCE_SHARE = 0.5;

export const BUILDINGS: Record<BuildingType, { cost: Resources; label: string }> = {
  mine: { cost: { gold: 0, wood: 3 }, label: 'Mine' },
  sawmill: { cost: { gold: 2, wood: 0 }, label: 'Scierie' },
  barracks: { cost: { gold: 0, wood: 4 }, label: 'Baraque' },
  port: { cost: { gold: 0, wood: 3 }, label: 'Port' },
  tower: { cost: { gold: 0, wood: 3 }, label: 'Tour' },
  university: { cost: { gold: 0, wood: 5 }, label: 'Université' },
};

export const MINE_GOLD = 2;
export const SAWMILL_WOOD = 2;
export const BARRACKS_SOLDIERS = 1;

/** Durée par défaut d'une partie, en tours (un tour par jour). */
export const DEFAULT_MAX_TURNS = 30;
