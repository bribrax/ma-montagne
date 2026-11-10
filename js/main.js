// Point d'entrée : rendu, boucle d'animation, qualité adaptative, liaison entre monde et interface.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UPGRADES } from './config.js';
import { store } from './state.js';
import { Environment } from './sky.js';
import { World } from './world.js';
import { Orbit } from './controls.js';
import { initUI } from './ui.js';
import { sfx, setSound, unlockAudio } from './audio.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 5, 2500);
const env = new Environment(scene);

store.load();
setSound(store.data.settings.sound);
env.setMode(store.data.settings.sky);

const world = new World(scene, env);
const order = Object.fromEntries(UPGRADES.map((u, i) => [u.id, i]));
for (const b of [...store.data.bought].sort((a, c) => order[a.id] - order[c.id])) world.apply(b.id, false);
world.onFirework = () => sfx('firework');

const orbit = new Orbit(camera, canvas);

// ---------- qualité adaptative ----------
// On part de la meilleure qualité et on réduit la résolution si l'appareil ne tient pas ~45 i/s.
const QUALITY = [
  { scale: 1.0, shadow: 2048, every: 2 },
  { scale: 0.85, shadow: 2048, every: 3 },
  { scale: 0.72, shadow: 1024, every: 4 },
  { scale: 0.6, shadow: 1024, every: 6 },
];
let q = 0, composer, bloom, W = 1, H = 1, msaa = 4;

function pixelRatio() {
  const cap = Math.sqrt(3.6e6 / (W * H)); // ~3,6 M de pixels au maximum
  return Math.max(0.75, Math.min(window.devicePixelRatio || 1, 2, cap) * QUALITY[q].scale);
}
function buildComposer() {
  if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: msaa });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.62, 0.6, 1.15);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
function resize() {
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  const pr = pixelRatio();
  renderer.setPixelRatio(pr);
  renderer.setSize(W, H, false);
  if (!composer) buildComposer();
  composer.setPixelRatio(pr);
  composer.setSize(W, H);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  orbit.fit(camera.aspect, !resize.done);
  resize.done = true;
  const bufH = H * pr;
  world.setPointScale(bufH / (2 * Math.tan((camera.fov * Math.PI) / 360)));
  env.starU.uSize.value = Math.max(1.6, 1.7 * pr);
  setShift(document.body.classList.contains('shop'));
}
function applyQuality() {
  const s = env.sun.shadow, size = QUALITY[q].shadow;
  if (s.mapSize.x !== size) { s.mapSize.set(size, size); if (s.map) { s.map.dispose(); s.map = null; } }
  resize();
}

// ---------- décalage de la vue quand le panneau est ouvert ----------
const shift = { x: 0, y: 0, tx: 0, ty: 0 };
let shiftOpen = false, savedDist = null;
function setShift(open) {
  const sheet = W < 700 || H > W;
  shift.tx = open && !sheet ? 180 : 0;
  shift.ty = open && sheet ? H * 0.25 : 0;
  if (open === shiftOpen) return;
  shiftOpen = open;
  // on recule un peu la caméra pour que l'île reste entière à côté du panneau
  if (open) {
    const t = Math.tan((camera.fov * Math.PI) / 360);
    const need = sheet ? (30 / t) * 1.55 : 37 / (t * ((W - 360) / H));
    if (orbit.tDist < need) { savedDist = orbit.tDist; orbit.tDist = need; }
  } else if (savedDist !== null) { orbit.tDist = savedDist; savedDist = null; }
}

// ---------- interface ----------
let skyTimer = 0;
const ui = initUI({
  buy(u) {
    if (!store.buy(u)) return;
    const f = world.apply(u.id, true);
    sfx(u.cost >= 200 ? 'big' : 'build');
    if (f && f.sky) { // aurores, feux d'artifice : on montre la nuit un instant
      env.setMode('night');
      clearTimeout(skyTimer);
      skyTimer = setTimeout(() => env.setMode(store.data.settings.sky), 40000);
    }
    if (f) orbit.focus(f.x, f.z);
    ui.toast(`${u.name} ✓`, null, null, 2200);
  },
  setSky(mode) { clearTimeout(skyTimer); env.setMode(mode); },
  onShop: setShift,
});

window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// ---------- boucle ----------
let last = performance.now(), time = 0, frame = 0;
let accT = 0, accN = 0, bad = 0, settle = 3;
function loop(now) {
  requestAnimationFrame(loop);
  const raw = (now - last) / 1000;
  last = now;
  if (document.hidden) return;
  tick(Math.min(raw, 0.05), raw);
}
function tick(dt, raw) {
  time += dt; frame++;

  env.update(dt, time, camera);
  orbit.update(dt);
  world.update(dt, time, env);

  shift.x += (shift.tx - shift.x) * Math.min(1, dt * 7);
  shift.y += (shift.ty - shift.y) * Math.min(1, dt * 7);
  if (Math.abs(shift.x) > 0.5 || Math.abs(shift.y) > 0.5) camera.setViewOffset(W, H, shift.x, shift.y, W, H);
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();

  if (frame % QUALITY[q].every === 0) renderer.shadowMap.needsUpdate = true;
  bloom.strength = 0.5 + 0.28 * env.lightsOn;
  composer.render(dt);

  if (frame === 2 && msaa) {
    // filet de sécurité : si l'appareil refuse l'anticrénelage sur une cible HDR, on s'en passe
    const gl = renderer.getContext();
    if (gl.getError() === gl.INVALID_FRAMEBUFFER_OPERATION) { msaa = 0; buildComposer(); resize(); }
  }
  if (frame === 3) document.getElementById('veil').classList.add('gone');

  // mesure du débit d'images par fenêtres de ~1,5 s
  if (raw < 0.25) { accT += raw; accN++; }
  if (accT > 1.5) {
    const fps = accN / accT;
    accT = 0; accN = 0;
    if (settle > 0) settle--;
    else if (fps < 43 && q < QUALITY.length - 1) {
      if (++bad >= 2) { q++; bad = 0; settle = 2; applyQuality(); }
    } else bad = 0;
    window.__fps = Math.round(fps);
  }
}
requestAnimationFrame(loop);

// ---------- PWA ----------
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!local || location.search.includes('sw'))) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// accès console pour le débogage
window.__mm = { world, env, orbit, store, renderer, tick, get quality() { return q; } };
