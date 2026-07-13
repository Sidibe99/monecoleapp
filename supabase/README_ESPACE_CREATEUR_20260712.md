# MonEcole - Espace createur / editeur

Objectif : suivre les ecoles clientes depuis ton espace createur sans exposer les donnees entre ecoles.

## A executer dans Supabase

1. SQL Editor :
   `supabase/migrations/20260712_espace_createur_suivi_ecoles_phase2.sql`

2. Edge Functions :
   redeployer `supabase/functions/editeur-admin/index.ts`

## Ce que cette phase ajoute

- Derniere connexion plus fiable : une ecole est "connectee maintenant" seulement si l'activite est recente.
- Suivi createur prive : note interne, contact, telephone, statut, derniere date d'appel.
- Reactivation securisee d'une ecole desactivee.
- Table `createur_ecoles_suivi` protegee par RLS sans policy publique : elle passe par la fonction securisee.

## Verification

Apres le SQL, tu peux verifier directement :

```sql
select
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  coalesce(p.policy_count, 0) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select schemaname, tablename, count(*)::int as policy_count
  from pg_policies
  group by schemaname, tablename
) p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relname = 'createur_ecoles_suivi';
```

Resultat attendu :

- `rls_enabled = true`
- `rls_forced = true`
- `policy_count = 0`

Cela confirme que les notes createur passent par la fonction securisee et ne sont pas lisibles directement par les ecoles.
