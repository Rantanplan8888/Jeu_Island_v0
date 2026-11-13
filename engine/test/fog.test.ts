import { describe, expect, it } from 'vitest';
import { createGame, eventsFor, makeRules, resolveTurn, viewFor, visibility, type GameState, type Island } from '../src/index.ts';

function island(id: string, q: number, r: number, extra: Partial<Island> = {}): Island {
  return {
    id, q, r, owner: null, soldiers: 2, woodSymbol: false, goldSymbol: false,
    isCapital: false, startingCapital: false, buildings: [], ...extra,
  };
}

// A en (0,0) ; îles à 1, 2 et 3 cases ; B loin.
function game(): GameState {
  const islands = [
    island('CA', 0, 0, { owner: 'A', soldiers: 3, isCapital: true, startingCapital: true, woodSymbol: true, goldSymbol: true }),
    island('N1', 1, 0, { buildings: [{ type: 'tower', builtTurn: 0 }] }),
    island('N2', 2, 0, { owner: 'B', soldiers: 5, goldSymbol: true, buildings: [{ type: 'mine', builtTurn: 0 }] }),
    island('N3', 3, 0),
    island('CB', 6, 0, { owner: 'B', soldiers: 3, isCapital: true, startingCapital: true, woodSymbol: true, goldSymbol: true }),
  ];
  return {
    turn: 1, maxTurns: 30, winner: null, finished: false,
    players: { A: { id: 'A', name: 'A', resources: { gold: 3, wood: 3 }, eliminated: false }, B: { id: 'B', name: 'B', resources: { gold: 9, wood: 4 }, eliminated: false } },
    islands: Object.fromEntries(islands.map((i) => [i.id, i])),
  };
}

describe('brouillard de guerre', () => {
  it('voit tout à 1 case, l\'île sans défense ni bâtiments à 2 cases, seulement le propriétaire au-delà', () => {
    const v = viewFor(game(), 'A');
    expect(v.viewer).toBe('A');
    expect(Object.keys(v.islands).sort()).toEqual(['CA', 'CB', 'N1', 'N2', 'N3']);
    expect(v.islands.CB).toMatchObject({ owner: 'B', remote: true, hidden: true, soldiers: 0, isCapital: false, woodSymbol: false, goldSymbol: false });
    expect(v.islands.N3).toMatchObject({ owner: null, remote: true });
    expect(v.islands.N2!.remote).toBeUndefined();
    const strict = viewFor(game(), 'A', makeRules({ fog: { fullRange: 1, partialRange: 2, ownersBeyond: false } }));
    expect(Object.keys(strict.islands).sort()).toEqual(['CA', 'N1', 'N2']);
    expect(v.islands.N1!.soldiers).toBe(2);
    expect(v.islands.N1!.buildings).toHaveLength(1);
    expect(v.islands.N2!.hidden).toBe(true);
    expect(v.islands.N2!.soldiers).toBe(0);
    expect(v.islands.N2!.buildings).toHaveLength(0);
    expect(v.islands.N2!.owner).toBe('B');
    expect(v.islands.N2!.goldSymbol).toBe(true);
    expect(v.players.B!.resources).toEqual({ gold: 0, wood: 0 });
    expect(v.players.A!.resources).toEqual({ gold: 3, wood: 3 });
  });

  it('sans brouillard, ou en fin de partie, toute la carte est visible', () => {
    expect(viewFor(game(), 'A', makeRules({ fog: null })).viewer).toBeUndefined();
    const g = game();
    g.finished = true;
    expect(Object.keys(viewFor(g, 'A').islands)).toHaveLength(5);
  });

  it('un joueur éliminé voit toute la carte', () => {
    const g = game();
    g.players.A!.eliminated = true;
    expect(visibility(g, 'A').size).toBe(5);
  });

  it('le rapport ne montre que les batailles visibles ou qui nous concernent', () => {
    const g = game();
    g.islands.CB!.soldiers = 10;
    const orders = {
      A: { attacks: [{ from: 'CA', to: 'N1', soldiers: 3, mercenaries: 0 }] },
      B: { attacks: [{ from: 'CB', to: 'N3', soldiers: 4, mercenaries: 0 }] },
    };
    // B attaque une île neutre voisine de sa capitale, loin de A.
    g.islands.N3!.q = 5;
    const { state, events } = resolveTurn(g, orders);
    const battles = (pid: string) => eventsFor(events, g, state, pid).filter((e) => e.kind === 'battle').map((e) => e.kind === 'battle' && e.islandId);
    expect(battles('A')).toEqual(['N1']);
    expect(battles('B').sort()).toEqual(['N1', 'N3']); // N1 est voisine de N2, à B
    expect(eventsFor(events, g, state, 'A').some((e) => e.kind === 'income' && e.player === 'B')).toBe(false);
  });

  it('sur un vrai plateau, on voit toutes les îles mais le détail seulement près des siennes', () => {
    const g = createGame({ players: [1, 2, 3, 4].map((i) => ({ id: `P${i}`, name: `J${i}` })), seed: 3 });
    const v = viewFor(g, 'P1');
    expect(Object.keys(v.islands)).toHaveLength(Object.keys(g.islands).length);
    expect(Object.values(v.islands).some((i) => i.owner && i.owner !== 'P1' && !i.hidden)).toBe(false);
    expect(Object.values(v.islands).filter((i) => i.remote).length).toBeGreaterThan(0);
  });

  it('un espion (1 or) révèle à l\'aube la défense et les bâtiments d\'une île lointaine', () => {
    const g = game();
    g.islands.CB!.buildings.push({ type: 'tower', builtTurn: 0 });
    expect(viewFor(g, 'A').islands.CB!.hidden).toBe(true);
    const { state, events } = resolveTurn(g, { A: { spy: 'CB' } });
    expect(state.players.A!.resources.gold).toBe(3 - 1 + 3); // espion payé, puis revenus de la capitale
    const report = eventsFor(events, g, state, 'A').find((e) => e.kind === 'spied');
    expect(report).toMatchObject({ kind: 'spied', islandId: 'CB', owner: 'B', soldiers: 3, defense: 9, buildings: ['tower'] });
    const v = viewFor(state, 'A');
    expect(v.islands.CB).toMatchObject({ soldiers: 3, isCapital: true });
    expect(v.islands.CB!.hidden).toBeUndefined();
    // B ne sait rien de l'espion de A.
    expect(eventsFor(events, g, state, 'B').some((e) => e.kind === 'spied')).toBe(false);
    expect(viewFor(state, 'B').spied).toEqual({});
    // La nuit suivante, l'information n'est plus à jour : l'île redevient cachée.
    expect(viewFor(resolveTurn(state, {}).state, 'A').islands.CB!.hidden).toBe(true);
  });

  it('espion refusé sur sa propre île ou sans or', () => {
    const g = game();
    g.players.A!.resources.gold = 0;
    const r = resolveTurn(g, { A: { spy: 'CB' } });
    expect(r.events.some((e) => e.kind === 'order_rejected' && e.player === 'A')).toBe(true);
    const own = resolveTurn(game(), { A: { spy: 'CA' } });
    expect(own.events.some((e) => e.kind === 'order_rejected')).toBe(true);
  });
});
