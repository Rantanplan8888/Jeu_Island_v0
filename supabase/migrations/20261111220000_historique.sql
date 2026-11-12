-- Historique : on garde la carte (état complet) après chaque tour, pour pouvoir revoir les tours passés.
alter table public.turn_reports add column state jsonb;
