import { createGame, resolveTurn, type PlayerId, type PlayerOrders } from '@island/engine';
import { useEffect, useState } from 'react';
import { OrdersScreen } from './OrdersScreen';
import { Report } from './Report';
import { colorByIndex, playerColor, playerName } from './format';
import { emptyOrders } from './orders';
import { clearLocal, loadLocal, saveLocal, type LocalGame } from './storage';

/** Partie d'essai sur un seul téléphone : les joueurs se passent l'appareil. */
export function Local({ onExit }: { onExit: () => void }) {
  const [game, setGame] = useState<LocalGame | null>(() => loadLocal());

  useEffect(() => {
    if (game) saveLocal(game);
  }, [game]);

  const quit = (ask: boolean) => {
    if (!ask || confirm("Abandonner cette partie d'essai ?")) {
      clearLocal();
      setGame(null);
    }
  };

  if (!game) return <LocalSetup onStart={setGame} onBack={onExit} />;

  const { state } = game;
  const alive = Object.values(state.players).filter((p) => !p.eliminated).map((p) => p.id).sort();
  const pid: PlayerId = alive[game.current] ?? alive[0]!;
  const orders = game.orders[pid] ?? emptyOrders();

  if (game.phase === 'report' || state.finished) {
    return (
      <Report state={state} events={game.lastEvents} title={state.finished ? 'Fin de la partie' : `Résultat du tour ${state.turn - 1}`}>
        {state.finished ? (
          <button className="primary wide" onClick={() => quit(false)}>Nouvelle partie</button>
        ) : (
          <button className="primary wide" onClick={() => setGame({ ...game, phase: 'handoff' })}>Passer au tour {state.turn}</button>
        )}
      </Report>
    );
  }

  if (game.phase === 'handoff') {
    return (
      <main className="handoff" style={{ borderColor: playerColor(state, pid) }}>
        <p className="muted">Tour {state.turn} / {state.maxTurns}</p>
        <h1 style={{ color: playerColor(state, pid) }}>{playerName(state, pid)}</h1>
        <p>Passe le téléphone à {playerName(state, pid)}. Les autres joueurs ne regardent pas !</p>
        <button className="primary wide" onClick={() => setGame({ ...game, phase: 'orders' })}>
          Je suis {playerName(state, pid)}, voir mes îles
        </button>
        <button className="ghost" onClick={() => quit(true)}>Abandonner la partie</button>
        <button className="ghost" onClick={onExit}>Retour à l'accueil</button>
      </main>
    );
  }

  const setOrders = (o: PlayerOrders) => setGame({ ...game, orders: { ...game.orders, [pid]: o } });
  const submit = () => {
    if (game.current + 1 < alive.length) {
      setGame({ ...game, current: game.current + 1, phase: 'handoff' });
    } else {
      const result = resolveTurn(state, game.orders);
      setGame({ state: result.state, orders: {}, current: 0, phase: 'report', lastEvents: result.events });
    }
  };

  return <OrdersScreen key={pid} state={state} pid={pid} orders={orders} setOrders={setOrders} submitLabel="Valider mes ordres" onSubmit={submit} />;
}

function LocalSetup({ onStart, onBack }: { onStart: (g: LocalGame) => void; onBack: () => void }) {
  const [names, setNames] = useState(['Joueur 1', 'Joueur 2', 'Joueur 3', 'Joueur 4']);
  const [turns, setTurns] = useState(30);

  const start = () => {
    const players = names.map((n, i) => ({ id: `P${String(i + 1).padStart(2, '0')}`, name: n.trim() || `Joueur ${i + 1}` }));
    const state = createGame({ players, seed: Math.floor(Math.random() * 2 ** 31), maxTurns: turns });
    onStart({ state, orders: {}, current: 0, phase: 'handoff', lastEvents: [] });
  };

  return (
    <main className="home">
      <button className="ghost" onClick={onBack}>← Accueil</button>
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
    </main>
  );
}
