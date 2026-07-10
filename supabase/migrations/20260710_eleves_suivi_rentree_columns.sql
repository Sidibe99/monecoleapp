-- MonEcole - Colonnes de suivi de rentree pour les eleves
--
-- Corrige l'erreur :
-- Could not find the 'annee_precedente' column of 'eleves' in the schema cache
--
-- A executer dans Supabase SQL Editor.
-- Apres execution, actualiser l'application. Si l'erreur persiste quelques
-- secondes, attendre le rafraichissement du schema cache Supabase puis reessayer.

alter table public.eleves
  add column if not exists inscription_statut text default 'nouvelle',
  add column if not exists statut_inscription text default 'nouveau',
  add column if not exists annee_precedente text,
  add column if not exists ancienne_classe_id bigint,
  add column if not exists annee_reinscription text,
  add column if not exists date_reinscription date;

create index if not exists eleves_etablissement_inscription_statut_idx
  on public.eleves (etablissement_id, inscription_statut);

create index if not exists eleves_etablissement_statut_inscription_idx
  on public.eleves (etablissement_id, statut_inscription);

create index if not exists eleves_etablissement_annee_ancienne_classe_idx
  on public.eleves (etablissement_id, annee_precedente, ancienne_classe_id);
