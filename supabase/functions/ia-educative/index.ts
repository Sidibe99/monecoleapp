type IaRequest = {
  mode?: "dictionnaire" | "exercices" | "assistant";
  niveau?: string;
  matiere?: string;
  type?: "exercice" | "quiz" | "devoir";
  sujet?: string;
  ecole?: string;
  langue?: "fr" | "ar";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const clean = (value: unknown, fallback = "") =>
  String(value || fallback).trim().slice(0, 220);

const normalizeWord = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const dictionaryFallbacks: Record<string, { def: string; exp: string; ex: string; syn: string }> = {
  va: {
    def: '"Va" est une forme conjuguee du verbe "aller", a la troisieme personne du singulier du present de l indicatif.',
    exp: "On l utilise pour dire qu une personne se deplace, se rend quelque part, ou qu une situation se passe d une certaine maniere.",
    ex: "Il va a l ecole chaque matin.",
    syn: "se rend, part, marche",
  },
  aller: {
    def: "Aller signifie se deplacer vers un lieu ou se rendre quelque part.",
    exp: "On l utilise aussi pour parler de l etat d une personne ou du deroulement d une situation.",
    ex: "Les eleves vont en classe.",
    syn: "se rendre, partir, marcher",
  },
  manger: {
    def: "Manger signifie prendre des aliments par la bouche pour se nourrir.",
    exp: "C est une action necessaire pour donner de l energie au corps.",
    ex: "L eleve mange du riz a midi.",
    syn: "se nourrir, consommer",
  },
  eau: {
    def: "L eau est un liquide naturel, transparent et indispensable a la vie.",
    exp: "Les etres humains, les animaux et les plantes ont besoin d eau pour vivre.",
    ex: "Il faut boire de l eau propre.",
    syn: "liquide, eau potable",
  },
  ecole: {
    def: "Une ecole est un etablissement ou les eleves apprennent avec des enseignants.",
    exp: "On y etudie des matieres comme le francais, les mathematiques et les sciences.",
    ex: "Mon ecole ouvre le matin.",
    syn: "etablissement scolaire",
  },
};

const localFallback = (body: IaRequest) => {
  const sujet = clean(body.sujet, "la lecon");
  const niveau = clean(body.niveau, "Primaire");
  const matiere = clean(body.matiere, "Francais");
  const type = clean(body.type, "exercice");

  if (body.mode === "dictionnaire") {
    const known = dictionaryFallbacks[normalizeWord(sujet)];
    if (known) {
      return `Definition IA - ${sujet}

Definition :
${known.def}

Explication simple :
${known.exp}

Exemple scolaire :
${known.ex}

Synonymes ou mots proches :
${known.syn}`;
    }

    return `Definition IA - ${sujet}

Definition :
Le mot "${sujet}" n est pas encore suffisamment documente dans le dictionnaire MonEcole pour proposer une definition fiable sans verification.

Explication simple :
Pour eviter une definition approximative, ajoutez ce mot depuis l espace createur ou utilisez une vraie fonction IA connectee avec une cle securisee.

Exemple scolaire :
Le professeur verifie le sens exact de "${sujet}" avant de l utiliser dans une lecon.

Synonymes ou mots proches :
a verifier`;
  }

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
  const langue = clean(body.langue, "fr");

  if (body.mode === "assistant") {
    return `Tu aides un professeur de ${ecole}. Prepare une fiche de cours en francais pour ${niveau}, matiere ${matiere}, sujet "${sujet}". Structure la reponse avec : objectif, introduction, explication, activite en classe, evaluation rapide, devoir. Reste concret, scolaire et directement utilisable.`;
  }

  if (body.mode === "dictionnaire") {
    return `Tu es la vraie IA dictionnaire de MonEcole, utilisee par des ecoles.

Objectif : definir correctement n'importe quel mot ou expression, meme si ce mot n'existe pas dans la base locale de l'application.

Mot ou expression a definir : "${sujet}"
Niveau scolaire : ${niveau}
Matiere probable : ${matiere}
Langue de reponse : ${langue === "ar" ? "arabe simple" : "francais simple"}

Regles obligatoires :
- Commence toujours par "Definition :" avec une vraie definition de dictionnaire.
- Ne reponds jamais avec une phrase vague du type "mot important", "mot a expliquer selon le contexte", "notion a completer".
- Si le mot a plusieurs sens, donne le sens scolaire le plus courant puis indique "Autre sens possible".
- Si c'est une forme conjuguee, indique le verbe de base, le temps, la personne, puis le sens.
- Si c'est une expression, explique son sens global, pas seulement chaque mot separement.
- Si c'est un nom propre ou un terme peu connu, reponds prudemment et dis clairement ce qui est certain.
- Reste court, fiable, pedagogique, adapte aux eleves et utilisable dans un dictionnaire scolaire.

Format exact a respecter :
Definition :
Explication simple :
Exemple scolaire :
Synonymes ou mots proches :
Nature du mot :
Traduction arabe si possible :
Niveau conseille :
Matiere conseillee :`;
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
    if (body.mode === "dictionnaire") {
      return Response.json(
        {
          error: "IA connectee non configuree. Ajoutez le secret OPENAI_API_KEY dans Supabase pour generer n'importe quel mot.",
          texte: "",
          source: "missing_openai_key",
        },
        { status: 503, headers: corsHeaders },
      );
    }
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
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1",
        input: buildPrompt(body),
        temperature: body.mode === "dictionnaire" ? 0.15 : 0.4,
        max_output_tokens: body.mode === "dictionnaire" ? 1200 : 900,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI error", result);
      if (body.mode === "dictionnaire") {
        return Response.json(
          {
            error: "La vraie IA dictionnaire n'a pas pu repondre.",
            details: result?.error?.message || "Erreur OpenAI",
            texte: "",
            source: "openai_error",
          },
          { status: 502, headers: corsHeaders },
        );
      }
      return Response.json({ texte: localFallback(body), source: "fallback" }, { headers: corsHeaders });
    }

    const texte =
      result.output_text ||
      result.output?.flatMap((item: any) => item.content || [])
        ?.map((part: any) => part.text || "")
        ?.join("\n")
        ?.trim();

    if (body.mode === "dictionnaire" && !texte) {
      return Response.json(
        { error: "Reponse IA vide.", texte: "", source: "empty_openai_response" },
        { status: 502, headers: corsHeaders },
      );
    }

    return Response.json({ texte: texte || localFallback(body), source: texte ? "openai" : "fallback" }, { headers: corsHeaders });
  } catch (error) {
    console.error("ia-educative failed", error);
    if (body.mode === "dictionnaire") {
      return Response.json(
        {
          error: "La vraie IA dictionnaire est momentanement indisponible.",
          texte: "",
          source: "function_error",
        },
        { status: 502, headers: corsHeaders },
      );
    }
    return Response.json({ texte: localFallback(body), source: "fallback" }, { headers: corsHeaders });
  }
});
