import { useGame, CAR_COLORS } from './store'
import { ZONES } from './data'
import { MLAKES, groundAt } from './terrain'
import { openCase, closeCase } from './police'
import { wp } from './shared'

// =====================================================================
//  CHEAT CODES - just type the word on the keyboard while playing (no Enter needed), like the old classics.
//  Press TAB to see the list on screen.
//  (No cheat word contains E, F, M-as-hotkey etc. on purpose: E / F / , . / TAB are the game's own hotkeys.) Add your own here: CODE: { desc, run(g) }  where g = useGame.getState()
// =====================================================================
const M1 = MLAKES[0]
// landmarks found by scanning the terrain (lazy: only when the cheat is typed)
let _peak, _beach
function findPeak() {
  if (_peak) return _peak
  let best = { h: -1e9, x: 0, z: 0 }
  for (let x = -1100; x <= 1100; x += 28) for (let z = -1100; z <= 1100; z += 28) { const h = groundAt(x, z); if (h > best.h) best = { h, x, z } }
  return (_peak = best)
}
function findBeach() {
  if (_beach) return _beach
  let best = null
  for (let a = 0; a < 360; a += 3) {
    const dx = Math.cos((a * Math.PI) / 180), dz = Math.sin((a * Math.PI) / 180)
    let r = 850; while (r < 1300 && groundAt(dx * r, dz * r) > -0.6) r += 5
    if (r >= 1300) continue
    const x = dx * (r - 22), z = dz * (r - 22), h = groundAt(x, z), h2 = groundAt(dx * (r - 70), dz * (r - 70))
    if (h > 0.2 && h < 4 && h2 < 6 && (!best || h2 < best.h2)) best = { x, z, h2 }
  }
  return (_beach = best || { x: 0, z: 700 })
}
export const CHEATS = {
  UNLOCKALL: { desc: 'Unlock every chapter instantly', run: (g) => { g.unlockAll(); return 'ALL CHAPTERS UNLOCKED' } },
  SKIPMISSION: { desc: 'Skip the current mission', run: (g) => { if (g.step >= ZONES.length) return 'NO MISSION LEFT'; g.unlock(g.step); return 'MISSION SKIPPED' } },
  NITRO: { desc: 'Turbo car: faster acceleration + top speed (toggle)', run: (g) => { g.toggle('nitro'); return useGame.getState().nitro ? 'NITRO ON' : 'NITRO OFF' } },
  MOONJUMP: { desc: 'Low gravity: SPACE makes you jump very high on foot (toggle)', run: (g) => { g.toggle('moon'); return useGame.getState().moon ? 'MOON GRAVITY ON' : 'MOON GRAVITY OFF' } },
  PAINTJOB: { desc: 'Respray the car (press again for the next colour)', run: (g) => { g.paint(); return 'NEW PAINT JOB' } },
  DUSK: { desc: 'Golden-hour neon sunset (the default look)', run: (g) => { g.setTod('sunset'); return 'SUNSET' } },
  MIDNIGHT: { desc: 'Night time, neon city', run: (g) => { g.setTod('night'); return 'NIGHT TIME' } },
  HIGHNOON: { desc: 'Bright sunny day', run: (g) => { g.setTod('day'); return 'HIGH NOON' } },
  RAINSTORM: { desc: 'Rain on / off (toggle)', run: (g) => { g.toggle('rain'); return useGame.getState().rain ? 'RAINSTORM' : 'CLEAR WEATHER' } },
  MOUNTAIN: { desc: 'Teleport to the mountain waterfall', run: (g) => { g.teleport(M1.px + M1.dx * 30, M1.pz + M1.dz * 30); return 'TELEPORTING TO THE WATERFALL' } },
  DOWNTOWN: { desc: 'Teleport back to the city centre', run: (g) => { g.teleport(-3.5, -14); return 'BACK TO DOWNTOWN' } },
  // ---------- unique extras (none contains E or F, they are game keys) ----------
  SKYCAR: { desc: 'Flying car: the car lifts off and flies over mountains and sea (toggle)', run: (g) => { g.toggle('fly'); return useGame.getState().fly ? 'SKYCAR: TAKING OFF' : 'SKYCAR: LANDING' } },
  MONSTRUCK: { desc: 'Monster truck: giant car (toggle)', run: (g) => { g.setSize('monster'); return useGame.getState().monster ? 'MONSTER TRUCK' : 'NORMAL SIZE' } },
  TINYCAR: { desc: 'Tiny toy car (toggle)', run: (g) => { g.setSize('tiny'); return useGame.getState().tiny ? 'TINY CAR' : 'NORMAL SIZE' } },
  PHANTOM: { desc: 'Ghost car: drive through buildings, trees and traffic (toggle)', run: (g) => { g.toggle('phantom'); return useGame.getState().phantom ? 'PHANTOM MODE' : 'SOLID AGAIN' } },
  GOLDRUSH: { desc: 'Solid gold car', run: (g) => { useGame.setState({ gold: true }); return 'GOLD RUSH' } },
  DISCOBALL: { desc: 'Disco party: the whole world cycles through neon colours (toggle)', run: (g) => { g.toggle('disco'); return useGame.getState().disco ? 'DISCO FEVER' : 'PARTY OVER' } },
  SNOWDAY: { desc: 'It snows (toggle)', run: (g) => { g.toggle('snow'); return useGame.getState().snow ? 'LET IT SNOW' : 'SNOW STOPS' } },
  SLOWMO: { desc: 'Bullet time: everything you control runs in slow motion (toggle)', run: (g) => { g.toggle('slow'); return useGame.getState().slow ? 'SLOW MOTION' : 'NORMAL SPEED' } },
  GHOSTTOWN: { desc: 'Empty island: removes all traffic and pedestrians (toggle)', run: (g) => { g.toggle('ghost'); return useGame.getState().ghost ? 'GHOST TOWN' : 'PEOPLE ARE BACK' } },
  SUNBATH: { desc: 'Teleport to a quiet sandy beach', run: (g) => { const b = findBeach(); g.teleport(b.x, b.z); return 'BEACH TIME' } },
  BADBOY: { desc: 'Open a police case now (see the police chase)', run: () => { openCase(1, '🚨 BAD BOY · A CASE IS OPEN · POLICE ARE COMING!'); return 'BAD BOY' } },
  PARDON: { desc: 'Close the case: the police give up', run: () => { closeCase('✅ PARDONED · CASE CLOSED'); return 'PARDONED' } },
  GUNSMITH: { desc: 'Infinite ammo, no reloading (toggle)', run: () => { wp.infinite = !wp.infinite; return wp.infinite ? 'INFINITE AMMO' : 'NORMAL AMMO' } },
  SUMMIT: { desc: 'Teleport to the highest point of the island', run: (g) => { const p = findPeak(); g.teleport(p.x, p.z); return 'TOP OF THE ISLAND' } },
}
const MAXLEN = Math.max(...Object.keys(CHEATS).map((k) => k.length))
let buf = ''
// feed every key press; returns true if a cheat fired
export function feedCheat(code) {
  if (!/^Key[A-Z]$/.test(code)) return false
  buf = (buf + code[3]).slice(-MAXLEN)
  for (const k of Object.keys(CHEATS)) {
    if (buf.endsWith(k)) {
      buf = ''
      const g = useGame.getState()
      g.say('CHEAT ACTIVATED · ' + CHEATS[k].run(g))
      return true
    }
  }
  return false
}
export { CAR_COLORS }

// run a cheat by name (used by the tap-to-activate cheat list on touch screens)
export function runCheat(word) {
  const c = CHEATS[word]; if (!c) return false
  const g = useGame.getState()
  g.say('CHEAT ACTIVATED · ' + c.run(g))
  return true
}
