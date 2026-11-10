// Interface minimale : compteur, saisie des heures, panneau d'améliorations, menu.
import { CATS, UPGRADES, QUICK_HOURS, CREDITS_PER_HOUR, byId } from './config.js';
import { store, DEMO } from './state.js';
import { sfx, setSound } from './audio.js';

const $ = (id) => document.getElementById(id);
const MTN = '<svg viewBox="0 0 24 24"><path d="M1.5 20.5 9 6.5l3.6 6.2 2.2-3.4 7.7 11.2Z"/></svg>';

// Vignettes : petits pictos au trait (viewBox 32). `.f` = touche chaude, `.t` = couleur de la piste.
const ICONS = {
  chalet: '<path d="M4 16 16 6l12 10M7 15v11h18V15"/><rect class="f" x="13" y="18" width="6" height="5" rx="1"/>',
  inn: '<path d="M3 14 16 5l13 9M6 13v14h20V13"/><rect class="f" x="10" y="16" width="4" height="4" rx="1"/><rect class="f" x="18" y="16" width="4" height="4" rx="1"/><path d="M14 27v-4h4v4"/>',
  hotel: '<path d="M8 27V7h16v20M5 7h22M5 27h22"/><rect class="f" x="11" y="10" width="3.5" height="3.5" rx=".8"/><rect class="f" x="17.5" y="10" width="3.5" height="3.5" rx=".8"/><rect class="f" x="11" y="16" width="3.5" height="3.5" rx=".8"/><rect class="f" x="17.5" y="16" width="3.5" height="3.5" rx=".8"/><path d="M14 27v-4h4v4"/>',
  refuge: '<path d="M3 27 16 8l13 19M16 8V3"/><circle class="f" cx="16" cy="3" r="1.8"/><path class="f" d="M12 27v-6l4-3 4 3v6Z"/>',
  road: '<path d="M11 28 14 4M21 28 18 4"/><path class="t" d="M16 7v3M16 14v3M16 21v4"/>',
  lamp: '<path d="M16 28V11M12 28h8"/><path class="f" d="M11 11h10l-2-5h-6Z"/><path d="M7 15l-2 2M25 15l2 2M16 15v2"/>',
  bus: '<rect x="5" y="8" width="22" height="15" rx="3.5"/><rect class="f" x="8" y="11" width="16" height="5" rx="1.2"/><circle cx="11" cy="24" r="2.2"/><circle cx="21" cy="24" r="2.2"/>',
  tbar: '<path d="M4 9 28 4M16 6.5V20M11 20h10M4 28l24-6"/><circle class="f" cx="16" cy="6.5" r="2"/>',
  chair: '<path d="M4 8 28 4M16 6v9"/><path class="f" d="M10 15h12v6H10Z"/><path d="M10 15v9M22 15v9M10 24h12"/>',
  gondola: '<path d="M4 7 28 3M16 5v5"/><rect x="9" y="10" width="14" height="15" rx="3.5"/><rect class="f" x="11.5" y="13" width="9" height="5" rx="1.2"/>',
  piste: '<path d="M3 27 13 7l5 8 3-4 8 16"/><path class="t" d="M13 12c4 3-5 6 0 9s2 4 3 6"/>',
  pistelight: '<path d="M3 27c6-9 10-3 14-8s7-5 12-9"/><path d="M23 27V10l-6 2"/><circle class="f" cx="15.5" cy="13" r="3"/>',
  arch: '<path d="M7 27V15a9 9 0 0 1 18 0v12" stroke-width="3.4"/><path class="f" d="M13 13h6v4h-6Z"/>',
  tree: '<path class="f" d="M16 4 10 12h3.5L8 19.5h5L10 25h12l-3-5.5h5L18.5 12H22Z"/><path d="M16 4 10 12h3.5L8 19.5h5L10 25h12l-3-5.5h5L18.5 12H22ZM16 25v4"/>',
  snowman: '<circle cx="16" cy="21.5" r="6"/><circle cx="16" cy="11.5" r="4"/><path d="M11.5 8h9M13.5 8V4.5h5V8"/><path class="f" d="M16 11.5l4.5 1-4.5.8Z"/>',
  fire: '<path class="f" d="M16 4c1 5 7 7 7 13a7 7 0 0 1-14 0c0-3 1.6-5 3-7 .6 2 1.6 3 2.6 3 .2-3 .2-6 1.4-9Z"/><path d="M8 28h16"/>',
  pond: '<ellipse class="f" cx="16" cy="20" rx="11.5" ry="5.5" opacity=".55"/><ellipse cx="16" cy="20" rx="11.5" ry="5.5"/><path d="M10 19c3 2.4 8 2.4 11 0M16 5v6M13 8h6"/>',
  garland: '<path d="M3 8c6 9 20 9 26 0"/><circle class="f" cx="8" cy="13.4" r="2.3"/><circle class="f" cx="16" cy="16" r="2.3"/><circle class="f" cx="24" cy="13.4" r="2.3"/><path d="M16 21l-4 6h8Z"/>',
  waterfall: '<path d="M4 6h10v21"/><path class="t" style="--tint:#8fd0ff" d="M18 6v17M22.5 6v19M27 6v13"/><path d="M15 28h14"/>',
  aurora: '<path class="t" style="--tint:#7dffb5" d="M3 13c5-7 8 4 13-2s8 2 13-4"/><path class="t" style="--tint:#b99bff" d="M3 21c5-7 8 4 13-2s8 2 13-4"/><circle class="f" cx="8" cy="5" r="1.2"/><circle class="f" cx="24" cy="26" r="1.2"/>',
  fireworks: '<path d="M16 30v-9"/><path class="t" d="M16 6v4M16 18v4M8 14h4M20 14h4M10.3 8.3l2.9 2.9M18.8 16.8l2.9 2.9M21.7 8.3l-2.9 2.9M13.2 16.8l-2.9 2.9"/><circle class="f" cx="16" cy="14" r="2"/>',
};
const icon = (name) => `<svg viewBox="0 0 32 32">${ICONS[name] || ICONS.chalet}</svg>`;
const fmtH = (h) => `${h.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} h`;
const fmtN = (n) => Math.round(n).toLocaleString('fr-FR');

export function initUI(api) {
  let cat = CATS[0].id, custom = 1.5, shown = store.credits, toastTimer = 0, anim = 0;
  const body = document.body;

  // ---------- compteur ----------
  function refreshCounter(animated) {
    $('hours').textContent = fmtH(store.totalHours);
    const target = store.credits;
    cancelAnimationFrame(anim);
    if (!animated || shown === target) { shown = target; $('credits').textContent = DEMO ? '∞' : fmtN(shown); return; }
    const from = shown, t0 = performance.now(), dur = 700;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      shown = from + (target - from) * e;
      $('credits').textContent = DEMO ? '∞' : fmtN(shown);
      if (k < 1) anim = requestAnimationFrame(step); else shown = target;
    };
    anim = requestAnimationFrame(step);
    $('counter').classList.remove('bump'); void $('counter').offsetWidth; $('counter').classList.add('bump');
  }

  function toast(text, action, onAction, ms = 4500) {
    const t = $('toast');
    t.textContent = text;
    if (action) {
      const b = document.createElement('button');
      b.textContent = action;
      b.onclick = () => { t.hidden = true; onAction(); };
      t.appendChild(b);
    }
    t.hidden = true; void t.offsetWidth; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  function fly(text, fromEl) {
    const a = fromEl.getBoundingClientRect(), b = $('counter').getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'fly'; el.textContent = text;
    el.style.left = `${a.left + a.width / 2 - 20}px`; el.style.top = `${a.top - 10}px`;
    el.style.setProperty('--dx', `${b.left + b.width / 2 - a.left - a.width / 2}px`);
    el.style.setProperty('--dy', `${b.top - a.top + 20}px`);
    body.appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }

  // ---------- saisie des heures (2 touchers : « + » puis la durée) ----------
  const chips = $('chips');
  for (const h of QUICK_HOURS) {
    const b = document.createElement('button');
    b.innerHTML = `${h.toLocaleString('fr-FR')}<small>h</small>`;
    b.onclick = () => addHours(h);
    chips.appendChild(b);
  }
  function setPop(open) {
    $('addPop').hidden = !open;
    $('addBtn').classList.toggle('open', open);
    if (open) setMenu(false);
  }
  function addHours(h) {
    const s = store.addSession(h), gain = Math.round(h * CREDITS_PER_HOUR);
    setPop(false);
    $('hint').hidden = true;
    sfx('hours');
    fly(`+${gain}`, $('addBtn'));
    setTimeout(() => refreshAll(true), 650);
    toast(`${fmtH(h)} ajoutée${h >= 2 ? 's' : ''}`, 'Annuler', () => { store.removeSession(s); refreshAll(true); });
  }
  $('addBtn').onclick = () => { sfx('tap'); setPop($('addPop').hidden); };
  const showCustom = () => { $('customH').textContent = fmtH(custom); };
  $('minus').onclick = () => { custom = Math.max(0.25, custom - 0.25); showCustom(); };
  $('plus').onclick = () => { custom = Math.min(16, custom + 0.25); showCustom(); };
  $('customOk').onclick = () => addHours(custom);
  showCustom();

  // ---------- panneau d'améliorations ----------
  const tabs = $('tabs'), list = $('list');
  for (const c of CATS) {
    const b = document.createElement('button');
    b.dataset.cat = c.id;
    b.innerHTML = `${icon(c.icon)}<span>${c.name}</span>`;
    b.onclick = () => { cat = c.id; sfx('tap'); renderShop(true); };
    tabs.appendChild(b);
  }
  function renderShop(scroll, justId) {
    const credits = store.credits;
    for (const b of tabs.children) {
      b.classList.toggle('on', b.dataset.cat === cat);
      b.classList.toggle('can', UPGRADES.some((u) => u.cat === b.dataset.cat && store.canBuy(u)));
    }
    list.textContent = '';
    let firstOpen = null;
    for (const u of UPGRADES.filter((x) => x.cat === cat)) {
      const owned = store.has(u.id), unlocked = store.unlocked(u), ready = !owned && unlocked && credits >= u.cost;
      const el = document.createElement('button');
      el.className = `up ${owned ? 'owned' : ready ? 'ready' : unlocked ? '' : 'locked'}${u.id === justId ? ' just' : ''}`;
      if (u.tint) el.style.setProperty('--tint', u.tint);
      const missing = u.needs.filter((n) => !store.has(n)).map((n) => byId[n].name);
      const sub = !owned && !unlocked ? `<small>après ${missing[missing.length - 1]}</small>` : '';
      el.innerHTML = `<span class="thumb">${icon(u.icon)}</span><span class="name">${u.name}${sub}</span>`
        + `<span class="cost">${owned ? '✓' : MTN + fmtN(u.cost)}</span>`
        + (!owned && unlocked && !ready ? `<i class="bar" style="--p:${Math.max(0, Math.min(1, credits / u.cost))}"></i>` : '');
      if (!owned) {
        el.onclick = () => {
          if (store.canBuy(u)) { api.buy(u); renderShop(false, u.id); refreshCounter(true); refreshDot(); }
          else {
            sfx('nope');
            if (!store.unlocked(u)) toast(`Disponible après « ${missing[missing.length - 1]} »`, null, null, 2600);
            else toast(`Encore ${fmtH(Math.ceil(((u.cost - store.credits) / CREDITS_PER_HOUR) * 4) / 4)} de travail`, null, null, 2600);
          }
        };
        if (!firstOpen) firstOpen = el;
      }
      list.appendChild(el);
    }
    if (scroll && firstOpen) list.scrollTop = Math.max(0, firstOpen.offsetTop - list.offsetTop - 72);
  }
  function refreshDot() { $('shopBtn').querySelector('.dot').hidden = !UPGRADES.some((u) => store.canBuy(u)); }
  function setShop(open) {
    body.classList.toggle('shop', open);
    if (open) { setMenu(false); setPop(false); renderShop(true); }
    api.onShop(open);
  }
  $('shopBtn').onclick = () => {
    sfx('tap');
    if (!body.classList.contains('shop')) { // ouvre sur la première catégorie où un achat est possible
      const c = CATS.find((k) => UPGRADES.some((u) => u.cat === k.id && store.canBuy(u)));
      if (c) cat = c.id;
    }
    setShop(!body.classList.contains('shop'));
  };
  // glisser la poignée pour refermer
  let drag = null;
  $('grab').addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; $('grab').setPointerCapture(e.pointerId); });
  $('grab').addEventListener('pointerup', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag = null;
    if (dx > 40 || dy > 40 || (Math.abs(dx) < 6 && Math.abs(dy) < 6)) setShop(false);
  });

  // ---------- menu ----------
  function renderMenu() {
    const d = store.data, now = Date.now();
    $('statH').textContent = fmtH(store.totalHours);
    const week = d.sessions.filter((s) => now - Date.parse(s.t) < 7 * 864e5).reduce((a, s) => a + s.h, 0);
    $('statS').textContent = `${d.sessions.length} session${d.sessions.length > 1 ? 's' : ''} · ${fmtH(week)} sur 7 jours · ${d.bought.length}/${UPGRADES.length} améliorations`;
    for (const b of $('skySeg').children) b.classList.toggle('on', b.dataset.sky === d.settings.sky);
    $('soundBtn').setAttribute('aria-checked', String(d.settings.sound));
    const note = $('backupNote');
    const days = d.lastExport ? Math.floor((now - d.lastExport) / 864e5) : null;
    note.classList.toggle('warn', d.sessions.length > 0 && (days === null || days > 14));
    note.textContent = DEMO ? 'Mode démo : rien n’est enregistré.'
      : days === null ? (d.sessions.length ? 'Jamais exporté. Pense à faire une copie de temps en temps.' : 'Sauvegarde automatique sur cet appareil.')
      : days === 0 ? 'Dernier export : aujourd’hui.' : `Dernier export : il y a ${days} jour${days > 1 ? 's' : ''}.`;
    const ul = $('history');
    ul.textContent = '';
    if (!d.sessions.length) { ul.innerHTML = '<li class="empty">Aucune session pour l’instant.</li>'; return; }
    for (const s of [...d.sessions].reverse().slice(0, 200)) {
      const li = document.createElement('li'), date = new Date(s.t);
      const label = `${date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      li.innerHTML = `<span>${label}</span><b>${fmtH(s.h)}</b>`;
      const del = document.createElement('button');
      del.textContent = '×'; del.setAttribute('aria-label', 'Supprimer cette session');
      del.onclick = () => {
        store.removeSession(s); refreshAll(true); renderMenu();
        toast('Session supprimée', 'Annuler', () => { store.data.sessions.push(s); store.data.sessions.sort((a, b) => Date.parse(a.t) - Date.parse(b.t)); store.save(); refreshAll(true); if (!$('menu').hidden) renderMenu(); });
      };
      li.appendChild(del);
      ul.appendChild(li);
    }
  }
  function setMenu(open) {
    $('menu').hidden = !open;
    if (open) { setPop(false); renderMenu(); }
  }
  $('menuBtn').onclick = () => { sfx('tap'); setMenu($('menu').hidden); };
  $('counter').onclick = () => { sfx('tap'); setMenu($('menu').hidden); };
  $('skySeg').onclick = (e) => {
    const m = e.target.dataset.sky;
    if (!m) return;
    store.data.settings.sky = m; store.save();
    api.setSky(m); renderMenu();
  };
  $('soundBtn').onclick = () => {
    const on = !store.data.settings.sound;
    store.data.settings.sound = on; store.save();
    setSound(on); if (on) sfx('tap');
    renderMenu();
  };
  $('exportBtn').onclick = async () => {
    const text = store.exportText(), name = `ma-montagne-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([text], name, { type: 'application/json' });
    renderMenu();
    // Sur iPad, la feuille de partage permet « Enregistrer dans Fichiers ».
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Ma Montagne' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name;
    body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast('Sauvegarde exportée', null, null, 2500);
  };
  $('importBtn').onclick = () => $('file').click();
  $('file').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const d = store.parseImport(await f.text());
    if (!d) { toast('Ce fichier n’est pas une sauvegarde Ma Montagne', null, null, 3500); return; }
    const h = d.sessions.reduce((a, s) => a + s.h, 0);
    if (!confirm(`Remplacer la progression actuelle par cette sauvegarde ?\n\n${fmtH(h)} · ${d.sessions.length} sessions · ${d.bought.length} améliorations`)) return;
    store.replace(d);
    location.reload();
  };

  // toucher la montagne referme ce qui est ouvert
  $('scene').addEventListener('pointerdown', () => { setPop(false); setMenu(false); });

  function refreshAll(animated) {
    refreshCounter(animated);
    refreshDot();
    if (body.classList.contains('shop')) renderShop(false);
  }
  refreshAll(false);
  $('hint').hidden = store.data.sessions.length > 0 || !!DEMO;
  return { toast, refreshAll };
}
