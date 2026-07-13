-- MonEcole - Espace createur / suivi des ecoles phase 2
-- Date : 2026-07-12
--
-- Objectif :
-- - Garder une note de suivi createur par ecole.
-- - Marquer une ecole comme contactee.
-- - Permettre la reactivation securisee via Edge Function.
-- - Ameliorer le diagnostic sans exposer les donnees entre ecoles.
--
-- Important :
-- Ces informations restent dans une table createur separee.
-- Les ecoles ne doivent pas lire directement les notes du createur.

begin;

create table if not exists public.createur_ecoles_suivi (
  id bigserial primary key,
  etablissement_id bigint not null references public.etablissements(id) on delete cascade,
  note text,
  contact_nom text,
  contact_telephone text,
  appel_at timestamptz,
  statut text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (etablissement_id)
);

alter table public.createur_ecoles_suivi enable row level security;
alter table public.createur_ecoles_suivi force row level security;

-- Aucune policy volontairement : acces uniquement via Edge Function service_role.

create index if not exists createur_ecoles_suivi_appel_idx
  on public.createur_ecoles_suivi(appel_at desc);

create index if not exists createur_ecoles_suivi_statut_idx
  on public.createur_ecoles_suivi(statut);

commit;
