/*
 * theme.js — Light ("Dhaka Morning") / Dark ("Dhaka Night") theme.
 *
 * The HTML/CSS colors live in css/styles.css as CSS variables.
 * The canvas can't read CSS variables cheaply every frame, so the game scene
 * colors are mirrored here in PALETTES. The engine fades smoothly between the
 * two palettes when you toggle the theme (sky, buildings, lights).
 *
 * The theme is kept in memory only — refreshing the page goes back to light.
 */

export const PALETTES = {
  light: {
    name: 'light',
    outline: '#2A1E3B',
    skyTop: '#FFD7A8',
    skyBottom: '#FFF1D6',
    haze: 'rgba(255, 236, 205, 0.55)',
    sun: '#FFC72C',
    cloud: '#FFFFFF',
    far: ['#F7B2C4', '#A8DADC', '#FFD6A5', '#E9C6F0'],
    farWindow: 'rgba(42, 30, 59, 0.12)',
    mid: ['#F29BB5', '#8CC7CB', '#F7C08A', '#C9B6E4', '#9ED8B5'],
    midWindow: '#FFF8EC',
    midWindowFrame: 'rgba(42, 30, 59, 0.35)',
    sign: ['#E6397D', '#00A6A6', '#FFC72C', '#1FA67A', '#F42A41'],
    road: '#5A5463',
    roadDark: '#4C4655',
    laneDash: '#FFC72C',
    curb: '#D8CFDF',
    curbDark: '#9F95A8',
    footpath: '#C7BCC8',
    footpathTile: '#B5A9B7',
    ground: '#8F8699',
    groundDark: '#7A7184',
    wire: '#2A1E3B',
    pole: '#6B5E7B',
    text: '#2A1E3B'
  },
  dark: {
    name: 'dark',
    outline: '#000000',
    skyTop: '#0E0B1F',
    skyBottom: '#2A1B4D',
    haze: 'rgba(60, 35, 110, 0.45)',
    sun: '#FFD54F',
    cloud: '#3A2C66',
    far: ['#1E1838', '#251D45', '#1A1530', '#2A2050'],
    farWindow: '#FFD54F',
    mid: ['#2B2250', '#342A5E', '#231C40', '#3A2C5C', '#2A2A55'],
    midWindow: '#FFD54F',
    midWindowFrame: 'rgba(0, 0, 0, 0.6)',
    sign: ['#FF4F96', '#2EE6E6', '#FFD54F', '#2EE59D', '#FF4D5E'],
    road: '#2B2635',
    roadDark: '#221E2B',
    laneDash: '#C9A23A',
    curb: '#4A4258',
    curbDark: '#2E2838',
    footpath: '#3A3348',
    footpathTile: '#332D40',
    ground: '#221D2C',
    groundDark: '#1A1622',
    wire: '#000000',
    pole: '#4A4060',
    text: '#FFF4E0'
  }
};

const META_COLORS = { light: '#FFF4E0', dark: '#0E0B1F' };

let theme = 'light';
const listeners = new Set();

export function getTheme() {
  return theme;
}

export function onThemeChange(fn) {
  listeners.add(fn);
}

/** Apply a theme to <html>, cross-fading the UI for ~400 ms. */
export function setTheme(next, animate = true) {
  if (next !== 'light' && next !== 'dark') return;
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-anim');
    clearTimeout(setTheme._timer);
    setTheme._timer = setTimeout(() => root.classList.remove('theme-anim'), 450);
  }
  theme = next;
  root.setAttribute('data-theme', next);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', META_COLORS[next]);
  listeners.forEach((fn) => fn(next));
}

export function toggleTheme() {
  setTheme(theme === 'light' ? 'dark' : 'light');
}

// ---------- small color helpers used by the canvas ----------

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const rgbCache = new Map();
function rgbOf(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    v = hexToRgb(hex);
    rgbCache.set(hex, v);
  }
  return v;
}

/** Mix two hex colors (t=0 → a, t=1 → b) and return an rgb() string. */
export function mixColor(a, b, t) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * t);
  const g = Math.round(A[1] + (B[1] - A[1]) * t);
  const bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
