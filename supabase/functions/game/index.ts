// Fonction serveur d'Island (Supabase Edge Function, Deno).
//
// Actions :
//   { action: "start",   gameId }  -> l'hôte lance la partie (génère le plateau)
//   { action: "resolve", gameId }  -> l'hôte force la résolution du tour en cours
//   { action: "resolve-due" }      -> appelé chaque matin (en-tête x-cron-secret) : résout toutes les parties en cours
//
// Le moteur de règles est copié dans ../_shared/engine au moment du déploiement (voir .github/workflows/deploy.yml).
import { createGame, resolveTurn, type GameState, type PlayerOrders } from '../_shared/engine/index.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// Clé de service : la clé « service_role » injectée par Supabase, ou une clé secrète (sb_secret_…) fournie en secret SERVICE_KEY.
const SERVICE_KEY = Deno.env.get('SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
/** Les nouvelles clés (sb_…) ne sont pas des JWT : elles passent uniquement dans l'en-tête apikey. */
const serviceHeaders: Record<string, string> = SERVICE_KEY.startsWith('sb_')
  ? { apikey: SERVICE_KEY }
  : { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Appel PostgREST avec la clé de service (contourne la RLS, uniquement côté serveur). */
async function db<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...serviceHeaders,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(500, `Base de données : ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function currentUser(req: Request): Promise<string> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'Connexion requise');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: auth } });
  if (!res.ok) throw new HttpError(401, 'Session invalide');
  const user = await res.json();
  return user.id as string;
}

interface GameRow {
  id: string;
  host: string;
  status: 'lobby' | 'running' | 'finished';
  max_turns: number;
  turn: number;
  state: GameState | null;
  resolved_at: string | null;
}

async function loadGame(id: string): Promise<GameRow> {
  const rows = await db<GameRow[]>(`games?id=eq.${encodeURIComponent(id)}&select=id,host,status,max_turns,turn,state,resolved_at`);
  const g = rows[0];
  if (!g) throw new HttpError(404, 'Partie introuvable');
  return g;
}

async function startGame(gameId: string, userId: string) {
  const g = await loadGame(gameId);
  if (g.host !== userId) throw new HttpError(403, "Seul l'hôte peut lancer la partie");
  if (g.status !== 'lobby') throw new HttpError(409, 'La partie est déjà lancée');
  const players = await db<{ user_id: string; name: string }[]>(
    `game_players?game_id=eq.${gameId}&select=user_id,name&order=joined_at.asc`,
  );
  if (players.length < 2) throw new HttpError(409, 'Il faut au moins 2 joueurs');
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const state = createGame({ players: players.map((p) => ({ id: p.user_id, name: p.name })), seed, maxTurns: g.max_turns });
  const updated = await db<GameRow[]>(`games?id=eq.${gameId}&status=eq.lobby`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'running', turn: state.turn, state, resolved_at: new Date().toISOString() }),
  });
  if (!updated.length) throw new HttpError(409, 'La partie a changé entre-temps');
  return { ok: true };
}

async function resolveGame(g: GameRow) {
  if (g.status !== 'running' || !g.state) throw new HttpError(409, "La partie n'est pas en cours");
  const rows = await db<{ user_id: string; orders: PlayerOrders }[]>(
    `orders?game_id=eq.${g.id}&turn=eq.${g.turn}&select=user_id,orders`,
  );
  const orders: Record<string, PlayerOrders> = {};
  for (const r of rows) orders[r.user_id] = r.orders;
  const result = resolveTurn(g.state, orders);

  // Mise à jour conditionnelle : si une autre résolution est passée avant, on ne fait rien.
  const updated = await db<GameRow[]>(`games?id=eq.${g.id}&turn=eq.${g.turn}&status=eq.running`, {
    method: 'PATCH',
    body: JSON.stringify({
      state: result.state,
      turn: result.state.turn,
      status: result.state.finished ? 'finished' : 'running',
      resolved_at: new Date().toISOString(),
    }),
  });
  if (!updated.length) return { ok: false, skipped: true };
  await db('turn_reports', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ game_id: g.id, turn: g.turn, events: result.events }),
  });
  return { ok: true, turn: g.turn };
}

async function resolveDue() {
  // Une partie est résolue au plus une fois toutes les 20 heures par la tâche du matin.
  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
  const games = await db<GameRow[]>(
    `games?status=eq.running&or=(resolved_at.is.null,resolved_at.lt.${since})&select=id,host,status,max_turns,turn,state,resolved_at`,
  );
  const results: unknown[] = [];
  for (const g of games) {
    try {
      results.push({ id: g.id, ...(await resolveGame(g)) });
    } catch (e) {
      results.push({ id: g.id, error: String(e) });
    }
  }
  return { resolved: results };
}

function safeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case 'resolve-due':
        if (!safeEqual(req.headers.get('x-cron-secret') ?? '', CRON_SECRET)) throw new HttpError(403, 'Interdit');
        return json(await resolveDue());
      case 'start':
        return json(await startGame(String(body.gameId), await currentUser(req)));
      case 'resolve': {
        const userId = await currentUser(req);
        const g = await loadGame(String(body.gameId));
        if (g.host !== userId) throw new HttpError(403, "Seul l'hôte peut forcer la résolution");
        return json(await resolveGame(g));
      }
      default:
        throw new HttpError(400, 'Action inconnue');
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: e instanceof Error ? e.message : String(e) }, status);
  }
});
