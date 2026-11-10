// Progression : sessions de travail, achats, réglages. Sauvegarde locale + export/import JSON.
import { CREDITS_PER_HOUR, UPGRADES, byId } from './config.js';

const KEY = 'ma-montagne-v1';
const params = new URLSearchParams(location.search);
// ?demo : crédits illimités, rien n'est enregistré. ?demo=all : tout est déjà construit.
export const DEMO = params.has('demo') ? (params.get('demo') || 'free') : null;

const blank = () => ({ app: 'ma-montagne', v: 1, sessions: [], bought: [], settings: { sound: true, sky: 'auto' }, lastExport: 0 });

function sanitize(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.sessions)) return null;
  const out = blank();
  for (const s of d.sessions) {
    const h = +s.h;
    if (h > 0 && h <= 24 && typeof s.t === 'string' && !isNaN(Date.parse(s.t))) out.sessions.push({ t: s.t, h });
  }
  if (Array.isArray(d.bought)) for (const b of d.bought) {
    const u = b && byId[b.id];
    if (u && !out.bought.some((x) => x.id === u.id)) out.bought.push({ id: u.id, cost: Number.isFinite(+b.cost) ? +b.cost : u.cost, t: typeof b.t === 'string' ? b.t : null });
  }
  if (d.settings && typeof d.settings === 'object') {
    out.settings.sound = d.settings.sound !== false;
    if (['auto', 'day', 'dusk', 'night'].includes(d.settings.sky)) out.settings.sky = d.settings.sky;
  }
  out.lastExport = +d.lastExport || 0;
  return out;
}

export const store = {
  data: blank(),

  load() {
    if (DEMO) {
      if (DEMO === 'all') this.data.bought = UPGRADES.map((u) => ({ id: u.id, cost: 0, t: null }));
      return;
    }
    try {
      const d = sanitize(JSON.parse(localStorage.getItem(KEY)));
      if (d) this.data = d;
    } catch (e) { /* première visite ou stockage indisponible */ }
    // demande au navigateur de ne pas purger nos données
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  },
  save() {
    if (DEMO) return true;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; } catch (e) { return false; }
  },

  get totalHours() { return this.data.sessions.reduce((s, x) => s + x.h, 0); },
  get credits() {
    const spent = this.data.bought.reduce((s, x) => s + x.cost, 0);
    return Math.round(this.totalHours * CREDITS_PER_HOUR) - spent + (DEMO ? 100000 : 0);
  },
  has(id) { return this.data.bought.some((b) => b.id === id); },
  unlocked(u) { return u.needs.every((n) => this.has(n)); },
  canBuy(u) { return !this.has(u.id) && this.unlocked(u) && this.credits >= u.cost; },

  addSession(h) {
    const s = { t: new Date().toISOString(), h };
    this.data.sessions.push(s);
    this.save();
    return s;
  },
  removeSession(s) {
    const i = this.data.sessions.indexOf(s);
    if (i >= 0) { this.data.sessions.splice(i, 1); this.save(); }
  },
  buy(u) {
    if (!this.canBuy(u)) return false;
    this.data.bought.push({ id: u.id, cost: u.cost, t: new Date().toISOString() });
    this.save();
    return true;
  },

  exportText() {
    this.data.lastExport = Date.now();
    this.save();
    return JSON.stringify(this.data, null, 2);
  },
  // Renvoie les données validées, ou null si le fichier n'est pas une sauvegarde lisible.
  parseImport(text) {
    try { return sanitize(JSON.parse(text)); } catch (e) { return null; }
  },
  replace(d) { this.data = d; this.save(); },
};
