/*
 * background.js — the scrolling city of Dhaka behind the road.
 *
 * Layers (back to front), each moving at its own speed = "parallax":
 *   1. sky gradient + sun & clouds (day) / moon & stars (night) + kites
 *   2. far skyline: towers, a mosque dome, water tanks         (slow)
 *   3. mid buildings: shop signs, billboards, tangled wires    (medium)
 *   4. footpath: tea stall, people, a rickshaw stand           (fast)
 *   5. the road itself with scrolling lane dashes             (fastest)
 *
 * Layers 2–4 are painted ONCE into off-screen canvases ("tiles") and then
 * just copied every frame — much cheaper than redrawing hundreds of shapes.
 * Day and night versions are both kept so the theme can cross-fade.
 */

import { PALETTES, mixColor } from '../js/theme.js';
import { drawRickshaw } from './entities.js';

const FAR_W = 1100;
const FAR_H = 260;
const MID_W = 1300;
const MID_H = 230;
const PATH_W = 1000;
const PATH_H = 120;
export const FOOTPATH_DEPTH = 34; // height of the footpath strip above the road

// Tiny seeded random generator so day and night tiles share the same layout.
function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTile(w, h, ps, paint) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * ps));
  c.height = Math.max(1, Math.round(h * ps));
  const g = c.getContext('2d');
  g.scale(ps, ps);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  paint(g);
  return c;
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Squiggles under a straight "matra" line read as Bangla signboard text. */
function banglaScribble(g, x, y, w, color, size = 1) {
  g.strokeStyle = color;
  g.lineWidth = 1.6 * size;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  let cx = x + 3 * size;
  let flip = 0;
  while (cx < x + w - 6 * size) {
    const step = (5 + ((cx * 7) % 4)) * size;
    g.moveTo(cx, y);
    if (flip % 3 === 0) {
      g.quadraticCurveTo(cx - 2 * size, y + 5 * size, cx + 2 * size, y + 6 * size);
      g.quadraticCurveTo(cx + 5 * size, y + 6 * size, cx + 4 * size, y + 2 * size);
    } else if (flip % 3 === 1) {
      g.lineTo(cx, y + 7 * size);
      g.moveTo(cx + 3 * size, y);
      g.quadraticCurveTo(cx + 6 * size, y + 4 * size, cx + 2 * size, y + 5 * size);
    } else {
      g.arc(cx + 2 * size, y + 4 * size, 2.4 * size, -1.5, 3.5);
    }
    cx += step;
    flip++;
  }
  g.stroke();
}

// ---------------------------------------------------------------------
//  Far skyline
// ---------------------------------------------------------------------
function paintFar(g, P, night) {
  const r = rng(11);
  let x = 0;
  let k = 0;
  while (x < FAR_W - 40) {
    const w = 46 + r() * 70;
    const h = 70 + r() * 170;
    const top = FAR_H - h;
    const col = P.far[k % P.far.length];
    k++;
    const kind = r();
    g.fillStyle = col;
    if (kind < 0.1 && k > 2) {
      // mosque: dome + minaret
      g.fillRect(x, FAR_H - 70, w, 70);
      g.beginPath();
      g.arc(x + w / 2, FAR_H - 70, w * 0.36, Math.PI, 0);
      g.fill();
      g.fillRect(x + w / 2 - 1.5, FAR_H - 70 - w * 0.36 - 14, 3, 14);
      g.beginPath();
      g.arc(x + w / 2, FAR_H - 70 - w * 0.36 - 16, 3, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x + w - 8, FAR_H - 150, 8, 80);
      g.beginPath();
      g.moveTo(x + w - 10, FAR_H - 150);
      g.lineTo(x + w - 4, FAR_H - 166);
      g.lineTo(x + w + 2, FAR_H - 150);
      g.fill();
    } else {
      g.fillRect(x, top, w, h);
      if (kind < 0.45) {
        // water tank on stilts
        const tx = x + w * 0.25 + r() * w * 0.3;
        g.fillRect(tx, top - 10, 2, 10);
        g.fillRect(tx + 14, top - 10, 2, 10);
        g.fillRect(tx - 2, top - 22, 20, 13);
      } else if (kind < 0.6) {
        // antenna / tower
        g.fillRect(x + w / 2 - 1, top - 24, 2, 24);
        if (night) {
          g.fillStyle = '#FF4D5E';
          g.beginPath();
          g.arc(x + w / 2, top - 25, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      }
      // windows: lit yellow at night, faint by day
      g.fillStyle = P.farWindow;
      for (let wy = top + 10; wy < FAR_H - 12; wy += 14) {
        for (let wx = x + 6; wx < x + w - 8; wx += 11) {
          if (night ? r() < 0.32 : r() < 0.5) g.fillRect(wx, wy, 5, 6);
        }
      }
    }
    x += w + 4 + r() * 18;
  }
  // haze at the base so the layer melts into the distance
  const grad = g.createLinearGradient(0, FAR_H - 120, 0, FAR_H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, P.haze);
  g.fillStyle = grad;
  g.fillRect(0, FAR_H - 120, FAR_W, 120);
}

// ---------------------------------------------------------------------
//  Mid buildings with shops, billboards and the famous wire tangle
// ---------------------------------------------------------------------
function paintMid(g, P, night) {
  const r = rng(29);
  const O = P.outline;
  let x = 8;
  let k = 0;
  while (x < MID_W - 90) {
    const w = 80 + r() * 80;
    const h = 100 + r() * 110;
    const top = MID_H - h;
    const col = P.mid[k % P.mid.length];
    k++;
    rr(g, x, top, w, h + 4, 4);
    g.fillStyle = col;
    g.fill();
    g.lineWidth = 2.5;
    g.strokeStyle = O;
    g.stroke();
    // roof parapet
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(x, top, w, 6);

    // windows with balconies
    for (let wy = top + 14; wy < MID_H - 60; wy += 26) {
      for (let wx = x + 10; wx < x + w - 22; wx += 24) {
        const lit = night ? r() < 0.55 : false;
        g.fillStyle = lit ? P.midWindow : night ? '#1A1530' : P.midWindow;
        g.fillRect(wx, wy, 14, 14);
        g.strokeStyle = P.midWindowFrame;
        g.lineWidth = 1.5;
        g.strokeRect(wx, wy, 14, 14);
        if (r() < 0.35) {
          // AC unit or laundry on the balcony
          g.fillStyle = r() < 0.5 ? '#E6E1EA' : P.sign[Math.floor(r() * P.sign.length)];
          g.fillRect(wx + 1, wy + 15, 12, 4);
        }
      }
    }

    // shop sign at street level
    const sc = P.sign[Math.floor(r() * P.sign.length)];
    const sy = MID_H - 52;
    if (night) {
      g.save();
      g.shadowColor = sc;
      g.shadowBlur = 14;
      rr(g, x + 6, sy, w - 12, 18, 3);
      g.fillStyle = '#120E22';
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = sc;
      g.stroke();
      g.restore();
      banglaScribble(g, x + 14, sy + 5, w - 30, sc);
    } else {
      rr(g, x + 6, sy, w - 12, 18, 3);
      g.fillStyle = sc;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = O;
      g.stroke();
      banglaScribble(g, x + 14, sy + 5, w - 30, '#FFFFFF');
    }
    // shutters below the sign
    g.fillStyle = night ? '#2A2340' : '#D9D2DE';
    g.fillRect(x + 8, sy + 22, w - 16, 26);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 1;
    for (let ly = sy + 26; ly < sy + 48; ly += 4) {
      g.beginPath();
      g.moveTo(x + 8, ly);
      g.lineTo(x + w - 8, ly);
      g.stroke();
    }

    // rooftop billboard on some buildings
    if (r() < 0.4 && top > 40) {
      const bw = Math.min(w - 10, 90);
      const bx = x + (w - bw) / 2;
      const by = top - 44;
      g.strokeStyle = O;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(bx + 10, by + 34);
      g.lineTo(bx + 10, top);
      g.moveTo(bx + bw - 10, by + 34);
      g.lineTo(bx + bw - 10, top);
      g.stroke();
      rr(g, bx, by, bw, 34, 3);
      const bc = P.sign[Math.floor(r() * P.sign.length)];
      if (night) {
        g.save();
        g.shadowColor = bc;
        g.shadowBlur = 16;
        g.fillStyle = '#16112A';
        g.fill();
        g.strokeStyle = bc;
        g.lineWidth = 2.5;
        g.stroke();
        g.restore();
      } else {
        g.fillStyle = '#FFF8EC';
        g.fill();
        g.strokeStyle = O;
        g.lineWidth = 2;
        g.stroke();
      }
      g.fillStyle = bc;
      g.beginPath();
      g.arc(bx + 16, by + 17, 9, 0, Math.PI * 2);
      g.fill();
      banglaScribble(g, bx + 30, by + 9, bw - 38, night ? bc : '#2A1E3B');
      banglaScribble(g, bx + 30, by + 21, bw - 50, night ? bc : '#6B5E7B', 0.8);
    }
    x += w + 6 + r() * 26;
  }

  // electric poles + the legendary tangled wires
  const poles = [];
  for (let px = 60; px < MID_W; px += 250 + Math.floor(r() * 60)) poles.push(px);
  const wireCol = P.wire;
  g.strokeStyle = wireCol;
  for (const px of poles) {
    g.fillStyle = P.pole;
    g.fillRect(px - 3, MID_H - 175, 6, 175);
    g.fillRect(px - 16, MID_H - 168, 32, 4);
    g.lineWidth = 1.5;
    g.strokeStyle = O;
    g.strokeRect(px - 3, MID_H - 175, 6, 175);
    // a messy knot of cable around the pole
    g.lineWidth = 1.2;
    g.strokeStyle = wireCol;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.ellipse(px, MID_H - 150 + i * 5, 10 + r() * 8, 4 + r() * 3, r(), 0, Math.PI * 2);
      g.stroke();
    }
  }
  // wires between poles (including the wrap-around to the next tile)
  const wireCount = 6;
  for (let i = 0; i < poles.length; i++) {
    const a = poles[i];
    const b = i + 1 < poles.length ? poles[i + 1] : poles[0] + MID_W;
    for (let wv = 0; wv < wireCount; wv++) {
      const y0 = MID_H - 166 + wv * 4;
      const sag = 14 + ((wv * 13 + i * 7) % 26);
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(a, y0);
      g.quadraticCurveTo((a + b) / 2, y0 + sag, b, y0 + ((wv * 3) % 5));
      g.stroke();
      if (b > MID_W) {
        g.beginPath();
        g.moveTo(a - MID_W, y0);
        g.quadraticCurveTo((a + b) / 2 - MID_W, y0 + sag, b - MID_W, y0 + ((wv * 3) % 5));
        g.stroke();
      }
    }
  }
}

// ---------------------------------------------------------------------
//  Footpath: tea stall, people, rickshaw stand
// ---------------------------------------------------------------------
function person(g, x, y, shirt, O, skin, sitting) {
  g.lineCap = 'round';
  g.strokeStyle = O;
  g.lineWidth = 7;
  g.beginPath();
  if (sitting) {
    g.moveTo(x, y - 18);
    g.lineTo(x + 10, y - 18);
    g.lineTo(x + 10, y);
  } else {
    g.moveTo(x - 3, y - 20);
    g.lineTo(x - 4, y);
    g.moveTo(x + 3, y - 20);
    g.lineTo(x + 4, y);
  }
  g.stroke();
  g.strokeStyle = '#3D3F55';
  g.lineWidth = 3.5;
  g.stroke();
  const by = sitting ? y - 38 : y - 42;
  rr(g, x - 7, by, 14, 22, 5);
  g.fillStyle = shirt;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = O;
  g.stroke();
  g.beginPath();
  g.arc(x, by - 7, 7, 0, Math.PI * 2);
  g.fillStyle = skin;
  g.fill();
  g.stroke();
  g.fillStyle = '#1F1A2E';
  g.beginPath();
  g.arc(x, by - 8, 7, Math.PI, 0);
  g.fill();
}

function paintPath(g, P, night) {
  const r = rng(53);
  const O = P.outline;
  const base = PATH_H - FOOTPATH_DEPTH;

  // footpath slabs
  g.fillStyle = P.footpath;
  g.fillRect(0, base, PATH_W, FOOTPATH_DEPTH);
  g.strokeStyle = P.footpathTile;
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= PATH_W; x += 40) {
    g.moveTo(x, base);
    g.lineTo(x - 10, PATH_H);
  }
  g.moveTo(0, base + FOOTPATH_DEPTH / 2);
  g.lineTo(PATH_W, base + FOOTPATH_DEPTH / 2);
  g.stroke();
  g.fillStyle = P.curb;
  g.fillRect(0, PATH_H - 7, PATH_W, 7);
  g.fillStyle = P.curbDark;
  for (let x = 0; x < PATH_W; x += 40) g.fillRect(x, PATH_H - 7, 20, 7);

  const skins = ['#D49A6A', '#B97E52', '#9C6644', '#E2B48A'];
  const shirts = P.sign;

  // --- tea stall (cha er dokan) ---
  const tx = 70;
  const ty = base + 14;
  rr(g, tx, ty - 46, 90, 46, 4);
  g.fillStyle = night ? '#4A3A2A' : '#C68A4E';
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = O;
  g.stroke();
  // striped awning
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? '#FFFFFF' : '#E6397D';
    g.beginPath();
    g.moveTo(tx - 6 + i * 17, ty - 78);
    g.lineTo(tx + 11 + i * 17, ty - 78);
    g.lineTo(tx + 11 + i * 17, ty - 66);
    g.quadraticCurveTo(tx + 2.5 + i * 17, ty - 60, tx - 6 + i * 17, ty - 66);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = O;
  g.lineWidth = 2;
  g.strokeRect(tx - 6, ty - 78, 102, 12);
  g.fillRect(tx - 2, ty - 66, 3, 20);
  g.fillRect(tx + 88, ty - 66, 3, 20);
  // kettle + glasses + hanging banana bunch
  g.beginPath();
  g.ellipse(tx + 22, ty - 52, 10, 8, 0, 0, Math.PI * 2);
  g.fillStyle = '#BFC3CC';
  g.fill();
  g.stroke();
  for (let i = 0; i < 4; i++) {
    g.fillStyle = '#C47A3A';
    g.fillRect(tx + 42 + i * 9, ty - 54, 6, 8);
    g.strokeRect(tx + 42 + i * 9, ty - 54, 6, 8);
  }
  g.fillStyle = '#FFC72C';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.ellipse(tx + 74 + i * 3, ty - 60 + i * 2, 3, 7, 0.4, 0, Math.PI * 2);
    g.fill();
  }
  if (night) {
    // a bare bulb glowing over the stall
    g.save();
    g.shadowColor = '#FFE27A';
    g.shadowBlur = 18;
    g.fillStyle = '#FFF2A8';
    g.beginPath();
    g.arc(tx + 45, ty - 62, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // bench with customers sipping cha
  g.fillStyle = '#8B5A2B';
  g.fillRect(tx + 100, base + 6, 60, 5);
  g.fillRect(tx + 104, base + 11, 4, 10);
  g.fillRect(tx + 152, base + 11, 4, 10);
  person(g, tx + 112, base + 24, shirts[1], O, skins[0], true);
  person(g, tx + 138, base + 24, shirts[3], O, skins[2], true);

  // --- random pedestrians ---
  for (let i = 0; i < 4; i++) {
    const px = 300 + i * 70 + r() * 30;
    person(g, px, base + 22 + r() * 6, shirts[Math.floor(r() * shirts.length)], O, skins[i % 4], false);
  }

  // --- planter tree ---
  const trx = 600;
  g.fillStyle = '#8B5A2B';
  g.fillRect(trx - 4, base - 40, 8, 50);
  g.strokeRect(trx - 4, base - 40, 8, 50);
  g.fillStyle = night ? '#1E5A44' : '#1FA67A';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(trx - 16 + i * 11, base - 50 - (i % 2) * 10, 16, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  rr(g, trx - 16, base + 4, 32, 14, 3);
  g.fillStyle = '#E6397D';
  g.fill();
  g.stroke();

  // --- rickshaw stand: parked rickshaws reuse the real rickshaw art ---
  const opts = { outline: O, variant: 0, night: 0 };
  for (let i = 0; i < 2; i++) {
    g.save();
    g.translate(720 + i * 90, base + 26);
    g.scale(0.62, 0.62);
    opts.variant = i + 1;
    drawRickshaw(g, i * 0.37, opts);
    g.restore();
  }
  // fruit vendor umbrella at the end
  const ux = 930;
  g.strokeStyle = O;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(ux, base + 20);
  g.lineTo(ux, base - 50);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#FFC72C' : '#00A6A6';
    g.beginPath();
    g.moveTo(ux, base - 64);
    g.arc(ux, base - 50, 30, Math.PI + (i * Math.PI) / 4, Math.PI + ((i + 1) * Math.PI) / 4);
    g.closePath();
    g.fill();
    g.stroke();
  }
  rr(g, ux - 22, base + 2, 44, 16, 3);
  g.fillStyle = '#C68A4E';
  g.fill();
  g.stroke();
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? '#FF8A00' : '#7DC243';
    g.beginPath();
    g.arc(ux - 16 + i * 6.5, base + 1, 4, 0, Math.PI * 2);
    g.fill();
  }
}

// ---------------------------------------------------------------------
//  Background class
// ---------------------------------------------------------------------

export class Background {
  constructor() {
    this.tiles = { light: null, dark: null };
    this.ps = 1; // pixel scale the tiles were rendered at
    this.stars = [];
    const r = rng(7);
    for (let i = 0; i < 60; i++) this.stars.push({ x: r(), y: r(), s: 0.6 + r() * 1.4, p: r() * 6 });
    this.clouds = [];
    for (let i = 0; i < 5; i++) this.clouds.push({ x: r() * 1200, y: r(), s: 0.6 + r() * 0.7 });
    this.kites = [];
    for (let i = 0; i < 3; i++) this.kites.push({ x: 0.15 + i * 0.3 + r() * 0.1, y: 0.2 + r() * 0.4, c: i, p: r() * 6 });
    this.skyCacheKey = '';
    this.skyGrad = null;
    this.cloudSprite = null;
    this.coneSprite = null;
  }

  /** (Re)build tiles at the given pixel scale. The night tiles are lazy. */
  build(ps, needDark) {
    const p = Math.min(2, Math.max(0.75, ps));
    if (Math.abs(p - this.ps) > 0.05) {
      this.tiles.light = null;
      this.tiles.dark = null;
      this.ps = p;
    }
    if (!this.tiles.light) this.tiles.light = this._render(PALETTES.light, false);
    if (needDark && !this.tiles.dark) this.tiles.dark = this._render(PALETTES.dark, true);
  }

  _render(P, night) {
    const ps = this.ps;
    return {
      far: makeTile(FAR_W, FAR_H, ps, (g) => paintFar(g, P, night)),
      mid: makeTile(MID_W, MID_H, ps, (g) => paintMid(g, P, night)),
      path: makeTile(PATH_W, PATH_H, ps, (g) => paintPath(g, P, night))
    };
  }

  _getCloud() {
    if (this.cloudSprite) return this.cloudSprite;
    this.cloudSprite = makeTile(120, 50, 2, (g) => {
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.arc(30, 32, 16, 0, Math.PI * 2);
      g.arc(52, 22, 20, 0, Math.PI * 2);
      g.arc(78, 28, 17, 0, Math.PI * 2);
      g.arc(96, 34, 12, 0, Math.PI * 2);
      g.fill();
      g.fillRect(28, 32, 70, 14);
    });
    return this.cloudSprite;
  }

  _getCone() {
    if (this.coneSprite) return this.coneSprite;
    this.coneSprite = makeTile(160, 200, 1, (g) => {
      const grad = g.createLinearGradient(0, 0, 0, 200);
      grad.addColorStop(0, 'rgba(255, 226, 140, 0.75)');
      grad.addColorStop(1, 'rgba(255, 226, 140, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(70, 0);
      g.lineTo(90, 0);
      g.lineTo(160, 200);
      g.lineTo(0, 200);
      g.closePath();
      g.fill();
    });
    return this.coneSprite;
  }

  _layer(ctx, img, tileW, tileH, scroll, factor, y, viewW, alpha) {
    if (!img || alpha <= 0.01) return;
    ctx.globalAlpha = alpha;
    let off = (scroll * factor) % tileW;
    if (off < 0) off += tileW;
    for (let x = -off; x < viewW; x += tileW) ctx.drawImage(img, x, y, tileW, tileH);
    ctx.globalAlpha = 1;
  }

  /**
   * Draw sky + buildings + footpath.
   * v: view layout; n: nightness 0..1; rain: 0..1; parallax: 1 normal, 0.5 reduced
   */
  drawBack(ctx, v, scroll, n, rain, time, parallax) {
    const L = PALETTES.light;
    const D = PALETTES.dark;
    const horizon = v.pathTop;

    // 1) sky — gradient object cached until night amount or size changes
    const key = Math.round(n * 50) + '|' + Math.round(rain * 10) + '|' + Math.round(horizon);
    if (key !== this.skyCacheKey) {
      this.skyCacheKey = key;
      const g = ctx.createLinearGradient(0, 0, 0, horizon);
      const top = mixColor(L.skyTop, D.skyTop, n);
      const bottom = mixColor(L.skyBottom, D.skyBottom, n);
      g.addColorStop(0, rain > 0 ? mixColor(rgbToHex(top), '#5A5F70', rain * 0.55) : top);
      g.addColorStop(1, rain > 0 ? mixColor(rgbToHex(bottom), '#8A8FA0', rain * 0.45) : bottom);
      this.skyGrad = g;
    }
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, v.w, horizon + 2);

    // stars & moon (night)
    if (n > 0.02) {
      ctx.fillStyle = '#FFF4E0';
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        ctx.globalAlpha = n * (0.4 + 0.6 * Math.abs(Math.sin(time * 1.3 + s.p))) * (1 - rain * 0.7);
        ctx.fillRect(s.x * v.w, s.y * (horizon - 60), s.s, s.s);
      }
      ctx.globalAlpha = n * (1 - rain * 0.6);
      const mx = v.w * 0.8;
      const my = horizon > 400 ? horizon * 0.3 : Math.min(70, horizon * 0.25);
      ctx.fillStyle = 'rgba(255, 240, 200, 0.15)';
      ctx.beginPath();
      ctx.arc(mx, my, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFF1C9';
      ctx.beginPath();
      ctx.arc(mx, my, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mixColor(D.skyTop, D.skyBottom, 0.3);
      ctx.beginPath();
      ctx.arc(mx + 9, my - 6, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // sun (day)
    if (n < 0.98) {
      const a = (1 - n) * (1 - rain * 0.75);
      const sx = v.w * 0.8;
      const sy = horizon > 400 ? horizon * 0.3 : Math.min(78, horizon * 0.3);
      ctx.globalAlpha = a * 0.25;
      ctx.fillStyle = '#FFE08A';
      ctx.beginPath();
      ctx.arc(sx, sy, 52 + Math.sin(time * 2) * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.fillStyle = L.sun;
      ctx.beginPath();
      ctx.arc(sx, sy, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = L.outline;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // clouds drift slowly; darker and thicker in rain
    const cloud = this._getCloud();
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      let cx = (c.x - scroll * 0.03 * parallax - time * 6) % (v.w + 260);
      if (cx < -140) cx += v.w + 260;
      const cy = 20 + c.y * Math.max(40, horizon - 200);
      ctx.globalAlpha = (0.85 - n * 0.6) * (1 - rain * 0.2);
      ctx.drawImage(cloud, cx, cy, 120 * c.s, 50 * c.s);
      if (rain > 0) {
        ctx.globalAlpha = rain * 0.5;
        ctx.filter = 'none';
        ctx.drawImage(cloud, cx + 30, cy + 10, 150 * c.s, 60 * c.s);
      }
    }
    ctx.globalAlpha = 1;

    // kites (ghuri) bob in the sky on tall screens
    if (horizon > 330 && rain < 0.5) {
      const cols = ['#E6397D', '#FFC72C', '#00A6A6'];
      for (let i = 0; i < this.kites.length; i++) {
        const k = this.kites[i];
        const kx = k.x * v.w + Math.sin(time * 0.7 + k.p) * 18;
        const ky = 60 + k.y * (horizon - 330) + Math.cos(time * 1.1 + k.p) * 10;
        ctx.strokeStyle = 'rgba(42,30,59,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(kx, ky + 14);
        ctx.quadraticCurveTo(kx - 40, ky + 120, kx - 90, horizon - 60);
        ctx.stroke();
        ctx.save();
        ctx.translate(kx, ky);
        ctx.rotate(Math.sin(time * 1.5 + k.p) * 0.2);
        ctx.fillStyle = cols[k.c];
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(11, 0);
        ctx.lineTo(0, 14);
        ctx.lineTo(-11, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = L.outline;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2–4) tiled layers: draw day, then night on top with alpha = nightness
    const day = this.tiles.light;
    const night = this.tiles.dark;
    const farY = horizon - FAR_H + 8;
    const midY = horizon - MID_H + 6;
    const pathY = v.roadTop - PATH_H;
    const pf = parallax;
    if (day) {
      this._layer(ctx, day.far, FAR_W, FAR_H, scroll, 0.12 * pf, farY, v.w, n < 1 ? 1 : 0);
      if (night) this._layer(ctx, night.far, FAR_W, FAR_H, scroll, 0.12 * pf, farY, v.w, n);
      this._layer(ctx, day.mid, MID_W, MID_H, scroll, 0.4 * pf, midY, v.w, n < 1 ? 1 : 0);
      if (night) this._layer(ctx, night.mid, MID_W, MID_H, scroll, 0.4 * pf, midY, v.w, n);
    }
    if (rain > 0) {
      // misty rain veil over the city
      ctx.fillStyle = n > 0.5 ? 'rgba(20, 24, 40, 0.28)' : 'rgba(120, 130, 150, 0.22)';
      ctx.globalAlpha = rain;
      ctx.fillRect(0, 0, v.w, horizon);
      ctx.globalAlpha = 1;
    }
    if (day) {
      this._layer(ctx, day.path, PATH_W, PATH_H, scroll, 0.92, pathY, v.w, n < 1 ? 1 : 0);
      if (night) this._layer(ctx, night.path, PATH_W, PATH_H, scroll, 0.92, pathY, v.w, n);
    }
  }

  /** Road, lane dashes, streetlights and the near footpath below the road. */
  drawRoad(ctx, v, scroll, n, rain, time) {
    const L = PALETTES.light;
    const D = PALETTES.dark;
    const top = v.roadTop;
    const bottom = v.roadBottom;
    ctx.fillStyle = mixColor(L.road, D.road, n);
    ctx.fillRect(0, top, v.w, bottom - top);
    // subtle darker band near the far curb gives depth
    ctx.fillStyle = mixColor(L.roadDark, D.roadDark, n);
    ctx.fillRect(0, top, v.w, 10);

    // repaired asphalt patches and cracks that scroll with the road
    const pOff = scroll % 520;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1.5;
    for (let x = -pOff; x < v.w + 520; x += 520) {
      ctx.fillRect(x + 100, top + v.laneH * 1.25, 54, 14);
      ctx.fillRect(x + 360, top + v.laneH * 2.3, 38, 11);
      ctx.beginPath();
      ctx.moveTo(x + 250, top + v.laneH * 0.4);
      ctx.lineTo(x + 262, top + v.laneH * 0.55);
      ctx.lineTo(x + 256, top + v.laneH * 0.7);
      ctx.lineTo(x + 270, top + v.laneH * 0.82);
      ctx.moveTo(x + 440, top + v.laneH * 1.5);
      ctx.lineTo(x + 452, top + v.laneH * 1.62);
      ctx.lineTo(x + 447, top + v.laneH * 1.75);
      ctx.stroke();
    }

    // lane separator dashes
    ctx.fillStyle = mixColor(L.laneDash, D.laneDash, n);
    const dOff = scroll % 90;
    for (let i = 1; i < 3; i++) {
      const y = top + v.laneH * i - 2;
      for (let x = -dOff; x < v.w; x += 90) ctx.fillRect(x, y, 46, 4);
    }

    // wet road: shiny streaks
    if (rain > 0) {
      ctx.globalAlpha = 0.18 * rain;
      ctx.fillStyle = '#DDEEFF';
      const wOff = (scroll * 1) % 300;
      for (let x = -wOff; x < v.w; x += 300) {
        ctx.fillRect(x + 40, top + v.laneH * 0.7, 90, 2);
        ctx.fillRect(x + 190, top + v.laneH * 1.8, 70, 2);
        ctx.fillRect(x + 100, top + v.laneH * 2.6, 110, 2);
      }
      ctx.globalAlpha = 1;
    }

    // near footpath + drain below the road
    const nearTop = bottom;
    ctx.fillStyle = mixColor(L.curb, D.curb, n);
    ctx.fillRect(0, nearTop, v.w, 8);
    ctx.fillStyle = mixColor(L.curbDark, D.curbDark, n);
    const cOff = scroll % 40;
    for (let x = -cOff; x < v.w; x += 40) ctx.fillRect(x, nearTop, 20, 8);
    ctx.fillStyle = mixColor(L.footpath, D.footpath, n);
    ctx.fillRect(0, nearTop + 8, v.w, 26);
    ctx.fillStyle = mixColor(L.ground, D.ground, n);
    ctx.fillRect(0, nearTop + 34, v.w, v.h - nearTop - 34);
    ctx.fillStyle = mixColor(L.groundDark, D.groundDark, n);
    ctx.fillRect(0, nearTop + 34, v.w, 5);
    // rickshaw-art trim along the bottom (decor for tall phones)
    if (v.h - nearTop > 90) {
      const bandY = nearTop + 52;
      const bOff = scroll % 36;
      const cols = ['#E6397D', '#FFC72C', '#00A6A6', '#1FA67A'];
      for (let x = -bOff, i = 0; x < v.w + 36; x += 36, i++) {
        ctx.fillStyle = cols[(i + Math.floor(scroll / 36)) & 3];
        ctx.globalAlpha = 0.55 + 0.25 * (1 - n);
        ctx.beginPath();
        ctx.moveTo(x, bandY);
        ctx.lineTo(x + 9, bandY - 9);
        ctx.lineTo(x + 18, bandY);
        ctx.lineTo(x + 9, bandY + 9);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, nearTop + 8, v.w, 3);
  }

  /** Streetlights on the far curb; at night they throw light cones onto the road. */
  drawStreetlights(ctx, v, scroll, n) {
    const spacing = 460;
    const off = scroll % spacing;
    const cone = this._getCone();
    const O = n > 0.5 ? '#000' : '#2A1E3B';
    for (let x = -off + 200; x < v.w + 60; x += spacing) {
      const baseY = v.roadTop - 2;
      if (n > 0.02) {
        const prev = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = n * 0.55;
        ctx.drawImage(cone, x - 60, baseY - 110, 160, v.roadBottom - baseY + 110);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = prev;
      }
      ctx.fillStyle = mixColor('#6B5E7B', '#4A4060', n);
      ctx.fillRect(x - 2.5, baseY - 120, 5, 120);
      ctx.strokeStyle = O;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 2.5, baseY - 120, 5, 120);
      ctx.beginPath();
      ctx.moveTo(x, baseY - 118);
      ctx.quadraticCurveTo(x + 4, baseY - 128, x + 20, baseY - 120);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = n > 0.3 ? '#FFF2A8' : '#E9E4EE';
      ctx.beginPath();
      ctx.ellipse(x + 20, baseY - 117, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /** The school or office you are running to (appears near the finish). */
  drawDestination(ctx, x, v, role, label, font, n) {
    const O = n > 0.5 ? '#000' : '#2A1E3B';
    const base = v.roadTop - 6;
    const w = 220;
    const h = 170;
    ctx.save();
    ctx.translate(x, base);
    // building
    rr(ctx, 0, -h, w, h, 6);
    ctx.fillStyle = role === 'employee' ? mixColor('#9CC0FF', '#2B3F70', n) : mixColor('#FFD6A5', '#5A4030', n);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = O;
    ctx.stroke();
    // windows
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.fillStyle = n > 0.5 ? '#FFD54F' : '#E3F4FF';
        ctx.fillRect(16 + c * 40, -h + 46 + r * 30, 22, 18);
        ctx.strokeRect(16 + c * 40, -h + 46 + r * 30, 22, 18);
      }
    }
    // flag pole with the Bangladesh flag (school) / glass door (office)
    if (role !== 'employee') {
      ctx.fillStyle = '#6B5E7B';
      ctx.fillRect(w - 20, -h - 60, 4, 60);
      ctx.fillStyle = '#006A4E';
      ctx.fillRect(w - 16, -h - 60, 34, 22);
      ctx.fillStyle = '#F42A41';
      ctx.beginPath();
      ctx.arc(w - 1, -h - 49, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // sign board with the translated label
    rr(ctx, 30, -h - 4 - 30, w - 60, 34, 8);
    ctx.fillStyle = '#E6397D';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = font(800, 22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, -h - 4 - 12);
    // gate
    ctx.fillStyle = '#2A1E3B';
    ctx.fillRect(w / 2 - 26, -42, 52, 42);
    ctx.strokeStyle = '#FFC72C';
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 - 26 + i * 8.7, -42);
      ctx.lineTo(w / 2 - 26 + i * 8.7, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  return '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('');
}
