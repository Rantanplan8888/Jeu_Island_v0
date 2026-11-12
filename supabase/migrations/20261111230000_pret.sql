-- Tour anticipé : chaque joueur peut se déclarer prêt ; quand tous le sont, le tour est résolu tout de suite.
-- Chaque tour a une échéance (minuit, heure de Paris), stockée dans games.deadline.

alter table public.orders add column ready boolean not null default false;
alter table public.games add column deadline timestamptz;

-- Parties déjà en cours : échéance au prochain minuit de Paris.
update public.games
set deadline = (date_trunc('day', now() at time zone 'Europe/Paris') + interval '1 day') at time zone 'Europe/Paris'
where status = 'running' and deadline is null;

-- Qui est prêt pour le tour en cours (sans révéler les ordres eux-mêmes).
create function public.ready_players(p_game uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select o.user_id
  from public.orders o
  join public.games g on g.id = o.game_id and g.turn = o.turn
  where o.game_id = p_game and o.ready and public.is_member(p_game);
$$;

revoke execute on function public.ready_players(uuid) from public, anon;
grant execute on function public.ready_players(uuid) to authenticated;
