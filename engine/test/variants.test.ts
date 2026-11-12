import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, createGame, makeRules, resolveTurn, type GameState, type Island } from '../src/index.ts';

function island(id: string, q: number, r: number, extra: Partial<Island> = {}): Island {
  return {
    id, q, r, owner: null, soldiers: 0, woodSymbol: false, goldSymbol: false,
    isCapital: false, startingCapital: false, buildings: [], ...extra,
  };
}

function capital(id: string, q: number, r: number, owner: string): Island {
  return island(id, q, r, { owner, soldiers: 3, woodSymbol: true, goldSymbol: true, isCapital: true, startingCapital: true });
}

function game(islands: Island[], players = ['A', 'B']): GameState {
  return {
    turn: 1,
    maxTurns: 30,
    players: Object.fromEntries(players.map((p) => [p, { id: p, name: p, resources: { gold: 3, wood: 3 }, eliminated: false }])),
    islands: Object.fromEntries(islands.map((i) => [i.id, i])),
    winner: null,
    finished: false,
  };
}

describe('variantes de règles (simulations)', () => {
  it('les règles par défaut ne changent rien au comportement', () => {
    const players = [1, 2, 3, 4].map((i) => ({ id: `P${i}`, name: `J${i}` }));
    expect(createGame({ players, seed: 7, rules: DEFAULT_RULES })).toEqual(createGame({ players, seed: 7 }));
  });

  it('un mercenaire plus cher coûte plus d\'or', () => {
    const s = game([capital('CA', 0, 0, 'A'), island('N', 1, 0, { soldiers: 2 }), capital('CB', 5, 0, 'B')]);
    const rules = makeRules({ mercenaryCost: { gold: 3, wood: 0 } });
    const { state } = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'N', soldiers: 1, mercenaries: 1 }] } }, rules);
    expect(state.islands.N!.owner).toBe('A');
    expect(state.players.A!.resources.gold).toBe(0 + 3);
  });

  it('occupation : des mercenaires seuls tuent les défenseurs sans prendre l\'île', () => {
    const s = game([capital('CA', 0, 0, 'A'), island('N', 1, 0, { soldiers: 2 }), capital('CB', 5, 0, 'B')]);
    const orders = { A: { attacks: [{ from: 'CA', to: 'N', soldiers: 0, mercenaries: 1 }] } };
    expect(resolveTurn(s, orders).state.islands.N!.owner).toBe('A');
    const { state, events } = resolveTurn(s, orders, makeRules({ occupationRequiresSoldier: true }));
    expect(state.islands.N!.owner).toBe(null);
    expect(state.islands.N!.soldiers).toBe(0);
    expect(events.some((e) => e.kind === 'battle' && !e.conquered)).toBe(true);
  });

  it('égalité entre attaquants : tirage au sort plutôt que l\'identifiant', () => {
    let winsB = 0;
    for (let turn = 1; turn <= 40; turn++) {
      const s = game([capital('CA', 0, 0, 'A'), island('N', 1, 0, { soldiers: 1 }), capital('CB', 2, 0, 'B')]);
      s.turn = turn;
      const attack = (from: string) => ({ attacks: [{ from, to: 'N', soldiers: 3, mercenaries: 0 }] });
      const byId = resolveTurn(s, { A: attack('CA'), B: attack('CB') });
      expect(byId.state.islands.N!.owner).toBe('A');
      const drawn = resolveTurn(s, { A: attack('CA'), B: attack('CB') }, makeRules({ attackerTieBreak: 'draw' }));
      if (drawn.state.islands.N!.owner === 'B') winsB++;
    }
    expect(winsB).toBeGreaterThan(5);
    expect(winsB).toBeLessThan(35);
  });
});
