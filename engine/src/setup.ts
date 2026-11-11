/**
 * Création d'une nouvelle partie : génération du plateau (déterministe à partir d'une graine).
 * La taille du plateau est proportionnelle au nombre de joueurs.
 */
import { hexDistance } from './board.ts';
import { DEFAULT_MAX_TURNS, STARTING_RESOURCES, STARTING_SOLDIERS } from './rules.ts';
import type { GameState, Island } from './types.ts';

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
}

const NEIGHBORS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
] as const;

export function createGame(opts: NewGameOptions): GameState {
  const n = opts.players.length;
  if (n < 2) throw new Error('Il faut au moins 2 joueurs.');
  const random = rng(opts.seed);
  const cellsPerPlayer = opts.cellsPerPlayer ?? 12;
  const density = opts.islandDensity ?? 0.6;

  // Disque hexagonal de rayon R contenant au moins n * cellsPerPlayer cases.
  let R = 1;
  while (3 * R * (R + 1) + 1 < n * cellsPerPlayer) R++;
  const cells: { q: number; r: number }[] = [];
  for (let q = -R; q <= R; q++) {
    for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) cells.push({ q, r });
  }
  const key = (c: { q: number; r: number }) => `${c.q},${c.r}`;

  // Capitales : échantillonnage par point le plus éloigné, loin du bord si possible.
  const inner = cells.filter((c) => hexDistance(c, { q: 0, r: 0 }) <= R - 1);
  const pool = inner.length >= n ? inner : cells;
  const capitals: { q: number; r: number }[] = [pool[Math.floor(random() * pool.length)]!];
  while (capitals.length < n) {
    let best = pool[0]!;
    let bestD = -1;
    for (const c of pool) {
      const d = Math.min(...capitals.map((k) => hexDistance(c, k)));
      if (d > bestD || (d === bestD && random() < 0.5)) { best = c; bestD = d; }
    }
    capitals.push(best);
  }
  const capitalKeys = new Set(capitals.map(key));

  // Îles : toujours sur les cases voisines des capitales, aléatoirement ailleurs.
  const nearCapital = new Set<string>();
  for (const c of capitals) for (const [dq, dr] of NEIGHBORS) nearCapital.add(key({ q: c.q + dq, r: c.r + dr }));

  const islands: Record<string, Island> = {};
  let counter = 0;
  for (const c of cells) {
    const k = key(c);
    const isCap = capitalKeys.has(k);
    if (!isCap && !nearCapital.has(k) && random() > density) continue;
    const id = `I${++counter}`;
    if (isCap) {
      const player = opts.players[capitals.findIndex((x) => key(x) === k)]!;
      islands[id] = {
        id, q: c.q, r: c.r, owner: player.id, soldiers: STARTING_SOLDIERS,
        woodSymbol: true, goldSymbol: true, isCapital: true, startingCapital: true, buildings: [],
      };
      continue;
    }
    const dCap = Math.min(...capitals.map((x) => hexDistance(c, x)));
    const roll = random();
    const both = roll < 0.05;
    const woodSymbol = both || (roll >= 0.05 && roll < 0.25);
    const goldSymbol = both || (roll >= 0.25 && roll < 0.45);
    let soldiers = Math.min(5, dCap) + Math.floor(random() * 2);
    if (woodSymbol || goldSymbol) soldiers += 1;
    if (both) soldiers += 2;
    const buildings: Island['buildings'] = [];
    if (dCap >= 2 && random() < 0.1) {
      const types = ['mine', 'sawmill', 'barracks', 'port', 'tower', 'university'] as const;
      buildings.push({ type: types[Math.floor(random() * types.length)]!, builtTurn: 0 });
    }
    islands[id] = {
      id, q: c.q, r: c.r, owner: null, soldiers: Math.max(1, soldiers),
      woodSymbol, goldSymbol, isCapital: false, startingCapital: false, buildings,
    };
  }

  return {
    turn: 1,
    maxTurns: opts.maxTurns ?? DEFAULT_MAX_TURNS,
    players: Object.fromEntries(
      opts.players.map((p) => [p.id, { id: p.id, name: p.name, resources: { ...STARTING_RESOURCES }, eliminated: false }]),
    ),
    islands,
    winner: null,
    finished: false,
  };
}
