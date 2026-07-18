// ============================================================
// MonEcole — Edge Function "generer-code"  (codes longs + durée d'abonnement)
// Contrat : reçoit { motDePasse, formule, dureeMois } → renvoie { code }.
// Codes : ME-XXXXX-XXXXX (10 caractères, lettres+chiffres, sans O/0/I/1).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function genererCode(): string {
  const n = 10;
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return `ME-${s.slice(0, 5)}-${s.slice(5, 10)}`;
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { motDePasse, formule, dureeMois } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const MASTER = Deno.env.get("MASTER_PASSWORD") || "";

    const clientKey = getClientKey(req);
    const { data: verrouille, error: verrouilleError } = await supabase.rpc("monecole_admin_est_verrouille", { p_cle: clientKey });
    if (verrouilleError) {
      console.error("monecole_admin_est_verrouille failed", { message: verrouilleError.message, details: verrouilleError.details, hint: verrouilleError.hint, code: verrouilleError.code });
    }
    if (verrouille) {
      return json({ error: "Trop de tentatives. Reessayez dans quelques minutes." }, 429);
    }

    const motDePasseValide = !!motDePasse && (await timingSafeEqual(String(motDePasse), MASTER));
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

    const f = String(formule || "").toLowerCase();
    if (!["basique", "standard", "premium"].includes(f)) {
      return json({ error: "Formule invalide." }, 400);
    }

    // Durée en mois (1 à 60), défaut 12
    let m = parseInt(String(dureeMois ?? 12), 10);
    if (!Number.isFinite(m) || m < 1) m = 12;
    if (m > 60) m = 60;

    let code = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidat = genererCode();
      const { data: existant } = await supabase
        .from("codes_activation").select("code").eq("code", candidat).maybeSingle();
      if (!existant) { code = candidat; break; }
    }
    if (!code) return json({ error: "Impossible de générer un code unique, réessayez." }, 500);

    const { error } = await supabase.from("codes_activation").insert({
      code, formule: f, statut: "libre", duree_mois: m,
      created_at: new Date().toISOString(),
    });
    if (error) return json({ error: error.message }, 500);

    return json({ code, dureeMois: m }, 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
