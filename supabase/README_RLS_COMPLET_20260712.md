# MonEcole - RLS Supabase complet

Objectif : empêcher une école de lire ou modifier les données d'une autre école, même en accès direct à la base.

## À faire dans Supabase

1. Ouvrir Supabase Studio.
2. Aller dans **SQL Editor**.
3. Copier tout le fichier :
   `supabase/migrations/20260712_rls_isolation_ecoles_complet.sql`
4. Cliquer sur **Run**.
5. Ensuite exécuter :

```sql
select * from public.monecole_rls_audit;
```

## Résultat attendu

- Les tables existantes doivent afficher `OK`.
- Les tables que ta base n'utilise pas peuvent afficher `ABSENTE`.
- `codes_activation` doit avoir `policy_count = 0` : c'est normal, cette table doit passer par les fonctions sécurisées.

Si `codes_activation` affiche `A_VERIFIER` avec `policy_count` supérieur à 0, exécute le correctif :
`supabase/migrations/20260712_correctif_codes_activation_policies.sql`

## Si tu avais l'erreur `must be owner of table objects`

C'était Supabase Storage qui refusait la modification directe de `storage.objects`.
Le script corrigé ne touche plus cette table système. Relance simplement le fichier SQL complet.

Les données scolaires restent protégées par les tables `public.*`, notamment la table `fichiers` si elle existe.
Les règles du bucket Storage `fichiers` pourront être configurées ensuite depuis **Storage > Policies** si on veut verrouiller aussi les fichiers physiques.

## Important

Avant d'activer cette sécurité stricte, il faut que les fonctions créateur utilisent bien `SUPABASE_SERVICE_ROLE_KEY`.
Les actions concernées sont notamment : création d'école, génération de code, renouvellement, espace éditeur.

Cette phase protège l'isolation entre écoles. Elle ne remplace pas encore une restriction fine par rôle à l'intérieur d'une même école.
