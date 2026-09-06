const CACHE_NAME = "monecole-vite-v465";
const TRUSTED_RUNTIME_HOSTS = new Set(["cdnjs.cloudflare.com"]);
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/version.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/assets/ia-educative-fallback.js",
  "/assets/ia-educative-fallback-legacy.js"
];

const extractAssetPaths = (text, expression) => {
  const paths = [];
  let match;
  while ((match = expression.exec(text)) !== null) paths.push(match[1]);
  return paths;
};

const cacheCompiledAssets = cache => {
  const visited = new Set();
  const cacheAsset = path => {
    if (visited.has(path) || path.includes("heic-to")) return Promise.resolve();
    visited.add(path);
    return fetch(path, { cache: "no-store" }).then(response => {
      if (!response.ok) throw new Error(`${path} indisponible`);
      const stored = cache.put(path, response.clone());
      if (!/\.js(?:[?#]|$)/.test(path)) return stored;
      return response.text().then(code => {
        const imports = extractAssetPaths(code, /["']\.\/([^"'?]+\.js)["']/g)
          .map(name => new URL(name, new URL(path, self.location.origin)).pathname)
          .filter(name => name.startsWith("/assets/") && !name.includes("heic-to"));
        return stored.then(() => Promise.all(imports.map(cacheAsset)));
      });
    });
  };
  return fetch("/index.html", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error("index.html indisponible");
      return response.text();
    })
    .then(html => {
      const assets = extractAssetPaths(html, /(?:src|href|data-src)="\.\/(assets\/[^"]+)"/g)
        .map(name => `/${name}`);
      return Promise.all(Array.from(new Set(assets)).map(cacheAsset));
    });
};

self.addEventListener("install", event => {
  event.waitUntil(
    purgerAnciensCaches(2).then(() => caches.open(CACHE_NAME))
      .then(cache => cache.addAll(APP_SHELL).then(() => cacheCompiledAssets(cache)))
      .then(() => self.skipWaiting())
  );
});

// v463 — le ménage des anciennes versions ne se faisait qu'à l'activation.
// Or un service worker reste « en attente » tant que l'utilisateur ne touche
// pas « Mettre à jour maintenant » : un onglet qui choisissait « Plus tard »
// à chaque version gardait chaque cache (27 versions, près de 300 Mo, vus sur
// un poste de test). Le ménage se fait donc aussi à l'installation : on garde
// la version en cours d'installation et les deux plus récentes déjà là (celle
// qui sert encore la page et sa précédente), on supprime le reste.
const purgerAnciensCaches = (garder = 1) =>
  caches.keys().then(keys => {
    const previousCaches = keys
      .filter(key => /^monecole-vite-v\d+$/.test(key) && key !== CACHE_NAME)
      .sort((a, b) => Number(b.match(/\d+$/)?.[0] || 0) - Number(a.match(/\d+$/)?.[0] || 0));
    return Promise.all(previousCaches.slice(garder).map(key => caches.delete(key)));
  });

self.addEventListener("activate", event => {
  event.waitUntil(purgerAnciensCaches(1).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    if (!TRUSTED_RUNTIME_HOSTS.has(url.hostname)) return;
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response && (response.ok || response.type === "opaque")) {
              return cache.put(request, response.clone()).then(() => response);
            }
            return response;
          });
        })
      )
    );
    return;
  }
  if (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/storage/")) return;
  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => caches.match("/version.json")));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
