/* ==========================================================================
   Real Lanches · comportamento do site
   Sem bibliotecas. Movimento só com transform/opacity, molas com velocidade
   herdada nos gestos, e tudo respeita "reduzir movimento".
   ========================================================================== */
(() => {
  'use strict';

  const L = window.LOJA, CATS = window.CATEGORIAS, GR = window.GRUPOS;

  /* ------------------------------------------------------------ utilidades */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const mqMobile = matchMedia('(max-width: 767px)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const isMobile = () => mqMobile.matches;
  const reduce = () => mqReduce.matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mod = (n, m) => ((n % m) + m) % m;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const money = v => BRL.format(v);
  const short = v => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } }
  };
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffled(arr, seed = 7) { const r = rng(seed); const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  document.addEventListener('load', e => { const t = e.target; if (t.tagName === 'IMG' && t.classList.contains('lazy')) t.classList.add('is-loaded'); }, true);
  document.addEventListener('error', e => { const t = e.target; if (t.tagName === 'IMG') t.classList.add('is-loaded'); }, true);
  const markLoaded = (root = document) => $$('img.lazy', root).forEach(i => { if (i.complete && i.naturalWidth) i.classList.add('is-loaded'); });
  const imgTag = (src, alt = '', { lazy = true, cls = '' } = {}) => `<img class="lazy ${cls}" src="${esc(src)}" alt="${esc(alt)}" ${lazy ? 'loading="lazy"' : ''} decoding="async" draggable="false">`;

  /** Mola no estilo Apple (response em s, damping 1 = sem quicar). Começa do valor atual e herda velocidade. */
  function spring({ from, to, velocity = 0, response = 0.4, damping = 1, onUpdate, onComplete }) {
    const k = Math.pow((2 * Math.PI) / response, 2), c = (4 * Math.PI * damping) / response;
    let x = from, v = velocity, last = performance.now(), raf = 0, done = false;
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
      for (let i = 0; i < steps; i++) { const a = -k * (x - to) - c * v; v += a * h; x += v * h; }
      if (Math.abs(v) < 4 && Math.abs(x - to) < 0.4) { x = to; onUpdate(x); done = true; onComplete && onComplete(); return; }
      onUpdate(x); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return { stop() { cancelAnimationFrame(raf); }, get value() { return x; }, get velocity() { return v; }, get done() { return done; } };
  }
  const rubber = (o, d, c = 0.55) => (o * d * c) / (d + c * Math.abs(o));
  const project = (v, d = 0.998) => ((v / 1000) * d) / (1 - d);
  function velocityFrom(s, axis) {
    if (s.length < 2) return 0;
    const last = s[s.length - 1]; let first = s[0];
    for (let i = s.length - 1; i >= 0; i--) { if (last.t - s[i].t > 90) break; first = s[i]; }
    const dt = (last.t - first.t) / 1000;
    return dt > 0 ? (last[axis] - first[axis]) / dt : 0;
  }

  /* ---------------------------------------------------------------- dados */
  const ITEMS = new Map();
  CATS.forEach(c => c.itens.forEach(it => { it.cat = c; ITEMS.set(it.id, it); }));
  const ALL = [...ITEMS.values()];
  const WITH_IMG = ALL.filter(i => i.img);
  const groupsOf = it => (it.grupos || []).map(id => ({ id, ...GR[id] }));
  const needsChoice = it => groupsOf(it).some(g => g.obrigatorio);
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const PLUS = '<svg class="i-plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const CHECK = '<svg class="i-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
  const PLUS_S = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const CROWN = '<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M4 34 0 8l16 12L32 0l16 20L64 8l-4 26z"/><rect x="4" y="35" width="56" height="5" rx="2"/></svg>';
  const WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.3 14.8L2.4 21.6l4.7-1.2A9.7 9.7 0 1 0 12 2.2zm0 17.7c-1.5 0-2.9-.4-4.2-1.1l-.3-.2-2.8.7.8-2.7-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.5 2.5 0 0 0 1.7-1.2 2 2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z"/></svg>';
  // desenhos para itens que ainda não têm foto
  const GLYPH = {
    lanches: '<path d="M4 11a8 8 0 0 1 16 0z"/><path d="M3.5 14h17M4.5 17.5h15a0 0 0 0 1 0 0 2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z"/>',
    pasteis: '<path d="M3 15c0-5 4-8 9-8s9 3 9 8z"/><path d="M5 15l1 2M9 15l1 2M13 15l1 2M17 15l1 2"/>',
    doces: '<path d="M3 15c0-5 4-8 9-8s9 3 9 8z"/><circle cx="9" cy="11" r=".8"/><circle cx="14" cy="10" r=".8"/>',
    porcoes: '<path d="M6 10h12l-1.5 10h-9z"/><path d="M8 10V4M11 10V3M14 10V4M17 10V5"/>',
    acai: '<path d="M5 9h14l-1.6 11H6.6z"/><path d="M5 9c0-2.5 3-4 7-4s7 1.5 7 4"/><path d="M14 5l2-3"/>',
    bebidas: '<path d="M9 2h6M10 2v3.5c-2 1-3 2.6-3 5V21h10V10.5c0-2.4-1-4-3-5V2"/><path d="M7 13h10"/>',
    balas: '<rect x="7" y="8" width="10" height="8" rx="2"/><path d="M7 10 3 7v10l4-3M17 10l4-3v10l-4-3"/>'
  };
  const noimg = it => `<span class="noimg" aria-hidden="true"><svg viewBox="0 0 24 24">${GLYPH[it.cat.id] || GLYPH.lanches}</svg></span>`;
  const media = (it, opts) => (it.img ? imgTag(it.img, it.nome, opts) : noimg(it));
  const priceHTML = it => `${it.apartir ? '<small>a partir de</small>' : ''}R$ ${short(it.preco)}`;

  /* --------------------------------------------- textos da loja e horário */
  $$('[data-loja]').forEach(el => { const v = L[el.dataset.loja]; if (v != null) el.textContent = v; });
  $$('[data-loja-entrega]').forEach(el => { el.textContent = L.entrega[el.dataset.lojaEntrega] || ''; });
  const FOTO = { pastel: L.fotos.pasteis, lanche: L.fotos.lanche, acai: L.fotos.acai, fachada: L.fotos.fachada };
  $$('img[data-foto]').forEach(img => { img.classList.add('lazy'); img.src = FOTO[img.dataset.foto]; });
  $('#menuCount').textContent = ALL.length;
  const waLink = (text, num = L.whatsapp) => `https://wa.me/${num}?text=${encodeURIComponent(text)}`;

  const toMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const fmtH = h => { const [a, b] = h.split(':'); return `${+a}h${b !== '00' ? b : ''}`; };
  const fmtAte = h => (h === '00:00' ? 'meia-noite' : fmtH(h));
  const H = d => L.horarios[String(d)] || [];
  function statusAgora(now = new Date()) {
    const d = now.getDay(), m = now.getHours() * 60 + now.getMinutes();
    for (const [a, b] of H(d)) { const A = toMin(a); let B = toMin(b); if (B <= A) B += 1440; if (m >= A && m < B) return { aberto: true, txt: `Aberto até ${fmtAte(b)}` }; }
    for (const [a, b] of H((d + 6) % 7)) { const A = toMin(a), B = toMin(b); if (B <= A && m < B) return { aberto: true, txt: `Aberto até ${fmtAte(b)}` }; }
    for (const [a] of H(d)) if (toMin(a) > m) return { aberto: false, txt: `Abre hoje às ${fmtH(a)}` };
    for (let i = 1; i <= 7; i++) { const dd = (d + i) % 7, r = H(dd); if (r.length) return { aberto: false, txt: `Abre ${i === 1 ? 'amanhã' : DIAS[dd].toLowerCase()} às ${fmtH(r[0][0])}` }; }
    return { aberto: false, txt: 'Fechado' };
  }
  function pintaHorario() {
    const st = statusAgora(), el = $('#status');
    el.classList.toggle('is-open', st.aberto);
    el.querySelector('span').textContent = st.txt;
    const d = new Date().getDay(), hoje = H(d);
    $('#factHoje').textContent = hoje.length ? hoje.map(([a, b]) => `${fmtH(a)}–${fmtH(b)}`).join(' · ') : 'Fechado';
    $('#factHojeTxt').textContent = st.aberto ? 'aberto agora' : st.txt.toLowerCase();
    $('#hours').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(i => {
      const r = H(i);
      return `<li class="${i === d ? 'is-today' : ''}"><span>${DIAS[i]}${i === d ? ' · hoje' : ''}</span><span>${r.length ? r.map(([a, b]) => `${fmtH(a)} – ${fmtH(b)}`).join(', ') : 'Fechado'}</span></li>`;
    }).join('');
  }
  pintaHorario();
  setInterval(pintaHorario, 60000);

  /* ----------------------------------------------------------------- tema */
  const root = document.documentElement;
  root.dataset.theme = store.get('real-tema', 'dark');
  const metaTheme = () => { $('meta[name="theme-color"]').content = root.dataset.theme === 'dark' ? '#0E0C0C' : '#FBF4EC'; };
  metaTheme();
  $('#themeBtn').addEventListener('click', e => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => { root.dataset.theme = next; store.set('real-tema', next); metaTheme(); };
    if (!document.startViewTransition || reduce()) { apply(); return; }
    const r = e.currentTarget.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] }, { duration: 650, easing: EASE_IN_OUT, pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
  });

  /* ------------------------------------------- rolagem travada e camadas */
  let lockCount = 0;
  const lockScroll = () => { if (lockCount++ === 0) { const sw = innerWidth - root.clientWidth; document.body.style.paddingRight = sw ? `${sw}px` : ''; document.body.classList.add('is-locked'); } };
  const unlockScroll = () => { if (--lockCount <= 0) { lockCount = 0; document.body.classList.remove('is-locked'); document.body.style.paddingRight = ''; } };
  const layers = [];
  function pushLayer(entry) { entry.returnFocus = document.activeElement; layers.push(entry); try { history.pushState({ real: layers.length }, ''); } catch { /* ok */ } }
  function requestClose() {
    if (!layers.length) return;
    if (history.state && history.state.real === layers.length) {
      const n = layers.length;
      history.back();
      // se o navegador ignorar o "voltar", fecha direto
      setTimeout(() => { if (layers.length === n) { const l = layers.pop(); l.close(l); } }, 400);
    } else { const l = layers.pop(); l.close(l); }
  }
  addEventListener('popstate', e => { const depth = (e.state && e.state.real) || 0; while (layers.length > depth) { const l = layers.pop(); l.close(l); } });
  const restoreFocus = en => { const f = en && en.returnFocus; if (f && f.isConnected && f.focus) f.focus({ preventScroll: true }); };
  document.addEventListener('keydown', e => {
    if (!layers.length) return;
    if (e.key === 'Escape') { e.preventDefault(); requestClose(); return; }
    if (e.key === 'Tab') {
      const box = layers[layers.length - 1].el;
      const f = $$('button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])', box).filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('is-visible'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-visible'), 2400); }

  /* ================================================================ SACOLA */
  const cart = store.get('real-sacola', { linhas: [], modo: 'entrega', nome: '', cidade: 'Taubaté', bairro: '', endereco: '', pagamento: '', troco: '' });
  cart.linhas = (cart.linhas || []).filter(l => ITEMS.has(l.id));
  const lineKey = l => `${l.id}|${JSON.stringify(l.sel || {})}|${l.obs || ''}`;
  function unitPrice(l) {
    const it = ITEMS.get(l.id); let base = it.preco, add = 0;
    groupsOf(it).forEach(g => {
      const chosen = (l.sel && l.sel[g.id]) || [];
      chosen.forEach(name => { const o = g.opcoes.find(op => op[0] === name); if (!o) return; if (g.modo === 'preco') base = o[1]; else add += o[1]; });
    });
    return base + add;
  }
  const cartCount = () => cart.linhas.reduce((s, l) => s + l.qtd, 0);
  const cartSubtotal = () => cart.linhas.reduce((s, l) => s + unitPrice(l) * l.qtd, 0);
  const saveCart = () => store.set('real-sacola', cart);
  const feeFor = (cidade, bairro) => { const b = (L.cidadesEntrega[cidade] || []).find(x => x[0] === bairro); return b ? b[1] : null; };
  function addToCart(id, { qtd = 1, sel = {}, obs = '' } = {}) {
    const nova = { id, qtd, sel, obs: obs.trim() }, k = lineKey(nova);
    const ex = cart.linhas.find(l => lineKey(l) === k);
    if (ex) ex.qtd += qtd; else cart.linhas.push(nova);
    saveCart(); paintBadges(true);
    if (cartLayer.isOpen) renderCart();
  }
  function paintBadges(bump) {
    const n = cartCount();
    $('#bagCount').textContent = n; $('#cartbarCount').textContent = n;
    $('#cartbarTotal').textContent = money(cartSubtotal());
    $('#cartbar').classList.toggle('is-visible', n > 0);
    $('#bagBtn').setAttribute('aria-label', `Abrir sacola de pedido, ${n} ${n === 1 ? 'item' : 'itens'}`);
    if (bump && !reduce()) [$('#bagCount'), $('#cartbarCount')].forEach(el => el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 380, easing: EASE_OUT }));
  }
  function flyToBag(fromEl) {
    if (reduce() || !fromEl || fromEl.tagName !== 'IMG') return;
    const t = $('#bagBtn').getBoundingClientRect(), r = fromEl.getBoundingClientRect();
    if (!r.width) return;
    const outer = document.createElement('div');
    outer.style.cssText = 'position:fixed;left:0;top:0;z-index:250;pointer-events:none;';
    const img = document.createElement('img'); img.className = 'flyer'; img.src = fromEl.currentSrc || fromEl.src; img.alt = '';
    outer.appendChild(img); document.body.appendChild(outer);
    const x0 = r.left + r.width / 2 - 28, y0 = r.top + r.height / 2 - 28, x1 = t.left + t.width - 36, y1 = t.top + t.height / 2 - 28;
    outer.animate([{ transform: `translateX(${x0}px)` }, { transform: `translateX(${x1}px)` }], { duration: 640, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'forwards' });
    img.animate([{ transform: `translateY(${y0}px) scale(1.25)`, opacity: 0 }, { transform: `translateY(${y0 - 30}px) scale(1.1)`, opacity: 1, offset: 0.15 }, { transform: `translateY(${y1}px) scale(.35)`, opacity: .9 }],
      { duration: 640, easing: 'cubic-bezier(0.55, 0, 0.75, 0.2)', fill: 'forwards' }).onfinish = () => outer.remove();
  }
  function markAdded(btn) { if (!btn) return; btn.classList.add('is-added'); clearTimeout(btn._t); btn._t = setTimeout(() => btn.classList.remove('is-added'), 1300); }
  function quickAdd(id, btn, imgEl) {
    const it = ITEMS.get(id);
    if (needsChoice(it)) { openDetail(id, imgEl); return; }
    addToCart(id); markAdded(btn); flyToBag(imgEl); toast(`${it.nome} na sacola`);
  }

  /* ================================================================== HERO */
  function buildReel() {
    const local = L.galeriaLocal.map(([src, alt]) => ({ src, alt }));
    const prods = shuffled(WITH_IMG.filter(i => ['lanches', 'pasteis', 'acai', 'porcoes', 'doces'].includes(i.cat.id)), 5).slice(0, 18);
    const tiles = shuffled([...local.slice(0, 6), ...prods], 3);
    const cols = [[], []]; tiles.forEach((t, i) => cols[i % 2].push(t));
    const ars = ['4 / 5', '1 / 1', '3 / 4', '4 / 5', '5 / 6'];
    $('#reel').innerHTML = cols.map((col, c) => {
      const h = col.map((t, i) => {
        const ar = ars[(i + c * 2) % ars.length];
        return t.id
          ? `<button type="button" class="reel__tile" tabindex="-1" data-id="${t.id}" style="--ar:${ar}">${imgTag(t.img, '', { lazy: false })}<span>${esc(t.nome)}</span></button>`
          : `<div class="reel__tile" style="--ar:${ar}">${imgTag(t.src, '', { lazy: false })}</div>`;
      }).join('');
      return `<div class="reel__col" style="--dur:${c ? 58 : 50}s">${h}${h}</div>`;
    }).join('');
    markLoaded($('#reel'));
    $('#reel').addEventListener('click', e => { const t = e.target.closest('.reel__tile[data-id]'); if (t) openDetail(t.dataset.id, t.querySelector('img')); });
  }

  function playIntro() {
    if (reduce()) return;
    $$('.hero__title .ln').forEach((ln, i) => {
      ln.querySelectorAll('.w').forEach(w => w.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 900, delay: 80 + i * 110, easing: EASE_OUT, fill: 'backwards' }));
      ln.querySelectorAll('.chip').forEach(c => c.animate([{ transform: 'scale(.4) rotate(-12deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 380 + i * 120, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'backwards' }));
    });
    [$('.hero__eyebrow'), $('.hero__lead'), $('.hero__cta'), $('.hero__facts')].forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 240 + i * 80, easing: EASE_OUT, fill: 'backwards' }));
    $('.hero__poster').animate([{ opacity: 0, transform: 'translateY(30px) rotate(3deg)' }, { opacity: 1, transform: 'none' }], { duration: 1000, delay: 200, easing: EASE_OUT, fill: 'backwards' });
  }
  function runLoader() {
    const loader = $('#loader');
    let seen = false;
    try { seen = sessionStorage.getItem('real-abertura') === '1'; } catch { /* ok */ }
    if (reduce() || seen) { loader.classList.add('is-gone'); playIntro(); return; }
    const t0 = performance.now();
    Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(1400)]).then(() => {
      setTimeout(() => {
        loader.classList.add('is-done'); playIntro();
        setTimeout(() => loader.classList.add('is-gone'), 760);
        try { sessionStorage.setItem('real-abertura', '1'); } catch { /* ok */ }
      }, Math.max(0, 950 - (performance.now() - t0)));
    });
  }

  /* ----------------------------------------------- fitas cruzadas infinitas */
  function buildTapes() {
    const sets = {
      '1': ['Pastéis', 'Lanches', 'Açaí', 'Porções', 'Pastéis doces', 'Bebidas'],
      '-1': ['Entrega em Taubaté e Tremembé', 'Seg a sáb · 19h à 0h', 'Retirada no balcão', `★ ${L.nota} no Google`]
    };
    const tracks = $$('.tape__track').map(track => {
      const dir = Number(track.dataset.tape);
      const g = `<div class="tape__group">${sets[track.dataset.tape].map(w => `<span class="tape__item">${esc(w)}${CROWN}</span>`).join('')}</div>`;
      track.innerHTML = g + g + g;
      return { track, dir, x: 0, w: track.firstElementChild.offsetWidth };
    });
    if (reduce()) return;
    const ro = new ResizeObserver(() => tracks.forEach(t => { t.w = t.track.firstElementChild.offsetWidth; }));
    tracks.forEach(t => ro.observe(t.track.firstElementChild));
    let visible = true, last = performance.now(), lastY = scrollY, vel = 0, sdir = 1;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe($('.tapes'));
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const dy = scrollY - lastY; lastY = scrollY;
      if (dy) sdir = dy > 0 ? 1 : -1;
      vel += (Math.min(Math.abs(dy) / Math.max(dt, 0.001), 3000) - vel) * Math.min(1, dt * 6);
      if (visible) tracks.forEach(t => { t.x = mod(t.x + t.dir * sdir * (60 + vel * 0.25) * dt, t.w); t.track.style.transform = `translate3d(${-t.x}px,0,0)`; });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ============================================= DESTAQUES (carrossel infinito) */
  function buildFavs() {
    const favs = ALL.filter(i => i.destaque && i.img);
    const n = favs.length;
    const card = (it, hidden, i) => `
      <article class="fav ${i % 3 === 1 ? 'fav--tilt2' : i % 3 === 2 ? 'fav--tilt' : ''}" role="listitem" data-id="${it.id}" ${hidden ? 'aria-hidden="true"' : ''}>
        <div class="fav__media">${imgTag(it.img, it.nome)}<span class="fav__price">${it.apartir ? 'a partir de ' : ''}R$ ${short(it.preco)}</span></div>
        <button type="button" class="fav__open" ${hidden ? 'tabindex="-1"' : ''} aria-label="Ver ${esc(it.nome)}"></button>
        <div class="fav__body"><div><h3 class="fav__name">${esc(it.nome)}</h3><p class="fav__cat">${esc(it.cat.nome)}</p></div>
          <button type="button" class="add-btn" ${hidden ? 'tabindex="-1"' : ''} aria-label="Adicionar ${esc(it.nome)}">${PLUS}${CHECK}</button></div>
      </article>`;
    const track = $('#favTrack'), vp = $('#favViewport');
    track.innerHTML = [true, false, true].map(h => favs.map((it, i) => card(it, h, i)).join('')).join('');
    markLoaded(track);
    let setW = 0, step = 0, x = 0, anim = null, drag = null, hovering = false, visible = false, dragged = false, resumeAt = 0, last = performance.now();
    const measure = () => { const c = track.children; setW = c[n].offsetLeft - c[0].offsetLeft; step = c[1].offsetLeft - c[0].offsetLeft; };
    measure(); new ResizeObserver(measure).observe(vp);
    const render = () => { track.style.transform = `translate3d(${mod(x, setW) - setW}px,0,0)`; };
    render();
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(vp);
    vp.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hovering = true; });
    vp.addEventListener('pointerleave', () => { hovering = false; });
    const loop = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (visible && !drag && (!anim || anim.done) && !hovering && !reduce() && now > resumeAt) { x -= 30 * dt; render(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    const goTo = (target, velocity = 0) => {
      const from = anim && !anim.done ? anim.value : x, v = anim && !anim.done ? anim.velocity : velocity;
      anim && anim.stop();
      if (reduce()) { x = target; render(); return; }
      anim = spring({ from, to: target, velocity: velocity || v, response: 0.5, damping: 1, onUpdate: val => { x = val; render(); } });
      resumeAt = performance.now() + 3500;
    };
    const snap = v => Math.round(v / step) * step;
    $('#favPrev').addEventListener('click', () => goTo(snap(anim && !anim.done ? anim.value : x) + step));
    $('#favNext').addEventListener('click', () => goTo(snap(anim && !anim.done ? anim.value : x) - step));
    vp.addEventListener('pointerdown', e => { if (e.button !== 0) return; if (anim) { anim.stop(); anim = null; } drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: x, active: false, s: [{ t: e.timeStamp, x: e.clientX }] }; dragged = false; });
    vp.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.active) { if (Math.abs(dx) < 8) { if (Math.abs(dy) > 10) drag = null; return; } drag.active = true; dragged = true; drag.sx = e.clientX; drag.x0 = x; vp.setPointerCapture(e.pointerId); vp.classList.add('is-dragging'); }
      x = drag.x0 + (e.clientX - drag.sx); render();
      drag.s.push({ t: e.timeStamp, x: e.clientX }); if (drag.s.length > 8) drag.s.shift();
    });
    const end = e => { if (!drag || e.pointerId !== drag.id) return; if (drag.active) { const v = clamp(velocityFrom(drag.s, 'x'), -4000, 4000); goTo(snap(x + project(v)), v); } drag = null; vp.classList.remove('is-dragging'); };
    vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
    vp.addEventListener('click', e => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
    vp.addEventListener('click', e => {
      const f = e.target.closest('.fav'); if (!f) return;
      const img = f.querySelector('.fav__media img'), add = e.target.closest('.add-btn');
      if (add) quickAdd(f.dataset.id, add, img); else if (e.target.closest('.fav__open')) openDetail(f.dataset.id, img);
    });
    track.addEventListener('focusin', e => {
      const f = e.target.closest('.fav'); if (!f) return;
      const left = f.offsetLeft + (mod(x, setW) - setW), vw = vp.clientWidth;
      if (left < 16) goTo(x + (16 - left)); else if (left + f.offsetWidth > vw - 16) goTo(x - (left + f.offsetWidth - vw + 16));
    });
  }

  /* --------------------------------------------------------- Real Salgado */
  function buildSpot() {
    const it = ITEMS.get('real-salgado');
    if (!it) { $('#spot').remove(); return; }
    const fill = it.desc.replace(/\.$/, '').split(/,\s*|\s+e\s+/).map(s => s.trim()).filter(Boolean);
    $('#spot').innerHTML = `
      <div class="spot__card reveal">
        <div class="spot__media">${media(it)}</div>
        <div class="spot__body">
          <span class="spot__kicker">Especial do cardápio</span>
          <h2 class="spot__title" id="spotTitle">${esc(it.nome)}<small>${fill.length} recheios num pastel só</small></h2>
          <div class="spot__fill">${fill.map(f => `<span>${esc(f[0].toUpperCase() + f.slice(1))}</span>`).join('')}</div>
          <div class="spot__row"><span class="spot__price">R$ ${short(it.preco)}</span>
            <button type="button" class="btn btn--gold" data-spot-add>Quero esse ${PLUS_S.replace('<svg', '<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round"')}</button></div>
        </div>
      </div>`;
    markLoaded($('#spot'));
    $('[data-spot-add]').addEventListener('click', e => quickAdd(it.id, null, $('#spot img')) || e.currentTarget.blur());
  }

  /* ================================================================ MENU */
  const FILTROS = [
    { k: 'bacon', label: 'Bacon', t: ['bacon'] }, { k: 'frango', label: 'Frango', t: ['frango', 'galinhao'] },
    { k: 'calabresa', label: 'Calabresa', t: ['calabresa', 'linguica'] }, { k: 'catupiry', label: 'Catupiry', t: ['catupiry'] },
    { k: 'cheddar', label: 'Cheddar', t: ['cheddar'] }, { k: 'ovo', label: 'Ovo', t: ['egg', 'ovo'] },
    { k: 'queijo', label: 'Queijo', t: ['queijo', 'x-', 'mussarela'] }, { k: 'ate25', label: 'Até R$ 25', p: 25 }
  ];
  const state = { filtros: new Set(), busca: '' };
  const searchText = it => norm(`${it.nome} ${it.desc} ${it.cat.nome} ${it.sub || ''}`);

  function itemHTML(it, i) {
    return `
      <article class="item reveal" data-id="${it.id}" style="--d:${(i % 2) * 60}ms">
        <button type="button" class="item__open" aria-label="Ver ${esc(it.nome)}, ${it.apartir ? 'a partir de ' : ''}${money(it.preco)}"></button>
        <div class="item__media">${media(it)}</div>
        <div class="item__body">
          <h4 class="item__name">${esc(it.nome)}</h4>
          ${it.desc ? `<p class="item__desc">${esc(it.desc)}</p>` : ''}
          <span class="item__price">${priceHTML(it)}</span>
        </div>
        ${it.destaque ? '<span class="badge">Destaque</span>' : ''}
        <button type="button" class="add-btn" aria-label="Adicionar ${esc(it.nome)}">${PLUS}${CHECK}</button>
      </article>`;
  }
  function legendHTML(cat) {
    const freq = {};
    cat.itens.forEach(it => groupsOf(it).filter(g => g.modo === 'preco').forEach(g => g.opcoes.forEach(([n, p]) => { const k = n.toLowerCase(); (freq[k] = freq[k] || {})[p] = (freq[k][p] || 0) + 1; })));
    const ks = Object.keys(freq); if (!ks.length) return '';
    const comum = k => Number(Object.entries(freq[k]).sort((a, b) => b[1] - a[1])[0][0]);
    return `<div class="legend"><b>Tamanhos</b>${ks.map(k => `<div><span>${esc(k)}</span><span>R$ ${short(comum(k))}</span></div>`).join('')}<p class="small">Preço da maioria dos sabores. Os especiais variam.</p></div>`;
  }
  function buildMenu() {
    $('#filters').innerHTML = FILTROS.map(f => `<button type="button" class="chip-f" aria-pressed="false" data-f="${f.k}">${f.label}</button>`).join('');
    $('#menuSections').innerHTML = CATS.map((cat, ci) => {
      let body = '', lastSub = null, idx = 0;
      cat.itens.forEach(it => {
        if (it.sub && it.sub !== lastSub) {
          lastSub = it.sub;
          const n = cat.itens.filter(x => x.sub === it.sub).length;
          body += `<div class="sub" data-sub="${esc(it.sub)}"><h4>${esc(it.sub)}</h4><span>${n} sabores</span></div>`;
        }
        body += itemHTML(it, idx++);
      });
      return `
        <section class="cat" id="cat-${cat.id}" data-cat="${cat.id}" aria-labelledby="t-${cat.id}">
          <header class="cat__head reveal">
            <span class="cat__num">${String(ci + 1).padStart(2, '0')} / ${String(CATS.length).padStart(2, '0')}</span>
            <h3 class="cat__title" id="t-${cat.id}">${esc(cat.nome)}</h3>
            <p class="cat__desc">${esc(cat.desc)}</p>
            <span class="cat__count" data-count>${cat.itens.length} opções</span>
            ${legendHTML(cat)}
          </header>
          <div class="cat__grid">${body}</div>
        </section>`;
    }).join('');
    const tabs = CATS.map(c => `<li><button type="button" class="tab" data-cat="${c.id}">${esc(c.curto)} <sup>${c.itens.length}</sup></button></li>`).join('');
    $('#tabsList').innerHTML = tabs; $('#tabsActive').innerHTML = tabs;
    markLoaded($('#menuSections'));

    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach(el => io.observe(el));

    $('#menuSections').addEventListener('click', e => {
      const card = e.target.closest('.item'); if (!card) return;
      const img = card.querySelector('.item__media img'), add = e.target.closest('.add-btn');
      if (add) quickAdd(card.dataset.id, add, img); else if (e.target.closest('.item__open')) openDetail(card.dataset.id, img);
    });
    $('#filters').addEventListener('click', e => {
      const b = e.target.closest('.chip-f'); if (!b) return;
      const k = b.dataset.f; state.filtros.has(k) ? state.filtros.delete(k) : state.filtros.add(k);
      b.setAttribute('aria-pressed', state.filtros.has(k)); applyFilters();
    });
    const search = $('#search'), box = $('#searchBox');
    let deb = 0;
    search.addEventListener('input', () => { box.classList.toggle('has-value', !!search.value); clearTimeout(deb); deb = setTimeout(() => { state.busca = search.value; applyFilters(); }, 120); });
    search.addEventListener('focus', () => box.classList.add('is-open'));
    search.addEventListener('blur', () => { if (!search.value) box.classList.remove('is-open'); });
    $('#searchClear').addEventListener('click', () => { search.value = ''; box.classList.remove('has-value'); state.busca = ''; applyFilters(); search.focus(); });
    $('#emptyReset').addEventListener('click', () => { search.value = ''; box.classList.remove('has-value', 'is-open'); state.busca = ''; state.filtros.clear(); $$('.chip-f').forEach(c => c.setAttribute('aria-pressed', 'false')); applyFilters(); });
  }
  function applyFilters() {
    const q = norm(state.busca.trim()).split(/\s+/).filter(Boolean);
    let total = 0;
    CATS.forEach(cat => {
      let count = 0;
      cat.itens.forEach(it => {
        const txt = searchText(it);
        const okF = [...state.filtros].every(k => { const f = FILTROS.find(x => x.k === k); return f.p ? it.preco <= f.p : f.t.some(w => txt.includes(w)); });
        const okQ = q.every(w => txt.includes(w));
        const show = okF && okQ;
        const el = $(`.item[data-id="${it.id}"]`); el.hidden = !show;
        if (show) { count++; el.classList.add('is-in'); }
      });
      const sec = $(`#cat-${cat.id}`);
      sec.hidden = !count;
      sec.querySelector('[data-count]').textContent = `${count} ${count === 1 ? 'opção' : 'opções'}`;
      $$('.sub', sec).forEach(s => { s.hidden = !cat.itens.some(it => it.sub === s.dataset.sub && !$(`.item[data-id="${it.id}"]`).hidden); });
      $$(`.tab[data-cat="${cat.id}"] sup`).forEach(s => { s.textContent = count; });
      $$(`.tab[data-cat="${cat.id}"]`).forEach(t => { t.style.opacity = count ? '' : '.4'; });
      total += count;
    });
    $('#empty').hidden = total > 0;
    const top = $('#menuSections').getBoundingClientRect().top + scrollY - offsetTop();
    if (scrollY > top) scrollTo({ top, behavior: 'instant' });
    spy();
  }

  /* --------------------------------------- abas com indicador por clip-path */
  const offsetTop = () => $('#topbar').offsetHeight + $('#menubar').offsetHeight;
  let activeCat = null, spyLock = 0;
  function setActiveTab(id, scrollTabs = true) {
    if (id === activeCat) return;
    activeCat = id;
    const list = $('#tabsList'), btn = list.querySelector(`.tab[data-cat="${id}"]`); if (!btn) return;
    const W = list.offsetWidth, Hh = list.offsetHeight, top = (Hh - btn.offsetHeight) / 2;
    $('#tabsActive').style.clipPath = `inset(${top}px ${W - (btn.offsetLeft + btn.offsetWidth)}px ${top}px ${btn.offsetLeft}px round 999px)`;
    $$('.tab', list).forEach(t => t.setAttribute('aria-current', t === btn ? 'true' : 'false'));
    if (scrollTabs) { const sc = $('#tabsScroller'); sc.scrollTo({ left: Math.max(0, btn.offsetLeft - sc.clientWidth / 2 + btn.offsetWidth / 2), behavior: reduce() ? 'auto' : 'smooth' }); }
  }
  function spy() {
    if (performance.now() < spyLock) return;
    const line = offsetTop() + 80; let cur = null;
    $$('.cat:not([hidden])').forEach(s => { if (s.getBoundingClientRect().top <= line) cur = s.dataset.cat; });
    if (!cur) { const f = $('.cat:not([hidden])'); cur = f && f.dataset.cat; }
    if (cur) setActiveTab(cur);
  }
  function bindTabs() {
    $('#tabsList').addEventListener('click', e => {
      const b = e.target.closest('.tab'); if (!b) return;
      const sec = $(`#cat-${b.dataset.cat}`); if (!sec || sec.hidden) return;
      setActiveTab(b.dataset.cat); spyLock = performance.now() + 1000;
      scrollTo({ top: sec.getBoundingClientRect().top + scrollY - offsetTop() + 1, behavior: reduce() ? 'auto' : 'smooth' });
    });
    const refresh = () => { const a = activeCat; activeCat = null; setActiveTab(a || CATS[0].id, false); };
    addEventListener('resize', refresh);
    if (document.fonts) document.fonts.ready.then(refresh);
  }
  function bindScroll() {
    const topbar = $('#topbar'); let ticking = false;
    const on = () => { ticking = false; topbar.classList.toggle('is-scrolled', scrollY > 8); spy(); };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(on); } }, { passive: true });
    on();
  }

  /* ============================================ folha arrastável (celular) */
  function createSheet(panel, layer, { scroller }) {
    const scrim = layer.querySelector('.scrim');
    let y = 0, h = 1, anim = null, drag = null;
    const set = v => { y = v; panel.style.transform = `translateY(${v}px)`; scrim.style.opacity = String(clamp(1 - v / h, 0, 1)); };
    const api = {
      open() { h = panel.offsetHeight || innerHeight; scrim.style.transition = 'none'; anim && anim.stop(); if (reduce()) { set(0); panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }); return; } set(h); anim = spring({ from: h, to: 0, response: 0.45, damping: 1, onUpdate: set }); },
      close(done, velocity = 0) { h = panel.offsetHeight || innerHeight; anim && anim.stop(); if (reduce()) { panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).onfinish = done; return; } anim = spring({ from: y, to: h + 20, velocity, response: 0.34, damping: 1, onUpdate: set, onComplete: done }); },
      reset() { anim && anim.stop(); panel.style.transform = ''; scrim.style.opacity = ''; scrim.style.transition = ''; y = 0; }
    };
    const start = (cy, cx, t, id, inS) => { drag = { id, sy: cy, sx: cx, y0: y, active: false, inS, s: [{ t, y: cy }] }; };
    const move = (cy, cx, t) => {
      if (!drag) return false;
      const dy = cy - drag.sy, dx = cx - drag.sx;
      if (!drag.active) {
        if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return false;
        if (Math.abs(dx) > Math.abs(dy) || (drag.inS && dy < 0)) { drag = null; return false; }
        drag.active = true; anim && anim.stop(); drag.y0 = y; drag.sy = cy; h = panel.offsetHeight;
      }
      let ny = drag.y0 + (cy - drag.sy); if (ny < 0) ny = -rubber(-ny, h);
      set(ny); drag.s.push({ t, y: cy }); if (drag.s.length > 8) drag.s.shift();
      return true;
    };
    const end = () => {
      if (!drag) return;
      if (drag.active) { const v = velocityFrom(drag.s, 'y'); if (y > h * 0.3 || v > 650) { layer._v = Math.max(v, 0); requestClose(); } else anim = spring({ from: y, to: 0, velocity: v, response: 0.38, damping: 0.86, onUpdate: set }); }
      drag = null;
    };
    panel.addEventListener('pointerdown', e => {
      if (!isMobile() || (e.pointerType === 'touch' && scroller && scroller.contains(e.target))) return;
      if (e.button !== 0 || e.target.closest('button, input, textarea, label, a, select')) return;
      start(e.clientY, e.clientX, e.timeStamp, e.pointerId, scroller && scroller.contains(e.target) && scroller.scrollTop > 0);
      if (drag && drag.inS) drag = null;
    });
    panel.addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const was = drag.active; if (move(e.clientY, e.clientX, e.timeStamp) && !was) { try { panel.setPointerCapture(e.pointerId); } catch { /* ok */ } } });
    panel.addEventListener('pointerup', e => { if (drag && drag.id === e.pointerId) end(); });
    panel.addEventListener('pointercancel', e => { if (drag && drag.id === e.pointerId) end(); });
    if (scroller) {
      scroller.addEventListener('touchstart', e => { if (!isMobile() || e.touches.length > 1 || e.target.closest('input, textarea, button, label, select')) return; const t = e.touches[0]; if (scroller.scrollTop <= 0) start(t.clientY, t.clientX, e.timeStamp, 'touch', true); }, { passive: true });
      scroller.addEventListener('touchmove', e => { if (!drag || drag.id !== 'touch') return; const t = e.touches[0]; if ((t.clientY - drag.sy > 0 || drag.active) && scroller.scrollTop <= 0 && e.cancelable) e.preventDefault(); move(t.clientY, t.clientX, e.timeStamp); }, { passive: false });
      scroller.addEventListener('touchend', () => { if (drag && drag.id === 'touch') end(); });
      scroller.addEventListener('touchcancel', () => { if (drag && drag.id === 'touch') end(); });
    }
    return api;
  }

  /* ========================================== DETALHE (monte do seu jeito) */
  const detailLayer = $('#detailLayer'), detail = $('#detail'), detailMedia = $('#detailMedia'), detailBody = $('#detailBody');
  const detailSheet = createSheet(detail, detailLayer, { scroller: detailBody });
  let ds = null; // estado do detalhe aberto

  function groupHTML(g, gi) {
    const id = `g${gi}`;
    if (g.tipo === 'unico') {
      return `<fieldset class="grp" data-g="${g.id}"><legend><span>${esc(g.titulo)}</span>${g.obrigatorio ? '<em class="req">obrigatório</em>' : ''}</legend>
        <div class="pills">${g.opcoes.map(([n, p], i) => `<label class="pill"><input type="radio" name="${id}" value="${esc(n)}" ${g.obrigatorio && i === 0 ? 'checked' : ''}><span>${esc(n)}${p ? ` <b>${g.modo === 'preco' ? '' : '+'}R$ ${short(p)}</b>` : ''}</span></label>`).join('')}</div></fieldset>`;
    }
    const free = g.opcoes.filter(o => !o[1]), paid = g.opcoes.filter(o => o[1]);
    const LIM = 8;
    return `<fieldset class="grp" data-g="${g.id}" data-max="${g.max || ''}"><legend><span>${esc(g.titulo)}</span><em data-counter>${g.max ? `0 de ${g.max}` : 'opcional'}</em></legend>
      ${free.length ? `<div class="pills">${free.map(([n]) => `<label class="pill"><input type="checkbox" name="${id}" value="${esc(n)}"><span>${esc(n)}</span></label>`).join('')}</div>` : ''}
      ${paid.length ? `<div class="checks">${paid.map(([n, p], i) => `<label class="check" ${i >= LIM ? 'data-extra hidden' : ''}><input type="checkbox" name="${id}" value="${esc(n)}"><span class="check__name">${esc(n)}</span><span class="check__price">+ R$ ${short(p)}</span></label>`).join('')}</div>
      ${paid.length > LIM ? `<button type="button" class="more-btn" data-more>Ver mais ${paid.length - LIM} opções</button>` : ''}` : ''}
    </fieldset>`;
  }
  function detailHTML(it) {
    const gs = groupsOf(it);
    return `
      <div class="detail__content">
        <span class="detail__cat">${esc(it.cat.nome)}${it.sub ? ` · ${esc(it.sub)}` : ''}</span>
        <h2 class="detail__name" id="detailName">${esc(it.nome)}</h2>
        ${it.desc ? `<p class="detail__desc">${esc(it.desc)}</p>` : ''}
        <p class="detail__price">${priceHTML(it)}</p>
        ${gs.map(groupHTML).join('')}
        <label class="note"><span>Alguma observação?</span><textarea name="obs" rows="2" maxlength="140" placeholder="Ex.: bem passado, sem cebola"></textarea></label>
      </div>
      <div class="detail__foot">
        <div class="stepper" role="group" aria-label="Quantidade">
          <button type="button" data-step="-1" aria-label="Diminuir quantidade" disabled>${MINUS}</button><output aria-live="polite">1</output><button type="button" data-step="1" aria-label="Aumentar quantidade">${PLUS_S}</button>
        </div>
        <button type="button" class="btn btn--red" data-add><span>Adicionar</span><span data-total></span></button>
      </div>`;
  }
  function readSel() {
    const it = ITEMS.get(ds.id), sel = {};
    groupsOf(it).forEach((g, gi) => { const v = $$(`input[name="g${gi}"]:checked`, detailBody).map(i => i.value); if (v.length) sel[g.id] = v; });
    return sel;
  }
  function paintDetail() {
    const it = ITEMS.get(ds.id), sel = readSel();
    const total = unitPrice({ id: it.id, sel }) * ds.qtd;
    detailBody.querySelector('[data-total]').textContent = money(total);
    detailBody.querySelector('output').textContent = ds.qtd;
    detailBody.querySelector('[data-step="-1"]').disabled = ds.qtd <= 1;
    $$('.grp[data-max]', detailBody).forEach(f => {
      const max = Number(f.dataset.max) || 0, n = $$('input:checked', f).length;
      const c = f.querySelector('[data-counter]'); if (c && max) c.textContent = `${n} de ${max}`;
      if (max) $$('input', f).forEach(i => { i.disabled = !i.checked && n >= max; });
    });
  }
  function openDetail(id, originImg) {
    const it = ITEMS.get(id);
    if (!it || ds) return;
    ds = { id, qtd: 1, origin: originImg && originImg.tagName === 'IMG' ? originImg : null, at: performance.now() };
    detailBody.innerHTML = detailHTML(it); detailBody.scrollTop = 0;
    detailMedia.innerHTML = it.img ? `<img class="bgimg" src="${esc(it.img)}" alt="" aria-hidden="true"><img id="detailImg" class="fgimg" src="${esc(it.img)}" alt="${esc(it.nome)}">` : noimg(it);
    paintDetail();
    detailLayer.hidden = false; lockScroll();
    pushLayer({ el: detail, close: closeDetailNow });
    if (isMobile()) { detailLayer.classList.add('is-open'); detailSheet.open(); }
    else if (ds.origin && !reduce() && ds.origin.getBoundingClientRect().width > 0) flipOpen(ds.origin);
    else { detail.offsetWidth; detailLayer.classList.add('is-open'); }
    requestAnimationFrame(() => detail.focus({ preventScroll: true }));
  }
  function radiusOf(el) { for (let n = el, i = 0; n && i < 4; n = n.parentElement, i++) { const cs = getComputedStyle(n); if (cs.borderTopLeftRadius !== '0px') return cs.borderRadius; } return '16px'; }
  function makeClone(r, src, rad) {
    const c = document.createElement('div');
    c.style.cssText = `position:fixed;z-index:150;overflow:hidden;pointer-events:none;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${rad};background:var(--img-bg)`;
    const im = document.createElement('img'); im.src = src; im.alt = ''; im.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    c.appendChild(im); document.body.appendChild(c); return c;
  }
  // área onde a foto aparece de fato (object-fit: contain) dentro do quadro do detalhe
  function containRect(box, nw, nh) {
    if (!nw || !nh) return box;
    const r = nw / nh; let w = box.width, h = box.height;
    if (w / h > r) w = h * r; else h = w / r;
    return { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w, height: h };
  }
  const rectKF = (r, rad) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: rad });
  function flipOpen(o) {
    detailLayer.classList.add('is-flip', 'is-open');
    const to = containRect(detailMedia.getBoundingClientRect(), o.naturalWidth, o.naturalHeight), from = o.getBoundingClientRect(), rad = radiusOf(o);
    const clone = makeClone(from, o.currentSrc || o.src, rad), di = $('#detailImg');
    if (di) di.style.opacity = '0';
    o.style.visibility = 'hidden';
    clone.animate([rectKF(from, rad), rectKF(to, '6px')], { duration: 520, easing: EASE_DRAWER, fill: 'forwards' }).onfinish = () => { if (di) di.style.opacity = ''; clone.remove(); o.style.visibility = ''; };
    detail.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    detailBody.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 120, easing: EASE_OUT, fill: 'backwards' });
  }
  function closeDetailNow(entry) {
    if (!ds) return;
    const st = ds; ds = null;
    const finish = () => { detailLayer.hidden = true; detailLayer.classList.remove('is-open', 'is-flip'); detailSheet.reset(); unlockScroll(); };
    restoreFocus(entry);
    if (isMobile()) { detailLayer.classList.remove('is-open'); const v = detailLayer._v || 0; detailLayer._v = 0; detailSheet.close(finish, v); return; }
    const o = st.origin, r = o && o.isConnected ? o.getBoundingClientRect() : null;
    const onScreen = r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    const di = $('#detailImg');
    if (onScreen && di && !reduce()) {
      const from = containRect(detailMedia.getBoundingClientRect(), di.naturalWidth, di.naturalHeight), rad = radiusOf(o);
      const clone = makeClone(from, di.currentSrc || di.src, '6px');
      di.style.opacity = '0'; o.style.visibility = 'hidden';
      detailLayer.classList.remove('is-open');
      detail.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
      clone.animate([rectKF(from, '6px'), rectKF(r, rad)], { duration: 420, easing: EASE_DRAWER, fill: 'forwards' }).onfinish = () => { o.style.visibility = ''; clone.remove(); detail.getAnimations().forEach(a => a.cancel()); finish(); };
    } else { detailLayer.classList.remove('is-flip', 'is-open'); setTimeout(finish, 260); }
  }
  detailLayer.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { requestClose(); return; }
    if (!ds) return;
    const more = e.target.closest('[data-more]');
    if (more) { $$('[data-extra]', more.closest('.grp')).forEach(x => { x.hidden = false; }); more.remove(); return; }
    const step = e.target.closest('[data-step]');
    if (step) { ds.qtd = clamp(ds.qtd + Number(step.dataset.step), 1, 30); paintDetail(); return; }
    if (e.target.closest('[data-add]') && performance.now() - ds.at > 400) {
      const it = ITEMS.get(ds.id), sel = readSel(), obs = (detailBody.querySelector('textarea') || {}).value || '', qtd = ds.qtd;
      addToCart(it.id, { qtd, sel, obs });
      flyToBag($('#detailImg'));
      toast(`${qtd > 1 ? qtd + '× ' : ''}${it.nome} na sacola`);
      requestClose();
    }
  });
  detailLayer.addEventListener('change', () => { if (ds) paintDetail(); });

  /* ============================================================ SACOLA (UI) */
  const cartLayer = $('#cartLayer'), cartEl = $('#cart'), cartBody = $('#cartBody'), cartFoot = $('#cartFoot');
  const cartSheet = createSheet(cartEl, cartLayer, { scroller: cartBody });
  cartLayer.isOpen = false;
  const selText = l => { const it = ITEMS.get(l.id); return groupsOf(it).flatMap(g => ((l.sel || {})[g.id] || []).map(n => { const o = g.opcoes.find(x => x[0] === n); return g.tipo === 'multi' && o && o[1] ? `+ ${n}` : n; })); };
  function renderCart() {
    if (!cartCount()) {
      cartBody.innerHTML = `<div class="cart-empty"><strong>Sacola vazia</strong><p>Toque no + de qualquer item para começar.</p></div>`;
      cartFoot.innerHTML = '<button type="button" class="btn btn--red btn--block" data-close>Ver cardápio</button>';
      return;
    }
    cartBody.innerHTML = cart.linhas.map((l, i) => {
      const it = ITEMS.get(l.id), extra = [...selText(l), l.obs ? `“${l.obs}”` : ''].filter(Boolean).map(esc).join(' · ');
      return `<div class="cline" data-i="${i}">
        <div class="cline__img">${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : noimg(it)}</div>
        <div><div class="cline__top"><span class="cline__name">${esc(it.nome)}</span><span class="cline__price">${money(unitPrice(l) * l.qtd)}</span></div>
          ${extra ? `<p class="cline__extra">${extra}</p>` : ''}
          <div class="cline__row"><div class="stepper stepper--sm" role="group" aria-label="Quantidade de ${esc(it.nome)}"><button type="button" data-q="-1" aria-label="Diminuir">${MINUS}</button><output>${l.qtd}</output><button type="button" data-q="1" aria-label="Aumentar">${PLUS_S}</button></div>
          <button type="button" class="cline__rm" data-rm>Remover</button></div></div></div>`;
    }).join('');
    const cidades = Object.keys(L.cidadesEntrega);
    const bairros = L.cidadesEntrega[cart.cidade] || [];
    const fee = cart.modo === 'entrega' ? feeFor(cart.cidade, cart.bairro) : 0;
    const sub = cartSubtotal();
    cartFoot.innerHTML = `
      <div class="seg" role="radiogroup" aria-label="Como você vai receber">
        ${[['entrega', 'Entrega'], ['retirar', 'Retirar'], ['local', 'Comer aqui']].map(([v, t]) => `<label><input type="radio" name="modo" value="${v}" ${cart.modo === v ? 'checked' : ''}><span>${t}</span></label>`).join('')}
      </div>
      ${cart.modo === 'entrega' ? `
        <div class="duo">
          <label class="field"><span>Cidade</span><select name="cidade">${cidades.map(c => `<option ${c === cart.cidade ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label class="field"><span>Bairro</span><select name="bairro"><option value="">Escolha</option>${bairros.map(([b, v]) => `<option value="${esc(b)}" ${b === cart.bairro ? 'selected' : ''}>${esc(b)} · R$ ${short(v)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Endereço</span><input name="endereco" value="${esc(cart.endereco)}" placeholder="Rua, número e complemento" autocomplete="street-address"></label>` : ''}
      <div class="duo">
        <label class="field"><span>Seu nome</span><input name="nome" value="${esc(cart.nome)}" placeholder="Como te chamamos?" autocomplete="given-name"></label>
        <label class="field"><span>Pagamento</span><select name="pagamento"><option value="">Escolha</option>${L.pagamentos.map(p => `<option ${p === cart.pagamento ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      </div>
      ${/dinheiro/i.test(cart.pagamento) ? `<label class="field"><span>Troco para quanto?</span><input name="troco" inputmode="decimal" value="${esc(cart.troco)}" placeholder="Ex.: 100"></label>` : ''}
      <div class="totals">
        <div><span>Subtotal</span><span>${money(sub)}</span></div>
        ${cart.modo === 'entrega' ? `<div><span>Entrega${cart.bairro ? ` (${esc(cart.bairro)})` : ''}</span><span>${fee != null && cart.bairro ? money(fee) : 'escolha o bairro'}</span></div>` : ''}
        <div><span>Total</span><span>${money(sub + (fee || 0))}</span></div>
      </div>
      ${L.pedidoPor === 'app'
        ? `<a class="btn btn--red btn--block" href="${esc(L.pedidosOnline)}" target="_blank" rel="noopener">Finalizar no app da loja</a>
           <p class="alt-link">No app você escolhe os mesmos itens e paga do jeito que preferir. Ou <a data-send href="${esc(waLink(mensagem()))}" target="_blank" rel="noopener">envie esta lista no WhatsApp</a>.</p>`
        : `<a class="btn btn--wa btn--block" data-send href="${esc(waLink(mensagem()))}" target="_blank" rel="noopener">${WA} Enviar pedido no WhatsApp</a>
           <p class="alt-link">Prefere o app da loja? <a href="${esc(L.pedidosOnline)}" target="_blank" rel="noopener">Pedir no Giga Pedidos</a></p>`}`;
  }
  function mensagem() {
    const linhas = cart.linhas.map(l => { const it = ITEMS.get(l.id), det = [...selText(l), l.obs ? `Obs: ${l.obs}` : ''].filter(Boolean); return `${l.qtd}x ${it.nome} — ${money(unitPrice(l) * l.qtd)}${det.length ? '\n   ' + det.join('\n   ') : ''}`; });
    const sub = cartSubtotal(), fee = cart.modo === 'entrega' ? feeFor(cart.cidade, cart.bairro) : 0;
    const onde = cart.modo === 'entrega' ? `Entrega: ${cart.endereco || '(endereço)'} · ${cart.bairro || '(bairro)'} · ${cart.cidade}` : cart.modo === 'retirar' ? 'Vou retirar no balcão' : 'Vou comer aí';
    return [`*Pedido · ${L.nome}*`, '', ...linhas, '', `Subtotal: ${money(sub)}`, cart.modo === 'entrega' ? `Entrega: ${fee != null && cart.bairro ? money(fee) : 'a confirmar'}` : '', `*Total: ${money(sub + (fee || 0))}*`, '', onde, cart.pagamento ? `Pagamento: ${cart.pagamento}${cart.troco && /dinheiro/i.test(cart.pagamento) ? ` (troco para R$ ${cart.troco})` : ''}` : '', cart.nome ? `Nome: ${cart.nome}` : '']
      .filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n').trim();
  }
  function openCart() {
    if (cartLayer.isOpen) return;
    $('#toast').classList.remove('is-visible');
    renderCart(); cartLayer.isOpen = true; cartLayer.openedAt = performance.now();
    cartLayer.hidden = false; lockScroll(); pushLayer({ el: cartEl, close: closeCartNow });
    if (isMobile()) { cartLayer.classList.add('is-open'); cartSheet.open(); } else { cartEl.offsetWidth; cartLayer.classList.add('is-open'); }
    requestAnimationFrame(() => cartEl.focus({ preventScroll: true }));
  }
  function closeCartNow(entry) {
    if (!cartLayer.isOpen) return;
    cartLayer.isOpen = false;
    const finish = () => { cartLayer.hidden = true; cartSheet.reset(); unlockScroll(); };
    cartLayer.classList.remove('is-open');
    if (isMobile()) { const v = cartLayer._v || 0; cartLayer._v = 0; cartSheet.close(finish, v); } else setTimeout(finish, reduce() ? 200 : 460);
    restoreFocus(entry);
  }
  const refreshSend = () => { const a = cartFoot.querySelector('[data-send]'); if (a) a.href = waLink(mensagem()); };
  cartLayer.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { requestClose(); return; }
    const line = e.target.closest('.cline');
    if (line) {
      const i = +line.dataset.i, q = e.target.closest('[data-q]');
      if (q) { cart.linhas[i].qtd += Number(q.dataset.q); if (cart.linhas[i].qtd <= 0) cart.linhas.splice(i, 1); saveCart(); paintBadges(); renderCart(); return; }
      if (e.target.closest('[data-rm]')) { cart.linhas.splice(i, 1); saveCart(); paintBadges(); renderCart(); return; }
    }
    const send = e.target.closest('[data-send]');
    if (send) {
      if (performance.now() - cartLayer.openedAt < 500) { e.preventDefault(); return; }
      if (cart.modo === 'entrega' && (!cart.bairro || !cart.endereco.trim())) { e.preventDefault(); const f = cartFoot.querySelector(cart.bairro ? 'input[name="endereco"]' : 'select[name="bairro"]'); f && f.focus(); toast(cart.bairro ? 'Informe o endereço de entrega' : 'Escolha o bairro de entrega'); return; }
      send.href = waLink(mensagem());
    }
  });
  cartLayer.addEventListener('input', e => { const n = e.target.name; if (['nome', 'endereco', 'troco'].includes(n)) { cart[n] = e.target.value; saveCart(); refreshSend(); } });
  cartLayer.addEventListener('change', e => {
    const n = e.target.name;
    if (n === 'modo') cart.modo = e.target.value;
    else if (n === 'cidade') { cart.cidade = e.target.value; cart.bairro = ''; }
    else if (['bairro', 'pagamento'].includes(n)) cart[n] = e.target.value;
    else return;
    saveCart(); renderCart();
    const f = cartFoot.querySelector(`[name="${n}"]${n === 'modo' ? `[value="${cart.modo}"]` : ''}`); f && f.focus();
  });
  $('#bagBtn').addEventListener('click', openCart);
  $('#cartbar').addEventListener('click', openCart);

  /* ================================================== FOTOS / ONDE ESTAMOS */
  function buildPhotos() {
    $('#photosGrid').innerHTML = L.galeriaLocal.map(([src, alt, cred]) => `<figure class="photo reveal">${imgTag(src, alt)}<figcaption><b>${esc(alt)}</b>Foto: ${esc(cred)}</figcaption></figure>`).join('');
    markLoaded($('#photosGrid'));
  }
  function buildWhere() {
    const tel = L.telefone, w1 = L.whatsappTexto, w2 = L.whatsapp2Texto;
    $('#whereCta').innerHTML = `
      <a class="btn btn--red btn--sm" href="${esc(L.mapa)}" target="_blank" rel="noopener">Como chegar</a>
      <a class="btn btn--wa btn--sm" href="${esc(waLink('Olá! Vim pelo site do Real Lanches.'))}" target="_blank" rel="noopener">${WA} WhatsApp</a>
      <a class="btn btn--ghost btn--sm" href="tel:+55${L.telefoneLink}">Ligar ${esc(tel)}</a>
      <a class="btn btn--ghost btn--sm" href="${esc(L.pedidosOnline)}" target="_blank" rel="noopener">Pedir no app</a>
      <a class="btn btn--ghost btn--sm" href="${esc(L.avaliar)}" target="_blank" rel="noopener">Avaliar no Google</a>`;
    $('#contacts').innerHTML = `
      <li><a href="tel:+55${L.telefoneLink}">${esc(tel)}</a><small>Telefone fixo</small></li>
      <li><a href="https://wa.me/${L.whatsapp}" target="_blank" rel="noopener">${esc(w1)}</a><small>WhatsApp</small></li>
      <li><a href="https://wa.me/${L.whatsapp2}" target="_blank" rel="noopener">${esc(w2)}</a><small>WhatsApp</small></li>
      <li><a href="https://instagram.com/${L.instagram}" target="_blank" rel="noopener">@${esc(L.instagram)}</a><small>Instagram</small></li>
      <li><a href="https://facebook.com/${L.facebook}" target="_blank" rel="noopener">/${esc(L.facebook)}</a><small>Facebook</small></li>`;
    $('#payments').innerHTML = L.pagamentos.map(p => `<li>${esc(p)}</li>`).join('');
    // calculadora de taxa por bairro
    const city = $('#feeCity'), hood = $('#feeHood'), out = $('#feeOut');
    city.innerHTML = Object.keys(L.cidadesEntrega).map(c => `<option>${esc(c)}</option>`).join('');
    const fillHoods = () => { hood.innerHTML = '<option value="">Escolha o bairro</option>' + (L.cidadesEntrega[city.value] || []).map(([b]) => `<option>${esc(b)}</option>`).join(''); out.textContent = '—'; };
    city.addEventListener('change', fillHoods);
    hood.addEventListener('change', () => { const v = feeFor(city.value, hood.value); out.textContent = v != null ? money(v) : '—'; });
    fillHoods();
    // o mapa do Google só carrega quando a seção chega perto
    const frame = $('#mapFrame');
    new IntersectionObserver((es, ob) => { if (es[0].isIntersecting) { frame.src = L.mapaEmbed; ob.disconnect(); } }, { rootMargin: '400px' }).observe(frame);
  }

  /* ====================================================== GALERIA INFINITA */
  const ex = { el: $('#explore'), world: $('#exploreWorld'), cursor: $('#exploreCursor'), tiles: [], key: '', raf: 0, last: 0, open: false, camX: 0, camY: 0, vx: 0, vy: 0, drag: null, lastI: 0, colW: 0, gap: 0, totalW: 0, maxH: 0, focus: null, px: -200, py: -200, cx: -200, cy: -200 };
  function exBuild() {
    const vw = innerWidth, vh = innerHeight, mobile = vw < 768;
    const colW = Math.round(mobile ? clamp(vw * 0.42, 140, 190) : clamp(vw / 5.6, 210, 300)), gap = mobile ? 12 : 20;
    const cols = Math.ceil(vw / (colW + gap)) + 2, ratios = [1.25, 1, 1.4, 1.1, 0.9, 1.3];
    const base = shuffled(WITH_IMG, 29), perCol = Math.ceil((vh + colW * 2.8) / (colW * 1.16 + gap)) + 1;
    let list = []; while (list.length < cols * perCol) list = list.concat(base);
    list = list.slice(0, Math.max(cols * perCol, base.length));
    const seen = new Set(), colsY = Array.from({ length: cols }, (_, c) => (c % 2 ? colW * 0.5 : 0)), tiles = [];
    let html = '';
    list.forEach((it, i) => {
      const c = i % cols, row = Math.floor(i / cols), ratio = ratios[(row * 2 + c) % ratios.length], h = Math.round(colW * ratio);
      const first = !seen.has(it.id); seen.add(it.id);
      tiles.push({ c, x0: c * (colW + gap), y0: colsY[c], h, par: 1 + ((c % 3) - 1) * 0.07 });
      colsY[c] += h + gap;
      html += `<button type="button" class="ex-tile" data-id="${it.id}" style="width:${colW}px;height:${h}px" ${first ? `aria-label="${esc(it.nome)}, ${money(it.preco)}"` : 'tabindex="-1" aria-hidden="true"'}>${imgTag(it.img, '')}<figcaption><b>${esc(it.nome)}</b><span>${it.apartir ? 'a partir de ' : ''}R$ ${short(it.preco)}</span></figcaption></button>`;
    });
    ex.world.innerHTML = html;
    const els = ex.world.children;
    tiles.forEach((t, i) => { t.el = els[i]; t.colH = colsY[t.c]; });
    Object.assign(ex, { tiles, colW, gap, totalW: cols * (colW + gap), maxH: Math.round(colW * 1.4), key: `${vw}x${vh}` });
    markLoaded(ex.world);
  }
  function exRender() {
    const vw = innerWidth, vh = innerHeight, step = ex.colW + ex.gap;
    for (const t of ex.tiles) {
      const x = mod(t.x0 + ex.camX, ex.totalW) - step, y = mod(t.y0 + ex.camY * t.par, t.colH) - ex.maxH - ex.gap;
      t.sx = x; t.sy = y;
      const s = reduce() ? 1 : 1 - Math.min(1, Math.hypot((x + ex.colW / 2 - vw / 2) / vw, (y + t.h / 2 - vh / 2) / vh) * 1.1) * 0.16;
      t.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(3)})`;
    }
  }
  function exFrame(now) {
    const dt = Math.min(0.05, (now - ex.last) / 1000); ex.last = now;
    if (ds) { ex.raf = requestAnimationFrame(exFrame); return; }
    if (!ex.drag) {
      if (ex.focus) { ex.camX += (ex.focus.x - ex.camX) * Math.min(1, dt * 7); ex.camY += (ex.focus.y - ex.camY) * Math.min(1, dt * 7); if (Math.abs(ex.focus.x - ex.camX) < 0.5 && Math.abs(ex.focus.y - ex.camY) < 0.5) ex.focus = null; }
      else if (!reduce()) {
        if (now - ex.lastI > 1800) { ex.vx += (-22 - ex.vx) * Math.min(1, dt * 0.9); ex.vy += (-14 - ex.vy) * Math.min(1, dt * 0.9); }
        else { const f = Math.exp(-dt * 3.4); ex.vx *= f; ex.vy *= f; }
        ex.camX += ex.vx * dt; ex.camY += ex.vy * dt;
      }
    }
    exRender();
    ex.cx += (ex.px - ex.cx) * Math.min(1, dt * 20); ex.cy += (ex.py - ex.cy) * Math.min(1, dt * 20);
    ex.cursor.style.transform = `translate3d(${ex.cx}px,${ex.cy}px,0)`;
    ex.raf = requestAnimationFrame(exFrame);
  }
  function exOpen() {
    if (ex.open) return;
    if (ex.key !== `${innerWidth}x${innerHeight}`) exBuild();
    ex.open = true; ex.el.hidden = false; lockScroll(); pushLayer({ el: ex.el, close: exCloseNow });
    ex.lastI = ex.last = performance.now(); exRender(); ex.el.offsetWidth; ex.el.classList.add('is-open');
    if (!reduce()) {
      const vw = innerWidth, vh = innerHeight;
      ex.tiles.forEach(t => { if (t.sx > vw || t.sx + ex.colW < 0 || t.sy > vh || t.sy + t.h < 0) return; const d = Math.hypot(t.sx + ex.colW / 2 - vw / 2, t.sy + t.h / 2 - vh / 2) / Math.hypot(vw / 2, vh / 2); t.el.firstElementChild.animate([{ opacity: 0, transform: 'scale(1.18)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 900, delay: 80 + d * 380, easing: EASE_OUT, fill: 'backwards' }); });
    }
    ex.raf = requestAnimationFrame(exFrame);
    requestAnimationFrame(() => $('#exploreClose').focus({ preventScroll: true }));
  }
  function exCloseNow(entry) {
    if (!ex.open) return;
    ex.open = false; restoreFocus(entry);
    ex.el.classList.remove('is-open'); ex.cursor.classList.remove('is-visible');
    setTimeout(() => { ex.el.hidden = true; cancelAnimationFrame(ex.raf); unlockScroll(); }, 300);
  }
  function exBind() {
    $$('[data-open-explore]').forEach(b => b.addEventListener('click', exOpen));
    $('#exploreClose').addEventListener('click', requestClose);
    const el = ex.el;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('.explore__ui')) return;
      ex.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, s: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }] };
      ex.vx = ex.vy = 0; ex.focus = null; ex.lastI = performance.now();
      try { el.setPointerCapture(e.pointerId); } catch { /* ok */ }
      ex.cursor.classList.add('is-down');
    });
    el.addEventListener('pointermove', e => {
      ex.px = e.clientX; ex.py = e.clientY;
      if (e.pointerType === 'mouse') { ex.cursor.classList.toggle('is-visible', !e.target.closest('.explore__ui')); if (!ex.drag) ex.cursor.textContent = e.target.closest('.ex-tile') ? 'Ver item' : 'Arraste'; }
      const d = ex.drag; if (!d || d.id !== e.pointerId) return;
      ex.camX += e.clientX - d.x; ex.camY += e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) { d.moved = true; ex.cursor.textContent = 'Arraste'; }
      d.s.push({ t: e.timeStamp, x: e.clientX, y: e.clientY }); if (d.s.length > 8) d.s.shift();
      ex.lastI = performance.now();
    });
    const up = e => {
      const d = ex.drag; if (!d || d.id !== e.pointerId) return;
      ex.drag = null; ex.cursor.classList.remove('is-down'); ex.lastI = performance.now();
      if (!d.moved && e.type === 'pointerup') { const hit = document.elementsFromPoint(e.clientX, e.clientY).find(n => n.classList && n.classList.contains('ex-tile')); if (hit) openDetail(hit.dataset.id, hit.querySelector('img')); return; }
      if (!reduce()) { ex.vx = clamp(velocityFrom(d.s, 'x'), -3200, 3200); ex.vy = clamp(velocityFrom(d.s, 'y'), -3200, 3200); }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') ex.cursor.classList.remove('is-visible'); });
    el.addEventListener('wheel', e => { e.preventDefault(); const k = e.deltaMode === 1 ? 16 : 1; ex.camX -= (e.shiftKey ? e.deltaY : e.deltaX) * k; ex.camY -= (e.shiftKey ? 0 : e.deltaY) * k; ex.vx = ex.vy = 0; ex.focus = null; ex.lastI = performance.now(); }, { passive: false });
    el.addEventListener('keydown', e => {
      const m = { ArrowLeft: [700, 0], ArrowRight: [-700, 0], ArrowUp: [0, 700], ArrowDown: [0, -700] }[e.key];
      if (m) { e.preventDefault(); ex.vx += m[0]; ex.vy += m[1]; ex.lastI = performance.now(); }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('ex-tile')) { e.preventDefault(); openDetail(e.target.dataset.id, e.target.querySelector('img')); }
    });
    el.addEventListener('focusin', e => {
      const tEl = e.target.closest('.ex-tile'); if (!tEl) return;
      const t = ex.tiles.find(x => x.el === tEl); if (!t) return;
      ex.focus = { x: ex.camX + innerWidth / 2 - (t.sx + ex.colW / 2), y: ex.camY + (innerHeight / 2 - (t.sy + t.h / 2)) / t.par };
      ex.vx = ex.vy = 0; ex.lastI = performance.now();
    });
    addEventListener('resize', () => { if (ex.open && ex.key !== `${innerWidth}x${innerHeight}`) { exBuild(); exRender(); } else if (!ex.open) ex.key = ''; });
  }

  /* ================================================================ início */
  buildReel();
  buildTapes();
  buildFavs();
  buildSpot();
  buildMenu();
  buildPhotos();
  buildWhere();
  bindTabs();
  bindScroll();
  exBind();
  paintBadges();
  setActiveTab(CATS[0].id, false);
  runLoader();
  // revela também o que entrou depois (destaque e fotos)
  const io2 = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io2.unobserve(en.target); } }), { rootMargin: '0px 0px -6% 0px' });
  $$('.reveal:not(.is-in)').forEach(el => io2.observe(el));
  if (location.hash === '#galeria') setTimeout(exOpen, 600);
})();
