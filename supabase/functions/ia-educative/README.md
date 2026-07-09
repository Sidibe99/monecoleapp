# Fonction Supabase IA educative

Cette fonction est appelee par les boutons de l'onglet **IA educative**.

## Deploiement

```bash
supabase functions deploy ia-educative
```

## Secrets a configurer

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
```

`OPENAI_MODEL` est optionnel. Si `OPENAI_API_KEY` n'est pas encore configuree, la fonction renvoie une reponse locale de secours pour que l'application continue de fonctionner.
