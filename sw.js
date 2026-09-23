const CACHE_NAME = "monecole-vite-v560";
// Remplacé uniquement dans dist/sw.js, après génération de tous les bundles.
const MANIFEST_SHA256 = "8adbe6138dc4d16d8daff00e4e79732c7d13534d3b21005199fa7e04b72c252f";
const CACHE_STORAGE_NAME = `${CACHE_NAME}-${MANIFEST_SHA256.slice(0, 16)}`;
const OFFLINE_MANIFEST_URL = "/offline-manifest.json";
const TRUSTED_RUNTIME_HOSTS = new Set(["cdnjs.cloudflare.com"]);
const APP_SHELL = [
  "/index.html", "/manifest.webmanifest", "/version.json",
  "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png",
  "/assets/ia-educative-fallback.js", "/assets/ia-educative-fallback-legacy.js"
];
const MIME_TYPES = {
  html: ["text/html"], javascript: ["text/javascript", "application/javascript", "application/x-javascript"],
  css: ["text/css"], json: ["application/json"], manifest: ["application/manifest+json", "application/json"],
  png: ["image/png"], jpeg: ["image/jpeg"], svg: ["image/svg+xml"], webp: ["image/webp"],
  gif: ["image/gif"], ico: ["image/x-icon", "image/vnd.microsoft.icon"],
  woff: ["font/woff", "application/font-woff"], woff2: ["font/woff2"],
  ttf: ["font/ttf", "application/x-font-ttf"], otf: ["font/otf", "application/x-font-opentype"],
  wasm: ["application/wasm"]
};
const sha256 = bytes => crypto.subtle.digest("SHA-256", bytes).then(buffer =>
  Array.from(new Uint8Array(buffer)).map(value => (`0${value.toString(16)}`).slice(-2)).join("")
);
const validResponse = (response, type) => response && response.ok && !response.redirected &&
  (MIME_TYPES[type] || []).includes((response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase());

const loadManifest = () => fetch(OFFLINE_MANIFEST_URL, { cache: "no-store" }).then(response => {
  if (!validResponse(response, "json")) throw new Error("Manifeste hors ligne indisponible ou type incorrect");
  return response.clone().arrayBuffer().then(bytes => sha256(bytes).then(hash => {
    if (hash !== MANIFEST_SHA256) throw new Error("Le manifeste ne correspond pas à cette version");
    return response.json();
  }));
}).then(manifest => {
  if (!manifest || `monecole-vite-${manifest.version}` !== CACHE_NAME || !Array.isArray(manifest.assets) || !manifest.assets.length) {
    throw new Error("Manifeste hors ligne invalide");
  }
  const seen = new Set();
  manifest.assets.forEach(asset => {
    const path = asset.url;
    if (typeof path !== "string" || !/^\/[A-Za-z0-9_./-]+$/.test(path) || path.split("/").includes("..") ||
        !(APP_SHELL.includes(path) || path.startsWith("/assets/")) || path.includes("heic-to") ||
        !MIME_TYPES[asset.type] || !/^[a-f0-9]{64}$/.test(asset.sha256) ||
        !Number.isInteger(asset.bytes) || asset.bytes < 0 || seen.has(path)) {
      throw new Error("Ressource non autorisée dans le manifeste hors ligne");
    }
    seen.add(path);
  });
  if (APP_SHELL.some(path => !seen.has(path))) throw new Error("Coque hors ligne incomplète");
  return manifest;
});

const cacheCompiledAssets = (cache, assets) => {
  let next = 0;
  let failure = null;
  const cacheNext = () => {
    if (failure || next >= assets.length) return Promise.resolve();
    const asset = assets[next++];
    // L'hébergement public redirige /index.html vers /. Garder la clé locale
    // index.html, mais télécharger sa représentation canonique sans redirection.
    const sourceUrl = asset.url === "/index.html" ? "/" : asset.url;
    return fetch(sourceUrl, { cache: "no-store" }).then(response => {
      if (!validResponse(response, asset.type)) throw new Error(`Type ou statut incorrect : ${asset.url}`);
      return response.clone().arrayBuffer().then(bytes => {
        if (bytes.byteLength !== asset.bytes) throw new Error(`Taille incorrecte : ${asset.url}`);
        return sha256(bytes).then(hash => {
          if (hash !== asset.sha256) throw new Error(`Empreinte incorrecte : ${asset.url}`);
          return cache.put(asset.url, response);
        });
      });
    }).then(cacheNext).catch(error => { failure = error; });
  };
  // Attendre aussi les transferts déjà lancés avant de nettoyer un cache échoué.
  return Promise.all([cacheNext(), cacheNext(), cacheNext(), cacheNext()]).then(() => {
    if (failure) throw failure;
  });
};

const installOfflineCache = () => {
  let hadCompletedCache = false;
  return caches.open(CACHE_STORAGE_NAME).then(cache =>
    cache.match(OFFLINE_MANIFEST_URL).then(marker => {
      hadCompletedCache = !!marker;
      return loadManifest().then(manifest => cacheCompiledAssets(cache, manifest.assets).then(() => cache.put(OFFLINE_MANIFEST_URL,
        new Response(JSON.stringify(manifest), { headers: { "content-type": "application/json" } })
      )));
    })
  ).then(() => self.skipWaiting()).catch(error => {
    // Le cache actif d'une autre version/empreinte n'a jamais été ouvert ni purgé.
    // Une réinstallation identique ne détruit pas non plus son cache déjà valide.
    if (hadCompletedCache) throw error;
    return caches.delete(CACHE_STORAGE_NAME).then(() => { throw error; });
  });
};

self.addEventListener("install", event => {
  event.waitUntil(installOfflineCache());
});

// Le ménage est réservé à l'activation d'une version intégralement vérifiée.
// Garder une version précédente permet aux onglets encore ouverts de finir.
const purgerAnciensCaches = (garder = 1) =>
  caches.keys().then(keys => {
    const previousCaches = keys
      .filter(key => /^monecole-vite-v\d+(?:-[a-f0-9]{16})?$/.test(key) && key !== CACHE_STORAGE_NAME)
      .sort((a, b) => Number(b.match(/-v(\d+)/)[1]) - Number(a.match(/-v(\d+)/)[1]) || keys.indexOf(b) - keys.indexOf(a));
    return Promise.all(previousCaches.slice(garder).map(key => caches.delete(key)));
  });

self.addEventListener("activate", event => {
  event.waitUntil(purgerAnciensCaches(1).then(() => self.clients.claim()));
});

const matchCurrentCache = request => caches.open(CACHE_STORAGE_NAME).then(cache => cache.match(request));
const unavailableOffline = () => new Response("Ressource indisponible hors connexion.", {
  status: 503, headers: { "content-type": "text/plain; charset=utf-8" }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    if (!TRUSTED_RUNTIME_HOSTS.has(url.hostname)) return;
    event.respondWith(caches.open(CACHE_STORAGE_NAME).then(cache => cache.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && (response.ok || response.type === "opaque")) {
          return cache.put(request, response.clone()).then(() => response);
        }
        return response;
      });
    })));
    return;
  }
  if (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/storage/")) return;
  // v533 — le guide (PDF, pages de la visionneuse, téléchargement) n'est pas
  // gardé hors ligne : ses requêtes vont au réseau comme si le worker n'existait
  // pas. Un téléchargement ne dépend ainsi que du navigateur.
  if (url.pathname.startsWith("/guide/")) return;
  if (url.pathname === "/version.json") {
    event.respondWith(fetch(request, { cache: "no-store" }).then(response => {
      if (!validResponse(response, "json")) throw new Error("Version indisponible");
      return response;
    }).catch(() => matchCurrentCache("/version.json").then(cached => cached || unavailableOffline())));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).then(response => {
      // v531 — l'hébergeur redirige /confidentialite.html vers /confidentialite.
      // Une navigation reçoit alors une réponse « opaqueredirect » : elle n'est
      // pas une erreur, le navigateur doit la suivre. La prendre pour une panne
      // remplaçait la page par la coque, et le lien semblait ne rien faire.
      if (response && response.type === "opaqueredirect") return response;
      // v501 — une navigation vers un document (le guide PDF) n'est pas une page de
      // l'application : la réponse passe telle quelle au lieu d'être remplacée par
      // la coque, qui affichait « Chargement de MonEcole… » à la place du guide.
      if (response && response.ok && !/^text\/html\b/i.test((response.headers.get("content-type") || "").toLowerCase())) return response;
      if (!validResponse(response, "html")) throw new Error("Page indisponible");
      // Ne jamais remplacer la coque vérifiée par une erreur HTML, une route
      // inconnue ou l'index d'un prochain déploiement dont les chunks manquent.
      return response;
    }).catch(() => matchCurrentCache("/index.html").then(cached => cached || unavailableOffline())));
    return;
  }
  // Les ressources vérifiées sont immuables pour cette empreinte de build.
  // Aucune réponse API ni ressource privée n'est ajoutée au cache par ce chemin.
  event.respondWith(matchCurrentCache(request).then(cached => cached ||
    (url.pathname.startsWith("/assets/") ? caches.match(request) : undefined))
    .then(cached => cached || fetch(request))
    .catch(() => unavailableOffline()));
});
