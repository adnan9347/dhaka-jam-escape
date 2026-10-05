/*
 * i18n.js — Bangla + English text for the whole game.
 *
 * Every word the player sees (buttons, HUD, canvas text, result jokes,
 * share card, aria-labels) lives in the two dictionaries below: `bn` and `en`.
 * Other files never hard-code text; they call t('someKey').
 *
 * Want to add a funny line? Find a list like `subStudentLose` and add a new
 * string to BOTH the bn and en lists (keep them in the same order).
 *
 * This file also formats numbers (Bangla digits ১২৩ vs 123) and the clock
 * ("সকাল ৮:৪২" vs "8:42 AM").
 */

const dict = {
  bn: {
    appTitle: 'ঢাকা জ্যাম এস্কেপ',
    tagline: '৯টার আগে পৌঁছাতে পারবেন তো?',
    play: 'চলেন খেলি!',
    howToLink: 'কীভাবে খেলবেন?',
    langAria: 'ভাষা বদলান (বাংলা / ইংরেজি)',
    mute: 'সাউন্ড বন্ধ করুন',
    unmute: 'সাউন্ড চালু করুন',
    back: 'পেছনে',
    homeAria: 'ঢাকা জ্যাম এস্কেপ — হোম',
    settings: 'সেটিংস',

    roleTitle: 'আপনি কে?',
    roleHint: 'একজনকে বেছে নিন, তারপর দৌড়!',
    student: 'স্টুডেন্ট',
    studentSub: 'ক্লাস ৯টায়!',
    employee: 'চাকরিজীবী',
    employeeSub: 'অফিস ৯টায়!',
    nickLabel: 'আপনার ডাকনাম (না দিলেও চলবে)',
    nickPlaceholder: 'যেমন: রনি',
    letsGo: 'চলো যাই!',

    howTitle: 'কীভাবে খেলবেন',
    how1Title: 'লেন বদলান',
    how1Touch: 'উপরে বা নিচে সোয়াইপ করুন — রিকশা, বাস, সিএনজি সব কাটিয়ে যান।',
    how1Keys: '↑ / ↓ অথবা W / S চাপুন — রিকশা, বাস, সিএনজি সব কাটিয়ে যান।',
    how2Title: 'লাফ দিন!',
    how2Touch: 'স্ক্রিনে ট্যাপ করে লাফ দিন — খোলা ম্যানহোল আর জমা পানি পার হন।',
    how2Keys: 'স্পেস চেপে লাফ দিন — খোলা ম্যানহোল আর জমা পানি পার হন।',
    how3Title: '৯টার আগে পৌঁছান',
    how3Text: 'চা ☕ খেলে স্পিড, সিঙ্গারা 🥟 খেলে জান, গলি ⏰ দিলে সময় বাঁচে। ঘড়িতে ৯টা বাজার আগেই পৌঁছাতে হবে!',
    skip: 'বাদ দিন',
    next: 'পরেরটা',
    prev: 'আগেরটা',
    start: 'শুরু করি!',
    gotIt: 'বুঝছি!',
    cardOf: 'কার্ড {n} / {total}',

    cdGo: 'চলো!',
    weatherRain: 'আজকে বৃষ্টি! 🌧️',
    weatherSun: 'আজকে রোদ ঝলমলে! ☀️',
    rainTip: 'রাস্তায় পানি জমবে, সাবধান!',
    sunTip: 'জ্যাম কিন্তু রোদেও কম না!',
    endlessIntro: 'এন্ডলেস মোড — যতদূর পারেন!',

    hudTime: 'সময়',
    hudScore: 'স্কোর',
    hudLivesAria: 'জান বাকি: {n}',
    hudProgress: 'যাত্রার অগ্রগতি',
    hudDistance: 'দূরত্ব',
    hudPowerAria: 'পাওয়ার-আপ চলছে',
    pauseBtn: 'বিরতি',
    meters: '{n} মি',
    km: '{n} কিমি',

    pausedTitle: 'চা-বিরতি ☕',
    pausedSub: 'জ্যাম কিন্তু আপনার জন্য অপেক্ষা করছে।',
    resume: 'আবার চলেন',
    restart: 'নতুন করে শুরু',
    changeRole: 'চরিত্র বদলান',

    bossCalling: 'বস ফোন দিছে!',
    bossSub: 'ধরবেন, না দৌড়াবেন? 📞',
    bossLabel: 'বস',

    ftCha: 'চা খাইয়া চাঙ্গা!',
    ftShingara: 'সিঙ্গারা!',
    ftShingaraFull: 'সিঙ্গারা! পেট ভরা 😋',
    ftShortcut: 'গলি দিয়ে শর্টকাট!',
    ftCoaching: 'ভর্তি চলছে!',
    ftOuch: ['উফ!', 'ধুর!', 'আরে মামা!', 'গেলো রে!'],
    ftPlop: 'ধপাস!',
    ftSplash: 'ছপাৎ!',
    ftWoof: 'ঘেউ!',
    ftPlusMin: '+{n} মিনিট',
    ftMinusMin: '−{n} মিনিট',
    destSchool: 'স্কুল',
    destOffice: 'অফিস',

    resStudentWin: 'আজকে অ্যাটেনডেন্স ডান! ✅',
    resStudentLose: 'আজকেও লেট? 😩',
    resEmployeeWin: 'আজকের মতো বেঁচে গেলেন! 😮‍💨',
    resEmployeeLose: 'বসের ঝাড়ি খাইলেন নাকি? 😅',
    resEndless: 'আজকের দৌড় শেষ! 🏁',

    subStudentWin: [
      'ফার্স্ট বেঞ্চ আজকে আপনার!',
      'আম্মু শুনলে খুশি হবে',
      'স্যার নাম ডাকার আগেই হাজির!',
      'টিফিনে আজকে ডাবল সিঙ্গারা খাবেন',
      'ক্লাস ক্যাপ্টেনও আজকে অবাক',
      'রিকশা, বাস, ম্যানহোল — সব পার!'
    ],
    subStudentLose: [
      'স্যার আজকে আবার নাম কেটে দিবে',
      'প্রক্সি দেওয়ার বন্ধুও আজকে আসে নাই',
      'গেটে দারোয়ান মামা দাঁড়ায়া আছে...',
      'আম্মুর কাছে ফোন যাবে, রেডি থাকেন',
      'কাল থেকে ৭টায় বের হবেন, প্রমিস?'
    ],
    subEmployeeWin: [
      'বস এখনও আসে নাই, শান্তি!',
      'চা খেয়ে কাজ শুরু করেন',
      'হাজিরা মেশিনে আঙুল দিলেন একদম টাইমে!',
      'আজকে লাঞ্চে বিরিয়ানি আপনার হক',
      'এইচআর আজকে আপনাকে ধরতে পারবে না',
      'মিটিংয়ের আগে এক কাপ চা হয়ে যাক'
    ],
    subEmployeeLose: [
      'আজকে লেট স্লিপ কনফার্ম',
      'এইচআর এর মেইল আসতেছে...',
      'বস: "আপনার বাসা কি চিটাগাং?"',
      '"জ্যামে আটকা ছিলাম" — এই অজুহাত আর চলবে না',
      'এই বছরের ইনক্রিমেন্টের স্বপ্ন শেষ'
    ],
    subAnyLose: [
      'রিকশাওয়ালা মামা আপনাকে মিস করবে',
      'ঢাকার জ্যাম: ১, আপনি: ০',
      'ম্যাপে তো দেখাইছিল ১৫ মিনিট...'
    ],
    subEndless: [
      'আরেকটু হলেই রেকর্ড!',
      'পা দুইটা একটু রেস্ট চায়',
      'ঢাকা আপনাকে থামাতে পারে নাই... প্রায়',
      'রিকশাওয়ালা মামারাও আপনাকে চিনে ফেলছে',
      'এইবার একটু চা খেয়ে আসেন'
    ],

    statDistance: 'দূরত্ব',
    statArrival: 'পৌঁছানোর সময়',
    statTime: 'সময়',
    timeUp: 'সময় শেষ!',
    outOfLives: 'জান শেষ!',
    statDodged: 'কাটিয়ে গেছেন',
    statCha: 'চা খেয়েছেন',
    statScore: 'স্কোর',
    statBest: 'এই সেশনের সেরা',
    newBest: 'নতুন রেকর্ড!',
    cup: '{n} কাপ',
    cups: '{n} কাপ',
    playAgain: 'আবার খেলি',
    share: 'শেয়ার করুন',
    endless: 'এন্ডলেস মোড 🔥',
    endlessUnlocked: 'এন্ডলেস মোড আনলক হলো! 🔥',
    resultDialog: 'খেলার ফলাফল',
    pauseDialog: 'খেলা থামানো আছে',

    shareText: 'আমি ঢাকার জ্যামে {km} কিমি টিকে ছিলাম! আপনি পারবেন? 🛺',
    shareBeat: 'আমাকে হারাতে পারবেন?',
    shareBy: '— {name}',
    shareCopied: 'ছবি ডাউনলোড হলো, লেখা কপি হয়েছে!',
    shareDownloaded: 'ছবি ডাউনলোড হলো!',
    shareFailed: 'শেয়ার করা গেল না 😕',
    gameAreaAria: 'খেলার মাঠ: সোয়াইপ করে লেন বদলান, ট্যাপ করে লাফ দিন'
  },

  en: {
    appTitle: 'Dhaka Jam Escape',
    tagline: 'Can you make it before 9 AM?',
    play: 'Play!',
    howToLink: 'How to play',
    langAria: 'Switch language (Bangla / English)',
    mute: 'Mute sound',
    unmute: 'Unmute sound',
    back: 'Back',
    homeAria: 'Dhaka Jam Escape — home',
    settings: 'Settings',

    roleTitle: 'Who are you?',
    roleHint: 'Pick one, then run!',
    student: 'Student',
    studentSub: 'Class starts at 9!',
    employee: 'Employee',
    employeeSub: 'Office at 9!',
    nickLabel: 'Your nickname (optional)',
    nickPlaceholder: 'e.g. Rony',
    letsGo: "Let's go!",

    howTitle: 'How to play',
    how1Title: 'Switch lanes',
    how1Touch: 'Swipe up or down to dodge rickshaws, buses and CNGs.',
    how1Keys: 'Press ↑ / ↓ or W / S to dodge rickshaws, buses and CNGs.',
    how2Title: 'Jump!',
    how2Touch: 'Tap the screen to jump over open manholes and puddles.',
    how2Keys: 'Press Space to jump over open manholes and puddles.',
    how3Title: 'Beat the clock',
    how3Text: 'Cha ☕ = speed, shingara 🥟 = extra life, alley shortcut ⏰ = time back. Arrive before the clock hits 9:00!',
    skip: 'Skip',
    next: 'Next',
    prev: 'Previous',
    start: 'Start!',
    gotIt: 'Got it!',
    cardOf: 'Card {n} of {total}',

    cdGo: 'Go!',
    weatherRain: "It's raining! 🌧️",
    weatherSun: 'Bright and sunny! ☀️',
    rainTip: 'Watch out for waterlogged roads!',
    sunTip: 'Sunshine or not, the jam is real!',
    endlessIntro: 'Endless mode — go as far as you can!',

    hudTime: 'Time',
    hudScore: 'Score',
    hudLivesAria: 'Lives left: {n}',
    hudProgress: 'Trip progress',
    hudDistance: 'Distance',
    hudPowerAria: 'Power-up active',
    pauseBtn: 'Pause',
    meters: '{n} m',
    km: '{n} km',

    pausedTitle: 'Tea break ☕',
    pausedSub: 'The jam is waiting for you.',
    resume: 'Resume',
    restart: 'Restart',
    changeRole: 'Change role',

    bossCalling: 'Boss is calling!',
    bossSub: 'Pick up or keep running? 📞',
    bossLabel: 'BOSS',

    ftCha: 'Tea power!',
    ftShingara: 'Shingara!',
    ftShingaraFull: 'Shingara! So full 😋',
    ftShortcut: 'Alley shortcut!',
    ftCoaching: 'Admissions open!',
    ftOuch: ['Ouch!', 'Oops!', 'Watch it!', 'Argh!'],
    ftPlop: 'Plop!',
    ftSplash: 'Splash!',
    ftWoof: 'Woof!',
    ftPlusMin: '+{n} min',
    ftMinusMin: '−{n} min',
    destSchool: 'SCHOOL',
    destOffice: 'OFFICE',

    resStudentWin: 'Attendance done today! ✅',
    resStudentLose: 'Late again today? 😩',
    resEmployeeWin: 'Survived another day! 😮‍💨',
    resEmployeeLose: 'Did the boss yell at you? 😅',
    resEndless: "That's a wrap! 🏁",

    subStudentWin: [
      'The first bench is yours today!',
      "Mom's gonna be so proud",
      'Present before roll call even started!',
      'Double shingara at tiffin today',
      'Even the class captain is shocked',
      'Rickshaws, buses, manholes — all cleared!'
    ],
    subStudentLose: [
      "Sir's crossing your name off again",
      "Even your proxy buddy didn't show up",
      'The gate guard uncle is waiting...',
      "A call to Mom is coming. Brace yourself",
      'Leaving at 7 from tomorrow, promise?'
    ],
    subEmployeeWin: [
      "Boss isn't in yet. Peace!",
      'Grab a cha and get to work',
      'Thumb on the attendance scanner, right on time!',
      'You deserve biryani for lunch today',
      "HR's got nothing on you today",
      'Time for a cuppa before the meeting'
    ],
    subEmployeeLose: [
      'Late slip confirmed for today',
      'An email from HR is incoming...',
      'Boss: "Do you commute from Chittagong?"',
      '"Stuck in traffic" won\'t work this time',
      "There goes this year's increment"
    ],
    subAnyLose: [
      'The rickshaw mama will miss you',
      'Dhaka traffic: 1, You: 0',
      'The map did say 15 minutes...'
    ],
    subEndless: [
      'So close to a record!',
      'Your legs need a little break',
      "Dhaka couldn't stop you... almost",
      'Even the rickshaw mamas know your name now',
      'Go grab a cha, you earned it'
    ],

    statDistance: 'Distance',
    statArrival: 'Arrived at',
    statTime: 'Time',
    timeUp: "Time's up!",
    outOfLives: 'Out of lives!',
    statDodged: 'Dodged',
    statCha: 'Cha sipped',
    statScore: 'Score',
    statBest: 'Best this session',
    newBest: 'New best!',
    cup: '{n} cup',
    cups: '{n} cups',
    playAgain: 'Play again',
    share: 'Share',
    endless: 'Endless mode 🔥',
    endlessUnlocked: 'Endless mode unlocked! 🔥',
    resultDialog: 'Game result',
    pauseDialog: 'Game paused',

    shareText: 'I survived {km} km of Dhaka traffic! Can you beat me? 🛺',
    shareBeat: 'Can you beat me?',
    shareBy: '— {name}',
    shareCopied: 'Image downloaded & text copied!',
    shareDownloaded: 'Image downloaded!',
    shareFailed: "Couldn't share 😕",
    gameAreaAria: 'Game area: swipe to change lanes, tap to jump'
  }
};

let lang = 'en';
const listeners = new Set();

/** Bangla if the browser says "bn...", otherwise English. */
export function detectLang() {
  const n = (navigator.language || '').toLowerCase();
  return n.startsWith('bn') ? 'bn' : 'en';
}

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (next !== 'bn' && next !== 'en') return;
  const changed = next !== lang;
  lang = next;
  document.documentElement.lang = next;
  if (changed) listeners.forEach((fn) => fn(next));
}

export function onLangChange(fn) {
  listeners.add(fn);
}

/** Look up a string; {placeholders} are filled from `vars`. */
export function t(key, vars) {
  let s = dict[lang][key];
  if (s === undefined) s = dict.en[key];
  if (s === undefined) return key;
  if (Array.isArray(s)) s = s[0];
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  return s;
}

/** How many entries a list key has (same count in both languages). */
export function listLength(key) {
  const arr = dict.en[key];
  return Array.isArray(arr) ? arr.length : 0;
}

/** Return entry #i of a list key in the current language. */
export function tAt(key, i) {
  const arr = dict[lang][key] || dict.en[key];
  return arr[i % arr.length];
}

/** Random entry of a list key, in the current language. */
export function pick(key) {
  const arr = dict[lang][key] || dict.en[key];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- numbers ----------

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const fmtCache = new Map();

function formatter(decimals, minInt) {
  const key = lang + decimals + '-' + minInt;
  let f = fmtCache.get(key);
  if (!f) {
    const locale = lang === 'bn' ? 'bn-BD-u-nu-beng' : 'en-IN';
    f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      minimumIntegerDigits: minInt || 1
    });
    fmtCache.set(key, f);
  }
  return f;
}

/** Format a number in the current language (Bangla digits in bn mode). */
export function fmtNum(n, decimals = 0, minInt = 1) {
  let s = formatter(decimals, minInt).format(n);
  // Some older browsers ignore the "beng" numbering system — patch digits by hand.
  if (lang === 'bn') s = s.replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
  return s;
}

/** Clock text from minutes-after-midnight, e.g. 522 -> "সকাল ৮:৪২" / "8:42 AM". */
export function fmtClock(totalMinutes) {
  const m = Math.max(0, Math.floor(totalMinutes));
  const h24 = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  if (lang === 'bn') {
    let period = 'রাত';
    if (h24 >= 4 && h24 < 12) period = 'সকাল';
    else if (h24 >= 12 && h24 < 15) period = 'দুপুর';
    else if (h24 >= 15 && h24 < 18) period = 'বিকাল';
    else if (h24 >= 18 && h24 < 20) period = 'সন্ধ্যা';
    return period + ' ' + fmtNum(h12) + ':' + fmtNum(mm, 0, 2);
  }
  return h12 + ':' + String(mm).padStart(2, '0') + (h24 < 12 ? ' AM' : ' PM');
}

/** Canvas font string that matches the current language's display/body font. */
export function canvasFont(weight, size, display = true) {
  if (lang === 'bn') {
    return display
      ? `${weight} ${size}px "Anek Bangla", "Baloo 2", sans-serif`
      : `${weight} ${size}px "Anek Bangla", "Poppins", sans-serif`;
  }
  return display
    ? `${weight} ${size}px "Baloo 2", "Anek Bangla", sans-serif`
    : `${weight} ${size}px "Poppins", "Anek Bangla", sans-serif`;
}
