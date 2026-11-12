import { describe, expect, it } from 'vitest';
import { nextDeadline } from '../../supabase/functions/game/deadline.ts';
const cases: [string, string][] = [
  ['2026-11-11T19:00:00Z', '2026-11-11T23:00:00.000Z'], // 20h Paris hiver -> minuit
  ['2026-11-11T22:30:00Z', '2026-11-12T23:00:00.000Z'], // 23h30 Paris : moins d'1h -> lendemain
  ['2026-11-11T23:30:00Z', '2026-11-12T23:00:00.000Z'], // 00h30 Paris le 12 -> minuit du 12 au 13
  ['2026-07-01T10:00:00Z', '2026-07-01T22:00:00.000Z'], // été
  ['2026-03-28T12:00:00Z', '2026-03-28T23:00:00.000Z'], // veille passage à l'heure d'été (29 mars)
  ['2026-03-29T12:00:00Z', '2026-03-29T22:00:00.000Z'], // jour du passage
  ['2026-10-25T12:00:00Z', '2026-10-25T23:00:00.000Z'], // jour du passage à l'heure d'hiver
];
describe('échéance des tours (minuit, heure de Paris)', () => {
  for (const [from, want] of cases) {
    it(from, () => expect(nextDeadline(new Date(from)).toISOString()).toBe(want));
  }
});

