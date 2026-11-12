import { createGame, eventsFor, resolveTurn, viewFor, type PlayerId, type PlayerOrders } from '@island/engine';
import { useEffect, useState } from 'react';
import { OrdersScreen } from './OrdersScreen';
import { Report } from './Report';
import { colorByIndex, playerColor, playerName } from './format';
import { emptyOrders } from './orders';
import { clearLocal, loadLocal, saveLocal, type LocalGame } from './storage';

/** Partie d'essai sur un seul téléphone : les joueurs se passent l'appareil. */
export function Local({ onExit }: { onExit: () => void }) {
  const [game, setGame] = useState<LocalGame | null>(() => loadLocal());
  const [showMap, setShowMap] = useState(false);

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

  // Carte finale : tout est révélé. Pendant la partie, chacun ne voit que sa propre carte.
  if (showMap && state.finished) {
    return (
      <OrdersScreen
        state={state}
        pid={alive[0] ?? Object.keys(state.players)[0]!}
        orders={emptyOrders()}
        setOrders={() => {}}
        submitLabel=""
        onSubmit={() => {}}
        readOnly
        banner={<div className="status status-saved">Carte finale (consultation)</div>}
        topAction={<button className="icon" onClick={() => setShowMap(false)} aria-label="Retour au rapport">←</button>}
      />
    );
  }

  if (state.finished) {
    return (
      <Report state={state} events={game.lastEvents} title="Fin de la partie">
        <button className="ghost wide" onClick={() => setShowMap(true)}>Voir la carte finale</button>
        <button className="primary wide" onClick={() => quit(false)}>Nouvelle partie</button>
      </Report>
    );
  }

  if (game.phase === 'report') {
    // Écran commun : seulement ce que tout le monde sait (éliminations).
    const pub = game.lastEvents.filter((e) => e.kind === 'eliminated');
    return (
      <main className="handoff">
        <h1>La nuit du tour {state.turn - 1} est passée</h1>
        {pub.map((e, i) => <p key={i}>{e.kind === 'eliminated' && `${playerName(state, e.player)} n'a plus d'île : éliminé(e).`}</p>)}
        <p className="muted">Chaque joueur découvrira en privé ce qu'il a vu cette nuit.</p>
        <button className="primary wide" onClick={() => setGame({ ...game, phase: 'handoff' })}>Passer au tour {state.turn}</button>
        <button className="ghost" onClick={() => quit(true)}>Abandonner la partie</button>
      </main>
    );
  }

  if (game.phase === 'handoff') {
    const next = state.turn > 1 ? 'news' : 'orders';
    return (
      <main className="handoff" style={{ borderColor: playerColor(state, pid) }}>
        <p className="muted">Tour {state.turn} / {state.maxTurns}</p>
        <h1 style={{ color: playerColor(state, pid) }}>{playerName(state, pid)}</h1>
        <p>Passe le téléphone à {playerName(state, pid)}. Les autres joueurs ne regardent pas !</p>
        <button className="primary wide" onClick={() => setGame({ ...game, phase: next })}>
          Je suis {playerName(state, pid)}, voir mes îles
        </button>
        <button className="ghost" onClick={() => quit(true)}>Abandonner la partie</button>
        <button className="ghost" onClick={onExit}>Retour à l'accueil</button>
      </main>
    );
  }

  const view = viewFor(state, pid);

  if (game.phase === 'news') {
    const events = eventsFor(game.lastEvents, game.prevState ?? state, state, pid);
    return (
      <Report state={view} events={events} title={`Ta nuit du tour ${state.turn - 1}`}>
        <button className="primary wide" onClick={() => setGame({ ...game, phase: 'orders' })}>Donner mes ordres du tour {state.turn}</button>
      </Report>
    );
  }

  const setOrders = (o: PlayerOrders) => setGame({ ...game, orders: { ...game.orders, [pid]: o } });
  const submit = () => {
    if (game.current + 1 < alive.length) {
      setGame({ ...game, current: game.current + 1, phase: 'handoff' });
    } else {
      const result = resolveTurn(state, game.orders);
      setGame({ state: result.state, prevState: state, orders: {}, current: 0, phase: 'report', lastEvents: result.events });
    }
  };

  return <OrdersScreen key={pid} state={view} pid={pid} orders={orders} setOrders={setOrders} submitLabel="Valider mes ordres" onSubmit={submit} />;
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
