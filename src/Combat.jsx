import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useGame } from './store'
import { fxq, cops } from './shared'
import { rockets } from './weapons'
import { groundAt } from './terrain'

// =====================================================================
//  Combat visuals: bullet tracers, muzzle flash light, impact sparks, explosions, rockets,
//  the weapon in the hero's hands, and the POLICE CARS (the Jaguar model painted white with a flashing light bar).
// =====================================================================
const NT = 32, NI = 48
const V = THREE.Vector3

export function Combat() {
  const tg = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 6), 3)); return g }, [])
  const ig = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NI * 3), 3)); return g }, [])
  const S = useRef({ tr: Array.from({ length: NT }, () => ({ life: 0, a: new V(), b: new V() })), im: Array.from({ length: NI }, () => ({ life: 0, p: new V() })), ti: 0, ii: 0, bi: 0, flash: 0, booms: Array.from({ length: 4 }, () => ({ life: 0, p: new V() })) })
  const light = useRef(), bm = useRef([]), rk = useRef([])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05), s = S.current
    while (fxq.length) {
      const f = fxq.shift()
      if (f.type === 'tracer') { const t = s.tr[s.ti++ % NT]; t.life = 0.07; t.a.copy(f.a); t.b.copy(f.b) }
      else if (f.type === 'impact') { const t = s.im[s.ii++ % NI]; t.life = 0.35; t.p.copy(f.p) }
      else if (f.type === 'flash') { s.flash = 1; light.current.position.copy(f.p) }
      else if (f.type === 'boom') { const b = s.booms[s.bi++ % 4]; b.life = 0.7; b.p.copy(f.p); s.flash = 2; light.current.position.copy(f.p) }
    }
    const ta = tg.attributes.position.array
    s.tr.forEach((t, i) => {
      if (t.life > 0) { t.life -= dt; ta.set([t.a.x, t.a.y, t.a.z, t.b.x, t.b.y, t.b.z], i * 6) } else ta.fill(0, i * 6, i * 6 + 6)
    })
    tg.attributes.position.needsUpdate = true
    const ia = ig.attributes.position.array
    s.im.forEach((t, i) => { if (t.life > 0) { t.life -= dt; ia.set([t.p.x, t.p.y, t.p.z], i * 3) } else ia.fill(0, i * 3, i * 3 + 3) })
    ig.attributes.position.needsUpdate = true
    s.flash = Math.max(0, s.flash - dt * 14); light.current.intensity = s.flash * 14
    s.booms.forEach((b, i) => {
      const m = bm.current[i]; if (!m) return
      if (b.life > 0) { b.life -= dt; m.visible = true; m.position.copy(b.p); const k = 1 - b.life / 0.7; m.scale.setScalar(1 + k * 10); m.material.opacity = Math.max(0, b.life / 0.7) * 0.85 } else m.visible = false
    })
    for (let i = 0; i < 3; i++) { const m = rk.current[i], r = rockets[i]; if (!m) continue; m.visible = !!r; if (r) m.position.copy(r.p) }
  })
  return (
    <>
      <lineSegments geometry={tg} frustumCulled={false}><lineBasicMaterial color="#ffe9a8" transparent opacity={0.9} depthWrite={false} toneMapped={false} /></lineSegments>
      <points geometry={ig} frustumCulled={false}><pointsMaterial color="#ffb84d" size={0.45} transparent opacity={0.95} depthWrite={false} toneMapped={false} sizeAttenuation /></points>
      <pointLight ref={light} color="#ffb060" intensity={0} distance={40} decay={2} />
      {[0, 1, 2, 3].map((i) => <mesh key={i} ref={(el) => (bm.current[i] = el)} visible={false}><sphereGeometry args={[1, 16, 12]} /><meshBasicMaterial color="#ff9a3c" transparent opacity={0.8} depthWrite={false} toneMapped={false} /></mesh>)}
      {[0, 1, 2].map((i) => <mesh key={i} ref={(el) => (rk.current[i] = el)} visible={false}><sphereGeometry args={[0.28, 10, 8]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} /></mesh>)}
    </>
  )
}

// weapon in the right hand (the arm is raised in People.jsx while armed); barrel points along +Z
export function HeldWeapon() {
  const weapon = useGame((s) => s.weapon), mode = useGame((s) => s.mode)
  if (!weapon || mode === 'car') return null
  const dark = <meshStandardMaterial color="#1b1c20" metalness={0.7} roughness={0.4} />
  const wood = <meshStandardMaterial color="#6a4a2a" roughness={0.8} />
  return (
    <group position={[-0.2, 1.4, 0.62]}>
      {weapon === 1 && <><mesh position={[0, -0.05, -0.02]} rotation-x={0.25}><boxGeometry args={[0.05, 0.13, 0.07]} />{dark}</mesh><mesh position={[0, 0.02, 0.1]}><boxGeometry args={[0.05, 0.06, 0.28]} />{dark}</mesh></>}
      {weapon === 2 && <><mesh position={[0, 0, 0.08]}><boxGeometry args={[0.06, 0.1, 0.42]} />{dark}</mesh><mesh position={[0, -0.12, 0.1]}><boxGeometry args={[0.04, 0.16, 0.07]} />{dark}</mesh><mesh position={[0, 0, -0.18]}><boxGeometry args={[0.05, 0.08, 0.14]} />{dark}</mesh></>}
      {weapon === 3 && <><mesh position={[0, 0.01, 0.28]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.028, 0.028, 0.8, 8]} />{dark}</mesh><mesh position={[0, -0.01, -0.1]}><boxGeometry args={[0.06, 0.09, 0.3]} />{wood}</mesh></>}
      {weapon === 4 && <><mesh position={[0, 0.06, 0.15]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.085, 0.085, 0.95, 12]} /><meshStandardMaterial color="#3d4a3a" roughness={0.6} /></mesh><mesh position={[0, 0.06, 0.66]} rotation-x={Math.PI / 2}><coneGeometry args={[0.09, 0.2, 12]} />{dark}</mesh></>}
    </group>
  )
}

// police cars: the Jaguar model, painted white, flashing red / blue light bar
function PoliceCars({ count = 5 }) {
  const { scene } = useGLTF('/models/jaguar.glb')
  const cars = useMemo(() => {
    const box = new THREE.BoxGeometry(0.55, 0.14, 0.3)
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1830').multiplyScalar(3), toneMapped: false })
    const blue = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a60ff').multiplyScalar(3), toneMapped: false })
    return Array.from({ length: count }, () => {
      const m = scene.clone(true), paints = []
      m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.castShadow = o.material.name === 'PAINT'; if (o.material.name === 'PAINT') paints.push(o.material) } })
      const g = new THREE.Group(); g.add(m)
      const r = new THREE.Mesh(box, red), b = new THREE.Mesh(box, blue)
      r.position.set(-0.32, 1.52, -0.2); b.position.set(0.32, 1.52, -0.2); g.add(r, b)
      g.visible = false
      return { g, paints, r, b }
    })
  }, [scene, count])
  useFrame(({ clock }) => {
    const on = Math.floor(clock.elapsedTime * 7) % 2 === 0
    cars.forEach((c, i) => {
      const k = cops[i]
      c.g.visible = !!k
      if (!k) return
      c.g.position.set(k.x, groundAt(k.x, k.z), k.z); c.g.rotation.y = k.h
      const dead = k.dead > 0
      c.paints.forEach((m) => m.color.set(dead ? '#26262a' : k.hp < 45 ? '#b8b8bc' : '#f4f4f6'))
      c.r.visible = !dead && on; c.b.visible = !dead && !on
    })
  })
  return <>{cars.map((c, i) => <primitive key={i} object={c.g} />)}</>
}
export function Police() { return <Suspense fallback={null}><PoliceCars /></Suspense> }
