-- MonEcole - Protection anti-bruteforce partagee pour le mot de passe maitre
-- Date : 2026-07-18
--
-- Plusieurs fonctions edge (editeur-admin, renouveler, creer-ecole,
-- generer-code, set-password, create-user) protegent leurs actions avec le
-- meme mot de passe maitre (secret MASTER_PASSWORD / MONECOLE_MASTER_PASSWORD).
-- Cette migration remplace le verrou dedie a editeur-admin (cree le
-- 2026-07-17) par un verrou partage, utilisable par toutes ces fonctions,
-- pour qu'un attaquant bloque sur une fonction reste bloque sur les autres.
--
-- A executer dans Supabase SQL Editor. Le script est idempotent.

begin;

do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'editeur_admin_tentatives'
  ) and not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'monecole_admin_tentatives'
  ) then
    alter table public.editeur_admin_tentatives rename to monecole_admin_tentatives;
  end if;
end $$;

create table if not exists public.monecole_admin_tentatives (
  cle text primary key,
  echecs int not null default 0,
  dernier_echec_at timestamptz,
  verrouille_jusqua timestamptz
);

alter table public.monecole_admin_tentatives enable row level security;
alter table public.monecole_admin_tentatives force row level security;
-- Aucune policy : seule la cle service_role (utilisee par les fonctions edge) peut lire/ecrire.

create or replace function public.monecole_admin_est_verrouille(p_cle text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select verrouille_jusqua > now() from public.monecole_admin_tentatives where cle = p_cle),
    false
  )
$$;

create or replace function public.monecole_admin_enregistrer_echec(
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
  insert into public.monecole_admin_tentatives (cle, echecs, dernier_echec_at)
  values (p_cle, 1, now())
  on conflict (cle) do update set
    echecs = case
      when public.monecole_admin_tentatives.dernier_echec_at is null
        or public.monecole_admin_tentatives.dernier_echec_at < now() - p_fenetre
      then 1
      else public.monecole_admin_tentatives.echecs + 1
    end,
    dernier_echec_at = now()
  returning echecs into v_echecs;

  if v_echecs >= p_max_echecs then
    update public.monecole_admin_tentatives
    set verrouille_jusqua = now() + p_duree_verrouillage
    where cle = p_cle;
  end if;
end;
$$;

create or replace function public.monecole_admin_reinitialiser(p_cle text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.monecole_admin_tentatives where cle = p_cle;
$$;

drop function if exists public.editeur_admin_est_verrouille(text);
drop function if exists public.editeur_admin_enregistrer_echec(text, int, interval, interval);
drop function if exists public.editeur_admin_reinitialiser(text);

revoke all on function public.monecole_admin_est_verrouille(text) from public;
revoke all on function public.monecole_admin_enregistrer_echec(text, int, interval, interval) from public;
revoke all on function public.monecole_admin_reinitialiser(text) from public;

grant execute on function public.monecole_admin_est_verrouille(text) to service_role;
grant execute on function public.monecole_admin_enregistrer_echec(text, int, interval, interval) to service_role;
grant execute on function public.monecole_admin_reinitialiser(text) to service_role;

commit;

notify pgrst, 'reload schema';
