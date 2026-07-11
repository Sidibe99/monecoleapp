-- MonEcole - Correctif phase 2
--
-- A utiliser si le script phase 2 affiche :
-- ERROR: column c.utilise does not exist
--
-- Ce correctif recree seulement la fonction de lecture limitee des langues
-- d'un code, sans utiliser la colonne "utilise" absente de votre table.

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
  limit 1
$$;

revoke all on function public.get_activation_code_langues(text) from public;
grant execute on function public.get_activation_code_langues(text) to anon, authenticated;
