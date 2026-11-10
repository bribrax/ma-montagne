// Fabriques de géométries low-poly : sapins, chalets, cabines, lampadaires…
import * as THREE from 'three';
import { GeoBuilder, mat, roofGeo, mulberry32 } from './util.js';

export const C = {
  snow: '#f1f5ff', stone: '#8f8ca0', stone2: '#77748a', roof: '#3b2a28', door: '#4a2c1e',
  wood: ['#8b5a3a', '#7b4c31', '#9a6843', '#6f4530'], woodDark: '#4d3022',
  metal: '#7d84a0', metalDark: '#2b2e44', red: '#d2483f',
};

export function pineGeo() {
  const b = new GeoBuilder();
  b.cyl(0.11, 0.16, 0.7, 5, 0, 0, 0, '#5b3d2a');
  const tiers = [[1.0, 1.35, 0.5, '#235a50'], [0.78, 1.15, 1.25, '#286656'], [0.54, 1.05, 1.95, '#2e725e']];
  tiers.forEach(([r, h, y, col], i) => {
    b.cone(r, h, 7, 0, y, 0, col, i * 0.5);
    b.cone(r * 0.6 + 0.04, h * 0.6 + 0.03, 7, 0, y + h * 0.4, 0, C.snow, i * 0.5);
  });
  return b.build();
}

export function rockGeo() {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const p = g.attributes.position, rng = mulberry32(3);
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
    if (!seen.has(key)) seen.set(key, 0.7 + rng() * 0.55);
    const s = seen.get(key);
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.7, p.getZ(i) * s);
  }
  const b = new GeoBuilder();
  b.add(g, '#77718f');
  // un peu de neige sur le dessus
  const geo = b.build();
  const col = geo.attributes.color, nrm = geo.attributes.normal, snow = new THREE.Color(C.snow);
  for (let i = 0; i < col.count; i++) if (nrm.getY(i) > 0.55) col.setXYZ(i, snow.r, snow.g, snow.b);
  return geo;
}

// Chalet : faîtage le long de X, façade principale vers +Z.
export function makeChalet(o = {}) {
  const w = o.w ?? 3.2, d = o.d ?? 2.6, h = o.h ?? 1.4, floors = o.floors ?? 1;
  const roofH = o.roofH ?? d * 0.42, wood = o.wood ?? C.wood[0], base = 0.4;
  const b = new GeoBuilder(), g = new GeoBuilder();
  b.box(w + 0.18, base + 0.5, d + 0.18, 0, -0.5, 0, C.stone);
  b.box(w, h, d, 0, base, 0, wood);
  const yE = base + h;
  b.add(roofGeo(d, roofH, w - 0.02), o.gable ?? C.woodDark, mat(0, yE, 0, 0, Math.PI / 2, 0));
  const al = Math.atan2(roofH, d / 2), sl = Math.hypot(roofH, d / 2) + 0.4;
  for (const s of [1, -1]) {
    const cy = yE + roofH - (Math.sin(al) * sl) / 2 + 0.06, cz = (s * Math.cos(al) * sl) / 2;
    b.boxC(w + 0.6, 0.1, sl, 0, cy, cz, C.roof, 0, s * al);
    b.boxC(w + 0.5, 0.24, sl - 0.08, 0, cy + Math.cos(al) * 0.17, cz + s * Math.sin(al) * 0.17, C.snow, 0, s * al);
  }
  b.boxC(w + 0.5, 0.22, 0.4, 0, yE + roofH + 0.2, 0, C.snow);
  let smoke = null;
  if (o.chimney !== false) {
    const cx = w * 0.26, cz = -d * 0.2, top = yE + roofH + 0.5;
    b.box(0.36, 1.1, 0.36, cx, top - 1.1, cz, C.stone2);
    b.box(0.44, 0.1, 0.44, cx, top, cz, C.snow);
    smoke = new THREE.Vector3(cx, top + 0.2, cz);
  }
  const ww = 0.44, wh = 0.48, fh = h / floors, n = Math.max(2, Math.round(w / 1.15));
  const doorSlot = o.doorSlot ?? Math.floor(n / 2);
  for (let f = 0; f < floors; f++) {
    const y = base + fh * f + fh * 0.5 - wh / 2 + 0.06;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (w / n);
      if (f === 0 && i === doorSlot) {
        b.box(0.5, 0.82, 0.08, x, base, d / 2 + 0.01, C.door);
        b.box(0.7, 0.08, 0.3, x, base - 0.04, d / 2 + 0.15, C.snow);
      } else {
        g.box(ww, wh, 0.06, x, y, d / 2 + 0.012, '#fff');
        b.box(ww + 0.14, 0.07, 0.12, x, y - 0.07, d / 2 + 0.04, C.snow);
      }
      g.box(ww, wh, 0.06, x, y, -d / 2 - 0.012, '#fff');
    }
    for (const s of [1, -1]) g.box(0.06, wh, ww, s * (w / 2 + 0.012), y, 0, '#fff');
  }
  for (const s of [1, -1]) g.box(0.06, 0.34, 0.34, s * (w / 2 + 0.005), yE + roofH * 0.2, 0, '#fff');
  if (floors > 1) {
    for (let f = 1; f < floors; f++) {
      const y = base + fh * f - 0.02;
      b.box(w * 0.94, 0.08, 0.55, 0, y, d / 2 + 0.27, C.woodDark);
      b.box(w * 0.94, 0.3, 0.06, 0, y + 0.08, d / 2 + 0.52, C.woodDark);
      b.box(w * 0.94, 0.07, 0.12, 0, y + 0.38, d / 2 + 0.52, C.snow);
    }
  }
  return { body: b.build(), glass: g.build(), smoke, w, d, top: yE + roofH };
}

// Terrasse du restaurant : plancher, tables, parasols enneigés.
export function terraceGeo(w) {
  const b = new GeoBuilder();
  b.box(w, 0.16, 2.0, 0, 0.1, 0, '#6d4a35');
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * (w / 3.2);
    b.cyl(0.28, 0.28, 0.06, 6, x, 0.6, 0.1, '#8b5a3a');
    b.cyl(0.04, 0.04, 0.36, 4, x, 0.26, 0.1, C.metalDark);
    b.cyl(0.03, 0.03, 0.9, 4, x, 0.66, 0.1, C.metalDark);
    b.cone(0.55, 0.28, 6, x, 1.5, 0.1, [C.red, '#e9b44c', '#3f7fd0'][i]);
    b.cone(0.38, 0.2, 6, x, 1.62, 0.1, C.snow);
  }
  return b.build();
}

export function lampGeos() {
  const b = new GeoBuilder();
  b.cyl(0.045, 0.07, 1.7, 5, 0, 0, 0, C.metalDark);
  b.box(0.3, 0.05, 0.3, 0, 1.92, 0, C.metalDark);
  b.cone(0.2, 0.12, 4, 0, 1.97, 0, C.snow, Math.PI / 4);
  const bulb = new THREE.OctahedronGeometry(0.14, 0);
  bulb.translate(0, 1.8, 0);
  return { pole: b.build(), bulb };
}

// Lampadaire de piste : plus haut, tête déportée.
export function pisteLampGeos() {
  const b = new GeoBuilder();
  b.cyl(0.05, 0.08, 2.9, 5, 0, 0, 0, C.metal);
  b.box(0.5, 0.07, 0.2, 0.2, 2.9, 0, C.metalDark);
  const bulb = new THREE.BoxGeometry(0.34, 0.09, 0.18);
  bulb.translate(0.26, 2.86, 0);
  return { pole: b.build(), bulb };
}

export function markerGeo() {
  const b = new GeoBuilder();
  b.cyl(0.035, 0.035, 0.75, 4, 0, 0, 0, '#ffffff');
  return b.build();
}

export function skierGeo() {
  const b = new GeoBuilder();
  b.box(0.22, 0.42, 0.18, 0, 0.08, 0, '#ffffff');
  b.box(0.17, 0.17, 0.17, 0, 0.52, 0, '#ffe2cc');
  b.box(0.06, 0.04, 0.8, -0.07, 0, 0.05, '#3a3a4a');
  b.box(0.06, 0.04, 0.8, 0.07, 0, 0.05, '#3a3a4a');
  return b.build();
}

// Véhicules de remontée : l'origine est le point d'accroche au câble.
export function cabinGeos() {
  const b = new GeoBuilder();
  b.box(0.07, 0.55, 0.07, 0, -0.55, 0, C.metalDark);
  b.box(0.3, 0.09, 0.16, 0, -0.06, 0, C.metalDark);
  b.box(0.92, 0.1, 0.92, 0, -0.63, 0, C.metalDark);
  b.box(0.86, 0.84, 0.86, 0, -1.46, 0, '#2d3152');
  b.box(0.9, 0.24, 0.9, 0, -1.48, 0, C.red);
  const glass = new THREE.BoxGeometry(0.9, 0.4, 0.9);
  glass.translate(0, -0.95, 0);
  return { body: b.build(), glass };
}
export function chairGeo() {
  const b = new GeoBuilder();
  b.box(0.06, 1.0, 0.06, 0, -1.0, 0, C.metalDark);
  b.box(0.3, 0.08, 0.14, 0, -0.06, 0, C.metalDark);
  b.box(1.0, 0.07, 0.36, 0, -1.05, 0.05, '#39405e');
  b.box(1.0, 0.4, 0.06, 0, -1.05, -0.14, '#39405e');
  b.box(1.0, 0.04, 0.04, 0, -0.78, 0.3, C.metalDark);
  return b.build();
}
export function tbarGeo() {
  const b = new GeoBuilder();
  b.box(0.04, 1.15, 0.04, 0, -1.15, 0, C.metalDark);
  b.box(0.6, 0.05, 0.05, 0, -1.17, 0, C.red);
  return b.build();
}

export function pylonGeo(h, arm) {
  const b = new GeoBuilder();
  b.cyl(0.09, 0.15, h + 1, 6, 0, -1, 0, C.metal);
  b.box(arm * 2 + 0.36, 0.12, 0.14, 0, h - 0.06, 0, C.metal);
  for (const s of [1, -1]) b.box(0.12, 0.16, 0.5, s * arm, h - 0.1, 0, C.metalDark);
  b.cone(0.16, 0.14, 6, 0, h + 0.06, 0, C.snow);
  return b.build();
}

// Gare de télécabine : volume fermé (les cabines y font demi-tour à l'abri des regards).
export function stationGeos() {
  const b = new GeoBuilder(), g = new GeoBuilder();
  b.box(2.7, 2.4, 3.7, 0, -2.2, 0, C.stone);
  b.box(2.5, 2.1, 3.5, 0, 0.2, 0, '#c9cbdc');
  b.box(2.56, 0.5, 3.56, 0, 0.2, 0, C.red);
  for (const s of [1, -1]) b.box(1.9, 1.5, 0.08, 0, 0.75, s * 1.76, '#1d1f33');
  b.box(2.9, 0.14, 3.9, 0, 2.3, 0, C.metalDark);
  b.box(2.8, 0.26, 3.8, 0, 2.44, 0, C.snow);
  for (const s of [1, -1]) g.box(0.06, 0.55, 2.7, s * 1.27, 1.25, 0, '#fff');
  return { body: b.build(), glass: g.build() };
}

// Portique de départ / arrivée (téléski, télésiège).
export function portalGeo(h, arm) {
  const b = new GeoBuilder();
  for (const s of [1, -1]) b.cyl(0.08, 0.11, h + 0.8, 5, s * (arm + 0.35), -0.8, 0, C.metal);
  b.box(arm * 2 + 1.0, 0.14, 0.2, 0, h - 0.07, 0, C.red);
  b.cyl(arm, arm, 0.08, 10, 0, h - 0.2, 0, C.metalDark);
  b.box(arm * 2 + 1.0, 0.1, 0.24, 0, h + 0.07, 0, C.snow);
  return b.build();
}

export function snowmanGeo() {
  const b = new GeoBuilder();
  const ball = (r, y) => b.add(new THREE.IcosahedronGeometry(r, 1), C.snow, mat(0, y, 0));
  ball(0.46, 0.38); ball(0.33, 0.98); ball(0.23, 1.44);
  b.add(new THREE.ConeGeometry(0.05, 0.26, 5), '#ff8a3c', mat(0, 1.44, 0.3, Math.PI / 2));
  b.cyl(0.22, 0.22, 0.04, 8, 0, 1.62, 0, '#23233a');
  b.cyl(0.14, 0.14, 0.22, 8, 0, 1.64, 0, '#23233a');
  b.box(0.5, 0.07, 0.36, 0, 1.18, 0.02, C.red);
  for (const s of [1, -1]) b.boxC(0.5, 0.035, 0.035, s * 0.5, 1.08, 0, '#5b3d2a', 0, 0, s * 0.5);
  return b.build();
}

export function campfireGeos() {
  const b = new GeoBuilder();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.add(new THREE.IcosahedronGeometry(0.14, 0), C.stone2, mat(Math.cos(a) * 0.5, 0.06, Math.sin(a) * 0.5));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    b.boxC(0.1, 0.62, 0.1, Math.cos(a) * 0.16, 0.26, Math.sin(a) * 0.16, '#4a2e22', -a + Math.PI / 2, 0.5);
  }
  for (const s of [1, -1]) b.box(0.9, 0.2, 0.22, s * 0.2, 0, s * 1.0, '#6d4a35', 0.3);
  const flame = new THREE.ConeGeometry(0.2, 0.6, 5);
  flame.translate(0, 0.45, 0);
  return { body: b.build(), flame };
}

export function archGeo(color) {
  const b = new GeoBuilder();
  b.add(new THREE.TorusGeometry(1.15, 0.16, 5, 12, Math.PI), color);
  for (const s of [1, -1]) b.box(0.36, 0.3, 0.36, s * 1.15, -0.3, 0, color);
  b.add(new THREE.TorusGeometry(1.15, 0.1, 4, 10, Math.PI * 0.7), C.snow, mat(0, 0.13, 0, 0, 0, Math.PI * 0.15));
  return b.build();
}

export function busGeos() {
  const b = new GeoBuilder(), g = new GeoBuilder(), l = new GeoBuilder();
  b.box(0.95, 0.75, 2.2, 0, 0.18, 0, '#ece7da');
  b.box(0.97, 0.22, 2.22, 0, 0.18, 0, C.red);
  b.box(0.9, 0.08, 2.1, 0, 0.93, 0, C.snow);
  for (const z of [-0.7, 0.7]) for (const x of [-0.45, 0.45]) b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 8), '#22222e', mat(x, 0.17, z, 0, 0, Math.PI / 2));
  for (const s of [1, -1]) g.box(0.04, 0.26, 1.7, s * 0.48, 0.55, -0.05, '#fff');
  g.box(0.8, 0.28, 0.04, 0, 0.55, 1.1, '#fff');
  for (const s of [1, -1]) l.box(0.16, 0.1, 0.04, s * 0.3, 0.3, 1.11, '#fff');
  return { body: b.build(), glass: g.build(), lights: l.build() };
}

export function antennaGeo() {
  const b = new GeoBuilder();
  b.cyl(0.03, 0.06, 2.6, 4, 0, 0, 0, C.metal);
  b.box(0.5, 0.04, 0.04, 0, 1.7, 0, C.metal);
  b.box(0.34, 0.04, 0.04, 0, 2.1, 0, C.metal);
  return b.build();
}

export function fenceGeo(radius, n) {
  const b = new GeoBuilder();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    b.box(0.09, 0.5, 0.09, pts[i].x, 0, pts[i].z, '#6d4a35');
    b.box(0.13, 0.05, 0.13, pts[i].x, 0.5, pts[i].z, C.snow);
  }
  for (let i = 0; i < n; i++) {
    if (i === 0) continue; // une ouverture
    const a = pts[i].clone().setY(0.36), c = pts[(i + 1) % n].clone().setY(0.36);
    b.beam(a, c, 0.03, '#6d4a35');
  }
  return b.build();
}
