type IaRequest = {
  mode?: "exercices" | "assistant";
  niveau?: string;
  matiere?: string;
  type?: "exercice" | "quiz" | "devoir";
  sujet?: string;
  ecole?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const clean = (value: unknown, fallback = "") =>
  String(value || fallback).trim().slice(0, 220);

const localFallback = (body: IaRequest) => {
  const sujet = clean(body.sujet, "la lecon");
  const niveau = clean(body.niveau, "Primaire");
  const matiere = clean(body.matiere, "Francais");
  const type = clean(body.type, "exercice");

  if (body.mode === "assistant") {
    return `Preparation rapide de cours - ${matiere} (${niveau})

Sujet : ${sujet}

1. Objectif du cours
A la fin de la seance, l'eleve doit pouvoir expliquer ${sujet} avec un exemple simple.

2. Introduction
Commencer par une question proche de la vie quotidienne des eleves.

3. Explication
Presenter la definition, puis donner 2 exemples au tableau.

4. Activite
Demander aux eleves de travailler en binomes pendant 5 minutes.

5. Evaluation rapide
Poser 3 questions orales et corriger ensemble.

6. Devoir
Ecrire 5 lignes ou resoudre 3 petits exercices sur ${sujet}.`;
  }

  const titre = `${type === "quiz" ? "Quiz" : type === "devoir" ? "Devoir" : "Exercice"} - ${matiere} - ${niveau}`;
  const questions = [
    `1. Explique avec tes propres mots : ${sujet}.`,
    `2. Donne deux exemples lies a ${sujet}.`,
    `3. Vrai ou faux : ${sujet} peut etre compris a partir d'un exemple concret. Justifie.`,
    `4. Complete une phrase avec le mot ou l'idee principale de ${sujet}.`,
    `5. Petite redaction : ecris 5 lignes sur ${sujet}.`,
  ];

  if (type === "quiz") {
    questions.splice(
      1,
      4,
      `2. Choisis la bonne reponse : ${sujet} est-il une notion, une personne, un lieu ou une methode ?`,
      `3. Associe ${sujet} a une matiere ou a une situation de la vie courante.`,
      "4. Donne un synonyme ou un mot proche si possible.",
      `5. Resume ${sujet} en une seule phrase.`,
    );
  }

  if (type === "devoir") {
    questions.push("6. Activite maison : interroge un parent ou un camarade et note une idee nouvelle apprise.");
  }

  return `${titre}

Objectif : aider l'eleve a comprendre "${sujet}" avec des mots simples.

${questions.join("\n")}

Correction indicative : accepter les reponses claires, les exemples coherents et les phrases bien construites.`;
};

const buildPrompt = (body: IaRequest) => {
  const sujet = clean(body.sujet, "la lecon");
  const niveau = clean(body.niveau, "Primaire");
  const matiere = clean(body.matiere, "Francais");
  const ecole = clean(body.ecole, "l'ecole");

  if (body.mode === "assistant") {
    return `Tu aides un professeur de ${ecole}. Prepare une fiche de cours en francais pour ${niveau}, matiere ${matiere}, sujet "${sujet}". Structure la reponse avec : objectif, introduction, explication, activite en classe, evaluation rapide, devoir. Reste concret, scolaire et directement utilisable.`;
  }

  return `Tu aides un professeur de ${ecole}. Cree un ${clean(body.type, "exercice")} en francais pour ${niveau}, matiere ${matiere}, sujet "${sujet}". Donne un titre, un objectif, 5 questions adaptees au niveau et une correction indicative courte.`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Methode non autorisee." }, { status: 405, headers: corsHeaders });
  }

  let body: IaRequest = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON invalide." }, { status: 400, headers: corsHeaders });
  }

  if (!clean(body.sujet)) {
    return Response.json({ error: "Sujet obligatoire." }, { status: 400, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return Response.json({ texte: localFallback(body), source: "fallback" }, { headers: corsHeaders });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        input: buildPrompt(body),
        temperature: 0.4,
        max_output_tokens: 900,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI error", result);
      return Response.json({ texte: localFallback(body), source: "fallback" }, { headers: corsHeaders });
    }

    const texte =
      result.output_text ||
      result.output?.flatMap((item: any) => item.content || [])
        ?.map((part: any) => part.text || "")
        ?.join("\n")
        ?.trim();

    return Response.json({ texte: texte || localFallback(body), source: texte ? "openai" : "fallback" }, { headers: corsHeaders });
  } catch (error) {
    console.error("ia-educative failed", error);
    return Response.json({ texte: localFallback(body), source: "fallback" }, { headers: corsHeaders });
  }
});
