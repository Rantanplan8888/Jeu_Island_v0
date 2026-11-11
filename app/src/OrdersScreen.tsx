import type { GameState, IslandId, PlayerId, PlayerOrders } from '@island/engine';
import { useMemo, useState, type ReactNode } from 'react';
import { GameMap } from './GameMap';
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

  const submit = () => {
    const problems = rejectedReasons(state, pid, orders);
    if (problems.length && !confirm(`Certains ordres seront refusés :\n\n${problems.join('\n')}\n\nValider quand même ?`)) return;
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
        <span className="res" title="Or">🪙 {left.gold}</span>
        <span className="res" title="Bois">🪵 {left.wood}</span>
      </header>
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
        <p className="hint">{me?.eliminated ? 'Tu as été éliminé(e) : tu peux suivre la partie.' : 'Touche une de tes îles pour recruter, construire ou envoyer des troupes.'}</p>
      ) : null}

      {!readOnly && !me?.eliminated && (
        <footer className="actions">
          <button className="ghost" onClick={() => { setShowOrders(!showOrders); setSending(null); }}>Mes ordres ({count})</button>
          <button className="primary" onClick={submit}>{submitLabel}</button>
        </footer>
      )}
    </main>
  );
}
