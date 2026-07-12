-- MonEcole - Correctif RLS codes_activation
-- Date : 2026-07-12
--
-- A utiliser si l'audit affiche :
-- table_name = codes_activation
-- statut = A_VERIFIER
-- policy_count > 0
--
-- Objectif : supprimer toutes les anciennes policies directes.
-- Cette table doit etre utilisee uniquement par les Edge Functions
-- avec SUPABASE_SERVICE_ROLE_KEY.

begin;

do $$
declare
  p record;
begin
  if to_regclass('public.codes_activation') is not null then
    alter table public.codes_activation enable row level security;
    alter table public.codes_activation force row level security;

    for p in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'codes_activation'
    loop
      execute format('drop policy if exists %I on public.codes_activation', p.policyname);
    end loop;
  end if;
end $$;

commit;

select *
from public.monecole_rls_audit
where table_name = 'codes_activation';
