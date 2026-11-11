import { useEffect, useState } from 'react';
import { getSession, onSessionChange } from './api';
import { Local } from './Local';
import { Online } from './Online';
import { loadLocal } from './storage';

type Screen = 'home' | 'online' | 'local';

export function App() {
  const [screen, setScreen] = useState<Screen>(() => (getSession() ? 'online' : 'home'));
  const [, rerender] = useState(0);
  useEffect(() => onSessionChange(() => rerender((n) => n + 1)), []);

  if (screen === 'online') return <Online onExit={() => setScreen('home')} />;
  if (screen === 'local') return <Local onExit={() => setScreen('home')} />;

  const hasLocal = loadLocal() !== null;
  return (
    <main className="home">
      <h1>Island</h1>
      <p className="muted">Colonisation d'îles au tour par tour.</p>
      <section className="card">
        <h2>Jouer en ligne</h2>
        <p className="muted">Chacun sur son téléphone. Les ordres se donnent le soir, le tour est résolu chaque matin.</p>
        <button className="primary wide" onClick={() => setScreen('online')}>
          {getSession() ? 'Mes parties' : 'Se connecter'}
        </button>
      </section>
      <section className="card">
        <h2>Partie d'essai</h2>
        <p className="muted">Sur un seul téléphone, en se le passant. Pratique pour découvrir les règles.</p>
        <button className="ghost wide" onClick={() => setScreen('local')}>
          {hasLocal ? "Reprendre la partie d'essai" : "Nouvelle partie d'essai"}
        </button>
      </section>
    </main>
  );
}
