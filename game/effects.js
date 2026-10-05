/*
 * effects.js — eye candy: particles, rain, floating text, screen shake, flash.
 *
 * Performance trick: "object pooling". We create all particle objects ONCE
 * at start-up and recycle them forever. Creating new objects every frame
 * makes the garbage collector pause the game (stutter on phones), so the
 * hot loop never allocates.
 *
 * Particle types: dust, splash, confetti, steam, sparkle, speed line,
 * leaflet (paper), petal. Rain is a separate pool of falling streaks.
 */

const T_DUST = 1;
const T_SPLASH = 2;
const T_CONFETTI = 3;
const T_STEAM = 4;
const T_SPARKLE = 5;
const T_SPEED = 6;
const T_LEAF = 7;
const T_STAR = 8;

const CONFETTI_COLORS = ['#E6397D', '#FFC72C', '#00A6A6', '#1FA67A', '#F42A41', '#7B5CFF', '#FF8A65'];

function makeParticle() {
  return {
    active: false, type: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0,
    life: 0, max: 1, size: 1, color: '#fff', rot: 0, vr: 0, drag: 0
  };
}

export class Effects {
  constructor({ maxParticles = 360, maxTexts = 12, maxDrops = 150 } = {}) {
    this.parts = [];
    for (let i = 0; i < maxParticles; i++) this.parts.push(makeParticle());
    this.cursor = 0;

    this.texts = [];
    for (let i = 0; i < maxTexts; i++) {
      this.texts.push({ active: false, text: '', x: 0, y: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 24 });
    }
    this.textCursor = 0;

    this.drops = [];
    for (let i = 0; i < maxDrops; i++) this.drops.push({ x: 0, y: 0, len: 10, speed: 600 });
    this.raining = false;
    this.rainW = 640;
    this.rainH = 360;
    this.wind = 0.28; // horizontal slant of the rain

    this.trauma = 0; // screen shake amount, 0..1
    this.shakeX = 0;
    this.shakeY = 0;
    this.flashA = 0;
    this.flashColor = '#ffffff';
    this.reduced = false;
    this.time = 0;
  }

  setReduced(r) {
    this.reduced = !!r;
  }

  clear() {
    for (const p of this.parts) p.active = false;
    for (const t of this.texts) t.active = false;
    this.trauma = 0;
    this.flashA = 0;
    this.shakeX = this.shakeY = 0;
  }

  // ---------- particles ----------

  _next() {
    const n = this.parts.length;
    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      if (!this.parts[idx].active) {
        this.cursor = (idx + 1) % n;
        return this.parts[idx];
      }
    }
    // Pool full: overwrite the oldest slot instead of allocating.
    const p = this.parts[this.cursor];
    this.cursor = (this.cursor + 1) % n;
    return p;
  }

  emit(type, x, y, vx, vy, life, size, color, g = 0, drag = 0) {
    const p = this._next();
    p.active = true;
    p.type = type;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.color = color;
    p.g = g;
    p.drag = drag;
    p.rot = Math.random() * 6.28;
    p.vr = (Math.random() - 0.5) * 10;
    return p;
  }

  _count(n) {
    return this.reduced ? Math.max(1, Math.round(n * 0.4)) : n;
  }

  dust(x, y, n = 6) {
    n = this._count(n);
    for (let i = 0; i < n; i++) {
      this.emit(T_DUST, x + (Math.random() - 0.5) * 20, y, (Math.random() - 0.5) * 90, -Math.random() * 40, 0.45, 5 + Math.random() * 5, 'rgba(200,185,170,0.8)', 0, 2);
    }
  }

  splash(x, y, n = 14, big = false) {
    n = this._count(n);
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.random() * Math.PI;
      const sp = (big ? 220 : 140) * (0.5 + Math.random());
      this.emit(T_SPLASH, x + (Math.random() - 0.5) * 30, y, Math.cos(a) * sp, Math.sin(a) * sp * 1.3, 0.6, 2.5 + Math.random() * 3, Math.random() < 0.5 ? '#7FD3FF' : '#BDEBFF', 700);
    }
  }

  confetti(x, y, n = 40, spread = 300) {
    n = this._count(n);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = spread * (0.4 + Math.random() * 0.8);
      this.emit(T_CONFETTI, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 2.2 + Math.random(), 5 + Math.random() * 5, CONFETTI_COLORS[i % CONFETTI_COLORS.length], 380, 1.4);
    }
  }

  steam(x, y) {
    if (this.reduced && Math.random() < 0.6) return;
    this.emit(T_STEAM, x + (Math.random() - 0.5) * 8, y, -30 - Math.random() * 30, -30 - Math.random() * 20, 0.7, 5 + Math.random() * 4, 'rgba(255,255,255,0.7)', 0, 0.5);
  }

  sparkle(x, y, color = '#FFE27A', n = 4) {
    n = this._count(n);
    for (let i = 0; i < n; i++) {
      this.emit(T_SPARKLE, x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60 - 20, 0.5 + Math.random() * 0.3, 3 + Math.random() * 3, color, 0, 1);
    }
  }

  speedLine(x, y) {
    if (this.reduced && Math.random() < 0.7) return;
    this.emit(T_SPEED, x, y, -900, 0, 0.25, 30 + Math.random() * 40, 'rgba(255,255,255,0.75)');
  }

  leaflets(x, y, n = 10) {
    n = this._count(n);
    for (let i = 0; i < n; i++) {
      this.emit(T_LEAF, x, y, (Math.random() - 0.3) * 260, -120 - Math.random() * 160, 1.4, 9, i % 3 ? '#FFFFFF' : '#FFE082', 260, 1.2);
    }
  }

  stars(x, y, n = 6) {
    n = this._count(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.emit(T_STAR, x, y, Math.cos(a) * 150, Math.sin(a) * 150 - 40, 0.55, 7, '#FFC72C', 200, 2);
    }
  }

  // ---------- floating text ----------

  floatText(text, x, y, color = '#FFC72C', size = 26) {
    const t = this.texts[this.textCursor];
    this.textCursor = (this.textCursor + 1) % this.texts.length;
    t.active = true;
    t.text = text;
    t.x = x;
    t.y = y;
    t.vy = -55;
    t.life = 1.3;
    t.max = 1.3;
    t.color = color;
    t.size = size;
  }

  // ---------- shake / flash ----------

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount * (this.reduced ? 0.25 : 1));
  }

  flash(alpha = 0.6, color = '#ffffff') {
    this.flashA = this.reduced ? alpha * 0.4 : alpha;
    this.flashColor = color;
  }

  // ---------- rain ----------

  setRain(on, w, h) {
    this.raining = on;
    this.rainW = w;
    this.rainH = h;
    const count = this.reduced ? Math.floor(this.drops.length * 0.4) : this.drops.length;
    this.rainCount = count;
    for (let i = 0; i < this.drops.length; i++) this._resetDrop(this.drops[i], true);
  }

  resizeRain(w, h) {
    this.rainW = w;
    this.rainH = h;
  }

  _resetDrop(d, anywhere) {
    d.x = Math.random() * (this.rainW + 200) - 50;
    d.y = anywhere ? Math.random() * this.rainH : -20 - Math.random() * 60;
    d.len = 10 + Math.random() * 14;
    d.speed = 650 + Math.random() * 350;
  }

  // ---------- update + draw ----------

  update(dt, worldSpeed = 0) {
    this.time += dt;
    const parts = this.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // ground-bound particles drift with the scrolling world
      if (p.type === T_DUST || p.type === T_SPLASH) p.x -= worldSpeed * dt;
      if (p.type === T_CONFETTI) p.vx += Math.sin(this.time * 6 + i) * 30 * dt;
      p.rot += p.vr * dt;
    }

    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      if (!t.active) continue;
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 1 - 1.5 * dt;
      if (t.life <= 0) t.active = false;
    }

    if (this.raining) {
      const n = this.rainCount;
      for (let i = 0; i < n; i++) {
        const d = this.drops[i];
        d.y += d.speed * dt;
        d.x -= d.speed * this.wind * dt + worldSpeed * 0.3 * dt;
        if (d.y > this.rainH || d.x < -40) this._resetDrop(d, false);
      }
    }

    // Shake uses trauma² so small hits wobble a little and big hits a lot.
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * 14;
    this.shakeX = s ? (Math.random() * 2 - 1) * s : 0;
    this.shakeY = s ? (Math.random() * 2 - 1) * s : 0;
    this.flashA = Math.max(0, this.flashA - dt * 2.5);
  }

  draw(ctx, font) {
    const parts = this.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.active) continue;
      const k = p.life / p.max;
      switch (p.type) {
        case T_DUST:
        case T_STEAM: {
          ctx.globalAlpha = k * 0.8;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.8 - k), 0, 6.283);
          ctx.fill();
          break;
        }
        case T_SPLASH: {
          ctx.globalAlpha = Math.min(1, k * 1.5);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, 6.283);
          ctx.fill();
          break;
        }
        case T_CONFETTI:
        case T_LEAF: {
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.rot * 1.7));
          ctx.fillStyle = p.color;
          if (p.type === T_LEAF) {
            ctx.fillRect(-p.size * 0.6, -p.size * 0.8, p.size * 1.2, p.size * 1.6);
            ctx.fillStyle = 'rgba(42,30,59,0.5)';
            ctx.fillRect(-p.size * 0.4, -p.size * 0.4, p.size * 0.8, 1.5);
            ctx.fillRect(-p.size * 0.4, 0, p.size * 0.8, 1.5);
          } else {
            ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
          }
          ctx.restore();
          break;
        }
        case T_SPARKLE:
        case T_STAR: {
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          const r = p.size * (p.type === T_STAR ? 1 : 0.5 + k);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - r);
          ctx.lineTo(p.x + r * 0.3, p.y - r * 0.3);
          ctx.lineTo(p.x + r, p.y);
          ctx.lineTo(p.x + r * 0.3, p.y + r * 0.3);
          ctx.lineTo(p.x, p.y + r);
          ctx.lineTo(p.x - r * 0.3, p.y + r * 0.3);
          ctx.lineTo(p.x - r, p.y);
          ctx.lineTo(p.x - r * 0.3, p.y - r * 0.3);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case T_SPEED: {
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.size, p.y);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;

    if (font) this.drawTexts(ctx, font);
  }

  drawTexts(ctx, font) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      if (!t.active) continue;
      const k = t.life / t.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = font(800, Math.round(t.size * pop));
      // keep long phrases fully on screen
      const half = ctx.measureText(t.text).width / 2 + 8;
      const x = Math.max(half, Math.min(this.rainW - half, t.x));
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#2A1E3B';
      ctx.strokeText(t.text, x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  drawRain(ctx) {
    if (!this.raining) return;
    ctx.strokeStyle = 'rgba(190, 220, 255, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const n = this.rainCount;
    const w = this.wind;
    // One path for every drop = one draw call (much faster than 150 strokes).
    for (let i = 0; i < n; i++) {
      const d = this.drops[i];
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.len * w, d.y - d.len);
    }
    ctx.stroke();
  }

  drawFlash(ctx, w, h) {
    if (this.flashA <= 0.01) return;
    ctx.globalAlpha = this.flashA;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}
