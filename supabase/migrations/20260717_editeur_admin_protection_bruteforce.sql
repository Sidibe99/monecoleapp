-- MonEcole - Protection anti-bruteforce pour l'espace createur (editeur-admin)
-- Date : 2026-07-17
--
-- Objectif :
-- - Empecher un attaquant de deviner le mot de passe maitre par essais repetes.
-- - Verrouiller une cle (IP) apres plusieurs echecs pendant une fenetre courte.
-- - Le compteur est gere cote base (atomique), pas seulement dans la fonction edge.
--
-- A executer dans Supabase SQL Editor. Le script est idempotent : il peut etre relance.

begin;

create table if not exists public.editeur_admin_tentatives (
  cle text primary key,
  echecs int not null default 0,
  dernier_echec_at timestamptz,
  verrouille_jusqua timestamptz
);

alter table public.editeur_admin_tentatives enable row level security;
alter table public.editeur_admin_tentatives force row level security;
-- Aucune policy : seule la cle service_role (utilisee par la fonction edge) peut lire/ecrire.

create or replace function public.editeur_admin_est_verrouille(p_cle text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select verrouille_jusqua > now() from public.editeur_admin_tentatives where cle = p_cle),
    false
  )
$$;

create or replace function public.editeur_admin_enregistrer_echec(
  p_cle text,
  p_max_echecs int default 5,
  p_fenetre interval default '15 minutes',
  p_duree_verrouillage interval default '15 minutes'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_echecs int;
begin
  insert into public.editeur_admin_tentatives (cle, echecs, dernier_echec_at)
  values (p_cle, 1, now())
  on conflict (cle) do update set
    echecs = case
      when public.editeur_admin_tentatives.dernier_echec_at is null
        or public.editeur_admin_tentatives.dernier_echec_at < now() - p_fenetre
      then 1
      else public.editeur_admin_tentatives.echecs + 1
    end,
    dernier_echec_at = now()
  returning echecs into v_echecs;

  if v_echecs >= p_max_echecs then
    update public.editeur_admin_tentatives
    set verrouille_jusqua = now() + p_duree_verrouillage
    where cle = p_cle;
  end if;
end;
$$;

create or replace function public.editeur_admin_reinitialiser(p_cle text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.editeur_admin_tentatives where cle = p_cle;
$$;

revoke all on function public.editeur_admin_est_verrouille(text) from public;
revoke all on function public.editeur_admin_enregistrer_echec(text, int, interval, interval) from public;
revoke all on function public.editeur_admin_reinitialiser(text) from public;

grant execute on function public.editeur_admin_est_verrouille(text) to service_role;
grant execute on function public.editeur_admin_enregistrer_echec(text, int, interval, interval) to service_role;
grant execute on function public.editeur_admin_reinitialiser(text) to service_role;

commit;
