// Effets : neige qui tombe, fumée, gerbes de particules, halos lumineux au sol.
import * as THREE from 'three';
import { mulberry32, radialTexture } from './util.js';

const SOFT_FS = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(uColor, smoothstep(0.5, 0.12, d) * vAlpha);
}`;

// Neige : tout est animé dans le vertex shader, coût CPU nul.
export class Snowfall {
  constructor(count = 750) {
    const rng = mulberry32(21), pos = [], rnd = [];
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 40;
      pos.push(Math.cos(a) * r, rng() * 44, Math.sin(a) * r);
      rnd.push(rng(), rng(), rng());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 3));
    this.u = { uTime: { value: 0 }, uScale: { value: 800 }, uColor: { value: new THREE.Color(1, 1, 1) } };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec3 aRand;
        uniform float uTime, uScale;
        varying float vAlpha;
        void main() {
          float t = uTime * (0.55 + aRand.x * 0.6);
          vec3 p = position;
          p.y = mod(position.y - t * 1.5, 44.0) - 6.0;
          p.x += sin(t * 0.7 + aRand.y * 6.28) * 0.9;
          p.z += cos(t * 0.5 + aRand.z * 6.28) * 0.9;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.5, (0.13 + 0.13 * aRand.x) * uScale / -mv.z);
          vAlpha = (0.55 + 0.4 * aRand.y) * smoothstep(-6.0, -2.0, p.y) * smoothstep(38.0, 32.0, p.y);
        }`,
      fragmentShader: SOFT_FS,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }
}

// Fumée des cheminées : quelques bouffées par source, animées au shader.
export class Smoke {
  constructor(maxSources = 24, per = 7) {
    this.per = per; this.n = 0; this.max = maxSources;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.Float32BufferAttribute(new Float32Array(maxSources * per * 3), 3);
    this.seed = new THREE.Float32BufferAttribute(new Float32Array(maxSources * per * 2), 2);
    g.setAttribute('position', this.pos);
    g.setAttribute('aSeed', this.seed);
    g.setDrawRange(0, 0);
    this.u = { uTime: { value: 0 }, uScale: { value: 800 }, uColor: { value: new THREE.Color(1, 1, 1) } };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 aSeed;
        uniform float uTime, uScale;
        varying float vAlpha;
        void main() {
          float age = fract(uTime * 0.11 + aSeed.x);
          vec3 p = position;
          p.y += age * 3.4 * aSeed.y;
          p.x += sin(aSeed.x * 40.0 + age * 3.0) * 0.22 * age + age * age * 1.1;
          p.z += cos(aSeed.x * 23.0 + age * 2.0) * 0.2 * age + age * age * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = mix(0.35, 1.5, age) * aSeed.y * uScale / -mv.z;
          vAlpha = smoothstep(0.0, 0.12, age) * (1.0 - age) * 0.5;
        }`,
      fragmentShader: SOFT_FS,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }
  add(x, y, z, size = 1) {
    if (this.n >= this.max) return;
    for (let i = 0; i < this.per; i++) {
      const k = this.n * this.per + i;
      this.pos.setXYZ(k, x, y, z);
      this.seed.setXY(k, (i + Math.random() * 0.6) / this.per, size);
    }
    this.n++;
    this.pos.needsUpdate = true; this.seed.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, this.n * this.per);
  }
}

// Particules simulées sur CPU (gerbes de neige à la construction, feux d'artifice).
export class Bursts {
  constructor(cap = 320, additive = false) {
    this.cap = cap; this.head = 0;
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.grav = new Float32Array(cap); this.drag = new Float32Array(cap);
    this.rgb = new Float32Array(cap * 3);
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.Float32BufferAttribute(new Float32Array(cap * 3), 3);
    this.col = new THREE.Float32BufferAttribute(new Float32Array(cap * 4), 4);
    this.size = new THREE.Float32BufferAttribute(new Float32Array(cap), 1);
    for (const a of [this.pos, this.col, this.size]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos); g.setAttribute('aColor', this.col); g.setAttribute('aSize', this.size);
    this.u = { uScale: { value: 800 } };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aColor; attribute float aSize;
        uniform float uScale;
        varying vec4 vColor;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aColor.a > 0.0 ? aSize * uScale / -mv.z : 0.0;
        }`,
      fragmentShader: /* glsl */ `
        varying vec4 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d) * vColor.a;
          gl_FragColor = vec4(vColor.rgb${additive ? ' * a, 1.0' : ', a'});
        }`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.active = 0;
  }
  emit(x, y, z, n, o = {}) {
    const { speed = 2, up = 1.5, color = [1, 1, 1], size = 0.35, life = 1, gravity = -4, drag = 1.5, sphere = false } = o;
    for (let i = 0; i < n; i++) {
      const k = this.head; this.head = (this.head + 1) % this.cap;
      let vx, vy, vz;
      if (sphere) {
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), s = speed * (0.75 + Math.random() * 0.25);
        vx = r * Math.cos(th) * s; vy = u * s; vz = r * Math.sin(th) * s;
      } else {
        const th = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
        vx = Math.cos(th) * s; vz = Math.sin(th) * s; vy = up * (0.5 + Math.random());
      }
      this.vel.set([vx, vy, vz], k * 3);
      this.pos.setXYZ(k, x, y, z);
      this.rgb.set(color, k * 3);
      this.size.setX(k, size * (0.6 + Math.random() * 0.8));
      this.max[k] = this.life[k] = life * (0.7 + Math.random() * 0.5);
      this.grav[k] = gravity; this.drag[k] = drag;
    }
    this.size.needsUpdate = true;
    this.active = 1;
  }
  update(dt) {
    if (!this.active) return;
    let alive = 0;
    const p = this.pos.array, c = this.col.array;
    for (let k = 0; k < this.cap; k++) {
      if (this.life[k] <= 0) { c[k * 4 + 3] = 0; continue; }
      this.life[k] -= dt; alive++;
      const d = Math.max(0, 1 - this.drag[k] * dt);
      this.vel[k * 3] *= d; this.vel[k * 3 + 2] *= d;
      this.vel[k * 3 + 1] = this.vel[k * 3 + 1] * d + this.grav[k] * dt;
      p[k * 3] += this.vel[k * 3] * dt; p[k * 3 + 1] += this.vel[k * 3 + 1] * dt; p[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      const f = Math.max(0, this.life[k] / this.max[k]);
      c[k * 4] = this.rgb[k * 3]; c[k * 4 + 1] = this.rgb[k * 3 + 1]; c[k * 4 + 2] = this.rgb[k * 3 + 2];
      c[k * 4 + 3] = Math.min(1, f * 1.6);
    }
    this.pos.needsUpdate = true; this.col.needsUpdate = true;
    this.active = alive > 0 ? 1 : 0;
  }
}

// Flaques de lumière chaude posées sur la neige (fausses lampes, très bon marché).
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0), _col = new THREE.Color();
export class GlowPools {
  constructor(cap = 300) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({
      map: radialTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
    });
    this.mesh = new THREE.InstancedMesh(g, this.mat, cap);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    this.items = [];
  }
  add(x, y, z, radius, color, normal) {
    const i = this.mesh.count++;
    this.items.push({ x, y, z, radius, normal: normal ? normal.clone() : _up.clone() });
    this.setScale(i, 1);
    this.mesh.setColorAt(i, _col.set(color));
    this.mesh.instanceColor.needsUpdate = true;
    return i;
  }
  setScale(i, k) {
    const it = this.items[i];
    _q.setFromUnitVectors(_up, it.normal);
    _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.radius * 2 * k, 1, it.radius * 2 * k));
    this.mesh.setMatrixAt(i, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
