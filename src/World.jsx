import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { ZONES } from './data'
import { useGame } from './store'
import { carPos, SUN, LINES, atm } from './shared'
import { LOW } from './device'
import { heightAt, fbm, sstep, rng, shoreDist, ISLAND_R } from './terrain'

// ---------- procedural textures (swap for real PBR textures later) ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
const grassTex = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, s, s)
  for (let i = 0; i < 6000; i++) { const v = 150 + Math.random() * 100 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2 + Math.random() * 4) }
})
const roadTex = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#2b2c31'; g.fillRect(0, 0, s, s)
  for (let i = 0; i < 5000; i++) { const v = 30 + Math.random() * 35 | 0; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2) }
  g.fillStyle = '#d8d8d0'; g.fillRect(8, 0, 5, s); g.fillRect(s - 13, 0, 5, s)
  g.fillStyle = '#e8b923'; g.fillRect(s / 2 - 3, 0, 6, s / 2)
})
const roadGlowTex = () => canvasTex(256, (g, s) => {   // faint pink / cyan neon reflections on the wet asphalt
  g.fillStyle = '#000'; g.fillRect(0, 0, s, s)
  for (const [x, col] of [[0.27, '255,46,147'], [0.73, '24,232,255'], [0.5, '255,150,90']]) {
    for (let k = 0; k < 4; k++) {
      const y = Math.random() * s, h = 30 + Math.random() * 90, gr = g.createLinearGradient(0, y, 0, y + h)
      gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.5, `rgba(${col},${0.25 + Math.random() * 0.3})`); gr.addColorStop(1, `rgba(${col},0)`)
      g.fillStyle = gr; g.fillRect(x * s - 14 - Math.random() * 10, y, 28 + Math.random() * 20, h)
    }
  }
})
const windowTex = (lit) => canvasTex(256, (g, s) => {
  g.fillStyle = lit ? '#000' : '#b8b8b8'; g.fillRect(0, 0, s, s)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const x = c * 64 + 10, y = r * 64 + 10
    if (lit) { if (Math.random() < 0.35) { g.fillStyle = Math.random() < 0.7 ? '#ffd48a' : '#bfe3ff'; g.fillRect(x, y, 44, 44) } }
    else { g.fillStyle = '#27323f'; g.fillRect(x, y, 44, 44); g.fillStyle = '#3d4f63'; g.fillRect(x, y, 44, 14) }
  }
})

// ---------- terrain (the whole island) ----------
export function Terrain() {
  const { geo, map } = useMemo(() => {
    const SEG = 400, SIZE = 2600, W = SEG + 1
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position, H = new Float32Array(p.count)
    for (let i = 0; i < p.count; i++) { H[i] = heightAt(p.getX(i), p.getZ(i)); p.setY(i, H[i]) }
    const col = new Float32Array(p.count * 3), c = new THREE.Color()
    const grassA = new THREE.Color('#5fa63e'), grassB = new THREE.Color('#3f7d33'), sand = new THREE.Color('#ecd7a2'), rock = new THREE.Color('#8a8095'), snow = new THREE.Color('#f4f1fb')
    const cell = SIZE / SEG
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = H[i], ix = i % W, iz = (i / W) | 0
      const hx = H[Math.min(ix + 1, SEG) + iz * W], hz = H[ix + Math.min(iz + 1, SEG) * W]
      const slope = (Math.abs(hx - h) + Math.abs(hz - h)) / cell
      const outside = sstep(300, 335, Math.max(Math.abs(x), Math.abs(z)))
      const n = fbm(x * 0.02, z * 0.02)
      c.copy(grassA).lerp(grassB, n)
      const beach = sstep(ISLAND_R - 150, ISLAND_R - 40, shoreDist(x, z)) * (1 - sstep(0.8, 3.2, h))
      const bank = (1 - sstep(-1.2, 0.5 + (n - 0.5) * 1.2, h)) * outside
      c.lerp(sand, Math.max(beach, bank))
      c.lerp(rock, Math.max(sstep(0.42, 0.85, slope), sstep(75, 115, h + (n - 0.5) * 30) * 0.9))
      c.lerp(snow, sstep(118, 138, h + (n - 0.5) * 24) * (1 - sstep(0.7, 1.1, slope)))
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.computeVertexNormals()
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const m = grassTex(); m.repeat.set(650, 650)
    return { geo: g, map: m }
  }, [])
  return <mesh geometry={geo} receiveShadow><meshStandardMaterial vertexColors map={map} roughness={1} /></mesh>
}

// ---------- city layout ----------
const CENTERS = [-250, -150, -50, 50, 150, 250]
export function makeCity() {
  const Rr = rng(5)
  const list = ZONES.map((z, idx) => ({ x: z.bld[0], z: z.bld[1], w: z.size[0], h: z.size[1], d: z.size[2], color: '#2b2f3a', glow: z.color, zone: z, idx }))
  const nearC = (v) => CENTERS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))
  const zoneBlocks = new Set(ZONES.map((z) => nearC(z.bld[0]) + ',' + nearC(z.bld[1])))
  const cols = ['#eadfe8', '#e3d2dc', '#d3e2ee', '#f3e1d2', '#d9d4ea', '#e8e2c9', '#f0d6e4']
  for (const bx of CENTERS) for (const bz of CENTERS) {
    if (zoneBlocks.has(bx + ',' + bz)) continue // blocks that hold a chapter building
    for (const [ox, oz] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) {
      if (Rr() < 0.2) continue // leave some lots as parks
      const w = 18 + Rr() * 16, d = 18 + Rr() * 16
      const h = 8 + Rr() * (10 + 60 * Math.exp(-Math.hypot(bx, bz) / 140))
      list.push({ x: bx + ox, z: bz + oz, w, d, h, color: cols[(Rr() * cols.length) | 0] })
    }
  }
  return list
}
const SIDEWALKS = [], LAMPS = []
LINES.forEach((L) => CENTERS.forEach((c, ci) => {
  for (const s of [-8.5, 8.5]) SIDEWALKS.push({ x: L + s, z: c, sx: 3, sz: 86 }, { x: c, z: L + s, sx: 86, sz: 3 })
  const s = ci % 2 ? 8.5 : -8.5
  LAMPS.push([L + s, c], [c, L + s])
}))

// ---------- trees (instanced = fast): round, pine, palm ----------
const R = rng(7)
const forest = { round: [], pine: [], palm: [] }
for (let i = 0; i < 26000 && forest.round.length + forest.pine.length < 3600; i++) {
  const x = (R() - 0.5) * 2300, z = (R() - 0.5) * 2300
  if (Math.max(Math.abs(x), Math.abs(z)) < 312 || shoreDist(x, z) > ISLAND_R - 25) continue
  const y = heightAt(x, z)
  if (y < 1.2 || y > 95) continue
  if (Math.abs(heightAt(x + 5, z) - y) + Math.abs(heightAt(x, z + 5) - y) > 3.2) continue   // not on cliffs
  const list = y > 38 ? forest.pine : forest.round
  list.push({ x, y, z, s: 0.8 + R() * 1.1, rot: R() * 6.28, tint: R() })
}
for (let i = 0; i < 20000 && forest.palm.length < 420; i++) {            // palms on the beaches
  const x = (R() - 0.5) * 2300, z = (R() - 0.5) * 2300
  if (Math.max(Math.abs(x), Math.abs(z)) < 312 || shoreDist(x, z) < ISLAND_R - 130 || shoreDist(x, z) > ISLAND_R - 25) continue
  const y = heightAt(x, z)
  if (y < 0.5 || y > 4.5) continue
  forest.palm.push({ x, y, z, s: 0.9 + R() * 0.6, rot: R() * 6.28, tint: R() })
}
export function makeStreetTrees(buildings) {
  const Q = rng(21), palms = [], parks = []
  for (const L of LINES) for (let v = -290; v <= 290; v += 30) {
    if (Math.abs(v - Math.round(v / 100) * 100) < 14) continue
    for (const o of [-10.5, 10.5]) { palms.push([L + o, v], [v, L + o]) }
  }
  for (let i = 0; i < 260; i++) parks.push([(Q() - 0.5) * 580, (Q() - 0.5) * 580])
  const near = (a) => Math.abs(a - Math.round(a / 100) * 100) < 10
  const mk = ([x, z]) => ({ x, y: 0, z, s: 0.9 + Q() * 0.5, rot: Q() * 6.28, tint: Q() })
  return {
    palms: palms.filter(([x, z]) => Math.abs(x) < 295 && Math.abs(z) < 295).map(mk),
    parks: parks
      .filter(([x, z]) => !near(x) && !near(z))
      .filter(([x, z]) => !buildings.some((b) => Math.abs(x - b.x) < b.w / 2 + 3 && Math.abs(z - b.z) < b.d / 2 + 3))
      .filter(([x, z]) => !ZONES.some((q) => Math.hypot(q.marker[0] - x, q.marker[1] - z) < 9))
      .map(mk),
  }
}
export function Trees({ list, kind, low = false, shadow = true }) {
  const trunk = useRef(), crown = useRef()
  const [tg, cg] = useMemo(() => {
    if (kind === 'palm') {
      const t = new THREE.CylinderGeometry(0.22, 0.38, 11, 6).translate(0, 5.5, 0)
      const lv = []
      for (let k = 0; k < 8; k++) lv.push(new THREE.BoxGeometry(0.5, 0.08, 3.6).translate(0, 0, 1.8).rotateX(0.55).rotateY((k * Math.PI) / 4).translate(0, 11, 0))
      return [t, mergeGeometries(lv)]
    }
    if (kind === 'pine') {
      const t = new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6).translate(0, 1.1, 0)
      const c = mergeGeometries([
        new THREE.ConeGeometry(2.4, 4.5, 8).translate(0, 4.2, 0),
        new THREE.ConeGeometry(1.8, 4, 8).translate(0, 6.4, 0),
        new THREE.ConeGeometry(1.2, 3.5, 8).translate(0, 8.4, 0),
      ])
      return [t, c]
    }
    const t = new THREE.CylinderGeometry(0.3, 0.45, 3.8, 6).translate(0, 1.9, 0)
    const c = mergeGeometries([
      new THREE.IcosahedronGeometry(2.3, low ? 0 : 1).scale(1, 0.9, 1).translate(0, 5.2, 0),
      new THREE.IcosahedronGeometry(1.6, low ? 0 : 1).translate(1.3, 4.4, 0.7),
      new THREE.IcosahedronGeometry(1.5, low ? 0 : 1).translate(-1.2, 4.6, -0.8),
    ])
    return [t, c]
  }, [kind, low])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color()
    const base = kind === 'pine' ? '#2b6a52' : kind === 'palm' ? '#2f8a4a' : '#4f9f3f'
    list.forEach((t, i) => {
      q.setFromEuler(e.set(0, t.rot, 0))
      m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s, t.s, t.s))
      trunk.current.setMatrixAt(i, m); crown.current.setMatrixAt(i, m)
      c.set(base).offsetHSL((t.tint - 0.5) * 0.06, 0, (t.tint - 0.5) * 0.12)
      crown.current.setColorAt(i, c)
    })
    trunk.current.instanceMatrix.needsUpdate = true
    crown.current.instanceMatrix.needsUpdate = true
    crown.current.instanceColor.needsUpdate = true
  }, [list, kind])
  if (!list.length) return null
  return (
    <>
      <instancedMesh ref={trunk} args={[tg, null, list.length]} castShadow={shadow} frustumCulled={false}><meshStandardMaterial color={kind === 'palm' ? '#8b6a48' : '#5a4030'} roughness={1} /></instancedMesh>
      <instancedMesh ref={crown} args={[cg, null, list.length]} castShadow={shadow} receiveShadow={shadow} frustumCulled={false}><meshStandardMaterial roughness={0.9} flatShading side={kind === 'palm' ? THREE.DoubleSide : THREE.FrontSide} /></instancedMesh>
    </>
  )
}
export function Forest() {
  return (<><Trees list={forest.round} kind="round" low shadow={false} /><Trees list={forest.pine} kind="pine" shadow={false} /><Trees list={forest.palm} kind="palm" shadow={false} /></>)
}

// ---------- sun with shadows that follow the player ----------
export function Sun() {
  const l = useRef()
  useFrame(() => {
    const L = l.current
    L.position.set(carPos.x + SUN[0], (carPos.y || 0) + SUN[1], carPos.z + SUN[2])
    L.target.position.set(carPos.x, carPos.y || 0, carPos.z)
    L.target.updateMatrixWorld()
    if (atm.col) { L.color.copy(atm.col); L.intensity = atm.sunI }
  })
  return (
    <directionalLight ref={l} castShadow intensity={2.4} color="#ffb877" shadow-mapSize={LOW ? [1024, 1024] : [2048, 2048]}
      shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70}
      shadow-camera-near={1} shadow-camera-far={400} shadow-bias={-0.0004} />
  )
}

// ---------- city: roads, sidewalks, buildings, zone markers, lamps ----------
export function City({ buildings }) {
  const step = useGame((s) => s.step)   // chapters unlocked so far: locked = grey, current = pulsing, unlocked = full colour
  const base = useMemo(() => { const road = roadTex(), glow = roadGlowTex(); road.repeat.set(1, 600 / 16); glow.repeat.set(1, 600 / 16); return { d: windowTex(false), e: windowTex(true), road, glow } }, [])
  const neon = useMemo(() => {
    const G = { pink: [], cyan: [], violet: [] }, Q = rng(77), names = ['pink', 'cyan', 'pink', 'cyan', 'violet'], t = 0.35
    buildings.forEach((b) => {
      if (b.zone) return
      const k = names[(Q() * names.length) | 0], add = (w, h, d, x, y, z) => G[k].push(new THREE.BoxGeometry(w, h, d).translate(b.x + x, y, b.z + z))
      add(b.w + 0.4, t, t, 0, b.h + 0.2, b.d / 2 + 0.2); add(b.w + 0.4, t, t, 0, b.h + 0.2, -b.d / 2 - 0.2)
      add(t, t, b.d + 0.4, b.w / 2 + 0.2, b.h + 0.2, 0); add(t, t, b.d + 0.4, -b.w / 2 - 0.2, b.h + 0.2, 0)
      if (Q() < 0.7) { add(t, b.h * 0.7, t, b.w / 2 + 0.2, b.h * 0.45, b.d / 2 + 0.2); add(t, b.h * 0.7, t, -b.w / 2 - 0.2, b.h * 0.45, b.d / 2 + 0.2) }
      if (Q() < 0.5) add(b.w + 0.4, t, t, 0, b.h * (0.25 + Q() * 0.3), b.d / 2 + 0.2)
    })
    const col = { pink: [3.4, 0.5, 1.9], cyan: [0.4, 2.6, 3.2], violet: [1.9, 0.8, 3.4] }
    return Object.keys(G).filter((k) => G[k].length).map((k) => ({ k, geo: mergeGeometries(G[k]), color: new THREE.Color().setRGB(...col[k]) }))
  }, [buildings])
  const mats = useMemo(() => {
    const cache = new Map()
    return buildings.map((b) => {
      const rx = Math.max(1, Math.round(b.w / 12)), ry = Math.max(1, Math.round(b.h / 12)), k = rx + ',' + ry
      if (!cache.has(k)) {
        const d = base.d.clone(), e = base.e.clone()
        ;[d, e].forEach((t) => { t.repeat.set(rx, ry); t.needsUpdate = true })
        cache.set(k, { d, e })
      }
      return cache.get(k)
    })
  }, [buildings, base])

  const sw = useRef(), pole = useRef(), head = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    SIDEWALKS.forEach((s, i) => { m.compose(new THREE.Vector3(s.x, 0.1, s.z), q, new THREE.Vector3(s.sx, 1, s.sz)); sw.current.setMatrixAt(i, m) })
    LAMPS.forEach(([x, z], i) => { m.makeTranslation(x, 0, z); pole.current.setMatrixAt(i, m); head.current.setMatrixAt(i, m) })
    ;[sw, pole, head].forEach((r) => { r.current.instanceMatrix.needsUpdate = true })
  }, [])

  return (
    <group>
      {LINES.map((L) => (
        <group key={L}>
          <mesh rotation-x={-Math.PI / 2} position={[L, 0.03, 0]} receiveShadow><planeGeometry args={[14, 600]} /><meshStandardMaterial map={base.road} emissiveMap={base.glow} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.38} metalness={0.2} envMapIntensity={1.5} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.07, L]} receiveShadow><planeGeometry args={[14, 600]} /><meshStandardMaterial map={base.road} emissiveMap={base.glow} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.38} metalness={0.2} envMapIntensity={1.5} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} /></mesh>
        </group>
      ))}
      <instancedMesh ref={sw} args={[new THREE.BoxGeometry(1, 0.2, 1), null, SIDEWALKS.length]} receiveShadow frustumCulled={false}><meshStandardMaterial color="#bdaec4" roughness={0.9} /></instancedMesh>
      <instancedMesh ref={pole} args={[new THREE.CylinderGeometry(0.12, 0.16, 7, 6).translate(0, 3.5, 0), null, LAMPS.length]} frustumCulled={false}><meshStandardMaterial color="#2a2a2e" /></instancedMesh>
      <instancedMesh ref={head} args={[new THREE.BoxGeometry(1.2, 0.25, 0.5).translate(0, 7.1, 0), null, LAMPS.length]} frustumCulled={false}><meshStandardMaterial color="#fff2cc" emissive="#ffcf8a" emissiveIntensity={4} toneMapped={false} /></instancedMesh>

      {neon.map((n) => <mesh key={n.k} geometry={n.geo} frustumCulled={false}><meshBasicMaterial color={n.color} toneMapped={false} /></mesh>)}

      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh position-y={b.h / 2} castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} map={mats[i].d} emissive={b.zone && b.idx > step ? '#6b6f7a' : b.glow || '#ffc477'} emissiveMap={mats[i].e} emissiveIntensity={b.zone ? (b.idx > step ? 0.5 : 1.6) : 1.1} roughness={0.55} metalness={0.25} />
          </mesh>
          {b.zone && <Text position={[0, b.h + 3, 0]} fontSize={3.5} color={b.idx > step ? '#8a8d96' : b.glow} outlineWidth={0.12} outlineColor="#000">{b.zone.title}</Text>}
        </group>
      ))}
      {ZONES.map((z, i) => {
        const col = i > step ? '#666a75' : z.color, now = i === step
        return (
          <group key={z.id} position={[z.marker[0], 0.12, z.marker[1]]}>
            <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[4, 5, 40]} /><meshBasicMaterial color={col} /></mesh>
            <mesh position-y={now ? 20 : 4}><cylinderGeometry args={[4.5, 4.5, now ? 40 : 8, 24, 1, true]} /><meshBasicMaterial color={col} transparent opacity={now ? 0.28 : 0.1} depthWrite={false} /></mesh>
          </group>
        )
      })}
    </group>
  )
}
