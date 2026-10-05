/*
 * input.js — turns keys, swipes and taps into game actions.
 *
 *   Keyboard:  ↑ / W  = lane up      ↓ / S  = lane down
 *              Space  = jump         P / Esc = pause
 *   Touch:     swipe up/down (≥ 30 px) = change lane
 *              quick tap anywhere on the road = jump
 *
 * Taps on HUD buttons (pause etc.) are ignored so they don't make you jump.
 * Every pointer gesture is tracked separately, so quick successive swipes
 * (even with two thumbs) all register.
 */

const SWIPE_MIN = 30; // px of vertical travel that counts as a swipe
const TAP_MAX_MOVE = 14; // px — move more than this and it's not a tap
const TAP_MAX_MS = 320;

export class Input {
  /**
   * @param {HTMLElement} area  element that receives touches (the game area)
   * @param {object} h          handlers: up, down, jump, pause, isActive
   */
  constructor(area, h) {
    this.area = area;
    this.h = h;
    this.enabled = false;
    this.gestures = new Map(); // pointerId → gesture info

    this._onKey = this._onKey.bind(this);
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onCancel = this._onCancel.bind(this);

    window.addEventListener('keydown', this._onKey);
    area.addEventListener('pointerdown', this._onDown);
    area.addEventListener('pointermove', this._onMove);
    area.addEventListener('pointerup', this._onUp);
    area.addEventListener('pointercancel', this._onCancel);
    // stop iOS from treating a long press as text selection / callout
    area.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    this.gestures.clear();
  }

  _onKey(e) {
    if (!this.enabled) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key;
    const active = this.h.isActive();

    if (k === 'p' || k === 'P' || k === 'Escape') {
      e.preventDefault();
      this.h.pause();
      return;
    }
    if (!active) return; // paused / overlay open: let buttons handle keys
    if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      e.preventDefault();
      if (!e.repeat) this.h.up();
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      e.preventDefault();
      if (!e.repeat) this.h.down();
    } else if (k === ' ' || k === 'Spacebar') {
      e.preventDefault(); // no page scroll, no "click" on a focused button
      if (!e.repeat) this.h.jump();
    }
  }

  _isUiTarget(e) {
    const t = e.target;
    return !!(t && t.closest && t.closest('button, a, input, [data-no-game-input]'));
  }

  _onDown(e) {
    if (!this.enabled || this._isUiTarget(e)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.gestures.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      t: performance.now(),
      swiped: false,
      lastDir: 0
    });
    try {
      this.area.setPointerCapture(e.pointerId);
    } catch (err) {
      /* not critical */
    }
  }

  _onMove(e) {
    const g = this.gestures.get(e.pointerId);
    if (!g || !this.h.isActive()) return;
    const dy = e.clientY - g.y;
    const dx = e.clientX - g.x;
    if (Math.abs(dy) >= SWIPE_MIN && Math.abs(dy) > Math.abs(dx) * 0.8) {
      const dir = dy < 0 ? -1 : 1;
      // One lane per swipe; reversing direction in the same gesture counts again.
      if (!g.swiped || dir !== g.lastDir) {
        if (dir < 0) this.h.up();
        else this.h.down();
        g.swiped = true;
        g.lastDir = dir;
      }
      // re-anchor so a reversal needs another full 30 px
      g.x = e.clientX;
      g.y = e.clientY;
    }
  }

  _onUp(e) {
    const g = this.gestures.get(e.pointerId);
    if (!g) return;
    this.gestures.delete(e.pointerId);
    if (!this.h.isActive() || g.swiped) return;
    const moved = Math.hypot(e.clientX - g.sx, e.clientY - g.sy);
    if (moved <= TAP_MAX_MOVE && performance.now() - g.t <= TAP_MAX_MS) this.h.jump();
  }

  _onCancel(e) {
    this.gestures.delete(e.pointerId);
  }
}
