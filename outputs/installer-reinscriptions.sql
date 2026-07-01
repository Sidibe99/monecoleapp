-- MonEcole · Module inscriptions / réinscriptions
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Les noms sont volontairement en minuscules + underscore.

alter table public.eleves
  add column if not exists inscription_statut text not null default 'nouvelle',
  add column if not exists annee_precedente text,
  add column if not exists annee_reinscription text,
  add column if not exists date_reinscription date;

update public.eleves
set inscription_statut = 'nouvelle'
where inscription_statut is null or inscription_statut = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'eleves_inscription_statut_check'
  ) then
    alter table public.eleves
      add constraint eleves_inscription_statut_check
      check (inscription_statut in ('nouvelle', 'reinscrit', 'a_reinscrire'));
  end if;
end $$;

create index if not exists eleves_inscription_statut_idx
  on public.eleves (etablissement_id, inscription_statut);

create index if not exists eleves_annee_reinscription_idx
  on public.eleves (etablissement_id, annee_reinscription);
