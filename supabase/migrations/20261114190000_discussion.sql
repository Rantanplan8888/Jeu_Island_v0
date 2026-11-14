-- Discussion de partie : un fil de messages par partie, lisible et écrit par ses seuls joueurs.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  user_id uuid not null default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  foreign key (game_id, user_id) references public.game_players (game_id, user_id) on delete cascade
);
create index messages_game_idx on public.messages (game_id, created_at);

alter table public.messages enable row level security;

create policy "membres : lire la discussion" on public.messages
  for select to authenticated using (public.is_member(game_id));

-- On n'écrit qu'en son nom, dans une partie dont on fait partie. L'auteur et l'heure sont fixés par le serveur
-- (seules les colonnes game_id et body peuvent être envoyées).
create policy "membres : écrire dans la discussion" on public.messages
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(game_id));

revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (game_id, body) on public.messages to authenticated;
grant all on public.messages to service_role;
