import type { GameState, IslandId, PlayerId, PlayerOrders } from '@island/engine';
import { useMemo, useState, type ReactNode } from 'react';
import { GameMap } from './GameMap';
import { GoldIcon } from './icons';
import { Help } from './Help';
import { IslandPanel, SendDialog } from './IslandPanel';
import { OrdersList } from './OrdersList';
import { playerColor, playerName } from './format';
import { normalize, rejectedReasons, remaining, targetsFrom, type TargetKind } from './orders';

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
}

/** Écran principal : carte, panneau de l'île choisie, liste des ordres. Partagé entre mode local et en ligne. */
export function OrdersScreen({ state, pid, orders, setOrders, submitLabel, onSubmit, banner, topAction, readOnly }: Props) {
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
  const count = o.recruits.length + o.builds.length + o.moves.length + o.attacks.length;

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

      <GameMap state={state} selected={targeting ?? selected} targets={targets} orders={orders} onTap={tap} />

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
