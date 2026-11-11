import {
  BUILDINGS,
  SOLDIER_COST,
  attackCost,
  distance,
  hasBuilding,
  resolveTurn,
  type GameState,
  type IslandId,
  type PlayerId,
  type PlayerOrders,
  type Resources,
} from '@island/engine';

export function emptyOrders(): Required<PlayerOrders> {
  return { recruits: [], builds: [], moves: [], attacks: [] };
}

export function normalize(o: PlayerOrders | undefined): Required<PlayerOrders> {
  return { recruits: o?.recruits ?? [], builds: o?.builds ?? [], moves: o?.moves ?? [], attacks: o?.attacks ?? [] };
}

/** Ressources dépensées par les ordres d'un joueur. */
export function spent(state: GameState, orders: PlayerOrders): Resources {
  const o = normalize(orders);
  let gold = 0;
  let wood = 0;
  for (const r of o.recruits) { gold += SOLDIER_COST.gold * r.soldiers; wood += SOLDIER_COST.wood * r.soldiers; }
  for (const b of o.builds) { gold += BUILDINGS[b.building].cost.gold; wood += BUILDINGS[b.building].cost.wood; }
  for (const a of o.attacks) {
    const c = attackCost(state, a.from, a.to, a.soldiers, a.mercenaries);
    if (c) { gold += c.gold; wood += c.wood; }
  }
  return { gold, wood };
}

export function remaining(state: GameState, pid: PlayerId, orders: PlayerOrders): Resources {
  const p = state.players[pid]!;
  const s = spent(state, orders);
  return { gold: p.resources.gold - s.gold, wood: p.resources.wood - s.wood };
}

/** Soldats qui peuvent encore quitter une île (pour attaquer ou se déplacer). */
export function availableToLeave(state: GameState, orders: PlayerOrders, islandId: IslandId): number {
  const o = normalize(orders);
  const island = state.islands[islandId];
  if (!island) return 0;
  const recruited = o.recruits.filter((r) => r.islandId === islandId).reduce((s, r) => s + r.soldiers, 0);
  const out =
    o.moves.filter((m) => m.from === islandId).reduce((s, m) => s + m.soldiers, 0) +
    o.attacks.filter((a) => a.from === islandId).reduce((s, a) => s + a.soldiers, 0);
  return island.soldiers + recruited - out;
}

export function plannedBuildings(orders: PlayerOrders, islandId: IslandId) {
  return normalize(orders).builds.filter((b) => b.islandId === islandId).map((b) => b.building);
}

export type TargetKind = 'attack' | 'move';

/** Îles qu'on peut viser depuis une île (attaque à portée 1 ou 2, déplacement vers ses îles). */
export function targetsFrom(state: GameState, pid: PlayerId, fromId: IslandId): Map<IslandId, TargetKind> {
  const res = new Map<IslandId, TargetKind>();
  const from = state.islands[fromId];
  if (!from) return res;
  const port = hasBuilding(from, 'port');
  for (const island of Object.values(state.islands)) {
    if (island.id === fromId) continue;
    const d = distance(state, fromId, island.id);
    if (island.owner === pid) {
      if (d === 1 || (d === 2 && port)) res.set(island.id, 'move');
    } else if (d === 1 || d === 2) {
      res.set(island.id, 'attack');
    }
  }
  return res;
}

/** Ordres que le moteur refuserait (ressources, soldats…), pour les signaler avant validation. */
export function rejectedReasons(state: GameState, pid: PlayerId, orders: PlayerOrders): string[] {
  const { events } = resolveTurn(state, { [pid]: orders });
  return events.flatMap((e) => (e.kind === 'order_rejected' && e.player === pid ? [e.reason] : []));
}
