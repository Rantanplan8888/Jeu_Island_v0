import type { GameState, IslandId, PlayerId, PlayerOrders } from '@island/engine';
import { useMemo, useState, type ReactNode } from 'react';
import { GameMap } from './GameMap';
import { GoldIcon } from './icons';
import { Help } from './Help';
import { IslandPanel, SendDialog } from './IslandPanel';
import { OrdersList } from './OrdersList';
import { playerColor, playerName } from './format';
import { forecast, normalize, rejectedReasons, remaining, targetsFrom, type TargetKind } from './orders';

interface Props {
  state: GameState;
  pid: PlayerId;
  orders: PlayerOrders;
  setOrders: (o: PlayerOrders) => void;
  submitLabel: string;
  onSubmit: () => void;
  /** Bandeau optionnel sous la barre du haut (statut d'envoi, échéance…). */
  banner?: ReactNode;
  /** Bouton supplémentaire dans la barre du haut (retour, rapport…). */
  topAction?: ReactNode;
  readOnly?: boolean;
  /** Encart en plus sur la carte (aperçu de la discussion). */
  mapExtra?: ReactNode;
}

/** Écran principal : carte, panneau de l'île choisie, liste des ordres. Partagé entre mode local et en ligne. */
export function OrdersScreen({ state, pid, orders, setOrders, submitLabel, onSubmit, banner, topAction, readOnly, mapExtra }: Props) {
  const [selected, setSelected] = useState<IslandId | null>(null);
  const [targeting, setTargeting] = useState<IslandId | null>(null);
  const [sending, setSending] = useState<{ from: IslandId; to: IslandId; kind: TargetKind } | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  // L'aide s'ouvre d'elle-même la toute première fois.
  const [showHelp, setShowHelpState] = useState(() => {
    try {
      return !localStorage.getItem('island.helpSeen');
    } catch {
      return false;
    }
  });
  const setShowHelp = (v: boolean) => {
    if (!v) {
      try { localStorage.setItem('island.helpSeen', '1'); } catch { /* rien */ }
    }
    setShowHelpState(v);
  };

  const targets = useMemo(() => (targeting ? targetsFrom(state, pid, targeting) : null), [state, pid, targeting]);
  const left = remaining(state, pid, orders);
  const o = normalize(orders);
  const count = o.recruits.length + o.builds.length + o.moves.length + o.attacks.length + (o.spy !== undefined ? 1 : 0);

  const tap = (id: IslandId) => {
    if (targeting) {
      const kind = targets?.get(id);
      if (kind) {
        setSending({ from: targeting, to: id, kind });
        setTargeting(null);
      } else if (id === targeting) setTargeting(null);
      return;
    }
    setSelected(id);
    setSending(null);
    setShowOrders(false);
  };

  const [confirming, setConfirming] = useState(false);
  const confirmSubmit = () => {
    setConfirming(false);
    setSelected(null);
    setShowOrders(false);
    onSubmit();
  };

  const me = state.players[pid];

  return (
    <main className="play">
      <header className="topbar" style={{ borderBottomColor: playerColor(state, pid) }}>
        {topAction}
        <span className="dot" style={{ background: playerColor(state, pid) }} />
        <b>{playerName(state, pid)}</b>
        <span className="muted">Tour {state.turn}</span>
        <span className="res" title="Or"><GoldIcon /> {left.gold}</span>
        <span className="res" title="Bois">🪵 {left.wood}</span>
        <button className="icon" onClick={() => setShowHelp(true)} aria-label="Comment jouer">?</button>
      </header>
      {showHelp && <Help onClose={() => setShowHelp(false)} />}
      {banner}
      {targeting && <div className="hint">Touche une île en surbrillance : rouge pour attaquer, verte pour déplacer. Touche l'île de départ pour annuler.</div>}

      <GameMap state={state} selected={targeting ?? selected} targets={targets} orders={orders} pid={pid} onTap={tap}
        corner={<>{!readOnly && !me?.eliminated && <Budget state={state} pid={pid} orders={orders} />}{mapExtra}</>} />

      {sending ? (
        <SendDialog state={state} pid={pid} orders={orders} {...sending} setOrders={setOrders} onDone={() => { setSending(null); setSelected(sending.from); }} />
      ) : showOrders ? (
        <OrdersList state={state} orders={orders} setOrders={setOrders} onClose={() => setShowOrders(false)} />
      ) : selected && !targeting ? (
        <IslandPanel
          key={selected}
          state={state}
          pid={readOnly || me?.eliminated ? '__spectateur__' : pid}
          orders={orders}
          islandId={selected}
          setOrders={setOrders}
          onSend={() => setTargeting(selected)}
          onClose={() => setSelected(null)}
        />
      ) : !targeting ? (
        <p className="hint">{readOnly ? 'Touche une île pour voir ses détails.' : me?.eliminated ? 'Tu as été éliminé(e) : tu peux suivre la partie.' : 'Touche une de tes îles pour recruter, construire ou envoyer des troupes.'}</p>
      ) : null}

      {confirming && (
        <ConfirmOrders
          count={count}
          problems={rejectedReasons(state, pid, orders)}
          left={left}
          onCancel={() => setConfirming(false)}
          onConfirm={confirmSubmit}
        />
      )}

      {!readOnly && !me?.eliminated && (
        <footer className="actions">
          <button className="ghost" onClick={() => { setShowOrders(!showOrders); setSending(null); }}>Mes ordres ({count})</button>
          <button className="primary" onClick={() => setConfirming(true)}>{submitLabel}</button>
        </footer>
      )}
    </main>
  );
}

function ConfirmOrders({ count, problems, left, onCancel, onConfirm }: {
  count: number;
  problems: string[];
  left: { gold: number; wood: number };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label="Valider mes ordres" onClick={(e) => e.stopPropagation()}>
        <h2>Valider tes ordres ?</h2>
        <p>{count === 0 ? 'Aucun ordre : tu passes ton tour.' : `${count} ordre${count > 1 ? 's' : ''} pour ce tour.`}</p>
        <p className="muted">Il te restera <GoldIcon size={15} /> {left.gold} et 🪵 {left.wood}.</p>
        {problems.length > 0 && (
          <div className="bad">
            <p><b>Certains ordres seront refusés :</b></p>
            <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        <div className="row">
          <button className="ghost" onClick={onCancel}>Annuler</button>
          <button className="primary" onClick={onConfirm}>Oui, valider ✓</button>
        </div>
      </div>
    </div>
  );
}

/** Bilan du tour en haut à gauche de la carte ; se replie en une ligne d'un toucher. */
function Budget({ state, pid, orders }: { state: GameState; pid: PlayerId; orders: PlayerOrders }) {
  const f = useMemo(() => forecast(state, pid, orders), [state, pid, orders]);
  const [open, setOpenState] = useState(() => {
    try { return localStorage.getItem('island.budget') !== 'closed'; } catch { return true; }
  });
  const setOpen = (v: boolean) => {
    try { localStorage.setItem('island.budget', v ? 'open' : 'closed'); } catch { /* rien */ }
    setOpenState(v);
  };
  const signed = (n: number, sign: '+' | '−') => (n === 0 ? '0' : `${sign}${n}`);
  const neg = f.after.gold < 0 || f.after.wood < 0;
  return (
    <button className={`budget${neg ? ' neg' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Bilan des ressources du tour">
      {open ? (
        <table>
          <thead><tr><th /><th><GoldIcon size={14} /></th><th>🪵</th></tr></thead>
          <tbody>
            <tr><td>Stock</td><td>{f.stock.gold}</td><td>{f.stock.wood}</td></tr>
            <tr className="minus"><td>Ordres</td><td>{signed(f.cost.gold, '−')}</td><td>{signed(f.cost.wood, '−')}</td></tr>
            <tr className="plus"><td>Revenus</td><td>{signed(f.income.gold, '+')}</td><td>{signed(f.income.wood, '+')}</td></tr>
            <tr className="total"><td>Après</td><td className={f.after.gold < 0 ? 'bad-n' : ''}>{f.after.gold}</td><td className={f.after.wood < 0 ? 'bad-n' : ''}>{f.after.wood}</td></tr>
          </tbody>
        </table>
      ) : (
        <span>Après : <GoldIcon size={14} /> {f.after.gold} · 🪵 {f.after.wood}</span>
      )}
    </button>
  );
}
