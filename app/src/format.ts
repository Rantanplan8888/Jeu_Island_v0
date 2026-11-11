import { BUILDINGS, type GameState, type PlayerId, type TurnEvent } from '@island/engine';

const PALETTE = [
  '#e4572e', '#4c8bf5', '#f2c14e', '#8e44ad', '#2ecc71', '#ff7eb6', '#1abc9c', '#f39c12', '#c0392b', '#7f8c8d',
  '#3d5afe', '#a1887f', '#00bcd4', '#cddc39', '#ff5722', '#9c27b0', '#607d8b', '#ffeb3b', '#795548', '#e91e63',
];

export function colorByIndex(idx: number): string {
  return PALETTE[idx % PALETTE.length]!;
}

export function playerColor(state: GameState, pid: PlayerId | null): string {
  if (pid === null) return '#c9b98f';
  return colorByIndex(Object.keys(state.players).sort().indexOf(pid));
}

export function playerName(state: GameState, pid: PlayerId | null): string {
  if (pid === null) return 'les indigènes';
  return state.players[pid]?.name ?? pid;
}

export function islandName(id: string): string {
  return `île ${id.replace(/^I/, '')}`;
}

export function buildingLabel(type: keyof typeof BUILDINGS): string {
  return BUILDINGS[type].label;
}

/** Texte lisible pour un événement du rapport de tour. */
export function describe(state: GameState, e: TurnEvent): string | null {
  const name = (p: PlayerId | null) => playerName(state, p);
  switch (e.kind) {
    case 'recruited':
      return `${name(e.player)} recrute ${e.soldiers} soldat(s) sur l'${islandName(e.islandId)}.`;
    case 'built':
      return `${name(e.player)} construit : ${buildingLabel(e.building)} sur l'${islandName(e.islandId)}.`;
    case 'moved':
      return `${name(e.player)} déplace ${e.soldiers} soldat(s) de l'${islandName(e.from)} vers l'${islandName(e.to)}.`;
    case 'battle': {
      const att = e.attackers.map((a) => `${name(a.player)} (force ${a.force})`).join(' et ');
      const combined = e.attackers.length > 1 ? `, force combinée ${e.combinedForce}` : '';
      const head = `Bataille sur l'${islandName(e.islandId)} : ${att}${combined} contre ${name(e.defender)} (défense ${e.defense}).`;
      if (e.conquered) {
        const winner = e.attackers.find((a) => a.player === e.newOwner);
        const others = e.attackers.filter((a) => a.player !== e.newOwner)
          .map((a) => ` ${name(a.player)} perd ${a.losses} de force et ramène ${a.survivors} soldat(s).`).join('');
        const destroyed = e.destroyedBuilding ? ` Bâtiment détruit : ${buildingLabel(e.destroyedBuilding)}.` : '';
        return `${head} ${name(e.newOwner)} conquiert l'île et y laisse ${winner?.survivors ?? 0} soldat(s).${others}${destroyed}`;
      }
      return `${head} L'attaque échoue : tous les attaquants meurent, le défenseur perd ${e.defenderLosses} soldat(s).`;
    }
    case 'barracks':
      return `La baraque de l'${islandName(e.islandId)} produit ${e.soldiers} soldat(s) pour ${name(e.player)}.`;
    case 'income':
      return `${name(e.player)} reçoit ${e.gold} or et ${e.wood} bois.`;
    case 'eliminated':
      return `${name(e.player)} n'a plus d'île : éliminé(e).`;
    case 'game_over':
      return e.winner ? `Partie terminée : ${name(e.winner)} l'emporte !` : 'Partie terminée : égalité.';
    case 'order_rejected':
      return `Ordre refusé pour ${name(e.player)} : ${e.reason}`;
  }
}
