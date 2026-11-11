/**
 * Règles de combat (sections 10 et 11 des règles).
 * Fonctions pures, sans état, faciles à tester.
 */
import { SECONDARY_FORCE_SHARE, WINNER_LOSS_SHARE } from './rules.js';

/**
 * Pertes subies par le camp vainqueur : la force du perdant,
 * moins 1 si le vainqueur a au moins le double de force (bonus de supériorité).
 */
export function winnerLosses(winnerForce: number, loserForce: number): number {
  if (loserForce <= 0) return 0;
  const bonus = winnerForce >= 2 * loserForce ? 1 : 0;
  return Math.max(0, loserForce - bonus);
}

export interface DuelResult {
  attackerWins: boolean;
  attackerLosses: number;
  defenderLosses: number;
}

/**
 * Combat simple. L'attaquant doit être strictement plus fort ;
 * en cas d'égalité, le défenseur l'emporte.
 * - Victoire de l'attaquant : il perd la force du défenseur (bonus de supériorité possible).
 * - Échec : tous les attaquants meurent, le défenseur perd la force de l'attaquant
 *   (avec le même bonus de supériorité).
 */
export function duel(attackForce: number, defenseForce: number): DuelResult {
  if (attackForce > defenseForce) {
    return {
      attackerWins: true,
      attackerLosses: winnerLosses(attackForce, defenseForce),
      defenderLosses: defenseForce,
    };
  }
  return {
    attackerWins: false,
    attackerLosses: attackForce,
    defenderLosses: Math.min(defenseForce, winnerLosses(defenseForce, attackForce)),
  };
}

export interface AttackerInput {
  key: string;
  force: number;
}

export interface MultiAttackResult {
  combinedForce: number;
  attackerWins: boolean;
  /** Clé de l'attaquant qui prend l'île (le plus fort), ou null en cas d'échec. */
  winnerKey: string | null;
  /** Pertes de force de chaque attaquant (plafonnées à sa propre force). */
  losses: Record<string, number>;
  defenderLosses: number;
}

/**
 * Attaques simultanées sur la même île (section 11).
 * - Force combinée = plus fort + 50 % de la somme des autres, arrondie à l'inférieur.
 * - Pertes totales calculées comme un combat normal avec cette force combinée.
 * - Le plus fort supporte 4/5 des pertes ; les autres se partagent 1/5
 *   au prorata de leur force. Chaque part est arrondie au-dessus et plafonnée
 *   à la force de l'attaquant.
 * - En cas d'égalité de force entre attaquants, l'ordre fourni départage
 *   (l'appelant fournit un ordre déterministe).
 * Avec un seul attaquant, le résultat est identique à `duel`.
 */
export function multiAttack(attackers: AttackerInput[], defenseForce: number): MultiAttackResult {
  const sorted = [...attackers].sort((a, b) => b.force - a.force);
  const [first, ...others] = sorted;
  if (!first) {
    return { combinedForce: 0, attackerWins: false, winnerKey: null, losses: {}, defenderLosses: 0 };
  }
  const othersForce = others.reduce((s, a) => s + a.force, 0);
  const combinedForce = Math.floor(first.force + SECONDARY_FORCE_SHARE * othersForce);
  const result = duel(combinedForce, defenseForce);
  const losses: Record<string, number> = {};

  if (!result.attackerWins) {
    for (const a of sorted) losses[a.key] = a.force;
    return { combinedForce, attackerWins: false, winnerKey: null, losses, defenderLosses: result.defenderLosses };
  }

  const total = result.attackerLosses;
  if (others.length === 0) {
    losses[first.key] = Math.min(first.force, total);
  } else {
    losses[first.key] = Math.min(first.force, Math.ceil(total * WINNER_LOSS_SHARE));
    const othersShare = total * (1 - WINNER_LOSS_SHARE);
    for (const a of others) {
      const share = othersForce > 0 ? (othersShare * a.force) / othersForce : 0;
      losses[a.key] = Math.min(a.force, Math.ceil(share - 1e-9));
    }
  }
  return { combinedForce, attackerWins: true, winnerKey: first.key, losses, defenderLosses: result.defenderLosses };
}
