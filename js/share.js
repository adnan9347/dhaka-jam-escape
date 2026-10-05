/*
 * share.js — makes a 1080×1350 "brag card" image and shares it.
 *
 * The card is painted on an off-screen canvas: rickshaw-art border, your
 * character in its win/lose pose, the result message, nickname, stats, and
 * the game's URL. Then:
 *   1. phones that can share files → native share sheet with the image
 *   2. browsers that can share text → share text + link
 *   3. otherwise → download the PNG and copy the text to the clipboard
 *
 * The image is prepared as soon as the result screen opens, because some
 * browsers (Safari) only allow sharing right inside the tap — no waiting.
 */

import { t, fmtNum, fmtClock, canvasFont, getLang } from './i18n.js';
import { drawCharacter } from '../game/player.js';

const W = 1080;
const H = 1350;
let prepared = null; // { key, blob, file, text }

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function flower(g, x, y, r, petal, center) {
  g.fillStyle = petal;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.45, r * 0.3, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = center;
  g.beginPath();
  g.arc(x, y, r * 0.35, 0, Math.PI * 2);
  g.fill();
}

function diamond(g, x, y, r, c) {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r * 0.7, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r * 0.7, y);
  g.closePath();
  g.fill();
}

function peacock(g, x, y, s, rot) {
  // a stylised peacock feather "eye" — classic rickshaw-art motif
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  g.strokeStyle = '#1FA67A';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 60);
  g.lineTo(0, -10);
  g.stroke();
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    g.moveTo(0, 50 - i * 9);
    g.lineTo(-20 + i, 34 - i * 9);
    g.moveTo(0, 50 - i * 9);
    g.lineTo(20 - i, 34 - i * 9);
    g.stroke();
  }
  g.fillStyle = '#00A6A6';
  g.beginPath();
  g.ellipse(0, -22, 20, 26, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#FFC72C';
  g.beginPath();
  g.ellipse(0, -20, 13, 17, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2D3A8C';
  g.beginPath();
  g.ellipse(0, -18, 7, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function wrapLines(g, text, maxW) {
  // Bangla & English both break on spaces.
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Big outlined heading text. Bangla is drawn clean (no outline) in
 * `bnFill`, a color with strong contrast on the card background.
 */
function outlinedText(g, text, x, y, fill, stroke, lw, bnFill) {
  if (getLang() === 'bn') {
    g.fillStyle = bnFill || fill;
    g.fillText(text, x, y);
    return;
  }
  g.lineJoin = 'round';
  g.lineWidth = lw;
  g.strokeStyle = stroke;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

/** Paint the share card and return the canvas. */
export function buildCard(result, opts) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const dark = opts.theme === 'dark';
  const O = dark ? '#000000' : '#2A1E3B';
  const text = dark ? '#FFF4E0' : '#2A1E3B';
  const sub = dark ? '#B9AFD6' : '#574A68';

  // background
  const bg = g.createLinearGradient(0, 0, 0, H);
  if (dark) {
    bg.addColorStop(0, '#0E0B1F');
    bg.addColorStop(0.55, '#1C1340');
    bg.addColorStop(1, '#0B1A2E');
  } else {
    bg.addColorStop(0, '#FFF4E0');
    bg.addColorStop(0.55, '#FFE3EC');
    bg.addColorStop(1, '#E3F4FF');
  }
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // rickshaw-art border: a band of flowers & diamonds
  const B = 54;
  g.fillStyle = '#E6397D';
  g.fillRect(0, 0, W, B);
  g.fillRect(0, H - B, W, B);
  g.fillStyle = '#00A6A6';
  g.fillRect(0, 0, B, H);
  g.fillRect(W - B, 0, B, H);
  const petals = ['#FFC72C', '#FFFFFF', '#1FA67A'];
  for (let x = B + 30, i = 0; x < W - B; x += 60, i++) {
    flower(g, x, B / 2, 18, petals[i % 3], '#F42A41');
    flower(g, x, H - B / 2, 18, petals[(i + 1) % 3], '#F42A41');
    diamond(g, x + 30, B / 2, 8, '#FFFFFF');
    diamond(g, x + 30, H - B / 2, 8, '#FFFFFF');
  }
  for (let y = B + 30, i = 0; y < H - B; y += 60, i++) {
    flower(g, B / 2, y, 16, petals[i % 3], '#E6397D');
    flower(g, W - B / 2, y, 16, petals[(i + 2) % 3], '#E6397D');
  }
  for (const [cx, cy] of [[B / 2, B / 2], [W - B / 2, B / 2], [B / 2, H - B / 2], [W - B / 2, H - B / 2]]) {
    g.fillStyle = '#FFC72C';
    g.beginPath();
    g.arc(cx, cy, 24, 0, Math.PI * 2);
    g.fill();
    flower(g, cx, cy, 18, '#E6397D', '#FFFFFF');
  }
  g.lineWidth = 8;
  g.strokeStyle = O;
  g.strokeRect(B, B, W - 2 * B, H - 2 * B);

  // corner peacock feathers
  peacock(g, 150, 230, 1.4, -0.5);
  peacock(g, W - 150, 230, 1.4, 0.5);

  // title
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = canvasFont(800, 76);
  outlinedText(g, t('appTitle'), W / 2, 150, '#FFC72C', O, 14, dark ? '#FFD54F' : '#B5135A');

  // character in its result pose, on a sticker-style disc
  g.fillStyle = result.win ? '#FFC72C' : '#A8DADC';
  g.beginPath();
  g.arc(W / 2, 440, 185, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = O;
  g.stroke();
  g.save();
  g.translate(W / 2 - 8, 565);
  g.scale(3.8, 3.8);
  drawCharacter(g, result.role, result.win ? 'win' : 'lose', 0.12, { outline: O, phase: 0 });
  g.restore();

  // main message
  g.font = canvasFont(800, 62);
  let y = 695;
  for (const line of wrapLines(g, opts.mainText, W - 200)) {
    outlinedText(g, line, W / 2, y, result.win ? (dark ? '#2EE59D' : '#08704D') : dark ? '#FF7AB0' : '#B5135A', dark ? '#000' : '#FFFFFF', 10);
    if (getLang() !== 'bn') {
      g.lineWidth = 3;
      g.strokeStyle = O;
      g.strokeText(line, W / 2, y);
    }
    y += 74;
  }

  if (opts.nickname) {
    g.font = canvasFont(700, 40);
    g.fillStyle = sub;
    g.fillText(t('shareBy', { name: opts.nickname }), W / 2, y + 4);
    y += 56;
  }

  // stats row: three sticker boxes
  const boxes = [
    [t('statDistance'), t('km', { n: fmtNum(result.distM / 1000, 2) })],
    result.mode === 'story'
      ? [result.win ? t('statArrival') : t('statTime'), result.win ? fmtClock(result.clock) : result.reason === 'time' ? t('timeUp') : t('outOfLives')]
      : [t('statDodged'), fmtNum(result.dodged)],
    [t('statScore'), fmtNum(result.score)]
  ];
  const bw = 290;
  const gap = 24;
  const bx0 = (W - (bw * 3 + gap * 2)) / 2;
  const by = Math.max(y + 10, 880);
  boxes.forEach(([label, value], i) => {
    const bx = bx0 + i * (bw + gap);
    rr(g, bx + 8, by + 8, bw, 150, 26);
    g.fillStyle = O;
    g.fill();
    rr(g, bx, by, bw, 150, 26);
    g.fillStyle = dark ? '#1E1736' : '#FFFFFF';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = O;
    g.stroke();
    g.font = canvasFont(600, 30, false);
    g.fillStyle = sub;
    g.fillText(label, bx + bw / 2, by + 44);
    g.font = canvasFont(800, value.length > 9 ? 40 : 52);
    g.fillStyle = text;
    g.fillText(value, bx + bw / 2, by + 102);
  });

  // call to action + URL
  g.font = canvasFont(800, 64);
  outlinedText(g, t('shareBeat') + ' 🛺', W / 2, Math.min(by + 230, H - B - 120), '#FFFFFF', '#E6397D', 14, dark ? '#FF7AB0' : '#B5135A');
  g.font = canvasFont(600, 34, false);
  g.fillStyle = text;
  g.fillText(location.origin.replace(/^https?:\/\//, ''), W / 2, H - B - 46);
  return c;
}

function shareTextFor(result) {
  return t('shareText', { km: fmtNum(result.distM / 1000, 2) });
}

/** Pre-render the card (call when the result screen opens / language changes). */
export function prepareShare(result, opts) {
  const key = getLang() + opts.theme + opts.mainText + (opts.nickname || '') + result.score;
  if (prepared && prepared.key === key) return;
  const canvas = buildCard(result, opts);
  const text = shareTextFor(result);
  prepared = { key, blob: null, file: null, text };
  const mine = prepared;
  canvas.toBlob((blob) => {
    if (!blob || prepared !== mine) return;
    mine.blob = blob;
    try {
      mine.file = new File([blob], 'dhaka-jam-escape.png', { type: 'image/png' });
    } catch (e) {
      mine.file = null; // very old Safari has no File constructor
    }
  }, 'image/png');
}

function download(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dhaka-jam-escape.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Share the prepared card. Returns 'shared' | 'cancelled' | 'copied' |
 * 'downloaded' | 'failed' so the UI can show the right toast.
 */
export async function shareResult(result, opts) {
  prepareShare(result, opts);
  const p = prepared;
  const url = location.origin;
  const text = p.text;
  try {
    if (p.file && navigator.canShare && navigator.canShare({ files: [p.file] })) {
      await navigator.share({ files: [p.file], text: text + ' ' + url, title: t('appTitle') });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ text, url, title: t('appTitle') });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
    // fall through to the download fallback
  }
  let blob = p.blob;
  if (!blob) {
    blob = await new Promise((res) => buildCard(result, opts).toBlob(res, 'image/png'));
  }
  if (!blob) return 'failed';
  download(blob);
  const copied = await copyText(text + ' ' + url);
  return copied ? 'copied' : 'downloaded';
}
