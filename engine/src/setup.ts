/**
 * Création d'une nouvelle partie : génération du plateau (déterministe à partir d'une graine).
 * La taille du plateau est proportionnelle au nombre de joueurs.
 */
import { hexDistance } from './board.ts';
import { DEFAULT_RULES, type Rules } from './rules.ts';
import type { BuildingType, GameState, Island } from './types.ts';

type IslandKind =
  | { kind: 'sea' }
  | { kind: 'plain' | 'wood' | 'gold' | 'both'; defense: number }
  | { kind: 'building'; building: BuildingType; defense: number };

const BUILDING_TYPES: readonly BuildingType[] = ['mine', 'sawmill', 'barracks', 'port', 'tower', 'university'];

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface NewGameOptions {
  players: { id: string; name: string }[];
  seed: number;
  maxTurns?: number;
  /** Nombre moyen de cases par joueur (îles + mer). */
  cellsPerPlayer?: number;
  /** Proportion de cases qui portent une île (hors capitales et leurs voisines). */
  islandDensity?: number;
  /** Règles de la partie (par défaut : `DEFAULT_RULES`). */
  rules?: Rules;
}

const NEIGHBORS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
] as const;

/** Nombre de plateaux tirés pour garder le plus équitable. */
const FAIRNESS_TRIES = 24;

/**
 * Crée une partie. Les capitales sont réparties à intervalles réguliers sur un anneau
 * autour du centre (jusqu'à 8 joueurs) ; parmi plusieurs plateaux tirés à partir de la
 * graine, on garde celui où les îles libres sont le mieux réparties entre les capitales.
 */
export function createGame(opts: NewGameOptions): GameState {
  if (opts.players.length < 2) throw new Error('Il faut au moins 2 joueurs.');
  const seeds = rng(opts.seed);
  let best: GameState | null = null;
  let bestScore = Infinity;
  for (let t = 0; t < FAIRNESS_TRIES; t++) {
    const game = generate(opts, rng(Math.floor(seeds() * 2 ** 32)));
    const score = unfairness(game);
    if (score < bestScore) { best = game; bestScore = score; }
  }
  return best!;
}

/**
 * Déséquilibre d'un plateau entre les joueurs (0 = parfaitement équitable) :
 * écart relatif des richesses proches de chaque capitale, plus l'écart des distances
 * à la capitale adverse la plus proche.
 */
export function unfairness(game: GameState): number {
  const islands = Object.values(game.islands);
  const capitals = islands.filter((i) => i.isCapital);
  const wealth = capitals.map(() => 0);
  for (const i of islands) {
    if (i.isCapital) continue;
    const d = capitals.map((c) => hexDistance(c, i));
    const m = Math.min(...d);
    const nearest = d.flatMap((x, k) => (x === m ? [k] : []));
    const value = ((i.goldSymbol ? 3 : 1) + (i.woodSymbol ? 3 : 1) + i.buildings.length * 2) / (1 + m);
    for (const k of nearest) wealth[k]! += value / nearest.length;
  }
  const spacing = capitals.map((c) => Math.min(...capitals.filter((x) => x !== c).map((x) => hexDistance(c, x))));
  const mean = wealth.reduce((a, b) => a + b, 0) / wealth.length || 1;
  return (Math.max(...wealth) - Math.min(...wealth)) / mean + 0.25 * (Math.max(...spacing) - Math.min(...spacing));
}

/** Cases d'un anneau hexagonal de rayon r autour du centre, dans l'ordre. */
function ring(r: number): { q: number; r: number }[] {
  const out: { q: number; r: number }[] = [];
  let c = { q: -r, r: r }; // direction (-1, +1) multipliée par r
  for (const [dq, dr] of NEIGHBORS) {
    for (let k = 0; k < r; k++) {
      out.push(c);
      c = { q: c.q + dq, r: c.r + dr };
    }
  }
  return out;
}

function generate(opts: NewGameOptions, random: () => number): GameState {
  const n = opts.players.length;
  const cellsPerPlayer = opts.cellsPerPlayer ?? 12;
  const density = opts.islandDensity ?? 0.6;
  const rules = opts.rules ?? DEFAULT_RULES;
  const { plainDefenses, bonusDefenses, bothDefenses, buildingDefenses } = rules;

  // Disque hexagonal de rayon R contenant au moins n * cellsPerPlayer cases.
  let R = 1;
  while (3 * R * (R + 1) + 1 < n * cellsPerPlayer) R++;
  const cells: { q: number; r: number }[] = [];
  for (let q = -R; q <= R; q++) {
    for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) cells.push({ q, r });
  }
  const key = (c: { q: number; r: number }) => `${c.q},${c.r}`;

  // Capitales : à intervalles réguliers sur un anneau (même distance au centre et entre voisines).
  // Au-delà de 8 joueurs, échantillonnage par point le plus éloigné, loin du bord si possible.
  const inner = cells.filter((c) => hexDistance(c, { q: 0, r: 0 }) <= R - 1);
  const pool = inner.length >= n ? inner : cells;
  const capitals: { q: number; r: number }[] = [];
  if (n <= 8 && R >= 2) {
    const around = ring(R - 1);
    const offset = Math.floor(random() * around.length);
    for (let k = 0; k < n; k++) capitals.push(around[(offset + Math.round((k * around.length) / n)) % around.length]!);
  } else {
    capitals.push(pool[Math.floor(random() * pool.length)]!);
    while (capitals.length < n) {
      let best = pool[0]!;
      let bestD = -1;
      for (const c of pool) {
        const d = Math.min(...capitals.map((k) => hexDistance(c, k)));
        if (d > bestD || (d === bestD && random() < 0.5)) { best = c; bestD = d; }
      }
      capitals.push(best);
    }
  }
  const capitalKeys = new Set(capitals.map(key));

  // Autour de chaque capitale : 5 îles voisines sur 6 cases, toujours les mêmes types
  // (îles simples de défense 2, 3 et 4, une île bois et une île or de défense 5 ou 6).
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;
  const shuffle = <T,>(xs: T[]): T[] => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [xs[i], xs[j]] = [xs[j]!, xs[i]!];
    }
    return xs;
  };
  const inBoard = new Set(cells.map(key));
  const planned = new Map<string, IslandKind>();
  for (const c of capitals) {
    const around = shuffle(NEIGHBORS.map(([dq, dr]) => ({ q: c.q + dq, r: c.r + dr })))
      .filter((x) => inBoard.has(key(x)) && !capitalKeys.has(key(x)));
    const kinds: IslandKind[] = shuffle([
      ...plainDefenses.map((defense) => ({ kind: 'plain' as const, defense })),
      { kind: 'wood', defense: pick(bonusDefenses) }, { kind: 'gold', defense: pick(bonusDefenses) },
    ]);
    // Les 5 îles prennent 5 des 6 cases ; la dernière reste de la mer.
    for (const cell of around.slice(0, 5)) {
      const k = key(cell);
      if (planned.has(k)) continue; // case déjà prévue par une capitale voisine
      planned.set(k, kinds.pop() ?? { kind: 'plain', defense: pick(plainDefenses) });
    }
    for (const cell of around.slice(5)) if (!planned.has(key(cell))) planned.set(key(cell), { kind: 'sea' });
  }

  const islands: Record<string, Island> = {};
  let counter = 0;
  for (const c of cells) {
    const k = key(c);
    if (capitalKeys.has(k)) {
      const id = `I${++counter}`;
      const player = opts.players[capitals.findIndex((x) => key(x) === k)]!;
      islands[id] = {
        id, q: c.q, r: c.r, owner: player.id, soldiers: rules.startingSoldiers,
        woodSymbol: true, goldSymbol: true, isCapital: true, startingCapital: true, buildings: [],
      };
      continue;
    }
    const dCap = Math.min(...capitals.map((x) => hexDistance(c, x)));
    const kind = planned.get(k) ?? (random() > density ? { kind: 'sea' as const } : randomKind(dCap));
    if (kind.kind === 'sea') continue;
    const id = `I${++counter}`;
    const buildings: Island['buildings'] = kind.kind === 'building' ? [{ type: kind.building, builtTurn: 0 }] : [];
    // La défense annoncée inclut la tour éventuelle (+3).
    const soldiers = kind.defense - (kind.kind === 'building' && kind.building === 'tower' ? rules.towerDefense : 0);
    islands[id] = {
      id, q: c.q, r: c.r, owner: null, soldiers: Math.max(1, soldiers),
      woodSymbol: kind.kind === 'wood' || kind.kind === 'both',
      goldSymbol: kind.kind === 'gold' || kind.kind === 'both',
      isCapital: false, startingCapital: false, buildings,
    };
  }

  /** Île du reste de la carte : 10 % avec bâtiment, 35 % avec un symbole, 5 % avec les deux (loin des capitales). */
  function randomKind(dCap: number): IslandKind {
    const roll = random();
    if (roll < 0.05 && dCap >= 3) return { kind: 'both', defense: pick(bothDefenses) };
    if (roll < 0.15 && dCap >= 2) return { kind: 'building', building: pick(BUILDING_TYPES), defense: pick(buildingDefenses) };
    if (roll < 0.325) return { kind: 'wood', defense: pick(bonusDefenses) };
    if (roll < 0.5) return { kind: 'gold', defense: pick(bonusDefenses) };
    return { kind: 'plain', defense: pick(plainDefenses) };
  }

  return {
    turn: 1,
    maxTurns: opts.maxTurns ?? rules.maxTurns,
    players: Object.fromEntries(
      opts.players.map((p) => [p.id, { id: p.id, name: p.name, resources: { ...rules.startingResources }, eliminated: false }]),
    ),
    islands,
    winner: null,
    finished: false,
  };
}
