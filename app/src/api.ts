/**
 * Mini-client Supabase (authentification, base de données, fonction serveur) écrit à la main
 * pour garder l'appli légère. Il ne parle qu'au projet Supabase d'Island.
 */
import type { GameState, PlayerOrders, TurnEvent } from '@island/engine';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://zodxkoiuvewnpzcjtbiu.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_6S86OYObq3xpMAce3UNYBQ_if8lEV4_';
const SESSION_KEY = 'island.session.v1';

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // secondes
  user: { id: string; email?: string };
}

export class ApiError extends Error {}

let session: Session | null = readSession();
const listeners = new Set<(s: Session | null) => void>();

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function setSession(s: Session | null) {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l(s));
}

export function getSession() {
  return session;
}

export function onSessionChange(cb: (s: Session | null) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = (b.msg ?? b.message ?? b.error_description ?? b.error) as string | undefined;
    if (msg) return translate(String(msg));
  }
  return fallback;
}

function translate(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
  if (/already registered/i.test(msg)) return 'Un compte existe déjà avec cet e-mail.';
  if (/email not confirmed/i.test(msg)) return "Confirme d'abord ton e-mail (lien reçu par e-mail).";
  if (/password should be at least/i.test(msg)) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (/rate limit/i.test(msg)) return 'Trop de tentatives, réessaie dans quelques minutes.';
  return msg;
}

async function authRequest(path: string, body: unknown): Promise<Session | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(errorMessage(data, 'Connexion impossible.'));
  if (!data.access_token) return null; // inscription en attente de confirmation par e-mail
  const s: Session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    user: { id: data.user.id, email: data.user.email },
  };
  setSession(s);
  return s;
}

export function signIn(email: string, password: string) {
  return authRequest('token?grant_type=password', { email, password });
}

export function signUp(email: string, password: string) {
  return authRequest('signup', { email, password });
}

export async function signOut() {
  const s = session;
  setSession(null);
  if (s) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${s.access_token}` },
    }).catch(() => {});
  }
}

let refreshing: Promise<void> | null = null;

async function freshToken(): Promise<string> {
  if (!session) throw new ApiError('Connexion requise.');
  if (session.expires_at - 60 < Date.now() / 1000) {
    refreshing ??= authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
      .then(() => undefined)
      .catch((e) => {
        setSession(null);
        throw e;
      })
      .finally(() => {
        refreshing = null;
      });
    await refreshing;
  }
  return session!.access_token;
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await freshToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status === 401) setSession(null);
  if (!res.ok) throw new ApiError(errorMessage(data, `Erreur ${res.status}`));
  return data as T;
}

const rest = <T>(path: string, init?: RequestInit) => request<T>(`${SUPABASE_URL}/rest/v1/${path}`, init);
const rpc = <T>(fn: string, args: Record<string, unknown>) =>
  request<T>(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
const fn = <T>(action: string, args: Record<string, unknown>) =>
  request<T>(`${SUPABASE_URL}/functions/v1/game`, { method: 'POST', body: JSON.stringify({ action, ...args }) });

// ---- Données du jeu ----

export interface GameRow {
  id: string;
  code: string;
  name: string;
  host: string;
  status: 'lobby' | 'running' | 'finished';
  max_turns: number;
  turn: number;
  state: GameState | null;
  resolved_at: string | null;
}

export interface PlayerRow {
  user_id: string;
  name: string;
}

export const api = {
  myGames: () =>
    rest<{ games: Omit<GameRow, 'state'> }[]>(
      `game_players?user_id=eq.${session?.user.id}&select=games(id,code,name,host,status,max_turns,turn,resolved_at)&order=joined_at.desc`,
    ).then((rows) => rows.map((r) => r.games)),
  game: (id: string) => rest<GameRow[]>(`games?id=eq.${id}&select=*`).then((r) => r[0] ?? null),
  players: (id: string) => rest<PlayerRow[]>(`game_players?game_id=eq.${id}&select=user_id,name&order=joined_at.asc`),
  createGame: (name: string, playerName: string, maxTurns: number) =>
    rpc<string>('create_game', { p_name: name, p_player_name: playerName, p_max_turns: maxTurns }),
  joinGame: (code: string, playerName: string) => rpc<string>('join_game', { p_code: code, p_player_name: playerName }),
  leaveGame: (id: string) => rpc<void>('leave_game', { p_game: id }),
  deleteGame: (id: string) => rpc<void>('delete_game', { p_game: id }),
  startGame: (id: string) => fn<{ ok: boolean }>('start', { gameId: id }),
  resolveNow: (id: string) => fn<{ ok: boolean }>('resolve', { gameId: id }),
  myOrders: (id: string, turn: number) =>
    rest<{ orders: PlayerOrders }[]>(`orders?game_id=eq.${id}&turn=eq.${turn}&user_id=eq.${session?.user.id}&select=orders`).then(
      (r) => r[0]?.orders ?? null,
    ),
  saveOrders: (id: string, turn: number, orders: PlayerOrders) =>
    rest<void>('orders?on_conflict=game_id,user_id,turn', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ game_id: id, user_id: session?.user.id, turn, orders, updated_at: new Date().toISOString() }),
    }),
  /** Rapport d'un tour, avec la carte après ce tour (absente pour les tours joués avant l'historique). */
  report: (id: string, turn: number) =>
    rest<{ events: TurnEvent[]; state: GameState | null }[]>(`turn_reports?game_id=eq.${id}&turn=eq.${turn}&select=events,state`).then(
      (r) => r[0] ?? null,
    ),
};
