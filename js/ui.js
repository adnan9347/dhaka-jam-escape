/*
 * ui.js — all the menu screens, overlays and their animations.
 *
 *  - showScreen(): switches between splash / role / how-to / game
 *  - the HUD (clock, progress, hearts, score, power-up ring)
 *  - countdown, pause menu, result screen, toasts, "boss is calling"
 *  - small animated canvases (role cards, how-to demos, splash road)
 *
 * Animations use Motion (motion.dev) when it loaded from the CDN. If it
 * didn't, anim() falls back to the browser's built-in Web Animations API,
 * and everything still works because visibility never depends on animation.
 */

import { t, tAt, fmtNum, fmtClock, getLang, listLength } from './i18n.js';
import { getTheme, PALETTES } from './theme.js';
import { isMuted, sfx } from './audio.js';
import { drawCharacter } from '../game/player.js';
import { drawEntityArt } from '../game/entities.js';
import { Effects } from '../game/effects.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

// ======================================================================
//  anim(): Motion when available, Web Animations API otherwise
// ======================================================================

function toArr(x) {
  if (!x) return [];
  if (x instanceof Element) return [x];
  return Array.from(x);
}

function kfAt(arr, i, def) {
  if (arr === undefined) return def;
  if (!Array.isArray(arr)) return arr;
  return arr[Math.min(i, arr.length - 1)];
}

/** Convert Motion-style {x, y, scale, rotate, opacity} keyframes for WAAPI. */
function toWaapi(kf) {
  const out = {};
  const tKeys = ['x', 'y', 'scale', 'rotate'];
  let n = 0;
  for (const k of tKeys) if (kf[k] !== undefined) n = Math.max(n, Array.isArray(kf[k]) ? kf[k].length : 1);
  if (n) {
    out.transform = [];
    for (let i = 0; i < n; i++) {
      out.transform.push(
        `translate(${kfAt(kf.x, i, 0)}px, ${kfAt(kf.y, i, 0)}px) scale(${kfAt(kf.scale, i, 1)}) rotate(${kfAt(kf.rotate, i, 0)}deg)`
      );
    }
  }
  if (kf.opacity !== undefined) out.opacity = Array.isArray(kf.opacity) ? kf.opacity : [kf.opacity];
  return out;
}

export function anim(targets, kf, opts = {}) {
  const els = toArr(targets);
  if (!els.length) return Promise.resolve();
  const reduced = reduceMQ.matches;
  const duration = reduced ? Math.min(opts.duration || 0.4, 0.15) : opts.duration || 0.45;
  const delay = opts.delay || 0;
  const stg = reduced ? 0 : opts.stagger || 0;
  const total = (delay + duration + stg * els.length) * 1000 + 120;
  const M = window.Motion;
  let done = false;

  if (M && typeof M.animate === 'function') {
    try {
      const o = { duration, delay: stg && M.stagger ? M.stagger(stg, { startDelay: delay }) : delay };
      if (opts.spring && !reduced) {
        o.type = 'spring';
        o.bounce = opts.bounce !== undefined ? opts.bounce : 0.45;
      } else {
        o.ease = opts.ease || [0.22, 1, 0.36, 1];
      }
      M.animate(els, kf, o);
      done = true;
    } catch (e) {
      done = false;
    }
  }
  if (!done) {
    const wk = toWaapi(kf);
    els.forEach((el, i) => {
      if (!el.animate) return;
      try {
        el.animate(wk, {
          duration: duration * 1000,
          delay: (delay + stg * i) * 1000,
          easing: opts.spring && !reduced ? 'cubic-bezier(.34,1.56,.64,1)' : 'cubic-bezier(.22,1,.36,1)',
          fill: 'backwards'
        });
      } catch (e) {
        /* very old browser: no animation, no problem */
      }
    });
  }
  // Motion leaves inline styles behind; clear them so CSS :hover/:active
  // transforms on buttons keep working.
  return wait(total + (opts.spring ? 300 : 0)).then(() => {
    if (opts.keep) return;
    els.forEach((el) => {
      el.style.transform = '';
      el.style.opacity = '';
    });
  });
}

// ======================================================================
//  Small animated canvases (shared rAF loop)
// ======================================================================

const minis = [];
let miniRaf = 0;
let miniLast = 0;
let miniTime = 0;

function addMini(canvas, draw, isVisible) {
  const m = { canvas, ctx: canvas.getContext('2d'), draw, isVisible, w: 0, h: 0 };
  minis.push(m);
  return m;
}

function miniLoop(now) {
  const dt = Math.min(0.05, (now - (miniLast || now)) / 1000);
  miniLast = now;
  miniTime += dt;
  let any = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const m of minis) {
    if (!m.isVisible()) continue;
    any = true;
    const cw = m.canvas.clientWidth;
    const ch = m.canvas.clientHeight;
    if (!cw || !ch) continue;
    if (m.w !== cw || m.h !== ch || m.canvas.width !== Math.round(cw * dpr)) {
      m.canvas.width = Math.round(cw * dpr);
      m.canvas.height = Math.round(ch * dpr);
      m.w = cw;
      m.h = ch;
    }
    m.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    m.ctx.clearRect(0, 0, cw, ch);
    m.draw(m.ctx, cw, ch, miniTime, dt);
  }
  miniRaf = any ? requestAnimationFrame(miniLoop) : 0;
  if (!any) miniLast = 0;
}

function kickMini() {
  if (!miniRaf) miniRaf = requestAnimationFrame(miniLoop);
}

function pal() {
  return PALETTES[getTheme()];
}

/** Draw a simple strip of road (used by the splash and tutorial demos). */
function drawMiniRoad(ctx, w, h, top, lanes, scroll) {
  const P = pal();
  ctx.fillStyle = P.road;
  ctx.fillRect(0, top, w, h - top);
  ctx.fillStyle = P.curb;
  ctx.fillRect(0, top - 6, w, 6);
  if (lanes > 1) {
    const lh = (h - top) / lanes;
    ctx.fillStyle = P.laneDash;
    const off = scroll % 60;
    for (let i = 1; i < lanes; i++) {
      for (let x = -off; x < w; x += 60) ctx.fillRect(x, top + lh * i - 1.5, 30, 3);
    }
  } else {
    ctx.fillStyle = P.laneDash;
    const off = scroll % 60;
    for (let x = -off; x < w; x += 60) ctx.fillRect(x, h - 6, 30, 3);
  }
}

function drawMiniSky(ctx, w, h) {
  const P = pal();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, P.skyTop);
  g.addColorStop(1, P.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ======================================================================
//  The UI
// ======================================================================

export function createUI(app) {
  const A = app.actions;
  const S = app.state;
  const el = {
    splash: $('#screen-splash'),
    role: $('#screen-role'),
    howto: $('#screen-howto'),
    game: $('#screen-game'),
    title: $('#splash-title'),
    letsGo: $('#btn-letsgo'),
    nickname: $('#nickname'),
    howtoTrack: $('#howto-track'),
    howtoDots: $('#howto-dots'),
    howtoDone: $('#btn-howto-done'),
    hudClockChip: $('#hud-clock-chip'),
    hudClock: $('#hud-clock'),
    hudDistChip: $('#hud-dist-chip'),
    hudDist: $('#hud-dist'),
    hudLives: $('#hud-lives'),
    hudProgressChip: $('#hud-progress-chip'),
    hudProgress: $('#hud-progress'),
    hudFill: $('#hud-progress-fill'),
    hudRunner: $('#hud-runner'),
    hudDest: $('#hud-dest'),
    hudScore: $('#hud-score'),
    hudPower: $('#hud-power'),
    hudPowerRing: $('#hud-power-ring'),
    hudPowerIco: $('#hud-power-ico'),
    countdown: $('#countdown'),
    countNum: $('#count-num'),
    weather: $('#weather-banner'),
    weatherTip: $('#weather-tip'),
    boss: $('#boss-call'),
    pause: $('#pause-overlay'),
    result: $('#result-overlay'),
    resultTitle: $('#result-title'),
    resultSub: $('#result-sub'),
    newBest: $('#new-best'),
    endlessBtn: $('#btn-endless'),
    toast: $('#toast'),
    gameArea: $('#game-area')
  };
  let current = null;
  let howtoFrom = 'splash';
  let resultData = null;
  let resultInfo = null;
  let resultSubKey = '';
  let resultSubIdx = 0;
  let countToken = 0;
  let countRaf = 0;

  // ---------------- controls (language / mute) ----------------
  const controlsHTML = `
    <button type="button" class="lang-pill" data-action="toggle-lang" data-lang="en">
      <span class="thumb" aria-hidden="true"></span>
      <span class="opt opt-bn" lang="bn" aria-hidden="true">বাংলা</span>
      <span class="opt opt-en" lang="en" aria-hidden="true">EN</span>
    </button>
    <button type="button" class="icon-btn mute-btn" data-action="toggle-mute">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        <path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
        <path class="cross" d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
      </svg>
    </button>`;
  $$('[data-controls]').forEach((c) => (c.innerHTML = controlsHTML));

  function syncControls() {
    const lang = getLang();
    const muted = isMuted();
    $$('.lang-pill').forEach((b) => {
      b.dataset.lang = lang;
      b.setAttribute('aria-label', t('langAria'));
    });
    $$('.mute-btn').forEach((b) => {
      b.classList.toggle('muted', muted);
      b.setAttribute('aria-label', muted ? t('unmute') : t('mute'));
      b.setAttribute('aria-pressed', String(muted));
    });
  }

  // ---------------- click routing ----------------
  document.addEventListener('click', (e) => {
    const roleBtn = e.target.closest('[data-role]');
    if (roleBtn) {
      selectRole(roleBtn.dataset.role, true);
      return;
    }
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (b.tagName === 'A') e.preventDefault();
    switch (a) {
      case 'home': A.home(); break;
      case 'play': A.play(); break;
      case 'howto': A.openHowTo('splash'); break;
      case 'back-splash': A.home(); break;
      case 'lets-go': A.letsGo(); break;
      case 'howto-back': A.howtoBack(); break;
      case 'howto-done': A.howtoDone(); break;
      case 'howto-prev': howtoGo(howtoIndex() - 1); break;
      case 'howto-next': howtoGo(howtoIndex() + 1); break;
      case 'pause': A.pause(); break;
      case 'resume': A.resume(); break;
      case 'restart': A.restart(); break;
      case 'change-role': A.changeRole(); break;
      case 'play-again': A.playAgain(); break;
      case 'share': A.share(); break;
      case 'endless': A.endless(); break;
      case 'toggle-lang': A.toggleLang(); break;
      case 'toggle-mute': A.toggleMute(); break;
    }
  });

  // ---------------- i18n ----------------
  function buildTitle(animate) {
    const txt = t('appTitle');
    const lang = getLang();
    el.title.textContent = '';
    el.title.setAttribute('aria-label', txt);
    const pieces = [];
    let ci = 0;
    txt.split(' ').forEach((word) => {
      const w = document.createElement('span');
      w.className = 'word';
      w.setAttribute('aria-hidden', 'true');
      // Bangla letters join into conjuncts, so animate whole words, never split them.
      const parts = lang === 'bn' ? [word] : Array.from(word);
      parts.forEach((p) => {
        const s = document.createElement('span');
        s.className = 'ch c' + (ci++ % 4);
        s.textContent = p;
        w.appendChild(s);
        pieces.push(s);
      });
      el.title.appendChild(w);
    });
    if (animate) {
      anim(pieces, { y: [-140, 0], opacity: [0, 1], rotate: [-14, 0] }, { duration: 0.8, stagger: 0.06, spring: true, bounce: 0.5 });
    }
  }

  function applyI18n() {
    $$('[data-i18n]').forEach((n) => (n.textContent = t(n.dataset.i18n)));
    $$('[data-i18n-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.i18nAria)));
    $$('[data-i18n-placeholder]').forEach((n) => (n.placeholder = t(n.dataset.i18nPlaceholder)));
    document.title = getLang() === 'bn' ? 'ঢাকা জ্যাম এস্কেপ — Dhaka Jam Escape' : 'Dhaka Jam Escape — ঢাকা জ্যাম এস্কেপ';
    buildTitle(false);
    syncControls();
    el.howtoDone.querySelector('span').textContent = howtoFrom === 'splash' ? t('gotIt') : t('start');
    updateDots();
    hudCache.clockMin = -1;
    hudCache.score = -1;
    hudCache.dist = -1;
    if (hudCache.lastHud) updateHud(hudCache.lastHud, true);
    el.hudLives.setAttribute('aria-label', t('hudLivesAria', { n: fmtNum(hudCache.lives) }));
    if (resultData && !el.result.hidden) renderResultText(false);
  }

  // ---------------- screens ----------------
  const screens = { splash: el.splash, role: el.role, howto: el.howto, game: el.game };

  function showScreen(name, opts = {}) {
    const next = screens[name];
    if (!next) return;
    for (const k in screens) if (screens[k] !== next) screens[k].hidden = true;
    const changed = current !== name;
    current = name;
    next.hidden = false;
    document.body.classList.toggle('in-game', name === 'game');
    if (name === 'howto') setupHowto(opts.from || 'splash');
    if (changed && name !== 'game') {
      next.scrollTop = 0;
      anim(next, { opacity: [0, 1], y: [18, 0] }, { duration: 0.35 });
    }
    if (name === 'splash') {
      buildTitle(true);
      startPetals();
    }
    if (name === 'role') {
      anim($$('.role-card', next), { y: [60, 0], opacity: [0, 1], scale: [0.9, 1] }, { duration: 0.6, stagger: 0.1, spring: true, bounce: 0.4, delay: 0.05 });
    }
    // Move focus to the new screen's heading so screen readers announce it.
    if (name === 'game') {
      el.gameArea.focus({ preventScroll: true });
    } else if (changed) {
      const h = next.querySelector('h1, h2');
      if (h) {
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    }
    kickMini();
  }

  // ---------------- splash ----------------
  function startPetals() {
    const box = $('.petals', el.splash);
    if (box.childElementCount) return;
    const n = window.innerWidth < 500 ? 12 : 20;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.className = 'petal';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = 6 + Math.random() * 6 + 's';
      p.style.animationDelay = -Math.random() * 10 + 's';
      p.style.scale = String(0.6 + Math.random() * 0.8);
      box.appendChild(p);
    }
  }

  const splashOpts = { outline: '#2A1E3B', night: 0, variant: 0 };
  addMini($('#splash-canvas'), (ctx, w, h, time) => {
    const P = pal();
    const top = h * 0.42;
    const scroll = time * 120;
    drawMiniRoad(ctx, w, h, top, 2, scroll);
    splashOpts.outline = P.outline;
    splashOpts.night = getTheme() === 'dark' ? 1 : 0;
    const s = Math.min(1, h / 140) * 0.75;
    // bus in the back lane, rickshaw bouncing across the front lane
    const busX = ((time * 70) % (w + 500)) - 250;
    ctx.save();
    ctx.translate(busX, top + (h - top) * 0.32);
    ctx.scale(s * 0.85, s * 0.85);
    splashOpts.variant = 0;
    drawEntityArt(ctx, 'bus', time, splashOpts);
    ctx.restore();
    const rx = ((time * 110 + 200) % (w + 260)) - 130;
    ctx.save();
    ctx.translate(rx, h - 8 - Math.abs(Math.sin(time * 7)) * 4);
    ctx.scale(s, s);
    splashOpts.variant = 1;
    drawEntityArt(ctx, 'rickshaw', time, splashOpts);
    ctx.restore();
  }, () => current === 'splash');

  // ---------------- role select ----------------
  const roleCards = $$('.role-card');
  const roleOpts = { outline: '#2A1E3B', phase: 0 };
  let roleSelectT = 0;
  roleCards.forEach((card) => {
    const role = card.dataset.role;
    const canvas = $('.role-canvas', card);
    addMini(canvas, (ctx, w, h, time) => {
      const selected = S.role === role;
      const P = pal();
      roleOpts.outline = P.outline;
      const sc = Math.min(w / 90, h / 108);
      ctx.fillStyle = 'rgba(20,10,30,0.18)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h - 10, 26 * sc, 6 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(w / 2, h - 10);
      ctx.scale(sc, sc);
      const since = time - roleSelectT;
      const pose = selected && since < 1.6 ? 'win' : 'idle';
      drawCharacter(ctx, role, pose, time + (role === 'employee' ? 1.3 : 0), roleOpts);
      ctx.restore();
    }, () => current === 'role');

    // tilt toward the pointer
    const inner = $('.role-card-inner', card);
    card.addEventListener('pointermove', (e) => {
      if (reduceMQ.matches) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      inner.style.setProperty('--ry', (px * 16).toFixed(2) + 'deg');
      inner.style.setProperty('--rx', (-py * 16).toFixed(2) + 'deg');
    });
    card.addEventListener('pointerleave', () => {
      inner.style.setProperty('--ry', '0deg');
      inner.style.setProperty('--rx', '0deg');
    });
  });

  function selectRole(role, user) {
    S.role = role;
    roleSelectT = miniTime;
    roleCards.forEach((c) => {
      const on = c.dataset.role === role;
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
    });
    el.letsGo.disabled = false;
    if (user) {
      sfx('click');
      const card = roleCards.find((c) => c.dataset.role === role);
      anim(card, { scale: [0.88, 1] }, { duration: 0.55, spring: true, bounce: 0.6 });
      anim(el.letsGo, { scale: [0.85, 1] }, { duration: 0.5, spring: true, bounce: 0.5 });
    }
    A.selectRole(role);
  }
  // radio-group keyboard support (arrow keys move the selection)
  $('.role-grid').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = S.role === 'student' ? 'employee' : 'student';
    selectRole(next, true);
    roleCards.find((c) => c.dataset.role === next).focus();
  });
  roleCards.forEach((c, i) => (c.tabIndex = i === 0 ? 0 : -1));

  el.nickname.addEventListener('input', () => {
    S.nickname = el.nickname.value.slice(0, 15).trim();
  });
  el.nickname.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && S.role) A.letsGo();
  });

  // ---------------- how to play ----------------
  const howCards = $$('.howto-card');
  function howtoIndex() {
    const tr = el.howtoTrack;
    const center = tr.scrollLeft + tr.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    howCards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }
  function howtoGo(i) {
    const idx = Math.max(0, Math.min(howCards.length - 1, i));
    const c = howCards[idx];
    const tr = el.howtoTrack;
    tr.scrollTo({ left: c.offsetLeft - (tr.clientWidth - c.offsetWidth) / 2, behavior: reduceMQ.matches ? 'auto' : 'smooth' });
    anim(c, { scale: [0.94, 1] }, { duration: 0.5, spring: true });
  }
  function updateDots() {
    const idx = current === 'howto' ? howtoIndex() : 0;
    if (!el.howtoDots.childElementCount) {
      howCards.forEach(() => {
        const d = document.createElement('span');
        d.className = 'dot';
        d.setAttribute('aria-hidden', 'true');
        el.howtoDots.appendChild(d);
      });
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      el.howtoDots.appendChild(sr);
    }
    $$('.dot', el.howtoDots).forEach((d, i) => d.classList.toggle('active', i === idx));
    $('.sr-only', el.howtoDots).textContent = t('cardOf', { n: fmtNum(idx + 1), total: fmtNum(howCards.length) });
  }
  let dotsRaf = 0;
  el.howtoTrack.addEventListener('scroll', () => {
    if (!dotsRaf) dotsRaf = requestAnimationFrame(() => {
      dotsRaf = 0;
      updateDots();
    });
  });
  el.howtoTrack.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      howtoGo(howtoIndex() + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      howtoGo(howtoIndex() - 1);
    }
  });
  function setupHowto(from) {
    howtoFrom = from;
    el.howtoDone.querySelector('span').textContent = from === 'splash' ? t('gotIt') : t('start');
    el.howtoTrack.scrollLeft = 0;
    updateDots();
    anim(howCards, { x: [80, 0], opacity: [0, 1] }, { duration: 0.5, stagger: 0.08 });
  }

  // demo canvases
  const demoOpts = { outline: '#2A1E3B', phase: 0, night: 0, variant: 2 };
  addMini($('.howto-canvas', howCards[0]), (ctx, w, h, time) => {
    // lane switching demo
    const P = pal();
    demoOpts.outline = P.outline;
    demoOpts.night = getTheme() === 'dark' ? 1 : 0;
    drawMiniSky(ctx, w, h);
    const top = 30;
    drawMiniRoad(ctx, w, h, top, 3, time * 150);
    const lh = (h - top) / 3;
    const seq = [1, 0, 1, 2];
    const k = Math.floor(time / 1.1) % 4;
    const prev = seq[(k + 3) % 4];
    const u = Math.min(1, (time % 1.1) / 0.15);
    const laneF = prev + (seq[k] - prev) * (1 - Math.pow(1 - u, 3));
    // a rickshaw comes down the lane you just left
    const rx = w + 60 - ((time % 1.1) / 1.1) * (w + 120);
    ctx.save();
    ctx.translate(rx, top + lh * (prev + 0.5) + 12);
    ctx.scale(0.42, 0.42);
    drawEntityArt(ctx, 'rickshaw', time, demoOpts);
    ctx.restore();
    const cy = top + lh * (laneF + 0.5) + 14;
    ctx.save();
    ctx.translate(w * 0.28, cy);
    ctx.scale(0.5, 0.5);
    demoOpts.phase = time * 12;
    drawCharacter(ctx, S.role || 'student', 'run', time, demoOpts);
    ctx.restore();
    // swipe arrow hint
    const dir = seq[k] - prev;
    if (dir && u < 1) {
      ctx.fillStyle = '#FFC72C';
      ctx.strokeStyle = P.outline;
      ctx.lineWidth = 2.5;
      ctx.font = '800 26px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(dir < 0 ? '↑' : '↓', w * 0.28 + 34, cy - 30);
      ctx.fillText(dir < 0 ? '↑' : '↓', w * 0.28 + 34, cy - 30);
    }
  }, () => current === 'howto');

  addMini($('.howto-canvas', howCards[1]), (ctx, w, h, time) => {
    // jump demo: a manhole and a puddle roll toward the runner, who hops over
    const P = pal();
    demoOpts.outline = P.outline;
    drawMiniSky(ctx, w, h);
    const ground = h - 24;
    drawMiniRoad(ctx, w, h, ground - 30, 1, time * 160);
    const period = 1.6;
    const ph = (time % period) / period;
    const hx = w * 0.3;
    const ox = w + 40 - ph * (w + 80);
    ctx.save();
    ctx.translate(ox, ground);
    ctx.scale(0.6, 0.6);
    drawEntityArt(ctx, Math.floor(time / period) % 2 ? 'puddle' : 'manhole', time, demoOpts);
    ctx.restore();
    // jump when the hole is close
    const dist = ox - hx;
    let jh = 0;
    if (dist < 70 && dist > -50) {
      const u = (70 - dist) / 120;
      jh = 4 * 38 * u * (1 - u);
    }
    ctx.save();
    ctx.translate(hx, ground - jh);
    ctx.scale(0.55, 0.55);
    demoOpts.phase = time * 12;
    drawCharacter(ctx, S.role || 'student', jh > 1 ? 'jump' : 'run', time, demoOpts);
    ctx.restore();
    if (jh > 1) {
      ctx.font = '800 18px "Baloo 2", sans-serif';
      ctx.fillStyle = P.text;
      ctx.textAlign = 'center';
      ctx.fillText(document.documentElement.classList.contains('is-touch') ? '👆' : '⎵', hx + 40, ground - 70);
    }
  }, () => current === 'howto');

  addMini($('.howto-canvas', howCards[2]), (ctx, w, h, time) => {
    // power-ups + beat the clock
    const P = pal();
    demoOpts.outline = P.outline;
    drawMiniSky(ctx, w, h);
    const items = ['cha', 'shingara', 'shortcut'];
    const gap = w / 4;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(gap * (i + 1), h * 0.62);
      ctx.scale(1.15, 1.15);
      drawEntityArt(ctx, items[i], time + i, demoOpts);
      ctx.restore();
    }
    // a little clock ticking toward 9:00
    const m = 8 * 60 + 52 + Math.floor((time * 2) % 8);
    ctx.font = (getLang() === 'bn' ? '800 20px "Anek Bangla"' : '800 20px "Baloo 2"') + ', sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = '⏰ ' + fmtClock(m);
    const tw = ctx.measureText(label).width + 24;
    ctx.fillStyle = m >= 8 * 60 + 55 ? '#F42A41' : '#FFFFFF';
    ctx.strokeStyle = P.outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(w / 2 - tw / 2, 10, tw, 30);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = m >= 8 * 60 + 55 ? '#FFFFFF' : '#2A1E3B';
    ctx.fillText(label, w / 2, 26);
  }, () => current === 'howto');

  // ---------------- HUD ----------------
  const hudCache = { clockMin: -1, urgent: null, prog: -1, score: -1, scoreT: 0, power: undefined, ring: -1, mode: '', dist: -1, lives: 3, lastHud: null };
  const RING = 100.53;
  const POWER_ICON = { boost: '☕', puddle: '💧', leaflet: '📄', boss: '📞' };

  function buildHearts() {
    el.hudLives.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      el.hudLives.insertAdjacentHTML(
        'beforeend',
        '<svg class="heart" viewBox="0 0 32 30" aria-hidden="true">' +
          '<path class="heart-l" d="M16 28 C 6 20 1 15 1 9 A 7.5 7.5 0 0 1 16 5 Z" />' +
          '<path class="heart-r" d="M16 28 C 26 20 31 15 31 9 A 7.5 7.5 0 0 0 16 5 Z" />' +
          '</svg>'
      );
    }
  }
  buildHearts();

  function setLives(n, delta = 0) {
    const hearts = $$('.heart', el.hudLives);
    hearts.forEach((h, i) => {
      h.classList.remove('gain');
      if (i < n) {
        h.classList.remove('empty', 'breaking');
        if (delta > 0 && i === n - 1) {
          void h.getBoundingClientRect(); // restart the CSS animation
          h.classList.add('gain');
        }
      } else if (delta < 0 && i === n) {
        h.classList.add('breaking');
        setTimeout(() => {
          h.classList.remove('breaking');
          h.classList.add('empty');
        }, 600);
      } else {
        h.classList.add('empty');
        h.classList.remove('breaking');
      }
    });
    hudCache.lives = n;
    el.hudLives.setAttribute('aria-label', t('hudLivesAria', { n: fmtNum(n) }));
    if (delta < 0) anim(el.hudLives, { x: [0, -8, 7, -5, 3, 0] }, { duration: 0.4 });
  }

  function resetHud(mode, role) {
    hudCache.clockMin = -1;
    hudCache.urgent = null;
    hudCache.prog = -1;
    hudCache.score = -1;
    hudCache.power = undefined;
    hudCache.mode = '';
    hudCache.dist = -1;
    el.hudRunner.textContent = role === 'employee' ? '💼' : '🎒';
    el.hudDest.textContent = role === 'employee' ? '🏢' : '🏫';
    buildHearts();
    setLives(3, 0);
  }

  function updateHud(h, force) {
    hudCache.lastHud = h;
    const c = hudCache;
    if (h.mode !== c.mode) {
      c.mode = h.mode;
      const endless = h.mode === 'endless';
      el.hudClockChip.hidden = endless;
      el.hudProgressChip.hidden = endless;
      el.hudDistChip.hidden = !endless;
    }
    if (h.mode === 'story') {
      const cm = Math.floor(h.clock);
      if (cm !== c.clockMin) {
        c.clockMin = cm;
        el.hudClock.textContent = fmtClock(cm);
      }
      if (h.urgent !== c.urgent) {
        c.urgent = h.urgent;
        el.hudClockChip.classList.toggle('urgent', h.urgent);
      }
      const p = Math.round(h.progress * 400) / 400;
      if (p !== c.prog) {
        c.prog = p;
        el.hudFill.style.transform = 'scaleX(' + p + ')';
        el.hudRunner.style.left = p * 100 + '%';
        el.hudProgress.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      }
    } else {
      const d = Math.floor(h.distM);
      const now = performance.now();
      if (d !== c.dist && (force || now - c.scoreT > 120)) {
        c.dist = d;
        el.hudDist.textContent = t('meters', { n: fmtNum(d) });
      }
    }
    const now = performance.now();
    if (h.score !== c.score && (force || now - c.scoreT > 120)) {
      c.score = h.score;
      c.scoreT = now;
      el.hudScore.textContent = fmtNum(h.score);
    }
    if (h.power !== c.power) {
      c.power = h.power;
      el.hudPower.hidden = !h.power;
      if (h.power) {
        el.hudPower.classList.toggle('slow', h.power === 'puddle' || h.power === 'leaflet');
        el.hudPower.classList.toggle('boss', h.power === 'boss');
        el.hudPowerIco.textContent = POWER_ICON[h.power] || '⭐';
        anim(el.hudPower, { scale: [0.4, 1] }, { duration: 0.45, spring: true });
      }
    }
    if (h.power) {
      const r = Math.round(h.powerFrac * 60) / 60;
      if (r !== c.ring) {
        c.ring = r;
        el.hudPowerRing.style.strokeDashoffset = String(RING * (1 - r));
      }
    }
  }

  // ---------------- countdown ----------------
  async function countdown({ rain, mode }) {
    const my = ++countToken;
    el.countdown.hidden = false;
    el.weather.textContent = mode === 'endless' ? t('endlessIntro') : rain ? t('weatherRain') : t('weatherSun');
    el.weatherTip.textContent = mode === 'endless' ? '' : rain ? t('rainTip') : t('sunTip');
    el.weatherTip.hidden = mode === 'endless';
    anim(el.weather, { y: [-40, 0], opacity: [0, 1], scale: [0.7, 1] }, { duration: 0.6, spring: true });
    const steps = [3, 2, 1, 0];
    for (const n of steps) {
      if (my !== countToken) return false;
      el.countNum.classList.toggle('go', n === 0);
      el.countNum.textContent = n ? fmtNum(n) : t('cdGo');
      sfx(n ? 'beep' : 'go');
      anim(el.countNum, { scale: [2.2, 1], opacity: [0, 1], rotate: [n % 2 ? -12 : 12, 0] }, { duration: 0.5, spring: true, bounce: 0.55, keep: true });
      await wait(n ? 700 : 550);
    }
    if (my !== countToken) return false;
    await anim([el.countNum, el.weather, el.weatherTip], { opacity: [1, 0], scale: [1, 1.3] }, { duration: 0.2, keep: true });
    if (my !== countToken) return false;
    el.countdown.hidden = true;
    [el.countNum, el.weather, el.weatherTip].forEach((n) => {
      n.style.transform = '';
      n.style.opacity = '';
    });
    return true;
  }
  function cancelCountdown() {
    countToken++;
    el.countdown.hidden = true;
  }

  // ---------------- boss call ----------------
  function showBossCall(on) {
    if (on) {
      el.boss.hidden = false;
      anim(el.boss, { scale: [0.3, 1], opacity: [0, 1] }, { duration: 0.4, spring: true });
    } else if (!el.boss.hidden) {
      el.boss.hidden = true;
    }
  }

  // ---------------- pause ----------------
  function showPause() {
    el.pause.hidden = false;
    anim(el.pause, { opacity: [0, 1] }, { duration: 0.2 });
    anim($('.overlay-card', el.pause), { scale: [0.8, 1], y: [30, 0] }, { duration: 0.45, spring: true });
    $('[data-action="resume"]', el.pause).focus({ preventScroll: true });
  }
  function hidePause() {
    el.pause.hidden = true;
  }

  // ---------------- result ----------------
  const confettiFx = new Effects({ maxParticles: 160, maxTexts: 1, maxDrops: 1 });
  let confettiActive = 0;
  addMini($('#confetti-canvas'), (ctx, w, h, time, dt) => {
    confettiFx.update(dt, 0);
    confettiFx.draw(ctx);
    confettiActive -= dt;
  }, () => !el.result.hidden && confettiActive > 0);

  const poseOpts = { outline: '#2A1E3B', phase: 0 };
  addMini($('#result-pose'), (ctx, w, h, time) => {
    if (!resultData) return;
    const P = pal();
    poseOpts.outline = P.outline;
    const win = resultData.win;
    const sc = Math.min(w / 120, h / 140);
    ctx.fillStyle = 'rgba(20,10,30,0.2)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 8, 28 * sc, 6 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(w / 2, h - 8);
    ctx.scale(sc, sc);
    drawCharacter(ctx, resultData.role, win ? 'win' : 'lose', time, poseOpts);
    ctx.restore();
    if (!win) {
      // a tiny rain cloud follows the sad character around
      const cx = w / 2 + Math.sin(time * 1.3) * 6;
      const cy = h - 8 - 100 * sc;
      ctx.fillStyle = getTheme() === 'dark' ? '#5A5470' : '#9CA3B5';
      ctx.strokeStyle = P.outline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx - 16 * sc, cy, 10 * sc, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(cx - 4 * sc, cy - 8 * sc, 12 * sc, Math.PI, Math.PI * 1.9);
      ctx.arc(cx + 12 * sc, cy - 2 * sc, 10 * sc, Math.PI * 1.3, Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#7FD3FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const dx = cx - 14 * sc + i * 9 * sc;
        const dy = cy + 10 * sc + ((time * 60 + i * 13) % (22 * sc));
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx - 2, dy + 6);
      }
      ctx.stroke();
    }
  }, () => !el.result.hidden);

  function mainKey(r) {
    if (r.mode === 'endless') return 'resEndless';
    if (r.role === 'employee') return r.win ? 'resEmployeeWin' : 'resEmployeeLose';
    return r.win ? 'resStudentWin' : 'resStudentLose';
  }

  function pickSub(r) {
    if (r.mode === 'endless') return ['subEndless', Math.floor(Math.random() * listLength('subEndless'))];
    const own = r.role === 'employee' ? (r.win ? 'subEmployeeWin' : 'subEmployeeLose') : r.win ? 'subStudentWin' : 'subStudentLose';
    if (!r.win && Math.random() < 0.3) return ['subAnyLose', Math.floor(Math.random() * listLength('subAnyLose'))];
    return [own, Math.floor(Math.random() * listLength(own))];
  }

  function statValues(r, info) {
    let timeLabel;
    let timeVal;
    if (r.mode === 'endless') {
      timeLabel = t('statTime');
      timeVal = t('outOfLives');
    } else if (r.win) {
      timeLabel = t('statArrival');
      timeVal = fmtClock(r.clock);
    } else {
      timeLabel = t('statTime');
      timeVal = r.reason === 'time' ? t('timeUp') : t('outOfLives');
    }
    return { timeLabel, timeVal, best: info.best };
  }

  function renderResultText(countUp) {
    const r = resultData;
    const info = resultInfo;
    el.resultTitle.textContent = t(mainKey(r));
    el.resultTitle.className = 'title-mid result-title ' + (r.win ? 'win' : 'lose');
    el.resultSub.textContent = tAt(resultSubKey, resultSubIdx);
    const v = statValues(r, info);
    $('#st-time-label').textContent = v.timeLabel;
    $('#st-time').textContent = v.timeVal;
    const fields = [
      ['#st-dist', r.distM / 1000, (x) => t('km', { n: fmtNum(x, 2) })],
      ['#st-dodged', r.dodged, (x) => fmtNum(Math.round(x))],
      ['#st-cha', r.cha, (x) => t(Math.round(x) === 1 ? 'cup' : 'cups', { n: fmtNum(Math.round(x)) })],
      ['#st-score', r.score, (x) => fmtNum(Math.round(x))],
      ['#st-best', info.best, (x) => fmtNum(Math.round(x))]
    ];
    cancelAnimationFrame(countRaf);
    if (!countUp || reduceMQ.matches) {
      fields.forEach(([sel, val, f]) => ($(sel).textContent = f(val)));
      return;
    }
    const start = performance.now();
    const dur = 1100;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      fields.forEach(([sel, val, f]) => ($(sel).textContent = f(val * e)));
      if (k < 1) countRaf = requestAnimationFrame(step);
    };
    countRaf = requestAnimationFrame(step);
  }

  function showResult(r, info) {
    resultData = r;
    resultInfo = info;
    [resultSubKey, resultSubIdx] = pickSub(r);
    el.result.hidden = false;
    el.newBest.hidden = !info.newBest;
    el.endlessBtn.hidden = !info.showEndless;
    renderResultText(true);
    const card = $('.result-card', el.result);
    anim(el.result, { opacity: [0, 1] }, { duration: 0.25 });
    if (r.win) {
      anim(card, { scale: [0.6, 1], y: [60, 0] }, { duration: 0.7, spring: true, bounce: 0.5 });
      const cv = $('#confetti-canvas');
      confettiFx.clear();
      const w = cv.clientWidth || window.innerWidth;
      const h = cv.clientHeight || window.innerHeight;
      confettiFx.confetti(w * 0.3, h * 0.45, 60, Math.max(420, h * 0.8));
      confettiFx.confetti(w * 0.7, h * 0.45, 60, Math.max(420, h * 0.8));
      confettiActive = 4;
    } else {
      // a gentle "boing" shake
      anim(card, { y: [80, 0], opacity: [0, 1] }, { duration: 0.5, spring: true, bounce: 0.35 }).then(() =>
        anim(card, { x: [0, -16, 14, -10, 6, -2, 0], rotate: [0, -2, 2, -1, 1, 0, 0] }, { duration: 0.6 })
      );
    }
    anim($$('.stat', el.result), { y: [20, 0], opacity: [0, 1] }, { duration: 0.4, stagger: 0.06, delay: 0.25 });
    setTimeout(() => {
      const b = $('[data-action="play-again"]', el.result);
      if (!el.result.hidden) b.focus({ preventScroll: true });
    }, 60);
    kickMini();
  }

  function hideResult() {
    el.result.hidden = true;
    confettiActive = 0;
    cancelAnimationFrame(countRaf);
  }

  function resultMainText() {
    return resultData ? t(mainKey(resultData)) : '';
  }

  // ---------------- toast ----------------
  let toastTimer = 0;
  function toast(text, ms = 2400) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function isOverlayOpen() {
    return !el.pause.hidden || !el.result.hidden;
  }

  // a theme change should repaint the menu canvases immediately
  function refreshCanvases() {
    kickMini();
  }

  return {
    showScreen,
    applyI18n,
    syncControls,
    updateHud,
    resetHud,
    setLives,
    countdown,
    cancelCountdown,
    showBossCall,
    showPause,
    hidePause,
    showResult,
    hideResult,
    resultMainText,
    toast,
    isOverlayOpen,
    refreshCanvases,
    get screen() {
      return current;
    }
  };
}
