-- MonEcole - RLS complet / isolation stricte des ecoles
-- Date : 2026-07-12
--
-- Objectif :
-- - Une ecole connectee ne peut lire/modifier que ses propres donnees.
-- - Les tables createur/codes restent accessibles uniquement via Edge Functions service_role.
-- - Le stockage Supabase est limite au dossier de l'ecole.
-- - Un rapport public.monecole_rls_audit permet de verifier les protections.
--
-- A executer dans Supabase SQL Editor, apres les phases 1 et 2 si elles
-- ont deja ete lancees. Le script est idempotent : il peut etre relance.

begin;

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

create or replace function public.monecole_is_current_etablissement(p_etablissement_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_etablissement_id is not null
     and p_etablissement_id = public.current_etablissement_id()
$$;

revoke all on function public.monecole_is_current_etablissement(bigint) from public;
grant execute on function public.monecole_is_current_etablissement(bigint) to authenticated;

-- Tables qui doivent porter etablissement_id.
-- Si une table n'existe pas dans une base plus ancienne, elle est ignoree.
do $$
declare
  t text;
  school_tables text[] := array[
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
    'password_reset_requests',
    'fichiers'
  ];
begin
  foreach t in array school_tables loop
    if to_regclass('public.' || t) is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = t
           and column_name = 'etablissement_id'
       ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I force row level security', t);

      execute format('drop policy if exists monecole_ecole_select on public.%I', t);
      execute format('drop policy if exists monecole_ecole_insert on public.%I', t);
      execute format('drop policy if exists monecole_ecole_update on public.%I', t);
      execute format('drop policy if exists monecole_ecole_delete on public.%I', t);
      execute format('drop policy if exists monecole_isolation_select on public.%I', t);
      execute format('drop policy if exists monecole_isolation_insert on public.%I', t);
      execute format('drop policy if exists monecole_isolation_update on public.%I', t);
      execute format('drop policy if exists monecole_isolation_delete on public.%I', t);

      execute format(
        'create policy monecole_isolation_select on public.%I
         for select to authenticated
         using (public.monecole_is_current_etablissement(etablissement_id::bigint))',
        t
      );

      execute format(
        'create policy monecole_isolation_insert on public.%I
         for insert to authenticated
         with check (public.monecole_is_current_etablissement(etablissement_id::bigint))',
        t
      );

      execute format(
        'create policy monecole_isolation_update on public.%I
         for update to authenticated
         using (public.monecole_is_current_etablissement(etablissement_id::bigint))
         with check (public.monecole_is_current_etablissement(etablissement_id::bigint))',
        t
      );

      execute format(
        'create policy monecole_isolation_delete on public.%I
         for delete to authenticated
         using (public.monecole_is_current_etablissement(etablissement_id::bigint))',
        t
      );
    else
      raise notice 'MonEcole RLS : table %. ignoree (absente ou sans etablissement_id).', t;
    end if;
  end loop;
end $$;

-- Etablissements : chaque ecole lit/modifie uniquement sa fiche.
-- Creation/suppression d'ecole : Edge Functions service_role uniquement.
do $$
begin
  if to_regclass('public.etablissements') is not null then
    alter table public.etablissements enable row level security;
    alter table public.etablissements force row level security;

    drop policy if exists monecole_etablissement_select on public.etablissements;
    drop policy if exists monecole_etablissement_update on public.etablissements;
    drop policy if exists monecole_etablissement_insert on public.etablissements;
    drop policy if exists monecole_etablissement_delete on public.etablissements;
    drop policy if exists monecole_isolation_etablissement_select on public.etablissements;
    drop policy if exists monecole_isolation_etablissement_update on public.etablissements;

    create policy monecole_isolation_etablissement_select on public.etablissements
      for select to authenticated
      using (id::bigint = public.current_etablissement_id());

    create policy monecole_isolation_etablissement_update on public.etablissements
      for update to authenticated
      using (id::bigint = public.current_etablissement_id())
      with check (id::bigint = public.current_etablissement_id());
  end if;
end $$;

-- Codes d'activation : aucune lecture directe depuis la cle anon/auth.
-- Les codes sont geres par generer-code, creer-ecole, renouveler et
-- editeur-admin avec SUPABASE_SERVICE_ROLE_KEY.
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

-- Lecture publique tres limitee : l'app peut connaitre les langues d'un code,
-- sans exposer toute la table codes_activation. Si une ancienne base n'a pas
-- encore la colonne langues, on renvoie simplement francais par defaut.
do $$
begin
  if to_regclass('public.codes_activation') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'codes_activation'
         and column_name = 'langues'
     ) then
    execute $fn$
      create or replace function public.get_activation_code_langues(p_code text)
      returns jsonb
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select coalesce(to_jsonb(c.langues), '["fr"]'::jsonb)
        from public.codes_activation c
        where c.code = upper(trim(p_code))
        limit 1
      $body$
    $fn$;
  else
    execute $fn$
      create or replace function public.get_activation_code_langues(p_code text)
      returns jsonb
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select '["fr"]'::jsonb
      $body$
    $fn$;
  end if;
end $$;

revoke all on function public.get_activation_code_langues(text) from public;
grant execute on function public.get_activation_code_langues(text) to anon, authenticated;

-- Sessions : protection par utilisateur Auth.
do $$
begin
  if to_regclass('public.sessions') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'sessions'
         and column_name = 'auth_uid'
     ) then
    alter table public.sessions enable row level security;
    alter table public.sessions force row level security;

    drop policy if exists monecole_sessions_select on public.sessions;
    drop policy if exists monecole_sessions_insert on public.sessions;
    drop policy if exists monecole_sessions_update on public.sessions;
    drop policy if exists monecole_sessions_delete on public.sessions;
    drop policy if exists monecole_isolation_sessions_select on public.sessions;
    drop policy if exists monecole_isolation_sessions_insert on public.sessions;
    drop policy if exists monecole_isolation_sessions_update on public.sessions;
    drop policy if exists monecole_isolation_sessions_delete on public.sessions;

    create policy monecole_isolation_sessions_select on public.sessions
      for select to authenticated
      using (auth_uid = auth.uid());

    create policy monecole_isolation_sessions_insert on public.sessions
      for insert to authenticated
      with check (auth_uid = auth.uid());

    create policy monecole_isolation_sessions_update on public.sessions
      for update to authenticated
      using (auth_uid = auth.uid())
      with check (auth_uid = auth.uid());

    create policy monecole_isolation_sessions_delete on public.sessions
      for delete to authenticated
      using (auth_uid = auth.uid());
  end if;
end $$;

-- Storage : Supabase gere storage.objects avec un proprietaire special.
-- Dans certains projets, le SQL Editor n'a pas le droit de modifier cette
-- table systeme et renvoie "must be owner of table objects".
-- On protege donc ici la table public.fichiers, et les policies du bucket
-- seront configurees dans Supabase Storage si necessaire.
do $$
begin
  raise notice 'MonEcole RLS : storage.objects non modifie par ce script. Configurer le bucket fichiers depuis Storage > Policies si besoin.';
end $$;

-- Rapport de verification RLS.
drop view if exists public.monecole_rls_audit;

create view public.monecole_rls_audit as
with expected(table_schema, table_name, protection) as (
  values
    ('public','utilisateurs','ecole'),
    ('public','classes','ecole'),
    ('public','matieres','ecole'),
    ('public','eleves','ecole'),
    ('public','paiements','ecole'),
    ('public','presences','ecole'),
    ('public','messages','ecole'),
    ('public','compositions','ecole'),
    ('public','professeurs','ecole'),
    ('public','salaires','ecole'),
    ('public','absences_prof','ecole'),
    ('public','emploi_temps','ecole'),
    ('public','conversations','ecole'),
    ('public','titres_jour','ecole'),
    ('public','depenses','ecole'),
    ('public','audit_logs','ecole'),
    ('public','password_reset_requests','ecole'),
    ('public','fichiers','ecole'),
    ('public','createur_ecoles_suivi','service_role'),
    ('public','etablissements','fiche_ecole'),
    ('public','codes_activation','service_role'),
    ('public','sessions','auth_uid')
),
rels as (
  select
    n.nspname as table_schema,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    exists (
      select 1
      from pg_attribute a
      where a.attrelid = c.oid
        and a.attname = 'etablissement_id'
        and not a.attisdropped
    ) as has_etablissement_id
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r','p')
),
policy_counts as (
  select
    schemaname as table_schema,
    tablename as table_name,
    count(*)::int as policy_count
  from pg_policies
  group by schemaname, tablename
)
select
  e.table_schema,
  e.table_name,
  e.protection,
  (r.table_name is not null) as table_exists,
  coalesce(r.rls_enabled, false) as rls_enabled,
  coalesce(r.rls_forced, false) as rls_forced,
  coalesce(r.has_etablissement_id, false) as has_etablissement_id,
  coalesce(p.policy_count, 0) as policy_count,
  case
    when r.table_name is null then 'ABSENTE'
    when e.protection = 'service_role' and r.rls_enabled and r.rls_forced and coalesce(p.policy_count,0) = 0 then 'OK'
    when e.protection in ('ecole','fiche_ecole','auth_uid','storage') and r.rls_enabled and r.rls_forced and coalesce(p.policy_count,0) > 0 then 'OK'
    else 'A_VERIFIER'
  end as statut
from expected e
left join rels r
  on r.table_schema = e.table_schema
 and r.table_name = e.table_name
left join policy_counts p
  on p.table_schema = e.table_schema
 and p.table_name = e.table_name
order by
  case
    when r.table_name is null then 2
    when e.protection = 'service_role' and r.rls_enabled and r.rls_forced and coalesce(p.policy_count,0) = 0 then 1
    when e.protection in ('ecole','fiche_ecole','auth_uid','storage') and r.rls_enabled and r.rls_forced and coalesce(p.policy_count,0) > 0 then 1
    else 0
  end,
  e.table_schema,
  e.table_name;

revoke all on public.monecole_rls_audit from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on public.monecole_rls_audit to service_role;
  end if;
end $$;

commit;

-- Verification apres execution :
-- select * from public.monecole_rls_audit;
--
-- Resultat attendu :
-- - statut = OK pour les tables existantes.
-- - statut = ABSENTE uniquement pour les tables que votre base n'utilise pas.
-- - codes_activation doit afficher policy_count = 0 : c'est volontaire.
