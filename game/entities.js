/*
 * entities.js — everything on the road that isn't the player.
 *
 *  1. ART: draw functions for rickshaws, buses, CNGs, manholes, puddles,
 *     the VIP motorcade, hawkers, stray dogs, the coaching bhai, the boss's
 *     phone, and the power-ups (cha, shingara, shortcut, coins).
 *     Each one draws around (0, 0) = the spot where it touches the road.
 *  2. EntityManager: a pool of reusable entity objects (no garbage).
 *  3. Spawner: decides WHAT appears WHERE. Its golden rule: there is always
 *     at least one lane you can get through.
 */

// ======================================================================
//  Shared drawing helpers
// ======================================================================

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillStroke(ctx, fill, O, lw = 2.6) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = O;
  ctx.stroke();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function wheel(ctx, x, y, r, rot, O) {
  circle(ctx, x, y, r);
  fillStroke(ctx, '#2B2433', O, 2.6);
  circle(ctx, x, y, r - 4);
  ctx.fillStyle = '#BFC3CC';
  ctx.fill();
  ctx.strokeStyle = '#5E5868';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
  }
  ctx.stroke();
  circle(ctx, x, y, 2.6);
  fillStroke(ctx, '#FFC72C', O, 1.4);
}

function flower(ctx, x, y, r, petal, center) {
  ctx.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    circle(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.46);
    ctx.fill();
  }
  ctx.fillStyle = center;
  circle(ctx, x, y, r * 0.38);
  ctx.fill();
}

function diamond(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.7, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.7, y);
  ctx.closePath();
  ctx.fill();
}

// Headlight cone sprite, painted once and reused (cheaper than gradients per frame).
let glowSprite = null;
function getGlow() {
  if (glowSprite) return glowSprite;
  const c = document.createElement('canvas');
  c.width = 220;
  c.height = 90;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 220, 0);
  grad.addColorStop(0, 'rgba(255, 244, 190, 0.85)');
  grad.addColorStop(1, 'rgba(255, 244, 190, 0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 38);
  g.lineTo(220, 0);
  g.lineTo(220, 90);
  g.lineTo(0, 52);
  g.closePath();
  g.fill();
  glowSprite = c;
  return c;
}

/** Headlight cone pointing right from (x, y); `n` = night amount 0..1. */
function headlight(ctx, x, y, len, n) {
  if (n <= 0.02) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = n * 0.55;
  ctx.drawImage(getGlow(), x, y - len * 0.2, len, len * 0.41);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

function lampDot(ctx, x, y, r, color, n, O) {
  circle(ctx, x, y, r);
  fillStroke(ctx, color, O, 1.6);
  if (n > 0.05) {
    ctx.globalAlpha = n * 0.45;
    circle(ctx, x, y, r * 2.4);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ======================================================================
//  Obstacle art
// ======================================================================

const HOODS = [
  ['#E6397D', '#FFC72C'],
  ['#00A6A6', '#FF6B6B'],
  ['#7B5CFF', '#FFC72C'],
  ['#1FA67A', '#F42A41']
];
const SEATS = ['#FFC72C', '#E6397D', '#00A6A6', '#F42A41'];

export function drawRickshaw(ctx, t, o) {
  const O = o.outline;
  const v = o.variant || 0;
  const hood = HOODS[v % HOODS.length];
  const bounce = Math.sin(t * 14 + v) * 1.4; // bouncy suspension
  const rot = t * 9;

  wheel(ctx, -36, -17, 17, rot, O);

  ctx.save();
  ctx.translate(0, bounce);

  // frame: rear axle → seat → driver seat → fork
  ctx.strokeStyle = O;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-36, -17);
  ctx.lineTo(-14, -34);
  ctx.lineTo(14, -48);
  ctx.moveTo(-14, -34);
  ctx.lineTo(20, -26);
  ctx.lineTo(40, -12);
  ctx.moveTo(14, -48);
  ctx.lineTo(36, -52);
  ctx.lineTo(40, -12);
  ctx.stroke();

  // hood (folded canopy) with stripes and fringe
  ctx.beginPath();
  ctx.moveTo(-63, -58);
  ctx.quadraticCurveTo(-68, -106, -36, -108);
  ctx.quadraticCurveTo(-8, -106, -10, -60);
  ctx.closePath();
  fillStroke(ctx, hood[0], O, 2.8);
  ctx.strokeStyle = hood[1];
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-58, -64);
  ctx.quadraticCurveTo(-60, -98, -36, -100);
  ctx.moveTo(-48, -62);
  ctx.quadraticCurveTo(-48, -88, -32, -90);
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 6; i++) {
    circle(ctx, -60 + i * 9.5, -57, 2);
    ctx.fill();
  }

  // seat cushion
  roundRect(ctx, -60, -64, 46, 9, 4);
  fillStroke(ctx, SEATS[(v + 1) % SEATS.length], O, 2.2);

  // the famous rickshaw-art back panel
  roundRect(ctx, -62, -56, 50, 28, 5);
  fillStroke(ctx, hood[0] === '#E6397D' ? '#00A6A6' : '#E6397D', O, 2.6);
  roundRect(ctx, -58, -52, 42, 20, 3);
  ctx.strokeStyle = '#FFC72C';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  flower(ctx, -37, -42, 7, '#FFC72C', '#F42A41');
  diamond(ctx, -52, -42, 4, '#FFFFFF');
  diamond(ctx, -22, -42, 4, '#FFFFFF');

  // the rickshaw-wala mama, pedaling
  const a = t * 9;
  const cx = 20;
  const cy = -26;
  const f1x = cx + Math.cos(a) * 6;
  const f1y = cy + Math.sin(a) * 6;
  const f2x = cx - Math.cos(a) * 6;
  const f2y = cy - Math.sin(a) * 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 2; i++) {
    const fx = i ? f2x : f1x;
    const fy = i ? f2y : f1y;
    ctx.beginPath();
    ctx.moveTo(14, -52);
    ctx.lineTo((14 + fx) / 2 + 7, (-52 + fy) / 2);
    ctx.lineTo(fx, fy);
    ctx.strokeStyle = O;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = '#B97E52';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }
  // checkered lungi
  ctx.beginPath();
  ctx.moveTo(8, -56);
  ctx.lineTo(22, -54);
  ctx.lineTo(26, -40);
  ctx.lineTo(12, -38);
  ctx.closePath();
  fillStroke(ctx, '#3D5AFE', O, 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(12, -54);
  ctx.lineTo(16, -39);
  ctx.moveTo(18, -54);
  ctx.lineTo(21, -39);
  ctx.moveTo(10, -47);
  ctx.lineTo(24, -46);
  ctx.stroke();
  // torso + arms to the handlebar
  ctx.beginPath();
  ctx.moveTo(14, -56);
  ctx.lineTo(22, -78);
  ctx.strokeStyle = O;
  ctx.lineWidth = 11;
  ctx.stroke();
  ctx.strokeStyle = '#F5F0E6';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(22, -74);
  ctx.lineTo(34, -56);
  ctx.strokeStyle = O;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = '#B97E52';
  ctx.lineWidth = 3;
  ctx.stroke();
  // head with a gamcha (towel) tied around it
  circle(ctx, 25, -86, 7.5);
  fillStroke(ctx, '#B97E52', O, 2.2);
  ctx.fillStyle = '#F42A41';
  ctx.fillRect(18, -92, 14, 4);
  ctx.strokeStyle = O;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(18, -92, 14, 4);
  ctx.fillStyle = O;
  circle(ctx, 28, -86, 1.2);
  ctx.fill();

  // little brass bell on the handlebar
  circle(ctx, 37, -55, 3);
  fillStroke(ctx, '#FFC72C', O, 1.4);
  ctx.restore();

  wheel(ctx, 40, -12, 12, rot * 1.4, O);
  lampDot(ctx, 42, -50 + bounce, 2.5, '#FFF4C2', o.night, O);
}

const BUS_COLORS = [
  { body: '#1FA67A', roof: '#7FDDB8', stripe: '#FFC72C', skirt: '#F42A41' },
  { body: '#F42A41', roof: '#FF9AA6', stripe: '#FFFFFF', skirt: '#2A1E3B' },
  { body: '#2D6CDF', roof: '#9CC0FF', stripe: '#FFC72C', skirt: '#E6397D' }
];
const SKINS = ['#D49A6A', '#B97E52', '#E2B48A', '#9C6644'];

export function drawBus(ctx, t, o) {
  const O = o.outline;
  const v = o.variant || 0;
  const c = BUS_COLORS[v % BUS_COLORS.length];
  const n = o.night;
  ctx.save();
  ctx.rotate(-0.028); // the classic Dhaka-bus lean
  const rock = Math.sin(t * 6) * 1.2;
  ctx.translate(0, rock);

  headlight(ctx, 116, -40, 170, n);

  // people sitting on the roof (yes, really)
  for (let i = 0; i < 2; i++) {
    const hx = -66 + i * 32;
    const bob = Math.sin(t * 7 + i * 2) * 1.5;
    roundRect(ctx, hx - 6, -142 + bob, 12, 14, 4);
    fillStroke(ctx, i ? '#FFC72C' : '#00A6A6', O, 2);
    circle(ctx, hx, -149 + bob, 6);
    fillStroke(ctx, SKINS[(i + v) % 4], O, 2);
  }

  // body
  roundRect(ctx, -118, -130, 236, 110, 12);
  fillStroke(ctx, c.body, O, 3);
  roundRect(ctx, -114, -130, 228, 10, 6);
  ctx.fillStyle = c.roof;
  ctx.fill();
  ctx.fillStyle = c.stripe;
  ctx.fillRect(-117, -66, 234, 11);
  // zig-zag skirt (rickshaw-art style trim)
  ctx.fillStyle = c.skirt;
  ctx.beginPath();
  ctx.moveTo(-117, -36);
  for (let x = -117; x < 117; x += 12) {
    ctx.lineTo(x + 6, -28);
    ctx.lineTo(x + 12, -36);
  }
  ctx.lineTo(117, -22);
  ctx.lineTo(-117, -22);
  ctx.closePath();
  ctx.fill();

  // windows crammed with passengers
  const glass = n > 0.5 ? '#FFE9A8' : '#BFE9FF';
  for (let i = 0; i < 5; i++) {
    const x = -108 + i * 33;
    roundRect(ctx, x, -116, 27, 34, 4);
    fillStroke(ctx, glass, O, 2.2);
    for (let k = 0; k < 2; k++) {
      const hx = x + 8 + k * 11;
      const hy = -94 + Math.sin(t * 8 + i + k * 1.7) * 1.6;
      circle(ctx, hx, hy, 5);
      fillStroke(ctx, SKINS[(i + k + v) % 4], O, 1.6);
      ctx.fillStyle = '#1F1A2E';
      ctx.beginPath();
      ctx.arc(hx, hy - 1, 5, Math.PI, 0);
      ctx.fill();
    }
  }
  // open door + a passenger hanging on for dear life
  ctx.fillStyle = '#2A1E3B';
  ctx.fillRect(58, -116, 24, 88);
  ctx.strokeStyle = O;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(58, -116, 24, 88);
  const sway = Math.sin(t * 9) * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(78, -100);
  ctx.lineTo(90 + sway, -70);
  ctx.lineTo(86 + sway, -40);
  ctx.strokeStyle = O;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = '#FFC72C';
  ctx.lineWidth = 5;
  ctx.stroke();
  circle(ctx, 92 + sway, -80, 6);
  fillStroke(ctx, SKINS[(v + 2) % 4], O, 1.8);

  // windshield + route board with "Bangla-looking" squiggle
  roundRect(ctx, 96, -118, 18, 50, 5);
  fillStroke(ctx, glass, O, 2.2);
  roundRect(ctx, 20, -127, 34, 10, 3);
  fillStroke(ctx, '#FFF8EC', O, 1.6);
  ctx.strokeStyle = '#F42A41';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(23, -124);
  ctx.lineTo(51, -124);
  ctx.moveTo(26, -124);
  ctx.quadraticCurveTo(29, -118, 32, -122);
  ctx.quadraticCurveTo(36, -126, 39, -121);
  ctx.quadraticCurveTo(43, -118, 47, -123);
  ctx.stroke();

  // dents — every Dhaka bus has a story
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-80, -48, 6, 0.3, 2.6);
  ctx.moveTo(-30, -44);
  ctx.arc(-24, -44, 6, Math.PI, 2.4 * Math.PI);
  ctx.stroke();

  lampDot(ctx, 112, -40, 4, '#FFF4C2', n, O);
  lampDot(ctx, -115, -44, 3.5, '#FF4D5E', n, O);
  ctx.restore();

  wheel(ctx, -70, -16, 17, t * 9, O);
  wheel(ctx, 70, -16, 17, t * 9, O);
}

export function drawCNG(ctx, t, o) {
  const O = o.outline;
  const n = o.night;
  const shake = Math.sin(t * 40) * 0.8; // two-stroke engine rattle
  ctx.save();
  ctx.translate(0, shake);
  headlight(ctx, 50, -34, 150, n);

  // body
  ctx.beginPath();
  ctx.moveTo(-48, -18);
  ctx.lineTo(-48, -60);
  ctx.quadraticCurveTo(-48, -76, -30, -76);
  ctx.lineTo(28, -76);
  ctx.quadraticCurveTo(44, -74, 50, -50);
  ctx.lineTo(54, -22);
  ctx.quadraticCurveTo(54, -16, 46, -16);
  ctx.closePath();
  fillStroke(ctx, '#1FA67A', O, 3);
  // dark canopy roof
  roundRect(ctx, -50, -82, 82, 12, 6);
  fillStroke(ctx, '#173D2E', O, 2.4);
  // the iconic metal grill door
  roundRect(ctx, -42, -66, 38, 40, 4);
  fillStroke(ctx, '#2C6E57', O, 2);
  ctx.strokeStyle = '#B9F5DE';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 1; i < 6; i++) {
    ctx.moveTo(-42 + i * 6.3, -64);
    ctx.lineTo(-42 + i * 6.3, -28);
  }
  ctx.moveTo(-40, -46);
  ctx.lineTo(-6, -46);
  ctx.stroke();
  // driver window
  roundRect(ctx, 6, -68, 30, 24, 5);
  fillStroke(ctx, n > 0.5 ? '#FFE9A8' : '#BFE9FF', O, 2);
  circle(ctx, 20, -56, 6);
  fillStroke(ctx, '#B97E52', O, 1.6);
  ctx.fillStyle = '#1F1A2E';
  ctx.beginPath();
  ctx.arc(20, -57, 6, Math.PI, 0);
  ctx.fill();
  // yellow stripe + number plate
  ctx.fillStyle = '#FFC72C';
  ctx.fillRect(-46, -24, 96, 5);
  lampDot(ctx, 50, -36, 3.5, '#FFF4C2', n, O);
  lampDot(ctx, -47, -30, 3, '#FF4D5E', n, O);
  ctx.restore();

  wheel(ctx, -28, -11, 11, t * 14, O);
  wheel(ctx, 34, -10, 10, t * 14, O);
}

export function drawManhole(ctx, t, o) {
  const O = o.outline;
  // the lid somebody "borrowed" and left next to the hole
  ctx.save();
  ctx.translate(36, -4);
  ctx.rotate(-0.25);
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#7A7480', O, 2);
  ctx.restore();
  // hole
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#8C8794', O, 2.6);
  ctx.beginPath();
  ctx.ellipse(0, 1, 25, 7.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#120E18';
  ctx.fill();
  // a whiff of something...
  ctx.strokeStyle = 'rgba(160, 200, 120, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const w = Math.sin(t * 4) * 3;
  ctx.moveTo(-6, -4);
  ctx.quadraticCurveTo(-10 + w, -14, -4, -22);
  ctx.moveTo(6, -4);
  ctx.quadraticCurveTo(2 - w, -16, 8, -26);
  ctx.stroke();
}

export function drawPuddle(ctx, t, o) {
  ctx.beginPath();
  ctx.ellipse(0, 0, 48, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(70, 140, 200, 0.75)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(30, 60, 100, 0.8)';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-8, -3, 26, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(190, 235, 255, 0.55)';
  ctx.fill();
  // ripples
  const r = (t * 0.9) % 1;
  ctx.globalAlpha = 1 - r;
  ctx.strokeStyle = '#E3F6FF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(12, 1, 6 + r * 16, 2 + r * 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawCar(ctx, t, o, body, police) {
  const O = o.outline;
  const n = o.night;
  headlight(ctx, 56, -24, 160, n);
  ctx.beginPath();
  ctx.moveTo(-54, -14);
  ctx.lineTo(-54, -32);
  ctx.quadraticCurveTo(-50, -38, -36, -40);
  ctx.lineTo(-26, -58);
  ctx.quadraticCurveTo(-22, -62, -14, -62);
  ctx.lineTo(18, -62);
  ctx.quadraticCurveTo(26, -60, 32, -42);
  ctx.lineTo(50, -38);
  ctx.quadraticCurveTo(58, -36, 58, -26);
  ctx.lineTo(58, -14);
  ctx.closePath();
  fillStroke(ctx, body, O, 2.8);
  // windows
  ctx.beginPath();
  ctx.moveTo(-22, -42);
  ctx.lineTo(-16, -56);
  ctx.lineTo(2, -56);
  ctx.lineTo(2, -42);
  ctx.closePath();
  ctx.moveTo(6, -42);
  ctx.lineTo(6, -56);
  ctx.lineTo(18, -56);
  ctx.lineTo(25, -42);
  ctx.closePath();
  fillStroke(ctx, police ? '#BFE9FF' : '#2E3445', O, 2);
  if (police) {
    ctx.fillStyle = '#2D6CDF';
    ctx.fillRect(-52, -30, 108, 6);
    // flashing light bar
    const on = Math.floor(t * 8) % 2 === 0;
    roundRect(ctx, -12, -70, 24, 7, 3);
    fillStroke(ctx, '#DDDDDD', O, 1.6);
    circle(ctx, -6, -67, 3.5);
    ctx.fillStyle = on ? '#FF2D3D' : '#7A1520';
    ctx.fill();
    circle(ctx, 6, -67, 3.5);
    ctx.fillStyle = on ? '#3355FF' : '#FF2D3D';
    ctx.fill();
    ctx.globalAlpha = 0.35 + 0.35 * (on ? 1 : 0);
    circle(ctx, on ? -6 : 6, -67, 14);
    ctx.fillStyle = on ? '#FF2D3D' : '#3355FF';
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // tiny flag on the bonnet
    ctx.strokeStyle = O;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(48, -38);
    ctx.lineTo(48, -58);
    ctx.stroke();
    const f = Math.sin(t * 20) * 1.5;
    ctx.fillStyle = '#006A4E';
    ctx.fillRect(48, -58 + f * 0.2, 16, 10);
    circle(ctx, 55, -53 + f * 0.2, 3);
    ctx.fillStyle = '#F42A41';
    ctx.fill();
  }
  lampDot(ctx, 55, -26, 3, '#FFF4C2', n, O);
  wheel(ctx, -34, -12, 12, t * 16, O);
  wheel(ctx, 36, -12, 12, t * 16, O);
}

/** Three-car convoy facing LEFT (it sweeps toward the player). */
export function drawVip(ctx, t, o) {
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-130, 0);
  drawCar(ctx, t, o, '#FFFFFF', true);
  ctx.translate(130, 0);
  drawCar(ctx, t, o, '#1B1B22', false);
  ctx.translate(130, 0);
  drawCar(ctx, t, o, '#FFFFFF', true);
  ctx.restore();
}

export function drawHawker(ctx, t, o) {
  const O = o.outline;
  const p = t * 7;
  ctx.save();
  ctx.scale(-1, 1); // walks toward the player
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // legs
  for (let i = 0; i < 2; i++) {
    const a = Math.sin(p + i * Math.PI) * 0.45;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(Math.sin(a) * 28, -30 + Math.cos(a) * 28);
    ctx.strokeStyle = O;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = '#9C6644';
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  // checkered lungi
  ctx.beginPath();
  ctx.moveTo(-10, -48);
  ctx.lineTo(10, -48);
  ctx.lineTo(13, -18);
  ctx.lineTo(-13, -18);
  ctx.closePath();
  fillStroke(ctx, '#1FA67A', O, 2.4);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = -8; i <= 8; i += 5) {
    ctx.moveTo(i, -47);
    ctx.lineTo(i * 1.3, -19);
  }
  ctx.moveTo(-12, -38);
  ctx.lineTo(12, -38);
  ctx.moveTo(-13, -28);
  ctx.lineTo(13, -28);
  ctx.stroke();
  // vest
  roundRect(ctx, -10, -68, 20, 24, 6);
  fillStroke(ctx, '#FFD6A5', O, 2.4);
  // arms holding up the basket
  ctx.beginPath();
  ctx.moveTo(-7, -64);
  ctx.lineTo(-14, -80);
  ctx.lineTo(-12, -94);
  ctx.moveTo(7, -64);
  ctx.lineTo(14, -80);
  ctx.lineTo(12, -94);
  ctx.strokeStyle = O;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = '#9C6644';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  // head
  circle(ctx, 1, -78, 8);
  fillStroke(ctx, '#9C6644', O, 2.2);
  ctx.fillStyle = O;
  circle(ctx, 5, -79, 1.3);
  ctx.fill();
  // the basket, wobbling
  ctx.save();
  ctx.translate(0, -92);
  ctx.rotate(Math.sin(t * 5) * 0.06);
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 7, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#C68A4E', O, 2.4);
  // fruits / peanuts piled up
  const fr = ['#FF8A00', '#FFC72C', '#F42A41', '#FF8A00', '#7DC243'];
  for (let i = 0; i < 5; i++) {
    circle(ctx, -14 + i * 7, -6 - (i % 2) * 4, 5);
    fillStroke(ctx, fr[i], O, 1.5);
  }
  ctx.strokeStyle = 'rgba(42,30,59,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-18, 2);
  ctx.lineTo(18, 2);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

export function drawDog(ctx, t, o) {
  const O = o.outline;
  const p = t * 16;
  ctx.save();
  ctx.scale(-1, 1); // runs toward the player
  ctx.lineCap = 'round';
  const bob = Math.abs(Math.sin(p)) * 2;
  ctx.translate(0, -bob);
  // legs
  for (let i = 0; i < 4; i++) {
    const lx = i < 2 ? -12 + i * 4 : 10 + (i - 2) * 4;
    const a = Math.sin(p + i * 1.6) * 0.6;
    ctx.beginPath();
    ctx.moveTo(lx, -16);
    ctx.lineTo(lx + Math.sin(a) * 14, -16 + Math.cos(a) * 14);
    ctx.strokeStyle = O;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = '#C68A4E';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }
  // tail
  ctx.beginPath();
  ctx.moveTo(-18, -22);
  ctx.quadraticCurveTo(-30, -28 + Math.sin(t * 22) * 6, -26, -38);
  ctx.strokeStyle = O;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = '#C68A4E';
  ctx.lineWidth = 3;
  ctx.stroke();
  // body
  ctx.beginPath();
  ctx.ellipse(0, -21, 21, 9, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#C68A4E', O, 2.6);
  ctx.fillStyle = '#F2D2A9';
  ctx.beginPath();
  ctx.ellipse(4, -16, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  circle(ctx, 22, -30, 8.5);
  fillStroke(ctx, '#C68A4E', O, 2.4);
  ctx.beginPath();
  ctx.ellipse(30, -28, 6, 4, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#F2D2A9', O, 2);
  circle(ctx, 35, -29, 1.8);
  ctx.fillStyle = O;
  ctx.fill();
  // floppy ear
  ctx.beginPath();
  ctx.moveTo(17, -36);
  ctx.quadraticCurveTo(12, -30 + Math.sin(t * 16) * 2, 15, -24);
  ctx.lineTo(21, -32);
  ctx.closePath();
  fillStroke(ctx, '#8B5A2B', O, 2);
  circle(ctx, 25, -32, 1.6);
  ctx.fillStyle = O;
  ctx.fill();
  // tongue
  ctx.fillStyle = '#FF6B8A';
  ctx.fillRect(30, -24, 3, 5);
  ctx.restore();

  if (o.alert) {
    // "!" bubble when it's about to switch lanes
    ctx.font = '800 22px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = O;
    ctx.strokeText('!', 0, -50);
    ctx.fillStyle = '#FFC72C';
    ctx.fillText('!', 0, -50);
  }
}

export function drawCoaching(ctx, t, o) {
  const O = o.outline;
  ctx.save();
  ctx.scale(-1, 1);
  ctx.lineCap = 'round';
  // legs
  ctx.beginPath();
  ctx.moveTo(-4, -30);
  ctx.lineTo(-6, 0);
  ctx.moveTo(4, -30);
  ctx.lineTo(6, 0);
  ctx.strokeStyle = O;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = '#3D3F55';
  ctx.lineWidth = 5;
  ctx.stroke();
  // long panjabi
  roundRect(ctx, -12, -68, 24, 44, 7);
  fillStroke(ctx, '#FFFFFF', O, 2.6);
  // sash with "Bangla-ish" scribble
  ctx.save();
  ctx.translate(0, -50);
  ctx.rotate(-0.6);
  ctx.fillStyle = '#E6397D';
  ctx.fillRect(-16, -4, 32, 8);
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-12, -2);
  ctx.lineTo(12, -2);
  ctx.moveTo(-10, -2);
  ctx.quadraticCurveTo(-6, 4, -2, -1);
  ctx.quadraticCurveTo(3, 4, 8, -1);
  ctx.stroke();
  ctx.restore();
  // arm thrusting a leaflet at you
  const reach = Math.sin(t * 6) * 4;
  ctx.beginPath();
  ctx.moveTo(8, -62);
  ctx.lineTo(22 + reach, -56);
  ctx.strokeStyle = O;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = '#B97E52';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.save();
  ctx.translate(27 + reach, -58);
  ctx.rotate(Math.sin(t * 6) * 0.2);
  ctx.fillStyle = '#FFE082';
  ctx.fillRect(-5, -7, 10, 13);
  ctx.strokeStyle = O;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-5, -7, 10, 13);
  ctx.restore();
  // head + neat moustache
  circle(ctx, 1, -78, 9);
  fillStroke(ctx, '#B97E52', O, 2.4);
  ctx.fillStyle = '#1F1A2E';
  ctx.beginPath();
  ctx.arc(1, -80, 9, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  ctx.fillRect(3, -74, 7, 2);
  circle(ctx, 6, -79, 1.3);
  ctx.fill();
  ctx.restore();
  // leaflets fluttering around him
  for (let i = 0; i < 3; i++) {
    const a = t * 2 + i * 2.1;
    const lx = Math.cos(a) * 26;
    const ly = -70 + Math.sin(a * 1.3) * 18;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a * 2);
    ctx.fillStyle = i === 1 ? '#FFE082' : '#FFFFFF';
    ctx.fillRect(-4, -5, 8, 10);
    ctx.strokeStyle = O;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-4, -5, 8, 10);
    ctx.restore();
  }
}

export function drawPhone(ctx, t, o) {
  const O = o.outline;
  const bob = Math.sin(t * 4) * 4;
  const shake = Math.sin(t * 50) * 0.12;
  ctx.save();
  ctx.translate(0, -48 + bob);
  // ring waves
  const r = (t * 1.6) % 1;
  ctx.globalAlpha = 1 - r;
  ctx.strokeStyle = '#F42A41';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 22 + r * 16, -0.7, 0.7);
  ctx.moveTo(-22 - r * 16, 0);
  ctx.arc(0, 0, 22 + r * 16, Math.PI - 0.7, Math.PI + 0.7);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.rotate(shake);
  roundRect(ctx, -13, -22, 26, 44, 6);
  fillStroke(ctx, '#2A2333', O, 2.8);
  roundRect(ctx, -10, -18, 20, 34, 3);
  ctx.fillStyle = '#FFF4E0';
  ctx.fill();
  ctx.fillStyle = '#2A1E3B';
  ctx.font = o.font ? o.font(800, 9) : '800 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.label || 'BOSS', 0, -8);
  circle(ctx, -5, 7, 3.5);
  ctx.fillStyle = '#1FA67A';
  ctx.fill();
  circle(ctx, 5, 7, 3.5);
  ctx.fillStyle = '#F42A41';
  ctx.fill();
  ctx.restore();
}

// ======================================================================
//  Power-up art (they float, bob and glow)
// ======================================================================

function bubble(ctx, t, color) {
  const pulse = 1 + Math.sin(t * 6) * 0.08;
  ctx.globalAlpha = 0.28;
  circle(ctx, 0, 0, 24 * pulse);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 0.9;
  circle(ctx, 0, 0, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawCoin(ctx, t, o) {
  const O = o.outline;
  ctx.save();
  ctx.translate(0, -30 + Math.sin(t * 5 + (o.variant || 0)) * 3);
  ctx.scale(Math.max(0.2, Math.abs(Math.cos(t * 4 + (o.variant || 0)))), 1); // spin
  circle(ctx, 0, 0, 10);
  fillStroke(ctx, '#FFC72C', O, 2.4);
  circle(ctx, 0, 0, 6.5);
  ctx.strokeStyle = '#E09A00';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#B86E00';
  ctx.font = '800 11px "Baloo 2", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('৳', 0, 1);
  ctx.restore();
}

export function drawCha(ctx, t, o) {
  const O = o.outline;
  ctx.save();
  ctx.translate(0, -38 + Math.sin(t * 4) * 4);
  bubble(ctx, t, '#E6397D');
  // a glass of milk tea, Dhaka tong-style
  ctx.beginPath();
  ctx.moveTo(-8, -9);
  ctx.lineTo(8, -9);
  ctx.lineTo(6, 10);
  ctx.lineTo(-6, 10);
  ctx.closePath();
  fillStroke(ctx, '#E9F6FF', O, 2.2);
  ctx.beginPath();
  ctx.moveTo(-7.3, -3);
  ctx.lineTo(7.3, -3);
  ctx.lineTo(6, 10);
  ctx.lineTo(-6, 10);
  ctx.closePath();
  ctx.fillStyle = '#C47A3A';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -6);
  ctx.lineTo(-3, 7);
  ctx.stroke();
  // steam
  ctx.strokeStyle = 'rgba(42,30,59,0.45)';
  ctx.lineWidth = 1.6;
  const s = Math.sin(t * 5) * 2;
  ctx.beginPath();
  ctx.moveTo(-2, -12);
  ctx.quadraticCurveTo(-5 + s, -16, -2, -20);
  ctx.moveTo(3, -12);
  ctx.quadraticCurveTo(0 - s, -17, 3, -21);
  ctx.stroke();
  ctx.restore();
}

export function drawShingara(ctx, t, o) {
  const O = o.outline;
  ctx.save();
  ctx.translate(0, -38 + Math.sin(t * 4 + 1) * 4);
  bubble(ctx, t, '#FFC72C');
  ctx.rotate(Math.sin(t * 3) * 0.15);
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.quadraticCurveTo(4, -9, 11, 8);
  ctx.quadraticCurveTo(0, 12, -11, 8);
  ctx.quadraticCurveTo(-4, -9, 0, -11);
  ctx.closePath();
  fillStroke(ctx, '#E9A23B', O, 2.4);
  ctx.strokeStyle = '#B5711F';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-2, -5);
  ctx.lineTo(-5, 6);
  ctx.moveTo(3, -4);
  ctx.lineTo(5, 6);
  ctx.stroke();
  ctx.restore();
}

export function drawShortcut(ctx, t, o) {
  const O = o.outline;
  ctx.save();
  ctx.translate(0, -38 + Math.sin(t * 4 + 2) * 4);
  bubble(ctx, t, '#00A6A6');
  const wob = Math.sin(t * 30) * 0.08;
  ctx.rotate(wob);
  // alarm-clock bells
  circle(ctx, -7, -9, 4);
  fillStroke(ctx, '#F42A41', O, 1.8);
  circle(ctx, 7, -9, 4);
  fillStroke(ctx, '#F42A41', O, 1.8);
  circle(ctx, 0, 1, 10);
  fillStroke(ctx, '#F42A41', O, 2.4);
  circle(ctx, 0, 1, 7);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = O;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(0, -4);
  ctx.moveTo(0, 1);
  ctx.lineTo(4, 3);
  ctx.stroke();
  ctx.restore();
}

// ======================================================================
//  Entity types + manager
// ======================================================================

/*
 * kind: 'block' = costs a life, 'ground' = jump over it,
 *       'soft' = annoying but no life lost, 'pickup' = collect it
 * hw:   half-width of the hit box (at lane scale 1)
 * clear: how high the player must be (jump height) to sail over it
 * self: the entity's own forward speed (same direction as the player)
 */
export const TYPES = {
  rickshaw: { kind: 'block', hw: 52, clear: Infinity, self: 70, draw: drawRickshaw, shadow: 62 },
  bus: { kind: 'block', hw: 112, clear: Infinity, self: 55, draw: drawBus, shadow: 118 },
  cng: { kind: 'block', hw: 46, clear: Infinity, self: 0, draw: drawCNG, shadow: 52 },
  vip: { kind: 'block', hw: 190, clear: Infinity, self: -380, draw: drawVip, shadow: 0 },
  hawker: { kind: 'block', hw: 20, clear: Infinity, self: 0, draw: drawHawker, shadow: 18 },
  dog: { kind: 'block', hw: 22, clear: 30, self: -40, draw: drawDog, shadow: 22 },
  manhole: { kind: 'ground', hw: 24, clear: 14, self: 0, draw: drawManhole, shadow: 0 },
  puddle: { kind: 'ground', hw: 40, clear: 12, self: 0, draw: drawPuddle, shadow: 0 },
  coaching: { kind: 'soft', hw: 20, clear: Infinity, self: 0, draw: drawCoaching, shadow: 18 },
  phone: { kind: 'soft', hw: 16, clear: Infinity, self: 0, draw: drawPhone, shadow: 12 },
  coin: { kind: 'pickup', hw: 12, clear: Infinity, self: 0, draw: drawCoin, shadow: 7 },
  cha: { kind: 'pickup', hw: 18, clear: Infinity, self: 0, draw: drawCha, shadow: 12 },
  shingara: { kind: 'pickup', hw: 18, clear: Infinity, self: 0, draw: drawShingara, shadow: 12 },
  shortcut: { kind: 'pickup', hw: 18, clear: Infinity, self: 0, draw: drawShortcut, shadow: 12 }
};

/** Draw any entity type by name (used by menus / tutorial demos too). */
export function drawEntityArt(ctx, type, t, o) {
  TYPES[type].draw(ctx, t, o);
}

function makeEntity() {
  return {
    active: false, type: '', def: null, lane: 0, laneF: 0, laneTarget: 0,
    x: 0, self: 0, t: 0, state: '', timer: 0, hit: false, passed: false,
    sounded: false, variant: 0, switched: false, alert: 0, walkDelay: 0
  };
}

export const CNG_REL_SPEED = 330; // how much faster than you a CNG zooms past

export class EntityManager {
  constructor(size = 56) {
    this.pool = [];
    for (let i = 0; i < size; i++) this.pool.push(makeEntity());
    this.list = []; // active entities (reused array, no per-frame allocation)
    this.onEvent = null; // engine hook: (name, entity) => void
  }

  clear() {
    for (const e of this.pool) e.active = false;
    this.list.length = 0;
  }

  spawn(type, lane, x) {
    let e = null;
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        e = this.pool[i];
        break;
      }
    }
    if (!e) return null; // pool exhausted: skip (never happens with sane spawn rates)
    const def = TYPES[type];
    e.active = true;
    e.type = type;
    e.def = def;
    e.lane = lane;
    e.laneF = lane;
    e.laneTarget = lane;
    e.x = x;
    e.self = def.self;
    e.t = Math.random() * 10;
    e.state = 'go';
    e.timer = 0;
    e.hit = false;
    e.passed = false;
    e.sounded = false;
    e.variant = Math.floor(Math.random() * 4);
    e.switched = false;
    e.alert = 0;
    e.walkDelay = 0;
    this.list.push(e);
    return e;
  }

  update(dt, speed, info) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.t += dt;

      switch (e.type) {
        case 'cng':
          if (e.state === 'warn') {
            e.timer -= dt;
            if (e.timer <= 0) {
              e.state = 'go';
              if (this.onEvent) this.onEvent('cngGo', e);
            }
          } else {
            e.x += CNG_REL_SPEED * dt; // overtakes from behind
          }
          break;
        case 'vip':
          if (e.state === 'warn') {
            e.timer -= dt;
            if (e.timer <= 0) e.state = 'go';
          } else {
            e.x -= (speed - e.self) * dt;
          }
          break;
        case 'hawker':
          e.x -= (speed - e.self) * dt;
          if (e.x < info.viewW - 40 && e.laneF !== e.laneTarget) {
            const step = 0.45 * dt;
            e.laneF += Math.sign(e.laneTarget - e.laneF) * Math.min(step, Math.abs(e.laneTarget - e.laneF));
          }
          break;
        case 'dog':
          e.x -= (speed - e.self) * dt;
          if (!e.switched && e.x < info.playerX + 330) {
            e.switched = true;
            e.alert = 0.8;
            if (info.playerLane !== e.lane) e.laneTarget = e.lane + Math.sign(info.playerLane - e.lane);
            if (this.onEvent) this.onEvent('bark', e);
          }
          if (e.alert > 0) e.alert -= dt;
          if (e.laneF !== e.laneTarget) {
            const step = 2.6 * dt;
            e.laneF += Math.sign(e.laneTarget - e.laneF) * Math.min(step, Math.abs(e.laneTarget - e.laneF));
          }
          break;
        default:
          e.x -= (speed - e.self) * dt;
      }
      e.lane = Math.round(e.laneF);

      // proximity sounds (rickshaw bell, bus horn)
      if (!e.sounded && this.onEvent && e.state === 'go') {
        if (e.type === 'rickshaw' && e.x - info.playerX < 300) {
          e.sounded = true;
          if (Math.random() < 0.7) this.onEvent('bell', e);
        } else if (e.type === 'bus' && e.x < info.viewW + 40) {
          e.sounded = true;
          this.onEvent('horn', e);
        }
      }

      // recycle anything that has left the screen
      const gone = e.type === 'cng' ? e.state === 'go' && e.x > info.viewW + 200 : e.x < -320;
      if (gone) {
        e.active = false;
        list[i] = list[list.length - 1];
        list.pop();
      }
    }
  }
}

// ======================================================================
//  Spawner — the "level designer"
// ======================================================================

const ALL_LANES = 0b111;

function bitCount(m) {
  return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
}

/** Random lane index whose bit is set in mask. */
function randomLaneIn(mask) {
  const n = bitCount(mask);
  if (!n) return 1;
  let k = Math.floor(Math.random() * n);
  for (let l = 0; l < 3; l++) {
    if (mask & (1 << l)) {
      if (k === 0) return l;
      k--;
    }
  }
  return 1;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class Spawner {
  constructor(em, cfg) {
    this.em = em;
    this.cfg = cfg;
    this.reset();
  }

  reset() {
    this.distToWave = 650; // a calm first second
    this.lock = 0;
    this.prevFree = ALL_LANES; // lanes left open by the previous wave
    this.cngCd = 5;
    this.vipCd = 9;
    this.waves = 0;
  }

  update(dt, speed, info) {
    this.cngCd -= dt;
    this.vipCd -= dt;
    if (info.noSpawn) return;
    if (this.lock > 0) {
      // a special event (CNG / VIP) is running: hold normal waves
      this.lock -= dt;
      if (this.lock <= 0) this.distToWave = 60;
      return;
    }
    this.distToWave -= speed * dt;
    if (this.distToWave <= 0) {
      const extra = this.wave(info);
      const d = info.difficulty;
      const s = this.cfg.spawn;
      this.distToWave = lerp(s.gapMaxPx, s.gapMinPx, d) + Math.random() * lerp(s.jitterMaxPx, s.jitterMinPx, d) + extra;
    }
  }

  /** Is lane L free of blocking things between x0 and x1? */
  laneClear(L, x0, x1) {
    const list = this.em.list;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const k = e.def.kind;
      if (k === 'pickup' || k === 'ground') continue;
      if (Math.abs(e.laneF - L) > 0.6 && Math.abs(e.laneTarget - L) > 0.6) continue;
      if (e.x - e.def.hw < x1 && e.x + e.def.hw > x0) return false;
    }
    return true;
  }

  /** At least one OTHER lane than `lane` is clear in the window? */
  hasEscape(lane, x0, x1) {
    for (let l = 0; l < 3; l++) {
      if (l !== lane && Math.abs(l - lane) <= 2 && this.laneClear(l, x0, x1)) return true;
    }
    return false;
  }

  tryCng(info) {
    const lane = info.playerLane;
    if (!this.hasEscape(lane, info.playerX - 90, info.playerX + info.speed * 2.2)) return false;
    const e = this.em.spawn('cng', lane, -110);
    if (!e) return false;
    e.state = 'warn';
    e.timer = this.cfg.cngWarnSec;
    this.lock = this.cfg.cngWarnSec + 1.3;
    this.cngCd = 7 + Math.random() * 4;
    this.prevFree = ALL_LANES;
    if (this.em.onEvent) this.em.onEvent('cngWarn', e);
    return true;
  }

  tryVip(info) {
    const lane = info.playerLane;
    if (!this.hasEscape(lane, info.playerX - 90, info.playerX + info.speed * 3)) return false;
    const e = this.em.spawn('vip', lane, info.viewW + 260);
    if (!e) return false;
    e.state = 'warn';
    e.timer = this.cfg.vipWarnSec;
    this.lock = this.cfg.vipWarnSec + 1.5;
    this.vipCd = 12 + Math.random() * 6;
    this.prevFree = ALL_LANES;
    if (this.em.onEvent) this.em.onEvent('vipWarn', e);
    return true;
  }

  pickObstacle(info, blockCount) {
    const d = info.difficulty;
    const w = this.weights;
    w.rickshaw = 4;
    w.bus = d > 0.06 ? 2 : 0;
    w.hawker = blockCount === 1 ? 1.4 : 0;
    w.dog = d > 0.1 ? 1.1 : 0;
    w.manhole = 1.4;
    w.puddle = info.rain ? 2.8 : 0.9;
    w.special = d > 0.05 ? 1.1 : 0;
    let total = 0;
    for (const k in w) total += w[k];
    let r = Math.random() * total;
    for (const k in w) {
      r -= w[k];
      if (r <= 0) return k === 'special' ? (info.role === 'employee' ? 'phone' : 'coaching') : k;
    }
    return 'rickshaw';
  }

  pickPowerUp(info) {
    const cha = 3;
    const shingara = info.lives < info.maxLives ? 2.4 : 0.4;
    const shortcut = info.mode === 'story' ? 1.4 : 0;
    const r = Math.random() * (cha + shingara + shortcut);
    if (r < cha) return 'cha';
    if (r < cha + shingara) return 'shingara';
    return 'shortcut';
  }

  wave(info) {
    const d = info.difficulty;
    const x = info.viewW + 130;
    this.waves++;

    // Special events first — each checks that an escape lane exists.
    if (this.waves > 2 && d > 0.1 && this.cngCd <= 0 && Math.random() < 0.14 && this.tryCng(info)) return 0;
    if (this.waves > 4 && d > 0.2 && this.vipCd <= 0 && Math.random() < 0.12 && this.tryVip(info)) return 0;

    // Keep one lane that was free last wave free again → always a way through.
    const keep = randomLaneIn(this.prevFree);
    const blockCount = Math.random() < 0.74 - 0.44 * d ? 1 : 2;
    let blocked = 0;
    let extra = 0;
    // the two candidate lanes (not `keep`), in random order
    let a = (keep + 1) % 3;
    let b = (keep + 2) % 3;
    if (Math.random() < 0.5) {
      const tmp = a;
      a = b;
      b = tmp;
    }
    for (let i = 0; i < blockCount; i++) {
      const lane = i === 0 ? a : b;
      const type = this.pickObstacle(info, blockCount);
      const e = this.em.spawn(type, lane, x + (i ? 40 + Math.random() * 90 : 0));
      if (!e) continue;
      blocked |= 1 << lane;
      if (type === 'bus') extra = Math.max(extra, 150);
      if (type === 'hawker') {
        // walks into a neighbouring lane — but never into the kept lane
        e.laneTarget = lane;
        for (let dl = -1; dl <= 1; dl += 2) {
          const t = lane + dl;
          if (t >= 0 && t <= 2 && t !== keep && Math.random() < 0.8) e.laneTarget = t;
        }
      }
    }
    const free = ALL_LANES & ~blocked;

    // Harder: sometimes put something to jump in an open lane (still passable).
    if (d > 0.35 && Math.random() < 0.32 * d) {
      const lane = randomLaneIn(free);
      this.em.spawn(info.rain && Math.random() < 0.6 ? 'puddle' : 'manhole', lane, x + 60);
    }

    // Goodies in an open lane.
    const r = Math.random();
    if (r < 0.32) {
      const lane = randomLaneIn(free);
      const n = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.em.spawn('coin', lane, x - 40 + i * 40);
    } else if (r < 0.32 + this.cfg.spawn.powerUpChance) {
      this.em.spawn(this.pickPowerUp(info), randomLaneIn(free), x + 90);
    }

    this.prevFree = free;
    return extra;
  }
}

// weights object reused by pickObstacle (no allocation per wave)
Spawner.prototype.weights = { rickshaw: 0, bus: 0, hawker: 0, dog: 0, manhole: 0, puddle: 0, special: 0 };
