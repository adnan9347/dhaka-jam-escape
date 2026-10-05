/*
 * player.js — the two playable characters, drawn entirely with code.
 *
 *  - drawCharacter(ctx, role, pose, t, opts) paints the Student or the
 *    Employee in any pose. It is also reused by the menus (role cards,
 *    result screen) and by the share card, so the art lives in ONE place.
 *  - class Player holds the gameplay state: which lane, jumping, squash and
 *    stretch, invincibility blinking, boost, falling into a manhole...
 *
 * Coordinates: (0, 0) is the point between the character's feet, y grows
 * downward, the character faces RIGHT and is about 84 units tall.
 */

const SKIN = '#D49A6A';
const SKIN_SHADE = '#B97E52';
const BLUSH = 'rgba(240, 110, 120, 0.45)';

const LOOKS = {
  student: {
    shirt: '#FFFFFF', shirtShade: '#E4E8F2', pants: '#24316B', shoes: '#1B1B22',
    hair: '#1F1A2E', bag: '#F25C3C', bagPocket: '#FFC72C', lanyard: '#2D6CDF'
  },
  employee: {
    shirt: '#BFE3FF', shirtShade: '#9FCBEF', pants: '#3D3F55', shoes: '#5B3A29',
    hair: '#2A2333', bag: '#8B5A2B', bagPocket: '#6E4520', lanyard: '#1FA67A',
    tie: '#E63946', tieStripe: '#FFC72C'
  }
};

// Scratch point reused by limb() so drawing never allocates.
const END = { x: 0, y: 0 };

/**
 * Draw a two-segment limb (thigh+shin or upper arm+forearm) as thick
 * rounded strokes: first a fat dark stroke (outline), then the colored one.
 * Angles are measured from "straight down"; positive = toward the front.
 */
function limb(ctx, x0, y0, a1, l1, a2, l2, color, w, outline) {
  const x1 = x0 + Math.sin(a1) * l1;
  const y1 = y0 + Math.cos(a1) * l1;
  const x2 = x1 + Math.sin(a1 + a2) * l2;
  const y2 = y1 + Math.cos(a1 + a2) * l2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = outline;
  ctx.lineWidth = w + 5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
  END.x = x2;
  END.y = y2;
  return END;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillStroke(ctx, fill, outline, lw = 2.5) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = outline;
  ctx.stroke();
}

function shoe(ctx, x, y, color, outline) {
  ctx.beginPath();
  ctx.ellipse(x + 2.5, y, 6, 3.6, 0, 0, Math.PI * 2);
  fillStroke(ctx, color, outline, 2.2);
}

function smallStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// Default options object reused when the caller passes nothing.
const DEFAULT_OPTS = { outline: '#2A1E3B', speed: 1 };

/**
 * Paint a character.
 * pose: 'idle' | 'run' | 'jump' | 'hit' | 'boost' | 'win' | 'lose'
 * t: time in seconds (drives every animation), opts.phase: run-cycle phase.
 */
export function drawCharacter(ctx, role, pose, t, opts = DEFAULT_OPTS) {
  const L = LOOKS[role] || LOOKS.student;
  const O = opts.outline || '#2A1E3B';
  const isStudent = role !== 'employee';
  const p = opts.phase !== undefined ? opts.phase : t * 11;

  // ---- work out limb angles for this pose ----
  let bob = 0;
  let lean = 0;
  let breathe = 1;
  let legBackA = -0.06, legBackK = 0, legFrontA = 0.06, legFrontK = 0;
  let armBackA = -0.12, armBackK = 0.25, armFrontA = 0.12, armFrontK = 0.3;
  let bagSwing = Math.sin(t * 2) * 0.05;
  let bagBounce = Math.sin(t * 2) * 0.6;
  let tieFlap = Math.sin(t * 1.5) * 0.06;
  let cardSwing = Math.sin(t * 1.8) * 0.12;
  let headTilt = 0;
  let lift = 0;

  if (pose === 'run' || pose === 'boost') {
    const s = Math.sin(p);
    const c = Math.cos(p);
    bob = -Math.abs(c) * 3;
    lean = pose === 'boost' ? 0.2 : 0.08;
    legFrontA = s * 0.75;
    legBackA = -s * 0.75;
    legFrontK = -(0.25 + Math.max(0, -c) * 1.15);
    legBackK = -(0.25 + Math.max(0, c) * 1.15);
    armFrontA = -s * 0.85;
    armBackA = s * 0.85;
    armFrontK = 1.1;
    armBackK = 1.1;
    bagSwing = Math.sin(p - 0.6) * 0.35;
    bagBounce = Math.sin(p * 2 - 0.8) * (isStudent ? 3.5 : 1.5);
    tieFlap = -(0.7 + Math.sin(t * 24) * 0.22) * (pose === 'boost' ? 1.3 : 1);
    cardSwing = -0.5 + Math.sin(p * 2) * 0.35;
  } else if (pose === 'jump') {
    legFrontA = 0.95;
    legFrontK = -1.7;
    legBackA = -0.35;
    legBackK = -1.1;
    armFrontA = 2.0;
    armFrontK = 0.5;
    armBackA = 2.1;
    armBackK = 0.4;
    bagBounce = -3;
    bagSwing = -0.3;
    tieFlap = 0.9;
    cardSwing = 0.8;
  } else if (pose === 'hit') {
    const w = Math.sin(t * 30);
    armFrontA = 2.2 + w * 0.4;
    armBackA = -2.2 - w * 0.4;
    armFrontK = 0.6;
    armBackK = -0.6;
    legFrontA = 0.3;
    legBackA = -0.3;
    lean = -0.12;
    headTilt = Math.sin(t * 12) * 0.12;
    tieFlap = Math.sin(t * 20) * 0.6;
  } else if (pose === 'win') {
    lift = Math.abs(Math.sin(t * 5.5)) * 14;
    armFrontA = 2.3 + Math.sin(t * 11) * 0.12;
    armBackA = -2.4 - Math.sin(t * 11) * 0.12;
    armFrontK = -0.2;
    armBackK = 0.2;
    legFrontA = lift > 4 ? 0.5 : 0.08;
    legFrontK = lift > 4 ? -1 : 0;
    legBackA = lift > 4 ? -0.3 : -0.08;
    legBackK = lift > 4 ? -0.8 : 0;
    tieFlap = Math.sin(t * 11) * 0.4;
    cardSwing = Math.sin(t * 11) * 0.5;
    bagBounce = Math.sin(t * 11) * 2;
  } else if (pose === 'lose') {
    lean = 0.32;
    headTilt = 0.18;
    armFrontA = 0.25;
    armFrontK = 0.05;
    armBackA = 0.15;
    armBackK = 0.05;
    legFrontA = 0.12;
    legFrontK = -0.25;
    legBackA = -0.05;
    legBackK = -0.15;
    breathe = 1 + Math.sin(t * 1.4) * 0.02;
    bob = 3;
    tieFlap = 0.08;
  } else {
    // idle: gentle breathing, arms hang loose
    breathe = 1 + Math.sin(t * 2.4) * 0.025;
    armFrontA = 0.12 + Math.sin(t * 2.4) * 0.03;
    armBackA = -0.12 - Math.sin(t * 2.4) * 0.03;
  }

  ctx.save();
  ctx.translate(0, -lift);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const hipY = -26 + bob;

  // ---- back leg ----
  limb(ctx, -3, hipY, legBackA, 13, legBackK, 13, shade(L.pants), 8, O);
  shoe(ctx, END.x, END.y, L.shoes, O);

  // ---- upper body (leans around the hip) ----
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  ctx.translate(0, -hipY);

  // Employee carries the office bag in the BACK hand; draw arm first.
  const shoulderY = -45 + bob;
  if (!isStudent) {
    const h = limb(ctx, -4, shoulderY, armBackA, 11, armBackK, 11, L.shirtShade, 7, O);
    drawOfficeBag(ctx, h.x, h.y, bagSwing, L, O);
  } else {
    limb(ctx, -4, shoulderY, armBackA, 11, armBackK, 11, L.shirtShade, 7, O);
    drawBackpack(ctx, bagBounce + bob, bagSwing, L, O);
  }

  // torso
  ctx.save();
  ctx.translate(0, hipY + 2);
  ctx.scale(1, breathe);
  roundRect(ctx, -11, -27, 23, 29, 8);
  fillStroke(ctx, L.shirt, O, 2.8);
  // belt line
  ctx.fillStyle = L.pants;
  ctx.fillRect(-10, -4, 21, 5);
  ctx.restore();

  // front leg (after torso so the thigh overlaps the shirt hem)
  limb(ctx, 3, hipY, legFrontA, 13, legFrontK, 13, L.pants, 8, O);
  shoe(ctx, END.x, END.y, L.shoes, O);

  if (isStudent) {
    // backpack strap over the shoulder
    ctx.strokeStyle = O;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-6, shoulderY - 2);
    ctx.quadraticCurveTo(-2, shoulderY + 8, -7, hipY - 2);
    ctx.stroke();
    ctx.strokeStyle = L.bag;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // school badge on the pocket
    ctx.fillStyle = '#2D6CDF';
    ctx.fillRect(4, shoulderY + 4, 5, 5);
  } else {
    drawTie(ctx, 5, shoulderY - 1, tieFlap, L, O);
  }

  // ID card on a lanyard (both characters have one)
  drawIdCard(ctx, 3, shoulderY - 1, cardSwing, L, O);

  // Raised arms (cheering, jumping, flailing) go BEHIND the head so they
  // never cover the face; otherwise the front arm is drawn on top.
  const armsUp = pose === 'win' || pose === 'jump' || pose === 'hit';
  if (armsUp) drawFrontArm(ctx, isStudent, pose, p, t, shoulderY, armFrontA, armFrontK, L, O);
  drawHead(ctx, pose, t, isStudent, L, O, bob, headTilt);
  if (!armsUp) drawFrontArm(ctx, isStudent, pose, p, t, shoulderY, armFrontA, armFrontK, L, O);

  ctx.restore(); // end lean

  // dizzy stars / sweat drop overlays
  if (pose === 'hit') {
    ctx.fillStyle = '#FFC72C';
    ctx.strokeStyle = O;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + i * 2.09;
      smallStar(ctx, 2 + Math.cos(a) * 18, -86 + Math.sin(a) * 5, 4.5);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (pose === 'lose') {
    const d = (t * 0.8) % 1;
    ctx.globalAlpha = 1 - d * 0.5;
    ctx.beginPath();
    const sx = 18;
    const sy = -76 + d * 8;
    ctx.moveTo(sx, sy - 7);
    ctx.quadraticCurveTo(sx + 5, sy, sx, sy + 3);
    ctx.quadraticCurveTo(sx - 5, sy, sx, sy - 7);
    fillStroke(ctx, '#7FD3FF', O, 1.8);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/** Front arm — the employee holds the phone in it. */
function drawFrontArm(ctx, isStudent, pose, p, t, shoulderY, fa, fk, L, O) {
  if (!isStudent) {
    if (pose === 'run' || pose === 'boost' || pose === 'idle') {
      // keep the phone up near the chest while running
      fa = 0.35 + Math.sin(p) * (pose === 'idle' ? 0 : 0.25);
      fk = 1.9;
    }
    const h = limb(ctx, 4, shoulderY, fa, 11, fk, 10, L.shirt, 7, O);
    drawPhoneInHand(ctx, h.x, h.y, t, O);
  } else {
    const h = limb(ctx, 4, shoulderY, fa, 11, fk, 11, L.shirt, 7, O);
    hand(ctx, h.x, h.y, O);
  }
}

function shade(hex) {
  // the back limbs are drawn a touch darker to fake depth
  return hex === '#24316B' ? '#1C2757' : hex === '#3D3F55' ? '#323446' : hex;
}

function hand(ctx, x, y, O) {
  ctx.beginPath();
  ctx.arc(x, y, 3.6, 0, Math.PI * 2);
  fillStroke(ctx, SKIN, O, 2);
}

function drawBackpack(ctx, bounce, swing, L, O) {
  ctx.save();
  ctx.translate(-12, -44 + bounce);
  ctx.rotate(swing * 0.4);
  roundRect(ctx, -14, -2, 15, 27, 6);
  fillStroke(ctx, L.bag, O, 2.8);
  roundRect(ctx, -12, 12, 10, 9, 3);
  fillStroke(ctx, L.bagPocket, O, 2);
  // a tiny flower patch (rickshaw-art vibes)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-6.5, 5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOfficeBag(ctx, hx, hy, swing, L, O) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(swing);
  ctx.strokeStyle = O;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 4, 4, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, -11, 4, 22, 15, 3);
  fillStroke(ctx, L.bag, O, 2.6);
  ctx.fillStyle = '#FFC72C';
  ctx.fillRect(-2, 8, 4, 3);
  ctx.restore();
  hand(ctx, hx, hy, O);
}

function drawTie(ctx, x, y, flap, L, O) {
  ctx.save();
  ctx.translate(x, y + 3);
  // knot
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(3, 0);
  ctx.lineTo(2, 4);
  ctx.lineTo(-2, 4);
  ctx.closePath();
  fillStroke(ctx, L.tie, O, 2);
  // tail flaps in the wind (rotates toward the back when running)
  ctx.translate(0, 4);
  ctx.rotate(flap);
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(2, 0);
  ctx.lineTo(3.5, 13);
  ctx.lineTo(0, 17);
  ctx.lineTo(-3.5, 13);
  ctx.closePath();
  fillStroke(ctx, L.tie, O, 2);
  ctx.strokeStyle = L.tieStripe;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-2.5, 5);
  ctx.lineTo(2.5, 3);
  ctx.moveTo(-3, 10);
  ctx.lineTo(3, 8);
  ctx.stroke();
  ctx.restore();
}

function drawIdCard(ctx, x, y, swing, L, O) {
  ctx.save();
  ctx.translate(x - 4, y);
  ctx.strokeStyle = L.lanyard;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const cx = Math.sin(swing) * 13;
  const cy = Math.cos(swing) * 13;
  ctx.lineTo(cx, cy);
  ctx.stroke();
  ctx.translate(cx, cy);
  ctx.rotate(-swing * 0.6);
  roundRect(ctx, -4, 0, 8, 10, 1.5);
  fillStroke(ctx, '#FFFFFF', O, 1.6);
  ctx.fillStyle = L.lanyard;
  ctx.fillRect(-3.2, 0.8, 6.4, 2.6);
  ctx.restore();
}

function drawPhoneInHand(ctx, hx, hy, t, O) {
  ctx.save();
  ctx.translate(hx + 1, hy - 4);
  ctx.rotate(-0.25);
  roundRect(ctx, -3.5, -6, 7, 12, 1.8);
  fillStroke(ctx, '#2A2333', O, 1.8);
  ctx.fillStyle = Math.sin(t * 3) > 0 ? '#2EE6E6' : '#7FF0F0';
  ctx.fillRect(-2.2, -4.5, 4.4, 8);
  ctx.restore();
  hand(ctx, hx, hy, O);
}

function drawHead(ctx, pose, t, isStudent, L, O, bob, tilt) {
  const hx = 2;
  const hy = -64 + bob;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);

  // neck
  ctx.fillStyle = SKIN_SHADE;
  ctx.fillRect(-3.5, 12, 7, 6);

  // ear (behind face, toward the back)
  ctx.beginPath();
  ctx.arc(-9, 2, 4, 0, Math.PI * 2);
  fillStroke(ctx, SKIN, O, 2.2);

  // face
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  fillStroke(ctx, SKIN, O, 2.8);

  // hair
  ctx.fillStyle = L.hair;
  ctx.strokeStyle = O;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  if (isStudent) {
    // messy spikes, just woke up
    const w = pose === 'run' || pose === 'boost' ? Math.sin(t * 18) * 1.5 : 0;
    ctx.moveTo(-16, 3);
    ctx.quadraticCurveTo(-18, -12, -8, -16);
    ctx.lineTo(-10 + w, -23);
    ctx.lineTo(-3, -17);
    ctx.lineTo(0 + w, -25);
    ctx.lineTo(4, -17);
    ctx.lineTo(10 + w, -22);
    ctx.lineTo(11, -14);
    ctx.lineTo(18 + w, -13);
    ctx.quadraticCurveTo(17, -6, 13, -7);
    ctx.quadraticCurveTo(4, -10, -6, -6);
    ctx.quadraticCurveTo(-10, -2, -12, 4);
    ctx.closePath();
  } else {
    // neat side part with a little office-worker gel
    ctx.moveTo(-16, 3);
    ctx.quadraticCurveTo(-18, -14, -4, -17);
    ctx.quadraticCurveTo(12, -19, 16, -8);
    ctx.quadraticCurveTo(8, -12, 2, -11);
    ctx.lineTo(4, -8);
    ctx.quadraticCurveTo(-6, -8, -11, -1);
    ctx.lineTo(-12, 4);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  drawFace(ctx, pose, t, isStudent, O);
  ctx.restore();
}

function eye(ctx, x, y, O, look) {
  ctx.beginPath();
  ctx.ellipse(x, y, 3.2, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = O;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + look, y + 0.5, 1.9, 0, Math.PI * 2);
  ctx.fillStyle = '#1B1426';
  ctx.fill();
}

function drawFace(ctx, pose, t, isStudent, O) {
  const ex1 = 5;
  const ex2 = 12;
  const ey = -1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = O;
  ctx.fillStyle = O;
  const blink = (pose === 'idle' || pose === 'run') && t % 3.4 < 0.13;

  // blush
  ctx.fillStyle = BLUSH;
  ctx.beginPath();
  ctx.arc(13, 7, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2;
  if (pose === 'hit') {
    // X X eyes
    for (const ex of [ex1, ex2]) {
      ctx.beginPath();
      ctx.moveTo(ex - 2.5, ey - 2.5);
      ctx.lineTo(ex + 2.5, ey + 2.5);
      ctx.moveTo(ex + 2.5, ey - 2.5);
      ctx.lineTo(ex - 2.5, ey + 2.5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(10, 8, 2.6, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5A1E2B';
    ctx.fill();
    return;
  }
  if (pose === 'win') {
    // happy ^ ^ eyes and a huge grin
    for (const ex of [ex1, ex2]) {
      ctx.beginPath();
      ctx.moveTo(ex - 3, ey + 1);
      ctx.lineTo(ex, ey - 2.5);
      ctx.lineTo(ex + 3, ey + 1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(4, 5);
    ctx.quadraticCurveTo(10, 14, 16, 5);
    ctx.closePath();
    ctx.fillStyle = '#5A1E2B';
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (pose === 'lose') {
    // droopy eyes, wobbly frown
    for (const ex of [ex1, ex2]) {
      ctx.beginPath();
      ctx.arc(ex, ey + 1, 2.6, Math.PI * 1.1, Math.PI * 1.9, false);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(5, 9);
    ctx.quadraticCurveTo(10, 4.5, 15, 9);
    ctx.stroke();
    return;
  }

  if (blink) {
    ctx.beginPath();
    ctx.moveTo(ex1 - 3, ey);
    ctx.lineTo(ex1 + 3, ey);
    ctx.moveTo(ex2 - 3, ey);
    ctx.lineTo(ex2 + 3, ey);
    ctx.stroke();
  } else {
    eye(ctx, ex1, ey, O, 0.9);
    eye(ctx, ex2, ey, O, 0.9);
    if (!isStudent) {
      // tired employee: heavy eyelids + eye bags
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      ctx.ellipse(ex1, ey - 2.2, 3.6, 2.4, 0, Math.PI, 0);
      ctx.ellipse(ex2, ey - 2.2, 3.6, 2.4, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = O;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ex1 - 3.4, ey - 1.4);
      ctx.lineTo(ex1 + 3.4, ey - 1.4);
      ctx.moveTo(ex2 - 3.4, ey - 1.4);
      ctx.lineTo(ex2 + 3.4, ey - 1.4);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(110, 70, 140, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ex1, ey + 3.5, 2.4, 0.2, Math.PI - 0.2);
      ctx.arc(ex2, ey + 3.5, 2.4, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = O;
  ctx.lineWidth = 2;
  if (pose === 'boost') {
    // determined eyebrows + gritted grin
    ctx.beginPath();
    ctx.moveTo(ex1 - 3, ey - 6);
    ctx.lineTo(ex1 + 3, ey - 4.5);
    ctx.moveTo(ex2 - 3, ey - 4.5);
    ctx.lineTo(ex2 + 3, ey - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(5, 6, 10, 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.stroke();
  } else if (pose === 'jump') {
    ctx.beginPath();
    ctx.ellipse(10, 8, 3, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5A1E2B';
    ctx.fill();
    ctx.stroke();
  } else if (pose === 'run') {
    ctx.beginPath();
    ctx.moveTo(6, 7);
    ctx.quadraticCurveTo(10.5, 11.5, 15, 7);
    ctx.closePath();
    ctx.fillStyle = '#5A1E2B';
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(6, 7);
    ctx.quadraticCurveTo(10.5, 11, 15, 7);
    ctx.stroke();
  }
}

// ======================================================================
//  Gameplay state
// ======================================================================

function easeOutCubic(x) {
  return 1 - (1 - x) * (1 - x) * (1 - x);
}

export class Player {
  constructor() {
    this.role = 'student';
    this.reset(1);
  }

  reset(lane = 1) {
    this.lane = lane; // target lane (0 = top / far, 2 = bottom / near)
    this.laneF = lane; // smooth, animated lane position
    this.laneFrom = lane;
    this.laneT = 1;
    this.jumpT = -1; // -1 = on the ground, 0..1 = progress through a jump
    this.jumpH = 0;
    this.sq = 0; // squash impulse (+ squash, − stretch)
    this.invincible = 0;
    this.hitTimer = 0;
    this.boostTimer = 0;
    this.fallTimer = 0;
    this.phase = 0;
    this.time = 0;
    this.justLanded = false;
    this.endPose = null; // 'win' | 'lose' at the end of a run
  }

  get airborne() {
    return this.jumpT >= 0;
  }

  /** Request a lane change (dir −1 = up, +1 = down). Works mid-animation. */
  moveLane(dir) {
    if (this.fallTimer > 0 || this.endPose) return false;
    const target = Math.max(0, Math.min(2, this.lane + dir));
    if (target === this.lane) return false;
    this.laneFrom = this.laneF;
    this.lane = target;
    this.laneT = 0;
    return true;
  }

  jump() {
    if (this.jumpT >= 0 || this.fallTimer > 0 || this.endPose) return false;
    this.jumpT = 0;
    this.sq = 0.22; // crouch before take-off
    return true;
  }

  /** Called when the player falls into a manhole. */
  fall(duration) {
    this.fallTimer = duration;
    this.jumpT = -1;
    this.jumpH = 0;
  }

  update(dt, speedFactor, cfg) {
    this.time += dt;
    this.justLanded = false;
    this.phase += dt * (9 + 5 * speedFactor) * (this.boostTimer > 0 ? 1.35 : 1);

    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / cfg.laneChangeSec);
      this.laneF = this.laneFrom + (this.lane - this.laneFrom) * easeOutCubic(this.laneT);
    }

    if (this.jumpT >= 0) {
      this.jumpT += dt / cfg.jumpSec;
      if (this.jumpT >= 1) {
        this.jumpT = -1;
        this.jumpH = 0;
        this.sq = 0.26; // landing squash
        this.justLanded = true;
      } else {
        const u = this.jumpT;
        this.jumpH = 4 * cfg.jumpHeight * u * (1 - u); // parabola
      }
    }

    this.sq -= this.sq * Math.min(1, 12 * dt);
    if (this.invincible > 0) this.invincible -= dt;
    if (this.hitTimer > 0) this.hitTimer -= dt;
    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.fallTimer > 0) this.fallTimer -= dt;
  }

  pose() {
    if (this.endPose) return this.endPose;
    if (this.hitTimer > 0) return 'hit';
    if (this.jumpT >= 0) return 'jump';
    if (this.boostTimer > 0) return 'boost';
    return 'run';
  }

  /** Draw at screen point (x, y) with lane perspective scale s. */
  draw(ctx, x, y, s, outline, fallDur) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    if (this.fallTimer > 0) {
      // Sink into the manhole: clip everything below the road surface.
      const k = 1 - this.fallTimer / fallDur; // 0 → 1
      const sink = k < 0.55 ? (k / 0.55) * 95 : 95;
      ctx.beginPath();
      ctx.rect(-80, -220, 160, 222);
      ctx.clip();
      ctx.translate(0, sink);
    }

    ctx.translate(0, -this.jumpH);

    // squash & stretch around the feet
    let s2 = this.sq;
    if (this.jumpT >= 0) s2 -= 0.12 * Math.abs(1 - 2 * this.jumpT);
    ctx.scale(1 + s2, 1 - s2);

    // blink while invincible
    if (this.invincible > 0 && !this.endPose && Math.floor(this.invincible * 14) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    OPTS.outline = outline;
    OPTS.phase = this.phase;
    drawCharacter(ctx, this.role, this.pose(), this.time, OPTS);
    ctx.restore();
  }
}

const OPTS = { outline: '#2A1E3B', phase: 0 };
