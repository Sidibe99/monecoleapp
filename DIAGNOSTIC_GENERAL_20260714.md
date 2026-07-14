# Diagnostic general MonEcole - v78

## Corrige dans cette passe

- Passage de l'app en v78 avec nouveau cache.
- Messages IA plus clairs pour les ecoles.
- Fonction `ia-educative` plus robuste : elle tente automatiquement plusieurs modeles Gemini si le modele configure n'est pas disponible.
- Definition IA mieux lisible : texte long non coupe, retour a la ligne force, meilleur affichage dans les themes.
- Boutons flottants rendus discrets lorsqu'une fenetre ou un apercu est ouvert.
- Notice Supabase IA mise a jour.
- Guide de controle Storage ajoute pour verifier la protection des documents et fichiers.

## A verifier apres deploiement

- Redeployer la fonction Supabase `ia-educative`.
- Verifier les secrets Supabase :
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL` avec une valeur simple comme `gemini-3.1-flash-lite`.
- Tester une definition IA avec un mot absent du dictionnaire local.
- Tester les themes sombres et clairs sur tableau de bord, IA educative, notes et bulletins.
- Tester l'app sur telephone apres nettoyage du cache.

## Prochaine passe conseillee

- Remplacer les dernieres alertes navigateur par des fenetres MonEcole.
- Finaliser les policies Supabase Storage.
- Tester deux ecoles differentes pour confirmer l'isolation des donnees.
- Nettoyer les anciennes versions dans `assets` apres validation de la v78.

