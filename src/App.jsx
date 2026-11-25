import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ToneMapping, HueSaturation } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { ZONES, PROFILE } from './data'
import { useGame } from './store'
import { carPos, SUN, traffic, mission, mapWp, crowd, cam, wp, law, worldRef, touch } from './shared'
import { isTouch, LOW } from './device'
import { TouchControls } from './TouchControls'
import { Combat, HeldWeapon, Police } from './Combat'
import { WEAPONS, fireWeapon, punch, reloadNow, tickWeapons, updateRockets } from './weapons'
import { lawTick, pedHit } from './police'
import { music } from './music'
import { groundAt } from './terrain'
import { feedCheat, runCheat, CHEATS } from './cheats'
import { City, Terrain, Trees, Forest, Sun, makeCity, makeStreetTrees } from './World'
import { Water, Waterfalls, Bridges, Rocks, Rain, Snow } from './Island'
import { startMapBuild, drawRadarBase, drawBigMap, MapOverlay } from './MapView'
import { Atmosphere } from './Atmosphere'
import { Intro } from './Intro'
import { SportsCar, Traffic } from './Vehicles'
import { Character, Crowd } from './People'

const keys = {}
let fPressed = false
const mouse = { l: false, r: false, press: false }
const _v1 = new THREE.Vector3(), _aim = new THREE.Vector3(), _mz = new THREE.Vector3()

// gamepad (Xbox layout): left stick move / steer, right stick camera, RT gas (car) or fire (foot), LT brake or aim,
// B fire from the car, A brake / jump, X car in/out, Y interact, LB/RB weapon, L3 run, Back map, Start cheats
function readPad(st) {
  const list = navigator.getGamepads ? navigator.getGamepads() : []
  const gp = [...list].find((q) => q && q.connected)
  if (!gp) return null
  const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v)
  const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed)
  const edge = (i) => { const now = btn(i), was = !!st.pp[i]; st.pp[i] = now; return now && !was }
  return {
    mx: dz(gp.axes[0] || 0), my: -dz(gp.axes[1] || 0), cx: dz(gp.axes[2] || 0), cy: dz(gp.axes[3] || 0),
    rt: gp.buttons[7] ? gp.buttons[7].value : 0, lt: gp.buttons[6] ? gp.buttons[6].value : 0,
    a: btn(0), b: btn(1), run: btn(10), x: edge(2), y: edge(3), lb: edge(4), rb: edge(5), back: edge(8), start: edge(9), rtE: edge(7), bE: edge(1),
  }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// ---------- player: drive the car OR walk (F to enter / exit) ----------
function Controller({ colliders }) {
  const gl = useThree((s) => s.gl)
  const carRef = useRef(), manRef = useRef(), speed = useRef(0), aimRef = useRef(0), mini = useRef(null)
  const S = useRef({ mode: 'car', c: { x: -3.5, z: -14, h: 0, v: 0 }, p: { x: 0, z: 0, h: 0, v: 0, y: 0, vy: 0, vx: 0, vz: 0 }, fy: 0, sc: 1, safe: null, pp: {}, warn: 0, decay: 0 })
  useEffect(() => { worldRef.colliders = colliders }, [colliders])

  useEffect(() => {
    const dom = gl.domElement
    const down = (e) => {
      keys[e.code] = true
      const g = useGame.getState()
      if (!g.started) return
      if (!e.repeat) feedCheat(e.code)                         // typed cheat codes (see cheats.js)
      if (e.code === 'KeyE') (g.panel ? g.close() : g.open())
      if (e.code === 'Escape') { g.close(); if (g.help) g.toggleHelp(); if (g.mapOpen) g.toggleMap() }
      if (e.code === 'KeyQ' && !e.repeat) g.toggleMap()
      if (e.code === 'Comma' && !e.repeat) music.toggle()
      if (e.code === 'Period' && !e.repeat) music.next()
      if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) g.toggleHelp() }
      if (e.code === 'KeyF' && !e.repeat) fPressed = true
      if (e.code === 'KeyR' && !e.repeat) reloadNow()
      if (/^Digit[1-5]$/.test(e.code)) g.setWeapon(+e.code[5] - 1)      // 1 fists · 2 pistol · 3 SMG · 4 shotgun · 5 rocket launcher
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault()
    }
    const up = (e) => { keys[e.code] = false }
    // mouse look: click the game to capture the mouse (Esc releases). Move = rotate the camera, left click = fire / punch, right hold = aim, wheel = weapon
    const move = (e) => { if (document.pointerLockElement === dom || (e.buttons & 2)) { cam.yaw -= e.movementX * 0.0026; cam.pitch = clamp(cam.pitch + e.movementY * 0.0022, -0.3, 1.1); cam.idle = 0 } }
    const mdown = (e) => {
      const g = useGame.getState()
      if (!g.started || g.panel || g.mapOpen || g.passed || e.target !== dom) return
      if (document.pointerLockElement !== dom && dom.requestPointerLock) { try { const r = dom.requestPointerLock(); if (r && r.catch) r.catch(() => {}) } catch (_) { /* not available */ } }
      if (e.button === 0) { mouse.l = true; mouse.press = true }
      if (e.button === 2) mouse.r = true
    }
    const mup = (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false }
    const wheel = (e) => { if (document.pointerLockElement === dom) useGame.getState().nextWeapon(e.deltaY > 0 ? 1 : -1) }
    const noMenu = (e) => e.preventDefault()
    const lockChange = () => useGame.setState({ lock: document.pointerLockElement === dom })
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    window.addEventListener('mousemove', move); window.addEventListener('mousedown', mdown); window.addEventListener('mouseup', mup); window.addEventListener('wheel', wheel, { passive: true })
    dom.addEventListener('contextmenu', noMenu); document.addEventListener('pointerlockchange', lockChange)
    ;[carRef, manRef].forEach((r) => r.current.traverse((o) => { if (o.isMesh) o.castShadow = true }))
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up)
      window.removeEventListener('mousemove', move); window.removeEventListener('mousedown', mdown); window.removeEventListener('mouseup', mup); window.removeEventListener('wheel', wheel)
      dom.removeEventListener('contextmenu', noMenu); document.removeEventListener('pointerlockchange', lockChange)
    }
  }, [gl])

  const resolve = (e, r, isCar, skipBuildings, skipTraffic) => {
    if (!skipBuildings) for (const b of colliders) {       // PHANTOM cheat drives straight through buildings; MONSTRUCK / PHANTOM through traffic
      const dx = e.x - b.x, dz = e.z - b.z
      if (Math.abs(dx) > b.w / 2 + r || Math.abs(dz) > b.d / 2 + r) continue
      const px = b.w / 2 + r - Math.abs(dx), pz = b.d / 2 + r - Math.abs(dz)
      if (px < pz) e.x += Math.sign(dx || 1) * px; else e.z += Math.sign(dz || 1) * pz
      if (isCar) e.v *= 0.9
    }
    if (isCar && !skipTraffic) for (const t of traffic) {
      if (!t) continue
      const dx = e.x - t.x, dz = e.z - t.z, d = Math.hypot(dx, dz)
      if (d < r + 1.5 && d > 0) { e.x += (dx / d) * (r + 1.5 - d); e.z += (dz / d) * (r + 1.5 - d); e.v *= 0.7 }
    }
  }
  // water and cliffs are walls: slide along them, never end up in the sea or on a vertical face
  const fixMove = (e, ox, oz, isCar) => {
    const bad = (x, z) => { const g1 = groundAt(x, z); if (g1 < -0.6) return true; const d = Math.hypot(x - ox, z - oz); return d > 0.01 && Math.abs(g1 - groundAt(ox, oz)) / d > (isCar ? 1.0 : 1.3) }
    if (!bad(e.x, e.z)) return
    if (!bad(e.x, oz)) e.z = oz; else if (!bad(ox, e.z)) e.x = ox; else { e.x = ox; e.z = oz }
    if (isCar) e.v *= 0.6
  }

  useFrame((state, delta) => {
    const st = S.current, { c, p } = st, g = useGame.getState()
    const dt = Math.min(delta, 0.05) * (g.slow ? 0.35 : 1)       // SLOWMO cheat
    const intro = !g.started
    const locked = !!g.panel || g.passed || intro || g.mapOpen
    if (locked && document.pointerLockElement) document.exitPointerLock()   // free the mouse for menus and the map
    music.mood(st.mode === 'car', !!g.panel, g.passed)

    // ---- controller (gamepad) + keyboard ----
    const pad = readPad(st)
    if (pad && !g.pad) g.setPad(true)
    if (pad) {
      if (pad.y) (g.panel ? g.close() : g.open())
      if (pad.back) g.toggleMap()
      if (pad.start) g.toggleHelp()
      if (!locked) {
        if (pad.x) fPressed = true
        if (pad.lb) g.nextWeapon(-1)
        if (pad.rb) g.nextWeapon(1)
        if (pad.cx || pad.cy) { cam.yaw -= pad.cx * 2.6 * dt; cam.pitch = clamp(cam.pitch + pad.cy * 1.8 * dt, -0.3, 1.1); cam.idle = 0 }
      }
    }
    if (touch.f) { touch.f = false; if (!locked) fPressed = true }
    if (isTouch) {      // right-thumb look pad
      if (!locked && (touch.lx || touch.ly)) { cam.yaw -= touch.lx * 0.0055; cam.pitch = clamp(cam.pitch + touch.ly * 0.0042, -0.3, 1.1); cam.idle = 0 }
      touch.lx = 0; touch.ly = 0
    }
    const k2 = (a, b) => ((keys[a] ? 1 : 0) - (keys[b] ? 1 : 0))
    let fwd = k2('KeyW', 'KeyS') + k2('ArrowUp', 'ArrowDown'), right = k2('KeyD', 'KeyA') + k2('ArrowRight', 'ArrowLeft')
    if (pad) { fwd += pad.my; right += pad.mx; if (st.mode === 'car') fwd += pad.rt - pad.lt }
    if (isTouch) { fwd += touch.my; right += touch.mx }
    fwd = locked ? 0 : clamp(fwd, -1, 1); right = locked ? 0 : clamp(right, -1, 1)
    const turn = -right                                            // car steering: left = positive
    const brake = !locked && (keys.Space || (pad && pad.a) || touch.jump)
    const fireHeld = !locked && (mouse.l || touch.fire || (pad && (st.mode === 'car' ? pad.b : pad.rt > 0.4)))
    const firePress = !locked && (mouse.press || touch.firePress || (pad && (st.mode === 'car' ? pad.bE : pad.rtE)))
    mouse.press = false; touch.firePress = false

    let snap = false
    if (g.tp) {   // teleport cheat
      c.x = g.tp.x; c.z = g.tp.z; c.v = 0; c.h = 0; p.x = c.x + 2.6; p.z = c.z; p.v = 0; p.vx = 0; p.vz = 0
      st.mode = 'car'; cam.yaw = 0; g.clearTp(); snap = true
    }
    if (fPressed) {
      fPressed = false
      if (!locked) {
        if (st.mode === 'car') { st.mode = 'foot'; p.x = c.x + Math.cos(c.h) * 2.6; p.z = c.z - Math.sin(c.h) * 2.6; p.h = c.h; p.v = 0; p.vx = 0; p.vz = 0; p.y = groundAt(p.x, p.z); p.vy = 0; cam.yaw = c.h }
        else if (Math.hypot(p.x - c.x, p.z - c.z) < 5) { st.mode = 'car'; cam.yaw = 0 }
      }
    }
    if (g.mode !== st.mode) g.setMode(st.mode)

    // car physics (keeps braking when the player is on foot)
    const driving = st.mode === 'car'
    const thr = driving ? fwd : 0, steer = driving ? turn : 0
    const maxV = g.nitro ? 62 : 38, acc = g.nitro ? 42 : 22
    if (thr > 0) c.v += acc * dt; else if (thr < 0) c.v -= (c.v > 0 ? 40 : 14) * dt
    c.v -= c.v * (thr === 0 ? 1.2 : 0.25) * dt
    if (brake || !driving) c.v *= 1 - 3 * dt
    c.v = clamp(c.v, -12, maxV)
    c.h += steer * 1.9 * dt * clamp(c.v / 8, -1, 1)
    const cox = c.x, coz = c.z
    c.x += Math.sin(c.h) * c.v * dt; c.z += Math.cos(c.h) * c.v * dt
    // SKYCAR / MONSTRUCK / TINYCAR / PHANTOM cheats
    st.fy += ((g.fly ? 32 : 0) - st.fy) * (1 - Math.exp(-2.4 * dt))
    st.sc += ((g.monster ? 2.4 : g.tiny ? 0.55 : 1) - st.sc) * (1 - Math.exp(-6 * dt))
    const airborne = st.fy > 2.5
    if (!airborne) {
      resolve(c, 1.7 * st.sc, true, g.phantom, g.phantom || g.monster)
      fixMove(c, cox, coz, true)
      if (!g.fly && st.fy < 1.5 && groundAt(c.x, c.z) < -0.6 && st.safe) { c.x = st.safe.x; c.z = st.safe.z; c.v = 0 }   // landed over water -> back to the last safe spot
      else if (groundAt(c.x, c.z) > -0.3) st.safe = { x: c.x, z: c.z }
    }

    // walking: camera-relative (mouse look), strafes while aiming; jumping (SPACE; MOONJUMP cheat = low gravity)
    if (!driving) {
      const fxv = Math.sin(cam.yaw), fzv = Math.cos(cam.yaw), rxv = -fzv, rzv = fxv      // camera forward / right on the ground
      const run = !locked && (keys.ShiftLeft || keys.ShiftRight || (pad && pad.run) || Math.hypot(touch.mx, touch.my) > 0.92)   // touch: push the stick to the edge to run
      const top = (run ? 7.5 : 3.4) * Math.min(1, Math.hypot(fwd, right))
      let tx = fxv * fwd + rxv * right, tz = fzv * fwd + rzv * right
      const tl = Math.hypot(tx, tz) || 1
      tx = (tx / tl) * top; tz = (tz / tl) * top
      const kk = Math.min(1, 10 * dt)
      p.vx += (tx - p.vx) * kk; p.vz += (tz - p.vz) * kk
      p.v = Math.hypot(p.vx, p.vz)
      const want = g.weapon > 0 && cam.aim > 0.5 ? cam.yaw : p.v > 0.4 ? Math.atan2(p.vx, p.vz) : p.h
      p.h += (((want - p.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (1 - Math.exp(-12 * dt))
      const pox = p.x, poz = p.z
      p.x += p.vx * dt; p.z += p.vz * dt
      resolve(p, 0.5, false, g.phantom)
      fixMove(p, pox, poz, false)
      const gy = groundAt(p.x, p.z)
      if ((keys.Space || (pad && pad.a) || touch.jump) && !locked && p.y <= gy + 0.05) p.vy = g.moon ? 14 : 7.5
      p.vy -= (g.moon ? 6 : 24) * dt
      p.y += p.vy * dt
      if (p.y < gy) { p.y = gy; p.vy = 0 }
    }

    const yc = groundAt(c.x, c.z) + st.fy, yp = driving ? groundAt(p.x, p.z) : p.y
    carRef.current.position.set(c.x, yc, c.z); carRef.current.rotation.y = c.h; carRef.current.scale.setScalar(st.sc)
    manRef.current.visible = !driving
    manRef.current.position.set(p.x, yp, p.z); manRef.current.rotation.y = p.h
    speed.current = driving ? 0 : Math.abs(p.v)

    const e = driving ? c : p, ye = driving ? yc : yp
    carPos.x = e.x; carPos.z = e.z; carPos.y = ye

    // ---- weapons ----
    tickWeapons(dt)
    const armed = g.weapon > 0
    if (!locked) {
      if (!armed) { if (firePress && !driving) punch(p.x, p.z, p.h) }
      else if (fireHeld || firePress) {
        const dir = state.camera.getWorldDirection(_v1)
        _aim.copy(state.camera.position).addScaledVector(dir, 60)
        if (driving) _mz.set(c.x + Math.sin(c.h) * 1.8, yc + 1.1, c.z + Math.cos(c.h) * 1.8)
        else _mz.set(p.x + Math.sin(p.h) * 0.65 - Math.cos(p.h) * 0.2, yp + 1.4, p.z + Math.cos(p.h) * 0.65 + Math.sin(p.h) * 0.2)
        fireWeapon(_mz, _aim, firePress)
      }
      updateRockets(dt)
    }
    const am = document.getElementById('ammo')
    if (am) { const W = WEAPONS[g.weapon]; am.textContent = W.mag ? (wp.reload > 0 ? 'RELOADING…' : wp.mag[g.weapon] + (wp.infinite ? ' / ∞' : ' / ' + W.mag)) : '' }

    // ---- people + police case ----
    if (driving && !locked && Math.abs(c.v) > 4) for (const q of crowd) {      // running people over
      if (q.down > 0 || !q.group.visible) continue
      if (Math.hypot(q.x - c.x, q.z - c.z) < 1.25 + st.sc) { pedHit(q, 'car'); c.v *= 0.94 }
    }
    if (!locked) {
      if (g.wanted > 0) lawTick(dt, { x: e.x, z: e.z, v: driving ? c.v : p.v, driving })
      if (law.shove) { const sh = law.shove; law.shove = null; if (driving) { c.x += sh.x * 2; c.z += sh.z * 2; c.v *= 0.75 } else { p.x += sh.x * 1.5; p.z += sh.z * 1.5 } }
      st.decay += dt
      if (st.decay > 40) { st.decay = 0; if (g.wanted === 0 && g.hits > 0) useGame.setState({ hits: g.hits - 1 }) }   // people forget: -1 every 40 s
    }

    // ---- camera: mouse / stick orbit (car: recentres behind the car after a moment; foot: free look + over-the-shoulder aim) ----
    const sn = Math.sin(e.h), cs = Math.cos(e.h)
    const aimWanted = !locked && !driving && armed && (mouse.r || touch.aim || (pad && pad.lt > 0.3) || fireHeld)
    cam.aim += ((aimWanted ? 1 : 0) - cam.aim) * (1 - Math.exp(-10 * dt))
    aimRef.current = !driving && armed ? 0.55 + 0.45 * cam.aim : 0
    if (!intro && !locked) { cam.idle += dt; if (driving && cam.idle > 2.2 && !(pad && (pad.cx || pad.cy))) cam.yaw *= Math.exp(-2.4 * dt) }
    if (intro) {   // title screen: slow orbit around the car at sunset
      const a = state.clock.elapsedTime * 0.12
      state.camera.position.set(c.x + Math.cos(a) * 11, yc + 2.4, c.z + Math.sin(a) * 11)
      state.camera.lookAt(c.x, yc + 0.9, c.z)
    } else {
      const zoom = driving ? Math.pow(st.sc, 0.8) : 1
      const yawW = driving ? e.h + cam.yaw : cam.yaw
      const dist = (driving ? 10 : 5) * zoom * (1 - 0.36 * cam.aim)
      const ty = ye + (driving ? 1.5 : 1.55) * zoom
      const hor = dist * Math.cos(cam.pitch), ver = dist * Math.sin(cam.pitch) + (driving ? 2.2 * zoom : 0.5)
      const wx = Math.sin(yawW), wz = Math.cos(yawW), shoulder = !driving ? 0.75 * cam.aim : 0
      const px = e.x - wx * hor - wz * shoulder, pz = e.z - wz * hor + wx * shoulder
      const py = Math.max(ty + ver, groundAt(px, pz) + 0.8)
      if (snap) state.camera.position.set(px, py, pz); else state.camera.position.lerp({ x: px, y: py, z: pz }, 1 - Math.exp(-13 * dt))
      if (cam.shake > 0) { state.camera.position.x += (Math.random() - 0.5) * cam.shake * 0.5; state.camera.position.y += (Math.random() - 0.5) * cam.shake * 0.5; cam.shake = Math.max(0, cam.shake - dt * 1.8) }
      const ahead = driving ? 4 : 3 + 3 * cam.aim
      state.camera.lookAt(e.x + wx * ahead, ty, e.z + wz * ahead)
    }

    st.warn -= dt
    const near = !driving && Math.hypot(p.x - c.x, p.z - c.z) < 5
    if (g.nearCar !== near) g.setNear(near)
    // ---- missions: goals can be combined (mode + speed + orbs + countdown); unlock the chapter at its ring ----
    const cur = ZONES[g.step], M = cur && cur.mission
    if (mission.step !== g.step) { mission.step = g.step; mission.timeLeft = M && M.secs ? M.secs : 0 }
    if (M && !locked) {
      if (M.kmh && driving && !g.fast && Math.abs(c.v) * 3.6 >= M.kmh) g.setFast(true)
      if (M.orbs) M.orbs.forEach(([ox, oz], i) => { if (!g.got.includes(i) && Math.hypot(ox - e.x, oz - e.z) < 5) g.collect(i) })
      if (M.secs) {
        mission.timeLeft -= dt
        if (mission.timeLeft <= 0) { mission.timeLeft = M.secs; g.resetOrbs(); g.setFast(false); g.say("TIME'S UP · orbs reset, try again!") }
        const tm = document.getElementById('tmr'); if (tm) tm.textContent = Math.ceil(mission.timeLeft)
      }
    }
    const zn = ZONES.find((z) => Math.hypot(z.marker[0] - e.x, z.marker[1] - e.z) < 5.5)
    const id = zn ? zn.id : null
    if (g.zone !== id) g.setZone(id)
    if (zn && cur && zn.id === cur.id && !locked) {
      const gs = useGame.getState()
      const ok = (!M.mode || (M.mode === 'car') === driving) && (!M.kmh || gs.fast) && (!M.orbs || gs.got.length >= M.orbs.length)
      if (ok && gs.wanted > 0) { if (st.warn <= 0) { gs.say('🚨 CLOSE THE CASE FIRST · lose the police or get busted'); st.warn = 4 } }
      else if (ok) gs.unlock(ZONES.indexOf(cur))
    }

    // HUD: speed + minimap
    const spd = document.getElementById('spd')
    if (spd) spd.textContent = Math.round(Math.abs(driving ? c.v : p.v) * 3.6)
    if (!mini.current) mini.current = document.getElementById('mini')
    const cv = mini.current
    if (cv) {
      const gx = cv.getContext('2d'), Sz = cv.width, MC = Sz / 2, sc = 0.4
      gx.clearRect(0, 0, Sz, Sz)
      const toMap = (x, z) => {
        const dx = x - e.x, dz = z - e.z
        let mx = -dx * cs + dz * sn, my = -(dx * sn + dz * cs)
        const d = Math.hypot(mx, my) * sc, max = MC - 8
        if (d > max) { mx *= max / d; my *= max / d } else { mx *= sc; my *= sc }
        return [MC + mx, MC + my]
      }
      drawRadarBase(gx, Sz, e, sc)
      gx.fillStyle = '#666'
      colliders.forEach((b) => { if (!b.zone && !b.tree) { const [x, y] = toMap(b.x, b.z); gx.fillRect(x - 2, y - 2, 4, 4) } })
      gx.fillStyle = '#ff5050'
      traffic.forEach((t) => { if (t && Math.hypot(t.x - e.x, t.z - e.z) < 150) { const [x, y] = toMap(t.x, t.z); gx.fillRect(x - 1.5, y - 1.5, 3, 3) } })
      if (!driving) { gx.fillStyle = '#4dc9ff'; const [x, y] = toMap(c.x, c.z); gx.fillRect(x - 3, y - 3, 6, 6) }
      ZONES.forEach((z, i) => {
        const [x, y] = toMap(z.marker[0], z.marker[1]), now = i === g.step
        gx.fillStyle = i <= g.step ? z.color : '#555'; gx.beginPath(); gx.arc(x, y, now ? 7 : 5, 0, 7); gx.fill()
        if (now) { gx.strokeStyle = '#fff'; gx.lineWidth = 2; gx.stroke() }
      })
      if (M && M.orbs) { gx.fillStyle = '#fff'; M.orbs.forEach(([ox, oz], i) => { if (!g.got.includes(i)) { const [x, y] = toMap(ox, oz); gx.beginPath(); gx.arc(x, y, 3, 0, 7); gx.fill() } }) }
      if (mapWp.on) { const [x, y] = toMap(mapWp.x, mapWp.z); gx.fillStyle = '#ff3fa0'; gx.strokeStyle = '#fff'; gx.lineWidth = 2; gx.beginPath(); gx.arc(x, y, 6, 0, 7); gx.fill(); gx.stroke() }
      gx.fillStyle = '#fff'; gx.beginPath(); gx.moveTo(MC, MC - 8); gx.lineTo(MC + 6, MC + 7); gx.lineTo(MC - 6, MC + 7); gx.fill()
    }
    if (g.mapOpen) drawBigMap(document.getElementById('bigmap'), { ex: e.x, ez: e.z, eh: e.h, cx: c.x, cz: c.z, driving, step: g.step, got: g.got, M })
  })

  return (
    <>
      <group ref={carRef}><SportsCar /></group>
      <group ref={manRef}><Character speedRef={speed} aimRef={aimRef} /><HeldWeapon /></group>
    </>
  )
}

// ---------- floating collectable orbs (any mission that has `orbs`) ----------
function Orbs() {
  const step = useGame((s) => s.step), got = useGame((s) => s.got), ref = useRef()
  const z = ZONES[step], M = z && z.mission
  useFrame(({ clock }) => { if (ref.current) ref.current.children.forEach((o, i) => { o.position.y = o.userData.y0 + Math.sin(clock.elapsedTime * 2.5 + i) * 0.5; o.rotation.y = clock.elapsedTime }) })
  if (!M || !M.orbs) return null
  return (
    <group ref={ref}>
      {M.orbs.map(([x, zz], i) => got.includes(i) ? null : (
        <group key={i} position={[x, groundAt(x, zz) + 2.2, zz]} userData={{ y0: groundAt(x, zz) + 2.2 }}>
          <mesh scale={1.3}><icosahedronGeometry args={[0.9, 1]} /><meshBasicMaterial color={z.color} toneMapped={false} /></mesh>
          <mesh position-y={30}><cylinderGeometry args={[0.18, 0.18, 70, 8, 1, true]} /><meshBasicMaterial color={z.color} transparent opacity={0.3} depthWrite={false} /></mesh>
        </group>
      ))}
    </group>
  )
}

// short original victory jingle (WebAudio, no files needed)
function passJingle() {
  try {
    const A = new (window.AudioContext || window.webkitAudioContext)(), t0 = A.currentTime + 0.05
    ;[[392, 0], [523.25, 0.18], [659.25, 0.36], [783.99, 0.54], [1046.5, 0.8]].forEach(([f, d], i, a) => {
      const o = A.createOscillator(), g = A.createGain(), last = i === a.length - 1
      o.type = 'triangle'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + (last ? 1.6 : 0.3))
      o.connect(g).connect(A.destination); o.start(t0 + d); o.stop(t0 + d + (last ? 1.7 : 0.35))
    })
  } catch (e) { /* audio blocked: ignore */ }
}

// ---------- HUD ----------
function Hud() {
  const { zone, panel, close, mode, nearCar, step, got, fast, banner, passed, started, help, toggleHelp, wanted, hits, weapon, cash, pad, lock } = useGame()
  useEffect(() => { if (passed) passJingle() }, [passed])
  const [radio, setRadio] = useState({ on: music.isOn(), name: music.getName() })
  useEffect(() => { music.arm(); return music.subscribe(setRadio) }, [])
  if (!started) return <Intro />
  const z = ZONES.find((q) => q.id === zone)
  const zi = ZONES.findIndex((q) => q.id === zone)
  const p = ZONES.find((q) => q.id === panel)
  const cur = ZONES[step], M = cur && cur.mission
  return (
    <div className="hud">
      <div className="mission" style={{ borderColor: cur ? cur.color : '#7dff6b' }}>
        <b style={{ color: cur ? cur.color : '#7dff6b' }}>{cur ? `MISSION ${step + 1} / ${ZONES.length} · ${cur.title}` : 'ALL CHAPTERS UNLOCKED'}</b>
        <span>{cur ? M.text : 'You found everything! Drive to any ring and press E to read a chapter again.'}</span>
        {M && M.mode && <em>{M.mode === 'car' ? '🚗 Arrive in the car' : '🚶 Arrive on foot'}</em>}
        {M && M.kmh && <em>{fast ? `✔ ${M.kmh} km/h reached` : `Reach ${M.kmh} km/h in the car`}</em>}
        {M && M.orbs && <em>Orbs collected: {got.length} / {M.orbs.length}</em>}
        {M && M.secs && <em>Time left: <span id="tmr">{M.secs}</span>s</em>}
        <div className="chips">{ZONES.map((q, i) => <i key={q.id} className={i < step ? 'on' : i === step ? 'now' : ''} style={{ '--c': q.color }}>{i < step ? '✔ ' : '🔒 '}{q.title}</i>)}</div>
      </div>
      {banner && <div className="banner" key={banner}>{banner}</div>}
      {passed && (
        <div className="passed">
          <div className="bar top" /><div className="bar bot" />
          <div className="pwrap">
            <h1>mission passed!</h1>
            <h2>ALL {ZONES.length} CHAPTERS UNLOCKED</h2>
            <p>{PROFILE.name} · {PROFILE.role}</p>
            <div className="pchips">{ZONES.map((q) => <i key={q.id} style={{ background: q.color }}>✔ {q.title}</i>)}</div>
          </div>
        </div>
      )}
      {help && (
        <div className="panel help" style={{ borderColor: '#ff4f9a' }}>
          <h2 style={{ color: '#ff4f9a' }}>CHEAT CODES</h2>
          <p>{isTouch ? 'Tap a cheat to activate it.' : 'Just type the word while playing (no Enter needed).'}</p>
          {Object.entries(CHEATS).map(([k, v]) => <div className="cheat" key={k} onClick={isTouch ? () => { runCheat(k); toggleHelp() } : undefined}><b>{k}</b><span>{v.desc}</span></div>)}
          <button onClick={toggleHelp}>{isTouch ? 'Close' : 'Close (TAB)'}</button>
        </div>
      )}
      <a className="skip" href={PROFILE.fallbackUrl}>Skip to normal portfolio →</a>
      <button className="musicbtn" onClick={() => music.toggle()}>{radio.on ? '♪ ' + (radio.name || 'RADIO') : '♪ MUSIC OFF'} <small>· . next · , mute</small></button>
      <canvas id="mini" width="150" height="150" className="mini" />
      <div className="speed"><span id="spd">0</span><small>KM/H</small></div>
      <div className="cash">${cash.toLocaleString()}</div>
      {wanted > 0 && (
        <div className="case">
          <div className="stars">{[0, 1, 2].map((i) => <b key={i} className={i < wanted ? 'on' : ''}>★</b>)}</div>
          <strong>🚨 POLICE CASE OPEN</strong>
          <small>Lose the police (stay far away 12 s) · or stop and get busted · portfolio is locked</small>
          <div className="meter"><i id="evade" /><span>LOSE THE COPS</span></div>
          <div className="meter red"><i id="bust" /><span>BUSTED</span></div>
        </div>
      )}
      {!wanted && hits > 0 && <div className="hurt">👤 PEOPLE HURT {hits} / 7 {hits >= 5 ? '— STOP!' : ''}</div>}
      {!isTouch && <div className="weapon"><b>{WEAPONS[weapon].name}</b>{weapon > 0 && <span id="ammo" />}<small>1-5 weapons · R reload · click fire · right-click aim · wheel switch</small></div>}
      {weapon > 0 && <div className="crosshair" />}
      {!isTouch && !lock && started && !panel && !help && !passed && <div className="mousehint">🖱 Click the game to capture the mouse (look around · shoot) — Esc releases it{pad ? ' · 🎮 controller connected' : ''}</div>}
      <TouchControls />
      <button className="mapbtn" onClick={() => useGame.getState().toggleMap()}>🗺 MAP <small>· Q</small></button>
      <MapOverlay />
      <div className="keys">W A S D move · mouse look · click fire · SHIFT run · SPACE brake / jump · F {mode === 'car' ? 'exit car' : 'enter car'} · E interact · Q island map · TAB cheat codes · . next song · , mute</div>
      {z && !p && wanted > 0 && <div className="prompt" style={{ borderColor: '#ff3b5c' }}>🚨 CLOSE THE CASE FIRST — lose the police or get busted</div>}
      {z && !p && !wanted && zi < step && <div className="prompt" style={{ borderColor: z.color }}>Press <b>E</b> to view {z.title}</div>}
      {z && !p && !wanted && zi === step && <div className="prompt" style={{ borderColor: z.color }}>🔒 {z.title} is locked — {z.mission.text}</div>}
      {z && !p && !wanted && zi > step && <div className="prompt" style={{ borderColor: '#666' }}>🔒 {z.title} is locked — finish mission {step + 1} first</div>}
      {!z && !p && mode === 'foot' && nearCar && <div className="prompt">Press <b>F</b> to enter car</div>}
      {p && (
        <div className="panel" style={{ borderColor: p.color }}>
          <h2 style={{ color: p.color }}>{p.title}</h2>
          {p.items.map((it, i) => (
            <div className="item" key={i}>
              <h3>{it.link ? <a href={it.link} target="_blank" rel="noreferrer">{it.t} ↗</a> : it.t}</h3>
              <p>{it.d}</p>
              {it.bar && <div className="bar"><i style={{ width: it.bar + '%', background: p.color }} /></div>}
            </div>
          ))}
          <button onClick={close}>Close (E)</button>
        </div>
      )}
    </div>
  )
}

// post-processing; the DISCOBALL cheat spins the colours of the whole picture
function Post() {
  const hue = useRef()
  const disco = useGame((s) => s.disco)
  useFrame(({ clock }) => {
    const e = hue.current; if (!e) return
    const h = disco ? (clock.elapsedTime * 1.1) % (Math.PI * 2) : 0, sat = disco ? 0.55 : 0
    if (e.setHue) { e.setHue(h); e.setSaturation(sat) } else { e.hue = h; e.saturation = sat }
  })
  return (
    <EffectComposer multisampling={LOW ? 0 : 4}>
      <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.25} intensity={1.0} mipmapBlur />
      <HueSaturation ref={hue} hue={0} saturation={0} />
      <Vignette offset={0.3} darkness={0.5} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL ?? ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
// traffic + pedestrians (GHOSTTOWN cheat removes them)
function Population() {
  const ghost = useGame((s) => s.ghost)
  if (ghost) return null
  return <><Traffic count={LOW ? 24 : 40} /><Crowd /></>
}

export default function App() {
  const buildings = useMemo(makeCity, [])
  const trees = useMemo(() => makeStreetTrees(buildings), [buildings])
  const colliders = useMemo(() => buildings.concat(trees.palms.concat(trees.parks).map((t) => ({ x: t.x, z: t.z, w: 1.2, d: 1.2, tree: true }))), [buildings, trees])
  useEffect(() => { startMapBuild() }, [])
  return (
    <>
      <Canvas shadows camera={{ fov: 60, near: 0.5, far: 3500, position: [-3.5, 6, -26] }} dpr={LOW ? [1, 1.25] : [1, 1.5]} gl={{ antialias: false }}>
        <fogExp2 attach="fog" args={['#e0628c', 0.00105]} />
        <Atmosphere />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={5} color="#ff8a4d" position={[40, 20, 30]} scale={[60, 30, 1]} />
          <Lightformer form="rect" intensity={3} color="#ff3fa0" position={[-40, 14, 20]} scale={[50, 20, 1]} />
          <Lightformer form="rect" intensity={3} color="#19e8ff" position={[10, 14, -45]} scale={[60, 20, 1]} />
          <Lightformer form="rect" intensity={1.4} color="#a45bff" position={[0, 45, 0]} scale={[80, 80, 1]} />
        </Environment>
        <Sun />
        <Terrain />
        <Water />
        <Waterfalls />
        <Bridges />
        <Rocks />
        <City buildings={buildings} />
        <Trees list={trees.palms} kind="palm" />
        <Trees list={trees.parks} kind="round" />
        <Forest />
        <Population />
        <Police />
        <Combat />
        <Orbs />
        <Rain />
        <Snow />
        <Controller colliders={colliders} />
        <Post />
      </Canvas>
      <Hud />
    </>
  )
}
