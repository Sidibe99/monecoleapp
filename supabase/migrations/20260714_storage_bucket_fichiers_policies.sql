-- MonEcole - Securite Supabase Storage du bucket "fichiers"
-- Date : 14/07/2026
--
-- Objectif :
-- - garder le bucket "fichiers" prive ;
-- - autoriser une ecole connectee a lire/ecrire seulement les fichiers dont
--   le chemin commence par son etablissement_id.
--
-- Format attendu des fichiers :
--   {etablissement_id}/nom-du-fichier.ext
-- Exemples :
--   2/photo-eleve.jpg
--   2/acte-naissance.pdf
--
-- Important :
-- - ne pas executer de ALTER TABLE storage.objects ici : Supabase peut refuser
--   car cette table appartient au module Storage ;
-- - si ce script est refuse par Supabase, creer les memes regles depuis
--   Storage > fichiers > Policies.

begin;

-- La fonction RLS principale doit deja exister depuis le script RLS complet.
-- Elle retrouve l'ecole de l'utilisateur connecte via public.utilisateurs.auth_id.
create or replace function public.monecole_storage_path_etablissement_id(p_name text)
returns bigint
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  first_folder text;
begin
  first_folder := nullif((storage.foldername(coalesce(p_name, '')))[1], '');

  if first_folder is null or first_folder !~ '^[0-9]+$' then
    return null;
  end if;

  return first_folder::bigint;
end
$$;

revoke all on function public.monecole_storage_path_etablissement_id(text) from public;
grant execute on function public.monecole_storage_path_etablissement_id(text) to authenticated;

drop policy if exists monecole_fichiers_select on storage.objects;
drop policy if exists monecole_fichiers_insert on storage.objects;
drop policy if exists monecole_fichiers_update on storage.objects;
drop policy if exists monecole_fichiers_delete on storage.objects;

create policy monecole_fichiers_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'fichiers'
  and public.monecole_storage_path_etablissement_id(name) = public.current_etablissement_id()
);

create policy monecole_fichiers_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fichiers'
  and public.monecole_storage_path_etablissement_id(name) = public.current_etablissement_id()
);

create policy monecole_fichiers_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fichiers'
  and public.monecole_storage_path_etablissement_id(name) = public.current_etablissement_id()
)
with check (
  bucket_id = 'fichiers'
  and public.monecole_storage_path_etablissement_id(name) = public.current_etablissement_id()
);

create policy monecole_fichiers_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'fichiers'
  and public.monecole_storage_path_etablissement_id(name) = public.current_etablissement_id()
);

commit;

-- Verification :
-- Dans Supabase SQL Editor, apres execution, lancer :
--
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'storage'
--   and tablename = 'objects'
--   and policyname like 'monecole_fichiers_%'
-- order by policyname;
