import type { GameState, Island } from './types.ts';
import { CAPITAL_WALL_DEFENSE, TOWER_DEFENSE } from './rules.ts';

/** Distance entre deux cases d'une grille hexagonale en coordonnées axiales. */
export function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function distance(state: GameState, fromId: string, toId: string): number {
  const a = state.islands[fromId];
  const b = state.islands[toId];
  if (!a || !b) return Infinity;
  return hexDistance(a, b);
}

export function hasBuilding(island: Island, type: Island['buildings'][number]['type']): boolean {
  return island.buildings.some((b) => b.type === type);
}

/** Défense d'une île : soldats présents + mur de capitale (3) + tour (3). */
export function fortification(island: Island): number {
  return (island.isCapital ? CAPITAL_WALL_DEFENSE : 0) + (hasBuilding(island, 'tower') ? TOWER_DEFENSE : 0);
}

export function defenseOf(island: Island): number {
  return island.soldiers + fortification(island);
}

export function islandsOf(state: GameState, playerId: string): Island[] {
  return Object.values(state.islands).filter((i) => i.owner === playerId);
}
