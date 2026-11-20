import type { GameState, TurnEvent } from '@island/engine';
import type { ReactNode } from 'react';
import { describe, playerColor } from './format';

interface Props {
  state: GameState;
  events: TurnEvent[];
  title: string;
  children?: ReactNode;
  /** Afficher le classement (seulement si la carte de ce tour est connue). */
  showRanking?: boolean;
}

export function Report({ state, events, title, children, showRanking = true }: Props) {
  const battles = events.filter((e) => e.kind === 'battle');
  const news = events.filter((e) => e.kind === 'announcement');
  const others = events.filter((e) => e.kind !== 'battle' && e.kind !== 'income' && e.kind !== 'order_rejected' && e.kind !== 'announcement');
  const ranking = Object.values(state.players)
    .map((p) => ({ p, islands: Object.values(state.islands).filter((i) => i.owner === p.id).length }))
    .sort((a, b) => b.islands - a.islands);

  return (
    <main className="report">
      <h1>{title}</h1>
      {news.length > 0 && (
        <section className="card announcement">
          {news.map((e, i) => <p key={i}>{describe(state, e)}</p>)}
        </section>
      )}
      <section className="card">
        <h2>Batailles</h2>
        {battles.length === 0 ? <p className="muted">{state.viewer ? 'Aucune bataille en vue cette nuit.' : 'Aucune bataille cette nuit.'}</p> : battles.map((e, i) => <p key={i}>{describe(state, e)}</p>)}
      </section>
      {others.length > 0 && (
        <section className="card">
          <h2>Autres événements</h2>
          {others.map((e, i) => <p key={i}>{describe(state, e)}</p>)}
        </section>
      )}
      {showRanking && !state.viewer && <section className="card">
        <h2>Classement</h2>
        {ranking.map(({ p, islands }) => (
          <p key={p.id} className="rank">
            <span className="dot" style={{ background: playerColor(state, p.id) }} /> {p.name} : {islands} île(s)
            {p.eliminated ? ' (éliminé)' : ''}
          </p>
        ))}
      </section>}
      {state.viewer && !state.finished && (
        <p className="muted">Brouillard : tu ne vois que les batailles près de tes îles. Le classement sera révélé à la fin.</p>
      )}
      {children}
    </main>
  );
}
