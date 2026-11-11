import { createGame, resolveTurn, type GameState, type IslandId, type PlayerId, type PlayerOrders, type TurnEvent } from '@island/engine';
import { useEffect, useMemo, useState } from 'react';
import { GameMap } from './GameMap';
import { IslandPanel, SendDialog } from './IslandPanel';
import { OrdersList } from './OrdersList';
import { colorByIndex, describe, playerColor, playerName } from './format';
import { emptyOrders, rejectedReasons, remaining, targetsFrom, type TargetKind } from './orders';
import { clearLocal, loadLocal, saveLocal, type LocalGame } from './storage';

export function App() {
  const [game, setGame] = useState<LocalGame | null>(() => loadLocal());

  useEffect(() => {
    if (game) saveLocal(game);
  }, [game]);

  if (!game) return <Home onStart={setGame} />;
  return (
    <LocalPlay
      game={game}
      setGame={setGame}
      onQuit={(ask) => {
        if (!ask || confirm('Abandonner cette partie d\'essai ?')) {
          clearLocal();
          setGame(null);
        }
      }}
    />
  );
}

function Home({ onStart }: { onStart: (g: LocalGame) => void }) {
  const [names, setNames] = useState(['Joueur 1', 'Joueur 2', 'Joueur 3', 'Joueur 4']);
  const [turns, setTurns] = useState(30);

  const start = () => {
    const players = names.map((n, i) => ({ id: `P${String(i + 1).padStart(2, '0')}`, name: n.trim() || `Joueur ${i + 1}` }));
    const state = createGame({ players, seed: Math.floor(Math.random() * 2 ** 31), maxTurns: turns });
    onStart({ state, orders: {}, current: 0, phase: 'handoff', lastEvents: [] });
  };

  return (
    <main className="home">
      <h1>Island</h1>
      <p className="muted">Colonisation d'îles au tour par tour.</p>
      <section className="card">
        <h2>Partie d'essai sur ce téléphone</h2>
        <p className="muted">Chaque joueur donne ses ordres à son tour en se passant le téléphone, puis le tour est résolu.</p>
        {names.map((n, i) => (
          <div className="row" key={i}>
            <span className="dot" style={{ background: colorByIndex(i) }} />
            <input value={n} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Nom du joueur ${i + 1}`} />
            {names.length > 2 && (
              <button className="ghost" onClick={() => setNames(names.filter((_, j) => j !== i))} aria-label="Retirer">✕</button>
            )}
          </div>
        ))}
        {names.length < 20 && (
          <button className="ghost" onClick={() => setNames([...names, `Joueur ${names.length + 1}`])}>+ Ajouter un joueur</button>
        )}
        <div className="row">
          <span>Nombre de tours</span>
          <input type="number" min={5} max={100} value={turns} onChange={(e) => setTurns(Number(e.target.value) || 30)} />
        </div>
        <button className="primary wide" onClick={start}>Commencer</button>
      </section>
      <section className="card muted">
        <h2>Bientôt</h2>
        <p>Parties en ligne : chacun joue sur son téléphone, les tours sont résolus chaque matin.</p>
      </section>
    </main>
  );
}

function LocalPlay({ game, setGame, onQuit }: { game: LocalGame; setGame: (g: LocalGame) => void; onQuit: (ask: boolean) => void }) {
  const { state } = game;
  const alive = Object.values(state.players).filter((p) => !p.eliminated).map((p) => p.id).sort();
  const pid: PlayerId = alive[game.current] ?? alive[0]!;
  const orders = game.orders[pid] ?? emptyOrders();

  const [selected, setSelected] = useState<IslandId | null>(null);
  const [targeting, setTargeting] = useState<IslandId | null>(null);
  const [sending, setSending] = useState<{ from: IslandId; to: IslandId; kind: TargetKind } | null>(null);
  const [showOrders, setShowOrders] = useState(false);

  const targets = useMemo(() => (targeting ? targetsFrom(state, pid, targeting) : null), [state, pid, targeting]);
  const setOrders = (o: PlayerOrders) => setGame({ ...game, orders: { ...game.orders, [pid]: o } });
  const reset = () => { setSelected(null); setTargeting(null); setSending(null); setShowOrders(false); };

  if (game.phase === 'report' || state.finished) {
    return <Report state={state} events={game.lastEvents} finished={state.finished} onNext={() => setGame({ ...game, phase: 'handoff' })} onNewGame={() => onQuit(false)} />;
  }

  if (game.phase === 'handoff') {
    return (
      <main className="handoff" style={{ borderColor: playerColor(state, pid) }}>
        <p className="muted">Tour {state.turn} / {state.maxTurns}</p>
        <h1 style={{ color: playerColor(state, pid) }}>{playerName(state, pid)}</h1>
        <p>Passe le téléphone à {playerName(state, pid)}. Les autres joueurs ne regardent pas !</p>
        <button className="primary wide" onClick={() => { reset(); setGame({ ...game, phase: 'orders' }); }}>Je suis {playerName(state, pid)}, voir mes îles</button>
        <button className="ghost" onClick={() => onQuit(true)}>Abandonner la partie</button>
      </main>
    );
  }

  const tap = (id: IslandId) => {
    if (targeting) {
      const kind = targets?.get(id);
      if (kind) { setSending({ from: targeting, to: id, kind }); setTargeting(null); }
      else if (id === targeting) setTargeting(null);
      return;
    }
    setSelected(id);
    setSending(null);
  };

  const finishOrders = () => {
    const problems = rejectedReasons(state, pid, orders);
    if (problems.length && !confirm(`Certains ordres seront refusés :\n\n${problems.join('\n')}\n\nValider quand même ?`)) return;
    reset();
    if (game.current + 1 < alive.length) {
      setGame({ ...game, current: game.current + 1, phase: 'handoff' });
    } else {
      const result = resolveTurn(state, game.orders);
      setGame({ state: result.state, orders: {}, current: 0, phase: 'report', lastEvents: result.events });
    }
  };

  const left = remaining(state, pid, orders);
  const count = orders.recruits!.length + orders.builds!.length + orders.moves!.length + orders.attacks!.length;

  return (
    <main className="play">
      <header className="topbar" style={{ borderBottomColor: playerColor(state, pid) }}>
        <span className="dot" style={{ background: playerColor(state, pid) }} />
        <b>{playerName(state, pid)}</b>
        <span className="muted">Tour {state.turn}</span>
        <span className="res">🪙 {left.gold}</span>
        <span className="res">🪵 {left.wood}</span>
      </header>

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
          pid={pid}
          orders={orders}
          islandId={selected}
          setOrders={setOrders}
          onSend={() => setTargeting(selected)}
          onClose={() => setSelected(null)}
        />
      ) : !targeting ? (
        <p className="hint">Touche une de tes îles pour recruter, construire ou envoyer des troupes.</p>
      ) : null}

      <footer className="actions">
        <button className="ghost" onClick={() => { setShowOrders(!showOrders); setSending(null); }}>Mes ordres ({count})</button>
        <button className="primary" onClick={finishOrders}>Valider mes ordres</button>
      </footer>
    </main>
  );
}

function Report({ state, events, finished, onNext, onNewGame }: { state: GameState; events: TurnEvent[]; finished: boolean; onNext: () => void; onNewGame: () => void }) {
  const battles = events.filter((e) => e.kind === 'battle');
  const others = events.filter((e) => e.kind !== 'battle' && e.kind !== 'income');
  const ranking = Object.values(state.players)
    .map((p) => ({ p, islands: Object.values(state.islands).filter((i) => i.owner === p.id).length }))
    .sort((a, b) => b.islands - a.islands);

  return (
    <main className="report">
      <h1>{finished ? 'Fin de la partie' : `Résultat du tour ${state.turn - 1}`}</h1>
      <section className="card">
        <h2>Batailles</h2>
        {battles.length === 0 ? <p className="muted">Aucune bataille cette nuit.</p> : battles.map((e, i) => <p key={i}>{describe(state, e)}</p>)}
      </section>
      {others.length > 0 && (
        <section className="card">
          <h2>Autres événements</h2>
          {others.map((e, i) => <p key={i}>{describe(state, e)}</p>)}
        </section>
      )}
      <section className="card">
        <h2>Classement</h2>
        {ranking.map(({ p, islands }) => (
          <p key={p.id} className="rank">
            <span className="dot" style={{ background: playerColor(state, p.id) }} /> {p.name} : {islands} île(s)
            {p.eliminated ? ' (éliminé)' : ''}
          </p>
        ))}
      </section>
      {finished ? (
        <button className="primary wide" onClick={onNewGame}>Nouvelle partie</button>
      ) : (
        <button className="primary wide" onClick={onNext}>Passer au tour {state.turn}</button>
      )}
    </main>
  );
}
