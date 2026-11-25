export const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export const fbm = (x, y) => { let s = 0, a = 0.5; for (let i = 0; i < 5; i++) { s += a * vnoise(x, y); x *= 2; y *= 2; a *= 0.5 } return s }
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const lerp = (a, b, t) => a + (b - a) * t

// =====================================================================
//  THE ISLAND  (inspired by a floating low-poly island: flat city in the middle, hills, a mountain range
//  with crater lakes + waterfalls, rivers, lakes, forests, beaches on some shores and tall cliffs on others)
//  Units are metres. The city occupies |x|,|z| < 300 and is perfectly flat (height 0). Sea level = SEA.
// =====================================================================
export const SEA = -1.2
export const ISLAND_R = 1050            // average coastline radius
const wobble = (x, z) => (fbm(x * 0.0016 + 3, z * 0.0016 + 7) - 0.5) * 240
export const shoreDist = (x, z) => Math.hypot(x, z) + wobble(x, z)   // >= ISLAND_R means "at the shore"

// rivers: x as a function of z (flowing from the mountains to the sea)
export const RIVERS = [
  { x: (z) => 560 + 110 * Math.sin(z * 0.0042 + 1) + 55 * Math.sin(z * 0.0105) + 22 * Math.sin(z * 0.024), z0: -640, hw: 16 },
  { x: (z) => -545 + 85 * Math.sin(z * 0.0048 + 2) + 45 * Math.sin(z * 0.012) + 18 * Math.sin(z * 0.027), z0: -230, hw: 14 },
]
// lakes at sea level (bowls carved below the water plane)
export const LAKES = [{ x: -625, z: -330, r: 125 }, { x: 430, z: -430, r: 95 }, { x: -390, z: 640, r: 85 }, { x: 700, z: 420, r: 70 }]

export function baseHeight(x, z) {
  const dc = Math.max(Math.abs(x), Math.abs(z))
  const edge = sstep(300, 450, dc)                                   // flat city plateau
  const n = fbm(x * 0.0035 + 10, z * 0.0035 + 10)
  let h = Math.max(0, n - 0.34) * 85 + fbm(x * 0.03, z * 0.03) * 3.5   // rolling hills
  const mk = sstep(-0.05, 0.95, (-x * 0.45 - z * 0.9) / 800 + 0.2)     // mountains concentrate in the north-west
  const ridge = 1 - Math.abs(2 * fbm(x * 0.0022 + 40, z * 0.0022 + 40) - 1)
  h += mk * sstep(430, 780, dc) * Math.pow(ridge, 2.1) * 140     // far from the city so it never forms a wall
  return h * edge
}

// ---- mountain crater lakes with a spillway + waterfall + plunge pool (positions of the water are exported for rendering) ----
const ML_SEEDS = [{ x: -150, z: -735, r: 58 }, { x: 175, z: -750, r: 50 }]
export const MLAKES = ML_SEEDS.map((s) => {
  const top = baseHeight(s.x, s.z)
  const level = top - 13
  let best = null
  for (let a = 0; a < 16; a++) {                                    // spill towards the lowest ground
    const dx = Math.cos((a / 16) * Math.PI * 2), dz = Math.sin((a / 16) * Math.PI * 2)
    const ex = s.x + dx * (s.r + 110), ez = s.z + dz * (s.r + 110)
    const eh = baseHeight(ex, ez)
    if (!best || eh < best.eh) best = { dx, dz, eh }
  }
  const len = 70, u0 = s.r * 0.9
  const poolH = Math.min(best.eh, level - 14) - 1                    // plunge pool water surface
  return { ...s, level, dx: best.dx, dz: best.dz, u0, len, w: 13, poolH, px: s.x + best.dx * (u0 + len + 12), pz: s.z + best.dz * (u0 + len + 12), pr: 30 }
})

export function heightAt(x, z) {
  let h = baseHeight(x, z)
  const dd = shoreDist(x, z)
  // --- coast: beaches (gentle) on some shores, cliffs (steep) on others ---
  const cl = sstep(0.4, 0.6, fbm(x * 0.004 + 90, z * 0.004 + 90))
  const rim = lerp(2.5, 17 + 9 * fbm(x * 0.01, z * 0.01), cl)
  h = lerp(h, Math.max(rim, h * 0.25), sstep(ISLAND_R - 250, ISLAND_R - 90, dd) * (Math.max(Math.abs(x), Math.abs(z)) > 330 ? 1 : 0))
  // --- rivers ---
  for (const R of RIVERS) {
    if (z < R.z0 - 60) continue
    const f = sstep(R.z0, R.z0 + 60, z), dr = Math.abs(x - R.x(z))
    const valley = (1 - sstep(R.hw + 10, R.hw + 110, dr)) * f
    h = lerp(h, Math.min(h, 3 + dr * 0.04), valley)                  // wide shallow valley
    h = lerp(h, -4.5, (1 - sstep(R.hw, R.hw + 22, dr)) * f)           // river bed
  }
  // --- lakes ---
  for (const L of LAKES) {
    const d = Math.hypot(x - L.x, z - L.z)
    if (d > L.r * 1.8) continue
    h = lerp(h, Math.min(h, 2.5), 1 - sstep(L.r * 0.9, L.r * 1.8, d))
    h = lerp(h, -5, 1 - sstep(L.r * 0.55, L.r, d))
  }
  // --- mountain crater lakes / spillway / plunge pool ---
  for (const M of MLAKES) {
    // 1) crater bowl with a raised rim
    const d = Math.hypot(x - M.x, z - M.z)
    if (d < M.r * 1.9) {
      const hb = h, rimH = Math.max(hb, M.level + 5)
      h = lerp(M.level - 5, rimH, sstep(M.r * 0.6, M.r, d))
      h = lerp(h, hb, sstep(M.r, M.r * 1.9, d))
    }
    // 2) plunge pool: deep bowl surrounded by an earth bank that is always above the water surface
    const dp = Math.hypot(x - M.px, z - M.pz)
    if (dp < M.pr * 1.7) {
      const ho = h, bank = Math.max(ho, M.poolH + 1.2)
      h = lerp(M.poolH - 3.5, bank, sstep(M.pr * 0.55, M.pr * 0.95, dp))
      h = lerp(h, ho, sstep(M.pr * 0.95, M.pr * 1.7, dp))
    }
    // 3) spillway channel from the crater rim, down the waterfall, through the pool and out the other side
    const ox = x - M.x, oz = z - M.z, u = ox * M.dx + oz * M.dz, v = Math.abs(-ox * M.dz + oz * M.dx)
    if (u > M.u0 - 4 && u < M.u0 + M.len + 140 && v < M.w + 16) {
      const end = M.u0 + M.len
      const chan = u < end ? lerp(M.level - 1.5, M.poolH - 0.5, sstep(M.u0, end, u)) : lerp(M.poolH - 0.5, Math.min(h, M.poolH + 2), sstep(end + 40, end + 140, u))
      h = lerp(h, Math.min(h, chan), 1 - sstep(M.w, M.w + 16, v))   // only ever cut downwards, so the pool keeps its deep bowl
    }
  }
  // --- bridge approach ramps: an earth embankment that blends the deck height into the surrounding ground ---
  for (const b of BRIDGES) {
    const dz = Math.abs(z - b.z); if (dz > b.w + 8) continue
    const ax = Math.abs(x - b.x) - b.half; if (ax < 0 || ax > 16) continue
    const ramp = lerp(b.y, h, sstep(0, 16, ax))
    h = lerp(h, Math.max(h, ramp), 1 - sstep(b.w, b.w + 8, dz))
  }
  // --- shoreline drop to the sea ---
  const w = lerp(95, 16, cl)
  h = lerp(h, -9, sstep(ISLAND_R - w, ISLAND_R, dd))
  return h
}


// flat water discs for the crater lakes and plunge pools: [{x, z, y, r}]
export const HIGH_WATER = MLAKES.flatMap((m) => [{ x: m.x, z: m.z, y: m.level, r: m.r * 0.85 }, { x: m.px, z: m.pz, y: m.poolH, r: m.pr * 0.9 }])

// ---------- bridges over the two rivers (the car / hero can drive across; everywhere else water blocks you) ----------
export const BRIDGES = []
const slopeOf = (R, z) => (R.x(z + 3) - R.x(z - 3)) / 6
;[[0, -120], [0, 150], [0, 470], [1, -40], [1, 230], [1, 520]].forEach(([ri, zt]) => {
  const R = RIVERS[ri]; let bz = zt, bs = 9
  for (let z = zt - 60; z <= zt + 60; z += 4) { const sl = Math.abs(slopeOf(R, z)); if (sl < bs) { bs = sl; bz = z } }
  BRIDGES.push({ x: R.x(bz), z: bz, half: (R.hw + 34) * Math.sqrt(1 + bs * bs), w: 7, y: 5 })
})
// height you actually stand / drive on (bridge decks count as ground)
export function groundAt(x, z) {
  const h = heightAt(x, z)
  for (const b of BRIDGES) if (Math.abs(z - b.z) < b.w && Math.abs(x - b.x) < b.half) return Math.max(b.y, h)
  return h
}
