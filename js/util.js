// Petits outils partagés : maths, bruit, géométrie fusionnée, chemins.
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Générateur pseudo-aléatoire déterministe : la montagne est identique à chaque lancement.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, z * f);
    n += a; a *= 0.5; f *= 2.03;
  }
  return s / n;
}

export function mat(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(sx, sy, sz)
  );
}

// Prisme triangulaire (pignon) : faîtage le long de Z, base à y = 0.
export function roofGeo(w, h, d) {
  const x = w / 2, z = d / 2;
  const A1 = [-x, 0, -z], B1 = [x, 0, -z], C1 = [0, h, -z];
  const A2 = [-x, 0, z], B2 = [x, 0, z], C2 = [0, h, z];
  const v = [A1, A2, C2, A1, C2, C1, B1, C1, C2, B1, C2, B2, A2, B2, C2, B1, A1, C1].flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

const _v = new THREE.Vector3();
const _c = new THREE.Color();

// Assemble plusieurs primitives colorées en une seule géométrie à facettes (1 seul draw call).
export class GeoBuilder {
  constructor() { this.pos = []; this.col = []; }

  add(geo, color, matrix) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position;
    _c.set(color);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i);
      if (matrix) _v.applyMatrix4(matrix);
      this.pos.push(_v.x, _v.y, _v.z);
      this.col.push(_c.r, _c.g, _c.b);
    }
    return this;
  }
  // Boîte posée : (x, y, z) = centre de la face du bas.
  box(w, h, d, x, y, z, color, ry = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, mat(x, y + h / 2, z, 0, ry, 0));
  }
  // Boîte centrée, avec inclinaison possible.
  boxC(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, mat(x, y, z, rx, ry, rz));
  }
  cyl(rTop, rBot, h, seg, x, y, z, color) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, mat(x, y + h / 2, z));
  }
  cone(r, h, seg, x, y, z, color, ry = 0) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, mat(x, y + h / 2, z, 0, ry, 0));
  }
  // Barreau fin entre deux points.
  beam(a, b, r, color, seg = 4) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(new THREE.CylinderGeometry(r, r, len, seg, 1, true), color, m);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

// Courbe lissée dans le plan XZ, paramétrée par la longueur d'arc.
export class Path {
  constructor(pts, n = 160) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
    this.n = n;
    this.p = curve.getSpacedPoints(n);
    this.length = curve.getLength();
  }
  at(u, out = {}) {
    const f = clamp(u, 0, 1) * this.n;
    const i = Math.min(Math.floor(f), this.n - 1);
    const k = f - i;
    const a = this.p[i], b = this.p[i + 1];
    out.x = a.x + (b.x - a.x) * k;
    out.z = a.z + (b.z - a.z) * k;
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    out.tx = dx / l; out.tz = dz / l;
    return out;
  }
  dist(x, z) {
    let m = Infinity;
    for (const q of this.p) { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < m) m = d; }
    return Math.sqrt(m);
  }
  uOf(x, z) {
    let m = Infinity, bi = 0;
    this.p.forEach((q, i) => { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < m) { m = d; bi = i; } });
    return bi / this.n;
  }
}

// Texture de halo doux (dégradé radial) pour les lueurs additives.
export function radialTexture(size = 64, stops = [[0, 0.85], [0.22, 0.5], [0.55, 0.14], [1, 0]]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Bande à bords fondus (pour les pistes) : alpha 0 sur les bords, 1 au centre.
// `edge` (couleur CSS) ajoute un liseré coloré de chaque côté : la couleur de difficulté de la piste.
export function bandTexture(edge = null, rgb = '255,255,255') {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 4;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(edge ? 0.1 : 0.22, `rgba(${rgb},1)`);
  g.addColorStop(edge ? 0.9 : 0.78, `rgba(${rgb},1)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 4);
  if (edge) {
    ctx.fillStyle = edge; ctx.globalAlpha = 0.8;
    ctx.fillRect(7, 0, 4, 4); ctx.fillRect(53, 0, 4, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}
