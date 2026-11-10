// Le monde : île de base + toutes les améliorations, placées à des emplacements prédéfinis.
import * as THREE from 'three';
import { GeoBuilder, mulberry32, lerp, smoothstep, vnoise, easeOutBack, easeOutCubic, Path, bandTexture, radialTexture } from './util.js';
import { groundY, groundNormal, buildTerrain, buildBase, ribbon, polar, islandR, addPad, rawAt, PEAK } from './terrain.js';
import * as P from './props.js';
import { Snowfall, Smoke, Bursts, GlowPools } from './fx.js';

const WARM = '#ffa95c';

// ---------- Plan de la station ----------
const B = polar(76, 22.3); // front de neige
const ROAD_PTS = [[-25.5, 3], [-23.5, 10], [-18.5, 16.5], [-11.5, 20.2], [-3.5, 21.8], [4.5, 21.5], [11.5, 19.5], [16.5, 15], [18.3, 10.2]];
const road = new Path(ROAD_PTS, 240);
const U_A = road.uOf(-18.5, 16.5), U_B = road.uOf(4.5, 21.5);

const CHALETS = {
  ch1: { xz: [-10.2, 17.2], w: 3.2, d: 2.6, h: 1.4, wood: 0 },
  ch2: { xz: [-15.5, 14.5], w: 3.0, d: 2.5, h: 1.3, wood: 1 },
  ch3: { xz: [-4.5, 25.8], w: 3.2, d: 2.6, h: 1.4, wood: 2 },
  ch4: { xz: [-15.5, 21.5], w: 2.9, d: 2.5, h: 1.3, wood: 3 },
  ch5: { xz: [-21.5, 8.5], w: 3.2, d: 2.6, h: 1.4, wood: 0 },
  ch6: { xz: [-1.8, 18.4], w: 3.9, d: 2.7, h: 2.5, floors: 2, wood: 1 },
  ch7: { xz: polar(135, 12), w: 3.0, d: 2.5, h: 1.3, wood: 2, face: 'down' },
  ch8: { xz: [3.5, 25.5], w: 3.0, d: 2.5, h: 1.3, wood: 0 },
  ch9: { xz: [5.4, 18.8], w: 4.3, d: 2.8, h: 1.5, wood: 2, face: [5.4, 0], terrace: true },
  ch10: { xz: [8.3, 24.2], w: 3.2, d: 2.6, h: 1.4, wood: 3 },
  ch11: { xz: [-11.5, 24.8], w: 5.0, d: 3.0, h: 3.6, floors: 3, wood: 1 },
  ch12: { xz: polar(214, 1.25), w: 2.0, d: 1.8, h: 1.15, wood: P.C.stone, face: [0, 30], refuge: true },
};
const PISTES = {
  ps1: { pts: [polar(80, 13.5), polar(77, 16.5), polar(81, 19.5), B], w: 2.6, color: '#35b06a' },
  ps2: { pts: [polar(112, 10.5), polar(102, 13), polar(92, 16), polar(97, 19), polar(88, 21.2), [0.6, 16.0]], w: 2.2, color: '#3d8bff' },
  ps5: { pts: [polar(46, 12.5), polar(52, 14.5), polar(44, 17), polar(50, 19.7), polar(54, 22.2), [8.4, 15.6]], w: 2.2, color: '#ee4a4f' },
  ps6: { pts: [polar(100, 3.2), polar(86, 6), polar(66, 8.5), polar(80, 11), polar(80, 13.5)], w: 2.0, color: '#2a2c3a' },
};
const LIFTS = {
  lf1: { a: polar(64, 20.8), b: polar(64, 13), kind: 'tbar', pyl: 2, veh: 6 },
  lf2: { a: [-7, 15.6], b: [-9.2, 3.5], kind: 'chair', pyl: 3, veh: 9 },
  lf3: { a: polar(34, 23.5), b: polar(34, 11), kind: 'gondola', pyl: 3, veh: 6 },
  lf4: { a: polar(34, 11), b: polar(34, 2.3), kind: 'gondola', pyl: 2, veh: 5, noA: true },
};
const LIFT_K = {
  tbar: { sh: 1.75, ph: 2.3, off: 0.4, speed: 1.0, clear: 1.6 },
  chair: { sh: 2.4, ph: 3.3, off: 0.6, speed: 1.2, clear: 2.3 },
  gondola: { sh: 1.8, ph: 4.0, off: 0.62, speed: 1.5, clear: 2.7 },
};
const POND = [16, 20.3], PLAZA = [-5.8, 18.6], FIRE = [12.8, 22.4], SNOWMAN = [-8.0, 19.0];

const pistePaths = Object.fromEntries(Object.entries(PISTES).map(([k, s]) => [k, new Path(s.pts, 120)]));

let padsDone = false;
function registerPads() {
  if (padsDone) return;
  padsDone = true;
  const o = {};
  for (let u = 0; u <= 1.0001; u += 1.3 / road.length) { road.at(u, o); addPad(o.x, o.z, 1.2); }
  addPad(PEAK.x, PEAK.z, 2.4, rawAt(...polar(72, 2.3)));
  for (const s of Object.values(CHALETS)) if (!s.refuge) addPad(s.xz[0], s.xz[1], Math.max(s.w, s.d) / 2 + 0.7);
  for (const s of Object.values(LIFTS)) {
    if (!s.noA) addPad(s.a[0], s.a[1], s.kind === 'gondola' ? 2.3 : 1.2);
    if (s !== LIFTS.lf4) addPad(s.b[0], s.b[1], s.kind === 'gondola' ? 2.3 : 1.2);
  }
  addPad(POND[0], POND[1], 2.9);
  addPad(PLAZA[0], PLAZA[1], 2.2);
  addPad(FIRE[0], FIRE[1], 1.2);
}

// InstancedMesh avec mémoire des transformations (pour animer l'apparition de chaque instance).
class Inst {
  constructor(geo, material, cap, shadow = false) {
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow; this.mesh.receiveShadow = shadow;
    this.t = [];
  }
  add(x, y, z, ry = 0, s = 1, color = null, q = null) {
    if (this.mesh.count >= this.mesh.instanceMatrix.count) return -1;
    const i = this.mesh.count++;
    this.t.push({ p: new THREE.Vector3(x, y, z), q: q ? q.clone() : new THREE.Quaternion().setFromAxisAngle(_Y, ry), s });
    this.set(i, 1);
    if (color) { this.mesh.setColorAt(i, _col.set(color)); this.mesh.instanceColor.needsUpdate = true; }
    return i;
  }
  set(i, k) {
    const t = this.t[i], s = Math.max(1e-4, t.s * k);
    this.mesh.setMatrixAt(i, _m.compose(t.p, t.q, _s.set(s, s, s)));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
const _Y = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _col = new THREE.Color();
const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _o = {};

const WF_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WF_FS = /* glsl */ `
uniform float uTime, uLight, uGrow, uLen;
varying vec2 vUv;
void main() {
  float lane = floor(vUv.x * 5.0);
  float streak = smoothstep(0.15, 0.95, fract(vUv.y * 0.45 - uTime * (1.1 + lane * 0.13) + lane * 0.37));
  vec3 col = mix(vec3(0.42, 0.7, 0.96), vec3(0.95, 0.98, 1.0), streak * 0.6 + 0.12);
  float edge = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 4.0);
  float a = edge * 0.92 * smoothstep(1.0, 0.6, vUv.y / uLen) * step(vUv.y / uLen, uGrow);
  gl_FragColor = vec4(col * uLight, a);
}`;

export class World {
  constructor(scene, env) {
    this.scene = scene; this.env = env;
    this.tweens = []; this.lifts = []; this.skiers = []; this.pisteList = []; this.flags = {};
    this.focusPoints = {};
    registerPads();

    // matériaux partagés
    this.matVC = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.winMats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial());
    this.bulbMat = new THREE.MeshBasicMaterial();
    this.coolBulbMat = new THREE.MeshBasicMaterial();
    this.headMat = new THREE.MeshBasicMaterial();
    this.beaconMat = new THREE.MeshBasicMaterial();
    this.flameMat = new THREE.MeshBasicMaterial();
    this.starMat = new THREE.MeshBasicMaterial();
    this.garlandMat = new THREE.MeshBasicMaterial();
    const band = bandTexture();
    this.roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.pisteGlowMat = new THREE.MeshBasicMaterial({ map: band, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.beamMat = new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });

    // île
    const terrain = new THREE.Mesh(buildTerrain(), this.matVC);
    terrain.castShadow = true; terrain.receiveShadow = true;
    const base = new THREE.Mesh(buildBase(), this.matVC);
    base.castShadow = true;
    scene.add(terrain, base);

    // systèmes instanciés
    this.trees = new Inst(P.pineGeo(), this.matVC, 330, true);
    this.rocks = new Inst(P.rockGeo(), this.matVC, 40, true);
    const lg = P.lampGeos(), pg = P.pisteLampGeos();
    this.lampPoles = new Inst(lg.pole, this.matVC, 90, true);
    this.lampBulbs = new Inst(lg.bulb, this.bulbMat, 90);
    this.pLampPoles = new Inst(pg.pole, this.matVC, 70, true);
    this.pLampBulbs = new Inst(pg.bulb, this.coolBulbMat, 70);
    this.markers = new Inst(P.markerGeo(), this.matVC, 420);
    this.skierMesh = new THREE.InstancedMesh(P.skierGeo(), this.matVC, 64);
    this.skierMesh.count = 0; this.skierMesh.frustumCulled = false;
    this.garland = new Inst(new THREE.IcosahedronGeometry(0.075, 0), this.garlandMat, 140);
    this.pools = new GlowPools(300);
    this.snow = new Snowfall(750);
    this.smoke = new Smoke(26, 7);
    this.puffs = new Bursts(320, false);
    this.sparks = new Bursts(520, true);
    for (const o of [this.trees, this.rocks, this.lampPoles, this.lampBulbs, this.pLampPoles, this.pLampBulbs, this.markers, this.garland, this.pools, this.snow, this.smoke, this.puffs, this.sparks]) scene.add(o.mesh);
    scene.add(this.skierMesh);

    // anneau qui s'élargit à chaque construction
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.ring.renderOrder = 3; this.ring.visible = false;
    scene.add(this.ring);

    // quelques vraies lumières ponctuelles pour réchauffer les quartiers la nuit
    const pl = (x, y, z, dist) => { const l = new THREE.PointLight(WARM, 0, dist, 1.6); l.position.set(x, y, z); l.userData.w = 0; scene.add(l); return l; };
    this.pl = {
      village: pl(-7, 0, 19, 20), west: pl(-15.5, 0, 18.5, 20), ski: pl(5, 0, 16.5, 20), summit: pl(PEAK.x, 0, PEAK.z + 1, 16),
    };
    for (const l of Object.values(this.pl)) l.position.y = groundY(l.position.x, l.position.z) + 3.2;

    this.genScatter();
    for (const t of this.treeTiers[0]) this.addTree(t, false);
    this.fwTimer = 2;
  }

  // ---------- animation ----------
  tween(animate, dur, delay, fn, done) {
    if (!animate) { fn(1); done && done(); return; }
    fn(0);
    this.tweens.push({ t: -delay, dur, fn, done });
  }
  later(animate, delay, fn) { if (!animate) fn(); else this.tweens.push({ t: -delay, dur: 0, fn: () => {}, done: fn }); }
  pop(obj, animate, delay = 0, dur = 0.65) {
    const target = obj.scale.clone();
    this.tween(animate, dur, delay, (k) => obj.scale.copy(target).multiplyScalar(Math.max(1e-4, easeOutBack(k))));
  }
  popInst(inst, i, animate, delay = 0) {
    if (i < 0) return;
    this.tween(animate, 0.55, delay, (k) => inst.set(i, easeOutBack(k)));
  }
  puff(animate, x, y, z, n = 16, delay = 0, size = 0.45) {
    if (!animate) return;
    this.later(true, delay, () => this.puffs.emit(x, y + 0.2, z, n, { speed: 2.6, up: 1.8, size, life: 0.9, gravity: -3.5, drag: 2.2 }));
  }
  pulse(x, z, radius = 5) {
    const y = groundY(x, z) + 0.25;
    this.ring.position.set(x, y, z); this.ring.visible = true;
    this.tween(true, 1.1, 0, (k) => { const e = easeOutCubic(k); this.ring.scale.setScalar(0.5 + radius * e); this.ring.material.opacity = 0.55 * (1 - k); }, () => { this.ring.visible = false; });
  }

  // ---------- semis d'arbres et de rochers ----------
  blocked(x, z, margin = 0) {
    if (road.dist(x, z) < 1.6 + margin) return true;
    for (const [k, s] of Object.entries(PISTES)) if (pistePaths[k].dist(x, z) < s.w / 2 + 0.9 + margin) return true;
    for (const s of Object.values(CHALETS)) if (Math.hypot(x - s.xz[0], z - s.xz[1]) < Math.max(s.w, s.d) / 2 + 1.1 + margin) return true;
    for (const s of Object.values(LIFTS)) {
      const [ax, az] = s.a, [bx, bz] = s.b, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) < 1.9 + margin) return true;
    }
    if (Math.hypot(x - POND[0], z - POND[1]) < 3.4) return true;
    if (Math.hypot(x - PLAZA[0], z - PLAZA[1]) < 2.6) return true;
    if (Math.hypot(x - FIRE[0], z - FIRE[1]) < 1.8) return true;
    if (Math.hypot(x - SNOWMAN[0], z - SNOWMAN[1]) < 1.2) return true;
    if (Math.hypot(x - PEAK.x, z - PEAK.z) < 5) return true;
    if (x > -2.5 && x < 10.5 && z > 13.6 && z < 20.6) return true; // front de neige
    return false;
  }
  genScatter() {
    const rng = mulberry32(77), n = new THREE.Vector3(), all = [];
    const want = [95, 45, 75, 110], total = want.reduce((a, b) => a + b, 0);
    for (let tries = 0; all.length < total && tries < 40000; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 30;
      if (r > islandR(a) - 2.2) continue;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.blocked(x, z)) continue;
      const y = groundY(x, z);
      if (groundNormal(x, z, n).y < 0.66) continue;
      if (rng() < smoothstep(4, 16, y)) continue;
      if (vnoise(x * 0.16 + 9, z * 0.16 + 2) < 0.4 && rng() < 0.75) continue;
      let ok = true;
      for (const t of all) if ((t.x - x) ** 2 + (t.z - z) ** 2 < 1.7) { ok = false; break; }
      if (!ok) continue;
      all.push({ x, y: y - 0.12, z, s: 0.85 + rng() * 0.8, ry: rng() * 6.28, tint: 0.82 + rng() * 0.3 });
    }
    this.treeTiers = []; let k = 0;
    for (const w of want) { this.treeTiers.push(all.slice(k, k + w)); k += w; }
    for (let i = 0, tries = 0; i < 34 && tries < 2000; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 28;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (r > islandR(a) - 2 || this.blocked(x, z, 0.4)) continue;
      const s = 0.35 + rng() * 0.75;
      this.rocks.add(x, groundY(x, z) + s * 0.1, z, rng() * 6.28, s, _col.setScalar(0.85 + rng() * 0.3));
      i++;
    }
  }
  addTree(t, animate, delay = 0) {
    const i = this.trees.add(t.x, t.y, t.z, t.ry, t.s, _col.setScalar(t.tint));
    this.popInst(this.trees, i, animate, delay);
    this.puff(animate, t.x, t.y, t.z, 3, delay, 0.3);
  }
  addForest(tier, animate) {
    const list = this.treeTiers[tier];
    list.forEach((t, i) => this.addTree(t, animate, (i / list.length) * 2.2));
    return { x: 0, z: 8 };
  }

  // ---------- éclairage ----------
  addLamp(x, z, animate, delay = 0) {
    const y = groundY(x, z) - 0.05, ry = Math.random() * 6.28;
    this.popInst(this.lampPoles, this.lampPoles.add(x, y, z, ry), animate, delay);
    this.popInst(this.lampBulbs, this.lampBulbs.add(x, y, z, ry), animate, delay);
    const pi = this.pools.add(x, y + 0.14, z, 2.5, WARM, groundNormal(x, z));
    this.tween(animate, 0.6, delay + 0.2, (k) => this.pools.setScale(pi, easeOutCubic(k)));
    this.puff(animate, x, y, z, 5, delay, 0.3);
  }
  addPool(x, z, radius, animate, delay = 0, color = WARM) {
    const pi = this.pools.add(x, groundY(x, z) + 0.13, z, radius, color, groundNormal(x, z));
    this.tween(animate, 0.7, delay, (k) => this.pools.setScale(pi, easeOutCubic(k)));
    return pi;
  }

  // ---------- chalets ----------
  addChalet(id, animate) {
    const s = CHALETS[id], [x, z] = s.xz, y = groundY(x, z);
    let fx, fz;
    if (s.face === 'down') { fx = x + (x - PEAK.x); fz = z + (z - PEAK.z); }
    else if (s.face) { [fx, fz] = s.face; }
    else { road.at(road.uOf(x, z), _o); fx = _o.x; fz = _o.z; }
    const ry = Math.atan2(fx - x, fz - z), sin = Math.sin(ry), cos = Math.cos(ry);
    const c = P.makeChalet({ ...s, wood: typeof s.wood === 'number' ? P.C.wood[s.wood] : s.wood, gable: s.refuge ? P.C.stone2 : undefined });
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry;
    const body = new THREE.Mesh(c.body, this.matVC);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body, new THREE.Mesh(c.glass, this.winMats[Object.keys(CHALETS).indexOf(id) % 3]));
    const toWorld = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
    if (s.terrace) {
      const t = new THREE.Mesh(P.terraceGeo(s.w + 0.4), this.matVC);
      t.position.set(0, 0, s.d / 2 + 1.0); t.castShadow = true;
      g.add(t);
      for (let i = 0; i < 9; i++) { // guirlande au-dessus de la terrasse
        const k = i / 8, [wx, wz] = toWorld((k - 0.5) * (s.w + 0.2), s.d / 2 + 1.9);
        this.garland.add(wx, y + 2.0 - Math.sin(k * Math.PI) * 0.35, wz, 0, 1, GARLAND_COLS[i % 2 ? 0 : 4]);
      }
      this.addPool(...toWorld(0, s.d / 2 + 1.4), 3.4, animate, 0.4);
    }
    if (s.refuge) {
      const a = new THREE.Mesh(P.antennaGeo(), this.matVC);
      a.position.set(-0.7, c.top - 0.3, -0.3);
      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), this.beaconMat);
      beacon.position.set(-0.7, c.top + 2.4, -0.3);
      g.add(a, beacon);
    }
    this.scene.add(g);
    this.pop(g, animate);
    this.puff(animate, x, y, z, 26, 0.05, 0.55);
    if (c.smoke) {
      const [sx, sz] = toWorld(c.smoke.x, c.smoke.z);
      this.later(animate, 0.9, () => this.smoke.add(sx, y + c.smoke.y, sz, s.floors > 1 ? 1.25 : 1));
    }
    this.addPool(...toWorld(0, s.d / 2 + 1.2), s.w * 0.8, animate, 0.4);
    this.addPool(...toWorld(0, -s.d / 2 - 1.0), s.w * 0.62, animate, 0.5);
    // chaleur du quartier
    const L = this.pl;
    if (id === 'ch12') L.summit.userData.w = 1;
    else if (['ch2', 'ch4', 'ch5', 'ch11'].includes(id)) L.west.userData.w = Math.min(1, L.west.userData.w + 0.45);
    else if (['ch9', 'ch8', 'ch10'].includes(id)) L.ski.userData.w = Math.min(1, L.ski.userData.w + 0.5);
    else L.village.userData.w = Math.min(1, L.village.userData.w + 0.45);
    return { x, z };
  }

  // ---------- routes ----------
  addRoad(u0, u1, animate) {
    const cols = 4, geo = ribbon(road, u0, u1, 1.75, cols, 0.07, 0.45);
    const uv = geo.attributes.uv, col = new Float32Array(uv.count * 3);
    const edge = new THREE.Color('#c4cbe4'), mid = new THREE.Color('#55536c');
    for (let i = 0; i < uv.count; i++) {
      const e = Math.abs(uv.getX(i) - 0.5) > 0.3 ? edge : mid;
      col.set([e.r, e.g, e.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, this.roadMat);
    m.receiveShadow = true;
    this.scene.add(m);
    const n = geo.index.count;
    this.tween(animate, 1.6, 0, (k) => geo.setDrawRange(0, Math.floor((n * easeOutCubic(k)) / 6) * 6));
    if (animate) for (let i = 0; i <= 6; i++) { road.at(lerp(u0, u1, i / 6), _o); this.puff(true, _o.x, groundY(_o.x, _o.z), _o.z, 5, i * 0.2, 0.35); }
    road.at((u0 + u1) / 2, _o);
    return { x: _o.x, z: _o.z };
  }
  addRoadLamps(u0, u1, animate) {
    const step = 4.4 / road.length, lo = Math.min(u0, u1), hi = Math.max(u0, u1);
    let i = 0;
    for (let u = lo + step * 0.4; u < hi; u += step, i++) {
      road.at(u, _o);
      const side = i % 2 ? 1 : -1;
      this.addLamp(_o.x - _o.tz * side * 1.3, _o.z + _o.tx * side * 1.3, animate, i * 0.12);
    }
    road.at((u0 + u1) / 2, _o);
    return { x: _o.x, z: _o.z };
  }
  addBus(animate) {
    const bg = P.busGeos(), g = new THREE.Group();
    const body = new THREE.Mesh(bg.body, this.matVC); body.castShadow = true;
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4).rotateX(-Math.PI / 2), this.beamMat);
    beam.position.set(0, 0.06, 2.9);
    g.add(body, new THREE.Mesh(bg.glass, this.winMats[1]), new THREE.Mesh(bg.lights, this.headMat), beam);
    this.scene.add(g);
    this.bus = { g, u: U_B, dir: 1, wait: 0 };
    this.pop(g, animate);
    road.at(U_B, _o);
    this.puff(animate, _o.x, groundY(_o.x, _o.z), _o.z, 14);
    return { x: _o.x, z: _o.z };
  }

  // ---------- pistes ----------
  addPiste(id, animate) {
    const s = PISTES[id], path = pistePaths[id];
    const geo = ribbon(path, 0, 1, s.w + 0.5, 4, 0.06, 0.4);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: bandTexture(s.color, '208,224,255'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true; m.renderOrder = 1;
    this.scene.add(m);
    const n = geo.index.count, dur = 1.2 + path.length * 0.07;
    this.tween(animate, dur, 0, (k) => geo.setDrawRange(0, Math.floor((n * k) / 6) * 6));
    const count = Math.floor(path.length / 2.1);
    for (let i = 0; i <= count; i++) {
      const u = i / count;
      path.at(u, _o);
      for (const side of [1, -1]) {
        const x = _o.x - _o.tz * side * (s.w / 2 + 0.05), z = _o.z + _o.tx * side * (s.w / 2 + 0.05);
        this.popInst(this.markers, this.markers.add(x, groundY(x, z) - 0.05, z, 0, 1, side > 0 ? s.color : '#ff7a3a'), animate, u * dur);
      }
      if (i % 3 === 0) this.puff(animate, _o.x, groundY(_o.x, _o.z), _o.z, 4, u * dur, 0.35);
    }
    this.pisteList.push({ id, path, w: s.w });
    this.syncSkiers();
    path.at(0.5, _o);
    return { x: _o.x, z: _o.z };
  }
  lightPistes(ids, animate) {
    let f = null;
    ids.forEach((id, n) => {
      const s = PISTES[id], path = pistePaths[id];
      const geo = ribbon(path, 0, 1, s.w * 1.7, 4, 0.1, 0.5);
      const m = new THREE.Mesh(geo, this.pisteGlowMat);
      m.renderOrder = 2;
      this.scene.add(m);
      const cnt = geo.index.count;
      this.tween(animate, 1.8, n * 0.5, (k) => geo.setDrawRange(0, Math.floor((cnt * k) / 6) * 6));
      const count = Math.max(2, Math.round(path.length / 4.2));
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) / count, side = i % 2 ? 1 : -1;
        path.at(u, _o);
        const x = _o.x - _o.tz * side * (s.w / 2 + 0.5), z = _o.z + _o.tx * side * (s.w / 2 + 0.5), y = groundY(x, z) - 0.05;
        const ry = Math.atan2(_o.tx * side, _o.tz * side); // tête tournée vers la piste
        const d = n * 0.5 + u * 1.6;
        this.popInst(this.pLampPoles, this.pLampPoles.add(x, y, z, ry), animate, d);
        this.popInst(this.pLampBulbs, this.pLampBulbs.add(x, y, z, ry), animate, d);
      }
      path.at(0.5, _o); f = { x: _o.x, z: _o.z };
    });
    return f;
  }
  addArches(animate) {
    [['ps1', 0.88, '#3f7fe0'], ['ps2', 0.9, '#e2484d']].forEach(([id, u, color], i) => {
      pistePaths[id].at(u, _o);
      const m = new THREE.Mesh(P.archGeo(color), this.matVC);
      m.position.set(_o.x, groundY(_o.x, _o.z) + 0.3, _o.z);
      m.rotation.y = Math.atan2(_o.tx, _o.tz);
      m.castShadow = true;
      this.scene.add(m);
      this.pop(m, animate, i * 0.25);
      this.puff(animate, _o.x, m.position.y, _o.z, 16, i * 0.25);
    });
    this.pl.ski.userData.w = Math.min(1, this.pl.ski.userData.w + 0.3);
    return { x: B[0], z: B[1] };
  }

  // ---------- remontées ----------
  addLift(id, animate) {
    const s = LIFTS[id], K = LIFT_K[s.kind], [ax, az] = s.a, [bx, bz] = s.b;
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, px = -uz, pz = ux;
    const yaw = Math.atan2(ux, uz), ya = groundY(ax, az), yb = groundY(bx, bz);
    const sup = [{ d: 0, y: ya + K.sh }];
    for (let i = 1; i <= s.pyl; i++) {
      const d = (len * i) / (s.pyl + 1), x = ax + ux * d, z = az + uz * d, gy = groundY(x, z);
      sup.push({ d, y: gy + K.ph, gy, x, z, pylon: true });
    }
    sup.push({ d: len, y: yb + K.sh });
    const yAt = (d) => {
      let i = 0;
      while (i < sup.length - 2 && d > sup[i + 1].d) i++;
      return lerp(sup[i].y, sup[i + 1].y, (d - sup[i].d) / (sup[i + 1].d - sup[i].d));
    };
    for (let pass = 0; pass < 4; pass++) for (let i = 0; i < sup.length - 1; i++) for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const d = lerp(sup[i].d, sup[i + 1].d, t), need = groundY(ax + ux * d, az + uz * d) + K.clear - yAt(d);
      if (need > 0) { if (sup[i].pylon) sup[i].y += need; if (sup[i + 1].pylon) sup[i + 1].y += need; }
    }
    const g = new THREE.Group();
    this.scene.add(g);
    let n = 0;
    const place = (mesh, x, y, z, shadow = true) => {
      mesh.position.set(x, y, z); mesh.rotation.y = yaw; mesh.castShadow = shadow;
      g.add(mesh);
      this.pop(mesh, animate, n * 0.16);
      this.puff(animate, x, y, z, 12, n * 0.16);
      n++;
    };
    const station = (x, y, z) => {
      if (s.kind === 'gondola') {
        const sg = P.stationGeos(), grp = new THREE.Group();
        const b = new THREE.Mesh(sg.body, this.matVC); b.castShadow = true; b.receiveShadow = true;
        grp.add(b, new THREE.Mesh(sg.glass, this.winMats[2]));
        place(grp, x, y, z);
        this.addPool(x - px * 2.4, z - pz * 2.4, 2.6, animate, 0.5);
        this.addPool(x + px * 2.4, z + pz * 2.4, 2.6, animate, 0.5);
      } else place(new THREE.Mesh(P.portalGeo(K.sh, K.off), this.matVC), x, y, z);
    };
    if (!s.noA) station(ax, ya, az);
    for (const p of sup) if (p.pylon) place(new THREE.Mesh(P.pylonGeo(p.y - p.gy, K.off), this.matVC), p.x, p.gy, p.z);
    station(bx, yb, bz);
    const cb = new GeoBuilder();
    for (let i = 0; i < sup.length - 1; i++) for (const sd of [1, -1]) {
      const a = sup[i], b = sup[i + 1];
      cb.beam(new THREE.Vector3(ax + ux * a.d + px * K.off * sd, a.y, az + uz * a.d + pz * K.off * sd),
        new THREE.Vector3(ax + ux * b.d + px * K.off * sd, b.y, az + uz * b.d + pz * K.off * sd), 0.028, '#23253a');
    }
    const cables = new THREE.Mesh(cb.build(), this.matVC);
    cables.visible = false; g.add(cables);
    let veh, glass = null;
    if (s.kind === 'gondola') {
      const cg = P.cabinGeos();
      veh = new THREE.InstancedMesh(cg.body, this.matVC, s.veh);
      glass = new THREE.InstancedMesh(cg.glass, this.winMats[0], s.veh);
      glass.frustumCulled = false; g.add(glass);
    } else veh = new THREE.InstancedMesh(s.kind === 'chair' ? P.chairGeo() : P.tbarGeo(), this.matVC, s.veh);
    veh.frustumCulled = false; veh.castShadow = true;
    g.add(veh);
    const lift = { ax, az, ux, uz, px, pz, len, off: K.off, yAt, veh, glass, n: s.veh, speed: K.speed, appear: 0, loop: 2 * len + 2 * Math.PI * K.off };
    this.lifts.push(lift);
    this.later(animate, n * 0.16 + 0.2, () => { cables.visible = true; });
    this.tween(animate, 0.8, n * 0.16 + 0.2, (k) => { lift.appear = easeOutBack(k); });
    this.syncSkiers();
    if (id === 'lf4') this.pl.summit.userData.w = Math.max(this.pl.summit.userData.w, 0.6);
    if (id === 'lf3') this.pl.ski.userData.w = Math.min(1, this.pl.ski.userData.w + 0.2);
    return { x: (ax + bx) / 2, z: (az + bz) / 2 };
  }
  updateLifts(time) {
    for (const L of this.lifts) {
      const arc = Math.PI * L.off;
      for (let i = 0; i < L.n; i++) {
        const s = (time * L.speed + (i * L.loop) / L.n) % L.loop;
        let d, ox, oz, vx, vz;
        if (s < L.len) { d = s; ox = L.px * L.off; oz = L.pz * L.off; vx = L.ux; vz = L.uz; }
        else if (s < L.len + arc) {
          const th = (s - L.len) / L.off, c = Math.cos(th), sn = Math.sin(th);
          d = L.len; ox = (L.px * c + L.ux * sn) * L.off; oz = (L.pz * c + L.uz * sn) * L.off;
          vx = -L.px * sn + L.ux * c; vz = -L.pz * sn + L.uz * c;
        } else if (s < 2 * L.len + arc) { d = L.len - (s - L.len - arc); ox = -L.px * L.off; oz = -L.pz * L.off; vx = -L.ux; vz = -L.uz; }
        else {
          const th = (s - 2 * L.len - arc) / L.off, c = Math.cos(th), sn = Math.sin(th);
          d = 0; ox = -(L.px * c + L.ux * sn) * L.off; oz = -(L.pz * c + L.uz * sn) * L.off;
          vx = L.px * sn - L.ux * c; vz = L.pz * sn - L.uz * c;
        }
        const k = Math.max(1e-4, L.appear);
        _m.compose(_p.set(L.ax + L.ux * d + ox, L.yAt(d), L.az + L.uz * d + oz), _q.setFromAxisAngle(_Y, Math.atan2(vx, vz)), _s.set(k, k, k));
        L.veh.setMatrixAt(i, _m);
        if (L.glass) L.glass.setMatrixAt(i, _m);
      }
      L.veh.instanceMatrix.needsUpdate = true;
      if (L.glass) L.glass.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- skieurs ----------
  syncSkiers() {
    if (!this.pisteList.length) return;
    const want = Math.min(60, this.pisteList.length * 7 + this.lifts.length * 5);
    while (this.skiers.length < want) {
      const sk = { color: new THREE.Color(SKI_COLS[this.skiers.length % SKI_COLS.length]) };
      this.resetSkier(sk, true);
      this.skiers.push(sk);
    }
    this.skierMesh.count = this.skiers.length;
    this.skiers.forEach((sk, i) => this.skierMesh.setColorAt(i, sk.color));
    this.skierMesh.instanceColor.needsUpdate = true;
  }
  resetSkier(sk, first) {
    const p = this.pisteList[Math.floor(Math.random() * this.pisteList.length)];
    const ps1 = this.pisteList.find((q) => q.id === 'ps1');
    sk.route = p.id === 'ps6' && ps1 ? [p, ps1] : [p];
    sk.k = 0; sk.u = first ? Math.random() : 0;
    sk.wait = first ? 0 : Math.random() * 4;
    sk.speed = 2.4 + Math.random() * 2.4;
    sk.phase = Math.random() * 6.28; sk.freq = 0.45 + Math.random() * 0.35;
  }
  updateSkiers(dt) {
    const n = this.skiers.length;
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const sk = this.skiers[i];
      let scale = 1.05;
      if (sk.wait > 0) { sk.wait -= dt; scale = 1e-4; }
      else {
        sk.u += (sk.speed * dt) / sk.route[sk.k].path.length;
        if (sk.u >= 1) { sk.k++; sk.u = 0; if (sk.k >= sk.route.length) { this.resetSkier(sk, false); } }
      }
      const seg = sk.route[sk.k], path = seg.path;
      path.at(sk.u, _o);
      const ph = sk.u * path.length * sk.freq + sk.phase, amp = seg.w * 0.3;
      const off = Math.sin(ph) * amp, dOff = Math.cos(ph) * sk.freq * amp;
      const x = _o.x - _o.tz * off, z = _o.z + _o.tx * off;
      const hx = _o.tx - _o.tz * dOff, hz = _o.tz + _o.tx * dOff;
      const ends = sk.k === 0 ? smoothstep(0, 0.03, sk.u) : 1;
      const fin = sk.k === sk.route.length - 1 ? smoothstep(1, 0.97, sk.u) : 1;
      scale *= Math.max(1e-4, ends * fin);
      _m.compose(_p.set(x, groundY(x, z) + 0.05, z), _q.setFromAxisAngle(_Y, Math.atan2(hx, hz)), _s.set(scale, scale, scale));
      this.skierMesh.setMatrixAt(i, _m);
    }
    this.skierMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- ambiance ----------
  addSnowman(animate) {
    const [x, z] = SNOWMAN, m = new THREE.Mesh(P.snowmanGeo(), this.matVC);
    m.position.set(x, groundY(x, z) - 0.05, z); m.rotation.y = 0.4; m.castShadow = true;
    this.scene.add(m);
    this.pop(m, animate);
    this.puff(animate, x, m.position.y, z, 18);
    return { x, z };
  }
  addCampfire(animate) {
    const [x, z] = FIRE, y = groundY(x, z), cg = P.campfireGeos(), g = new THREE.Group();
    const body = new THREE.Mesh(cg.body, this.matVC); body.castShadow = true;
    this.flame = new THREE.Mesh(cg.flame, this.flameMat);
    g.add(body, this.flame);
    g.position.set(x, y, z);
    this.scene.add(g);
    this.pop(g, animate);
    this.puff(animate, x, y, z, 14);
    this.firePool = this.addPool(x, z, 3.4, animate, 0.3, '#ff9a4a');
    this.later(animate, 0.6, () => this.smoke.add(x, y + 0.9, z, 0.8));
    return { x, z };
  }
  addPond(animate) {
    const [x, z] = POND, y = groundY(x, z), g = new THREE.Group();
    const ice = new THREE.Mesh(new THREE.CircleGeometry(2.3, 16).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#a9d6f5', emissive: '#12324e' }));
    ice.position.y = 0.07; ice.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.38, 0.2, 5, 16).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: P.C.snow, flatShading: true }));
    rim.position.y = 0.04;
    const fence = new THREE.Mesh(P.fenceGeo(2.85, 14), this.matVC);
    fence.castShadow = true;
    this.skaters = new THREE.Group();
    const sg = P.skierGeo();
    ['#ff6b6b', '#ffd166', '#6bc5ff'].forEach((c, i) => {
      const m = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ color: c, vertexColors: true }));
      const piv = new THREE.Group();
      piv.rotation.y = (i / 3) * Math.PI * 2;
      m.position.set(0.9 + i * 0.35, 0.1, 0); m.scale.setScalar(1.1);
      piv.userData.speed = 0.9 - i * 0.2;
      piv.add(m); this.skaters.add(piv);
    });
    g.add(ice, rim, fence, this.skaters);
    g.position.set(x, y, z);
    this.scene.add(g);
    this.pop(g, animate);
    this.puff(animate, x, y, z, 30, 0, 0.6);
    for (const a of [0.8, 3.6]) this.addLamp(x + Math.cos(a) * 3.3, z + Math.sin(a) * 3.3, animate, 0.4);
    return { x, z };
  }
  addXmasTree(animate) {
    const [x, z] = PLAZA, y = groundY(x, z), S = 2.3;
    const tree = new THREE.Mesh(this.trees.mesh.geometry, this.matVC);
    tree.position.set(x, y - 0.1, z); tree.scale.setScalar(S); tree.castShadow = true;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), this.starMat);
    star.position.set(x, y + 3.05 * S + 0.1, z);
    this.scene.add(tree, star);
    this.pop(tree, animate, 0, 0.9); this.pop(star, animate, 0.8);
    this.puff(animate, x, y, z, 30, 0, 0.6);
    const add = (bx, by, bz, i, d) => this.popInst(this.garland, this.garland.add(bx, by, bz, 0, 1.25, GARLAND_COLS[i % GARLAND_COLS.length]), animate, d);
    for (let i = 0; i < 44; i++) {
      const t = i / 43, a = t * Math.PI * 9, r = lerp(2.0, 0.3, t);
      add(x + Math.cos(a) * r, y + lerp(1.5, 6.3, t), z + Math.sin(a) * r, i, 0.5 + t * 1.2);
    }
    const pb = new GeoBuilder(), top = new THREE.Vector3(x, y + 4.4, z);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3, px = x + Math.cos(a) * 3.0 * 0.57, pz = z + Math.sin(a) * 3.0 * 0.57, py = groundY(px, pz);
      pb.cyl(0.04, 0.06, 2.0, 5, px, py - 0.1, pz, P.C.metalDark);
      const end = new THREE.Vector3(px, py + 1.9, pz);
      let prev = top.clone();
      for (let j = 1; j <= 8; j++) {
        const t = j / 8, q = top.clone().lerp(end, t);
        q.y -= Math.sin(t * Math.PI) * 0.55;
        pb.beam(prev, q, 0.012, '#23253a', 3);
        if (j < 8) add(q.x, q.y - 0.06, q.z, j + k, 1.2 + t * 0.6 + k * 0.08);
        prev = q;
      }
    }
    const strings = new THREE.Mesh(pb.build(), this.matVC);
    this.scene.add(strings);
    strings.visible = !animate;
    this.later(animate, 1.1, () => { strings.visible = true; });
    this.addPool(x, z, 4.2, animate, 0.8, '#ffd9a0');
    this.pl.village.userData.w = 1;
    return { x, z };
  }
  addWaterfall(animate) {
    const [cx, cz] = POND, l = Math.hypot(cx, cz), ex = cx / l, ez = cz / l, R = islandR(Math.atan2(cz, cx));
    const pts = [];
    for (let i = 0; i <= 7; i++) { const d = lerp(l + 2.3, R - 0.9, i / 7), x = ex * d, z = ez * d; pts.push([x, groundY(x, z) + 0.09, z, 1.0]); }
    pts.push([ex * (R + 0.42), -0.02, ez * (R + 0.42), 1.1], [ex * (R + 0.8), -1.0, ez * (R + 0.8), 1.2], [ex * (R + 1.0), -5, ez * (R + 1.0), 1.3], [ex * (R + 1.05), -10.5, ez * (R + 1.05), 1.5]);
    const pos = [], uv = [], idx = [];
    let acc = 0;
    pts.forEach((p, i) => {
      if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1], p[2] - pts[i - 1][2]);
      const hw = p[3] / 2;
      pos.push(p[0] + ez * hw, p[1], p[2] - ex * hw, p[0] - ez * hw, p[1], p[2] + ex * hw);
      uv.push(0, acc, 1, acc);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.wfU = { uTime: { value: 0 }, uLight: { value: 1 }, uGrow: { value: 0 }, uLen: { value: acc } };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.wfU, vertexShader: WF_VS, fragmentShader: WF_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 3;
    this.scene.add(m);
    this.tween(animate, 2.2, 0, (k) => { this.wfU.uGrow.value = k * 1.05; });
    return { x: ex * R, z: ez * R };
  }

  // ---------- catalogue : identifiant -> construction ----------
  apply(id, animate = true) {
    let f;
    if (id.startsWith('ch')) f = this.addChalet(id, animate);
    else switch (id) {
      case 'rd1': f = this.addRoad(U_A, U_B, animate); break;
      case 'rd2': f = this.addRoadLamps(U_A, U_B, animate); break;
      case 'rd3': f = this.addRoad(U_B, 1, animate); break;
      case 'rd4': f = this.addRoadLamps(U_B, 1, animate); break;
      case 'rd5': f = this.addBus(animate); break;
      case 'rd6': f = this.addRoad(U_A, 0, animate); this.addRoadLamps(0, U_A, animate); this.flags.col = true; break;
      case 'lf1': case 'lf2': case 'lf3': case 'lf4': f = this.addLift(id, animate); break;
      case 'ps1': case 'ps2': case 'ps5': case 'ps6': f = this.addPiste(id, animate); break;
      case 'ps3': f = this.addArches(animate); break;
      case 'ps4': f = this.lightPistes(['ps1', 'ps2'], animate); break;
      case 'ps7': f = this.lightPistes(['ps5', 'ps6'], animate); break;
      case 'am1': f = this.addForest(1, animate); break;
      case 'am3': f = this.addForest(2, animate); break;
      case 'am7': f = this.addForest(3, animate); break;
      case 'am2': f = this.addSnowman(animate); break;
      case 'am4': f = this.addCampfire(animate); break;
      case 'am5': f = this.addPond(animate); break;
      case 'am6': f = this.addXmasTree(animate); break;
      case 'am8': f = this.addWaterfall(animate); break;
      case 'am9': this.env.auroraTarget = 1; f = { x: -3, z: -20, sky: 'night' }; break;
      case 'am10': this.flags.fireworks = true; this.fwTimer = 0.6; f = { x: 0, z: 12, sky: 'night' }; break;
    }
    if (animate && f && !f.sky && !['am1', 'am3', 'am7'].includes(id)) this.pulse(f.x, f.z, id.startsWith('ch') ? 5 : 7);
    return f;
  }

  setPointScale(v) {
    for (const o of [this.snow, this.smoke, this.puffs, this.sparks]) o.u.uScale.value = v;
  }

  update(dt, time, env) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const t = this.tweens[i];
      t.t += dt;
      if (t.t < 0) continue;
      const k = t.dur > 0 ? Math.min(1, t.t / t.dur) : 1;
      t.fn(k);
      if (k >= 1) { this.tweens.splice(i, 1); t.done && t.done(); }
    }
    const L = env.lightsOn, day = env.day;

    // fenêtres : elles s'allument par vagues au crépuscule
    [[0.05, 3.0], [0.3, 2.3], [0.55, 3.6]].forEach(([th, gain], i) => {
      const on = smoothstep(th, th + 0.3, L);
      this.winMats[i].color.setRGB(lerp(0.1 + 0.16 * day, 1.0 * gain, on), lerp(0.14 + 0.2 * day, 0.6 * gain, on), lerp(0.22 + 0.3 * day, 0.24 * gain, on));
    });
    this.bulbMat.color.setRGB(lerp(0.75, 5.5, L), lerp(0.75, 4.0, L), lerp(0.7, 2.0, L));
    this.coolBulbMat.color.setRGB(lerp(0.7, 5.0, L), lerp(0.7, 4.6, L), lerp(0.7, 3.6, L));
    this.headMat.color.setRGB(lerp(0.9, 6, L), lerp(0.9, 5.4, L), lerp(0.8, 3.8, L));
    this.starMat.color.setRGB(lerp(1.0, 7, L), lerp(0.8, 5.2, L), lerp(0.25, 1.6, L));
    this.garlandMat.color.setScalar(lerp(0.5, 1.7 + 0.25 * Math.sin(time * 2.2), L));
    const blink = Math.sin(time * 2.6) > 0.55 ? 1 : 0.08;
    this.beaconMat.color.setRGB(lerp(0.6, 9 * blink, L), lerp(0.1, 0.5 * blink, L), lerp(0.1, 0.3 * blink, L));
    const fl = 0.8 + 0.2 * Math.sin(time * 11) * Math.sin(time * 7.3);
    this.flameMat.color.setRGB(4.5 * fl, 1.9 * fl, 0.5);
    this.pools.mat.color.setScalar(0.5 * L);
    this.pisteGlowMat.color.setRGB(0.42 * L, 0.36 * L, 0.27 * L);
    this.beamMat.color.setRGB(0.9 * L, 0.8 * L, 0.55 * L);
    for (const l of Object.values(this.pl)) l.intensity = l.userData.w * L * 26;

    if (this.flame) {
      this.flame.scale.set(1 + 0.12 * Math.sin(time * 13), 0.9 + 0.3 * fl, 1 + 0.12 * Math.cos(time * 9));
      this.pools.setScale(this.firePool, 0.9 + 0.12 * fl);
    }
    if (this.skaters) for (const p of this.skaters.children) p.rotation.y += dt * p.userData.speed;
    if (this.wfU) { this.wfU.uTime.value = time; this.wfU.uLight.value = lerp(0.42, 1.0, day); }

    // navette : aller-retour sur la route construite
    if (this.bus) {
      const b = this.bus, lo = this.flags.col ? 0.02 : U_A + 0.01, hi = 0.985;
      if (b.wait > 0) b.wait -= dt;
      else {
        b.u += (b.dir * 2.4 * dt) / road.length;
        if (b.u > hi) { b.u = hi; b.dir = -1; b.wait = 2.5; } else if (b.u < lo) { b.u = lo; b.dir = 1; b.wait = 2.5; }
      }
      road.at(b.u, _o);
      b.g.position.set(_o.x, groundY(_o.x, _o.z) + 0.08, _o.z);
      b.g.rotation.y = Math.atan2(_o.tx * b.dir, _o.tz * b.dir);
    }

    this.updateLifts(time);
    this.updateSkiers(dt);

    // feux d'artifice, la nuit
    if (this.flags.fireworks && env.night > 0.6) {
      this.fwTimer -= dt;
      if (this.fwTimer <= 0) {
        this.fwTimer = 1.6 + Math.random() * 4.5;
        const c = FW_COLS[Math.floor(Math.random() * FW_COLS.length)];
        const x = PEAK.x + (Math.random() - 0.5) * 30, y = 30 + Math.random() * 9, z = PEAK.z + (Math.random() - 0.3) * 22;
        this.sparks.emit(x, y, z, 80, { sphere: true, speed: 8.5, color: c, size: 0.6, life: 1.7, gravity: -2.2, drag: 1.5 });
        this.sparks.emit(x, y, z, 24, { sphere: true, speed: 3.5, color: [4, 4, 3.4], size: 0.45, life: 1.0, gravity: -2, drag: 1.5 });
        this.onFirework && this.onFirework();
      }
    }
    this.puffs.update(dt); this.sparks.update(dt);

    this.snow.u.uTime.value = time; this.smoke.u.uTime.value = time;
    this.snow.u.uColor.value.setRGB(lerp(0.5, 1, day), lerp(0.56, 1, day), lerp(0.85, 1, day));
    this.smoke.u.uColor.value.setRGB(lerp(0.3, 0.95, day) + 0.15 * L, lerp(0.33, 0.95, day) + 0.08 * L, lerp(0.5, 1.0, day));
  }
}

const SKI_COLS = ['#ff5a5f', '#ffd23f', '#3fa7ff', '#7be0a0', '#ff8fd0', '#ffffff', '#ff9a3c', '#9b8cff'];
const GARLAND_COLS = [new THREE.Color(3.2, 2.2, 0.9), new THREE.Color(3.4, 0.5, 0.4), new THREE.Color(0.5, 3.0, 0.9), new THREE.Color(0.5, 1.3, 3.6), new THREE.Color(3.2, 2.6, 1.6)];
const FW_COLS = [[5, 1.2, 1.0], [1.2, 4.5, 1.6], [1.2, 2.2, 5.5], [5, 3.6, 1.0], [4.2, 1.2, 4.8], [1.0, 4.6, 4.6]];
