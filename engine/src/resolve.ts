/**
 * Résolution d'un tour : applique les ordres de tous les joueurs, simultanément.
 *
 * Ordre de résolution :
 * 1. Pour chaque joueur : recrutements, constructions, déplacements, puis départ des attaques
 *    (les coûts sont payés au fur et à mesure ; un ordre impossible est rejeté).
 * 2. Toutes les batailles en même temps. Les soldats partis attaquer ne défendent plus leur île.
 * 3. Les survivants d'un attaquant secondaire rentrent sur leur île de départ (s'il la possède encore).
 * 4. Production des baraques, revenus, éliminations, conditions de victoire.
 */
import { defenseOf, distance, fortification, hasBuilding, islandsOf } from './board.ts';
import { multiAttack } from './combat.ts';
import {
  BARRACKS_SOLDIERS,
  BUILDINGS,
  MERCENARY_COST,
  MERCENARY_FORCE,
  MINE_GOLD,
  RANGE2_GOLD_PER_UNIT,
  SAWMILL_WOOD,
  SOLDIER_COST,
  SOLDIER_FORCE,
} from './rules.ts';
import type {
  BuildingType,
  GameState,
  IslandId,
  Player,
  PlayerId,
  PlayerOrders,
  Resources,
  TurnEvent,
  TurnResult,
} from './types.ts';

interface Departure {
  player: PlayerId;
  from: IslandId;
  to: IslandId;
  soldiers: number;
  mercenaries: number;
  destroyBuilding?: BuildingType;
}

function canPay(p: Player, cost: Resources): boolean {
  return p.resources.gold >= cost.gold && p.resources.wood >= cost.wood;
}

function pay(p: Player, cost: Resources): void {
  p.resources.gold -= cost.gold;
  p.resources.wood -= cost.wood;
}

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

/** Coût d'une attaque (mercenaires + supplément de portée 2). Null si l'attaque est hors de portée. */
export function attackCost(
  state: GameState,
  from: IslandId,
  to: IslandId,
  soldiers: number,
  mercenaries: number,
): Resources | null {
  const origin = state.islands[from];
  if (!origin) return null;
  const d = distance(state, from, to);
  if (d < 1 || d > 2) return null;
  const range2 = d === 2 && !hasBuilding(origin, 'port') ? RANGE2_GOLD_PER_UNIT * (soldiers + mercenaries) : 0;
  return { gold: MERCENARY_COST.gold * mercenaries + range2, wood: MERCENARY_COST.wood * mercenaries };
}

export function resolveTurn(input: GameState, orders: Record<PlayerId, PlayerOrders>): TurnResult {
  const state: GameState = structuredClone(input);
  const events: TurnEvent[] = [];
  if (state.finished) return { state, events };

  const reject = (player: PlayerId, reason: string) => events.push({ kind: 'order_rejected', player, reason });
  const arrived: Record<IslandId, number> = {};
  const departures: Departure[] = [];
  const playerIds = Object.keys(state.players).sort();

  // 1. Ordres de chaque joueur
  for (const pid of playerIds) {
    const player = state.players[pid]!;
    if (player.eliminated) continue;
    const o = orders[pid] ?? {};

    for (const r of o.recruits ?? []) {
      const island = state.islands[r.islandId];
      if (!island || island.owner !== pid) { reject(pid, `Recrutement impossible : l'île ${r.islandId} ne vous appartient pas.`); continue; }
      if (!isPositiveInt(r.soldiers)) { reject(pid, 'Recrutement : nombre de soldats invalide.'); continue; }
      const cost = { gold: SOLDIER_COST.gold * r.soldiers, wood: SOLDIER_COST.wood * r.soldiers };
      if (!canPay(player, cost)) { reject(pid, `Recrutement de ${r.soldiers} soldat(s) : ressources insuffisantes.`); continue; }
      pay(player, cost);
      island.soldiers += r.soldiers;
      events.push({ kind: 'recruited', player: pid, islandId: island.id, soldiers: r.soldiers });
    }

    for (const b of o.builds ?? []) {
      const island = state.islands[b.islandId];
      const def = BUILDINGS[b.building];
      if (!island || island.owner !== pid) { reject(pid, `Construction impossible : l'île ${b.islandId} ne vous appartient pas.`); continue; }
      if (!def) { reject(pid, 'Construction : bâtiment inconnu.'); continue; }
      if (hasBuilding(island, b.building)) { reject(pid, `${def.label} déjà présent(e) sur l'île ${island.id}.`); continue; }
      if (!canPay(player, def.cost)) { reject(pid, `${def.label} : ressources insuffisantes.`); continue; }
      pay(player, def.cost);
      island.buildings.push({ type: b.building, builtTurn: state.turn });
      events.push({ kind: 'built', player: pid, islandId: island.id, building: b.building });
    }

    for (const m of o.moves ?? []) {
      const from = state.islands[m.from];
      const to = state.islands[m.to];
      if (!from || !to || from.owner !== pid || to.owner !== pid || from.id === to.id) { reject(pid, 'Déplacement impossible : les deux îles doivent vous appartenir.'); continue; }
      const d = distance(state, from.id, to.id);
      if (d > 2 || (d === 2 && !hasBuilding(from, 'port'))) { reject(pid, `Déplacement ${from.id} → ${to.id} : hors de portée.`); continue; }
      const available = from.soldiers - (arrived[from.id] ?? 0);
      if (!isPositiveInt(m.soldiers) || m.soldiers > available) { reject(pid, `Déplacement depuis ${from.id} : pas assez de soldats disponibles.`); continue; }
      from.soldiers -= m.soldiers;
      to.soldiers += m.soldiers;
      arrived[to.id] = (arrived[to.id] ?? 0) + m.soldiers;
      events.push({ kind: 'moved', player: pid, from: from.id, to: to.id, soldiers: m.soldiers });
    }

    for (const a of o.attacks ?? []) {
      const from = state.islands[a.from];
      const to = state.islands[a.to];
      if (!from || from.owner !== pid) { reject(pid, `Attaque impossible : l'île ${a.from} ne vous appartient pas.`); continue; }
      if (!to || to.owner === pid) { reject(pid, `Attaque impossible : cible ${a.to} invalide.`); continue; }
      if (!isNonNegativeInt(a.soldiers) || !isNonNegativeInt(a.mercenaries) || a.soldiers + a.mercenaries === 0) { reject(pid, 'Attaque : nombre d\'unités invalide.'); continue; }
      const available = from.soldiers - (arrived[from.id] ?? 0);
      if (a.soldiers > available) { reject(pid, `Attaque depuis ${from.id} : pas assez de soldats disponibles.`); continue; }
      const cost = attackCost(state, from.id, to.id, a.soldiers, a.mercenaries);
      if (!cost) { reject(pid, `Attaque ${from.id} → ${to.id} : hors de portée.`); continue; }
      if (!canPay(player, cost)) { reject(pid, `Attaque ${from.id} → ${to.id} : or insuffisant.`); continue; }
      pay(player, cost);
      from.soldiers -= a.soldiers;
      departures.push({ player: pid, from: from.id, to: to.id, soldiers: a.soldiers, mercenaries: a.mercenaries, destroyBuilding: a.destroyBuilding });
    }
  }

  // 2. Batailles simultanées
  const returns: { player: PlayerId; islandId: IslandId; soldiers: number }[] = [];
  const targets = [...new Set(departures.map((d) => d.to))].sort();
  const battleResults: { islandId: IslandId; newOwner: PlayerId | null; soldiers: number; destroy: BuildingType | null }[] = [];

  for (const targetId of targets) {
    const island = state.islands[targetId]!;
    const group = departures.filter((d) => d.to === targetId);
    const byPlayer = new Map<PlayerId, { soldiers: number; force: number; origins: Map<IslandId, number>; destroy?: BuildingType }>();
    for (const d of group) {
      const e = byPlayer.get(d.player) ?? { soldiers: 0, force: 0, origins: new Map(), destroy: undefined };
      e.soldiers += d.soldiers;
      e.force += d.soldiers * SOLDIER_FORCE + d.mercenaries * MERCENARY_FORCE;
      e.origins.set(d.from, (e.origins.get(d.from) ?? 0) + d.soldiers);
      e.destroy ??= d.destroyBuilding;
      byPlayer.set(d.player, e);
    }
    const attackerIds = [...byPlayer.keys()].sort();
    const defense = defenseOf(island);
    const res = multiAttack(attackerIds.map((k) => ({ key: k, force: byPlayer.get(k)!.force })), defense);

    const attackersReport = attackerIds.map((pid) => {
      const e = byPlayer.get(pid)!;
      const losses = res.losses[pid] ?? 0;
      const survivors = res.attackerWins ? Math.min(e.soldiers, e.force - losses) : 0;
      return { player: pid, force: e.force, losses, survivors };
    });

    let destroyed: BuildingType | null = null;
    let defenderSoldierLosses: number;
    if (res.attackerWins) {
      defenderSoldierLosses = island.soldiers;
      const winner = res.winnerKey!;
      if (island.owner !== null && island.buildings.length > 0) {
        const wanted = byPlayer.get(winner)!.destroy;
        destroyed = wanted && hasBuilding(island, wanted) ? wanted : island.buildings[0]!.type;
      }
      for (const a of attackersReport) {
        if (a.player === winner) {
          battleResults.push({ islandId: targetId, newOwner: winner, soldiers: a.survivors, destroy: destroyed });
        } else if (a.survivors > 0) {
          // Les survivants rentrent sur l'île d'où est parti le plus gros contingent.
          const origins = [...byPlayer.get(a.player)!.origins.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
          returns.push({ player: a.player, islandId: origins[0]![0], soldiers: a.survivors });
        }
      }
    } else {
      // Les fortifications (mur, tour) absorbent les pertes en premier.
      defenderSoldierLosses = Math.min(island.soldiers, Math.max(0, res.defenderLosses - fortification(island)));
      island.soldiers -= defenderSoldierLosses;
    }

    events.push({
      kind: 'battle',
      islandId: targetId,
      defender: island.owner,
      defense,
      attackers: attackersReport,
      combinedForce: res.combinedForce,
      conquered: res.attackerWins,
      newOwner: res.attackerWins ? res.winnerKey : island.owner,
      defenderLosses: defenderSoldierLosses,
      destroyedBuilding: destroyed,
    });
  }

  for (const b of battleResults) {
    const island = state.islands[b.islandId]!;
    island.owner = b.newOwner;
    island.soldiers = b.soldiers;
    island.isCapital = false;
    if (b.destroy) {
      const idx = island.buildings.findIndex((x) => x.type === b.destroy);
      if (idx >= 0) island.buildings.splice(idx, 1);
    }
  }

  // 3. Retour des survivants secondaires
  for (const r of returns) {
    const island = state.islands[r.islandId]!;
    if (island.owner === r.player) island.soldiers += r.soldiers;
  }

  // 4. Baraques et revenus
  for (const island of Object.values(state.islands)) {
    if (island.owner === null) continue;
    const barracks = island.buildings.find((b) => b.type === 'barracks');
    if (barracks && barracks.builtTurn < state.turn) {
      island.soldiers += BARRACKS_SOLDIERS;
      events.push({ kind: 'barracks', islandId: island.id, player: island.owner, soldiers: BARRACKS_SOLDIERS });
    }
  }

  for (const pid of playerIds) {
    const player = state.players[pid]!;
    if (player.eliminated) continue;
    const income = incomeOf(state, pid);
    player.resources.gold += income.gold;
    player.resources.wood += income.wood;
    if (income.gold || income.wood) events.push({ kind: 'income', player: pid, gold: income.gold, wood: income.wood });
  }

  // 5. Éliminations et victoire
  for (const pid of playerIds) {
    const player = state.players[pid]!;
    if (!player.eliminated && islandsOf(state, pid).length === 0) {
      player.eliminated = true;
      events.push({ kind: 'eliminated', player: pid });
    }
  }

  const winner = checkWinner(state);
  if (winner !== undefined) {
    state.finished = true;
    state.winner = winner;
    events.push({ kind: 'game_over', winner });
  }

  state.turn += 1;
  return { state, events };
}

export function incomeOf(state: GameState, playerId: PlayerId): Resources {
  let gold = 0;
  let wood = 0;
  for (const island of islandsOf(state, playerId)) {
    gold += island.goldSymbol ? 3 : 1;
    wood += island.woodSymbol ? 3 : 1;
    if (hasBuilding(island, 'mine')) gold += MINE_GOLD;
    if (hasBuilding(island, 'sawmill')) wood += SAWMILL_WOOD;
  }
  return { gold, wood };
}

/**
 * Renvoie le vainqueur si la partie est terminée (null = égalité), undefined sinon.
 * - Victoire anticipée : un seul joueur restant, ou un joueur qui possède toutes les capitales de départ.
 * - Fin du dernier tour : le joueur qui possède le plus d'îles (puis le plus de soldats).
 */
export function checkWinner(state: GameState): PlayerId | null | undefined {
  const alive = Object.values(state.players).filter((p) => !p.eliminated);
  if (alive.length === 1) return alive[0]!.id;
  if (alive.length === 0) return null;

  const capitals = Object.values(state.islands).filter((i) => i.startingCapital);
  const capitalOwners = new Set(capitals.map((i) => i.owner));
  if (capitals.length > 1 && capitalOwners.size === 1) {
    const owner = [...capitalOwners][0];
    if (owner) return owner;
  }

  if (state.turn >= state.maxTurns) {
    const score = (pid: PlayerId) => {
      const isl = islandsOf(state, pid);
      return [isl.length, isl.reduce((s, i) => s + i.soldiers, 0)] as const;
    };
    const ranked = alive
      .map((p) => ({ id: p.id, s: score(p.id) }))
      .sort((a, b) => b.s[0] - a.s[0] || b.s[1] - a.s[1]);
    const [best, second] = ranked;
    if (second && best!.s[0] === second.s[0] && best!.s[1] === second.s[1]) return null;
    return best!.id;
  }
  return undefined;
}
