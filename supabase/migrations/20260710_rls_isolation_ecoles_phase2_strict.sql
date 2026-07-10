-- MonEcole - RLS isolation des ecoles
-- Phase 2 stricte : verrouillage de public.etablissements et public.codes_activation.
--
-- IMPORTANT :
-- A appliquer seulement apres avoir teste la phase 1 et apres avoir verifie
-- que les actions de l'espace editeur passent par des Edge Functions
-- securisees avec service_role.
--
-- Pourquoi ?
-- - public.etablissements contient les ecoles.
-- - public.codes_activation contient les codes d'activation.
-- Ces tables ne doivent pas etre librement consultables avec la cle anon.
--
-- Effet attendu :
-- - Une ecole connectee voit et modifie uniquement sa fiche etablissement.
-- - Les codes d'activation ne sont plus lisibles directement.
-- - Une petite fonction publique permet seulement de verifier les langues
--   autorisees d'un code, sans exposer la table complete.

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

-- 1) Etablissements : chaque utilisateur ne voit que son ecole.
do $$
begin
  if to_regclass('public.etablissements') is not null then
    alter table public.etablissements enable row level security;

    drop policy if exists monecole_etablissement_select on public.etablissements;
    drop policy if exists monecole_etablissement_update on public.etablissements;
    drop policy if exists monecole_etablissement_insert on public.etablissements;
    drop policy if exists monecole_etablissement_delete on public.etablissements;

    create policy monecole_etablissement_select on public.etablissements
      for select to authenticated
      using (id = public.current_etablissement_id());

    create policy monecole_etablissement_update on public.etablissements
      for update to authenticated
      using (id = public.current_etablissement_id())
      with check (id = public.current_etablissement_id());

    -- Creation/suppression d'ecole : uniquement via Edge Function service_role.
    -- Aucune policy insert/delete volontairement.
  end if;
end $$;

-- 2) Codes d'activation : verrouilles par defaut.
do $$
begin
  if to_regclass('public.codes_activation') is not null then
    alter table public.codes_activation enable row level security;

    drop policy if exists monecole_codes_activation_select on public.codes_activation;
    drop policy if exists monecole_codes_activation_insert on public.codes_activation;
    drop policy if exists monecole_codes_activation_update on public.codes_activation;
    drop policy if exists monecole_codes_activation_delete on public.codes_activation;

    -- Pas de policy volontairement :
    -- les codes doivent etre geres par Edge Functions avec service_role.
  end if;
end $$;

-- 3) Lecture publique limitee des langues d'un code.
-- L'application peut appeler cette fonction au lieu de lire directement
-- public.codes_activation.
create or replace function public.get_activation_code_langues(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(to_jsonb(c.langues), '["fr"]'::jsonb)
  from public.codes_activation c
  where c.code = upper(trim(p_code))
    and coalesce(c.utilise, false) = false
  limit 1
$$;

revoke all on function public.get_activation_code_langues(text) from public;
grant execute on function public.get_activation_code_langues(text) to anon, authenticated;

