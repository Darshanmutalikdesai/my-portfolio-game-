import { useEffect } from 'react'
import { ZONES } from './data'
import { useGame } from './store'
import { LINES, mapWp } from './shared'
import { heightAt, BRIDGES, MLAKES, HIGH_WATER } from './terrain'
import { MAP_R, MAP_N, colorize } from './mapcolor'

// =====================================================================
//  THE ISLAND MAP: a top-down picture of the whole island drawn from the game's own terrain
//  (sea, beaches, hills, mountains, snow, rivers, lakes, bridges, the city grid). It is built in small slices
//  while you look at the title screen, then used by (1) the round radar and (2) the full map (press Q).
// =====================================================================
export const mapBase = { canvas: null, ready: false }
const K = (2 * MAP_R) / MAP_N                     // metres per map cell
const px = (x) => (x + MAP_R) / K, pz = (z) => (z + MAP_R) / K

export function startMapBuild() {
  if (mapBase.canvas) return
  const cv = document.createElement('canvas'); cv.width = cv.height = MAP_N
  mapBase.canvas = cv
  const H = new Float32Array(MAP_N * MAP_N)
  let row = 0
  const step = () => {
    const t0 = performance.now()
    while (row < MAP_N && performance.now() - t0 < 9) {
      for (let x = 0; x < MAP_N; x++) H[row * MAP_N + x] = heightAt(-MAP_R + (x + 0.5) * K, -MAP_R + (row + 0.5) * K)
      row++
    }
    if (row < MAP_N) return requestAnimationFrame(step)
    const g = cv.getContext('2d')
    g.putImageData(new ImageData(colorize(H, MAP_N), MAP_N, MAP_N), 0, 0)
    // city blocks + roads
    g.fillStyle = 'rgba(255,119,176,.28)'; g.fillRect(px(-300), pz(-300), 600 / K, 600 / K)
    g.strokeStyle = 'rgba(255,236,246,.9)'; g.lineWidth = 1.3
    LINES.forEach((L) => { g.beginPath(); g.moveTo(px(L), pz(-300)); g.lineTo(px(L), pz(300)); g.moveTo(px(-300), pz(L)); g.lineTo(px(300), pz(L)); g.stroke() })
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.6; g.strokeRect(px(-300), pz(-300), 600 / K, 600 / K)
    // crater lakes + waterfalls
    g.fillStyle = '#8fe8ff'; HIGH_WATER.forEach((w) => { g.beginPath(); g.arc(px(w.x), pz(w.z), Math.max(1.6, w.r / K), 0, 7); g.fill() })
    // bridges
    g.strokeStyle = '#3a2418'; g.lineWidth = 2.4
    BRIDGES.forEach((b) => { g.beginPath(); g.moveTo(px(b.x - b.half), pz(b.z)); g.lineTo(px(b.x + b.half), pz(b.z)); g.stroke() })
    mapBase.ready = true
  }
  requestAnimationFrame(step)
}

// ---- round radar: the island map rotates around you (heading up) ----
export function drawRadarBase(gx, size, e, sc) {
  if (!mapBase.ready) return
  const MC = size / 2, cs = Math.cos(e.h), sn = Math.sin(e.h), k = K * sc
  gx.save()
  gx.setTransform(-cs * k, -sn * k, sn * k, -cs * k, MC + sc * (-cs * (-MAP_R - e.x) + sn * (-MAP_R - e.z)), MC + sc * (-sn * (-MAP_R - e.x) - cs * (-MAP_R - e.z)))
  gx.imageSmoothingEnabled = true; gx.imageSmoothingQuality = 'high'; gx.globalAlpha = 0.92
  gx.drawImage(mapBase.canvas, 0, 0)
  gx.restore()
}

// ---- full-screen map (Q): live markers on top of the island picture ----
export function drawBigMap(cv, o) {
  if (!cv) return
  const g = cv.getContext('2d'), S = cv.width, f = S / (2 * MAP_R)
  const X = (x) => (x + MAP_R) * f, Z = (z) => (z + MAP_R) * f
  g.clearRect(0, 0, S, S)
  if (mapBase.ready) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(mapBase.canvas, 0, 0, S, S) } else { g.fillStyle = '#1a1030'; g.fillRect(0, 0, S, S); g.fillStyle = '#fff'; g.font = '20px sans-serif'; g.fillText('drawing the island…', S / 2 - 90, S / 2) }
  g.font = 'bold 15px Rubik, sans-serif'; g.textAlign = 'center'
  const label = (t, x, z, col = '#fff') => { g.lineWidth = 4; g.strokeStyle = 'rgba(30,12,60,.85)'; g.strokeText(t, X(x), Z(z)); g.fillStyle = col; g.fillText(t, X(x), Z(z)) }
  label('CITY', 0, -318)
  MLAKES.forEach((m, i) => label('WATERFALL ' + (i + 1), m.px, m.pz + 24, '#bff4ff'))
  // chapter markers
  ZONES.forEach((z, i) => { g.fillStyle = i <= o.step ? z.color : '#6b6480'; g.beginPath(); g.arc(X(z.marker[0]), Z(z.marker[1]), i === o.step ? 9 : 6, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = i === o.step ? 3 : 1.5; g.stroke() })
  // mission orbs
  if (o.M && o.M.orbs) { g.fillStyle = '#fff'; o.M.orbs.forEach(([ox, oz], i) => { if (!o.got.includes(i)) { g.beginPath(); g.arc(X(ox), Z(oz), 4, 0, 7); g.fill() } }) }
  // waypoint
  if (mapWp.on) { g.fillStyle = '#ff3fa0'; g.beginPath(); g.moveTo(X(mapWp.x), Z(mapWp.z)); g.lineTo(X(mapWp.x) - 7, Z(mapWp.z) - 18); g.lineTo(X(mapWp.x) + 7, Z(mapWp.z) - 18); g.fill(); g.beginPath(); g.arc(X(mapWp.x), Z(mapWp.z) - 21, 8, 0, 7); g.fill() }
  // your parked car (when on foot) and you
  if (!o.driving) { g.fillStyle = '#4dc9ff'; g.fillRect(X(o.cx) - 5, Z(o.cz) - 5, 10, 10) }
  g.save(); g.translate(X(o.ex), Z(o.ez)); g.rotate(Math.PI - o.eh)
  g.fillStyle = '#fff'; g.strokeStyle = '#2a1259'; g.lineWidth = 3
  g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.stroke(); g.fill(); g.restore()
}

export function MapOverlay() {
  const open = useGame((s) => s.mapOpen), toggle = useGame((s) => s.toggleMap)
  useEffect(() => { startMapBuild() }, [])
  if (!open) return null
  const click = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    mapWp.x = ((e.clientX - r.left) / r.width) * 2 * MAP_R - MAP_R; mapWp.z = ((e.clientY - r.top) / r.height) * 2 * MAP_R - MAP_R; mapWp.on = true
  }
  return (
    <div className="mapwrap" onClick={(e) => e.stopPropagation()}>
      <div className="maphead"><h2>ISLAND MAP</h2><button onClick={toggle}>Close (Q)</button></div>
      <canvas id="bigmap" width="900" height="900" onClick={click} />
      <div className="maplegend">
        <i style={{ background: '#4cc4d6' }} /> sea &amp; rivers <i style={{ background: '#f1dfaa' }} /> beach <i style={{ background: '#7cc656' }} /> plains <i style={{ background: '#a68a5e' }} /> hills <i style={{ background: '#eeeef4' }} /> snow peaks <i style={{ background: '#ff77b0' }} /> city
        <span>Click the map to drop a pink waypoint · it also shows on the radar</span>
      </div>
    </div>
  )
}
