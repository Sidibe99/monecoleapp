-- MonEcole - RLS isolation des ecoles
-- Phase 1 : protege les donnees scolaires par etablissement_id.
--
-- A executer dans Supabase SQL Editor.
-- Principe :
-- 1. L'utilisateur connecte est retrouve dans public.utilisateurs via auth.uid().
-- 2. Son etablissement_id devient son ecole active.
-- 3. Toutes les tables scolaires ne sont lisibles/modifiables que si
--    leur etablissement_id correspond a cette ecole.
--
-- Note : cette phase ne verrouille pas encore public.etablissements ni
-- public.codes_activation afin de ne pas bloquer l'espace editeur actuel.
-- Quand les actions editeur seront toutes passees par Edge Functions
-- securisees, on pourra activer une phase 2 plus stricte.

create or replace function public.current_etablissement_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select u.etablissement_id::bigint
  from public.utilisateurs u
  where u.auth_id = auth.uid()
  order by u.id
  limit 1
$$;

revoke all on function public.current_etablissement_id() from public;
grant execute on function public.current_etablissement_id() to authenticated;

do $$
declare
  t text;
  tables_etablissement_id text[] := array[
    'utilisateurs',
    'classes',
    'matieres',
    'eleves',
    'paiements',
    'presences',
    'messages',
    'compositions',
    'professeurs',
    'salaires',
    'absences_prof',
    'emploi_temps',
    'conversations',
    'titres_jour',
    'depenses',
    'audit_logs',
    'password_reset_requests'
  ];
begin
  foreach t in array tables_etablissement_id loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists monecole_ecole_select on public.%I', t);
      execute format('drop policy if exists monecole_ecole_insert on public.%I', t);
      execute format('drop policy if exists monecole_ecole_update on public.%I', t);
      execute format('drop policy if exists monecole_ecole_delete on public.%I', t);

      execute format(
        'create policy monecole_ecole_select on public.%I
         for select to authenticated
         using (etablissement_id = public.current_etablissement_id())',
        t
      );

      execute format(
        'create policy monecole_ecole_insert on public.%I
         for insert to authenticated
         with check (etablissement_id = public.current_etablissement_id())',
        t
      );

      execute format(
        'create policy monecole_ecole_update on public.%I
         for update to authenticated
         using (etablissement_id = public.current_etablissement_id())
         with check (etablissement_id = public.current_etablissement_id())',
        t
      );

      execute format(
        'create policy monecole_ecole_delete on public.%I
         for delete to authenticated
         using (etablissement_id = public.current_etablissement_id())',
        t
      );
    end if;
  end loop;
end $$;

-- Sessions : ce n'est pas une table par ecole, mais par utilisateur Auth.
do $$
begin
  if to_regclass('public.sessions') is not null then
    alter table public.sessions enable row level security;

    drop policy if exists monecole_sessions_select on public.sessions;
    drop policy if exists monecole_sessions_insert on public.sessions;
    drop policy if exists monecole_sessions_update on public.sessions;
    drop policy if exists monecole_sessions_delete on public.sessions;

    create policy monecole_sessions_select on public.sessions
      for select to authenticated
      using (auth_uid = auth.uid());

    create policy monecole_sessions_insert on public.sessions
      for insert to authenticated
      with check (auth_uid = auth.uid());

    create policy monecole_sessions_update on public.sessions
      for update to authenticated
      using (auth_uid = auth.uid())
      with check (auth_uid = auth.uid());

    create policy monecole_sessions_delete on public.sessions
      for delete to authenticated
      using (auth_uid = auth.uid());
  end if;
end $$;

-- Fichiers Supabase Storage.
-- L'application range les fichiers dans le bucket "fichiers" avec un chemin
-- qui commence par l'id de l'ecole : {etablissement_id}/nom-du-fichier.
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists monecole_fichiers_select on storage.objects;
    drop policy if exists monecole_fichiers_insert on storage.objects;
    drop policy if exists monecole_fichiers_update on storage.objects;
    drop policy if exists monecole_fichiers_delete on storage.objects;

    create policy monecole_fichiers_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'fichiers'
        and (storage.foldername(name))[1] = public.current_etablissement_id()::text
      );

    create policy monecole_fichiers_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'fichiers'
        and (storage.foldername(name))[1] = public.current_etablissement_id()::text
      );

    create policy monecole_fichiers_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'fichiers'
        and (storage.foldername(name))[1] = public.current_etablissement_id()::text
      )
      with check (
        bucket_id = 'fichiers'
        and (storage.foldername(name))[1] = public.current_etablissement_id()::text
      );

    create policy monecole_fichiers_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'fichiers'
        and (storage.foldername(name))[1] = public.current_etablissement_id()::text
      );
  end if;
end $$;
