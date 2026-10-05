/*
 * main.js — boots the app and wires everything together.
 *
 *  - holds the global state (role, nickname, best score...) IN MEMORY only:
 *    no localStorage, no cookies. Refresh = fresh start.
 *  - decides which screen comes next (splash → role → how-to → game → result)
 *  - connects the game engine, the input handler, the UI and the sounds
 *  - unlocks audio on the first tap and auto-pauses when you switch apps
 */

import { detectLang, setLang, getLang, onLangChange, t } from './i18n.js';
import { setTheme, getTheme } from './theme.js';
import { unlockAudio, sfx, setMuted, isMuted, startMusic, stopMusic, suspendAudio, resumeAudio } from './audio.js';
import { createUI } from './ui.js';
import { shareResult, prepareShare } from './share.js';
import { Game } from '../game/engine.js';
import { Input } from '../game/input.js';

const state = {
  role: null,
  nickname: '',
  seenHowTo: false,
  endlessUnlocked: false,
  best: { story: 0, endless: 0 },
  mode: 'story',
  lastResult: null,
  howtoFrom: 'splash',
  audioReady: false
};

let game = null;
let ui = null;
let input = null;
let runToken = 0;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Wait for the fonts the canvas needs (with a timeout so slow networks don't block). */
function fontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const sample = 'ঢাকা Dhaka ৳১২৩ 123';
  const loads = [
    '800 40px "Baloo 2"',
    '700 40px "Baloo 2"',
    '800 40px "Anek Bangla"',
    '700 40px "Anek Bangla"',
    '500 16px "Anek Bangla"',
    '600 16px "Anek Bangla"',
    '600 16px "Poppins"'
  ].map((f) => document.fonts.load(f, sample).catch(() => null));
  const all = Promise.all(loads).then(() => document.fonts.ready);
  const timeout = new Promise((res) => setTimeout(res, 3000));
  return Promise.race([all, timeout]).catch(() => {});
}

function ensureAudio() {
  unlockAudio();
  if (!state.audioReady) {
    state.audioReady = true;
    // "a bus honks" on the very first tap on the splash screen
    if (ui && ui.screen === 'splash') setTimeout(() => sfx('horn'), 60);
  }
}

// ---------------------------------------------------------------------
//  Game flow
// ---------------------------------------------------------------------

function goHome() {
  stopRun();
  ui.showScreen('splash');
}

function goRole() {
  stopRun();
  ui.showScreen('role');
}

function openHowTo(from) {
  state.howtoFrom = from;
  ui.showScreen('howto', { from });
}

function stopRun() {
  runToken++;
  ui.cancelCountdown();
  ui.hidePause();
  ui.hideResult();
  ui.showBossCall(false);
  input.disable();
  stopMusic();
  if (game) {
    game.stopLoop();
    game.state = 'idle';
  }
}

async function startRun(mode) {
  if (!state.role) {
    ui.showScreen('role');
    return;
  }
  const my = ++runToken;
  state.mode = mode;
  ui.cancelCountdown();
  ui.hidePause();
  ui.hideResult();
  ui.showBossCall(false);
  stopMusic();
  ui.showScreen('game');
  game.setRole(state.role);
  game.resize();
  const { rain } = game.prepare(mode);
  ui.resetHud(mode, state.role);
  game.startLoop();
  input.enable();
  const ok = await ui.countdown({ rain, mode });
  if (!ok || my !== runToken) return;
  game.start();
  startMusic();
  if (document.hidden) pauseGame();
}

function pauseGame() {
  if (game && game.pause()) {
    stopMusic();
    ui.showPause();
  }
}

function resumeGame() {
  if (!game || game.state !== 'paused') return;
  ui.hidePause();
  game.resume();
  startMusic();
  document.getElementById('game-area').focus({ preventScroll: true });
}

function togglePause() {
  if (!game) return;
  if (game.state === 'playing') pauseGame();
  else if (game.state === 'paused') resumeGame();
}

function handleEnd(result) {
  const key = result.mode;
  const newBest = result.score > state.best[key];
  if (newBest) state.best[key] = result.score;
  let unlockedNow = false;
  if (result.win && result.mode === 'story' && !state.endlessUnlocked) {
    state.endlessUnlocked = true;
    unlockedNow = true;
  }
  state.lastResult = result;
  ui.showResult(result, {
    best: state.best[key],
    newBest: newBest && result.score > 0,
    showEndless: result.win && result.mode === 'story'
  });
  if (unlockedNow) setTimeout(() => ui.toast(t('endlessUnlocked')), 900);
  prepareShare(result, shareOpts());
}

function shareOpts() {
  return { theme: getTheme(), mainText: ui.resultMainText(), nickname: state.nickname };
}

async function doShare() {
  if (!state.lastResult) return;
  const res = await shareResult(state.lastResult, shareOpts());
  if (res === 'copied') ui.toast(t('shareCopied'));
  else if (res === 'downloaded') ui.toast(t('shareDownloaded'));
  else if (res === 'failed') ui.toast(t('shareFailed'));
}

// ---------------------------------------------------------------------
//  Boot
// ---------------------------------------------------------------------

async function boot() {
  setLang(detectLang());
  setTheme('light'); // light theme only (no dark mode)
  document.documentElement.classList.toggle('is-touch', window.matchMedia('(pointer: coarse)').matches);

  await fontsReady();

  const actions = {
    home: goHome,
    play: () => {
      ensureAudio();
      goRole();
    },
    openHowTo,
    selectRole: (r) => {
      state.role = r;
    },
    letsGo: () => {
      if (!state.role) return;
      sfx('click');
      if (!state.seenHowTo) openHowTo('flow');
      else startRun('story');
    },
    howtoBack: () => (state.howtoFrom === 'splash' ? goHome() : goRole()),
    howtoDone: () => {
      state.seenHowTo = true;
      if (state.howtoFrom === 'splash') goHome();
      else startRun('story');
    },
    pause: pauseGame,
    resume: resumeGame,
    restart: () => startRun(state.mode),
    changeRole: goRole,
    playAgain: () => startRun(state.lastResult ? state.lastResult.mode : 'story'),
    endless: () => startRun('endless'),
    share: doShare,
    toggleLang: () => {
      setLang(getLang() === 'bn' ? 'en' : 'bn');
      sfx('click');
    },
    toggleMute: () => {
      ensureAudio();
      setMuted(!isMuted());
      ui.syncControls();
      sfx('click');
    }
  };

  ui = createUI({ state, actions });

  const canvas = document.getElementById('game-canvas');
  game = new Game(canvas, {
    onHud: (h) => ui.updateHud(h),
    onLives: (n, d) => ui.setLives(n, d),
    onBossCall: (on) => ui.showBossCall(on),
    onEnding: () => stopMusic(),
    onEnd: handleEnd
  });
  game.setReduced(reduceMQ.matches);
  game.setNight(false, true); // the game is light-theme only
  reduceMQ.addEventListener && reduceMQ.addEventListener('change', (e) => game.setReduced(e.matches));

  input = new Input(document.getElementById('game-area'), {
    up: () => game.laneUp(),
    down: () => game.laneDown(),
    jump: () => game.jump(),
    pause: togglePause,
    isActive: () => game.isPlaying()
  });

  onLangChange(() => {
    ui.applyI18n();
    if (state.lastResult && ui.screen === 'game') prepareShare(state.lastResult, shareOpts());
  });

  // Audio may only start after a user gesture (autoplay rules, iOS Safari).
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach((ev) =>
    window.addEventListener(ev, ensureAudio, { passive: true, capture: true })
  );

  // Auto-pause when the tab / app goes to the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseGame();
      suspendAudio();
    } else {
      resumeAudio();
    }
  });
  window.addEventListener('blur', pauseGame);

  // Keep the canvas sharp and correctly sized on resize / rotation.
  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (ui.screen === 'game') game.resize();
    });
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 150));

  ui.applyI18n();
  ui.showScreen('splash');

  // Open the page with ?debug to poke at the game from the browser console.
  if (location.search.includes('debug')) window.__dje = { game, state, ui, startRun };
}

boot();
