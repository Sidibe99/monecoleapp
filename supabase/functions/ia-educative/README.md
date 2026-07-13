# Fonction Supabase IA educative

Cette fonction est appelee par les boutons de l'onglet **IA educative**.

## Deploiement

```bash
supabase functions deploy ia-educative
```

## Secrets a configurer

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set OPENAI_MODEL=gpt-4.1
```

`OPENAI_MODEL` est optionnel. `gpt-4.1` est recommande pour avoir une vraie IA dictionnaire puissante et compatible avec l'API.

Important : pour le dictionnaire, si `OPENAI_API_KEY` n'est pas configuree, la fonction ne fait pas semblant de definir n'importe quel mot. Elle renvoie une erreur claire afin d'eviter les fausses definitions. Les autres modes gardent une reponse locale de secours.
