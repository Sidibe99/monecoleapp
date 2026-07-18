// MonEcole — Edge Function "creer-ecole"
// Crée une école + son compte administrateur, de façon sécurisée (clé service role),
// en contournant le RLS qui interdit l'écriture publique sur "etablissements".
//
// Sécurité : l'autorisation, c'est le CODE d'activation (valide + libre).
//   - Un code = une école. Une fois utilisé, il ne peut plus servir.
//   - Le code est réservé de façon atomique en tout premier, pour qu'une
//     double soumission (double-clic, rejeu réseau) ne puisse pas créer
//     deux écoles à partir d'un seul code.
//   - La formule de l'école est imposée par le code (jamais par le client).
//
// ⚠️ Déployer avec "Verify JWT" = OFF (l'onboarding n'est pas une session connectée).

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
    const admin = createClient(url, serviceKey);

    const body = await req.json();
    const { code, ecole, admin: adminInfo } = body ?? {};

    // 1) Validations de base
    if (!code) return json({ error: "Code d'activation manquant." }, 400);
    if (!ecole || !ecole.nom) return json({ error: "Nom de l'établissement requis." }, 400);
    if (!adminInfo || !adminInfo.nom || !adminInfo.identifiant || !adminInfo.password) {
      return json({ error: "Informations de l'administrateur incomplètes." }, 400);
    }

    const codeUp = String(code).trim().toUpperCase();

    // 2) Réserver le code immédiatement et de façon atomique : cette
    // écriture ne réussit que pour UNE seule requête si le même code
    // est soumis plusieurs fois en même temps.
    const { data: claimed, error: claimErr } = await admin
      .from("codes_activation")
      .update({ statut: "utilise", used_at: new Date().toISOString() })
      .eq("code", codeUp)
      .eq("statut", "libre")
      .select("code, formule")
      .maybeSingle();

    if (claimErr) return json({ error: claimErr.message }, 500);
    if (!claimed) {
      const { data: existing } = await admin
        .from("codes_activation").select("code").eq("code", codeUp).maybeSingle();
      return json(
        { error: existing ? "Ce code a déjà été utilisé." : "Code d'activation introuvable." },
        existing ? 409 : 400,
      );
    }

    const formule = ["basique", "standard", "premium"].includes(claimed.formule) ? claimed.formule : "basique";

    // En cas d'échec plus loin, on relibère le code au lieu de le gâcher.
    const liberer = () =>
      admin.from("codes_activation")
        .update({ statut: "libre", etablissement_id: null, used_at: null })
        .eq("code", codeUp);

    // 3) Créer l'établissement (formule imposée par le code)
    const { formule: _ignore, ...ecoleRest } = ecole; // on ignore toute formule envoyée par le client
    // Les champs numériques laissés vides arrivent en chaîne vide "" depuis le
    // formulaire ; Postgres refuse "" pour une colonne numérique. On les
    // convertit en null (= non defini) plutôt que de faire échouer la création.
    const ecoleClean = Object.fromEntries(
      Object.entries(ecoleRest).map(([key, value]) => [key, value === "" ? null : value]),
    );
    const { data: etab, error: etabErr } = await admin
      .from("etablissements")
      .insert({ ...ecoleClean, formule, code_activation: codeUp, created_at: new Date().toISOString() })
      .select()
      .single();

    if (etabErr || !etab) {
      await liberer();
      return json({ error: "Création de l'école impossible : " + (etabErr?.message || "inconnue") }, 400);
    }

    // 4) Créer le compte Auth de l'administrateur
    const ident = String(adminInfo.identifiant).trim();
    const email = `${ident.toLowerCase()}@monecole.app`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: adminInfo.password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      // rollback : supprimer l'école qu'on vient de créer, relibérer le code
      await admin.from("etablissements").delete().eq("id", etab.id);
      await liberer();
      return json({ error: "Création du compte administrateur impossible : " + (createErr?.message || "inconnue") }, 400);
    }

    // 5) Insérer la ligne utilisateurs (administrateur reliée au compte Auth)
    const { data: userRow, error: userErr } = await admin
      .from("utilisateurs")
      .insert({
        nom: adminInfo.nom,
        prenom: adminInfo.prenom || "",
        identifiant: ident,
        role: "Administrateur",
        matieres_autorisees: [],
        classes_autorisees: [],
        pages_autorisees: [],
        etablissement_id: etab.id,
        auth_id: created.user.id,
        fondateur: true,
      })
      .select()
      .single();

    if (userErr || !userRow) {
      // rollback complet
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from("etablissements").delete().eq("id", etab.id);
      await liberer();
      return json({ error: "Enregistrement de l'administrateur impossible : " + (userErr?.message || "inconnue") }, 400);
    }

    // 6) Relier définitivement le code à l'école créée (déjà marqué "utilise" à l'étape 2)
    await admin
      .from("codes_activation")
      .update({ etablissement_id: etab.id })
      .eq("code", codeUp);

    return json({ ok: true, etablissement: etab, user: userRow }, 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
