// =====================================================================
//  THE POLICE CASE
//   * hurt MORE THAN 6 pedestrians (car or gun) -> a case opens -> police cars hunt you
//   * touch a cop while stopped (or on foot) for ~2 s -> BUSTED: $500 fine, case closed, back to the start
//   * stay > 130 units away from every cop for 12 s -> CASE CLOSED
//   * while a case is open the portfolio will not open ("close the case first")
//  Cops drive the road grid inside the city (they pick the junction that gets closest to you) and chase straight over the
//  island outside it, sliding around buildings and never driving into water.
// =====================================================================
import { useGame } from './store'
import { cops, law, LINES, carPos, worldRef } from './shared'
import { groundAt } from './terrain'
import { sfx } from './sfx'

const rnd = Math.random, clamp01 = (v) => Math.max(0, Math.min(1, v))
const setBar = (id, f) => { const el = typeof document !== 'undefined' && document.getElementById(id); if (el) el.style.width = clamp01(f) * 100 + '%' }
let kills = 0

export function pedHit(p, how) {
  if (p.down > 0) return false
  p.down = 6
  sfx.hit()
  const g = useGame.getState(), hits = g.hits + 1
  useGame.setState({ hits })
  if (g.wanted === 0) {
    if (hits > 6) openCase(1, '🚨 YOU HURT 7 PEOPLE · A POLICE CASE IS OPEN · THE POLICE ARE COMING!')
    else if (hits >= 3) g.say('⚠ ' + hits + ' PEOPLE HURT · MORE THAN 6 AND THE POLICE OPEN A CASE')
  } else if (hits % 4 === 0 && g.wanted < 3) openCase(g.wanted + 1, '🚨 WANTED LEVEL UP!')
  return true
}
export function copHit(k, dmg) {
  if (k.dead > 0) return
  k.hp -= dmg
  const g = useGame.getState()
  if (g.wanted === 0) openCase(1, '🚨 YOU ATTACKED THE POLICE!')
  if (k.hp <= 0) {
    k.hp = 0; k.dead = 9
    kills++; g.say('POLICE CAR DESTROYED')
    if (kills % 2 === 0 && useGame.getState().wanted < 3) openCase(useGame.getState().wanted + 1, '🚨 WANTED LEVEL UP!')
  }
}

const base = (o) => ({ h: 0, v: 0, hp: 100, dead: 0, cd: 0, spd: 26 + rnd() * 5, stuck: 0, rev: 0, rsign: 1, ...o })
function makeCop() {
  const P = carPos
  if (Math.abs(P.x) < 280 && Math.abs(P.z) < 280) {
    const pts = []
    for (const a of LINES) for (const b of LINES) { const d = Math.hypot(a - P.x, b - P.z); if (d > 120 && d < 330) pts.push([a, b]) }
    if (pts.length) {
      const [x, z] = pts[(rnd() * pts.length) | 0], axis = rnd() < 0.5 ? 'x' : 'z'
      return base({ mode: 'grid', axis, L: axis === 'z' ? x : z, t: axis === 'z' ? z : x, dir: rnd() < 0.5 ? 1 : -1, x, z })
    }
  }
  for (let i = 0; i < 30; i++) { const a = rnd() * 6.283, r = 150 + rnd() * 90, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; if (groundAt(x, z) > 0.4) return base({ mode: 'free', x, z }) }
  return base({ mode: 'free', x: P.x + 120, z: P.z })
}

export function openCase(stars, msg) {
  const g = useGame.getState(), n = Math.min(3, Math.max(stars, g.wanted))
  useGame.setState({ wanted: n })
  law.evade = 0; law.bust = 0
  while (cops.length < n + 1) cops.push(makeCop())
  if (msg) g.say(msg)
}
export function closeCase(msg) {
  useGame.setState({ wanted: 0, hits: 0 })
  cops.length = 0; law.evade = 0; law.bust = 0; law.shove = null
  sfx.sirenVol(0)
  if (msg) useGame.getState().say(msg)
}
function busted() {
  const g = useGame.getState(), fine = Math.min(500, g.cash)
  useGame.setState({ cash: g.cash - fine })
  closeCase('🚔 BUSTED! FINE $' + fine + ' · CASE CLOSED · YOU ARE RELEASED')
  g.teleport(-3.5, -14)
}

// ---- movement ----
const headingOf = (k) => (k.axis === 'z' ? (k.dir > 0 ? 0 : Math.PI) : k.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
function chooseRoad(k, c, P) {            // at a junction pick the road that ends closest to the player
  const ix = k.axis === 'z' ? k.L : c, iz = k.axis === 'z' ? c : k.L, other = k.axis === 'z' ? 'x' : 'z'
  let best = null, bd = 1e9
  for (const [a, d] of [[k.axis, k.dir], [other, 1], [other, -1]]) {
    const dist = Math.hypot(ix + (a === 'x' ? d * 110 : 0) - P.x, iz + (a === 'z' ? d * 110 : 0) - P.z)
    if (dist < bd) { bd = dist; best = [a, d] }
  }
  if (best[0] !== k.axis) { const oldL = k.L; k.axis = best[0]; k.L = c; k.t = oldL }
  k.dir = best[1]
}
function moveGrid(k, dt, P) {
  k.v += Math.max(-45 * dt, Math.min(18 * dt, (k.cap ?? k.spd) - k.v))
  const t0 = k.t
  k.t += k.dir * k.v * dt
  for (const c of LINES) if ((t0 < c && k.t >= c) || (t0 > c && k.t <= c)) { chooseRoad(k, c, P); break }
  const outside = Math.abs(P.x) > 310 || Math.abs(P.z) > 310
  if (Math.abs(k.t) >= 296) { if (outside) { k.mode = 'free'; k.v *= 0.8; return } k.t = Math.sign(k.t) * 296; k.dir = -Math.sign(k.t) }
  const hl = headingOf(k), dh = ((hl - k.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  k.h += dh * Math.min(1, 9 * dt)
  const bx = k.axis === 'z' ? k.L : k.t, bz = k.axis === 'z' ? k.t : k.L
  k.x = bx - Math.cos(hl) * 3.5; k.z = bz + Math.sin(hl) * 3.5
}
function moveFree(k, dt, P) {
  const want = Math.atan2(P.x - k.x, P.z - k.z), dh = ((want - k.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  if (k.rev > 0) { k.rev -= dt; k.v = -7; k.h += k.rsign * 1.6 * dt }
  else { k.h += Math.max(-2.6 * dt, Math.min(2.6 * dt, dh)); k.v += Math.max(-45 * dt, Math.min(16 * dt, (k.cap ?? k.spd) - k.v)) }
  const ox = k.x, oz = k.z
  k.x += Math.sin(k.h) * k.v * dt; k.z += Math.cos(k.h) * k.v * dt
  if (Math.abs(k.x) < 345 && Math.abs(k.z) < 345) for (const b of worldRef.colliders) {
    const dx = k.x - b.x, dz = k.z - b.z, r = 2.3
    if (Math.abs(dx) > b.w / 2 + r || Math.abs(dz) > b.d / 2 + r) continue
    const qx = b.w / 2 + r - Math.abs(dx), qz = b.d / 2 + r - Math.abs(dz)
    if (qx < qz) k.x += Math.sign(dx || 1) * qx; else k.z += Math.sign(dz || 1) * qz
    k.v *= 0.85
  }
  const g1 = groundAt(k.x, k.z), mv = Math.hypot(k.x - ox, k.z - oz)
  if (g1 < -0.6 || (mv > 0.01 && Math.abs(g1 - groundAt(ox, oz)) / mv > 1.0)) { k.x = ox; k.z = oz; k.v *= 0.3 }     // water and cliffs
  if (mv / Math.max(dt, 1e-3) < 2.5 && k.rev <= 0 && Math.hypot(P.x - k.x, P.z - k.z) > 8) { k.stuck += dt; if (k.stuck > 1.1) { k.rev = 0.9; k.rsign = rnd() < 0.5 ? -1 : 1; k.stuck = 0 } } else k.stuck = 0
}

export function lawTick(dt, P) {          // P = { x, z, v, driving }
  const g = useGame.getState()
  if (!g.wanted) return
  let minD = 1e9, touch = false
  for (let i = 0; i < cops.length; i++) {
    const k = cops[i]
    if (k.dead > 0) { k.dead -= dt; if (k.dead <= 0) cops[i] = makeCop(); continue }
    const d0 = Math.hypot(P.x - k.x, P.z - k.z), slowP = !P.driving || Math.abs(P.v) < 9
    k.cap = slowP && d0 < 24 ? Math.max(1.5, k.spd * Math.min(1, Math.max(0, (d0 - 6) / 18))) : k.spd         // cops slow down next to a player who has stopped, to arrest them
    if (k.mode === 'grid') moveGrid(k, dt, P); else moveFree(k, dt, P)
    k.cd = Math.max(0, k.cd - dt)
    const d = Math.hypot(P.x - k.x, P.z - k.z)
    minD = Math.min(minD, d)
    if (d < 7.5 && slowP) touch = true                                          // arrest range
    else if (d < 4.8) {
      if (k.cd <= 0) { k.cd = 1.2; law.shove = { x: (P.x - k.x) / (d || 1), z: (P.z - k.z) / (d || 1) } }     // ram
    }
  }
  law.minD = minD
  law.bust = touch ? law.bust + dt : Math.max(0, law.bust - dt * 1.5)
  law.evade = minD > 130 ? law.evade + dt : Math.max(0, law.evade - dt * 2)
  setBar('bust', law.bust / 2.2); setBar('evade', law.evade / 12)
  sfx.sirenVol(clamp01(1 - minD / 240))
  if (law.bust >= 2.2) return busted()
  if (law.evade >= 12) closeCase('✅ CASE CLOSED · YOU LOST THE POLICE')
}
