import type { GameState } from '@island/engine';
import { useEffect, useRef, useState } from 'react';
import { api, type ChatMessage } from './api';
import { playerColor } from './format';

/** Dernier message lu, par partie (pour la pastille « non lus »). */
const seenKey = (gameId: string) => `island.chat.seen.${gameId}`;
export function lastSeen(gameId: string): string {
  try { return localStorage.getItem(seenKey(gameId)) ?? ''; } catch { return ''; }
}
function markSeen(gameId: string, at: string) {
  try { localStorage.setItem(seenKey(gameId), at); } catch { /* rien */ }
}

/**
 * Discussion de la partie. Ouverte, elle se met à jour toutes les 8 secondes (seulement quand l'appli est à
 * l'écran) ; fermée, l'écran de jeu ne vérifie les nouveaux messages qu'avec le reste, toutes les 30 secondes.
 */
export function Chat({ gameId, state, me, onClose }: {
  gameId: string;
  state: GameState;
  me: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef('');

  useEffect(() => {
    let alive = true;
    const add = (fresh: ChatMessage[]) => {
      if (!alive || fresh.length === 0) return;
      setMessages((old) => {
        const ids = new Set((old ?? []).map((m) => m.id));
        return [...(old ?? []), ...fresh.filter((m) => !ids.has(m.id))];
      });
    };
    api.chat(gameId).then((m) => { if (alive) { setMessages(m); } }).catch(() => alive && setMessages([]));
    const poll = () => {
      if (document.visibilityState !== 'visible' || !lastRef.current) return;
      api.chat(gameId, lastRef.current).then(add).catch(() => {});
    };
    const t = setInterval(poll, 8_000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [gameId]);

  // Toujours afficher le bas du fil, et retenir le dernier message vu.
  useEffect(() => {
    const last = messages?.[messages.length - 1];
    if (last) { lastRef.current = last.created_at; markSeen(gameId, last.created_at); }
    else if (messages) lastRef.current = new Date(0).toISOString();
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, gameId]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const m = await api.sendChat(gameId, body);
      setMessages((old) => [...(old ?? []).filter((x) => x.id !== m.id), m]);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const nameOf = (uid: string) => state.players[uid]?.name ?? 'Ancien joueur';
  let prevDay = '';

  return (
    <div className="help-overlay chat" role="dialog" aria-modal="true" aria-label="Discussion">
      <div className="chat-inner">
        <div className="row chat-head">
          <h1>💬 Discussion</h1>
          <button className="close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <p className="muted chat-note">Visible par tous les joueurs de la partie.</p>
        <div className="chat-list" ref={listRef}>
          {messages === null && <p className="muted">Chargement…</p>}
          {messages?.length === 0 && <p className="muted">Aucun message pour l'instant. Lance la conversation !</p>}
          {messages?.map((m) => {
            const d = new Date(m.created_at);
            const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const showDay = day !== prevDay;
            prevDay = day;
            const mine = m.user_id === me;
            return (
              <div key={m.id}>
                {showDay && <div className="chat-day">{day}</div>}
                <div className={`chat-msg${mine ? ' mine' : ''}`}>
                  {!mine && (
                    <div className="chat-author">
                      <span className="dot" style={{ background: playerColor(state, m.user_id) }} /> {nameOf(m.user_id)}
                    </div>
                  )}
                  <div className="chat-body">{m.body}</div>
                  <div className="chat-time">{d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            );
          })}
        </div>
        {error && <p className="bad">{error}</p>}
        <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Ton message…"
            aria-label="Ton message"
            enterKeyHint="send"
          />
          <button className="primary" disabled={!text.trim() || sending} aria-label="Envoyer">➤</button>
        </form>
      </div>
    </div>
  );
}
