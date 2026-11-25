import { useEffect, useRef } from 'react'
import { useGame } from './store'
import { touch } from './shared'
import { isTouch } from './device'
import { WEAPONS, reloadNow } from './weapons'
import { music } from './music'

// =====================================================================
//  TOUCH CONTROLS (phones / tablets)
//   left thumb : floating joystick (appears where you touch) - on foot: move, in the car: steer + gas/brake. Push to the edge = run.
//   right thumb: drag anywhere on the right side = look around; buttons: FIRE (hold), JUMP / BRAKE (hold), CAR in/out, USE (E),
//                AIM (toggle), weapon switch, reload. Top right: map, cheat list (tap a cheat to run it), music, fullscreen.
// =====================================================================
const R = 58
function toggleFullscreen() {
  const d = document, el = d.documentElement
  if (!d.fullscreenElement && !d.webkitFullscreenElement) {
    const go = el.requestFullscreen || el.webkitRequestFullscreen
    if (go) { const p = go.call(el); if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}) }).catch(() => {}) }
  } else (d.exitFullscreen || d.webkitExitFullscreen).call(d)
}

export function TouchControls() {
  const g = useGame()
  const stick = useRef({ id: null, ox: 0, oy: 0 }), look = useRef({ id: null, x: 0, y: 0 })
  const base = useRef(), knob = useRef(), hint = useRef(), aimBtn = useRef()
  const hidden = !isTouch || !g.started || !!g.panel || g.mapOpen || g.passed || g.help
  useEffect(() => {      // controls vanish while a panel / the map is open: release everything
    if (hidden) { touch.mx = touch.my = touch.lx = touch.ly = 0; touch.fire = touch.jump = touch.aim = false; stick.current.id = null; look.current.id = null }
  }, [hidden])
  if (hidden) return null

  const sDown = (e) => {
    e.preventDefault()
    const s = stick.current; if (s.id !== null) return
    s.id = e.pointerId; s.ox = e.clientX; s.oy = e.clientY
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId)
    const b = base.current; b.style.display = 'block'; b.style.left = e.clientX - R + 'px'; b.style.top = e.clientY - R + 'px'
    knob.current.style.transform = 'translate(0px,0px)'; hint.current.style.opacity = 0
  }
  const sMove = (e) => {
    const s = stick.current; if (e.pointerId !== s.id) return
    let dx = e.clientX - s.ox, dy = e.clientY - s.oy
    const l = Math.hypot(dx, dy), k = l > R ? R / l : 1
    dx *= k; dy *= k
    knob.current.style.transform = `translate(${dx}px,${dy}px)`
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v)
    touch.mx = dz(dx / R); touch.my = dz(-dy / R)
  }
  const sUp = (e) => {
    if (e.pointerId !== stick.current.id) return
    stick.current.id = null; touch.mx = 0; touch.my = 0
    base.current.style.display = 'none'; hint.current.style.opacity = 1
  }
  const lDown = (e) => { e.preventDefault(); if (look.current.id !== null) return; look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId) }
  const lMove = (e) => { const l = look.current; if (e.pointerId !== l.id) return; touch.lx += e.clientX - l.x; touch.ly += e.clientY - l.y; l.x = e.clientX; l.y = e.clientY }
  const lUp = (e) => { if (e.pointerId === look.current.id) look.current = { id: null, x: 0, y: 0 } }

  const hold = (key) => ({
    onPointerDown: (e) => { e.preventDefault(); if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); touch[key] = true; if (key === 'fire') touch.firePress = true },
    onPointerUp: () => { touch[key] = false }, onPointerCancel: () => { touch[key] = false }, onLostPointerCapture: () => { touch[key] = false },
  })
  const tap = (fn) => ({ onPointerDown: (e) => { e.preventDefault(); fn() } })
  const car = g.mode === 'car'

  return (
    <div className="touchui">
      <div className="tzone tlook" onPointerDown={lDown} onPointerMove={lMove} onPointerUp={lUp} onPointerCancel={lUp} />
      <div className="tzone tstick" onPointerDown={sDown} onPointerMove={sMove} onPointerUp={sUp} onPointerCancel={sUp} />
      <div className="tstickhint" ref={hint}><i /></div>
      <div className="tbase" ref={base}><i ref={knob} /></div>

      <div className="tmenu">
        <button className="tm" {...tap(() => g.toggleMap())}>🗺</button>
        <button className="tm" {...tap(() => g.toggleHelp())}>⌨</button>
        <button className="tm" {...tap(() => music.toggle())}>♪</button>
        <button className="tm" {...tap(toggleFullscreen)}>⛶</button>
      </div>

      <button className="tb tfire" {...hold('fire')}>{g.weapon === 0 ? 'PUNCH' : 'FIRE'}</button>
      <button className="tb tjump" {...hold('jump')}>{car ? 'BRAKE' : 'JUMP'}</button>
      <button className="tb tcar" {...tap(() => { touch.f = true })}>{car ? 'EXIT' : 'CAR'}</button>
      <button className="tb tuse" {...tap(() => (g.panel ? g.close() : g.open()))}>USE</button>
      <button className="tb taim" ref={aimBtn} {...tap(() => { touch.aim = !touch.aim; aimBtn.current.classList.toggle('on', touch.aim) })}>AIM</button>
      <button className="tb twpn" {...tap(() => g.nextWeapon(1))}><b>{WEAPONS[g.weapon].name}</b>{g.weapon > 0 && <span id="ammo" />}</button>
      <button className="tb trel" {...tap(() => reloadNow())}>↻</button>
      <div className="trotate">↻ Turn your phone sideways for the best view</div>
    </div>
  )
}
