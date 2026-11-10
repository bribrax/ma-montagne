// Ciel, soleil/lune, étoiles, montagnes lointaines, aurores et éclairage du cycle jour/nuit.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, mulberry32, vnoise, radialTexture } from './util.js';
import { DAY_LENGTH_S } from './config.js';

// Images clés indexées par l'élévation du soleil e = sin(angle) : -1 = minuit, 0 = horizon, 1 = midi.
//        e      zénith     milieu     horizon    abîme      lumière   int.  ciel(hémi) sol(hémi)  int.  lueur
const KEYS = [
  [-1.0, '#0a1034', '#111a4e', '#1d2868', '#0d1238', '#8ea6ff', 1.0, '#3c4c9c', '#343a7c', 1.6, 0.0],
  [-0.3, '#0c133c', '#141f58', '#243074', '#10163f', '#8ea6ff', 1.0, '#3c4c9c', '#343a7c', 1.6, 0.0],
  [-0.14, '#141c58', '#35307c', '#9a5078', '#1c2060', '#8ea6ff', 0.5, '#4a4aa0', '#3f3a7c', 1.6, 0.5],
  [-0.04, '#1e2c78', '#7a4c96', '#ff8a4a', '#2a2c78', '#ff7a3a', 0.0, '#5c58a8', '#5a4880', 1.7, 1.0],
  [0.06, '#34539f', '#b9809f', '#ffb070', '#4c5596', '#ff9a55', 1.9, '#7a7ac0', '#6c5c88', 1.7, 1.0],
  [0.28, '#3b7fd0', '#86b8e8', '#d6eaf8', '#86a8d2', '#ffe0b0', 3.0, '#9cc0f0', '#7a7a96', 1.7, 0.35],
  [1.0, '#2f7ad8', '#78b6ee', '#cfe6f8', '#96bbe0', '#fff3e0', 3.3, '#a8ccf8', '#8a8aa2', 1.8, 0.15],
].map((k) => k.map((v) => (typeof v === 'string' ? new THREE.Color(v) : v)));

const SKY_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FS = /* glsl */ `
uniform vec3 uZenith, uMid, uHorizon, uAbyss, uSunDir, uGlowCol, uDisc, uMoon;
uniform float uGlow;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y + 0.2; // l'île flotte haut : l'horizon apparaît plus bas que le regard
  // clamp indispensable : pow() d'une base négative donne NaN, que le bloom étale ensuite sur tout l'écran
  vec2 dh = d.xz / max(length(d.xz), 1e-4), sh = uSunDir.xz / max(length(uSunDir.xz), 1e-4);
  float az = clamp(dot(dh, sh) * 0.5 + 0.5, 0.0, 1.0);
  vec3 hor = mix(mix(uHorizon, uMid, 0.65), uHorizon, az * sqrt(az));
  vec3 col;
  if (h > 0.0) {
    col = mix(hor, uMid, smoothstep(0.0, 0.2, h));
    col = mix(col, uZenith, smoothstep(0.1, 0.75, h));
  } else {
    col = mix(hor, uAbyss, smoothstep(0.0, 0.32, -h));
  }
  float sd = max(dot(d, uSunDir), 0.0);
  col += uGlowCol * uGlow * (pow(sd, 5.0) * 0.22 + pow(sd, 48.0) * 0.5);
  col += uDisc * smoothstep(0.9990, 0.9994, sd);
  float md = dot(d, -uSunDir);
  col += uMoon * (smoothstep(0.99955, 0.9997, md) + pow(max(md, 0.0), 300.0) * 0.12);
  gl_FragColor = vec4(clamp(col, 0.0, 60.0), 1.0);
}`;

const STAR_VS = /* glsl */ `
attribute float aSeed;
uniform float uTime, uSize;
varying float vTw;
void main() {
  vTw = 0.6 + 0.4 * sin(uTime * (0.6 + aSeed * 2.2) + aSeed * 60.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (0.7 + aSeed * aSeed * 2.2);
}`;
const STAR_FS = /* glsl */ `
uniform float uAlpha;
varying float vTw;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * uAlpha * vTw;
  gl_FragColor = vec4(vec3(0.9, 0.93, 1.0) * a * 1.6, 1.0);
}`;

const RANGE_VS = /* glsl */ `
varying float vY;
void main() {
  vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const RANGE_FS = /* glsl */ `
uniform vec3 uBody, uHaze, uSnow;
uniform float uTop;
varying float vY;
void main() {
  vec3 col = mix(uHaze, uBody, smoothstep(-12.0, uTop * 0.45, vY));
  col = mix(col, uSnow, smoothstep(uTop * 0.5, uTop * 0.72, vY) * 0.75);
  gl_FragColor = vec4(col, smoothstep(-34.0, -6.0, vY));
}`;

const AURORA_VS = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  float w = sin(uv.x * 9.0 + uTime * 0.25) * 9.0 + sin(uv.x * 23.0 - uTime * 0.4) * 4.0;
  p.xz *= 1.0 + w / 260.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const AURORA_FS = /* glsl */ `
uniform float uTime, uI;
varying vec2 vUv;
void main() {
  float n = sin(vUv.x * 16.0 + uTime * 0.3 + sin(vUv.x * 6.0 - uTime * 0.17) * 2.2) * 0.5 + 0.5;
  float rays = pow(clamp(n, 0.0, 1.0), 2.5) * (0.65 + 0.35 * sin(vUv.x * 120.0 + uTime * 0.9));
  float v = smoothstep(0.0, 0.12, vUv.y) * pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.8);
  float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  vec3 col = mix(vec3(0.15, 1.0, 0.55), vec3(0.55, 0.25, 1.0), smoothstep(0.1, 0.8, vUv.y));
  gl_FragColor = vec4(col * rays * v * ends * uI * 1.3, 1.0);
}`;

function makeRange(radius, seed, minH, maxH, segs) {
  const rng = mulberry32(seed);
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const th = (i / segs) * Math.PI * 2;
    const k = i % segs;
    const n = vnoise(k * 0.31 + seed, seed * 1.7);
    let h = minH + (maxH - minH) * Math.pow(n, 1.6) + (rng() - 0.5) * 9;
    if (k % 2) h *= 0.72 + rng() * 0.2;
    const x = Math.cos(th) * radius, z = Math.sin(th) * radius;
    pos.push(x, -36, z, x, i === segs ? pos[1 + 3] : h, z);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const _ember = new THREE.Color(6, 1.6, 0.5);

export class Environment {
  constructor(scene) {
    this.tod = 0.735;        // 0 = minuit, 0.25 = lever, 0.5 = midi, 0.75 = coucher
    this.mode = 'auto';
    this.e = 0; this.night = 0; this.lightsOn = 0; this.day = 1;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.aurora = 0; this.auroraTarget = 0;

    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.mapSize.set(2048, 2048);
    sh.camera.left = -38; sh.camera.right = 38; sh.camera.top = 38; sh.camera.bottom = -38;
    sh.camera.near = 20; sh.camera.far = 190;
    sh.bias = -0.0004; sh.normalBias = 0.09;
    this.sun.target.position.set(0, 4, 0);
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1);
    scene.add(this.hemi);

    this.skyU = {
      uZenith: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uAbyss: { value: new THREE.Color() }, uSunDir: { value: this.sunDir }, uGlowCol: { value: new THREE.Color() },
      uDisc: { value: new THREE.Color() }, uMoon: { value: new THREE.Color() }, uGlow: { value: 0 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 20),
      new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false })
    );
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    scene.add(this.sky);

    // étoiles
    const rng = mulberry32(5), sp = [], ss = [];
    for (let i = 0; i < 1100; i++) {
      const u = rng() * 2 - 1, th = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      sp.push(r * Math.cos(th) * 850, u * 850, r * Math.sin(th) * 850);
      ss.push(rng());
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ss, 1));
    this.starU = { uTime: { value: 0 }, uSize: { value: 3 }, uAlpha: { value: 0 } };
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: this.starU, vertexShader: STAR_VS, fragmentShader: STAR_FS,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false,
    }));
    this.stars.renderOrder = -9; this.stars.frustumCulled = false;
    scene.add(this.stars);

    // chaînes lointaines
    this.ranges = [];
    for (const [radius, seed, minH, maxH, segs, mix] of [[520, 3, 14, 95, 70, 0.2], [400, 8, 8, 62, 84, 0.5]]) {
      const u = { uBody: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uSnow: { value: new THREE.Color() }, uTop: { value: maxH } };
      const m = new THREE.Mesh(makeRange(radius, seed, minH, maxH, segs), new THREE.ShaderMaterial({
        uniforms: u, vertexShader: RANGE_VS, fragmentShader: RANGE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }));
      m.renderOrder = -8 + this.ranges.length; m.frustumCulled = false;
      scene.add(m);
      this.ranges.push({ u, mix, mesh: m, y0: this.ranges.length ? -92 : -120 });
    }

    // nuages effilés
    this.cloudMat = new THREE.MeshBasicMaterial({ map: radialTexture(64, [[0, 0.9], [0.5, 0.35], [1, 0]]), transparent: true, depthWrite: false, opacity: 0.6 });
    const cg = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 9; i++) {
      const th = rng() * Math.PI * 2, r = 460, c = new THREE.Mesh(cg, this.cloudMat);
      c.position.set(Math.cos(th) * r, -80 + rng() * 170, Math.sin(th) * r);
      c.scale.set(150 + rng() * 170, 9 + rng() * 9, 1);
      c.lookAt(0, c.position.y, 0);
      c.renderOrder = -6;
      scene.add(c);
    }

    // aurores boréales (achat tardif)
    const ag = new THREE.CylinderGeometry(600, 600, 300, 96, 1, true, Math.PI * 0.55, Math.PI * 0.9);
    this.auroraU = { uTime: { value: 0 }, uI: { value: 0 } };
    this.auroraMesh = new THREE.Mesh(ag, new THREE.ShaderMaterial({
      uniforms: this.auroraU, vertexShader: AURORA_VS, fragmentShader: AURORA_FS,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.auroraMesh.position.y = 260; this.auroraMesh.renderOrder = -7; this.auroraMesh.frustumCulled = false;
    this.auroraMesh.visible = false;
    scene.add(this.auroraMesh);

    this._c = { zen: new THREE.Color(), mid: new THREE.Color(), hor: new THREE.Color(), aby: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color() };
    this.tmp = new THREE.Color();
  }

  setMode(mode) { this.mode = mode; }

  update(dt, time, camera) {
    // avance du temps
    if (this.mode === 'auto') {
      const speed = this.e > 0.3 ? 1.5 : Math.abs(this.e) < 0.25 ? 0.6 : 1.0;
      this.tod = (this.tod + (dt / DAY_LENGTH_S) * speed) % 1;
    } else {
      const target = { day: 0.52, dusk: 0.768, night: 0.97 }[this.mode];
      const diff = (((target - this.tod) % 1) + 1) % 1;
      if (diff > 0.0015) this.tod = (this.tod + Math.min(diff, dt * 0.22)) % 1;
    }
    const phi = Math.PI * 2 * (this.tod - 0.25);
    const e = Math.sin(phi);
    this.e = e;
    this.sunDir.set(Math.cos(phi), e * 0.82, e * 0.57 + 0.12).normalize();
    this.night = smoothstep(0.0, -0.2, e);
    this.lightsOn = smoothstep(0.1, -0.06, e);
    this.day = smoothstep(-0.12, 0.22, e);

    // interpolation des images clés
    let i = 0;
    while (i < KEYS.length - 2 && e > KEYS[i + 1][0]) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const k = clamp((e - A[0]) / (B[0] - A[0]), 0, 1);
    const c = this._c;
    c.zen.copy(A[1]).lerp(B[1], k); c.mid.copy(A[2]).lerp(B[2], k); c.hor.copy(A[3]).lerp(B[3], k);
    c.aby.copy(A[4]).lerp(B[4], k); c.sun.copy(A[5]).lerp(B[5], k);
    c.hs.copy(A[7]).lerp(B[7], k); c.hg.copy(A[8]).lerp(B[8], k);
    const sunI = lerp(A[6], B[6], k), hemiI = lerp(A[9], B[9], k), glow = lerp(A[10], B[10], k);

    const U = this.skyU;
    U.uZenith.value.copy(c.zen); U.uMid.value.copy(c.mid); U.uHorizon.value.copy(c.hor); U.uAbyss.value.copy(c.aby);
    U.uGlowCol.value.copy(c.hor); U.uGlow.value = glow;
    // le disque rougit puis s'efface en passant sous l'horizon abaissé
    U.uDisc.value.copy(c.sun).multiplyScalar(5).lerp(_ember, smoothstep(0.02, -0.12, e) * 0.6).multiplyScalar(smoothstep(-0.27, -0.2, e));
    U.uMoon.value.setRGB(0.9, 0.93, 1.0).multiplyScalar(this.night * 2.4);
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.starU.uTime.value = time;
    this.starU.uAlpha.value = smoothstep(0.02, -0.2, e);

    // un seul projecteur : soleil le jour, lune la nuit (l'intensité passe par 0 au changement)
    const L = this.sun;
    if (e > -0.04) L.position.copy(this.sunDir); else L.position.copy(this.sunDir).multiplyScalar(-1);
    if (L.position.y < 0.16) { L.position.y = 0.16; L.position.normalize(); }
    L.position.multiplyScalar(100).add(L.target.position);
    L.color.copy(c.sun); L.intensity = sunI;
    this.hemi.color.copy(c.hs); this.hemi.groundColor.copy(c.hg); this.hemi.intensity = hemiI;

    for (const r of this.ranges) {
      r.mesh.position.y = r.y0 + (camera.position.y - 36) * 0.8;
      r.u.uHaze.value.copy(c.hor).lerp(c.aby, 0.35);
      r.u.uBody.value.copy(c.mid).lerp(c.zen, r.mix).multiplyScalar(0.8);
      r.u.uSnow.value.copy(c.hs).lerp(c.hor, 0.35).multiplyScalar(lerp(0.75, 1.05, this.day));
    }
    this.cloudMat.color.copy(c.hor).lerp(c.mid, 0.45).multiplyScalar(lerp(0.8, 1.0, this.day));
    this.cloudMat.opacity = lerp(0.3, 0.6, 1 - this.night);

    this.aurora += (this.auroraTarget * this.night - this.aurora) * Math.min(1, dt * 0.8);
    this.auroraMesh.visible = this.aurora > 0.01;
    this.auroraU.uTime.value = time; this.auroraU.uI.value = this.aurora;
  }
}
