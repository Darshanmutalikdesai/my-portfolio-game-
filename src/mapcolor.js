// Pure map colouring (no DOM) - used by the in-game map and by the preview generator.
import { SEA, ISLAND_R } from './terrain'

export const MAP_R = ISLAND_R + 320      // the map covers the world from -MAP_R to +MAP_R on both axes
export const MAP_N = 480                 // map resolution (cells)
const STOPS = [[SEA, [132, 202, 92]], [6, [124, 198, 86]], [30, [96, 172, 72]], [70, [150, 164, 82]], [110, [170, 142, 94]], [150, [142, 130, 122]], [190, [238, 238, 244]]]
const lerp = (a, b, t) => a + (b - a) * t

const SAND = [240, 222, 170]
function shoreMask(H, N, R = 5) {   // how close to open water each cell is (0..1), box blur of the water mask
  const A = new Float32Array(N * N), B = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) A[i] = H[i] < SEA ? 1 : 0
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let d = -R; d <= R; d++) s += A[y * N + Math.min(N - 1, Math.max(0, x + d))]; B[y * N + x] = s / (2 * R + 1) }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let d = -R; d <= R; d++) s += B[Math.min(N - 1, Math.max(0, y + d)) * N + x]; A[y * N + x] = s / (2 * R + 1) }
  return A
}
export function colorize(H, N) {
  const out = new Uint8ClampedArray(N * N * 4), k = (2 * MAP_R) / N, shore = shoreMask(H, N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, h = H[i]
    let r, g, b
    if (h < SEA) {                                        // sea, rivers, lakes
      const d = Math.min(1, (SEA - h) / 8)
      r = lerp(70, 14, d); g = lerp(206, 96, d); b = lerp(216, 150, d)
    } else {
      let j = 1; while (j < STOPS.length - 1 && h > STOPS[j][0]) j++
      const [h0, c0] = STOPS[j - 1], [h1, c1] = STOPS[j], t = Math.max(0, Math.min(1, (h - h0) / (h1 - h0)))
      r = lerp(c0[0], c1[0], t); g = lerp(c0[1], c1[1], t); b = lerp(c0[2], c1[2], t)
      const sd = h < 9 ? Math.min(1, shore[i] * 3) : 0      // beaches: land close to water
      r = lerp(r, SAND[0], sd); g = lerp(g, SAND[1], sd); b = lerp(b, SAND[2], sd)
      const hl = H[x > 0 ? i - 1 : i], hr = H[x < N - 1 ? i + 1 : i], hu = H[y > 0 ? i - N : i], hd = H[y < N - 1 ? i + N : i]
      const sh = Math.max(0.6, Math.min(1.35, 1 + (0.9 * ((hr - hl) + (hd - hu))) / (2 * k)))   // hill-shading, light from the north-west
      r *= sh; g *= sh; b *= sh
    }
    const o = i * 4
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255
  }
  return out
}
