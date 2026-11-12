// Échéance des tours : minuit, heure de Paris.

/** Écart (en minutes) entre l'heure de Paris et UTC à un instant donné. */
function parisOffsetMinutes(at: Date): number {
  const parts: Record<string, string> = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  const n = (k: string) => Number(parts[k] ?? 0);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'));
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** Minimum de temps laissé pour un tour : en deçà, l'échéance passe au minuit suivant. */
const MIN_TURN_MS = 60 * 60 * 1000;

/** Échéance d'un tour commencé à `from` : le prochain minuit, heure de Paris (au moins une heure plus tard). */
export function nextDeadline(from = new Date()): Date {
  for (let days = 1; days <= 2; days++) {
    // Date du jour à Paris, puis minuit du jour suivant (ou du surlendemain).
    const paris = new Date(from.getTime() + parisOffsetMinutes(from) * 60000);
    const midnightAsUtc = Date.UTC(paris.getUTCFullYear(), paris.getUTCMonth(), paris.getUTCDate() + days);
    // Corrige du décalage de Paris à ce minuit-là (heure d'été / d'hiver).
    const guess = new Date(midnightAsUtc - parisOffsetMinutes(new Date(midnightAsUtc)) * 60000);
    const deadline = new Date(midnightAsUtc - parisOffsetMinutes(guess) * 60000);
    if (deadline.getTime() - from.getTime() >= MIN_TURN_MS) return deadline;
  }
  throw new Error('Échéance introuvable');
}
