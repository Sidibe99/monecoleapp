import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

const projectRef = process.env.SUPABASE_PROJECT_REF;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_BUCKET || "fichiers";

if (!projectRef || !secretKey) {
  throw new Error("Secrets Supabase manquants.");
}

const supabaseUrl = `https://${projectRef}.supabase.co`;
const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const date = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "_UTC");
const outputRoot = resolve("sauvegarde-storage", `${bucket}_${date}`);
const files = [];

await mkdir(outputRoot, { recursive: true });

function safeDestination(objectPath) {
  const cleaned = normalize(objectPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const destination = resolve(join(outputRoot, cleaned));
  if (!destination.startsWith(outputRoot + "/") && destination !== outputRoot) {
    throw new Error(`Chemin de fichier non valide : ${objectPath}`);
  }
  return destination;
}

async function listFolder(prefix = "") {
  const limit = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) throw error;
    const entries = data || [];

    for (const entry of entries) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;

      // Les dossiers n'ont pas d'identifiant ; les fichiers en ont un.
      if (!entry.id) {
        await listFolder(objectPath);
        continue;
      }

      const { data: blob, error: downloadError } =
        await supabase.storage.from(bucket).download(objectPath);

      if (downloadError) throw downloadError;

      const destination = safeDestination(objectPath);
      await mkdir(dirname(destination), { recursive: true });
      const bytes = Buffer.from(await blob.arrayBuffer());
      await writeFile(destination, bytes);

      files.push({
        chemin: objectPath,
        taille: bytes.length,
        date_modification: entry.updated_at || null,
      });

      console.log(`Sauvegardé : ${objectPath}`);
    }

    if (entries.length < limit) break;
    offset += limit;
  }
}

await listFolder();

const totalBytes = files.reduce((total, file) => total + file.taille, 0);
const manifest = {
  projet: projectRef,
  bucket,
  cree_le: new Date().toISOString(),
  nombre_fichiers: files.length,
  taille_totale_octets: totalBytes,
  fichiers: files,
};

await writeFile(
  join(outputRoot, "MANIFESTE.json"),
  JSON.stringify(manifest, null, 2),
  "utf8",
);

await writeFile(
  join(outputRoot, "LISEZ-MOI.txt"),
  [
    "Sauvegarde des fichiers MonEcole",
    `Projet : ${projectRef}`,
    `Bucket : ${bucket}`,
    `Date : ${manifest.cree_le}`,
    `Nombre de fichiers : ${files.length}`,
    `Taille totale : ${totalBytes} octets`,
    "",
    "Conservez cette archive dans un endroit sûr.",
  ].join("\n"),
  "utf8",
);

console.log(`${files.length} fichier(s) sauvegardé(s).`);
