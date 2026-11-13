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
import { DEFAULT_RULES, type Rules } from './rules.ts';
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
  rules: Rules = DEFAULT_RULES,
): Resources | null {
  const origin = state.islands[from];
  if (!origin) return null;
  const d = distance(state, from, to);
  if (d < 1 || d > 2) return null;
  const range2 = d === 2 && !hasBuilding(origin, 'port') ? rules.range2GoldPerUnit * (soldiers + mercenaries) : 0;
  return { gold: rules.mercenaryCost.gold * mercenaries + range2, wood: rules.mercenaryCost.wood * mercenaries };
}

export function resolveTurn(
  input: GameState,
  orders: Record<PlayerId, PlayerOrders>,
  rules: Rules = DEFAULT_RULES,
): TurnResult {
  const state: GameState = structuredClone(input);
  const events: TurnEvent[] = [];
  if (state.finished) return { state, events };

  const reject = (player: PlayerId, reason: string) => events.push({ kind: 'order_rejected', player, reason });
  const arrived: Record<IslandId, number> = {};
  const departures: Departure[] = [];
  const spies: { player: PlayerId; islandId: IslandId }[] = [];
  state.spied = {};
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
      const cost = { gold: rules.soldierCost.gold * r.soldiers, wood: rules.soldierCost.wood * r.soldiers };
      if (!canPay(player, cost)) { reject(pid, `Recrutement de ${r.soldiers} soldat(s) : ressources insuffisantes.`); continue; }
      pay(player, cost);
      island.soldiers += r.soldiers;
      events.push({ kind: 'recruited', player: pid, islandId: island.id, soldiers: r.soldiers });
    }

    for (const b of o.builds ?? []) {
      const island = state.islands[b.islandId];
      const def = rules.buildings[b.building];
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
      if (rules.mercenariesPerSoldier !== null && a.mercenaries > a.soldiers * rules.mercenariesPerSoldier) {
        reject(pid, `Attaque ${from.id} → ${to.id} : pas plus de ${rules.mercenariesPerSoldier === 1 ? 'mercenaires que de soldats' : `${rules.mercenariesPerSoldier} mercenaires par soldat`}.`);
        continue;
      }
      const available = from.soldiers - (arrived[from.id] ?? 0);
      if (a.soldiers > available) { reject(pid, `Attaque depuis ${from.id} : pas assez de soldats disponibles.`); continue; }
      const cost = attackCost(state, from.id, to.id, a.soldiers, a.mercenaries, rules);
      if (!cost) { reject(pid, `Attaque ${from.id} → ${to.id} : hors de portée.`); continue; }
      if (!canPay(player, cost)) { reject(pid, `Attaque ${from.id} → ${to.id} : or insuffisant.`); continue; }
      pay(player, cost);
      from.soldiers -= a.soldiers;
      departures.push({ player: pid, from: from.id, to: to.id, soldiers: a.soldiers, mercenaries: a.mercenaries, destroyBuilding: a.destroyBuilding });
    }
  }

  // Espions (un par joueur et par tour) : payés maintenant, rapport à l'aube.
  for (const pid of playerIds) {
    const player = state.players[pid]!;
    const target = orders[pid]?.spy;
    if (player.eliminated || target === undefined) continue;
    const island = state.islands[target];
    if (!rules.spyCost) { reject(pid, 'Les espions ne sont pas autorisés dans cette partie.'); continue; }
    if (!island || island.owner === pid) { reject(pid, `Espion : cible ${target} invalide.`); continue; }
    if (!canPay(player, rules.spyCost)) { reject(pid, 'Espion : or insuffisant.'); continue; }
    pay(player, rules.spyCost);
    spies.push({ player: pid, islandId: target });
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
      e.force += d.soldiers * rules.soldierForce + d.mercenaries * rules.mercenaryForce;
      e.origins.set(d.from, (e.origins.get(d.from) ?? 0) + d.soldiers);
      e.destroy ??= d.destroyBuilding;
      byPlayer.set(d.player, e);
    }
    const attackerIds = [...byPlayer.keys()].sort();
    if (rules.attackerTieBreak === 'draw') {
      // Ordre pseudo-aléatoire mais reproductible : dépend du tour, de l'île et du joueur.
      const draw = (pid: PlayerId) => hashString(`${state.turn}|${targetId}|${pid}`);
      attackerIds.sort((a, b) => draw(a) - draw(b));
    }
    const defense = defenseOf(island, rules);
    const res = multiAttack(attackerIds.map((k) => ({ key: k, force: byPlayer.get(k)!.force })), defense, rules);

    const attackersReport = attackerIds.map((pid) => {
      const e = byPlayer.get(pid)!;
      const losses = res.losses[pid] ?? 0;
      const survivors = res.attackerWins ? Math.min(e.soldiers, Math.floor((e.force - losses) / rules.soldierForce)) : 0;
      return { player: pid, force: e.force, losses, survivors };
    });

    let destroyed: BuildingType | null = null;
    let defenderSoldierLosses: number;
    const occupied = !rules.occupationRequiresSoldier
      || (attackersReport.find((a) => a.player === res.winnerKey)?.survivors ?? 0) > 0;
    if (res.attackerWins && !occupied) {
      // Victoire sans soldat pour occuper l'île : les défenseurs sont tués, l'île ne change pas de main.
      defenderSoldierLosses = island.soldiers;
      island.soldiers = 0;
      for (const a of attackersReport) {
        if (a.player !== res.winnerKey && a.survivors > 0) {
          const origins = [...byPlayer.get(a.player)!.origins.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
          returns.push({ player: a.player, islandId: origins[0]![0], soldiers: a.survivors });
        }
      }
    } else if (res.attackerWins) {
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
      defenderSoldierLosses = Math.min(island.soldiers, Math.max(0, res.defenderLosses - fortification(island, rules)));
      island.soldiers -= defenderSoldierLosses;
    }

    events.push({
      kind: 'battle',
      islandId: targetId,
      defender: island.owner,
      defense,
      attackers: attackersReport,
      combinedForce: res.combinedForce,
      conquered: res.attackerWins && occupied,
      newOwner: res.attackerWins && occupied ? res.winnerKey : island.owner,
      defenderLosses: defenderSoldierLosses,
      destroyedBuilding: destroyed,
    });
  }

  // Îles qui changent de propriétaire ce tour : elles ne produisent rien avant le tour suivant.
  const conquered = new Set<IslandId>();
  for (const b of battleResults) {
    const island = state.islands[b.islandId]!;
    if (island.owner !== b.newOwner) conquered.add(island.id);
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
    if (island.owner === null || conquered.has(island.id)) continue;
    const barracks = island.buildings.find((b) => b.type === 'barracks');
    if (barracks && barracks.builtTurn < state.turn) {
      island.soldiers += rules.barracksSoldiers;
      events.push({ kind: 'barracks', islandId: island.id, player: island.owner, soldiers: rules.barracksSoldiers });
    }
  }

  // Rapport des espions : l'île telle qu'elle est à l'aube.
  for (const sp of spies) {
    const island = state.islands[sp.islandId]!;
    events.push({
      kind: 'spied', player: sp.player, islandId: island.id, owner: island.owner, soldiers: island.soldiers,
      defense: defenseOf(island, rules), buildings: island.buildings.map((b) => b.type),
    });
    (state.spied[sp.player] ??= []).push(island.id);
  }

  for (const pid of playerIds) {
    const player = state.players[pid]!;
    if (player.eliminated) continue;
    const income = incomeOf(state, pid, conquered, rules);
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

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Coefficient appliqué aux revenus d'un joueur selon son nombre d'îles (1 = revenus pleins). */
export function incomeFactor(islandCount: number, rules: Rules = DEFAULT_RULES): number {
  if (!rules.incomeDecay) return 1;
  const { threshold, rate } = rules.incomeDecay;
  return 1 / (1 + rate * Math.max(0, islandCount - threshold));
}

export function incomeOf(
  state: GameState,
  playerId: PlayerId,
  skip?: ReadonlySet<IslandId>,
  rules: Rules = DEFAULT_RULES,
): Resources {
  let gold = 0;
  let wood = 0;
  const islands = islandsOf(state, playerId);
  for (const island of islands) {
    if (skip?.has(island.id)) continue;
    gold += island.goldSymbol ? rules.symbolIncome : rules.baseIncome;
    wood += island.woodSymbol ? rules.symbolIncome : rules.baseIncome;
    if (hasBuilding(island, 'mine')) gold += rules.mineGold;
    if (hasBuilding(island, 'sawmill')) wood += rules.sawmillWood;
  }
  const factor = incomeFactor(islands.length, rules);
  if (factor < 1) return { gold: Math.round(gold * factor), wood: Math.round(wood * factor) };
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
