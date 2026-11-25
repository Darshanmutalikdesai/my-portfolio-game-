// Tiny synthesized sound effects (WebAudio, no files): gunshots, explosion, punch, siren.
let ctx = null, siren = null
const ac = () => {
  if (typeof window === 'undefined') return null
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A() }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}
function burst(dur, { gain = 0.5, lp = 3000, hp = 0, tone = 0 } = {}) {
  const a = ac(); if (!a) return
  const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2)
  const src = a.createBufferSource(); src.buffer = buf
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp
  const g = a.createGain(); g.gain.value = gain
  let node = src.connect(f)
  if (hp) { const h = a.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; node = node.connect(h) }
  node.connect(g).connect(a.destination); src.start()
  if (tone) { const o = a.createOscillator(), og = a.createGain(); o.frequency.setValueAtTime(tone, a.currentTime); o.frequency.exponentialRampToValueAtTime(40, a.currentTime + dur); og.gain.setValueAtTime(gain * 0.6, a.currentTime); og.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur); o.connect(og).connect(a.destination); o.start(); o.stop(a.currentTime + dur) }
}
export const sfx = {
  shoot(kind) {
    if (kind === 'pistol') burst(0.14, { gain: 0.45, lp: 5000, hp: 300, tone: 240 })
    else if (kind === 'smg') burst(0.08, { gain: 0.32, lp: 4500, hp: 400, tone: 200 })
    else if (kind === 'shotgun') burst(0.32, { gain: 0.7, lp: 2600, tone: 140 })
    else burst(0.5, { gain: 0.45, lp: 900, tone: 120 })           // rocket launch
  },
  boom() { burst(1.2, { gain: 1, lp: 600, tone: 90 }) },
  punch() { burst(0.09, { gain: 0.5, lp: 700 }) },
  hit() { burst(0.12, { gain: 0.35, lp: 500 }) },
  sirenVol(v) {                                                   // police siren whose volume follows the nearest cop (0 = off)
    const a = ac(); if (!a) return
    if (v <= 0.02) { if (siren) { siren.g.gain.value = 0 } return }
    if (!siren) {
      const o = a.createOscillator(), l = a.createOscillator(), lg = a.createGain(), g = a.createGain()
      o.type = 'sawtooth'; o.frequency.value = 800; l.frequency.value = 1.4; lg.gain.value = 250
      l.connect(lg).connect(o.frequency); o.connect(g).connect(a.destination); o.start(); l.start()
      siren = { g }
    }
    siren.g.gain.value = 0.02 + 0.05 * v
  },
}
