import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const allowedLangues = new Set(["fr", "fr_ar", "ar"]);
const cleanLangues = (value: unknown) => {
  const list = Array.isArray(value) ? value : ["fr"];
  const cleaned = list.map(String).filter((langue) => allowedLangues.has(langue));
  return cleaned.length ? cleaned : ["fr"];
};

const cleanTarifs = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Methode non autorisee." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const masterPassword =
    Deno.env.get("MONECOLE_MASTER_PASSWORD") ||
    Deno.env.get("MASTER_PASSWORD") ||
    Deno.env.get("MONECOLE_MASTER_PW");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Configuration Supabase manquante." }, 500);
  }
  if (!masterPassword) {
    return json({ ok: false, error: "Mot de passe maitre non configure." }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Requete invalide." }, 400);
  }

  if (String(body.motDePasse || "") !== masterPassword) {
    return json({ ok: false, error: "Mot de passe maitre incorrect." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const action = String(body.action || "");

  try {
    if (action === "list_codes") {
      const { data: codes, error: codesError } = await admin
        .from("codes_activation")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (codesError) throw codesError;

      const { data: ecoles } = await admin
        .from("etablissements")
        .select("nom,code_activation,created_at");

      const byCode = new Map<string, { nom?: string; date?: string }>();
      for (const ecole of ecoles || []) {
        if (ecole.code_activation) {
          byCode.set(String(ecole.code_activation), {
            nom: ecole.nom || undefined,
            date: ecole.created_at || undefined,
          });
        }
      }

      return json({
        ok: true,
        codes: (codes || []).map((code) => {
          const ecole = byCode.get(String(code.code));
          return { ...code, _ecole: ecole?.nom, _ecoleDate: ecole?.date };
        }),
      });
    }

    if (action === "set_code_langues") {
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) return json({ ok: false, error: "Code manquant." }, 400);
      const { error } = await admin
        .from("codes_activation")
        .update({ langues: cleanLangues(body.langues) })
        .eq("code", code);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "set_formule") {
      const etablissementId = Number(body.etablissementId);
      const payload = body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {};
      const allowed = ["formule", "abonnement_expire_le", "essai_debute_le", "essai_jours"];
      const update: Record<string, unknown> = {};
      for (const key of allowed) if (key in payload) update[key] = payload[key];
      if (!etablissementId || !Object.keys(update).length) {
        return json({ ok: false, error: "Modification invalide." }, 400);
      }
      const { error } = await admin.from("etablissements").update(update).eq("id", etablissementId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "save_tarifs_etablissement") {
      const etablissementId = Number(body.etablissementId);
      if (!etablissementId) return json({ ok: false, error: "Ecole manquante." }, 400);
      const { error } = await admin
        .from("etablissements")
        .update({ tarifs_formules: cleanTarifs(body.tarifs_formules) })
        .eq("id", etablissementId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "save_tarifs_all") {
      const ids = Array.isArray(body.etablissementIds)
        ? body.etablissementIds.map(Number).filter(Boolean)
        : [];
      if (!ids.length) return json({ ok: false, error: "Aucune ecole a mettre a jour." }, 400);
      const { error } = await admin
        .from("etablissements")
        .update({ tarifs_formules: cleanTarifs(body.tarifs_formules) })
        .in("id", ids);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "desactiver_ecole") {
      const etablissementId = Number(body.etablissementId);
      if (!etablissementId) return json({ ok: false, error: "Ecole manquante." }, 400);
      const { error } = await admin
        .from("etablissements")
        .update({
          supprimee: true,
          supprimee_le: new Date().toISOString(),
          supprimee_motif: "Desactivee depuis l'espace editeur",
        })
        .eq("id", etablissementId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ ok: false, error: "Action inconnue." }, 400);
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
});
