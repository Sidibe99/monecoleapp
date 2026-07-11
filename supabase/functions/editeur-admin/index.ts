import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const allowedLangues = new Set(["fr", "fr_ar", "ar"]);
const cleanLangues = (value) => {
  const list = Array.isArray(value) ? value : ["fr"];
  const cleaned = list.map(String).filter((langue) => allowedLangues.has(langue));
  return cleaned.length ? cleaned : ["fr"];
};

const cleanTarifs = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
};

const daysSince = (value) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
};

const countByEtablissement = async (admin, table) => {
  const counts = new Map();
  try {
    const { data, error } = await admin.from(table).select("etablissement_id").limit(100000);
    if (error) return counts;
    for (const row of data || []) {
      const id = Number(row.etablissement_id);
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    }
  } catch {
    return counts;
  }
  return counts;
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

  let body;
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

      const byCode = new Map();
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

    if (action === "list_ecoles_health") {
      const { data: ecoles, error: ecolesError } = await admin
        .from("etablissements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (ecolesError) throw ecolesError;

      const elevesBySchool = await countByEtablissement(admin, "eleves");
      const classesBySchool = await countByEtablissement(admin, "classes");
      const usersBySchool = await countByEtablissement(admin, "utilisateurs");

      const authToSchool = new Map();
      const adminsBySchool = new Map();
      try {
        const { data: users } = await admin
          .from("utilisateurs")
          .select("etablissement_id,auth_id,role")
          .limit(100000);
        for (const user of users || []) {
          const schoolId = Number(user.etablissement_id);
          if (!schoolId) continue;
          if (user.auth_id) authToSchool.set(String(user.auth_id), schoolId);
          if (String(user.role || "").toLowerCase() === "administrateur") {
            adminsBySchool.set(schoolId, (adminsBySchool.get(schoolId) || 0) + 1);
          }
        }
      } catch {
        // Les compteurs restent disponibles meme si la table utilisateurs evolue.
      }

      const lastSeenBySchool = new Map();
      const activeSessionsBySchool = new Map();
      try {
        const { data: sessions } = await admin
          .from("sessions")
          .select("*")
          .limit(100000);
        for (const session of sessions || []) {
          const schoolId = authToSchool.get(String(session.auth_uid || ""));
          if (!schoolId) continue;
          const seen = session.last_seen_at || session.updated_at || session.created_at;
          if (seen) {
            const current = lastSeenBySchool.get(schoolId);
            if (!current || new Date(String(seen)).getTime() > new Date(current).getTime()) {
              lastSeenBySchool.set(schoolId, String(seen));
            }
          }
          if (!session.revoked) {
            activeSessionsBySchool.set(schoolId, (activeSessionsBySchool.get(schoolId) || 0) + 1);
          }
        }
      } catch {
        // La table sessions est optionnelle pour les anciennes bases.
      }

      const enriched = (ecoles || []).map((ecole) => {
        const schoolId = Number(ecole.id);
        const lastSeen = lastSeenBySchool.get(schoolId) || null;
        const inactiveDays = daysSince(lastSeen);
        const expiresIn = ecole.abonnement_expire_le ? -daysSince(ecole.abonnement_expire_le) : null;
        const eleves = elevesBySchool.get(schoolId) || 0;
        const classes = classesBySchool.get(schoolId) || 0;
        const utilisateurs = usersBySchool.get(schoolId) || 0;
        const alerts = [];
        let status = "ok";
        let label = "Active";

        if (ecole.supprimee) {
          status = "blocked";
          label = "Désactivée";
          alerts.push("École désactivée");
        } else if (expiresIn !== null && expiresIn < 0) {
          status = "blocked";
          label = "Abonnement expiré";
          alerts.push("Abonnement expiré");
        } else if (inactiveDays === null) {
          status = "watch";
          label = "Aucune connexion suivie";
          alerts.push("Aucune connexion connue");
        } else if (inactiveDays >= 30) {
          status = "inactive";
          label = "Inactive";
          alerts.push(`Aucune connexion depuis ${inactiveDays} jours`);
        } else if (inactiveDays >= 14) {
          status = "watch";
          label = "À surveiller";
          alerts.push(`Dernière connexion il y a ${inactiveDays} jours`);
        }

        if (!classes) alerts.push("Aucune classe");
        if (!eleves) alerts.push("Aucun élève");
        if (!utilisateurs) alerts.push("Aucun utilisateur");

        return {
          ...ecole,
          _health: {
            status,
            label,
            last_seen_at: lastSeen,
            inactive_days: inactiveDays,
            active_sessions: activeSessionsBySchool.get(schoolId) || 0,
            eleves,
            classes,
            utilisateurs,
            admins: adminsBySchool.get(schoolId) || 0,
            expires_in_days: expiresIn,
            alerts,
          },
        };
      });

      return json({
        ok: true,
        ecoles: enriched,
        summary: {
          total: enriched.length,
          active: enriched.filter((ecole) => ecole._health.status === "ok").length,
          watch: enriched.filter((ecole) => ecole._health.status === "watch").length,
          inactive: enriched.filter((ecole) => ecole._health.status === "inactive").length,
          blocked: enriched.filter((ecole) => ecole._health.status === "blocked").length,
        },
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
      const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
      const allowed = ["formule", "abonnement_expire_le", "essai_debute_le", "essai_jours"];
      const update = {};
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
