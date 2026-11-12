/**
 * Brouillard de guerre : ce que chaque joueur a le droit de voir.
 *
 * - À `fullRange` case(s) ou moins d'une de ses îles : tout est visible.
 * - À `partialRange` cases ou moins : l'île, son propriétaire et ses symboles ; pas ses soldats
 *   ni ses bâtiments (l'île est marquée `hidden`).
 * - Au-delà : seulement le propriétaire de l'île (neutre ou joueur), marquée `remote` ;
 *   ou rien du tout si la règle `ownersBeyond` est désactivée.
 * - Une île espionnée la nuit précédente est visible en entier.
 * Les ressources des autres joueurs sont cachées. Une partie terminée, ou un joueur éliminé,
 * voit toute la carte.
 */
import { hexDistance } from './board.ts';
import { DEFAULT_RULES, type Rules } from './rules.ts';
import type { GameState, IslandId, PlayerId, TurnEvent } from './types.ts';

export type Visibility = 'full' | 'partial' | 'owner';

/** Visibilité de chaque île pour un joueur (les îles absentes sont invisibles). */
export function visibility(state: GameState, viewer: PlayerId, rules: Rules = DEFAULT_RULES): Map<IslandId, Visibility> {
  const out = new Map<IslandId, Visibility>();
  const islands = Object.values(state.islands);
  const fog = rules.fog;
  const player = state.players[viewer];
  if (!fog || state.finished || !player || player.eliminated) {
    for (const i of islands) out.set(i.id, 'full');
    return out;
  }
  const mine = islands.filter((i) => i.owner === viewer);
  const spied = new Set(state.spied?.[viewer] ?? []);
  for (const i of islands) {
    if (spied.has(i.id)) { out.set(i.id, 'full'); continue; }
    let d = Infinity;
    for (const m of mine) d = Math.min(d, hexDistance(m, i));
    if (d <= fog.fullRange) out.set(i.id, 'full');
    else if (d <= fog.partialRange) out.set(i.id, 'partial');
    else if (fog.ownersBeyond) out.set(i.id, 'owner');
  }
  return out;
}

/** La partie telle que la voit un joueur. Sans brouillard, une simple copie. */
export function viewFor(state: GameState, viewer: PlayerId, rules: Rules = DEFAULT_RULES): GameState {
  const view: GameState = structuredClone(state);
  // Chacun ne sait que ce que ses propres espions ont vu.
  if (view.spied) view.spied = view.spied[viewer] ? { [viewer]: view.spied[viewer]! } : {};
  const vis = visibility(state, viewer, rules);
  if ([...vis.values()].filter((v) => v === 'full').length === Object.keys(state.islands).length) return view;
  view.viewer = viewer;
  for (const id of Object.keys(view.islands)) {
    const v = vis.get(id);
    if (!v) delete view.islands[id];
    else if (v !== 'full') {
      const island = view.islands[id]!;
      island.soldiers = 0;
      island.buildings = [];
      island.hidden = true;
      if (v === 'owner') {
        island.remote = true;
        island.woodSymbol = false;
        island.goldSymbol = false;
        island.isCapital = false;
        island.startingCapital = false;
      }
    }
  }
  for (const p of Object.values(view.players)) {
    if (p.id !== viewer) p.resources = { gold: 0, wood: 0 };
  }
  return view;
}

/**
 * Événements d'un tour qu'un joueur a le droit de connaître : les siens, les batailles où il
 * est impliqué ou qu'il voit entièrement (avant ou après le tour), les éliminations et la fin.
 */
export function eventsFor(
  events: TurnEvent[],
  before: GameState,
  after: GameState,
  viewer: PlayerId,
  rules: Rules = DEFAULT_RULES,
): TurnEvent[] {
  const seenBefore = visibility(before, viewer, rules);
  const seenAfter = visibility(after, viewer, rules);
  const sees = (id: IslandId) => seenBefore.get(id) === 'full' || seenAfter.get(id) === 'full';
  return events.filter((e) => {
    switch (e.kind) {
      case 'battle':
        return e.defender === viewer || e.attackers.some((a) => a.player === viewer) || sees(e.islandId);
      case 'eliminated':
      case 'game_over':
        return true;
      default:
        return e.player === viewer;
    }
  });
}
