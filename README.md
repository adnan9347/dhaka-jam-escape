# Dhaka Jam Escape — ঢাকা জ্যাম এস্কেপ 🛺

A funny, colorful, mobile-first browser game set on a Dhaka road. You are a
**student** (class at 9!) or an **employee** (office at 9!). Run through the
morning traffic: dodge rickshaws, buses, CNGs, open manholes, waterlogged
puddles, a VIP motorcade, hawkers, stray dogs, the coaching bhai and your
boss's phone calls. Sip cha ☕, grab shingara 🥟, take alley shortcuts ⏰, and
reach school or the office before the clock hits **9:00 AM**.

- Fully bilingual: **বাংলা** (Anek Bangla font) and **English** (switch any time, even mid-game)
- Bright "Dhaka Morning" rickshaw-art look (light theme, WCAG AA text contrast)
- Random weather: sunny or rainy (more puddles, rain, wet roads)
- Endless mode 🔥 unlocks after your first win
- Share card image (1080×1350) with your result
- Plain HTML + CSS + vanilla JavaScript modules. No framework, no build step,
  no backend, no storage: refresh = fresh start
- All art is drawn in code; all sounds are synthesized with the Web Audio API

## Controls

| Action      | Touch                      | Keyboard        |
| ----------- | -------------------------- | --------------- |
| Lane up     | swipe up                   | ↑ or W          |
| Lane down   | swipe down                 | ↓ or S          |
| Jump        | tap anywhere on the road   | Space           |
| Pause       | ⏸ button                   | P or Esc        |

## Run it locally

ES modules don't load from `file://`, so double-clicking `index.html` won't
work. Serve the folder with any static server:

```bash
npx serve .
```

Then open the URL it prints (usually http://localhost:3000).

Alternatives: the **Live Server** extension in VS Code (right-click
`index.html` → "Open with Live Server"), or `python -m http.server 8000`.

Tip: open `http://localhost:3000/?debug` to get `window.__dje` in the browser
console (the game, the state and the UI) for poking around while you tweak.

## Deploy to Vercel (free)

1. Push this folder to a GitHub repository.
2. On [vercel.com](https://vercel.com) click **Add New → Project** and import the repo.
3. Framework preset: **Other**. Build command: *none*. Output directory: *leave
   empty* (the root). No environment variables.
4. Click **Deploy**. That's it: it's a static site.

On a phone, open the site and use **Add to Home Screen**: `manifest.json`
makes it open full-screen like an app.

## Project structure

```
index.html          all screens (splash, role, how-to, game + overlays)
manifest.json       "add to home screen" settings
icons/icon.svg      app icon
css/styles.css      rickshaw-art design system (light + dark tokens)
js/main.js          boots the app, screen flow, global in-memory state
js/ui.js            menus, HUD, overlays, Motion animations, mini canvases
js/i18n.js          Bangla / English text, number + clock formatting
js/theme.js         color palette shared with the canvas
js/audio.js         Web Audio sound effects, background beat, mute
js/share.js         share-card image + native share / download fallback
game/engine.js      game loop, rules, collisions, CONFIG (tuning numbers)
game/input.js       keyboard, swipe and tap handling
game/player.js      the two characters (art + movement state)
game/entities.js    obstacles, power-ups, spawn patterns
game/background.js  parallax city, road, streetlights, destination
game/effects.js     pooled particles, rain, floating text, shake, flash
```

## Tweak the difficulty

Every tunable number is in the `CONFIG` object at the top of
[`game/engine.js`](game/engine.js). Common tweaks:

| Want…                         | Change                                              |
| ----------------------------- | --------------------------------------------------- |
| More time to reach 9:00       | `story.realSeconds` (default 90) or `story.endMin`  |
| Shorter / longer trip         | `story.distanceM` (default 3000 m)                  |
| Faster or slower running      | `speed.base`, `speed.ramp`, `speed.storyMax`        |
| Arrive sooner (easier)        | raise `metersPerPx` (lower it to make the trip feel longer) |
| Fewer obstacles               | raise `spawn.gapMinPx` / `spawn.gapMaxPx`           |
| More cha / shingara           | raise `spawn.powerUpChance`                         |
| Softer hits                   | lower `hitPenaltyMin`, raise `invincibleSec`        |
| Longer cha boost              | `boostSec`, `speed.boostMult`                       |
| More or less rain             | `rainChance` (0 = never, 1 = always)                |
| Endless ramps up faster       | `speed.endlessRamp`, `endless.rampSec`              |

With the defaults, a near-perfect run arrives around 8:52–8:56, so it's tight
but winnable. Each hit costs a life **and** one in-game minute.

The spawner in `game/entities.js` always keeps at least one lane open from one
obstacle wave to the next, so the road is never an impossible wall (the VIP
motorcade blocks only one lane, after a 1.5 s siren warning).

## Edit or add funny messages

All text lives in [`js/i18n.js`](js/i18n.js) in two dictionaries, `bn` and `en`.

- Result headlines: `resStudentWin`, `resStudentLose`, `resEmployeeWin`, `resEmployeeLose`
- Random sub-lines (lists): `subStudentWin`, `subStudentLose`,
  `subEmployeeWin`, `subEmployeeLose`, `subAnyLose`, `subEndless`
- Floating in-game text: `ftCha`, `ftShingara`, `ftShortcut`, `ftCoaching`, `ftOuch`, …

To add a joke, add a string to the list in **both** `bn` and `en` (same
position in each list, so switching language mid-screen shows the same joke).
Strings can use `{placeholders}`, e.g. `shareText: 'I survived {km} km…'`.

## Notes

- Nothing is saved: language, role, nickname and the session best all
  live in memory. Refresh starts fresh.
- Sound starts after your first tap (browser autoplay rules). Use the speaker
  button to mute.
- Respects `prefers-reduced-motion`: less shake, fewer particles, gentler parallax.
- UI animations use [Motion](https://motion.dev) from the jsDelivr CDN; if it
  can't load, the UI falls back to the browser's built-in animations.
