# FULL PROMPT: 3D Open-World Portfolio (GTA-inspired, original assets)

Build a browser-based 3D portfolio that plays like a small open-world driving game. The visitor drives a sports car or walks around a coastal city at golden hour. Each portfolio section (About, Projects, Skills, Contact) is a glowing building/marker; parking or standing in the ring and pressing E opens a panel with that content.

## Stack
React 18 + Vite, three.js, @react-three/fiber v8, @react-three/drei v9, @react-three/postprocessing, postprocessing, zustand. No physics engine: arcade car physics and box colliders written by hand. Everything procedural (no external model files) so it runs offline; leave clear places to swap in .glb models, PBR textures and an HDRI later.

## World (original, GTA/Vice-City-inspired layout, NOT a copy of any Rockstar map)
- Playable area about 600 x 600 units. Road grid every 100 units on both axes (5 roads each way, 14 wide, asphalt texture with lane lines). Sidewalks beside roads, street lamps with emissive bloom heads.
- 6x6 city blocks with 2x2 lots of buildings (random size/colour, taller toward downtown). Window-grid textures with randomly lit windows (emissiveMap). About 20% of lots left as parks. Four portfolio buildings near spawn with coloured emissive glow, floating text labels and glowing ground rings.
- Outside the city: terrain from fractal noise rising into mountains, ~1800 instanced forest trees (round low, pines high), sand beach and animated-looking sea on the +Z side. Terrain flat inside the city; player y follows terrain height.
- Road-lined palm trees (instanced) and park trees, all with collision boxes.

## Look
Golden-hour sun low in the sky (drei Sky + directional light with 2048 shadow map that follows the player), warm exponential fog, Lightformer-based Environment for reflections, ACES tone mapping, Bloom + Vignette post-processing, procedural grass/road/window canvas textures.

## Vehicles
- Hero car: white wedge sports car (Testarossa-inspired, original geometry built from an extruded side profile): red lower band and hood stripes, dark glass, side strakes, silver rims, pop-up-style headlight strips, yellow indicators, red tail bar. Clearcoat paint.
- ~46 AI traffic cars (instanced, random colours) driving right-hand traffic along the road grid, wrapping at map edges. The player collides with them (push-out + speed loss).

## People
- Playable hero: original stylized character (long wavy hair, moustache + goatee, white open blazer over dark shirt, cream trousers, loafers) with walk/run animation. If public/models/hero.glb exists (realistic rigged model with idle/walk/run clips) it is loaded automatically instead (useGLTF + useAnimations, crossfaded by speed).
- ~170 instanced pedestrians with random clothes/skin tones walking the sidewalks with leg-swing animation.

## Controls
W/S accelerate or walk, A/D steer or turn, SHIFT run, SPACE handbrake, F exit/enter car (must be within 5 units to enter), E open/close portfolio panel, ESC close. Third-person follow camera (distance 10 in car, 5 on foot).

## HUD
Mission box, speedometer (km/h), rotating minimap (buildings, traffic, car, coloured zone markers clamped to the rim), contextual prompts ("Press E to view PROJECTS", "Press F to enter car"), modal content panel with links and skill bars, "Skip to normal portfolio" link, key hints.

## Files
data.js (all portfolio content), shared.js, store.js (zustand), terrain.js (noise + heightAt), World.jsx (terrain, sea, city, trees, sun), Vehicles.jsx (SportsCar, Traffic), People.jsx (Character, Crowd), App.jsx (controller, HUD, scene), style.css.

## Performance
Instancing for trees, traffic, pedestrians, lamps, sidewalks; shared window textures; dpr capped at 1.5; shadow frustum 140 units around the player.

## Legal
Do not use Rockstar/GTA names, logos, maps, characters or models. Keep everything original or properly licensed (CC0/CC-BY, credit where required).

## Next steps
Swap in .glb car/character/building models, Poly Haven HDRI + PBR textures, engine audio (Howler), mobile joystick (nipplejs), day/night cycle, Rapier physics.

## Missions (added in v6)
Six chapters unlock one by one, in order, defined in data.js (ZONES order = mission order). Locked buildings/rings are grey; the current
mission's ring has a tall beam; unlocked chapters glow in colour. Reaching the ring with the mission done unlocks the chapter and opens its panel.
Mission types: drive, walk (on foot), speed (reach X km/h), orbs (collect glowing orbs), time (countdown), any. Progress lives in store.js (step).


---
## v11 UPGRADE: real car models, island map screen, 11 unique cheats

**Cars (glTF, loaded with useGLTF + meshopt):** the player drives a Ferrari Daytona SP3 (`public/models/ferrari.glb`, ~74k triangles, paint material named PAINT so the PAINTJOB/GOLDRUSH cheats can recolour it, neon underglow + pink point light kept). City traffic uses a Jaguar Mk II and a VW Teramont (`jaguar.glb`, `teramont.glb`), 20 of each, rendered with one InstancedMesh per material (node matrices baked into float geometry; paint parts tinted per instance with instanceColor). The procedural wedge car is the fallback while the Ferrari loads. Source models were converted offline with glTF-Transform (remove interior/engine, bake transforms, strip UVs+normals so triangle-soup meshes can be simplified, weld, meshopt simplify, recompute smooth normals, merge materials, resize textures, normalise to real length with front = +Z and wheels at y = 0, meshopt compress).

**Map:** `mapcolor.js` colours a 480x480 height sample of the island (water depth, beaches via shore mask, plains, hills, rock, snow, hill-shading). `MapView.jsx` builds it in 9 ms slices at start, overlays city grid, roads, crater lakes, bridges, and exposes `drawRadarBase` (rotating round radar), `drawBigMap` and `<MapOverlay>` (press Q; click = waypoint).

**New cheats (type the word, no E/F letters):** SKYCAR (fly), MONSTRUCK (2.4x car, crushes traffic), TINYCAR (0.55x), PHANTOM (no collisions + transparent car), GOLDRUSH (gold paint), DISCOBALL (HueSaturation effect spins hue), SNOWDAY (snow particles), SLOWMO (dt x 0.35), GHOSTTOWN (removes traffic + crowd), SUNBATH (teleport to a beach found by scanning the coast), SUMMIT (teleport to the highest point).


---
## v12 UPGRADE: police case, weapons, mouse-look, gamepad

**Police case (`police.js`):** every pedestrian hurt (car, bullet, punch or rocket) increments `hits`; the 7th (MORE than 6) opens a case (`wanted` 1..3). Police cars (the Jaguar model painted white with a flashing red/blue light bar, `Combat.jsx`) spawn 120-330 units away and chase: inside the city they drive the road grid and choose at each junction the road that ends closest to the player; outside they pursue straight over the terrain, slide around buildings, never enter water and recover when stuck. Cops brake next to a stopped player: within 7.5 units for ~2.2 s = BUSTED ($500 fine, case closed, back to the start). Staying > 130 units away for 12 s = case closed. A fast car is rammed instead. While `wanted > 0` the store refuses to open the portfolio and chapter unlocks are blocked ("CLOSE THE CASE FIRST"). HUD: stars, case panel with two meters (LOSE THE COPS / BUSTED), "people hurt n/7" warning. Cheats BADBOY / PARDON.

**Weapons (`weapons.js`, `sfx.js`):** fists, pistol, SMG (auto), shotgun (8 pellets), rocket launcher. Hit-scan rays against building boxes, pedestrians (2 spheres), police cars and traffic; tracers, muzzle flash light, impact sparks, rocket projectile + explosion + camera shake (Combat.jsx); magazines + reload; synthesized WebAudio gunshots / explosion / siren. Weapon mesh in the hero's hand, arm raised by an `aim` parameter in the rig pose. Hit pedestrians fall over for 6 s then a new walker appears.

**Mouse + controls:** pointer-lock mouse look (yaw/pitch orbit), car camera recentres behind the car after 2.2 s, on foot camera-relative WASD with free look and over-the-shoulder aim (right click) where the hero faces the aim direction; digit keys / wheel switch weapons, R reloads. Gamepad API: sticks, triggers, face buttons mapped to move/steer, look, fire, aim, car in/out, interact, weapons, map, cheat list.


---
## v13 UPGRADE: mobile / touch

`device.js` detects touch (`pointer: coarse` / maxTouchPoints, overridable with ?touch=1|0) and a LOW graphics mode (touch or <= 4 cores, ?low=1|0), and adds an `html.touch` class. `TouchControls.jsx` (Pointer Events, multi-touch, setPointerCapture): floating left joystick (dead zone 0.12, radius 58 px, edge = run), right-side look pad, hold buttons FIRE / JUMP(BRAKE), tap buttons CAR, USE, AIM (toggle), weapon cycle with ammo, reload, and a top-right menu (map, cheat list, music, fullscreen + landscape lock). It writes into the shared `touch` object that the Controller merges with keyboard / mouse / gamepad every frame; controls hide and release when a panel or the map is open. Cheat list rows are tappable (`runCheat`). Mobile CSS repositions the HUD (minimap, cash, case panel, speed) around the controls, respects safe areas, disables zoom / scroll / selection, adds a portrait hint. LOW mode: dpr <= 1.25, 1024 shadow map, no MSAA, 24 cars, 24 pedestrians, half the rain / snow.
