import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { LINES, carPos, crowd } from './shared'
import { rng } from './terrain'
import { LOW } from './device'

// =====================================================================
//  REAL 3D CHARACTERS  (Microsoft Rocketbox avatars, MIT licence - see public/models/LICENSE-Rocketbox.txt)
//    public/models/hero.glb   = Business_Male_04        -> the PLAYER
//    public/models/crowd.glb  = Construction_Female_01  -> the PEDESTRIAN CROWD
//  These files contain a skeleton but NO animation clips, so walking / running is
//  driven procedurally in code (see buildRig / poseRig below). If you later drop in a
//  model that DOES have clips named "idle" / "walk" / "run", they are used automatically.
//  If a .glb file is missing, the built-in stylized hero / instanced crowd is used instead.
// =====================================================================
const HERO_URL = '/models/hero.glb'
const CROWD_URL = '/models/crowd.glb'

// ---- tweak here ----
const HERO_SCALE = 1.04        // Business_Male_04 is ~1.75 m tall
const CROWD_COUNT = LOW ? 24 : 48         // how many animated people exist around the player
const CROWD_RANGE = 90         // they live within this many units of the player (recycled as you move)
const ARM_DOWN = 0.62          // rad: lowers the arms from the model's A-pose to hang at the sides

function useAssetExists(url) {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    let live = true
    fetch(url, { method: 'HEAD' })
      .then((r) => live && setOk(r.ok && !(r.headers.get('content-type') || '').includes('text/html')))
      .catch(() => {})
    return () => { live = false }
  }, [url])
  return ok
}

// ---------- procedural walk / run for a Biped ("Bip01 ...") skeleton ----------
const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1)
const ORDER = ['LThigh', 'RThigh', 'LCalf', 'RCalf', 'LFoot', 'RFoot', 'LUpperArm', 'RUpperArm', 'LForearm', 'RForearm']
// "Bip01 L Thigh" / "Bip01_L_Thigh" -> "LThigh"
const normName = (n) => n.replace(/^Bip01[\s_]+/, '').replace(/[\s_]+/g, '')

function buildRig(root) {
  // rest-pose world rotation of every node, relative to the model root (model faces +Z, Y up)
  const W = new Map()
  root.traverse((o) => {
    const p = W.get(o.parent)
    W.set(o, p && o !== root ? p.clone().multiply(o.quaternion) : new THREE.Quaternion())
  })
  const bones = {}
  root.traverse((o) => { if (o.isBone) bones[normName(o.name)] = o })
  const entries = []
  ORDER.forEach((key) => {
    const b = bones[key]
    if (!b) return
    const pk = normName(b.parent ? b.parent.name : '')
    entries.push({ key, bone: b, restL: b.quaternion.clone(), pW: W.get(b.parent).clone(), pk: ORDER.includes(pk) ? pk : null, cur: new THREE.Quaternion() })
  })
  return { entries, by: Object.fromEntries(entries.map((e) => [e.key, e])), a: new THREE.Quaternion(), b: new THREE.Quaternion() }
}

// ph = gait phase, k = how much we move (0 idle .. 1 full walk), run = 0 walk .. 1 sprint, t = time (idle sway)
// returns the vertical offset (hip drop) so the feet stay on the ground
function poseRig(rig, ph, k, run, t, aim = 0) {
  const A = (0.5 + 0.35 * run) * k, sw = Math.sin(ph) * A, cs = Math.cos(ph), knee = (0.8 + 0.5 * run) * k
  const idle = Math.sin(t * 1.6) * 0.02
  const ang = { LThigh: -sw, RThigh: sw, LCalf: Math.max(0, cs) * knee, RCalf: Math.max(0, -cs) * knee, LUpperArm: sw * 0.9 + idle, RUpperArm: -sw * 0.9 - idle }
  ang.LFoot = -(ang.LThigh + ang.LCalf); ang.RFoot = -(ang.RThigh + ang.RCalf)      // keep feet flat
  ang.LForearm = -(0.15 + 0.25 * run * k + Math.max(0, -ang.LUpperArm) * 0.7)
  ang.RForearm = -(0.15 + 0.25 * run * k + Math.max(0, -ang.RUpperArm) * 0.7)
  if (aim > 0) {   // armed: raise the right arm (and the support hand) forward, like holding a gun
    ang.RUpperArm += (-1.42 - ang.RUpperArm) * aim; ang.RForearm += (-0.06 - ang.RForearm) * aim
    ang.LUpperArm += (-1.0 - ang.LUpperArm) * aim * 0.8; ang.LForearm += (-0.5 - ang.LForearm) * aim * 0.8
  }
  for (const e of rig.entries) {
    const lz = e.key === 'LUpperArm' ? -ARM_DOWN : e.key === 'RUpperArm' ? ARM_DOWN : 0
    rig.a.setFromAxisAngle(AX, ang[e.key] || 0)                                    // world-space delta rotation
    if (lz) rig.a.multiply(rig.b.setFromAxisAngle(AZ, lz))
    const P = e.pk ? rig.by[e.pk].cur : e.pW                                        // parent's current world rotation
    e.cur.copy(rig.a).multiply(P).multiply(e.restL)
    e.bone.quaternion.copy(P).invert().multiply(rig.a).multiply(P).multiply(e.restL) // back to a local rotation
  }
  return -0.8 * (1 - Math.cos(sw))
}

const prepMeshes = (root, shadow) => root.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.frustumCulled = false } })

// ---------- playable hero ----------
export function Character({ speedRef, aimRef }) {
  const glb = useAssetExists(HERO_URL)
  const fallback = <StylizedHero speedRef={speedRef} />
  return glb ? <Suspense fallback={fallback}><GlbHero speedRef={speedRef} aimRef={aimRef} /></Suspense> : fallback
}

function GlbHero({ speedRef, aimRef }) {
  const { scene, animations } = useGLTF(HERO_URL)
  const model = useMemo(() => cloneSkinned(scene), [scene])
  const rig = useMemo(() => (animations.length ? null : buildRig(model)), [model, animations])
  const group = useRef(), lean = useRef(), want = useRef(''), act = useRef(null), ph = useRef(0)
  const { actions } = useAnimations(animations, group)
  useEffect(() => { prepMeshes(model, true) }, [model])
  useFrame((state, dt) => {
    const sp = speedRef.current
    if (rig) {
      const moving = sp > 0.15
      if (moving) ph.current += Math.min(dt, 0.05) * (1.8 * sp + 1.2)
      const k = Math.min(sp / 3.4, 1), run = Math.min(Math.max((sp - 3.4) / 4.1, 0), 1)
      const y = poseRig(rig, ph.current, moving ? k : 0, run, state.clock.elapsedTime, aimRef ? aimRef.current : 0)
      lean.current.position.y = y
      lean.current.rotation.x += (run * 0.14 - lean.current.rotation.x) * Math.min(1, 8 * dt)   // lean into the sprint
      return
    }
    const w = sp > 5 ? 'run' : sp > 0.3 ? 'walk' : 'idle'
    if (want.current === w) return
    want.current = w
    const name = Object.keys(actions).find((n) => n.toLowerCase().includes(w))
    if (!name) return
    const next = actions[name]
    next.reset().fadeIn(0.25).play()
    if (act.current && act.current !== next) act.current.fadeOut(0.25)
    act.current = next
  })
  return <group ref={group} scale={HERO_SCALE}><group ref={lean}><primitive object={model} /></group></group>
}

// Stylized hero: long wavy hair, moustache + goatee, white blazer over a dark open-collar shirt
function StylizedHero({ speedRef }) {
  const l1 = useRef(), l2 = useRef(), a1 = useRef(), a2 = useRef(), body = useRef(), ph = useRef(0)
  useFrame((_, dt) => {
    const sp = speedRef.current, k = Math.min(sp / 3, 1)
    ph.current += dt * (2 + sp * 1.4)
    const a = Math.sin(ph.current) * k * 0.8
    l1.current.rotation.x = a; l2.current.rotation.x = -a
    a1.current.rotation.x = -a; a2.current.rotation.x = a
    body.current.position.y = Math.abs(Math.cos(ph.current)) * 0.05 * k
  })
  const skin = <meshStandardMaterial color="#c58f6b" roughness={0.75} />
  const blazer = <meshStandardMaterial color="#ebe8e0" roughness={0.85} />
  const shirt = <meshStandardMaterial color="#262c3a" roughness={0.8} />
  const hairM = <meshStandardMaterial color="#6a5240" roughness={0.9} />
  const beard = <meshStandardMaterial color="#2c2018" roughness={1} />
  const trousers = <meshStandardMaterial color="#ddd6c8" roughness={0.85} />
  return (
    <group ref={body}>
      {/* torso: dark shirt, white open blazer, lapels */}
      <mesh position-y={1.2}><boxGeometry args={[0.5, 0.64, 0.26]} />{shirt}</mesh>
      <mesh position={[0, 1.2, -0.03]}><boxGeometry args={[0.58, 0.68, 0.3]} />{blazer}</mesh>
      <mesh position={[0, 1.24, 0.125]}><boxGeometry args={[0.16, 0.56, 0.03]} />{shirt}</mesh>
      {[-1, 1].map((s) => (<mesh key={s} position={[s * 0.13, 1.28, 0.13]} rotation-z={-s * 0.22}><boxGeometry args={[0.1, 0.46, 0.03]} />{blazer}</mesh>))}
      <mesh position={[0, 0.9, -0.03]}><boxGeometry args={[0.6, 0.2, 0.32]} />{blazer}</mesh>
      {/* neck + head */}
      <mesh position-y={1.6}><cylinderGeometry args={[0.06, 0.07, 0.12, 10]} />{skin}</mesh>
      <mesh position-y={1.74} scale={[0.95, 1.15, 1]}><sphereGeometry args={[0.15, 18, 14]} />{skin}</mesh>
      <mesh position={[0, 1.72, 0.15]} rotation-x={0.3}><boxGeometry args={[0.04, 0.09, 0.05]} />{skin}</mesh>
      <mesh position={[0, 1.785, 0.135]}><boxGeometry args={[0.2, 0.02, 0.03]} />{beard}</mesh>
      {[-1, 1].map((s) => (<mesh key={s} position={[s * 0.052, 1.765, 0.14]}><sphereGeometry args={[0.014, 8, 8]} /><meshStandardMaterial color="#1b2a3a" /></mesh>))}
      <mesh position={[0, 1.685, 0.145]}><boxGeometry args={[0.11, 0.025, 0.03]} />{beard}</mesh>
      <mesh position={[0, 1.64, 0.135]}><boxGeometry args={[0.07, 0.07, 0.03]} />{beard}</mesh>
      {/* long wavy hair */}
      <mesh position={[0, 1.82, -0.015]} scale={[1, 0.9, 1.05]}><sphereGeometry args={[0.165, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />{hairM}</mesh>
      <mesh position={[0, 1.62, -0.1]} rotation-x={0.08}><boxGeometry args={[0.3, 0.42, 0.09]} />{hairM}</mesh>
      {[-1, 1].map((s) => (<mesh key={s} position={[s * 0.15, 1.64, -0.02]} rotation-z={s * 0.06}><capsuleGeometry args={[0.04, 0.28, 4, 8]} />{hairM}</mesh>))}
      {/* legs + loafers */}
      {[[l1, -1], [l2, 1]].map(([r, s]) => (
        <group key={s} ref={r} position={[s * 0.12, 0.88, 0]}>
          <mesh position-y={-0.43}><capsuleGeometry args={[0.085, 0.7, 4, 10]} />{trousers}</mesh>
          <mesh position={[0, -0.88, 0.06]}><boxGeometry args={[0.17, 0.08, 0.32]} /><meshStandardMaterial color="#3a2a22" roughness={0.5} /></mesh>
        </group>
      ))}
      {/* arms: blazer sleeves + hands */}
      {[[a1, -1], [a2, 1]].map(([r, s]) => (
        <group key={s} ref={r} position={[s * 0.36, 1.5, 0]}>
          <mesh position-y={-0.3}><capsuleGeometry args={[0.07, 0.5, 4, 10]} />{blazer}</mesh>
          <mesh position-y={-0.66}><sphereGeometry args={[0.065, 10, 8]} />{skin}</mesh>
        </group>
      ))}
    </group>
  )
}

// ---------- crowd: instanced pedestrians walking the sidewalks ----------
const SHIRTS = ['#ff6fa3', '#4dc9ff', '#ffd24d', '#7dff6b', '#ffffff', '#c77dff', '#ff8a4d', '#222831', '#e63946']
const SKINS = ['#f1c9a5', '#e0ac86', '#c68642', '#8d5524', '#5c3a21']
const PANTS = ['#1f2a44', '#222222', '#f4f1ea', '#6b4f3a', '#3a5a40', '#7a1f3d']

function InstancedCrowd({ count = 170 }) {
  const torso = useRef(), head = useRef(), legs = useRef()
  const geo = useMemo(() => ({
    t: new THREE.BoxGeometry(0.55, 0.62, 0.28).translate(0, 1.2, 0),
    h: new THREE.SphereGeometry(0.14, 8, 8).translate(0, 1.68, 0),
    l: new THREE.BoxGeometry(0.17, 0.9, 0.2).translate(0, -0.45, 0),
  }), [])
  const peds = useMemo(() => {
    const Q = rng(99), pick = (a) => a[(Q() * a.length) | 0]
    return Array.from({ length: count }, () => ({
      axis: Q() < 0.5 ? 'x' : 'z', L: LINES[(Q() * 5) | 0], dir: Q() < 0.5 ? 1 : -1, t: (Q() - 0.5) * 580,
      off: (Q() < 0.5 ? -1 : 1) * (8.5 + (Q() - 0.5) * 1.4), speed: 1.1 + Q() * 0.6, ph: Q() * 6.28,
      shirt: pick(SHIRTS), skin: pick(SKINS), pants: pick(PANTS),
    }))
  }, [count])
  useLayoutEffect(() => {
    const c = new THREE.Color()
    peds.forEach((p, i) => {
      torso.current.setColorAt(i, c.set(p.shirt)); head.current.setColorAt(i, c.set(p.skin))
      legs.current.setColorAt(2 * i, c.set(p.pants)); legs.current.setColorAt(2 * i + 1, c)
    })
    ;[torso, head, legs].forEach((r) => { r.current.instanceColor.needsUpdate = true })
  }, [peds])

  const tmp = useMemo(() => ({ base: new THREE.Matrix4(), t: new THREE.Matrix4(), r: new THREE.Matrix4(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1) }), [])
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05), time = state.clock.elapsedTime, { base, t, r, m, q, e, v, one } = tmp
    peds.forEach((p, i) => {
      p.t += p.dir * p.speed * dt
      if (p.t > 295) p.t = -295; else if (p.t < -295) p.t = 295
      const yaw = p.axis === 'z' ? (p.dir > 0 ? 0 : Math.PI) : p.dir > 0 ? Math.PI / 2 : -Math.PI / 2
      const x = p.axis === 'z' ? p.L + p.off : p.t, z = p.axis === 'z' ? p.t : p.L + p.off
      base.compose(v.set(x, 0, z), q.setFromEuler(e.set(0, yaw, 0)), one)
      torso.current.setMatrixAt(i, base); head.current.setMatrixAt(i, base)
      const a = Math.sin(time * 5 * p.speed + p.ph) * 0.7
      for (const s of [-1, 1]) {
        t.makeTranslation(s * 0.13, 0.9, 0); r.makeRotationX(a * s)
        m.copy(base).multiply(t).multiply(r)
        legs.current.setMatrixAt(2 * i + (s > 0 ? 1 : 0), m)
      }
    })
    ;[torso, head, legs].forEach((rf) => { rf.current.instanceMatrix.needsUpdate = true })
  })
  return (
    <>
      <instancedMesh ref={torso} args={[geo.t, null, count]} frustumCulled={false}><meshStandardMaterial roughness={0.8} /></instancedMesh>
      <instancedMesh ref={head} args={[geo.h, null, count]} frustumCulled={false}><meshStandardMaterial roughness={0.8} /></instancedMesh>
      <instancedMesh ref={legs} args={[geo.l, null, count * 2]} frustumCulled={false}><meshStandardMaterial roughness={0.9} /></instancedMesh>
    </>
  )
}

// ---------- crowd: real animated people (crowd.glb) walking the sidewalks around the player ----------
// A pool of walkers is kept near the player: anybody who drifts out of range is moved to a sidewalk
// at the edge of the range, so the streets always feel busy without simulating the whole map.
function GlbCrowd({ count = CROWD_COUNT, range = CROWD_RANGE }) {
  const { scene } = useGLTF(CROWD_URL)
  const peds = useMemo(() => {
    const Q = rng(99)
    const list = Array.from({ length: count }, () => {
      const model = cloneSkinned(scene)
      prepMeshes(model, true)
      const group = new THREE.Group()
      group.rotation.order = 'YXZ'      // heading first, then fall over (police case: hit pedestrians fall down)
      group.add(model)
      group.scale.setScalar(0.95 + Q() * 0.1)
      return { group, model, rig: buildRig(model), axis: 'x', L: 0, dir: 1, t: 1e4, off: 9, speed: 1.3 + Q() * 0.7, ph: Q() * 6.28, spawned: false, x: 1e5, z: 1e5, down: 0 }
    })
    crowd.length = 0; crowd.push(...list)     // shared with the car / weapons so they can hit people
    return list
  }, [scene, count])

  const respawn = (p, Q, first) => {
    const px = carPos.x, pz = carPos.z
    p.axis = Q() < 0.5 ? 'x' : 'z'
    const perp = p.axis === 'z' ? px : pz, along = p.axis === 'z' ? pz : px
    let cands = LINES.filter((l) => Math.abs(l - perp) < range * 0.9)
    if (!cands.length) cands = [LINES.reduce((a, b) => (Math.abs(b - perp) < Math.abs(a - perp) ? b : a))]
    p.L = cands[(Q() * cands.length) | 0]
    p.off = (Q() < 0.5 ? -1 : 1) * (8.5 + (Q() - 0.5) * 1.4)
    const d = Math.abs(p.L + p.off - perp), half = Math.sqrt(Math.max(range * range - d * d, 25))
    p.t = first ? along + (Q() * 2 - 1) * half : along + (Q() < 0.5 ? -1 : 1) * half * (0.8 + Q() * 0.2)
    p.t = Math.max(-295, Math.min(295, p.t))
    p.dir = Q() < 0.5 ? 1 : -1
    p.ph = Q() * 6.28
    p.spawned = true
  }
  const Qr = useMemo(() => rng(1234), [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05), time = state.clock.elapsedTime, px = carPos.x, pz = carPos.z
    for (const p of peds) {
      if (!p.spawned) respawn(p, Qr, true)
      if (p.down > 0) {       // knocked down: lies on the ground for 6 s, then a new walker appears
        p.down -= dt
        p.group.rotation.x += (-1.5 - p.group.rotation.x) * Math.min(1, 9 * dt); p.group.position.y = 0.12
        if (p.down <= 0) { p.group.rotation.x = 0; respawn(p, Qr, false); p.group.visible = false }
        continue
      }
      p.t += p.dir * p.speed * dt
      const x = p.axis === 'z' ? p.L + p.off : p.t, z = p.axis === 'z' ? p.t : p.L + p.off
      const dx = x - px, dz = z - pz
      if (Math.abs(p.t) > 295 || dx * dx + dz * dz > range * range * 1.1) { respawn(p, Qr, false); p.group.visible = false; continue }
      p.group.visible = true; p.x = x; p.z = z
      p.group.position.set(x, 0, z)
      p.group.rotation.y = p.axis === 'z' ? (p.dir > 0 ? 0 : Math.PI) : p.dir > 0 ? Math.PI / 2 : -Math.PI / 2
      p.ph += dt * p.speed * 3.6
      p.model.position.y = poseRig(p.rig, p.ph, 0.75, 0, time + p.ph)
    }
  })
  return <group>{peds.map((p, i) => <primitive key={i} object={p.group} />)}</group>
}

export function Crowd() {
  const glb = useAssetExists(CROWD_URL)
  const fallback = <InstancedCrowd />
  return glb ? <Suspense fallback={fallback}><GlbCrowd /></Suspense> : fallback
}
