// Relief de l'île : fonction de hauteur, maillage low-poly, socle rocheux, rubans posés au sol.
import * as THREE from 'three';
import { fbm, vnoise, smoothstep, clamp, lerp, mulberry32, hash2 } from './util.js';

export const PEAK = { x: -3, z: -6 };
const H = 27;                 // hauteur brute du cône avant aplanissement du sommet
const D2R = Math.PI / 180;
const SKI_A0 = 72 * D2R;      // direction du versant skiable (vu depuis le sommet)
const SKI_HW = 50 * D2R;

export function polar(aDeg, d) {
  const a = aDeg * D2R;
  return [PEAK.x + Math.cos(a) * d, PEAK.z + Math.sin(a) * d];
}
export function islandR(th) {
  return 31 + 1.2 * Math.sin(3 * th + 0.7) + 0.8 * Math.sin(5 * th + 2.1);
}
function mountR(a) {
  return 22.5 + 1.2 * Math.sin(2 * a + 1.0) + 0.8 * Math.sin(3 * a - 0.5);
}
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
// 1 sur le versant lisse réservé aux pistes, 0 sur les faces sauvages.
export function skiMask(x, z) {
  const a = Math.atan2(z - PEAK.z, x - PEAK.x);
  return 1 - smoothstep(SKI_HW, SKI_HW + 14 * D2R, Math.abs(angDiff(a, SKI_A0)));
}

function rawHeight(x, z) {
  const dx = x - PEAK.x, dz = z - PEAK.z;
  const d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
  const t = d / mountR(a);
  const shelf = 0.5 + 0.9 * fbm(x * 0.07 + 3.1, z * 0.07 + 7.7, 3);
  if (t >= 1) return shelf;
  const ski = 1 - smoothstep(SKI_HW, SKI_HW + 14 * D2R, Math.abs(angDiff(a, SKI_A0)));
  const wild = 1 - ski;
  const env = Math.sin(Math.PI * t);
  let m = H * Math.pow(1 - t, 1.25);
  // arêtes
  const rn = 1 - Math.abs(fbm(x * 0.085 + 11, z * 0.085 + 5, 3) * 2 - 1);
  m += (rn - 0.45) * 7 * env * (0.22 + 0.78 * wild);
  // falaises en gradins sur les faces sauvages
  const mask = smoothstep(0.4, 0.6, vnoise(x * 0.06 + 20, z * 0.06 + 31)) * wild;
  const stepH = 4.2, k = m / stepH, f = Math.floor(k);
  const terr = (f + smoothstep(0.25, 0.75, k - f)) * stepH;
  m = lerp(m, terr, mask * 0.85 * smoothstep(0, 0.15, t));
  m += (fbm(x * 0.3, z * 0.3, 2) - 0.5) * 0.9 * env * (0.3 + 0.7 * wild);
  return shelf + Math.max(m, -0.3);
}

// Replats : zones aplanies là où se posent bâtiments, routes et gares.
const pads = [];
export function addPad(x, z, r, y) {
  pads.push({ x, z, r, y: y ?? rawHeight(x, z) });
}
export function rawAt(x, z) { return rawHeight(x, z); }

export function height(x, z) {
  let h = rawHeight(x, z);
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    const ddx = x - p.x, ddz = z - p.z, lim = p.r * 1.7;
    if (ddx > lim || ddx < -lim || ddz > lim || ddz < -lim) continue;
    const d = Math.hypot(ddx, ddz);
    if (d < lim) h = lerp(h, p.y, smoothstep(lim, p.r, d));
  }
  const r = Math.hypot(x, z), R = islandR(Math.atan2(z, x));
  return lerp(h, 0, smoothstep(R - 2.6, R - 0.2, r));
}

// ---- Maillage ----
const N = 118, S = 34, CELL = (2 * S) / N, N1 = N + 1;
let VX, VY, VZ, CL;

const SNOW = new THREE.Color('#eef2ff');
const ROCK_A = new THREE.Color('#57526f');
const ROCK_B = new THREE.Color('#8a84a2');
const _col = new THREE.Color();

export function buildTerrain() {
  VX = new Float32Array(N1 * N1); VY = new Float32Array(N1 * N1); VZ = new Float32Array(N1 * N1);
  CL = new Uint8Array(N1 * N1);
  const rng = mulberry32(11);
  for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
    let x = -S + i * CELL + (rng() - 0.5) * CELL * 0.6;
    let z = -S + j * CELL + (rng() - 0.5) * CELL * 0.6;
    const r = Math.hypot(x, z), R = islandR(Math.atan2(z, x));
    const k = j * N1 + i;
    if (r > R) { x *= R / r; z *= R / r; CL[k] = 1; }
    VX[k] = x; VZ[k] = z; VY[k] = height(x, z);
  }
  const pos = [], col = [];
  const tri = (a, b, c) => {
    if (CL[a] && CL[b] && CL[c]) return;
    const ax = VX[a], ay = VY[a], az = VZ[a];
    const ux = VX[b] - ax, uy = VY[b] - ay, uz = VZ[b] - az;
    const vx = VX[c] - ax, vy = VY[c] - ay, vz = VZ[c] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const cx = (ax + VX[b] + VX[c]) / 3, cz = (az + VZ[b] + VZ[c]) / 3;
    const n1 = fbm(cx * 0.35 + 40, cz * 0.35 + 17, 2), n2 = vnoise(cx * 1.3, cz * 1.3);
    let rock = smoothstep(0.5, 0.38, ny / nl + (n1 - 0.5) * 0.14);
    rock *= 1 - 0.92 * skiMask(cx, cz);
    _col.copy(ROCK_A).lerp(ROCK_B, n1 * 0.7 + n2 * 0.3);
    const sv = 0.9 + 0.1 * n2;
    _col.r = lerp(SNOW.r * sv, _col.r, rock);
    _col.g = lerp(SNOW.g * sv, _col.g, rock);
    _col.b = lerp(SNOW.b * sv, _col.b, rock);
    pos.push(ax, ay, az, VX[b], VY[b], VZ[b], VX[c], VY[c], VZ[c]);
    for (let q = 0; q < 3; q++) col.push(_col.r, _col.g, _col.b);
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * N1 + i, b = a + 1, c = a + N1, d = c + 1;
    if ((i + j) & 1) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function bary(px, pz, a, b, c) {
  const x1 = VX[a], z1 = VZ[a], x2 = VX[b], z2 = VZ[b], x3 = VX[c], z3 = VZ[c];
  const den = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
  if (Math.abs(den) < 1e-9) return null;
  const w1 = ((z2 - z3) * (px - x3) + (x3 - x2) * (pz - z3)) / den;
  const w2 = ((z3 - z1) * (px - x3) + (x1 - x3) * (pz - z3)) / den;
  const w3 = 1 - w1 - w2;
  if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) return null;
  return w1 * VY[a] + w2 * VY[b] + w3 * VY[c];
}

// Hauteur exacte du maillage (pas de la fonction lisse) : les objets posent pile sur les facettes.
export function groundY(x, z) {
  const i0 = Math.floor((x + S) / CELL), j0 = Math.floor((z + S) / CELL);
  for (let r = 0; r < 9; r++) {
    const i = i0 + [0, -1, 1, 0, 0, -1, 1, -1, 1][r], j = j0 + [0, 0, 0, -1, 1, -1, -1, 1, 1][r];
    if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const a = j * N1 + i, b = a + 1, c = a + N1, d = c + 1;
    let y;
    if ((i + j) & 1) { y = bary(x, z, a, c, b); if (y === null) y = bary(x, z, b, c, d); }
    else { y = bary(x, z, a, c, d); if (y === null) y = bary(x, z, a, d, b); }
    if (y !== null) return y;
  }
  return height(x, z);
}

export function groundNormal(x, z, out = new THREE.Vector3()) {
  const e = 0.5;
  return out.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize();
}

// Socle : lèvre de neige en surplomb puis roche à facettes qui se referme en pointe.
export function buildBase() {
  const SEG = 84;
  const rings = [
    [1, -3.2, -0.06, 0, 0], [1, 0.45, -0.06, 0, 0], [1, 0.5, -0.8, 0.08, 0], [1, -0.15, -1.15, 0.2, 1],
    [0.97, -0.7, -3.6, 0.9, 1], [0.9, -1.6, -6.8, 1.4, 1], [0.76, -2, -10.2, 1.7, 1],
    [0.56, -2, -13.6, 1.6, 1], [0.32, -1.5, -16.6, 1.3, 1], [0.1, -0.5, -18.8, 0.6, 1],
  ];
  const P = rings.map((rg, ri) => {
    const row = [];
    for (let s = 0; s < SEG; s++) {
      const th = (s / SEG) * Math.PI * 2;
      const r = islandR(th) * rg[0] + rg[1] + (hash2(s * 7 + 3, ri * 13 + 1) - 0.5) * 2 * rg[3];
      const y = rg[2] + (hash2(s * 5 + 9, ri * 11 + 4) - 0.5) * rg[3] * 1.3;
      row.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    return row;
  });
  const snow = new THREE.Color('#e9eefc'), under = new THREE.Color('#b9bfdc');
  const r1 = new THREE.Color('#5d5680'), r2 = new THREE.Color('#9089ac'), deep = new THREE.Color('#4a4468');
  const pos = [], col = [];
  const push = (a, b, c, color) => { pos.push(...a, ...b, ...c); for (let q = 0; q < 3; q++) col.push(color.r, color.g, color.b); };
  for (let ri = 0; ri < rings.length - 1; ri++) for (let s = 0; s < SEG; s++) {
    const s2 = (s + 1) % SEG;
    const A = P[ri][s], B = P[ri][s2], C = P[ri + 1][s], D = P[ri + 1][s2];
    for (let half = 0; half < 2; half++) {
      if (ri < 2) _col.copy(snow);
      else if (ri === 2) _col.copy(under);
      else {
        const v = hash2(s * 3 + half, ri * 17 + 5);
        _col.copy(r1).lerp(r2, v).lerp(deep, clamp((ri - 4) / 6, 0, 0.6));
      }
      if (half === 0) push(A, B, C, _col); else push(B, D, C, _col);
    }
  }
  const last = P[rings.length - 1], apex = [0, -19.8, 0];
  for (let s = 0; s < SEG; s++) push(last[s], last[(s + 1) % SEG], apex, deep);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// Ruban épousant le terrain (routes, pistes). Les triangles sont rangés le long du chemin :
// on peut donc le « dérouler » en animant drawRange.
export function ribbon(path, u0, u1, width, cols, yOff, step = 0.4) {
  const len = Math.abs(u1 - u0) * path.length;
  const rows = Math.max(2, Math.ceil(len / step));
  const pos = [], uv = [], idx = [], o = {};
  for (let r = 0; r <= rows; r++) {
    const u = u0 + ((u1 - u0) * r) / rows;
    path.at(u, o);
    const nx = -o.tz, nz = o.tx;
    for (let c = 0; c <= cols; c++) {
      const f = c / cols, off = (f - 0.5) * width;
      const x = o.x + nx * off, z = o.z + nz * off;
      pos.push(x, groundY(x, z) + yOff, z);
      uv.push(f, (u * path.length) / width);
    }
  }
  const flip = u1 < u0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * (cols + 1) + c, b = a + 1, c2 = a + cols + 1, d = c2 + 1;
    if (flip) idx.push(a, c2, b, b, c2, d); else idx.push(a, b, c2, b, d, c2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
