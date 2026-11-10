// Service worker : met toute l'application en cache pour qu'elle fonctionne hors ligne.
// Change VERSION à chaque mise à jour publiée pour forcer le rafraîchissement du cache.
const VERSION = 'ma-montagne-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/main.js', './js/config.js', './js/util.js', './js/terrain.js', './js/sky.js', './js/props.js',
  './js/fx.js', './js/world.js', './js/controls.js', './js/state.js', './js/audio.js', './js/ui.js',
  './vendor/three/three.module.min.js',
  './vendor/three/addons/postprocessing/EffectComposer.js', './vendor/three/addons/postprocessing/RenderPass.js',
  './vendor/three/addons/postprocessing/ShaderPass.js', './vendor/three/addons/postprocessing/MaskPass.js',
  './vendor/three/addons/postprocessing/Pass.js', './vendor/three/addons/postprocessing/UnrealBloomPass.js',
  './vendor/three/addons/postprocessing/OutputPass.js',
  './vendor/three/addons/shaders/CopyShader.js', './vendor/three/addons/shaders/LuminosityHighPassShader.js',
  './vendor/three/addons/shaders/OutputShader.js',
];
// Les icônes sont mises en cache si elles existent, sans bloquer l'installation.
const OPTIONAL = ['./icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(async (c) => {
    await c.addAll(FILES);
    await Promise.all(OPTIONAL.map((u) => c.add(u).catch(() => {})));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache d'abord (réponse immédiate, même hors ligne), puis mise à jour en arrière-plan.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  }));
});
