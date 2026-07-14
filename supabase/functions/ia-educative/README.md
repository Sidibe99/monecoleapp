# Fonction Supabase IA educative

Cette fonction est appelee par les boutons de l'onglet **IA educative**.

## Deploiement

```bash
supabase functions deploy ia-educative
```

## Secrets a configurer

```bash
supabase secrets set GEMINI_API_KEY=ta_cle_gemini
supabase secrets set GEMINI_MODEL=gemini-3.1-flash-lite
```

`GEMINI_MODEL` est optionnel. Dans Supabase Studio, le nom du secret doit etre `GEMINI_MODEL` et la valeur doit etre seulement le modele, par exemple :

```text
gemini-3.1-flash-lite
```

Ne mettez pas `GEMINI_MODEL = gemini-3.1-flash-lite` dans la valeur.

La fonction essaie maintenant plusieurs modeles automatiquement si le modele configure n'est plus disponible.

OpenAI reste possible en secours si vous configurez aussi `OPENAI_API_KEY`, mais Gemini est prioritaire.

Important : pour le dictionnaire, si aucune cle IA n'est configuree, la fonction ne fait pas semblant de definir n'importe quel mot. Elle renvoie une erreur claire afin d'eviter les fausses definitions. Les autres modes gardent une reponse locale de secours.
