import { describe, expect, it } from 'vitest';
import { duel, multiAttack } from '../src/combat.js';

describe('combat simple (section 10)', () => {
  it('5 contre 3 : l\'attaquant gagne et garde 2', () => {
    const r = duel(5, 3);
    expect(r.attackerWins).toBe(true);
    expect(5 - r.attackerLosses).toBe(2);
  });

  it('9 contre 5 : pas le double, il reste 4', () => {
    expect(9 - duel(9, 5).attackerLosses).toBe(4);
  });

  it('10 contre 5 : bonus de supériorité, il reste 6', () => {
    expect(10 - duel(10, 5).attackerLosses).toBe(6);
  });

  it('6 contre 4 (exemple du premier tour) : il reste 2', () => {
    expect(6 - duel(6, 4).attackerLosses).toBe(2);
  });

  it('égalité : le défenseur gagne', () => {
    const r = duel(4, 4);
    expect(r.attackerWins).toBe(false);
    expect(r.defenderLosses).toBe(4);
  });

  it('échec : le défenseur perd la force de l\'attaquant, avec bonus s\'il a le double', () => {
    expect(duel(3, 6).defenderLosses).toBe(2);
    expect(duel(3, 5).defenderLosses).toBe(3);
  });
});

describe('attaques simultanées (section 11)', () => {
  it('5 + 50 % de 3 = 6 (arrondi inférieur) contre 4', () => {
    const r = multiAttack([{ key: 'A', force: 5 }, { key: 'B', force: 3 }], 4);
    expect(r.combinedForce).toBe(6);
    expect(r.attackerWins).toBe(true);
    expect(r.winnerKey).toBe('A');
    // Pertes totales 4 : A supporte ceil(3,2) = 4, B supporte ceil(0,8) = 1
    expect(r.losses).toEqual({ A: 4, B: 1 });
  });

  it('le bonus de supériorité s\'applique à la force combinée', () => {
    // 8 + 50 % de 4 = 10 contre 5 -> pertes 4 ; A : ceil(3,2) = 4, B : ceil(0,8) = 1
    const r = multiAttack([{ key: 'A', force: 8 }, { key: 'B', force: 4 }], 5);
    expect(r.combinedForce).toBe(10);
    expect(r.losses).toEqual({ A: 4, B: 1 });
  });

  it('les pertes sont plafonnées à la force de chacun', () => {
    // 4 + 50 % de 1 = 4 contre 3 -> pertes 3 ; A : ceil(2,4) = 3, B : ceil(0,6) = 1 (plafond 1)
    const r = multiAttack([{ key: 'A', force: 4 }, { key: 'B', force: 1 }], 3);
    expect(r.losses).toEqual({ A: 3, B: 1 });
  });

  it('plus de deux attaquants : le plus fort + 50 % de tous les autres', () => {
    const r = multiAttack([{ key: 'A', force: 2 }, { key: 'B', force: 6 }, { key: 'C', force: 4 }], 7);
    expect(r.combinedForce).toBe(9);
    expect(r.winnerKey).toBe('B');
    // Pertes 7 : B ceil(5,6) = 6 ; le 1/5 restant (1,4) partagé : A ceil(0,467) = 1, C ceil(0,933) = 1
    expect(r.losses).toEqual({ B: 6, A: 1, C: 1 });
  });

  it('si l\'attaque échoue, tous les attaquants meurent', () => {
    const r = multiAttack([{ key: 'A', force: 3 }, { key: 'B', force: 2 }], 5);
    expect(r.attackerWins).toBe(false);
    expect(r.losses).toEqual({ A: 3, B: 2 });
  });
});
