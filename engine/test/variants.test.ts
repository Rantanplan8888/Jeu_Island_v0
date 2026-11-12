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

describe('règles d\'équilibrage et variantes', () => {
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

  // Règles d'avant l'équilibrage, pour comparer.
  const old = makeRules({ occupationRequiresSoldier: false, mercenariesPerSoldier: null, attackerTieBreak: 'playerId' });

  it('occupation : des mercenaires seuls tuent les défenseurs sans prendre l\'île', () => {
    const s = game([capital('CA', 0, 0, 'A'), island('N', 1, 0, { soldiers: 2 }), capital('CB', 5, 0, 'B')]);
    const orders = { A: { attacks: [{ from: 'CA', to: 'N', soldiers: 0, mercenaries: 1 }] } };
    expect(resolveTurn(s, orders, old).state.islands.N!.owner).toBe('A');
    const { state, events } = resolveTurn(s, orders, makeRules({ mercenariesPerSoldier: null }));
    expect(state.islands.N!.owner).toBe(null);
    expect(state.islands.N!.soldiers).toBe(0);
    expect(events.some((e) => e.kind === 'battle' && !e.conquered)).toBe(true);
  });

  it('occupation : si tous les soldats meurent, l\'île ne change pas de main', () => {
    const s = game([capital('CA', 0, 0, 'A'), capital('CB', 1, 0, 'B')]);
    s.islands.CB!.soldiers = 1; // défense 1 + 3 (mur) = 4
    // 1 soldat + 1 mercenaire = 4 : insuffisant ; 2 + 1 = 5 : victoire, pertes 4, il reste 1 soldat
    const win = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'CB', soldiers: 2, mercenaries: 1 }] } });
    expect(win.state.islands.CB!.owner).toBe('A');
    expect(win.state.islands.CB!.soldiers).toBe(1);
  });

  it('pas plus de mercenaires que de soldats dans une attaque', () => {
    const s = game([capital('CA', 0, 0, 'A'), island('N', 1, 0, { soldiers: 5 }), capital('CB', 5, 0, 'B')]);
    s.players.A!.resources.gold = 10;
    const tooMany = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'N', soldiers: 1, mercenaries: 2 }] } });
    expect(tooMany.events.some((e) => e.kind === 'order_rejected')).toBe(true);
    expect(tooMany.state.islands.N!.owner).toBe(null);
    expect(tooMany.state.players.A!.resources.gold).toBe(10 + 3);
    const ok = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'N', soldiers: 2, mercenaries: 2 }] } });
    expect(ok.state.islands.N!.owner).toBe('A');
  });

  it('égalité entre attaquants : le défenseur garde l\'île', () => {
    const s = game([capital('CA', 0, 0, 'A'), island('N', 1, 0, { soldiers: 1 }), capital('CB', 2, 0, 'B')]);
    const attack = (from: string) => ({ attacks: [{ from, to: 'N', soldiers: 3, mercenaries: 0 }] });
    const { state, events } = resolveTurn(s, { A: attack('CA'), B: attack('CB') });
    expect(state.islands.N!.owner).toBe(null);
    expect(state.islands.N!.soldiers).toBe(0); // force combinée 4 contre 1 : les défenseurs meurent aussi
    expect(state.islands.CA!.soldiers).toBe(0);
    expect(state.islands.CB!.soldiers).toBe(0);
    const battle = events.find((e) => e.kind === 'battle');
    expect(battle && battle.kind === 'battle' && battle.conquered).toBe(false);
    // Sans égalité, le plus fort prend l'île.
    s.islands.CA!.soldiers = 4;
    const r = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'N', soldiers: 4, mercenaries: 0 }] }, B: attack('CB') });
    expect(r.state.islands.N!.owner).toBe('A');
  });

  it('égalité entre attaquants : tirage au sort plutôt que l\'identifiant', () => {
    let winsB = 0;
    for (let turn = 1; turn <= 40; turn++) {
      const s = game([capital('CA', 0, 0, 'A'), island('N', 1, 0, { soldiers: 1 }), capital('CB', 2, 0, 'B')]);
      s.turn = turn;
      const attack = (from: string) => ({ attacks: [{ from, to: 'N', soldiers: 3, mercenaries: 0 }] });
      const byId = resolveTurn(s, { A: attack('CA'), B: attack('CB') }, old);
      expect(byId.state.islands.N!.owner).toBe('A');
      const drawn = resolveTurn(s, { A: attack('CA'), B: attack('CB') }, makeRules({ attackerTieBreak: 'draw' }));
      if (drawn.state.islands.N!.owner === 'B') winsB++;
    }
    expect(winsB).toBeGreaterThan(5);
    expect(winsB).toBeLessThan(35);
  });
});
