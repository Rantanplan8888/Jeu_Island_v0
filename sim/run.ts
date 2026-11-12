/**
 * Simulation de parties complètes entre bots.
 *
 *   node --experimental-strip-types sim/run.ts [parties] [scénario]
 *
 * Mesures : taux de victoire par stratégie, durée des parties, îles en fin de partie,
 * avantage de position, ordres rejetés (pour repérer les bugs des bots).
 */
import { createGame, makeRules, resolveTurn, rng, type GameState, type PlayerOrders, type Rules } from '../engine/src/index.ts';
import { decide, STRATEGIES, type Strategy } from './bots.ts';

export interface GameRecord {
  seed: number;
  strategies: string[]; // par siège
  winner: number | null; // index du siège
  turns: number;
  islands: number[];
  eliminatedAt: (number | null)[];
  rejected: number;
  /** Tour auquel le futur vainqueur a pris la tête pour de bon (en nombre d'îles). */
  leadFrom: number;
  /** Îles au tour 10 par siège (pour mesurer l'effet boule de neige). */
  islandsAt10: number[];
}

export function playGame(seed: number, strategies: Strategy[], rules: Rules, maxTurns = rules.maxTurns): GameRecord {
  const players = strategies.map((_, i) => ({ id: `P${i}`, name: `J${i}` }));
  let state: GameState = createGame({ players, seed, rules, maxTurns });
  let rejected = 0;
  const eliminatedAt: (number | null)[] = strategies.map(() => null);
  const leaderByTurn: (number | null)[] = [];
  let islandsAt10: number[] = [];
  const count = (s: GameState) => players.map((p) => Object.values(s.islands).filter((i) => i.owner === p.id).length);
  while (!state.finished) {
    const orders: Record<string, PlayerOrders> = {};
    strategies.forEach((st, i) => { orders[`P${i}`] = decide(state, `P${i}`, st, rules); });
    const turn = state.turn;
    const res = resolveTurn(state, orders, rules);
    state = res.state;
    for (const e of res.events) {
      if (e.kind === 'order_rejected') rejected++;
      if (e.kind === 'eliminated') eliminatedAt[Number(e.player.slice(1))] = turn;
    }
    const c = count(state);
    if (turn === 10) islandsAt10 = c;
    const max = Math.max(...c);
    leaderByTurn.push(c.filter((x) => x === max).length === 1 ? c.indexOf(max) : null);
  }
  const winner = state.winner ? Number(state.winner.slice(1)) : null;
  let leadFrom = leaderByTurn.length;
  for (let t = leaderByTurn.length - 1; t >= 0 && leaderByTurn[t] === winner; t--) leadFrom = t + 1;
  return {
    seed, strategies: strategies.map((s) => s.name), winner, turns: state.turn - 1,
    islands: count(state), eliminatedAt, rejected, leadFrom,
    islandsAt10: islandsAt10.length ? islandsAt10 : count(state),
  };
}

export interface Summary {
  games: number;
  winRate: Record<string, number>;
  played: Record<string, number>;
  avgIslands: Record<string, number>;
  seatWinRate: number[];
  draws: number;
  avgTurns: number;
  earlyEnds: number;
  avgEliminations: number;
  avgLeadFrom: number;
  rejected: number;
  /** Écart-type des taux de victoire par stratégie (0 = parfaitement équilibré). */
  spread: number;
}

export function summarize(records: GameRecord[]): Summary {
  const wins: Record<string, number> = {};
  const played: Record<string, number> = {};
  const isl: Record<string, number> = {};
  const seatWins = [0, 0, 0, 0];
  let draws = 0; let turns = 0; let early = 0; let elim = 0; let lead = 0; let rejected = 0;
  for (const r of records) {
    r.strategies.forEach((s, i) => {
      played[s] = (played[s] ?? 0) + 1;
      isl[s] = (isl[s] ?? 0) + r.islands[i]!;
      wins[s] ??= 0;
    });
    if (r.winner === null) draws++;
    else { wins[r.strategies[r.winner]!]! += 1; seatWins[r.winner] = (seatWins[r.winner] ?? 0) + 1; }
    turns += r.turns;
    if (r.turns < 30) early++;
    elim += r.eliminatedAt.filter((x) => x !== null).length;
    lead += r.leadFrom;
    rejected += r.rejected;
  }
  const winRate: Record<string, number> = {};
  const avgIslands: Record<string, number> = {};
  for (const s of Object.keys(played)) {
    // Taux de victoire normalisé : 1 = la part attendue (1 / nombre de joueurs).
    winRate[s] = wins[s]! / played[s]!;
    avgIslands[s] = isl[s]! / played[s]!;
  }
  const rates = Object.values(winRate);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const spread = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length);
  const n = records.length;
  return {
    games: n, winRate, played, avgIslands, seatWinRate: seatWins.map((w) => w / n), draws,
    avgTurns: turns / n, earlyEnds: early / n, avgEliminations: elim / n, avgLeadFrom: lead / n, rejected, spread,
  };
}

/** Tournoi : chaque partie oppose 4 stratégies tirées au hasard (sièges mélangés). */
export function tournament(games: number, rules: Rules, names = Object.keys(STRATEGIES), seed0 = 1): GameRecord[] {
  const out: GameRecord[] = [];
  const rand = rng(seed0 * 7919);
  for (let g = 0; g < games; g++) {
    const pool = [...names];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
    const pick = pool.slice(0, 4).map((n) => STRATEGIES[n]!);
    out.push(playGame(seed0 * 100000 + g, pick, rules));
  }
  return out;
}

export function printSummary(title: string, s: Summary): void {
  const pct = (x: number) => `${(x * 100).toFixed(0)} %`;
  console.log(`\n=== ${title} (${s.games} parties) ===`);
  const rows = Object.keys(s.winRate).sort((a, b) => s.winRate[b]! - s.winRate[a]!);
  for (const k of rows) {
    console.log(`  ${(STRATEGIES[k]?.label ?? k).padEnd(18)} victoires ${pct(s.winRate[k]!).padStart(5)}   îles finales ${s.avgIslands[k]!.toFixed(1)}   (${s.played[k]} parties)`);
  }
  console.log(`  écart-type des victoires ${pct(s.spread)} · nuls ${s.draws} · durée moyenne ${s.avgTurns.toFixed(1)} tours · fins anticipées ${pct(s.earlyEnds)}`);
  console.log(`  éliminations / partie ${s.avgEliminations.toFixed(2)} · le vainqueur mène dès le tour ${s.avgLeadFrom.toFixed(1)} · victoires par siège ${s.seatWinRate.map(pct).join(' / ')} · ordres rejetés ${s.rejected}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = Number(process.argv[2] ?? 200);
  const rules = makeRules();
  const t0 = Date.now();
  const recs = tournament(games, rules);
  printSummary('Règles actuelles, tournoi mixte', summarize(recs));
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
