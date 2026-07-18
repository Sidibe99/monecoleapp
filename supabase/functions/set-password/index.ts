// MonEcole — Edge Function "set-password"
// Synchronise le mot de passe Supabase Auth quand un administrateur
// change le mot de passe d'un utilisateur depuis l'application.
//
// Déploiement (Supabase CLI) :
//   supabase functions deploy set-password
// (les variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournies
//  automatiquement par Supabase à la fonction.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { userId, password } = await req.json();
    if (!userId || !password || String(password).length < 6) {
      return json({ error: "Paramètres invalides (mot de passe d'au moins 6 caractères)." }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    // 1) Identifier l'appelant via son jeton
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: callerAuth } = await admin.auth.getUser(jwt);
    if (!callerAuth?.user) return json({ error: "Non authentifié." }, 401);

    // 2) L'appelant doit être Administrateur
    const { data: caller } = await admin
      .from("utilisateurs")
      .select("id, role, etablissement_id")
      .eq("auth_id", callerAuth.user.id)
      .maybeSingle();
    if (!caller || caller.role !== "Administrateur") {
      return json({ error: "Action réservée aux administrateurs." }, 403);
    }

    // 3) La cible doit appartenir à la même école
    const { data: target } = await admin
      .from("utilisateurs")
      .select("id, auth_id, etablissement_id")
      .eq("id", userId)
      .maybeSingle();
    if (!target) return json({ error: "Utilisateur introuvable." }, 404);
    if (String(target.etablissement_id) !== String(caller.etablissement_id)) {
      return json({ error: "Cet utilisateur n'appartient pas à votre école." }, 403);
    }
    if (!target.auth_id) return json({ ok: true, note: "Aucun compte Auth lié." });

    // 4) Mettre à jour le mot de passe Supabase Auth
    const { error } = await admin.auth.admin.updateUserById(target.auth_id, { password: String(password) });
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
