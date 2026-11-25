// =====================================================================
//  WEAPONS: 1 fists · 2 pistol · 3 SMG · 4 shotgun · 5 rocket launcher
//  Hit-scan bullets (ray vs buildings / pedestrians / police cars / traffic), rockets with an explosion, reloading.
//  Every pedestrian you hit counts toward the police case (more than 6 -> a case opens), see police.js.
// =====================================================================
import * as THREE from 'three'
import { useGame } from './store'
import { wp, crowd, cops, traffic, fxq, cam, worldRef } from './shared'
import { groundAt } from './terrain'
import { sfx } from './sfx'
import { pedHit, copHit } from './police'

export const WEAPONS = [
  { name: 'FISTS' },
  { name: 'PISTOL', mag: 12, rate: 0.26, dmg: 14, spread: 0.012, range: 140, pellets: 1, reload: 1.0, snd: 'pistol' },
  { name: 'SMG', mag: 30, rate: 0.075, dmg: 8, spread: 0.035, range: 120, pellets: 1, auto: true, reload: 1.5, snd: 'smg' },
  { name: 'SHOTGUN', mag: 6, rate: 0.8, dmg: 12, spread: 0.075, range: 55, pellets: 8, reload: 2.0, snd: 'shotgun' },
  { name: 'ROCKET', mag: 1, rate: 1.0, rocket: true, reload: 2.4, snd: 'rocket' },
]
export const rockets = []
const V = THREE.Vector3

// ray / sphere and ray / box tests
function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz
  const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - c
  if (disc < 0) return null
  const t = -b - Math.sqrt(disc)
  return t > 0 ? t : null
}
function rayBox(o, d, b) {
  const hx = b.w / 2, hz = b.d / 2, hy = b.h || 8
  let t0 = 0, t1 = 1e9
  const slab = (po, pd, lo, hi) => {
    if (Math.abs(pd) < 1e-9) return po >= lo && po <= hi
    let a = (lo - po) / pd, c = (hi - po) / pd
    if (a > c) { const t = a; a = c; c = t }
    if (a > t0) t0 = a
    if (c < t1) t1 = c
    return t0 <= t1
  }
  return slab(o.x, d.x, b.x - hx, b.x + hx) && slab(o.y, d.y, 0, hy) && slab(o.z, d.z, b.z - hz, b.z + hz) ? t0 : null
}
export function traceShot(o, d, range) {
  let best = { t: range, kind: null, target: null }
  const upd = (t, kind, target) => { if (t !== null && t < best.t) best = { t, kind, target } }
  for (const b of worldRef.colliders) {
    if (Math.abs(b.x - o.x) > range + 40 || Math.abs(b.z - o.z) > range + 40) continue
    upd(rayBox(o, d, b), 'wall', b)
  }
  for (const p of crowd) {
    if (p.down > 0 || !p.group.visible) continue
    const g = groundAt(p.x, p.z)
    const a = raySphere(o, d, p.x, g + 0.55, p.z, 0.55), c = raySphere(o, d, p.x, g + 1.4, p.z, 0.42)
    upd(a === null ? c : c === null ? a : Math.min(a, c), 'ped', p)
  }
  for (const k of cops) if (k.dead <= 0) upd(raySphere(o, d, k.x, groundAt(k.x, k.z) + 0.9, k.z, 2.1), 'cop', k)
  for (const t of traffic) if (t) upd(raySphere(o, d, t.x, 0.9, t.z, 2.2), 'car', t)
  if (d.y < -0.001) { const tg = (groundAt(o.x, o.z) - o.y) / d.y; if (tg > 0) upd(tg, 'ground', null) }
  return best
}

export function tickWeapons(dt) {
  wp.cd = Math.max(0, wp.cd - dt)
  if (wp.reload > 0) {
    wp.reload -= dt
    if (wp.reload <= 0) wp.mag[wp.idx] = WEAPONS[wp.idx].mag
  }
}
export function reloadNow() {
  const i = useGame.getState().weapon, W = WEAPONS[i]
  if (!W.mag || wp.reload > 0 || wp.mag[i] >= W.mag) return
  wp.reload = W.reload; wp.idx = i
}

const _d = new V()
export function fireWeapon(muzzle, aimPoint, press) {     // returns true when a shot left the barrel
  const i = useGame.getState().weapon, W = WEAPONS[i]
  if (!W.mag || wp.reload > 0 || wp.cd > 0) return false
  if (!W.auto && !press) return false
  if (wp.mag[i] <= 0) { reloadNow(); return false }
  wp.cd = W.rate
  if (!wp.infinite) wp.mag[i]--
  sfx.shoot(W.snd)
  const base = new V().subVectors(aimPoint, muzzle).normalize()
  fxq.push({ type: 'flash', p: muzzle.clone() })
  cam.shake = Math.max(cam.shake, W.rocket ? 0.5 : W.pellets > 1 ? 0.22 : 0.08)
  if (W.rocket) rockets.push({ p: muzzle.clone(), v: base.clone().multiplyScalar(72), life: 3 })
  else for (let n = 0; n < W.pellets; n++) {
    _d.copy(base); _d.x += (Math.random() - 0.5) * W.spread * 2; _d.y += (Math.random() - 0.5) * W.spread * 2; _d.z += (Math.random() - 0.5) * W.spread * 2; _d.normalize()
    const hit = traceShot(muzzle, _d, W.range), end = muzzle.clone().addScaledVector(_d, hit.t)
    fxq.push({ type: 'tracer', a: muzzle.clone(), b: end })
    if (hit.kind === 'ped') pedHit(hit.target, 'gun')
    else if (hit.kind === 'cop') copHit(hit.target, W.dmg)
    if (hit.kind) fxq.push({ type: 'impact', p: end })
  }
  if (!wp.infinite && wp.mag[i] <= 0) reloadNow()
  return true
}
export function punch(x, z, h) {
  sfx.punch()
  const fx = Math.sin(h), fz = Math.cos(h)
  for (const p of crowd) {
    if (p.down > 0 || !p.group.visible) continue
    const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz)
    if (d < 1.9 && (dx * fx + dz * fz) / (d || 1) > 0.3) pedHit(p, 'fist')
  }
}

function explode(p) {
  fxq.push({ type: 'boom', p: p.clone() })
  sfx.boom(); cam.shake = 1
  for (const q of crowd) if (q.down <= 0 && q.group.visible && Math.hypot(q.x - p.x, q.z - p.z) < 10) pedHit(q, 'rocket')
  for (const k of cops) { const d = Math.hypot(k.x - p.x, k.z - p.z); if (k.dead <= 0 && d < 13) copHit(k, 150 * (1 - d / 13)) }
}
export function updateRockets(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i]
    r.life -= dt
    r.p.addScaledVector(r.v, dt)
    let hit = r.life <= 0 || r.p.y < groundAt(r.p.x, r.p.z)
    if (!hit) for (const b of worldRef.colliders) { if (Math.abs(b.x - r.p.x) < b.w / 2 && Math.abs(b.z - r.p.z) < b.d / 2 && r.p.y < (b.h || 8)) { hit = true; break } }
    if (!hit) for (const k of cops) if (k.dead <= 0 && Math.hypot(k.x - r.p.x, k.z - r.p.z) < 2.6 && r.p.y < 3) { hit = true; break }
    if (!hit) for (const q of crowd) if (q.down <= 0 && Math.hypot(q.x - r.p.x, q.z - r.p.z) < 2 && r.p.y < 2.6) { hit = true; break }
    if (hit) { explode(r.p); rockets.splice(i, 1) }
  }
}
