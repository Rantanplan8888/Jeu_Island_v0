/**
 * Joueurs fictifs (bots) pour les simulations d'équilibrage.
 *
 * Tous les bots partagent la même mécanique (évaluer les menaces, chercher les attaques
 * les moins chères, construire, recruter) ; une stratégie n'est qu'un jeu de réglages.
 * Les bots voient tout l'état de la partie (information publique dans Island).
 */
import {
  attackCost, defenseOf, fortification, hasBuilding, hexDistance, incomeOf,
  type AttackOrder, type BuildingType, type GameState, type Island, type PlayerId,
  type PlayerOrders, type Resources, type Rules,
} from '../engine/src/index.ts';

export interface Strategy {
  name: string;
  label: string;
  /** Bâtiments voulus, par ordre de priorité (une seule fois par île). */
  buildOrder: { building: BuildingType; where: 'all' | 'capital' | 'frontier' | 'rich'; fromTurn?: number }[];
  /** Part du bois réservée aux bâtiments avant de recruter des soldats. */
  buildFirst: boolean;
  /** Proportion de la menace adverse qu'on veut couvrir sur ses îles (0 = aucune défense). */
  defenseWeight: number;
  /** Multiplicateur de valeur pour une île adverse (par rapport à une neutre). */
  enemyTargetWeight: number;
  /** Multiplicateur de valeur pour une île neutre. */
  neutralTargetWeight: number;
  /** Nombre minimal de soldats à laisser sur une île conquise (si possible). */
  garrison: number;
  /** Rentabilité minimale (valeur / coût) pour lancer une attaque. */
  minRatio: number;
  /** Tours avant la fin à partir desquels on garde son or (0 = jamais). */
  hoardTurns: number;
  /** Raid final : au dernier tour, tout l'or part en mercenaires, sans garnison. */
  finalBlitz: boolean;
  /** Tour à partir duquel on commence à attaquer. */
  attackFromTurn: number;
  /** Utiliser les mercenaires (sinon soldats seuls). */
  useMercenaries: boolean;
}

const base: Strategy = {
  name: 'base',
  label: 'Base',
  buildOrder: [],
  buildFirst: false,
  defenseWeight: 0.3,
  enemyTargetWeight: 1,
  neutralTargetWeight: 1,
  garrison: 1,
  minRatio: 0,
  hoardTurns: 0,
  finalBlitz: false,
  attackFromTurn: 1,
  useMercenaries: true,
};

export const STRATEGIES: Record<string, Strategy> = {
  colon: {
    ...base, name: 'colon', label: 'Colon',
    buildOrder: [{ building: 'mine', where: 'capital' }],
    defenseWeight: 0.15, enemyTargetWeight: 0.8, neutralTargetWeight: 1.3, garrison: 1,
  },
  batisseur: {
    ...base, name: 'batisseur', label: 'Bâtisseur',
    buildOrder: [{ building: 'mine', where: 'all' }, { building: 'sawmill', where: 'rich' }],
    buildFirst: true, defenseWeight: 0.3, attackFromTurn: 4,
  },
  pillard: {
    ...base, name: 'pillard', label: 'Pillard',
    buildOrder: [{ building: 'mine', where: 'capital' }],
    defenseWeight: 0.2, enemyTargetWeight: 2.2, neutralTargetWeight: 0.8, garrison: 1,
  },
  tortue: {
    ...base, name: 'tortue', label: 'Tortue',
    buildOrder: [
      { building: 'tower', where: 'capital' }, { building: 'mine', where: 'all' },
      { building: 'barracks', where: 'capital' }, { building: 'tower', where: 'frontier', fromTurn: 5 },
    ],
    buildFirst: true, defenseWeight: 0.9, enemyTargetWeight: 0.7, garrison: 2, minRatio: 0.25,
  },
  sprint: {
    ...base, name: 'sprint', label: 'Sprint final',
    buildOrder: [{ building: 'mine', where: 'all' }],
    buildFirst: true, defenseWeight: 0.3, hoardTurns: 4, finalBlitz: true,
  },
  equilibre: {
    ...base, name: 'equilibre', label: 'Équilibré',
    buildOrder: [{ building: 'mine', where: 'capital' }, { building: 'mine', where: 'rich' }, { building: 'tower', where: 'capital', fromTurn: 8 }],
    defenseWeight: 0.4, enemyTargetWeight: 1.3, finalBlitz: true,
  },
  soldats: {
    ...base, name: 'soldats', label: 'Sans mercenaires',
    buildOrder: [{ building: 'mine', where: 'capital' }, { building: 'barracks', where: 'capital' }],
    useMercenaries: false, defenseWeight: 0.4,
  },
};

interface Ctx {
  state: GameState;
  me: PlayerId;
  rules: Rules;
  budget: Resources;
  mine: Island[];
  /** Soldats encore disponibles sur chaque île (après réserves et attaques déjà prévues). */
  free: Map<string, number>;
  /** Soldats à garder sur chaque île pour la défense. */
  reserve: Map<string, number>;
  lastTurn: boolean;
}

const owned = (s: GameState, p: PlayerId) => Object.values(s.islands).filter((i) => i.owner === p);

/** Valeur d'une île pour son propriétaire : revenus par tour + un point pour le score final. */
function islandValue(i: Island, rules: Rules): number {
  const g = (i.goldSymbol ? rules.symbolIncome : rules.baseIncome) + (hasBuilding(i, 'mine') ? rules.mineGold : 0);
  const w = (i.woodSymbol ? rules.symbolIncome : rules.baseIncome) + (hasBuilding(i, 'sawmill') ? rules.sawmillWood : 0);
  return g * 1.2 + w * 0.8;
}

/** Force qu'un adversaire peut lancer contre une île (soldats voisins + mercenaires achetables). */
function threatOn(ctx: Ctx, target: Island): number {
  const { state, me, rules } = ctx;
  let worst = 0;
  for (const p of Object.values(state.players)) {
    if (p.id === me || p.eliminated) continue;
    let soldiers = 0;
    let adjacent = false;
    for (const i of owned(state, p.id)) {
      const d = hexDistance(i, target);
      if (d === 1) { soldiers += i.soldiers; adjacent = true; }
      else if (d === 2) { soldiers += hasBuilding(i, 'port') ? i.soldiers : Math.min(i.soldiers, Math.floor(p.resources.gold / 2)); adjacent ||= hasBuilding(i, 'port'); }
    }
    if (soldiers === 0 && !adjacent) continue;
    const goldNextTurn = p.resources.gold; // l'or disponible au moment où il donne ses ordres
    const mercs = adjacent ? Math.floor(goldNextTurn / Math.max(1, rules.mercenaryCost.gold)) : 0;
    worst = Math.max(worst, soldiers * rules.soldierForce + mercs * rules.mercenaryForce);
  }
  return worst;
}

interface AttackPlan {
  order: AttackOrder;
  cost: Resources;
  value: number;
  ratio: number;
  survivors: number;
  /** Soldats à recruter sur l'île de départ pour cette attaque. */
  recruit: number;
}

/** Meilleure façon de prendre une île donnée (le moins d'or et de soldats perdus). */
function planAttack(ctx: Ctx, strat: Strategy, target: Island, blitz: boolean): AttackPlan | null {
  const { state, rules, budget } = ctx;
  const defense = defenseOf(target, rules);
  // Petite marge variable, comme un joueur humain qui ne calcule pas toujours au plus juste.
  const margin = jitter(`${state.turn}|${ctx.me}|${target.id}`) % 3;
  let best: AttackPlan | null = null;
  const enemy = target.owner !== null;
  const weight = enemy ? strat.enemyTargetWeight : strat.neutralTargetWeight;
  // Prendre une île adverse rapporte aussi un point de moins à l'adversaire.
  const baseValue = islandValue(target, rules) * (blitz ? 0 : 1) + (enemy ? 3 : 2) + (target.isCapital ? 4 : 0);
  const value = baseValue * weight;
  const maxMercs = strat.useMercenaries ? Math.floor(budget.gold / Math.max(1, rules.mercenaryCost.gold)) : 0;
  for (const from of ctx.mine) {
    const d = hexDistance(from, target);
    if (d < 1 || d > 2) continue;
    const free = ctx.free.get(from.id) ?? 0;
    // On peut aussi recruter sur l'île de départ : les recrues attaquent le même tour.
    const sc = rules.soldierCost;
    const recruitable = Math.floor(Math.min(sc.gold ? budget.gold / sc.gold : 99, sc.wood ? budget.wood / sc.wood : 99));
    const avail = free + recruitable;
    for (let m = 0; m <= maxMercs; m++) {
      // Le moins de soldats possible pour gagner, mais au moins la garnison voulue.
      const needForce = defense + 1 + margin - m * rules.mercenaryForce;
      let s = Math.max(0, Math.ceil(needForce / rules.soldierForce));
      // Limite de mercenaires par soldat.
      if (rules.mercenariesPerSoldier !== null) s = Math.max(s, Math.ceil(m / rules.mercenariesPerSoldier));
      if (s > avail) continue;
      const want = Math.max(blitz ? 0 : strat.garrison, rules.occupationRequiresSoldier ? 1 : 0);
      // Ajouter des soldats tant que les survivants n'atteignent pas la garnison voulue.
      for (;;) {
        const force = s * rules.soldierForce + m * rules.mercenaryForce;
        const losses = defense <= 0 ? 0 : force >= 2 * defense ? defense - 1 : defense;
        const survivors = Math.min(s, Math.floor((force - losses) / rules.soldierForce));
        if (survivors >= want || s >= avail) break;
        s++;
      }
      if (s + m === 0) continue;
      const force = s * rules.soldierForce + m * rules.mercenaryForce;
      if (force <= defense) continue;
      const ac = attackCost(state, from.id, target.id, s, m, rules);
      if (!ac) continue;
      const recruit = Math.max(0, s - free);
      const cost = { gold: ac.gold + recruit * sc.gold, wood: ac.wood + recruit * sc.wood };
      if (cost.gold > budget.gold || cost.wood > budget.wood) continue;
      const losses = defense <= 0 ? 0 : force >= 2 * defense ? defense - 1 : defense;
      const survivors = Math.min(s, Math.floor((force - losses) / rules.soldierForce));
      if (!blitz && survivors < Math.min(strat.garrison, 1) && enemy) continue;
      if (rules.occupationRequiresSoldier && survivors < 1) continue;
      const lostSoldiers = s - survivors;
      const lostOwn = Math.max(0, lostSoldiers - recruit); // les recrues perdues sont déjà dans le coût
      const price = cost.gold + cost.wood + lostOwn * (sc.gold + sc.wood) + 0.5;
      const ratio = value / price;
      if (!best || ratio > best.ratio) {
        best = {
          order: { from: from.id, to: target.id, soldiers: s, mercenaries: m, destroyBuilding: pickDestroy(target) },
          cost, value, ratio, survivors, recruit,
        };
      }
    }
  }
  return best;
}

function jitter(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pickDestroy(target: Island): BuildingType | undefined {
  for (const b of ['tower', 'barracks', 'mine', 'sawmill', 'port', 'university'] as const) if (hasBuilding(target, b)) return b;
  return undefined;
}

export function decide(state: GameState, me: PlayerId, strat: Strategy, rules: Rules): PlayerOrders {
  const player = state.players[me]!;
  const mine = owned(state, me);
  const orders: Required<PlayerOrders> = { recruits: [], builds: [], moves: [], attacks: [] };
  if (player.eliminated || mine.length === 0) return orders;
  const lastTurn = state.turn >= state.maxTurns;
  const turnsLeft = state.maxTurns - state.turn;
  const ctx: Ctx = {
    state, me, rules, budget: { ...player.resources }, mine,
    free: new Map(), reserve: new Map(), lastTurn,
  };
  const spend = (c: Resources) => { ctx.budget.gold -= c.gold; ctx.budget.wood -= c.wood; };
  const can = (c: Resources) => ctx.budget.gold >= c.gold && ctx.budget.wood >= c.wood;

  // 1. Réserves de défense (pas au dernier tour pour un raid final : la défense compte quand même).
  const threats = new Map<string, number>();
  for (const i of mine) {
    const t = threatOn(ctx, i);
    threats.set(i.id, t);
    const weight = i.isCapital ? Math.min(1, strat.defenseWeight * 1.5) : strat.defenseWeight;
    const needForce = Math.max(0, Math.ceil(t * weight) - fortification(i, rules));
    ctx.reserve.set(i.id, Math.ceil(needForce / rules.soldierForce));
  }

  // 2. Constructions (avant les soldats si la stratégie le veut)
  const doBuilds = () => {
    if (lastTurn || turnsLeft < 3) return; // un bâtiment construit à la fin ne rapporte plus rien
    for (const step of strat.buildOrder) {
      if (step.fromTurn && state.turn < step.fromTurn) continue;
      const cost = rules.buildings[step.building].cost;
      let where = mine.filter((i) => !hasBuilding(i, step.building) && !orders.builds.some((b) => b.islandId === i.id && b.building === step.building));
      if (step.where === 'capital') where = where.filter((i) => i.isCapital);
      if (step.where === 'rich') where = where.filter((i) => i.isCapital || i.goldSymbol || i.woodSymbol);
      if (step.where === 'frontier') where = where.filter((i) => (threats.get(i.id) ?? 0) > 0);
      // Les îles les plus sûres et les plus riches d'abord.
      where.sort((a, b) => (threats.get(a.id)! - threats.get(b.id)!) || islandValue(b, rules) - islandValue(a, rules));
      for (const i of where) {
        if (!can(cost)) break;
        // Éviter de construire sur une île qui va probablement tomber.
        if (!i.isCapital && (threats.get(i.id) ?? 0) > defenseOf(i, rules) + 2 && step.building !== 'tower') continue;
        orders.builds.push({ islandId: i.id, building: step.building });
        spend(cost);
      }
    }
  };

  const hoarding = strat.hoardTurns > 0 && turnsLeft > 0 && turnsLeft < strat.hoardTurns;
  if (strat.buildFirst) doBuilds();

  // 3. Recrutement pour la défense (sur les îles menacées, les plus précieuses d'abord)
  const recruitCost = rules.soldierCost;
  const byPriority = [...mine].sort((a, b) => (b.isCapital ? 100 : 0) + islandValue(b, rules) - (a.isCapital ? 100 : 0) - islandValue(a, rules));
  const extra = new Map<string, number>();
  for (const i of byPriority) {
    const missing = (ctx.reserve.get(i.id) ?? 0) - i.soldiers;
    let n = 0;
    while (n < missing && can(recruitCost) && !(hoarding && ctx.budget.gold <= recruitCost.gold * 4)) { spend(recruitCost); n++; }
    if (n > 0) { orders.recruits.push({ islandId: i.id, soldiers: n }); extra.set(i.id, n); }
  }

  if (!strat.buildFirst) doBuilds();

  // Soldats libres pour attaquer : présents au début du tour + recrues, moins la réserve.
  for (const i of mine) {
    const total = i.soldiers + (extra.get(i.id) ?? 0);
    const keep = lastTurn && strat.finalBlitz ? Math.min(total, ctx.reserve.get(i.id) ?? 0) : (ctx.reserve.get(i.id) ?? 0);
    ctx.free.set(i.id, Math.max(0, total - keep));
  }

  // 4. Attaques : on prend à chaque fois la cible la plus rentable.
  const blitz = lastTurn && strat.finalBlitz;
  if (state.turn >= strat.attackFromTurn && !hoarding) {
    const targeted = new Set<string>();
    for (let guard = 0; guard < 40; guard++) {
      const candidates = Object.values(state.islands).filter((i) => i.owner !== me && !targeted.has(i.id)
        && mine.some((m) => hexDistance(m, i) <= 2));
      let best: AttackPlan | null = null;
      for (const t of candidates) {
        const p = planAttack(ctx, strat, t, blitz);
        if (p && (!best || p.ratio > best.ratio)) best = p;
      }
      if (!best || best.ratio < strat.minRatio) break;
      orders.attacks.push(best.order);
      spend(best.cost);
      targeted.add(best.order.to);
      if (best.recruit > 0) {
        const r = orders.recruits.find((x) => x.islandId === best!.order.from);
        if (r) r.soldiers += best.recruit; else orders.recruits.push({ islandId: best.order.from, soldiers: best.recruit });
      }
      ctx.free.set(best.order.from, (ctx.free.get(best.order.from) ?? 0) + best.recruit - best.order.soldiers);
    }
  }

  // 5. Bois en trop : des mines sur les îles sûres (le bois ne sert sinon qu'aux soldats).
  if (!lastTurn && turnsLeft >= 3) {
    const mineCost = rules.buildings.mine.cost;
    const safe = mine.filter((i) => !hasBuilding(i, 'mine') && !orders.builds.some((b) => b.islandId === i.id && b.building === 'mine'))
      .sort((a, b) => threats.get(a.id)! - threats.get(b.id)!);
    for (const i of safe) {
      if (ctx.budget.wood < mineCost.wood + Math.max(4, ctx.budget.gold) || !can(mineCost)) break;
      orders.builds.push({ islandId: i.id, building: 'mine' });
      spend(mineCost);
    }
  }

  // 6. Déplacements : les soldats des îles de l'arrière vont vers le front.
  const others = Object.values(state.islands).filter((i) => i.owner !== me);
  const frontDist = (i: Island) => Math.min(...others.map((o) => hexDistance(o, i)));
  for (const i of mine) {
    const free = ctx.free.get(i.id) ?? 0;
    if (free <= 0 || frontDist(i) <= 2) continue;
    const dest = mine.filter((j) => hexDistance(i, j) === 1).sort((a, b) => frontDist(a) - frontDist(b))[0];
    if (!dest || frontDist(dest) >= frontDist(i)) continue;
    orders.moves.push({ from: i.id, to: dest.id, soldiers: free });
  }

  // Les recrutements sont résolus avant les constructions par le moteur : vérifier que le total tient.
  return orders;
}

/** Revenu courant d'un joueur, pour les statistiques. */
export function incomeNow(state: GameState, p: PlayerId, rules: Rules): Resources {
  return incomeOf(state, p, undefined, rules);
}
