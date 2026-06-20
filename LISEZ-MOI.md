# Sauvegarde automatique de MonEcole

Ce dossier ajoute une sauvegarde hebdomadaire de la base Supabase dans
GitHub Actions.

## Ce qui sera sauvegardé

- la structure de la base applicative ;
- les données de l'école ;
- un fichier d'information avec la date de création.

Les sauvegardes sont conservées comme fichiers privés dans l'onglet
**Actions** de GitHub pendant 30 jours.

## Ce qui n'est pas sauvegardé par ce fichier

Les documents placés dans Supabase Storage doivent être téléchargés et
conservés séparément. Ne publiez jamais une sauvegarde SQL dans le dépôt
public du site.

## Secrets GitHub nécessaires

Dans le dépôt GitHub, ouvrir :

**Settings → Secrets and variables → Actions → New repository secret**

Créer exactement ces trois secrets :

1. `SUPABASE_PROJECT_REF`
   - valeur : `durbgghxbbhqtxncpdcq`
2. `SUPABASE_ACCESS_TOKEN`
   - créer le jeton dans les paramètres du compte Supabase ;
3. `SUPABASE_DB_PASSWORD`
   - utiliser le mot de passe de la base de données Supabase.

Ne montrez jamais les valeurs des deux derniers secrets dans une capture
d'écran et ne les ajoutez jamais dans un fichier du site.

## Premier test

Après avoir ajouté le fichier
`.github/workflows/sauvegarde-supabase.yml` et les trois secrets :

1. ouvrir l'onglet **Actions** du dépôt GitHub ;
2. choisir **Sauvegarde hebdomadaire Supabase** ;
3. cliquer sur **Run workflow** ;
4. attendre la coche verte ;
5. ouvrir l'exécution puis télécharger le fichier dans **Artifacts**.
