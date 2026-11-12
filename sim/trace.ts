/** Déroulé d'une partie, tour par tour : node --experimental-strip-types sim/trace.ts seed strat1 strat2 strat3 strat4 */
import { createGame, makeRules, resolveTurn, type GameState, type PlayerOrders } from '../engine/src/index.ts';
import { decide, STRATEGIES } from './bots.ts';
const [seedArg, ...names] = process.argv.slice(2);
const strats = (names.length ? names : ['colon', 'batisseur', 'pillard', 'sprint']).map((n) => STRATEGIES[n]!);
const rules = makeRules();
let state: GameState = createGame({ players: strats.map((_, i) => ({ id: `P${i}`, name: strats[i]!.label })), seed: Number(seedArg ?? 1), rules });
while (!state.finished) {
  const orders: Record<string, PlayerOrders> = {};
  strats.forEach((s, i) => { orders[`P${i}`] = decide(state, `P${i}`, s, rules); });
  const t = state.turn;
  const res = resolveTurn(state, orders, rules);
  const line = strats.map((s, i) => {
    const isl = Object.values(res.state.islands).filter((x) => x.owner === `P${i}`);
    const o = orders[`P${i}`]!;
    const r = res.state.players[`P${i}`]!.resources;
    const sold = isl.reduce((a, x) => a + x.soldiers, 0);
    const mines = isl.filter((x) => x.buildings.some((b) => b.type === 'mine')).length;
    return `${s.name.slice(0, 6)} ${String(isl.length).padStart(2)}î ${String(sold).padStart(3)}s ${mines}m ${String(r.gold).padStart(3)}o/${String(r.wood).padStart(3)}b a${o.attacks?.length ?? 0}`;
  }).join(' | ');
  const battles = res.events.filter((e) => e.kind === 'battle');
  const pvp = battles.filter((e) => e.kind === 'battle' && e.defender !== null).length;
  console.log(`T${String(t).padStart(2)} ${line} | combats ${battles.length} (${pvp} JcJ)`);
  state = res.state;
}
console.log('Vainqueur', state.winner, strats[Number(state.winner?.slice(1))]?.label);
