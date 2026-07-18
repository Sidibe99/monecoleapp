// ============================================================
// MonEcole — Edge Function "renouveler"
// Gère l'abonnement des écoles (service role).
//
// 3 actions :
//  1) Lister (hub éditeur) :
//       { motDePasse, action:"list" }
//       → { ecoles:[{id,nom,formule,abonnement_expire_le}] }
//  2) Prolonger manuellement (hub éditeur) :
//       { motDePasse, action:"prolonger", etablissementId, dureeMois }
//       → { expire_le }
//  3) Renouveler par code (école) :
//       { code, etablissementId }
//       → { expire_le }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

const getClientKey = (req: Request) => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || "inconnu";
};

const timingSafeEqual = async (a: string, b: string) => {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i += 1) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
};

// nouvelle échéance = (max aujourd'hui / échéance actuelle) + m mois
function prolongeDepuis(expireActuel: string | null, m: number): string {
  const today = new Date();
  let base = today;
  if (expireActuel) {
    const d = new Date(expireActuel + "T00:00:00");
    if (!isNaN(d.getTime()) && d > today) base = d;
  }
  const nd = new Date(base);
  nd.setMonth(nd.getMonth() + m);
  return nd.toISOString().slice(0, 10); // YYYY-MM-DD
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const { motDePasse, action, code } = body;
    const etablissementId = body.etablissementId ?? body.etablissement_id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const MASTER = Deno.env.get("MASTER_PASSWORD") || "";

    // ----- Actions protégées par mot de passe maître -----
    if (motDePasse) {
      const clientKey = getClientKey(req);
      const { data: verrouille, error: verrouilleError } = await supabase.rpc("monecole_admin_est_verrouille", { p_cle: clientKey });
      if (verrouilleError) {
        console.error("monecole_admin_est_verrouille failed", { message: verrouilleError.message, details: verrouilleError.details, hint: verrouilleError.hint, code: verrouilleError.code });
      }
      if (verrouille) {
        return json({ error: "Trop de tentatives. Reessayez dans quelques minutes." }, 429);
      }

      const motDePasseValide = await timingSafeEqual(String(motDePasse), MASTER);
      if (!motDePasseValide) {
        const { error: echecError } = await supabase.rpc("monecole_admin_enregistrer_echec", { p_cle: clientKey });
        if (echecError) {
          console.error("monecole_admin_enregistrer_echec failed", { message: echecError.message, details: echecError.details, hint: echecError.hint, code: echecError.code });
        }
        return json({ error: "Mot de passe maître incorrect." }, 401);
      }
      const { error: resetError } = await supabase.rpc("monecole_admin_reinitialiser", { p_cle: clientKey });
      if (resetError) {
        console.error("monecole_admin_reinitialiser failed", { message: resetError.message, details: resetError.details, hint: resetError.hint, code: resetError.code });
      }

      if (action === "list") {
        const { data, error } = await supabase
          .from("etablissements")
          .select("id,nom,formule,abonnement_expire_le")
          .order("id", { ascending: true });
        if (error) return json({ error: error.message }, 500);
        return json({ ecoles: data || [] }, 200);
      }

      if (action === "supprimer_code") {
        const c = String(body.code || "").trim().toUpperCase();
        if (!c) return json({ error: "Code manquant." }, 400);
        const { data: row } = await supabase
          .from("codes_activation").select("statut").eq("code", c).maybeSingle();
        if (row && row.statut && row.statut !== "libre")
          return json({ error: "Ce code est déjà utilisé : suppression refusée." }, 409);
        const { error } = await supabase.from("codes_activation").delete().eq("code", c);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true }, 200);
      }

      if (action === "prolonger") {
        if (!etablissementId) return json({ error: "École manquante." }, 400);
        let m = parseInt(String(body.dureeMois ?? 12), 10);
        if (!Number.isFinite(m) || m < 1) m = 12;
        if (m > 60) m = 60;
        const { data: etab, error: e1 } = await supabase
          .from("etablissements").select("abonnement_expire_le").eq("id", etablissementId).maybeSingle();
        if (e1 || !etab) return json({ error: "École introuvable." }, 404);
        const nv = prolongeDepuis(etab.abonnement_expire_le, m);
        const { error: e2 } = await supabase
          .from("etablissements").update({ abonnement_expire_le: nv }).eq("id", etablissementId);
        if (e2) return json({ error: e2.message }, 500);
        return json({ expire_le: nv }, 200);
      }

      return json({ error: "Action inconnue." }, 400);
    }

    // ----- Renouvellement par code (école, sans mot de passe maître) -----
    if (code && etablissementId) {
      const c = String(code).trim().toUpperCase();
      const { data: codeRow, error: ce } = await supabase
        .from("codes_activation").select("*").eq("code", c).maybeSingle();
      if (ce) return json({ error: ce.message }, 500);
      if (!codeRow) return json({ error: "Code invalide." }, 404);
      if (codeRow.statut && codeRow.statut !== "libre") return json({ error: "Ce code a déjà été utilisé." }, 409);

      let m = parseInt(String(codeRow.duree_mois ?? 12), 10);
      if (!Number.isFinite(m) || m < 1) m = 12;

      const { data: etab, error: e1 } = await supabase
        .from("etablissements").select("abonnement_expire_le").eq("id", etablissementId).maybeSingle();
      if (e1 || !etab) return json({ error: "École introuvable." }, 404);

      const nv = prolongeDepuis(etab.abonnement_expire_le, m);
      const { error: e2 } = await supabase
        .from("etablissements").update({ abonnement_expire_le: nv }).eq("id", etablissementId);
      if (e2) return json({ error: e2.message }, 500);

      // marquer le code utilisé
      await supabase.from("codes_activation")
        .update({ statut: "utilise" }).eq("code", c);

      return json({ expire_le: nv, dureeMois: m }, 200);
    }

    return json({ error: "Requête invalide." }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
