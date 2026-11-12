import {
  BUILDINGS,
  MERCENARY_FORCE,
  attackCost,
  defenseOf,
  distance,
  hasBuilding,
  incomeOf,
  type BuildingType,
  type GameState,
  type IslandId,
  type PlayerId,
  type PlayerOrders,
} from '@island/engine';
import { useState } from 'react';
import { buildingLabel, islandName, playerColor, playerName } from './format';
import { availableToLeave, normalize, plannedBuildings, remaining, type TargetKind } from './orders';

export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="stepper">
      <button disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Moins">−</button>
      <b>{value}</b>
      <button disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Plus">+</button>
    </span>
  );
}

const BUILDING_EFFECTS: Record<BuildingType, string> = {
  mine: '+2 or par tour',
  sawmill: '+2 bois par tour',
  barracks: '+1 soldat par tour',
  port: 'attaque à portée 2 sans surcoût',
  tower: '+3 défense',
  university: 'technologies (bientôt)',
};

interface PanelProps {
  state: GameState;
  pid: PlayerId;
  orders: PlayerOrders;
  islandId: IslandId;
  setOrders: (o: PlayerOrders) => void;
  onSend: () => void;
  onClose: () => void;
}

export function IslandPanel({ state, pid, orders, islandId, setOrders, onSend, onClose }: PanelProps) {
  const island = state.islands[islandId]!;
  const mine = island.owner === pid;
  const left = remaining(state, pid, orders);
  const o = normalize(orders);
  const [recruit, setRecruit] = useState(1);
  const maxRecruit = Math.max(0, Math.min(left.gold, left.wood));
  const planned = plannedBuildings(orders, islandId);
  const single = incomeOf({ ...state, islands: { [islandId]: { ...island, owner: '__' } } }, '__');

  const addRecruit = () => {
    const existing = o.recruits.find((r) => r.islandId === islandId);
    const recruits = existing
      ? o.recruits.map((r) => (r === existing ? { ...r, soldiers: r.soldiers + recruit } : r))
      : [...o.recruits, { islandId, soldiers: recruit }];
    setOrders({ ...o, recruits });
    setRecruit(1);
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <span className="dot" style={{ background: playerColor(state, island.owner) }} />
        <h2>
          {island.isCapital ? 'Capitale' : 'Île'} {islandId.replace(/^I/, '')}
        </h2>
        <button className="close" onClick={onClose} aria-label="Fermer">✕</button>
      </header>
      <p className="muted">
        {island.owner ? `À ${playerName(state, island.owner)}` : 'Île vierge'} ·{' '}
        {island.hidden ? 'trop loin : soldats, défense et bâtiments inconnus' : `${island.soldiers} soldat(s) · défense ${defenseOf(island)}`}
        <br />
        Rapporte {single.gold} or / {single.wood} bois
        {island.woodSymbol && island.goldSymbol ? ' · île luxuriante' : island.woodSymbol ? ' · symbole bois' : island.goldSymbol ? ' · symbole or' : ''}
      </p>
      {island.buildings.length > 0 && (
        <p>Bâtiments : {island.buildings.map((b) => buildingLabel(b.type)).join(', ')}</p>
      )}

      {mine && (
        <>
          <div className="row">
            <span>Recruter (1 or + 1 bois)</span>
            <Stepper value={Math.min(recruit, Math.max(1, maxRecruit))} min={1} max={Math.max(1, maxRecruit)} onChange={setRecruit} />
            <button className="primary" disabled={maxRecruit < 1} onClick={addRecruit}>OK</button>
          </div>

          <div className="buildings">
            {(Object.keys(BUILDINGS) as BuildingType[]).map((b) => {
              const def = BUILDINGS[b];
              const owned = hasBuilding(island, b) || planned.includes(b);
              const affordable = left.gold >= def.cost.gold && left.wood >= def.cost.wood;
              return (
                <button
                  key={b}
                  className="building"
                  disabled={owned || !affordable}
                  onClick={() => setOrders({ ...o, builds: [...o.builds, { islandId, building: b }] })}
                >
                  <b>{def.label}</b>
                  <small>{def.cost.gold ? `${def.cost.gold} or` : `${def.cost.wood} bois`}</small>
                  <small className="muted">{owned ? 'déjà prévu' : BUILDING_EFFECTS[b]}</small>
                </button>
              );
            })}
          </div>

          <button className="primary wide" disabled={availableToLeave(state, orders, islandId) < 1} onClick={onSend}>
            Envoyer des troupes depuis cette île…
          </button>
        </>
      )}
    </section>
  );
}

interface SendProps {
  state: GameState;
  pid: PlayerId;
  orders: PlayerOrders;
  from: IslandId;
  to: IslandId;
  kind: TargetKind;
  setOrders: (o: PlayerOrders) => void;
  onDone: () => void;
}

export function SendDialog({ state, pid, orders, from, to, kind, setOrders, onDone }: SendProps) {
  const o = normalize(orders);
  const avail = availableToLeave(state, orders, from);
  const left = remaining(state, pid, orders);
  const target = state.islands[to]!;
  const d = distance(state, from, to);
  const surcharge = kind === 'attack' && d === 2 && !hasBuilding(state.islands[from]!, 'port');
  // Par défaut : toutes les troupes disponibles qu'on peut payer.
  const [soldiers, setSoldiers] = useState(kind === 'move' ? avail : surcharge ? Math.min(avail, Math.max(0, left.gold)) : avail);
  const [mercsWanted, setMercs] = useState(0);
  // Pas plus de mercenaires que de soldats dans une attaque.
  const mercs = Math.min(mercsWanted, soldiers);
  const [destroy, setDestroy] = useState<BuildingType | undefined>(target.buildings[0]?.type);

  const cost = kind === 'attack' ? attackCost(state, from, to, soldiers, mercs) : { gold: 0, wood: 0 };
  const affordable = cost !== null && cost.gold <= left.gold && cost.wood <= left.wood;
  const force = soldiers + mercs * MERCENARY_FORCE;
  const defense = defenseOf(target);

  const confirm = () => {
    if (kind === 'move') setOrders({ ...o, moves: [...o.moves, { from, to, soldiers }] });
    else setOrders({ ...o, attacks: [...o.attacks, { from, to, soldiers, mercenaries: mercs, destroyBuilding: target.owner ? destroy : undefined }] });
    onDone();
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{kind === 'move' ? 'Déplacer' : 'Attaquer'} : {islandName(from)} → {islandName(to)}</h2>
        <button className="close" onClick={onDone} aria-label="Annuler">✕</button>
      </header>
      {kind === 'attack' && (
        <p className="muted">
          Cible : {target.owner ? playerName(state, target.owner) : 'île vierge'}, {target.hidden ? 'défense inconnue (trop loin)' : `défense actuelle ${defense}`}
          {surcharge ? ' · portée 2 : +1 or par unité' : ''}
        </p>
      )}
      <div className="row">
        <span>Soldats (dispo {avail})</span>
        <Stepper value={soldiers} min={0} max={avail} onChange={setSoldiers} />
      </div>
      {kind === 'attack' && (
        <div className="row">
          <span>Mercenaires (2 or, force 3, pas plus que de soldats)</span>
          <Stepper value={mercs} min={0} max={soldiers} onChange={setMercs} />
        </div>
      )}
      {kind === 'attack' && target.owner && target.buildings.length > 0 && (
        <div className="row">
          <span>Bâtiment à détruire</span>
          <select value={destroy} onChange={(e) => setDestroy(e.target.value as BuildingType)}>
            {target.buildings.map((b) => (
              <option key={b.type} value={b.type}>{buildingLabel(b.type)}</option>
            ))}
          </select>
        </div>
      )}
      {kind === 'attack' && (
        <p>
          {target.hidden ? <>Force {force} contre une défense inconnue</> : <>
            Force {force} contre {defense} :{' '}
            {force > defense ? <b className="good">victoire probable</b> : <b className="bad">insuffisant</b>}
          </>}
          {cost && cost.gold > 0 ? ` · coût ${cost.gold} or` : ''}
          <br />
          <small className="muted">La défense peut changer d'ici la résolution (renforts, autres attaquants).</small>
        </p>
      )}
      <button className="primary wide" disabled={(kind === 'attack' ? soldiers < 1 : soldiers + mercs < 1) || !affordable} onClick={confirm}>
        {affordable ? 'Ajouter cet ordre' : 'Or insuffisant'}
      </button>
    </section>
  );
}
