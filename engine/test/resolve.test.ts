import { describe, expect, it } from 'vitest';
import { createGame, resolveTurn, type GameState, type Island } from '../src/index.ts';

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

describe('résolution d\'un tour', () => {
  it('exemple du premier tour : recruter 3 soldats et prendre une île de défense 4', () => {
    const s = game([capital('CA', 0, 0, 'A'), island('N', 1, 0, { soldiers: 4 }), capital('CB', 5, 0, 'B')]);
    const { state, events } = resolveTurn(s, {
      A: { recruits: [{ islandId: 'CA', soldiers: 3 }], attacks: [{ from: 'CA', to: 'N', soldiers: 6, mercenaries: 0 }] },
    });
    expect(state.islands.N!.owner).toBe('A');
    expect(state.islands.N!.soldiers).toBe(2);
    expect(state.islands.CA!.soldiers).toBe(0);
    // Ressources : 3/3 - 3/3 de recrutement + revenus (capitale 3/3 + île normale 1/1)
    expect(state.players.A!.resources).toEqual({ gold: 4, wood: 4 });
    expect(events.some((e) => e.kind === 'battle' && e.conquered)).toBe(true);
    expect(state.turn).toBe(2);
  });

  it('on ne peut pas recruter et construire avec les ressources de départ', () => {
    const s = game([capital('CA', 0, 0, 'A'), capital('CB', 5, 0, 'B')]);
    const { state, events } = resolveTurn(s, {
      A: { recruits: [{ islandId: 'CA', soldiers: 3 }], builds: [{ islandId: 'CA', building: 'tower' }] },
    });
    expect(state.islands.CA!.soldiers).toBe(6);
    expect(state.islands.CA!.buildings).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'order_rejected')).toHaveLength(1);
  });

  it('le mur de la capitale compte 3 de défense, et la capitale capturée garde ses symboles', () => {
    const s = game([capital('CA', 0, 0, 'A'), capital('CB', 1, 0, 'B')]);
    s.islands.CA!.soldiers = 10;
    s.islands.CB!.buildings.push({ type: 'mine', builtTurn: 0 });
    const { state, events } = resolveTurn(s, {
      A: { attacks: [{ from: 'CA', to: 'CB', soldiers: 10, mercenaries: 0 }] },
    });
    const battle = events.find((e) => e.kind === 'battle');
    expect(battle && battle.kind === 'battle' && battle.defense).toBe(6);
    const cb = state.islands.CB!;
    expect(cb.owner).toBe('A');
    expect(cb.isCapital).toBe(false);
    expect(cb.woodSymbol && cb.goldSymbol).toBe(true);
    expect(cb.buildings).toHaveLength(0); // un bâtiment détruit
    expect(cb.soldiers).toBe(4); // 10 contre 6 : pas le double, pertes 6, il reste 4
  });

  it('les mercenaires attaquent puis disparaissent', () => {
    const s = game([capital('CA', 0, 0, 'A'), island('N', 1, 0, { soldiers: 4 }), capital('CB', 5, 0, 'B')]);
    // 1 soldat + 1 mercenaire = force 4 contre 4 : échec ; 2 soldats + 1 mercenaire = 5 contre 4 : victoire
    const { state } = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'N', soldiers: 2, mercenaries: 1 }] } });
    expect(state.islands.N!.owner).toBe('A');
    // force restante 1, mais seuls des soldats restent : min(2, 1) = 1
    expect(state.islands.N!.soldiers).toBe(1);
    expect(state.players.A!.resources.gold).toBe(1 + 3 + 1);
  });

  it('portée 2 : supplément d\'1 or par unité, sauf avec un port', () => {
    const s = game([capital('CA', 0, 0, 'A'), island('N', 2, 0, { soldiers: 1 }), capital('CB', 6, 0, 'B')]);
    const r1 = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'N', soldiers: 3, mercenaries: 0 }] } });
    expect(r1.state.islands.N!.owner).toBe('A');
    expect(r1.state.players.A!.resources.gold).toBe(0 + 3 + 1);

    s.islands.CA!.buildings.push({ type: 'port', builtTurn: 0 });
    const r2 = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'N', soldiers: 3, mercenaries: 0 }] } });
    expect(r2.state.players.A!.resources.gold).toBe(3 + 3 + 1);
  });

  it('portée 3 : attaque refusée', () => {
    const s = game([capital('CA', 0, 0, 'A'), island('N', 3, 0, { soldiers: 1 }), capital('CB', 6, 0, 'B')]);
    const { state, events } = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'N', soldiers: 3, mercenaries: 0 }] } });
    expect(state.islands.N!.owner).toBeNull();
    expect(events[0]!.kind).toBe('order_rejected');
  });

  it('attaques simultanées : le plus fort prend l\'île, l\'autre rentre chez lui', () => {
    const s = game([capital('CA', -1, 0, 'A'), island('N', 0, 0, { soldiers: 4 }), capital('CB', 1, 0, 'B')]);
    s.islands.CA!.soldiers = 5;
    const { state } = resolveTurn(s, {
      A: { attacks: [{ from: 'CA', to: 'N', soldiers: 5, mercenaries: 0 }] },
      B: { attacks: [{ from: 'CB', to: 'N', soldiers: 3, mercenaries: 0 }] },
    });
    expect(state.islands.N!.owner).toBe('A');
    expect(state.islands.N!.soldiers).toBe(1);
    expect(state.islands.CB!.soldiers).toBe(2);
  });

  it('les soldats partis attaquer ne défendent plus leur île', () => {
    const s = game([capital('CA', 0, 0, 'A'), island('N', -1, 0, { soldiers: 1 }), capital('CB', 1, 0, 'B')]);
    s.islands.CB!.soldiers = 4;
    const { state } = resolveTurn(s, {
      A: { attacks: [{ from: 'CA', to: 'N', soldiers: 3, mercenaries: 0 }] },
      B: { attacks: [{ from: 'CB', to: 'CA', soldiers: 4, mercenaries: 0 }] },
    });
    // CA vide : défense = mur 3 seulement, B gagne avec 4 - 3 = 1
    expect(state.islands.CA!.owner).toBe('B');
    expect(state.islands.CA!.soldiers).toBe(1);
    expect(state.islands.N!.owner).toBe('A');
  });

  it('une attaque ratée : les murs absorbent les pertes en premier', () => {
    const s = game([capital('CA', 0, 0, 'A'), capital('CB', 1, 0, 'B')]);
    s.islands.CB!.soldiers = 3; // défense 6
    const { state } = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'CB', soldiers: 3, mercenaries: 0 }] } });
    // Défenseur perd 3 - 1 (bonus, 6 >= 2×3) = 2, absorbés par le mur
    expect(state.islands.CB!.soldiers).toBe(3);
    expect(state.islands.CA!.soldiers).toBe(0);
  });

  it('la baraque produit un soldat à partir du tour suivant', () => {
    let s = game([capital('CA', 0, 0, 'A'), capital('CB', 5, 0, 'B')]);
    s.players.A!.resources = { gold: 0, wood: 4 };
    s = resolveTurn(s, { A: { builds: [{ islandId: 'CA', building: 'barracks' }] } }).state;
    expect(s.islands.CA!.soldiers).toBe(3);
    s = resolveTurn(s, {}).state;
    expect(s.islands.CA!.soldiers).toBe(4);
  });

  it('revenus : îles, mine et scierie', () => {
    const s = game([
      capital('CA', 0, 0, 'A'),
      island('W', 1, 0, { owner: 'A', woodSymbol: true, buildings: [{ type: 'mine', builtTurn: 0 }] }),
      island('G', 0, 1, { owner: 'A', goldSymbol: true, buildings: [{ type: 'sawmill', builtTurn: 0 }] }),
      capital('CB', 5, 0, 'B'),
    ]);
    const { state } = resolveTurn(s, {});
    // or : 3 + (1 + 2) + 3 = 9 ; bois : 3 + 3 + (1 + 2) = 9
    expect(state.players.A!.resources).toEqual({ gold: 12, wood: 12 });
  });

  it('victoire quand un joueur possède toutes les capitales', () => {
    const s = game([capital('CA', 0, 0, 'A'), capital('CB', 1, 0, 'B'), island('X', 2, 0, { owner: 'B', soldiers: 5 })]);
    s.islands.CA!.soldiers = 20;
    const { state } = resolveTurn(s, { A: { attacks: [{ from: 'CA', to: 'CB', soldiers: 20, mercenaries: 0 }] } });
    expect(state.finished).toBe(true);
    expect(state.winner).toBe('A');
  });
});

describe('création de partie', () => {
  it('génère un plateau déterministe avec une capitale par joueur', () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: `P${i}`, name: `Joueur ${i}` }));
    const g1 = createGame({ players, seed: 42 });
    const g2 = createGame({ players, seed: 42 });
    expect(g1).toEqual(g2);
    const caps = Object.values(g1.islands).filter((i) => i.isCapital);
    expect(caps).toHaveLength(8);
    expect(new Set(caps.map((c) => c.owner)).size).toBe(8);
    for (const c of caps) {
      const neighbours = Object.values(g1.islands).filter((i) => Math.abs(i.q - c.q) + Math.abs(i.r - c.r) + Math.abs(i.q + i.r - c.q - c.r) === 2);
      expect(neighbours.length).toBeGreaterThanOrEqual(2);
      expect(neighbours.every((n) => !n.isCapital)).toBe(true);
    }
  });
});
