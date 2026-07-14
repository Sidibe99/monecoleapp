# Controle securite Storage MonEcole - 14/07/2026

Ce controle concerne les fichiers : photos eleves, documents, pieces jointes, fiches et archives.

## Pourquoi ce controle est important

Les tables de donnees sont protegees par RLS, mais Supabase Storage utilise des regles separees. Il faut donc verifier que les fichiers d'une ecole ne sont pas visibles par une autre ecole.

## Regle recommandee

Chaque fichier doit etre range dans un chemin qui commence par l'identifiant de l'ecole :

```text
{etablissement_id}/eleves/photo.png
{etablissement_id}/documents/fichier.pdf
{etablissement_id}/messagerie/piece-jointe.jpg
```

Exemple :

```text
abc123/eleves/boubacar-photo.png
abc123/documents/acte-naissance.pdf
```

## Verification dans Supabase

1. Ouvrir Supabase Studio.
2. Aller dans Storage.
3. Ouvrir chaque bucket utilise par MonEcole.
4. Verifier que le bucket n'est pas public sauf besoin volontaire.
5. Aller dans Policies.
6. Verifier que les regles limitent lecture, ajout, modification et suppression a l'ecole connectee.

## Points a surveiller

- Un bucket public rend les fichiers consultables par lien direct.
- Une policy trop large comme `true` peut exposer les documents.
- Les pieces jointes de messagerie doivent suivre la meme logique que les documents eleves.
- Le createur/editeur peut utiliser les fonctions securisees, mais les ecoles ne doivent pas lire les fichiers d'une autre ecole directement.

## Test simple a faire

1. Connecter une ecole A et ajouter un document eleve.
2. Copier le chemin du fichier.
3. Connecter une ecole B.
4. Essayer d'ouvrir ou lister ce fichier.
5. Resultat attendu : l'ecole B ne doit pas voir le fichier de l'ecole A.

## Statut

A faire dans Supabase : verification des buckets et policies Storage.

