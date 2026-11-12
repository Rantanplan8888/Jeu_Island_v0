-- Brouillard de guerre : les joueurs ne lisent plus l'état complet des parties.
-- La carte et les rapports passent par la fonction serveur « game » (action « view »),
-- qui ne renvoie à chaque joueur que ce qu'il a le droit de voir.

revoke select on public.games from authenticated;
grant select (id, code, name, host, status, max_players, max_turns, turn, resolved_at, created_at, deadline)
  on public.games to authenticated;

revoke select on public.turn_reports from authenticated;
grant select (game_id, turn, created_at) on public.turn_reports to authenticated;
