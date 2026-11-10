// Petits sons synthétisés (aucun fichier audio). Discrets, et désactivables dans le menu.
let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }

// Les navigateurs exigent un geste de l'utilisateur avant de produire du son.
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) ctx = new AC();
}

function tone(freq, t0, dur, gain, type = 'sine', slideTo = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function whoosh(t0, dur, gain, freq = 1400) {
  const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = gain;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t0);
}

export function sfx(name) {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.01;
  if (name === 'tap') tone(660, t, 0.07, 0.04, 'triangle');
  else if (name === 'hours') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.08, 0.55, 0.06, 'triangle'));
  else if (name === 'build') {
    tone(300, t, 0.22, 0.12, 'sine', 620);
    whoosh(t, 0.4, 0.07);
    [659.25, 987.77].forEach((f, i) => tone(f, t + 0.12 + i * 0.09, 0.6, 0.045, 'sine'));
  } else if (name === 'big') {
    tone(220, t, 0.3, 0.12, 'sine', 520);
    whoosh(t, 0.7, 0.08, 1000);
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, t + 0.15 + i * 0.1, 0.9, 0.045, 'triangle'));
  } else if (name === 'firework') { whoosh(t, 0.5, 0.035, 500); tone(90, t, 0.25, 0.05, 'sine', 50); }
  else if (name === 'nope') tone(200, t, 0.12, 0.05, 'sine', 150);
}
