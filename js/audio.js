/*
 * audio.js — every sound in the game, made with the Web Audio API.
 *
 * There are no audio files: each sound is built from oscillators (beeps)
 * and white noise (splashes), shaped with volume envelopes and filters.
 *
 * Browsers block sound until the player taps/clicks once, so main.js calls
 * unlockAudio() on the first user gesture. Before that, sfx() does nothing.
 *
 * Usage:  sfx('bell')   startMusic()   stopMusic()   setMuted(true)
 */

let ctx = null;
let master = null;
let musicGain = null;
let noiseBuf = null;
let muted = false;
const MASTER_VOL = 0.55;

// Minimum time between two plays of the same sound (stops "machine-gun" spam).
const lastPlayed = Object.create(null);
const MIN_GAP = { bell: 0.6, horn: 0.5, cngHorn: 0.5, bark: 0.5, coin: 0.04, splash: 0.15, siren: 1 };

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = !!m;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime, 0.03);
}

/** Create / resume the AudioContext. Must be called from a user gesture. */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOL;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(master);
    noiseBuf = makeNoiseBuffer();
    // iOS Safari: playing a silent buffer inside the gesture "unlocks" output.
    const silent = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start(0);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function suspendAudio() {
  if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function makeNoiseBuffer() {
  const len = ctx.sampleRate; // 1 second of noise, reused by every noisy sound
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// ---------- building blocks ----------

/** One oscillator note with a quick attack and exponential fade. */
function tone(type, f0, f1, t0, dur, vol, dest = master, attack = 0.006) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
  return o;
}

/** A burst of filtered noise (splash, slurp, hi-hat...). */
function noise(t0, dur, vol, filterType, f0, f1, q = 1, dest = master) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

// ---------- the sound library ----------

const SOUNDS = {
  // "Ring ring!" — two metallic dings, like a rickshaw bell.
  bell(t) {
    for (let i = 0; i < 2; i++) {
      const s = t + i * 0.16;
      tone('sine', 2350, 2350, s, 0.35, 0.18);
      tone('sine', 3520, 3520, s, 0.22, 0.08);
      tone('triangle', 1760, 1760, s, 0.18, 0.05);
    }
  },
  // Bus horn: two detuned buzzy tones through a low-pass filter.
  horn(t) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    f.connect(master);
    tone('sawtooth', 311, 311, t, 0.45, 0.12, f, 0.02);
    tone('sawtooth', 392, 392, t, 0.45, 0.1, f, 0.02);
    tone('square', 155, 155, t, 0.45, 0.05, f, 0.02);
  },
  // CNG horn: higher, cheeky "beep-beep".
  cngHorn(t) {
    tone('square', 620, 620, t, 0.12, 0.08);
    tone('square', 620, 620, t + 0.16, 0.14, 0.08);
  },
  // VIP siren: rising/falling wail for ~1.5 s.
  siren(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    o.frequency.setValueAtTime(650, t);
    for (let i = 0; i < 3; i++) {
      o.frequency.linearRampToValueAtTime(1250, t + i * 0.5 + 0.25);
      o.frequency.linearRampToValueAtTime(650, t + i * 0.5 + 0.5);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.05);
    g.gain.setValueAtTime(0.08, t + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(f);
    f.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 1.7);
  },
  // Cartoon "boing" for jumps.
  jump(t) {
    tone('sine', 220, 620, t, 0.22, 0.16);
    tone('triangle', 440, 900, t, 0.12, 0.05);
  },
  land(t) {
    noise(t, 0.08, 0.08, 'lowpass', 500, 200);
  },
  coin(t) {
    tone('sine', 988, 988, t, 0.08, 0.12);
    tone('sine', 1319, 1319, t + 0.07, 0.18, 0.12);
  },
  // Cha slurp: a noise sweep through a band-pass filter.
  slurp(t) {
    noise(t, 0.35, 0.22, 'bandpass', 500, 2400, 6);
    tone('sine', 300, 700, t + 0.25, 0.12, 0.06);
  },
  yum(t) {
    tone('triangle', 523, 523, t, 0.1, 0.12);
    tone('triangle', 659, 659, t + 0.08, 0.1, 0.12);
    tone('triangle', 784, 784, t + 0.16, 0.2, 0.12);
  },
  whoosh(t) {
    noise(t, 0.4, 0.2, 'bandpass', 300, 3000, 2);
    tone('sine', 880, 1760, t + 0.1, 0.25, 0.06);
  },
  splash(t) {
    noise(t, 0.45, 0.3, 'lowpass', 2600, 400, 0.7);
    noise(t + 0.03, 0.2, 0.12, 'highpass', 3000, 3000, 0.5);
  },
  // Getting hit: "bonk".
  bonk(t) {
    tone('sine', 190, 55, t, 0.28, 0.32);
    tone('square', 90, 60, t, 0.08, 0.08);
    noise(t, 0.06, 0.12, 'lowpass', 1200, 400);
  },
  // Falling in a manhole: "plop".
  plop(t) {
    tone('sine', 700, 120, t, 0.18, 0.25);
    noise(t + 0.08, 0.3, 0.15, 'lowpass', 900, 200);
  },
  bark(t) {
    for (let i = 0; i < 2; i++) {
      const s = t + i * 0.18;
      tone('square', 420, 220, s, 0.09, 0.08);
      noise(s, 0.08, 0.14, 'bandpass', 900, 600, 3);
    }
  },
  // Boss calling: old-school phone trill.
  ring(t) {
    for (let i = 0; i < 8; i++) {
      tone('square', i % 2 ? 1300 : 1050, null, t + i * 0.06, 0.055, 0.045);
    }
    for (let i = 0; i < 8; i++) {
      tone('square', i % 2 ? 1300 : 1050, null, t + 0.7 + i * 0.06, 0.055, 0.045);
    }
  },
  leaflet(t) {
    noise(t, 0.25, 0.12, 'highpass', 2500, 5000, 1);
  },
  beep(t) {
    tone('square', 660, 660, t, 0.14, 0.09);
  },
  go(t) {
    tone('square', 990, 990, t, 0.3, 0.1);
    tone('triangle', 1320, 1320, t, 0.3, 0.06);
  },
  click(t) {
    tone('triangle', 900, 700, t, 0.05, 0.08);
  },
  // Win: a happy arpeggio.
  win(t) {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((n, i) => tone('triangle', n, n, t + i * 0.11, i === notes.length - 1 ? 0.6 : 0.16, 0.16));
    notes.forEach((n, i) => tone('square', n / 2, n / 2, t + i * 0.11, 0.12, 0.03));
  },
  // Lose: sad trombone "wah-wah-wah-waaah".
  lose(t) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    f.connect(master);
    const steps = [392, 370, 349, 330];
    steps.forEach((n, i) => {
      const dur = i === 3 ? 0.9 : 0.32;
      const o = tone('sawtooth', n, i === 3 ? n * 0.94 : n, t + i * 0.34, dur, 0.12, f, 0.04);
      if (i === 3) {
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 6;
        lg.gain.value = 8;
        lfo.connect(lg);
        lg.connect(o.frequency);
        lfo.start(t + i * 0.34);
        lfo.stop(t + i * 0.34 + dur);
      }
    });
  }
};

/** Play a named sound effect (ignored before unlock or while muted). */
export function sfx(name) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const fn = SOUNDS[name];
  if (!fn) return;
  const now = ctx.currentTime;
  const gap = MIN_GAP[name] || 0.03;
  if (lastPlayed[name] !== undefined && now - lastPlayed[name] < gap) return;
  lastPlayed[name] = now;
  try {
    fn(now + 0.005);
  } catch (e) {
    /* a failed sound must never break the game */
  }
}

// ---------- background beat ----------
// A tiny step sequencer: every 25 ms we schedule the notes that fall in the
// next 120 ms. Scheduling ahead on the audio clock keeps the beat steady even
// when the main thread is busy drawing.

const BPM = 108;
const STEP = 60 / BPM / 4; // 16th notes
const BASS = [131, 0, 0, 131, 0, 0, 165, 0, 110, 0, 0, 110, 0, 0, 147, 0];
const ROOTS = [1, 0.84, 0.75, 0.89]; // C, A, G-ish, B-flat-ish per bar
let musicTimer = null;
let nextTime = 0;
let step = 0;
let bar = 0;

function scheduleStep(s, t) {
  // kick on beats 1 and 3, a "dholak" tom on the off-beats
  if (s % 8 === 0) tone('sine', 140, 45, t, 0.18, 0.5, musicGain);
  if (s % 8 === 6 || s === 3) tone('triangle', 320, 180, t, 0.1, 0.14, musicGain);
  if (s % 2 === 0) noise(t, 0.03, s % 4 === 2 ? 0.09 : 0.04, 'highpass', 7000, 7000, 0.8, musicGain);
  const b = BASS[s];
  if (b) tone('triangle', b * ROOTS[bar % 4], null, t, STEP * 1.8, 0.16, musicGain);
  if (s === 12 && bar % 2 === 1) tone('sine', 784 * ROOTS[bar % 4], null, t, 0.12, 0.05, musicGain);
}

function musicTick() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.12) {
    scheduleStep(step, nextTime);
    nextTime += STEP;
    step = (step + 1) % 16;
    if (step === 0) bar++;
  }
}

export function startMusic() {
  if (!ctx || musicTimer) return;
  nextTime = ctx.currentTime + 0.05;
  step = 0;
  musicTimer = setInterval(musicTick, 25);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
