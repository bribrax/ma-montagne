// Caméra en orbite : glisser pour tourner, pincer (ou molette) pour zoomer.
// L'élévation est bornée : on ne passe jamais sous le terrain.
import * as THREE from 'three';
import { clamp, easeInOut } from './util.js';

export class Orbit {
  constructor(camera, dom) {
    this.cam = camera;
    this.target = new THREE.Vector3(0, 6.5, 1);
    this.az = this.tAz = 0.5;
    this.el = this.tEl = 0.3;
    this.dist = this.tDist = 100;
    this.minEl = 0.07; this.maxEl = 1.22;
    this.minDist = 40; this.maxDist = 140;
    this.idle = 0; this.focusAnim = null;
    const pts = new Map();
    let pinch = 0;

    dom.addEventListener('pointerdown', (e) => {
      dom.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.idle = 0; this.focusAnim = null;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    dom.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      this.idle = 0;
      if (pts.size === 1) {
        this.tAz -= dx * 0.0055;
        this.tEl = clamp(this.tEl + dy * 0.0045, this.minEl, this.maxEl);
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) this.tDist = clamp((this.tDist * pinch) / d, this.minDist, this.maxDist);
        pinch = d;
        this.tAz -= dx * 0.0025; // tourner à deux doigts reste possible
      }
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.idle = 0;
      this.tDist = clamp(this.tDist * Math.exp(e.deltaY * 0.0011), this.minDist, this.maxDist);
    }, { passive: false });
    // Safari : empêche le zoom de page au pincement
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
  }

  // Ajuste les distances pour que l'île tienne dans l'écran, en paysage comme en portrait.
  fit(aspect, first) {
    const t = Math.tan((this.cam.fov * Math.PI) / 360);
    const fit = Math.max(30 / t, 37 / (t * aspect));
    this.minDist = fit * 0.4; this.maxDist = fit * 1.3;
    if (first) this.dist = this.tDist = fit;
    else this.tDist = clamp(this.tDist, this.minDist, this.maxDist);
  }

  // Tourne en douceur pour montrer un point de l'île (une nouvelle construction).
  focus(x, z) {
    let to = Math.atan2(x - this.target.x, z - this.target.z);
    let d = to - this.tAz;
    d = ((((d + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(d) < 0.5) return;
    d -= Math.sign(d) * 0.35; // on garde un léger angle, plus flatteur qu'une vue de face
    this.focusAnim = { from: this.tAz, to: this.tAz + d, t: 0, dur: 1.4 };
    this.idle = 0;
  }

  update(dt) {
    this.idle += dt;
    if (this.focusAnim) {
      const f = this.focusAnim;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      this.tAz = f.from + (f.to - f.from) * easeInOut(k);
      if (k >= 1) this.focusAnim = null;
    } else if (this.idle > 7) {
      this.tAz += dt * 0.022 * Math.min(1, (this.idle - 7) / 3); // dérive lente au repos
    }
    const k = 1 - Math.exp(-dt * 9);
    this.az += (this.tAz - this.az) * k;
    this.el += (this.tEl - this.el) * k;
    this.dist += (this.tDist - this.dist) * k;
    const ce = Math.cos(this.el);
    this.cam.position.set(
      this.target.x + Math.sin(this.az) * ce * this.dist,
      this.target.y + Math.sin(this.el) * this.dist,
      this.target.z + Math.cos(this.az) * ce * this.dist
    );
    this.cam.lookAt(this.target);
  }
}
