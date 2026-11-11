import type { GameState, TurnEvent } from '@island/engine';
import type { ReactNode } from 'react';
import { describe, playerColor } from './format';

interface Props {
  state: GameState;
  events: TurnEvent[];
  title: string;
  children?: ReactNode;
}

export function Report({ state, events, title, children }: Props) {
  const battles = events.filter((e) => e.kind === 'battle');
  const others = events.filter((e) => e.kind !== 'battle' && e.kind !== 'income' && e.kind !== 'order_rejected');
  const ranking = Object.values(state.players)
    .map((p) => ({ p, islands: Object.values(state.islands).filter((i) => i.owner === p.id).length }))
    .sort((a, b) => b.islands - a.islands);

  return (
    <main className="report">
      <h1>{title}</h1>
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
      {children}
    </main>
  );
}
