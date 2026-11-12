import { describe, expect, it } from 'vitest';
import { createGame, defenseOf, hexDistance, type Island } from '../src/index.ts';

const kindOf = (i: Island) =>
  i.buildings.length ? 'building' : i.woodSymbol && i.goldSymbol ? 'both' : i.woodSymbol ? 'wood' : i.goldSymbol ? 'gold' : 'plain';

describe('création du plateau', () => {
  for (const n of [2, 4, 7, 12, 20]) {
    it(`${n} joueurs : chaque capitale a 5 îles voisines équilibrées`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const players = Array.from({ length: n }, (_, i) => ({ id: `P${i}`, name: `J${i}` }));
        const g = createGame({ players, seed });
        const islands = Object.values(g.islands);
        for (const cap of islands.filter((i) => i.isCapital)) {
          const near = islands.filter((i) => !i.isCapital && hexDistance(i, cap) === 1);
          // Une île peut être voisine de deux capitales : on vérifie au moins le cas général.
          if (islands.some((c) => c.isCapital && c !== cap && hexDistance(c, cap) <= 2)) continue;
          expect(near).toHaveLength(5);
          const plain = near.filter((i) => kindOf(i) === 'plain').map((i) => defenseOf(i)).sort();
          expect(plain).toEqual([2, 3, 4]);
          for (const k of ['wood', 'gold']) {
            const x = near.filter((i) => kindOf(i) === k);
            expect(x).toHaveLength(1);
            expect([5, 6]).toContain(defenseOf(x[0]!));
          }
        }
        for (const i of islands.filter((x) => !x.owner)) {
          const d = defenseOf(i);
          const ranges = { plain: [2, 4], wood: [5, 6], gold: [5, 6], both: [8, 10], building: [4, 6] } as const;
          const [lo, hi] = ranges[kindOf(i)];
          expect(d, `${kindOf(i)} ${i.id}`).toBeGreaterThanOrEqual(lo);
          expect(d, `${kindOf(i)} ${i.id}`).toBeLessThanOrEqual(hi);
        }
      }
    });
  }
});
