-- Island : schéma initial.
-- Les ordres de chaque joueur restent secrets jusqu'à la résolution (RLS).
-- Les écritures sensibles (lancement, résolution) passent par la fonction serveur « game ».

create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  name text not null check (char_length(name) between 1 and 60),
  host uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'running', 'finished')),
  max_players int not null default 20 check (max_players between 2 and 20),
  max_turns int not null default 30 check (max_turns between 5 and 200),
  turn int not null default 0,
  state jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index game_players_user_idx on public.game_players (user_id);

create table public.orders (
  game_id uuid not null,
  user_id uuid not null,
  turn int not null,
  orders jsonb not null check (octet_length(orders::text) < 20000),
  updated_at timestamptz not null default now(),
  primary key (game_id, user_id, turn),
  foreign key (game_id, user_id) references public.game_players (game_id, user_id) on delete cascade
);

create table public.turn_reports (
  game_id uuid not null references public.games (id) on delete cascade,
  turn int not null,
  events jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, turn)
);

-- Appartenance à une partie (security definer pour éviter la récursion RLS).
create function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.game_players where game_id = g and user_id = (select auth.uid()));
$$;

alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.orders enable row level security;
alter table public.turn_reports enable row level security;

create policy "membres : lire la partie" on public.games
  for select to authenticated using (public.is_member(id));

create policy "membres : voir les joueurs" on public.game_players
  for select to authenticated using (public.is_member(game_id));

create policy "membres : lire les rapports" on public.turn_reports
  for select to authenticated using (public.is_member(game_id));

-- Ordres : chacun ne voit et n'écrit que les siens, pour le tour en cours d'une partie lancée.
create policy "ordres : lire les siens" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));

create policy "ordres : créer pour le tour en cours" on public.orders
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.games g where g.id = game_id and g.status = 'running' and g.turn = orders.turn)
    and public.is_member(game_id)
  );

create policy "ordres : modifier pour le tour en cours" on public.orders
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.games g where g.id = game_id and g.status = 'running' and g.turn = orders.turn)
  );

-- Accès explicites (les nouvelles tables ne sont pas exposées automatiquement).
revoke all on public.games, public.game_players, public.orders, public.turn_reports from anon, authenticated;
grant select on public.games, public.game_players, public.turn_reports to authenticated;
grant select, insert, update on public.orders to authenticated;
grant all on public.games, public.game_players, public.orders, public.turn_reports to service_role;

-- Créer une partie (l'hôte la rejoint automatiquement).
create function public.create_game(p_name text, p_player_name text, p_max_turns int default 30)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into public.games (name, host, max_turns) values (trim(p_name), auth.uid(), p_max_turns) returning id into v_id;
  insert into public.game_players (game_id, user_id, name) values (v_id, auth.uid(), trim(p_player_name));
  return v_id;
end;
$$;

-- Rejoindre une partie pas encore lancée, avec son code.
create function public.join_game(p_code text, p_player_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_game public.games;
  v_count int;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_game from public.games where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Code de partie inconnu'; end if;
  if exists (select 1 from public.game_players where game_id = v_game.id and user_id = auth.uid()) then
    return v_game.id;
  end if;
  if v_game.status <> 'lobby' then raise exception 'La partie a déjà commencé'; end if;
  select count(*) into v_count from public.game_players where game_id = v_game.id;
  if v_count >= v_game.max_players then raise exception 'La partie est complète'; end if;
  insert into public.game_players (game_id, user_id, name) values (v_game.id, auth.uid(), trim(p_player_name));
  return v_game.id;
end;
$$;

-- Quitter une partie pas encore lancée (l'hôte ne peut pas quitter, il peut la supprimer).
create function public.leave_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.game_players gp
  using public.games g
  where gp.game_id = p_game and gp.user_id = auth.uid() and g.id = p_game and g.status = 'lobby' and g.host <> auth.uid();
end;
$$;

create function public.delete_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.games where id = p_game and host = auth.uid();
end;
$$;

revoke execute on function public.is_member(uuid), public.create_game(text, text, int), public.join_game(text, text),
  public.leave_game(uuid), public.delete_game(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.create_game(text, text, int), public.join_game(text, text),
  public.leave_game(uuid), public.delete_game(uuid) to authenticated;
