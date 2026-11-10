// Réglages faciles à ajuster.
export const CREDITS_PER_HOUR = 10;      // 1 heure de travail = 10 crédits
export const DAY_LENGTH_S = 300;         // durée d'un cycle jour/nuit complet, en secondes
export const QUICK_HOURS = [0.5, 1, 2, 4];

export const CATS = [
  { id: 'chalets', name: 'Chalets', icon: 'chalet' },
  { id: 'routes', name: 'Routes', icon: 'road' },
  { id: 'lifts', name: 'Remontées', icon: 'gondola' },
  { id: 'pistes', name: 'Pistes', icon: 'piste' },
  { id: 'ambiance', name: 'Ambiance', icon: 'tree' },
];

// Dans chaque catégorie, une amélioration se débloque après la précédente.
// `req` ajoute une dépendance vers une autre catégorie.
export const UPGRADES = [
  { id: 'ch1', cat: 'chalets', name: 'Premier chalet', cost: 10, icon: 'chalet' },
  { id: 'ch2', cat: 'chalets', name: 'Chalet du bois', cost: 20, icon: 'chalet' },
  { id: 'ch3', cat: 'chalets', name: 'Chalet du belvédère', cost: 35, icon: 'chalet' },
  { id: 'ch4', cat: 'chalets', name: 'Chalet des mélèzes', cost: 50, icon: 'chalet' },
  { id: 'ch5', cat: 'chalets', name: 'Chalet de la combe', cost: 70, icon: 'chalet' },
  { id: 'ch6', cat: 'chalets', name: 'Auberge', cost: 100, icon: 'inn' },
  { id: 'ch7', cat: 'chalets', name: "Chalet d'alpage", cost: 130, icon: 'chalet' },
  { id: 'ch8', cat: 'chalets', name: 'Chalet du torrent', cost: 150, icon: 'chalet' },
  { id: 'ch9', cat: 'chalets', name: 'Restaurant des pistes', cost: 190, icon: 'inn' },
  { id: 'ch10', cat: 'chalets', name: 'Chalet du couchant', cost: 210, icon: 'chalet' },
  { id: 'ch11', cat: 'chalets', name: 'Grand hôtel', cost: 280, icon: 'hotel' },
  { id: 'ch12', cat: 'chalets', name: 'Refuge du sommet', cost: 380, icon: 'refuge' },

  { id: 'rd1', cat: 'routes', name: 'Chemin du village', cost: 15, icon: 'road' },
  { id: 'rd2', cat: 'routes', name: 'Lampadaires', cost: 30, icon: 'lamp' },
  { id: 'rd3', cat: 'routes', name: 'Route de la station', cost: 55, icon: 'road' },
  { id: 'rd4', cat: 'routes', name: 'Lampadaires de la station', cost: 75, icon: 'lamp' },
  { id: 'rd5', cat: 'routes', name: 'Navette', cost: 110, icon: 'bus' },
  { id: 'rd6', cat: 'routes', name: 'Route du col éclairée', cost: 140, icon: 'road' },

  { id: 'lf1', cat: 'lifts', name: 'Téléski', cost: 60, icon: 'tbar', req: ['ps1'] },
  { id: 'lf2', cat: 'lifts', name: 'Télésiège', cost: 150, icon: 'chair', req: ['ps2'] },
  { id: 'lf3', cat: 'lifts', name: 'Télécabine', cost: 260, icon: 'gondola' },
  { id: 'lf4', cat: 'lifts', name: 'Télécabine du sommet', cost: 400, icon: 'gondola' },

  { id: 'ps1', cat: 'pistes', name: 'Piste verte', cost: 25, icon: 'piste', tint: '#57c785' },
  { id: 'ps2', cat: 'pistes', name: 'Piste bleue', cost: 55, icon: 'piste', tint: '#5aa9ff' },
  { id: 'ps3', cat: 'pistes', name: "Arches d'arrivée", cost: 80, icon: 'arch' },
  { id: 'ps4', cat: 'pistes', name: 'Éclairage des pistes', cost: 100, icon: 'pistelight' },
  { id: 'ps5', cat: 'pistes', name: 'Piste rouge', cost: 140, icon: 'piste', tint: '#ff6b6b' },
  { id: 'ps6', cat: 'pistes', name: 'Piste noire', cost: 200, icon: 'piste', tint: '#3b3f52' },
  { id: 'ps7', cat: 'pistes', name: "Éclairage d'altitude", cost: 250, icon: 'pistelight' },

  { id: 'am1', cat: 'ambiance', name: 'Sapins', cost: 10, icon: 'tree' },
  { id: 'am2', cat: 'ambiance', name: 'Bonhomme de neige', cost: 15, icon: 'snowman' },
  { id: 'am3', cat: 'ambiance', name: 'Forêt', cost: 40, icon: 'tree' },
  { id: 'am4', cat: 'ambiance', name: 'Feu de camp', cost: 50, icon: 'fire' },
  { id: 'am5', cat: 'ambiance', name: 'Patinoire', cost: 80, icon: 'pond' },
  { id: 'am6', cat: 'ambiance', name: 'Sapin illuminé', cost: 100, icon: 'garland' },
  { id: 'am7', cat: 'ambiance', name: 'Grande forêt', cost: 120, icon: 'tree' },
  { id: 'am8', cat: 'ambiance', name: 'Cascade', cost: 160, icon: 'waterfall' },
  { id: 'am9', cat: 'ambiance', name: 'Aurores boréales', cost: 300, icon: 'aurora' },
  { id: 'am10', cat: 'ambiance', name: "Feux d'artifice", cost: 380, icon: 'fireworks' },
];

// Calcule les prérequis : la précédente de la même catégorie + les `req` explicites.
for (const cat of CATS) {
  const list = UPGRADES.filter((u) => u.cat === cat.id);
  list.forEach((u, i) => { u.needs = [...(i > 0 ? [list[i - 1].id] : []), ...(u.req || [])]; });
}
export const byId = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
