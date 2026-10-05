/*
 * engine.js — the heart of the game: loop, rules, collisions, drawing order.
 *
 * Game states:
 *   'idle'    nothing running (menus)
 *   'ready'   scene drawn, countdown showing, nothing moves yet
 *   'playing' the run is on
 *   'paused'  frozen (pause menu open)
 *   'ending'  short win/lose animation before the result screen
 *   'over'    result screen is showing
 *
 * The loop uses "delta time": every movement is multiplied by the seconds
 * since the last frame, so the game runs at the same speed on 60 Hz and
 * 120 Hz screens. dt is capped at 50 ms so a tab switch can't teleport you.
 *
 * Want to make the game easier or harder? Tweak CONFIG below.
 */

import { Player } from './player.js';
import { EntityManager, Spawner } from './entities.js';
import { Background, FOOTPATH_DEPTH } from './background.js';
import { Effects } from './effects.js';
import { sfx } from '../js/audio.js';
import { t, pick, canvasFont, fmtNum, getLang } from '../js/i18n.js';

// ======================================================================
//  CONFIG — every tunable number in one place
// ======================================================================
export const CONFIG = {
  story: {
    distanceM: 3000, // 3.0 km to school / office
    startMin: 8 * 60 + 20, // clock starts at 8:20 AM
    endMin: 9 * 60, // ...and you must arrive before 9:00 AM
    realSeconds: 90 // 8:20 → 9:00 takes 90 real seconds
  },
  endless: {
    rampSec: 120 // difficulty reaches max after this many seconds
  },
  speed: {
    base: 300, // starting run speed (world px / second)
    ramp: 1.6, // story: speed gained per second
    storyMax: 450,
    endlessRamp: 2.6, // endless keeps getting faster...
    endlessMax: 840,
    boostMult: 1.4, // cha = +40% speed
    slowMult: 0.55 // puddles / leaflets slow you to 55%
  },
  metersPerPx: 0.102, // converts scrolled pixels into "game meters"
  lives: 3,
  invincibleSec: 1.2,
  hitPenaltyMin: 1, // each hit costs 1 in-game minute
  knockbackSec: 0.9,
  fallSec: 0.8, // time spent down a manhole
  laneChangeSec: 0.12,
  jumpSec: 0.55,
  jumpHeight: 70,
  boostSec: 3,
  puddleSlowSec: 2,
  leafletSlowSec: 1.5,
  bossCallSec: 2,
  shortcutMin: 2, // alley shortcut gives back 2 minutes
  cngWarnSec: 1.0,
  vipWarnSec: 1.5,
  rainChance: 0.4,
  spawn: {
    gapMaxPx: 560, // distance between obstacle waves at the start...
    gapMinPx: 300, // ...and at full difficulty
    jitterMaxPx: 220,
    jitterMinPx: 110,
    powerUpChance: 0.2
  },
  view: {
    minW: 600, // at least this much world is always visible horizontally
    minWPortrait: 480, // phones held upright: zoom in a bit so characters stay big
    minH: 340,
    roadH: 170
  },
  dtCap: 0.05
};

const PLAYER_HALF_W = 14;

function laneScale(f) {
  return 0.86 + 0.07 * f; // far lanes look a bit smaller (2.5D)
}

export class Game {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.cb = callbacks;
    this.player = new Player();
    this.entities = new EntityManager();
    this.spawner = new Spawner(this.entities, CONFIG);
    this.bg = new Background();
    this.fx = new Effects();
    this.state = 'idle';
    this.mode = 'story';
    this.role = 'student';
    this.running = false;
    this.time = 0;
    this.nightness = 0;
    this.nightTarget = 0;
    this.parallax = 1;
    this.view = { cssW: 1, cssH: 1, dpr: 1, scale: 1, w: 600, h: 340, roadTop: 0, roadBottom: 0, pathTop: 0, laneH: 1, playerX: 120 };
    this.run = this._freshRun();
    this.hud = { clock: 0, urgent: false, progress: 0, lives: 3, score: 0, power: null, powerFrac: 0, mode: 'story', distM: 0 };
    this.drawList = [];
    this.playerMarker = { isPlayer: true, laneF: 1 };
    this.entOpts = { outline: '#2A1E3B', night: 0, variant: 0, alert: false, label: '', font: canvasFont };
    this._frame = this._frame.bind(this);
    this._sortFn = (a, b) => a.laneF - b.laneF;

    this.entities.onEvent = (name, e) => this._onEntityEvent(name, e);
    this.resize();
  }

  _freshRun() {
    return {
      time: 0, scroll: 0, distM: 0, speed: 0, clock: CONFIG.story.startMin,
      lives: CONFIG.lives, coins: 0, cha: 0, pickups: 0, dodged: 0,
      slowTimer: 0, slowKind: '', slowMax: 1, knock: 0, nudge: 0, bossTimer: 0,
      difficulty: 0, rain: false, rainAmt: 0, over: false, win: false, reason: '',
      endTimer: 0, wasFalling: false, sparkleT: 0
    };
  }

  // ------------------------------------------------------------------
  //  Public API (used by main.js / ui.js)
  // ------------------------------------------------------------------

  setRole(role) {
    this.role = role;
    this.player.role = role;
  }

  setNight(isDark, instant = false) {
    this.nightTarget = isDark ? 1 : 0;
    if (instant) this.nightness = this.nightTarget;
    if (isDark) this.bg.build(this.view.scale * this.view.dpr, true);
  }

  setReduced(r) {
    this.fx.setReduced(r);
    this.parallax = r ? 0.5 : 1;
  }

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const v = this.view;
    v.cssW = cssW;
    v.cssH = cssH;
    v.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    const portrait = cssH > cssW * 1.1;
    const minW = portrait ? CONFIG.view.minWPortrait : CONFIG.view.minW;
    v.scale = Math.min(cssW / minW, cssH / CONFIG.view.minH);
    v.w = cssW / v.scale;
    v.h = cssH / v.scale;
    const near = Math.min(150, v.h * 0.12 + 24);
    v.roadBottom = v.h - near;
    v.roadTop = v.roadBottom - CONFIG.view.roadH;
    v.pathTop = v.roadTop - FOOTPATH_DEPTH;
    v.laneH = CONFIG.view.roadH / 3;
    v.playerX = portrait ? Math.max(84, v.w * 0.18) : Math.max(110, v.w * 0.2);
    this.bg.build(v.scale * dpr, this.nightTarget > 0 || this.nightness > 0);
    this.fx.resizeRain(v.w, v.h);
    if (!this.running && this.state !== 'idle') this.render();
  }

  laneY(f) {
    return this.view.roadTop + this.view.laneH * (f + 0.5) + 10;
  }

  /** Reset everything for a new run and show the starting scene. */
  prepare(mode) {
    this.mode = mode;
    this.run = this._freshRun();
    this.run.rain = Math.random() < CONFIG.rainChance;
    this.run.rainAmt = this.run.rain ? 1 : 0;
    this.player.reset(1);
    this.player.role = this.role;
    this.player.endPose = 'idle';
    this.entities.clear();
    this.spawner.reset();
    this.fx.clear();
    this.fx.setRain(this.run.rain, this.view.w, this.view.h);
    this.state = 'ready';
    this._updateHud();
    return { rain: this.run.rain };
  }

  start() {
    if (this.state !== 'ready') return;
    this.player.endPose = null;
    this.state = 'playing';
    this.run.speed = CONFIG.speed.base * 0.6;
  }

  pause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      return true;
    }
    return false;
  }

  resume() {
    if (this.state === 'paused') this.state = 'playing';
  }

  isPlaying() {
    return this.state === 'playing';
  }

  laneUp() {
    if (this.state === 'playing' && this.player.moveLane(-1)) this._laneFx();
  }

  laneDown() {
    if (this.state === 'playing' && this.player.moveLane(1)) this._laneFx();
  }

  jump() {
    if (this.state === 'playing' && this.player.jump()) sfx('jump');
  }

  _laneFx() {
    const p = this.player;
    this.fx.dust(this.view.playerX - 10, this.laneY(p.laneF), 3);
  }

  startLoop() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._frame);
  }

  stopLoop() {
    this.running = false;
  }

  // ------------------------------------------------------------------
  //  Main loop
  // ------------------------------------------------------------------

  _frame(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > CONFIG.dtCap) dt = CONFIG.dtCap;
    if (dt < 0) dt = 0;
    this.time += dt;

    // smooth day ↔ night fade (~1 s)
    if (this.nightness !== this.nightTarget) {
      const step = dt / 1.0;
      this.nightness += Math.sign(this.nightTarget - this.nightness) * Math.min(step, Math.abs(this.nightTarget - this.nightness));
    }

    if (this.state === 'playing') this._update(dt);
    else if (this.state === 'ending') this._updateEnding(dt);
    else if (this.state === 'ready' || this.state === 'over') {
      this.player.update(dt, 0, CONFIG);
      this.fx.update(dt, 0);
    }

    this.render();
    requestAnimationFrame(this._frame);
  }

  _baseSpeed() {
    const S = CONFIG.speed;
    const r = this.run;
    return this.mode === 'story'
      ? Math.min(S.storyMax, S.base + S.ramp * r.time)
      : Math.min(S.endlessMax, S.base + S.endlessRamp * r.time);
  }

  _update(dt) {
    const C = CONFIG;
    const r = this.run;
    const p = this.player;
    const v = this.view;
    r.time += dt;
    r.difficulty = this.mode === 'story' ? Math.min(1, r.distM / C.story.distanceM) : Math.min(1, r.time / C.endless.rampSec);

    // ---- speed ----
    let m = 1;
    if (p.boostTimer > 0) m *= C.speed.boostMult;
    if (r.slowTimer > 0) {
      r.slowTimer -= dt;
      m *= C.speed.slowMult;
    }
    if (r.knock > 0) {
      r.knock -= dt;
      m *= 1 - 0.7 * Math.max(0, r.knock / C.knockbackSec);
    }
    if (p.fallTimer > 0) m = 0;
    const target = this._baseSpeed() * m;
    r.speed += (target - r.speed) * Math.min(1, dt * 6);
    const speed = r.speed;
    r.scroll += speed * dt;
    r.distM += speed * dt * C.metersPerPx;
    r.nudge -= r.nudge * Math.min(1, dt * 4);

    if (this.mode === 'story') {
      r.clock += (dt * (C.story.endMin - C.story.startMin)) / C.story.realSeconds;
    }

    // ---- player ----
    p.update(dt, speed / C.speed.base, C);
    const px = v.playerX - r.nudge;
    const py = this.laneY(p.laneF);
    if (p.justLanded) {
      this.fx.dust(px, py, 7);
      sfx('land');
    }
    if (r.wasFalling && p.fallTimer <= 0) {
      // pop back out of the manhole
      p.jump();
      this.fx.dust(px, py, 10);
    }
    r.wasFalling = p.fallTimer > 0;
    if (p.boostTimer > 0) {
      if (Math.random() < dt * 30) this.fx.speedLine(px + 40 + Math.random() * 200, py - 10 - Math.random() * 70);
      if (Math.random() < dt * 14) this.fx.steam(px - 16, py - 60 - p.jumpH);
    }

    // ---- entities ----
    const info = this._info();
    this.spawner.update(dt, speed, info);
    this.entities.update(dt, speed, info);
    this._collide(px);

    // glowing sparkle trail on power-ups
    r.sparkleT += dt;
    if (r.sparkleT > 0.12) {
      r.sparkleT = 0;
      const list = this.entities.list;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.def.kind === 'pickup' && e.type !== 'coin' && !e.hit && e.x < v.w) {
          this.fx.sparkle(e.x + 10, this.laneY(e.laneF) - 38 * laneScale(e.laneF), '#FFE27A', 1);
        }
      }
    }

    if (r.bossTimer > 0) {
      r.bossTimer -= dt;
      if (r.bossTimer <= 0 && this.cb.onBossCall) this.cb.onBossCall(false);
    }

    this.fx.update(dt, speed);
    this._updateHud();

    // ---- win / lose ----
    if (this.mode === 'story') {
      if (r.distM >= C.story.distanceM) this._finish(true, 'arrived');
      else if (r.clock >= C.story.endMin) this._finish(false, 'time');
    }
  }

  _info() {
    const r = this.run;
    const I = this._infoObj || (this._infoObj = {});
    I.difficulty = r.difficulty;
    I.role = this.role;
    I.rain = r.rain;
    I.lives = r.lives;
    I.maxLives = CONFIG.lives;
    I.playerLane = this.player.lane;
    I.playerX = this.view.playerX;
    I.viewW = this.view.w;
    I.mode = this.mode;
    I.speed = r.speed;
    I.noSpawn = this.mode === 'story' && (CONFIG.story.distanceM - r.distM) / CONFIG.metersPerPx < this.view.w + 300;
    return I;
  }

  _updateEnding(dt) {
    const r = this.run;
    r.speed *= Math.exp(-3 * dt);
    r.scroll += r.speed * dt;
    this.player.update(dt, 0.3, CONFIG);
    const info = this._info();
    info.noSpawn = true;
    this.entities.update(dt, r.speed, info);
    this.fx.update(dt, r.speed);
    r.endTimer -= dt;
    if (r.endTimer <= 0) {
      this.state = 'over';
      if (this.cb.onEnd) this.cb.onEnd(this._result());
    }
  }

  // ------------------------------------------------------------------
  //  Collisions & consequences
  // ------------------------------------------------------------------

  _collide(px) {
    const p = this.player;
    const r = this.run;
    const list = this.entities.list;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.hit || e.state === 'warn') continue;
      const def = e.def;

      // count obstacles that slipped past you without touching
      if (!e.passed && def.kind !== 'pickup') {
        const behind = e.type === 'cng' ? e.x - def.hw > px + 20 : e.x + def.hw < px - 20;
        if (behind) {
          e.passed = true;
          r.dodged++;
          continue;
        }
      }
      if (e.passed) continue;

      const s = laneScale(e.laneF);
      if (Math.abs(e.x - px) > def.hw * s + PLAYER_HALF_W) continue;
      if (Math.abs(e.laneF - p.laneF) > 0.5) continue;

      if (def.kind === 'pickup') {
        this._collect(e, px);
        continue;
      }
      if (p.jumpH > def.clear) continue; // sailed right over it
      if (p.fallTimer > 0) continue;
      this._hitBy(e, px);
      if (r.over) return;
    }
  }

  _hitBy(e, px) {
    const p = this.player;
    const r = this.run;
    const C = CONFIG;
    const py = this.laneY(p.laneF);
    const headY = py - 95;
    e.hit = true;

    if (e.type === 'puddle') {
      r.slowTimer = C.puddleSlowSec;
      r.slowMax = C.puddleSlowSec;
      r.slowKind = 'puddle';
      this.fx.splash(px + 10, py, 26, true);
      this.fx.floatText(t('ftSplash'), px, headY, '#7FD3FF');
      sfx('splash');
      return;
    }
    if (e.type === 'coaching') {
      r.slowTimer = C.leafletSlowSec;
      r.slowMax = C.leafletSlowSec;
      r.slowKind = 'leaflet';
      this.fx.leaflets(px + 10, py - 50, 14);
      this.fx.floatText(t('ftCoaching'), px + 20, headY, '#FFE082');
      sfx('leaflet');
      return;
    }
    if (e.type === 'phone') {
      r.bossTimer = C.bossCallSec;
      this.fx.floatText(t('bossCalling'), px + 20, headY, '#FF6B6B');
      this.fx.shake(0.3);
      sfx('ring');
      if (this.cb.onBossCall) this.cb.onBossCall(true);
      return;
    }

    // everything else costs a life
    if (p.invincible > 0) {
      e.passed = true; // no dodge credit, no damage
      e.hit = false;
      return;
    }
    r.lives--;
    p.invincible = C.invincibleSec;
    p.hitTimer = 0.7;
    r.knock = C.knockbackSec;
    r.nudge = 28;
    if (this.mode === 'story') r.clock += C.hitPenaltyMin;
    this.fx.shake(0.6);
    this.fx.flash(0.45, '#FFFFFF');
    this.fx.stars(px, headY + 10, 6);
    // Chrome logs an error if vibrate() runs before the page was ever tapped.
    const activated = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (navigator.vibrate && activated) {
      try {
        navigator.vibrate(100);
      } catch (err) {
        /* ignore */
      }
    }
    if (e.type === 'manhole') {
      p.fall(C.fallSec);
      p.hitTimer = 0;
      this.fx.floatText(t('ftPlop'), px, headY, '#FFC72C', 30);
      sfx('plop');
    } else {
      this.fx.floatText(pick('ftOuch'), px, headY, '#FF6B6B', 28);
      sfx('bonk');
    }
    if (this.mode === 'story') {
      this.fx.floatText(t('ftPlusMin', { n: fmtSmall(C.hitPenaltyMin) }), px + 60, headY + 30, '#FF8A65', 20);
    }
    if (this.cb.onLives) this.cb.onLives(r.lives, -1);
    if (r.lives <= 0) this._finish(false, 'lives');
  }

  _collect(e, px) {
    const p = this.player;
    const r = this.run;
    const C = CONFIG;
    const py = this.laneY(p.laneF);
    const headY = py - 95;
    e.hit = true;
    switch (e.type) {
      case 'coin':
        r.coins++;
        this.fx.sparkle(px + 10, py - 30, '#FFC72C', 4);
        sfx('coin');
        break;
      case 'cha':
        p.boostTimer = C.boostSec;
        r.cha++;
        r.pickups++;
        this.fx.floatText(t('ftCha'), px + 20, headY, '#FFC72C');
        this.fx.sparkle(px, py - 40, '#FF9EC4', 8);
        sfx('slurp');
        break;
      case 'shingara':
        r.pickups++;
        if (r.lives < C.lives) {
          r.lives++;
          this.fx.floatText(t('ftShingara'), px + 20, headY, '#FFC72C');
          if (this.cb.onLives) this.cb.onLives(r.lives, +1);
        } else {
          this.fx.floatText(t('ftShingaraFull'), px + 20, headY, '#FFC72C');
        }
        this.fx.sparkle(px, py - 40, '#FFC72C', 8);
        sfx('yum');
        break;
      case 'shortcut':
        r.pickups++;
        if (this.mode === 'story') r.clock = Math.max(C.story.startMin, r.clock - C.shortcutMin);
        this.fx.floatText(t('ftShortcut'), px + 20, headY, '#2EE6E6');
        this.fx.floatText(t('ftMinusMin', { n: fmtSmall(C.shortcutMin) }), px + 60, headY + 30, '#2EE59D', 20);
        this.fx.sparkle(px, py - 40, '#2EE6E6', 8);
        sfx('whoosh');
        break;
    }
  }

  _onEntityEvent(name, e) {
    switch (name) {
      case 'bell':
        sfx('bell');
        break;
      case 'horn':
        sfx('horn');
        break;
      case 'cngGo':
        sfx('cngHorn');
        break;
      case 'vipWarn':
        sfx('siren');
        break;
      case 'bark':
        sfx('bark');
        this.fx.floatText(t('ftWoof'), Math.min(e.x, this.view.w - 40), this.laneY(e.laneF) - 60, '#FFFFFF', 20);
        break;
    }
  }

  _finish(win, reason) {
    const r = this.run;
    if (r.over) return;
    r.over = true;
    r.win = win;
    r.reason = reason;
    r.endTimer = 1.5;
    this.state = 'ending';
    this.player.endPose = win ? 'win' : 'lose';
    this.player.boostTimer = 0;
    if (r.bossTimer > 0 && this.cb.onBossCall) this.cb.onBossCall(false);
    r.bossTimer = 0;
    const px = this.view.playerX;
    const py = this.laneY(this.player.laneF);
    if (win) {
      this.fx.confetti(px, py - 60, 70, 420);
      sfx('win');
    } else {
      this.fx.shake(0.35);
      sfx('lose');
    }
    this._updateHud();
    if (this.cb.onEnding) this.cb.onEnding(win);
  }

  _score() {
    const r = this.run;
    if (this.mode === 'endless') return Math.floor(r.distM);
    let s = Math.floor(r.distM) + r.coins * 20 + r.dodged * 10 + r.pickups * 50;
    if (r.over && r.win) s += Math.max(0, Math.floor((CONFIG.story.endMin - r.clock) * 100));
    return s;
  }

  _result() {
    const r = this.run;
    return {
      win: r.win,
      reason: r.reason,
      mode: this.mode,
      role: this.role,
      distM: this.mode === 'story' ? Math.min(r.distM, CONFIG.story.distanceM) : r.distM,
      clock: Math.min(r.clock, CONFIG.story.endMin),
      dodged: r.dodged,
      cha: r.cha,
      coins: r.coins,
      score: this._score(),
      rain: r.rain
    };
  }

  _updateHud() {
    const r = this.run;
    const h = this.hud;
    const p = this.player;
    h.mode = this.mode;
    h.clock = r.clock;
    h.urgent = this.mode === 'story' && r.clock >= CONFIG.story.endMin - 5;
    h.progress = Math.min(1, r.distM / CONFIG.story.distanceM);
    h.lives = r.lives;
    h.score = this._score();
    h.distM = r.distM;
    if (p.boostTimer > 0) {
      h.power = 'boost';
      h.powerFrac = p.boostTimer / CONFIG.boostSec;
    } else if (r.slowTimer > 0) {
      h.power = r.slowKind;
      h.powerFrac = r.slowTimer / r.slowMax;
    } else if (r.bossTimer > 0) {
      h.power = 'boss';
      h.powerFrac = r.bossTimer / CONFIG.bossCallSec;
    } else {
      h.power = null;
      h.powerFrac = 0;
    }
    if (this.cb.onHud) this.cb.onHud(h);
  }

  // ------------------------------------------------------------------
  //  Rendering
  // ------------------------------------------------------------------

  render() {
    const ctx = this.ctx;
    const v = this.view;
    const r = this.run;
    const n = this.nightness;
    const fx = this.fx;
    const k = v.dpr * v.scale;
    const outline = n > 0.5 ? '#000000' : '#2A1E3B';

    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.save();
    ctx.translate(fx.shakeX, fx.shakeY);
    if (r.bossTimer > 0) {
      // "boss is calling" wobble — controls still work
      const w = Math.sin(this.time * 22) * 0.012 * (fx.reduced ? 0.3 : 1);
      ctx.translate(v.w / 2, v.h / 2);
      ctx.rotate(w);
      ctx.translate(-v.w / 2, -v.h / 2);
    }

    const rainAmt = r.rain ? 1 : 0;
    this.bg.drawBack(ctx, v, r.scroll, n, rainAmt, this.time, this.parallax);

    if (this.mode === 'story') {
      const remainPx = (CONFIG.story.distanceM - r.distM) / CONFIG.metersPerPx;
      if (remainPx < v.w + 200) {
        const label = this.role === 'employee' ? t('destOffice') : t('destSchool');
        this.bg.drawDestination(ctx, v.playerX + remainPx - 110, v, this.role, label, canvasFont, n);
      }
    }

    this.bg.drawRoad(ctx, v, r.scroll, n, rainAmt, this.time);
    this.bg.drawStreetlights(ctx, v, r.scroll, n);

    const list = this.entities.list;
    const eo = this.entOpts;
    eo.outline = outline;
    eo.night = n;
    eo.label = t('bossLabel');

    // flat things on the road first (manholes, puddles)
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.def.kind !== 'ground') continue;
      this._drawEntity(ctx, e);
    }

    this._drawWarnings(ctx);

    // shadows
    ctx.fillStyle = 'rgba(20, 10, 30, 0.25)';
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.def.shadow <= 0 || (e.def.kind === 'pickup' && e.hit) || e.state === 'warn') continue;
      const s = laneScale(e.laneF);
      ctx.beginPath();
      ctx.ellipse(e.x, this.laneY(e.laneF), e.def.shadow * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = this.player;
    const px = v.playerX - r.nudge;
    const py = this.laneY(p.laneF);
    const ps = laneScale(p.laneF);
    if (p.fallTimer <= 0) {
      const shrink = 1 - Math.min(0.6, p.jumpH / 120);
      ctx.beginPath();
      ctx.ellipse(px, py, 20 * ps * shrink, 6 * ps * shrink, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // y-sort: things lower on screen (nearer lanes) are drawn later / in front
    const dl = this.drawList;
    dl.length = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.def.kind === 'ground' || e.state === 'warn') continue;
      if (e.def.kind === 'pickup' && e.hit) continue;
      dl.push(e);
    }
    this.playerMarker.laneF = p.laneF + 0.001;
    dl.push(this.playerMarker);
    dl.sort(this._sortFn);
    for (let i = 0; i < dl.length; i++) {
      const it = dl[i];
      if (it.isPlayer) p.draw(ctx, px, py, ps, outline, CONFIG.fallSec);
      else this._drawEntity(ctx, it);
    }

    fx.draw(ctx, canvasFont, getLang() === 'bn');
    fx.drawRain(ctx);

    if (n > 0.02) {
      // gentle night vignette at the top
      ctx.globalAlpha = n * 0.25;
      ctx.fillStyle = '#0E0B1F';
      ctx.fillRect(0, 0, v.w, v.pathTop * 0.4);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    fx.drawFlash(ctx, v.w, v.h);
  }

  _drawEntity(ctx, e) {
    const s = laneScale(e.laneF);
    const y = this.laneY(e.laneF);
    const eo = this.entOpts;
    eo.variant = e.variant;
    eo.alert = e.type === 'dog' && e.alert > 0;
    ctx.save();
    ctx.translate(e.x, y);
    ctx.scale(s, s);
    e.def.draw(ctx, e.t, eo);
    ctx.restore();
  }

  _drawWarnings(ctx) {
    const list = this.entities.list;
    const v = this.view;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.state !== 'warn') continue;
      const y = this.laneY(e.laneF);
      const blink = Math.floor(this.time * 8) % 2 === 0;
      if (e.type === 'vip') {
        // flashing red/blue band across the lane the convoy will sweep
        const top = y - v.laneH + 6;
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = blink ? '#FF2D3D' : '#3355FF';
        ctx.fillRect(0, top, v.w, v.laneH - 4);
        ctx.globalAlpha = 1;
        ctx.font = '700 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚨', v.w - 30, top + (v.laneH - 4) / 2);
      } else if (e.type === 'cng') {
        // arrow on the left edge: "something is coming from behind!"
        const ax = 14;
        const ay = y - 30;
        ctx.globalAlpha = blink ? 1 : 0.45;
        ctx.beginPath();
        ctx.moveTo(ax, ay - 14);
        ctx.lineTo(ax + 22, ay - 14);
        ctx.lineTo(ax + 22, ay - 24);
        ctx.lineTo(ax + 46, ay);
        ctx.lineTo(ax + 22, ay + 24);
        ctx.lineTo(ax + 22, ay + 14);
        ctx.lineTo(ax, ay + 14);
        ctx.closePath();
        ctx.fillStyle = '#FFC72C';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2A1E3B';
        ctx.stroke();
        ctx.fillStyle = '#2A1E3B';
        ctx.font = '800 20px "Baloo 2", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', ax + 18, ay + 1);
        ctx.globalAlpha = 1;
      }
    }
  }
}

// small helper so "+1 min" uses Bangla digits in Bangla mode
function fmtSmall(n) {
  return fmtNum(n);
}
