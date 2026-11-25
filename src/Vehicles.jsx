import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { LINES, traffic } from './shared'
import { useGame, CAR_COLORS } from './store'
import { rng } from './terrain'

// side profile [z (length), y (height)] -> extruded across the width, length along +Z (front = +Z)
function extrude(pts, width) {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false })
  g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2)
  return g
}

// ---------- fallback car (original procedural wedge) shown while the Ferrari model is still loading ----------
function ProceduralCar() {
  const colorIdx = useGame((s) => s.colorIdx)
  const paint = CAR_COLORS[colorIdx], accent = useMemo(() => '#' + new THREE.Color(paint).multiplyScalar(0.55).getHexString(), [paint])
  const body = useMemo(() => extrude([[2.35, 0.45], [2.35, 0.78], [1.3, 0.95], [0.45, 1.08], [-0.3, 1.38], [-1.0, 1.38], [-1.7, 1.02], [-2.3, 0.98], [-2.3, 0.45]], 2), [])
  const sideGlass = useMemo(() => {
    const s = new THREE.Shape(); [[0.35, 1.1], [-0.25, 1.34], [-1.0, 1.34], [-1.45, 1.04]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
    return new THREE.ShapeGeometry(s).rotateY(-Math.PI / 2)
  }, [])
  const white = <meshPhysicalMaterial color={paint} clearcoat={1} clearcoatRoughness={0.08} roughness={0.3} metalness={0.25} envMapIntensity={1.6} />
  const red = <meshStandardMaterial color={accent} roughness={0.4} metalness={0.2} />
  const glass = <meshStandardMaterial color="#10151c" metalness={0.9} roughness={0.1} side={THREE.DoubleSide} />
  const dark = <meshStandardMaterial color="#111114" roughness={0.8} />
  return (
    <group>
      <mesh position={[0, 0.1, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[2.5, 5.2]} /><meshBasicMaterial color={new THREE.Color().setRGB(3.4, 0.5, 1.9)} transparent opacity={0.5} depthWrite={false} /></mesh>
      <pointLight position={[0, 0.5, 0]} color="#ff3fa0" intensity={9} distance={13} decay={2} />
      <mesh geometry={body}>{white}</mesh>
      <mesh position={[0, 0.36, 0]}><boxGeometry args={[1.9, 0.18, 4.4]} />{dark}</mesh>
      <mesh position={[0, 0.6, 0]}><boxGeometry args={[2.02, 0.16, 4.5]} />{red}</mesh>
      <mesh position={[0, 1.245, 0.075]} rotation-x={0.38}><boxGeometry args={[1.7, 0.03, 0.8]} />{glass}</mesh>
      <mesh position={[0, 1.2, -1.35]} rotation-x={-0.475}><boxGeometry args={[1.7, 0.03, 0.78]} />{glass}</mesh>
      <mesh geometry={sideGlass} position-x={1.006}>{glass}</mesh>
      <mesh geometry={sideGlass} position-x={-1.006}>{glass}</mesh>
      {[-0.25, 0.25].map((x) => (<mesh key={x} position={[x, 0.875, 1.78]} rotation-x={0.17}><boxGeometry args={[0.13, 0.012, 1.3]} />{red}</mesh>))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 1.012, 0.85, -1.2]}><boxGeometry args={[0.04, 0.3, 1.0]} />{dark}</mesh>
          <mesh position={[s * 1.06, 1.1, 0.4]}><boxGeometry args={[0.18, 0.12, 0.1]} />{white}</mesh>
          <mesh position={[s * 0.62, 0.66, 2.36]}><boxGeometry args={[0.45, 0.08, 0.02]} /><meshStandardMaterial color="#fff3c8" emissive="#fff3c8" emissiveIntensity={3} toneMapped={false} /></mesh>
          <mesh position={[s * 0.86, 0.52, 2.36]}><boxGeometry args={[0.2, 0.1, 0.02]} /><meshStandardMaterial color="#ffb400" emissive="#ffb400" emissiveIntensity={2.5} toneMapped={false} /></mesh>
          {[1.45, -1.45].map((z) => (
            <group key={z} position={[s * 0.97, 0.37, z]} rotation-z={Math.PI / 2}>
              <mesh><cylinderGeometry args={[0.37, 0.37, z < 0 ? 0.36 : 0.3, 20]} /><meshStandardMaterial color="#0d0d0f" roughness={0.9} /></mesh>
              <mesh position-y={s * 0.03}><cylinderGeometry args={[0.24, 0.24, z < 0 ? 0.38 : 0.32, 16]} /><meshStandardMaterial color="#c9ccd2" metalness={1} roughness={0.25} /></mesh>
            </group>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.55, 2.36]}><boxGeometry args={[0.7, 0.12, 0.02]} />{dark}</mesh>
      <mesh position={[0, 0.9, -2.31]}><boxGeometry args={[1.9, 0.12, 0.03]} /><meshStandardMaterial color="#ff2030" emissive="#ff1020" emissiveIntensity={2.5} toneMapped={false} /></mesh>
    </group>
  )
}

// ================= HERO CAR: Ferrari Daytona SP3 (public/models/ferrari.glb) =================
// The original 177 MB / 2.2M-triangle model was converted for the web: interior + engine removed, ~74k triangles, 1.8 MB.
// Its body paint is the material called PAINT, so the PAINTJOB / GOLDRUSH cheats can recolour it.
function FerrariModel() {
  const { scene } = useGLTF('/models/ferrari.glb')
  const colorIdx = useGame((s) => s.colorIdx), gold = useGame((s) => s.gold), phantom = useGame((s) => s.phantom)
  const model = useMemo(() => scene.clone(true), [scene])
  const mats = useMemo(() => {
    const paint = [], all = new Set()
    model.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { all.add(m); if (m.name === 'PAINT') paint.push(m) })
    })
    return { paint, all: [...all] }
  }, [model])
  useEffect(() => {
    const col = gold ? '#ffc933' : CAR_COLORS[colorIdx]
    mats.paint.forEach((m) => { m.color.set(col); m.metalness = gold ? 1 : 0.4; m.roughness = gold ? 0.18 : 0.26; m.envMapIntensity = 1.7; m.needsUpdate = true })
  }, [colorIdx, gold, mats])
  useEffect(() => {   // PHANTOM cheat: see-through ghost car
    mats.all.forEach((m) => {
      if (m.userData.t0 === undefined) { m.userData.t0 = m.transparent; m.userData.o0 = m.opacity }
      m.transparent = phantom ? true : m.userData.t0; m.opacity = phantom ? Math.min(0.35, m.userData.o0) : m.userData.o0; m.needsUpdate = true
    })
  }, [phantom, mats])
  const paint = CAR_COLORS[colorIdx]
  return (
    <group>
      <mesh position={[0, 0.1, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[2.5, 5.2]} /><meshBasicMaterial color={gold ? new THREE.Color('#ffcf50') : new THREE.Color().setRGB(3.4, 0.5, 1.9)} transparent opacity={0.45} depthWrite={false} toneMapped={false} /></mesh>
      <pointLight position={[0, 0.5, 0]} color={gold ? '#ffcf50' : '#ff3fa0'} intensity={9} distance={13} decay={2} />
      <primitive object={model} />
    </group>
  )
}
export function SportsCar() {
  return <Suspense fallback={<ProceduralCar />}><FerrariModel /></Suspense>
}
useGLTF.preload('/models/ferrari.glb')

// ================= AI TRAFFIC: Jaguar Mk2 + VW Teramont (instanced, 2 GLB models) =================
const FLEET = ['/models/jaguar.glb', '/models/teramont.glb']
const PALETTE = ['#e63946', '#f1faee', '#ffd166', '#06d6a0', '#118ab2', '#ff7b9c', '#c77dff', '#2b2d42', '#f4a261', '#8d99ae', '#1d3557', '#9b2226']
const _d = new THREE.Object3D()

export function Traffic({ count = 40 }) {
  const cars = useMemo(() => {
    const Q = rng(33)
    return Array.from({ length: count }, (_, i) => ({ gid: i, model: i % FLEET.length, axis: Q() < 0.5 ? 'x' : 'z', L: LINES[(Q() * 5) | 0], dir: Q() < 0.5 ? 1 : -1, t: (Q() - 0.5) * 580, speed: 9 + Q() * 7, x: 0, z: 0, color: PALETTE[(Q() * PALETTE.length) | 0] }))
  }, [count])
  useEffect(() => () => { traffic.length = 0 }, [])
  return (
    <>
      {FLEET.map((url, mi) => (
        <Suspense key={url} fallback={null}><Fleet url={url} cars={cars.filter((c) => c.model === mi)} /></Suspense>
      ))}
    </>
  )
}

function Fleet({ url, cars }) {
  const { scene } = useGLTF(url)
  const refs = useRef([])
  const parts = useMemo(() => {
    // the compressed GLB stores each part's real size in its node (mesh quantisation) -> bake node matrices into float geometry for instancing
    scene.updateMatrixWorld(true)
    const out = [], v = new THREE.Vector3(), nm = new THREE.Matrix3()
    scene.traverse((o) => {
      if (!o.isMesh) return
      const g = o.geometry, p = g.attributes.position, n = g.attributes.normal
      nm.getNormalMatrix(o.matrixWorld)
      const pos = new Float32Array(p.count * 3), nor = new Float32Array(p.count * 3)
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); pos.set([v.x, v.y, v.z], i * 3)
        if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], i * 3) }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); if (n) geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
      geo.setIndex(g.index); geo.computeBoundingSphere()
      out.push({ geo, mat: o.material, paint: o.material.name === 'PAINT' })
    })
    return out
  }, [scene])
  useLayoutEffect(() => {
    const c = new THREE.Color()
    parts.forEach((p, pi) => {
      const m = refs.current[pi]
      if (!m || !p.paint) return
      cars.forEach((k, i) => m.setColorAt(i, c.set(k.color)))
      m.instanceColor.needsUpdate = true
    })
  }, [parts, cars])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * (useGame.getState().slow ? 0.35 : 1)
    cars.forEach((c, i) => {
      c.t += c.dir * c.speed * dt
      if (c.t > 295) c.t = -295; else if (c.t < -295) c.t = 295
      const h = c.axis === 'z' ? (c.dir > 0 ? 0 : Math.PI) : c.dir > 0 ? Math.PI / 2 : -Math.PI / 2
      const bx = c.axis === 'z' ? c.L : c.t, bz = c.axis === 'z' ? c.t : c.L
      c.x = bx - Math.cos(h) * 3.5; c.z = bz + Math.sin(h) * 3.5 // right-hand traffic
      _d.position.set(c.x, 0, c.z); _d.rotation.set(0, h, 0); _d.updateMatrix()
      for (let pi = 0; pi < parts.length; pi++) if (refs.current[pi]) refs.current[pi].setMatrixAt(i, _d.matrix)
      traffic[c.gid] = c
    })
    for (let pi = 0; pi < parts.length; pi++) if (refs.current[pi]) refs.current[pi].instanceMatrix.needsUpdate = true
  })
  return (
    <>
      {parts.map((p, pi) => (
        <instancedMesh key={pi} ref={(el) => (refs.current[pi] = el)} args={[p.geo, p.mat, cars.length]} castShadow={p.paint} frustumCulled={false} />
      ))}
    </>
  )
}
useGLTF.preload('/models/jaguar.glb'); useGLTF.preload('/models/teramont.glb')
