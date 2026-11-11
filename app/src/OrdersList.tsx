import { attackCost, type GameState, type PlayerOrders } from '@island/engine';
import { buildingLabel, islandName } from './format';
import { normalize } from './orders';

interface Props {
  state: GameState;
  orders: PlayerOrders;
  setOrders: (o: PlayerOrders) => void;
  onClose: () => void;
}

export function OrdersList({ state, orders, setOrders, onClose }: Props) {
  const o = normalize(orders);
  const items = [
    ...o.recruits.map((r, i) => ({
      text: `Recruter ${r.soldiers} soldat(s) sur l'${islandName(r.islandId)}`,
      remove: () => setOrders({ ...o, recruits: o.recruits.filter((_, j) => j !== i) }),
    })),
    ...o.builds.map((b, i) => ({
      text: `Construire : ${buildingLabel(b.building)} sur l'${islandName(b.islandId)}`,
      remove: () => setOrders({ ...o, builds: o.builds.filter((_, j) => j !== i) }),
    })),
    ...o.moves.map((m, i) => ({
      text: `Déplacer ${m.soldiers} soldat(s) : ${islandName(m.from)} → ${islandName(m.to)}`,
      remove: () => setOrders({ ...o, moves: o.moves.filter((_, j) => j !== i) }),
    })),
    ...o.attacks.map((a, i) => {
      const c = attackCost(state, a.from, a.to, a.soldiers, a.mercenaries);
      const units = [a.soldiers && `${a.soldiers} soldat(s)`, a.mercenaries && `${a.mercenaries} mercenaire(s)`].filter(Boolean).join(' + ');
      return {
        text: `Attaquer l'${islandName(a.to)} depuis l'${islandName(a.from)} avec ${units}${c?.gold ? ` (${c.gold} or)` : ''}`,
        remove: () => setOrders({ ...o, attacks: o.attacks.filter((_, j) => j !== i) }),
      };
    }),
  ];

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Mes ordres</h2>
        <button className="close" onClick={onClose} aria-label="Fermer">✕</button>
      </header>
      {items.length === 0 && <p className="muted">Aucun ordre pour l'instant.</p>}
      <ul className="orders">
        {items.map((it, i) => (
          <li key={i}>
            <span>{it.text}</span>
            <button className="ghost" onClick={it.remove} aria-label="Supprimer">✕</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
