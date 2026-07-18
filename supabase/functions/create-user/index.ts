// MonEcole — Edge Function "create-user"
// Crée un compte Auth + la ligne utilisateurs, de façon sécurisée.
// Seul un administrateur connecté peut l'appeler ; le nouvel utilisateur
// est automatiquement rattaché à l'établissement de l'administrateur.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1) Identifier l'appelant via son jeton (JWT) transmis par l'app
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Non authentifié." }, 401);

    // 2) Vérifier que l'appelant est Administrateur + récupérer son établissement
    const admin = createClient(url, serviceKey);
    const { data: callerRow } = await admin
      .from("utilisateurs")
      .select("role, etablissement_id")
      .eq("auth_id", caller.id)
      .maybeSingle();

    if (!callerRow || callerRow.role !== "Administrateur") {
      return json({ error: "Accès refusé : administrateur requis." }, 403);
    }

    // 3) Lire les données du nouvel utilisateur
    const body = await req.json();
    const {
      nom, prenom, identifiant, password, role, genre,
      matieres_autorisees, classes_autorisees, pages_autorisees,
    } = body ?? {};

    if (!identifiant || !password || !nom) {
      return json({ error: "Champs requis manquants (nom, identifiant, mot de passe)." }, 400);
    }
    const ident = String(identifiant).trim();
    const email = `${ident.toLowerCase()}@monecole.app`;

    // 4) Créer le compte Auth (email confirmé d'office)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return json({ error: "Création du compte impossible : " + (createErr?.message || "inconnue") }, 400);
    }

    // 5) Insérer la ligne utilisateurs reliée au compte Auth
    const { data: inserted, error: insErr } = await admin
      .from("utilisateurs")
      .insert({
        nom,
        prenom: prenom || "",
        genre: genre || "",
        identifiant: ident,
        role: role || "Professeur",
        matieres_autorisees: matieres_autorisees || [],
        classes_autorisees: classes_autorisees || [],
        pages_autorisees: pages_autorisees || [],
        etablissement_id: callerRow.etablissement_id,
        auth_id: created.user.id,
      })
      .select()
      .single();

    if (insErr) {
      // Annuler : supprimer le compte Auth pour ne pas laisser d'orphelin
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: "Enregistrement impossible : " + insErr.message }, 400);
    }

    return json({ ok: true, user: inserted }, 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
