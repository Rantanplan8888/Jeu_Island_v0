import type { GameState, PlayerId, PlayerOrders, TurnEvent } from '@island/engine';

export interface LocalGame {
  state: GameState;
  orders: Record<PlayerId, PlayerOrders>;
  /** Index du joueur (parmi les joueurs encore en jeu) qui saisit ses ordres. */
  current: number;
  /** handoff : passer le téléphone ; news : rapport personnel du joueur ; orders : ses ordres ; report : fin de nuit. */
  phase: 'handoff' | 'news' | 'orders' | 'report';
  lastEvents: TurnEvent[];
  /** Carte avant la dernière nuit (pour savoir ce que chaque joueur a pu voir). */
  prevState?: GameState;
}

const KEY = 'island.local.v1';

export function loadLocal(): LocalGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalGame) : null;
  } catch {
    return null;
  }
}

export function saveLocal(g: LocalGame): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    /* stockage indisponible : la partie ne sera pas conservée */
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
}
