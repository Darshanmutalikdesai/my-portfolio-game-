import { LOW } from './device'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGame } from './store'
import { carPos } from './shared'
import { heightAt, shoreDist, rng, HIGH_WATER, MLAKES, BRIDGES, SEA, ISLAND_R } from './terrain'

const waterMat = <meshPhysicalMaterial color="#2186b8" roughness={0.1} metalness={0.15} transparent opacity={0.9} envMapIntensity={1.4} />

// ---------- sea + crater lakes + plunge pools ----------
export function Water() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, SEA, 0]}><planeGeometry args={[7000, 7000]} />{waterMat}</mesh>
      {HIGH_WATER.map((w, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[w.x, w.y, w.z]}><circleGeometry args={[w.r, 48]} />{waterMat}</mesh>
      ))}
    </group>
  )
}

// ---------- waterfalls: animated foam sheets that follow the carved spillway + mist at the bottom ----------
const FALL_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
const FALL_FS = `
  uniform float uTime; varying vec2 vUv;
  void main(){
    float streak = sin(vUv.x * 46.0 + sin(vUv.y * 7.0 + uTime) * 2.0) * 0.5 + 0.5;
    float flow = fract(vUv.y * 7.0 - uTime * 1.7 + streak * 0.8);
    float foam = smoothstep(0.55, 1.0, flow);
    vec3 col = mix(vec3(0.50, 0.80, 1.0), vec3(1.0), foam * 0.85 + streak * 0.15);
    float edge = smoothstep(0.0, 0.2, vUv.x) * (1.0 - smoothstep(0.8, 1.0, vUv.x));
    gl_FragColor = vec4(col, (0.55 + 0.4 * foam) * edge);
  }`
export function Waterfalls() {
  const mist = useRef()
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: FALL_VS, fragmentShader: FALL_FS, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide }), [])
  const geos = useMemo(() => MLAKES.map((M) => {
    const R = 18, C = 6, pos = [], uv = [], idx = []
    for (let r = 0; r <= R; r++) {
      const u = M.u0 - 3 + ((M.len + 3) * r) / R
      for (let c = 0; c <= C; c++) {
        const v = (c / C - 0.5) * 2 * M.w * 0.8
        const x = M.x + M.dx * u - M.dz * v, z = M.z + M.dz * u + M.dx * v
        pos.push(x, heightAt(x, z) + 1.0, z); uv.push(c / C, r / R)
      }
    }
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const a = r * (C + 1) + c, b = a + 1, d = a + C + 1, e = d + 1; idx.push(a, d, b, b, d, e) }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx)
    return g
  }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    mat.uniforms.uTime.value = t
    if (mist.current) mist.current.children.forEach((m, i) => { const s = 5 + Math.sin(t * 1.7 + i * 2) * 0.9; m.scale.set(s, s * 0.7, s); m.material.opacity = 0.16 + 0.06 * Math.sin(t * 2 + i) })
  })
  return (
    <group>
      {geos.map((g, i) => <mesh key={i} geometry={g} material={mat} frustumCulled={false} />)}
      <group ref={mist}>
        {MLAKES.flatMap((M, i) => [-1, 0, 1].map((k) => (
          <mesh key={i + '_' + k} position={[M.x + M.dx * (M.u0 + M.len) - M.dz * k * 7, M.poolH + 1.5, M.z + M.dz * (M.u0 + M.len) + M.dx * k * 7]}>
            <sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.2} depthWrite={false} />
          </mesh>
        )))}
      </group>
    </group>
  )
}

// ---------- bridges across the two rivers (neon-railed) ----------
const NEON_PINK = new THREE.Color().setRGB(3.4, 0.5, 1.9)
export function Bridges() {
  return (
    <group>
      {BRIDGES.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.y - 0.4, 0]} castShadow receiveShadow><boxGeometry args={[b.half * 2, 0.8, b.w * 2]} /><meshStandardMaterial color="#c4bccd" roughness={0.7} /></mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[0, b.y + 0.3, s * (b.w - 0.15)]}><boxGeometry args={[b.half * 2, 0.6, 0.25]} /><meshStandardMaterial color="#8f86a0" /></mesh>
              <mesh position={[0, b.y + 0.7, s * (b.w - 0.15)]}><boxGeometry args={[b.half * 2, 0.14, 0.3]} /><meshBasicMaterial color={NEON_PINK} toneMapped={false} /></mesh>
            </group>
          ))}
          {Array.from({ length: 7 }, (_, k) => -b.half + (k + 0.5) * ((2 * b.half) / 7)).map((x) => (
            <mesh key={x} position={[x, (b.y - 7) / 2, 0]} castShadow><cylinderGeometry args={[0.9, 1.1, b.y + 7, 8]} /><meshStandardMaterial color="#b3aac0" roughness={0.8} /></mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------- rocks scattered on slopes, beaches and river banks (instanced) ----------
export function Rocks() {
  const ref = useRef()
  const list = useMemo(() => {
    const Q = rng(12), out = []
    for (let i = 0; i < 16000 && out.length < 650; i++) {
      const x = (Q() - 0.5) * 2300, z = (Q() - 0.5) * 2300
      if (Math.max(Math.abs(x), Math.abs(z)) < 320 || shoreDist(x, z) > ISLAND_R - 8) continue
      const h = heightAt(x, z); if (h < -0.4) continue
      const sl = Math.abs(heightAt(x + 4, z) - h) + Math.abs(heightAt(x, z + 4) - h)
      if (sl < 1.6 && Q() > 0.06) continue
      out.push({ x, y: h, z, s: 1.4 + Q() * 3.6, r: Q() * 6.28, k: Q() })
    }
    return out
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color()
    list.forEach((t, i) => {
      q.setFromEuler(e.set(Math.random() * 0.4, t.r, Math.random() * 0.4))
      m.compose(new THREE.Vector3(t.x, t.y - 0.3, t.z), q, new THREE.Vector3(t.s, t.s * 0.7, t.s * 0.9))
      ref.current.setMatrixAt(i, m); ref.current.setColorAt(i, c.set('#8c8294').offsetHSL(0, 0, (t.k - 0.5) * 0.14))
    })
    ref.current.instanceMatrix.needsUpdate = true; ref.current.instanceColor.needsUpdate = true
  }, [list])
  return <instancedMesh ref={ref} args={[new THREE.IcosahedronGeometry(1, 0), null, list.length]} frustumCulled={false}><meshStandardMaterial roughness={1} flatShading /></instancedMesh>
}

// ---------- rain (RAINSTORM cheat): streaks that follow the player ----------
const N_RAIN = LOW ? 700 : 1500
export function Rain() {
  const on = useGame((s) => s.rain)
  const data = useMemo(() => {
    const Q = rng(3), p = new Float32Array(N_RAIN * 3), v = new Float32Array(N_RAIN)
    for (let i = 0; i < N_RAIN; i++) { p[i * 3] = (Q() - 0.5) * 80; p[i * 3 + 1] = Q() * 40; p[i * 3 + 2] = (Q() - 0.5) * 80; v[i] = 28 + Q() * 14 }
    return { p, v }
  }, [])
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_RAIN * 6), 3)); return g }, [])
  useFrame((_, dt) => {
    if (!on) return
    const a = geo.attributes.position.array, { p, v } = data, d = Math.min(dt, 0.05)
    for (let i = 0; i < N_RAIN; i++) {
      p[i * 3 + 1] -= v[i] * d; if (p[i * 3 + 1] < 0) p[i * 3 + 1] += 40
      const x = carPos.x + p[i * 3], y = (carPos.y || 0) + p[i * 3 + 1], z = carPos.z + p[i * 3 + 2]
      a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x + 0.12; a[i * 6 + 4] = y + 1.3; a[i * 6 + 5] = z + 0.05
    }
    geo.attributes.position.needsUpdate = true
  })
  return <lineSegments geometry={geo} frustumCulled={false} visible={on}><lineBasicMaterial color="#cfe3ff" transparent opacity={0.45} depthWrite={false} /></lineSegments>
}

// ---------- snow (SNOWDAY cheat): big soft flakes drifting down around the player ----------
const N_SNOW = LOW ? 900 : 1800
export function Snow() {
  const on = useGame((s) => s.snow)
  const data = useMemo(() => {
    const Q = rng(11), p = new Float32Array(N_SNOW * 3), v = new Float32Array(N_SNOW)
    for (let i = 0; i < N_SNOW; i++) { p[i * 3] = (Q() - 0.5) * 90; p[i * 3 + 1] = Q() * 45; p[i * 3 + 2] = (Q() - 0.5) * 90; v[i] = 2.2 + Q() * 2.5 }
    return { p, v }
  }, [])
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_SNOW * 3), 3)); return g }, [])
  useFrame(({ clock }, dt) => {
    if (!on) return
    const a = geo.attributes.position.array, { p, v } = data, d = Math.min(dt, 0.05), t = clock.elapsedTime
    for (let i = 0; i < N_SNOW; i++) {
      p[i * 3 + 1] -= v[i] * d; if (p[i * 3 + 1] < 0) p[i * 3 + 1] += 45
      a[i * 3] = carPos.x + p[i * 3] + Math.sin(t * 0.8 + i) * 1.2; a[i * 3 + 1] = (carPos.y || 0) + p[i * 3 + 1]; a[i * 3 + 2] = carPos.z + p[i * 3 + 2] + Math.cos(t * 0.7 + i * 1.7) * 1.2
    }
    geo.attributes.position.needsUpdate = true
  })
  return <points geometry={geo} frustumCulled={false} visible={on}><pointsMaterial color="#ffffff" size={0.35} transparent opacity={0.9} depthWrite={false} sizeAttenuation /></points>
}
