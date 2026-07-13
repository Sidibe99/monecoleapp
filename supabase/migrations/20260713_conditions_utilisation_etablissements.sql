-- MonEcole - acceptation des conditions d'utilisation par ecole
-- A executer une fois dans Supabase pour garder une trace officielle.

begin;

alter table public.etablissements
  add column if not exists conditions_utilisation_acceptees_at timestamptz,
  add column if not exists conditions_utilisation_version text;

commit;
