# Grand Theft Portfolio — guide

## Run
`npm install` then `npm run dev` (Node 18+). Fonts load from Google Fonts (needs internet; falls back to Impact offline).

## Controls
W A S D drive/walk · SHIFT run · SPACE brake (car) / jump (on foot) · F get in/out of the car · E read a chapter
`,` mute music · `.` next station/song · **Q = island map** (click it to drop a waypoint) · **TAB = cheat code list**

## Missions (edit in `src/data.js`)
Chapters unlock in order. Goals can be combined: `mode` (car/foot), `kmh`, `orbs`, `secs` (countdown; running out resets the orbs).
1 About – drive to the ring · 2 Skills – on foot · 3 Experience – 110 km/h · 4 Projects – 3 orbs in 60 s ·
5 Achievements – NEON GAUNTLET: 100 km/h + 4 orbs in 50 s · 6 Contact – FINAL BOSS RUN: 8 orbs across the whole island (use bridges), 130 km/h, 4.5 min.
Finishing mission 6 shows MISSION PASSED, then the Contact panel opens.

## Playing on a phone / tablet (new)
Touch controls switch on automatically on touch screens (add `?touch=1` to the address to test them on a PC, `?touch=0` to turn them off).
* **Left thumb: floating joystick** (appears where you touch). On foot it moves you relative to the camera; push to the edge to **run**. In the car: left/right steers, up = gas, down = brake / reverse.
* **Right thumb: drag anywhere on the right side to look around.** Buttons: **FIRE** (hold; PUNCH when unarmed), **JUMP** (BRAKE in the car), **CAR** (get in / out), **USE** (open chapter panels), **AIM** (toggle), the weapon button (tap = next weapon, shows ammo), **↻** reload.
* **Top right:** 🗺 island map · ⌨ cheat list (**tap a cheat to run it**) · ♪ music · ⛶ fullscreen (also locks landscape on Android).
* Portrait works but shows a "turn your phone sideways" hint. Landscape is the comfortable way to play.
* **Light graphics mode** is automatic on phones: lower render resolution, smaller shadow map, fewer cars / people / raindrops, no anti-aliasing buffer. Force it with `?low=1` or turn it off with `?low=0`.
* Mobile page setup: no zoom / pull-to-refresh / text selection, notch-safe layout, fullscreen-ready.
* **Try it on your phone:** `npm run dev:phone`, then open the "Network" address it prints (same Wi-Fi) on the phone. For everyone else, `npm run build` and upload `dist/` to Vercel / Netlify.

## Controls (keyboard + mouse, or a gamepad)
| | Keyboard / mouse | Gamepad (Xbox layout) |
|---|---|---|
| Move / drive | W A S D (arrows) - on foot you move relative to the camera | left stick, RT gas / LT brake in the car |
| Look around | **mouse** (click the game once to capture it, Esc releases) | right stick |
| Fire | **left click** (hold for SMG) | RT on foot, B in the car |
| Aim (zoom, over-the-shoulder) | **right click** hold | LT |
| Weapons | **1** fists · **2** pistol · **3** SMG · **4** shotgun · **5** rocket launcher · mouse wheel · **R** reload | LB / RB |
| Run / jump / handbrake | Shift / Space / Space | L3 / A / A |
| Car in / out | F | X |
| Chapters, close panels | E | Y |
| Island map | Q | Back |
| Cheat list | TAB | Start |
In the car the camera swings back behind you a moment after you stop moving the mouse. You can shoot from the car (drive-by) as well.

## The police case (new)
* **Hurt more than 6 people** (run them over, shoot them, punch them, blast them) and a **case opens**: you get a wanted star, the HUD shows the case and **police cars come for you**.
  A warning appears from the 3rd person; the counter forgets 1 person every 40 s.
* The police drive the city roads (they pick the junction that gets closest to you) and chase you across the island outside the city. They ram you if you drive fast and **arrest you if you stop** next to them.
* **Close the case** one of two ways: **get away** (stay far from every cop for 12 s, bar "LOSE THE COPS") or **get busted** (cops reach you while you are stopped or on foot for ~2 s: $500 fine, back to the start).
* **While a case is open the portfolio will not open.** Standing in a chapter ring only says **"CLOSE THE CASE FIRST"**.
* Shooting a police car opens a case too; destroying 2 police cars raises your stars (max 3 stars = 4 cars). Destroyed cars burn out and a fresh one arrives after ~9 s.
* Cheats for testing: **BADBOY** opens a case, **PARDON** closes it, **GUNSMITH** gives infinite ammo.

## Weapons
Pistol (12 rounds), SMG (30, automatic), shotgun (6 rounds, 8 pellets), rocket launcher (1 rocket, explosion kills people and damages police cars nearby). Bullets stop at buildings. Every pedestrian you hit counts toward the case. Fists punch people in front of you.
Weapon models appear in the hero's raised hand; if a gun looks slightly off in the hand, adjust the offsets in `HeldWeapon` (`src/Combat.jsx`).

## Cheat codes (type the word while playing - see `src/cheats.js`, TAB shows the list in game)
Classics: UNLOCKALL · SKIPMISSION · NITRO · MOONJUMP · PAINTJOB · DUSK · MIDNIGHT · HIGHNOON · RAINSTORM · MOUNTAIN (waterfall) · DOWNTOWN
**New unique cheats:**
| Code | What it does |
|---|---|
| BADBOY | open a police case right now (to try the chase) |
| PARDON | close the case: the police give up |
| GUNSMITH | infinite ammo, no reloading (toggle) |
| SKYCAR | the car lifts off and flies over mountains and sea (type again to land) |
| MONSTRUCK | monster-truck sized car that crushes traffic (toggle) |
| TINYCAR | tiny toy car (toggle) |
| PHANTOM | see-through ghost car, drive through buildings, trees and traffic (toggle) |
| GOLDRUSH | solid gold car (PAINTJOB goes back to normal paint) |
| DISCOBALL | disco party: the whole world cycles through neon colours (toggle) |
| SNOWDAY | snowfall (toggle) |
| SLOWMO | bullet time (toggle) |
| GHOSTTOWN | removes all traffic and pedestrians (toggle) |
| SUNBATH | teleport to a quiet sandy beach |
| SUMMIT | teleport to the highest point of the island |
(No cheat contains E or F on purpose, because E / F are game keys. Add your own in `src/cheats.js`.)

## Cars
* **Your car: Ferrari Daytona SP3** - `public/models/ferrari.glb`. The paint is the material named `PAINT`, so PAINTJOB / GOLDRUSH recolour it. Neon underglow stays.
* **City traffic: Jaguar Mk II + VW Teramont** - `public/models/jaguar.glb`, `teramont.glb`, drawn with GPU instancing (20 of each, random paint).
* The originals were huge (Ferrari 177 MB / 2.2 M triangles). They were converted for the web (interior + engine removed, simplified, compressed): 1.8 MB / 0.3 MB / 0.6 MB.
  The conversion scripts are in `tools/car-pipeline/` so you can add more cars. Credits: `public/models/CREDITS.txt`.

## The map (press Q)
`src/MapView.jsx` draws the whole island from the game's own terrain (sea, beaches, hills, snow peaks, rivers, lakes, bridges, the city grid, waterfalls, chapter markers, mission orbs, your car and you).
The same picture is the round **radar** (it rotates with you). Click the big map to drop a pink **waypoint** that also shows on the radar. `island-map-preview.png` is a static copy.

## The island (`src/terrain.js`, `src/Island.jsx`)
~2.1 km wide island: flat city in the middle, hills, mountain range with two crater lakes + waterfalls, two rivers (6 bridges),
4 lakes, beaches and cliffs. Water and cliffs block the car/hero. `island-map-preview.png` is a top-down preview.

## Look
`src/Atmosphere.jsx` = neon sunset sky/fog/lights (and night/day). Title card: `src/Intro.jsx`, text in `PROFILE` in `data.js`.
Characters: `public/models/hero.glb`, `crowd.glb`. Music: `src/music.js` (+ optional real songs in `public/music/`).
