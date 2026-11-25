import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGame } from './store'
import { SUN, atm } from './shared'

// =====================================================================
//  SKY + LIGHT + FOG.  "sunset" is the default neon-Miami golden hour (violet sky -> magenta -> orange horizon,
//  hazy pink distance, orange sun). "night" and "day" are reached with cheats (MIDNIGHT / HIGHNOON / DUSK).
//  Everything blends smoothly when the time of day changes.
// =====================================================================
const PRESETS = {
  sunset: { top: '#241a86', mid: '#b23fd1', low: '#ff4f9a', hor: '#ff9a4a', glow: '#ffd29a', sunSize: 1.1, sunStr: 1, cloud: 0.8, fog: '#e0628c', fogD: 0.00105, sunCol: '#ff7a4a', sunI: 2.6, hemiSky: '#a45bff', hemiGround: '#ff7a50', hemiI: 0.62, env: 0.95, bloom: 0.95 },
  night: { top: '#02030f', mid: '#0c1142', low: '#3a1766', hor: '#7a2f86', glow: '#a9bcff', sunSize: 0.4, sunStr: 0.7, cloud: 0.25, fog: '#221044', fogD: 0.0013, sunCol: '#7a94ff', sunI: 0.55, hemiSky: '#3b4cff', hemiGround: '#2a0f4a', hemiI: 0.45, env: 0.28, bloom: 1.35 },
  day: { top: '#2b7fff', mid: '#6db4ff', low: '#b8e0ff', hor: '#fff1d9', glow: '#fff7e0', sunSize: 0.9, sunStr: 0.9, cloud: 0.7, fog: '#cfe4f7', fogD: 0.0008, sunCol: '#fff1d6', sunI: 3.0, hemiSky: '#cfe6ff', hemiGround: '#5f7a3a', hemiI: 0.78, env: 1.0, bloom: 0.55 },
}
const COLOR_KEYS = ['top', 'mid', 'low', 'hor', 'glow', 'fog', 'sunCol', 'hemiSky', 'hemiGround']
const NUM_KEYS = ['sunSize', 'sunStr', 'cloud', 'fogD', 'sunI', 'hemiI', 'env', 'bloom']
atm.col = new THREE.Color(PRESETS.sunset.sunCol)
atm.bloom = PRESETS.sunset.bloom

const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
const SKY_FS = `
  uniform vec3 uTop, uMid, uLow, uHor, uGlow, uSunDir; uniform float uSunSize, uSunStr, uCloud, uTime; varying vec3 vDir;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }
  void main(){
    vec3 d = normalize(vDir); float t = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(uHor, uLow, smoothstep(0.0, 0.10, t));
    col = mix(col, uMid, smoothstep(0.08, 0.32, t));
    col = mix(col, uTop, smoothstep(0.28, 0.85, t));
    col = mix(col, uHor * 0.9, 1.0 - smoothstep(-0.2, 0.0, d.y));
    float s = max(dot(d, normalize(uSunDir)), 0.0);
    // long streaky sunset clouds, lit from below by the sun
    vec2 cp = d.xz / (abs(d.y) + 0.22) * 1.5 + vec2(uTime * 0.006, 3.0);
    float cl = fbm(vec2(cp.x * 0.9, cp.y * 2.4));
    float cm = smoothstep(0.52, 0.80, cl) * smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.42, 0.75, t));
    vec3 ccol = mix(uMid * 0.55, uGlow, pow(s, 3.0) * 0.9 + 0.22);
    col = mix(col, ccol, cm * 0.8 * uCloud);
    col += uGlow * pow(s, 8.0) * 0.5 * uSunStr + uGlow * pow(s, 64.0) * 0.9 * uSunStr;
    float disk = smoothstep(1.0 - 0.0016 * uSunSize, 1.0 - 0.0008 * uSunSize, s);
    col = mix(col, uGlow * 2.6, disk * uSunStr);
    gl_FragColor = vec4(col, 1.0);
  }`

export function Atmosphere() {
  const { scene } = useThree()
  const dome = useRef(), hemi = useRef()
  const cur = useMemo(() => {
    const p = PRESETS.sunset, o = {}
    COLOR_KEYS.forEach((k) => { o[k] = new THREE.Color(p[k]) }); NUM_KEYS.forEach((k) => { o[k] = p[k] })
    return o
  }, [])
  const tgt = useMemo(() => { const o = {}; COLOR_KEYS.forEach((k) => { o[k] = new THREE.Color() }); return o }, [])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uLow: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(...SUN) }, uSunSize: { value: 1 }, uSunStr: { value: 1 }, uCloud: { value: 1 }, uTime: { value: 0 } },
  }), [])
  useFrame((state, delta) => {
    const g = useGame.getState(), P = PRESETS[g.tod] || PRESETS.sunset, k = 1 - Math.exp(-Math.min(delta, 0.1) * 1.6)
    COLOR_KEYS.forEach((key) => { tgt[key].set(P[key]); cur[key].lerp(tgt[key], k) })
    const rain = g.rain ? 1 : 0
    NUM_KEYS.forEach((key) => { cur[key] += (P[key] - cur[key]) * k })
    const u = mat.uniforms
    u.uTop.value.copy(cur.top); u.uMid.value.copy(cur.mid); u.uLow.value.copy(cur.low); u.uHor.value.copy(cur.hor); u.uGlow.value.copy(cur.glow)
    u.uSunSize.value = cur.sunSize; u.uSunStr.value = cur.sunStr * (1 - 0.8 * rain); u.uCloud.value = cur.cloud + rain * 0.8; u.uTime.value = state.clock.elapsedTime
    if (scene.fog) { scene.fog.color.copy(cur.fog); scene.fog.density = cur.fogD + rain * 0.0009 }
    scene.environmentIntensity = cur.env * (1 - 0.3 * rain)
    atm.col.copy(cur.sunCol); atm.sunI = cur.sunI * (1 - 0.55 * rain); atm.bloom = cur.bloom
    if (hemi.current) { hemi.current.color.copy(cur.hemiSky); hemi.current.groundColor.copy(cur.hemiGround); hemi.current.intensity = cur.hemiI }
    if (dome.current) dome.current.position.copy(state.camera.position)
  })
  return (
    <>
      <mesh ref={dome} material={mat} frustumCulled={false} renderOrder={-1000}><sphereGeometry args={[3000, 32, 16]} /></mesh>
      <hemisphereLight ref={hemi} args={['#a45bff', '#ff7a50', 0.62]} />
    </>
  )
}
