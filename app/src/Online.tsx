import type { PlayerOrders, TurnEvent } from '@island/engine';
import { useCallback, useEffect, useState } from 'react';
import { api, getSession, onSessionChange, signIn, signOut, signUp, type GameRow, type PlayerRow } from './api';
import { OrdersScreen } from './OrdersScreen';
import { Report } from './Report';
import { emptyOrders } from './orders';

const NAME_KEY = 'island.playerName';

function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function rememberName(n: string) {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* rien */
  }
}

function useSession() {
  const [s, setS] = useState(getSession());
  useEffect(() => onSessionChange(setS), []);
  return s;
}

export function Online({ onExit }: { onExit: () => void }) {
  const session = useSession();
  const [gameId, setGameId] = useState<string | null>(null);

  if (!session) return <Login onBack={onExit} />;
  if (gameId) return <GameView id={gameId} onBack={() => setGameId(null)} />;
  return <GamesList onOpen={setGameId} onBack={onExit} />;
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="bad">{error}</p> : null;
}

function Login({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else {
        const s = await signUp(email.trim(), password);
        if (!s) setInfo('Compte créé ! Ouvre le lien reçu par e-mail pour le confirmer, puis connecte-toi.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <button className="ghost" onClick={onBack}>← Accueil</button>
      <form className="card" onSubmit={submit}>
        <h2>{mode === 'signin' ? 'Connexion' : 'Créer un compte'}</h2>
        <div className="row"><input type="email" required autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="row">
          <input type="password" required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="Mot de passe (6 caractères min.)" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ErrorLine error={error} />
        {info && <p className="good">{info}</p>}
        <button className="primary wide" disabled={busy}>{busy ? '…' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}</button>
        <button type="button" className="ghost wide" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? "Pas encore de compte ? S'inscrire" : "J'ai déjà un compte"}
        </button>
      </form>
    </main>
  );
}

const STATUS: Record<GameRow['status'], string> = { lobby: 'En attente de joueurs', running: 'En cours', finished: 'Terminée' };

function GamesList({ onOpen, onBack }: { onOpen: (id: string) => void; onBack: () => void }) {
  const [games, setGames] = useState<Omit<GameRow, 'state'>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(savedName());
  const [gameName, setGameName] = useState('');
  const [turns, setTurns] = useState(30);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.myGames().then(setGames).catch((e) => setError(String(e.message ?? e)));
  }, []);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<string>) => {
    if (!name.trim()) return setError('Choisis ton nom de joueur.');
    setBusy(true);
    setError(null);
    rememberName(name.trim());
    try {
      onOpen(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <div className="row">
        <button className="ghost" onClick={onBack}>← Accueil</button>
        <span />
        <button className="ghost" onClick={() => signOut()}>Se déconnecter</button>
      </div>
      <h1>Mes parties</h1>
      <ErrorLine error={error} />
      {games === null ? (
        <p className="muted">Chargement…</p>
      ) : games.length === 0 ? (
        <p className="muted">Aucune partie pour l'instant : crées-en une ou rejoins celle d'un ami.</p>
      ) : (
        games.map((g) => (
          <button key={g.id} className="card game-item" onClick={() => onOpen(g.id)}>
            <b>{g.name}</b>
            <span className="muted">
              {STATUS[g.status]}
              {g.status === 'running' ? ` · tour ${g.turn} / ${g.max_turns}` : ''}
            </span>
          </button>
        ))
      )}

      <section className="card">
        <h2>Mon nom de joueur</h2>
        <div className="row"><input maxLength={30} placeholder="Ex. : Capitaine Zouzou" value={name} onChange={(e) => setName(e.target.value)} /></div>
      </section>

      <section className="card">
        <h2>Rejoindre une partie</h2>
        <div className="row">
          <input placeholder="Code (6 caractères)" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} />
          <button className="primary" disabled={busy || code.trim().length < 6} onClick={() => run(() => api.joinGame(code, name.trim()))}>Rejoindre</button>
        </div>
      </section>

      <section className="card">
        <h2>Créer une partie</h2>
        <div className="row"><input maxLength={60} placeholder="Nom de la partie" value={gameName} onChange={(e) => setGameName(e.target.value)} /></div>
        <div className="row">
          <span>Nombre de tours (jours)</span>
          <input type="number" min={5} max={200} value={turns} onChange={(e) => setTurns(Number(e.target.value) || 30)} />
        </div>
        <button className="primary wide" disabled={busy || !gameName.trim()} onClick={() => run(() => api.createGame(gameName.trim(), name.trim(), turns))}>
          Créer
        </button>
      </section>
    </main>
  );
}

function GameView({ id, onBack }: { id: string; onBack: () => void }) {
  const me = getSession()!.user.id;
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [g, p] = await Promise.all([api.game(id), api.players(id)]);
      setGame(g);
      setPlayers(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  if (!game) return <main className="home"><button className="ghost" onClick={onBack}>← Mes parties</button><ErrorLine error={error} /><p className="muted">Chargement…</p></main>;
  if (game.status === 'lobby' || !game.state) return <Lobby game={game} players={players} me={me} onBack={onBack} reload={load} />;
  return <Playing key={game.turn} game={game} me={me} onBack={onBack} reload={load} />;
}

function Lobby({ game, players, me, onBack, reload }: { game: GameRow; players: PlayerRow[]; me: string; onBack: () => void; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isHost = game.host === me;

  const act = async (fn: () => Promise<unknown>, then?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      (then ?? reload)();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const share = () => {
    const text = `Rejoins ma partie d'Island « ${game.name} » avec le code ${game.code}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(game.code);
  };

  return (
    <main className="home">
      <button className="ghost" onClick={onBack}>← Mes parties</button>
      <h1>{game.name}</h1>
      <section className="card">
        <h2>Code de la partie</h2>
        <p className="code">{game.code}</p>
        <p className="muted">Donne ce code aux autres joueurs pour qu'ils rejoignent la partie.</p>
        <button className="ghost wide" onClick={share}>Partager le code</button>
      </section>
      <section className="card">
        <h2>Joueurs ({players.length} / 20)</h2>
        {players.map((p) => (
          <p key={p.user_id}>
            {p.name}
            {p.user_id === game.host ? ' (hôte)' : ''}
            {p.user_id === me ? ' · toi' : ''}
          </p>
        ))}
        <button className="ghost" onClick={reload}>Actualiser</button>
      </section>
      <ErrorLine error={error} />
      {isHost ? (
        <>
          <button className="primary wide" disabled={busy || players.length < 2} onClick={() => act(() => api.startGame(game.id))}>
            {players.length < 2 ? 'En attente d\'au moins 2 joueurs' : `Lancer la partie (${players.length} joueurs)`}
          </button>
          <button className="ghost wide" disabled={busy} onClick={() => confirm('Supprimer cette partie ?') && act(() => api.deleteGame(game.id), onBack)}>
            Supprimer la partie
          </button>
        </>
      ) : (
        <>
          <p className="muted">En attente du lancement par l'hôte.</p>
          <button className="ghost wide" disabled={busy} onClick={() => act(() => api.leaveGame(game.id), onBack)}>Quitter la partie</button>
        </>
      )}
    </main>
  );
}

type SaveState = { kind: 'loading' } | { kind: 'draft' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'error'; message: string };

function draftKey(id: string, turn: number) {
  return `island.draft.${id}.${turn}`;
}

function Playing({ game, me, onBack, reload }: { game: GameRow; me: string; onBack: () => void; reload: () => void }) {
  const state = game.state!;
  const seenKey = `island.seen.${game.id}.${game.turn}`;
  // Au début d'un nouveau tour, on montre d'abord le rapport de la nuit.
  const [view, setViewState] = useState<'map' | 'report'>(() => {
    if (game.status === 'finished') return 'report';
    try {
      return game.turn > 1 && !localStorage.getItem(seenKey) ? 'report' : 'map';
    } catch {
      return 'map';
    }
  });
  const setView = (v: 'map' | 'report') => {
    if (v === 'map') {
      try { localStorage.setItem(seenKey, '1'); } catch { /* rien */ }
    }
    setViewState(v);
  };
  const [orders, setOrdersState] = useState<PlayerOrders>(emptyOrders());
  const [save, setSave] = useState<SaveState>({ kind: 'loading' });
  const [report, setReport] = useState<TurnEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const isHost = game.host === me;
  const lastTurn = game.turn - 1;

  useEffect(() => {
    let draft: PlayerOrders | null = null;
    try {
      const raw = localStorage.getItem(draftKey(game.id, game.turn));
      draft = raw ? JSON.parse(raw) : null;
    } catch {
      /* rien */
    }
    api
      .myOrders(game.id, game.turn)
      .then((saved) => {
        if (draft) { setOrdersState(draft); setSave({ kind: 'draft' }); }
        else if (saved) { setOrdersState(saved); setSave({ kind: 'saved', at: new Date() }); }
        else setSave({ kind: 'draft' });
      })
      .catch(() => { if (draft) setOrdersState(draft); setSave({ kind: 'draft' }); });
    if (lastTurn >= 1) api.report(game.id, lastTurn).then(setReport).catch(() => setReport(null));
  }, [game.id, game.turn, lastTurn]);

  const setOrders = (o: PlayerOrders) => {
    setOrdersState(o);
    setSave({ kind: 'draft' });
    try {
      localStorage.setItem(draftKey(game.id, game.turn), JSON.stringify(o));
    } catch {
      /* rien */
    }
  };

  const submit = async () => {
    setSave({ kind: 'saving' });
    try {
      await api.saveOrders(game.id, game.turn, orders);
      try { localStorage.removeItem(draftKey(game.id, game.turn)); } catch { /* rien */ }
      setSave({ kind: 'saved', at: new Date() });
    } catch (e) {
      setSave({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const resolveNow = async () => {
    if (!confirm('Résoudre le tour maintenant, sans attendre demain matin ? Les ordres non envoyés seront ignorés.')) return;
    setBusy(true);
    try {
      await api.resolveNow(game.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (view === 'report' || game.status === 'finished') {
    return (
      <Report
        state={state}
        events={report ?? []}
        title={game.status === 'finished' ? 'Fin de la partie' : lastTurn >= 1 ? `Résultat du tour ${lastTurn}` : 'Début de la partie'}
      >
        {game.status !== 'finished' && <button className="primary wide" onClick={() => setView('map')}>Voir la carte et donner mes ordres</button>}
        {isHost && game.status === 'running' && (
          <button className="ghost wide" disabled={busy} onClick={resolveNow}>Résoudre le tour maintenant (hôte)</button>
        )}
        <button className="ghost wide" onClick={onBack}>← Mes parties</button>
      </Report>
    );
  }

  const banner = (
    <div className={`status status-${save.kind}`}>
      {save.kind === 'loading' && 'Chargement de tes ordres…'}
      {save.kind === 'draft' && 'Ordres pas encore envoyés.'}
      {save.kind === 'saving' && 'Envoi…'}
      {save.kind === 'saved' && `✓ Ordres envoyés. Tu peux les modifier jusqu'à la résolution, demain matin.`}
      {save.kind === 'error' && `Échec de l'envoi : ${save.message}`}
    </div>
  );

  return (
    <OrdersScreen
      state={state}
      pid={me}
      orders={orders}
      setOrders={setOrders}
      submitLabel={save.kind === 'saved' ? 'Renvoyer mes ordres' : 'Envoyer mes ordres'}
      onSubmit={submit}
      banner={banner}
      topAction={<button className="icon" onClick={() => setView('report')} aria-label="Rapport du tour">☰</button>}
    />
  );
}
