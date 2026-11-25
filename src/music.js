// =====================================================================
//  IN-GAME RADIO  (original music generated live with WebAudio - no files, no copyright issues)
//    1. NEON DRIVE      - 106 BPM synthwave: rolling bass, big saw lead, gated snare
//    2. MIDNIGHT TRAP   - 140 BPM dark trap: 808 sub bass, hi-hat rolls, bell melody
//    3. SUNSET FUNK     -  120 BPM disco-house: funky bass, chord stabs, offbeat hats
//  The radio switches station every ~32 bars. Press N for the next station, M to mute.
//
//  REAL SONGS: put licensed .mp3 files in public/music/ and a playlist.json (see public/music/README.txt).
//  If a playlist exists it is used instead of the generated stations (N = next song).
//
//  Music starts on the first key press / click (browsers block audio before that).
// =====================================================================
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
let STEP = 0.14                                      // length of one 16th note (set per station)
let ctx, master, filter, bus, padBus, revIn, delay, shaper, noise, timer, el
let on = true, started = false, armed = false, next = 0, stepNo = 0, stIdx = 0, real = false, tracks = [], ti = 0, label = ''
let last = { car: true, panel: false, passed: false }
const listeners = new Set()
const emit = () => listeners.forEach((f) => f({ on, name: label }))

// ---------- sound building blocks ----------
function tone(freq, t, dur, type, vol, o = {}) {
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.type = type; osc.frequency.value = freq; osc.detune.value = o.detune || 0
  if (o.glide) { osc.frequency.setValueAtTime(freq * o.glide, t); osc.frequency.exponentialRampToValueAtTime(freq, t + 0.07) }
  const a = o.att || 0.01
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur)
  let out = osc
  if (o.cut) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cut; osc.connect(f); out = f }
  if (o.drive) { out.connect(shaper); out = shaper }
  out.connect(g)
  g.connect(o.pump ? padBus : bus)
  if (o.echo) { const s = ctx.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(delay) }
  if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(revIn) }
  osc.start(t); osc.stop(t + a + dur + 0.05)
}
function lead(freq, t, dur, vol, cut = 3200) {            // fat detuned saw lead
  tone(freq, t, dur, 'sawtooth', vol, { detune: -9, cut, echo: 0.5, rev: 0.25, att: 0.02 })
  tone(freq, t, dur, 'square', vol * 0.5, { detune: 8, cut, echo: 0.4, rev: 0.2, att: 0.02 })
}
function pad(freq, t, dur, vol, cut = 900) {
  for (const d of [-10, 10]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter()
    o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = d
    f.type = 'lowpass'; f.frequency.value = cut
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur)
    o.connect(f); f.connect(g); g.connect(padBus)
    const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(revIn)
    o.start(t); o.stop(t + dur + 0.05)
  }
}
function pump(t, depth = 0.4) {                           // sidechain "pump": pads/arps duck on each kick
  padBus.gain.cancelScheduledValues(t)
  padBus.gain.setValueAtTime(depth, t); padBus.gain.linearRampToValueAtTime(1, t + STEP * 3.2)
}
function kick(t, vol = 0.95, doPump = true) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12)
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.34)
  hit(t, 0.012, 0.25, 2500)
  if (doPump) pump(t)
}
function hit(t, dur, vol, hp, lp = 0) {                   // noise burst (hats / snares / clicks)
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
  s.buffer = noise; f.type = lp ? 'bandpass' : 'highpass'; f.frequency.value = lp || hp
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f); f.connect(g); g.connect(bus)
  const r = ctx.createGain(); r.gain.value = dur > 0.12 ? 0.35 : 0.05; g.connect(r); r.connect(revIn)
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02)
}
const snare = (t, v = 0.34) => { hit(t, 0.22, v, 1400); tone(185, t, 0.1, 'triangle', v * 0.55) }
const clap = (t, v = 0.3) => { hit(t, 0.03, v, 0, 1500); hit(t + 0.012, 0.03, v, 0, 1500); hit(t + 0.026, 0.16, v, 0, 1300) }
const sub808 = (m, t, dur, vol = 0.55) => tone(mtof(m), t, dur, 'sine', vol, { glide: 1.7, drive: true, att: 0.005 })

// ---------- STATION 1: NEON DRIVE (synthwave) ----------
const Am = { b: 45, t: [57, 60, 64] }, F = { b: 41, t: [53, 57, 60] }, C = { b: 48, t: [55, 60, 64] }, G = { b: 43, t: [55, 59, 62] }, Em = { b: 40, t: [55, 59, 64] }
const NEON = [Am, F, C, G, Am, F, G, Em]
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2]
const NEON_LEAD = [
  [[0, 81, 4], [4, 79, 2], [6, 76, 2], [8, 79, 6]], [[0, 77, 4], [4, 81, 4], [8, 79, 2], [10, 77, 2], [12, 76, 4]],
  [[0, 76, 2], [2, 79, 2], [4, 84, 6], [10, 83, 2], [12, 79, 4]], [[0, 79, 4], [4, 83, 2], [6, 81, 2], [8, 79, 4], [12, 74, 4]],
  [[0, 81, 4], [4, 84, 4], [8, 83, 2], [10, 81, 2], [12, 79, 4]], [[0, 81, 2], [2, 84, 2], [4, 86, 6], [10, 84, 2], [12, 81, 4]],
  [[0, 83, 4], [4, 81, 2], [6, 79, 2], [8, 83, 6], [14, 86, 2]], [[0, 84, 4], [4, 83, 4], [8, 79, 8]],
]
function neon(t, n) {
  const lb = Math.floor(n / 16), s = n % 16, ch = NEON[lb % 8], solo = lb % 16 >= 8
  if (s % 4 === 0) kick(t)
  if (s === 4 || s === 12) { snare(t); clap(t, 0.12) }
  if (s % 2 === 0) hit(t, s === 14 ? 0.2 : 0.045, s === 14 ? 0.1 : 0.11, 7000)
  tone(mtof(ch.b + (s % 8 === 6 || s === 15 ? 12 : 0)), t, STEP * 0.85, 'sawtooth', s % 4 === 0 ? 0.2 : 0.14, { cut: s % 4 === 0 ? 900 : 420 })   // rolling bass
  const notes = [...ch.t, ch.t[0] + 12]
  tone(mtof(notes[ARP[s]] + 12), t, STEP * 1.5, 'triangle', 0.085, { echo: 0.45, pump: true, cut: 3800, rev: 0.15 })
  if (s === 0) ch.t.forEach((m) => pad(mtof(m), t, STEP * 16, 0.04))
  if (solo) NEON_LEAD[lb % 8].forEach(([st, m, len]) => { if (st === s) lead(mtof(m), t, STEP * len * 0.95, 0.07) })
}

// ---------- STATION 2: MIDNIGHT TRAP ----------
const TRAP = [{ b: 36, t: [60, 63, 67] }, { b: 32, t: [56, 60, 63] }, { b: 39, t: [63, 67, 70] }, { b: 34, t: [62, 65, 70] }]
const TRAP_MEL = [[[0, 79], [3, 75], [6, 72], [10, 75]], [[0, 80], [3, 77], [6, 72], [10, 77]], [[0, 79], [3, 75], [6, 70], [10, 75]], [[0, 74], [3, 77], [6, 82], [10, 77]]]
function trap(t, n) {
  const lb = Math.floor(n / 16), s = n % 16, ch = TRAP[lb % 4], odd = lb % 2 === 1
  if (s === 0 || s === 7 || s === 10) kick(t, 0.8, false)
  if (s === 8) { snare(t, 0.4); clap(t, 0.25) }
  if (s % 2 === 0) hit(t, 0.04, 0.09, 8000)
  if (odd && s >= 12) hit(t, 0.03, 0.08, 8000)                       // hat roll
  if (s === 6) hit(t, 0.18, 0.08, 7000)
  if (s === 0) sub808(ch.b, t, STEP * 7)
  if (s === 10) sub808(ch.b, t, STEP * 3)
  if (s === 14 && odd) sub808(ch.b + 7, t, STEP * 2)
  if (s === 0) ch.t.forEach((m) => pad(mtof(m - 12), t, STEP * 16, 0.045, 600))
  TRAP_MEL[lb % 4].forEach(([st, m]) => {                              // eerie bell
    if (st === s) { tone(mtof(m), t, 0.7, 'sine', 0.13, { rev: 0.7, echo: 0.35 }); tone(mtof(m + 12), t, 0.4, 'triangle', 0.04, { rev: 0.7 }) }
  })
}

// ---------- STATION 3: SUNSET FUNK (disco-house) ----------
const FUNK = [{ b: 45, t: [57, 60, 64, 67] }, { b: 38, t: [57, 60, 65, 69] }, { b: 43, t: [55, 59, 62, 65] }, { b: 48, t: [60, 64, 67, 71] }]
const BASS_PAT = { 0: 0, 3: 12, 6: 0, 8: 0, 11: 7, 14: 12 }
const RIFF = { 0: 3, 2: 2, 4: 1, 7: 2, 8: 3, 10: 1, 12: 2, 15: 0 }
function funk(t, n) {
  const lb = Math.floor(n / 16), s = n % 16, ch = FUNK[lb % 4], b = lb % 8 >= 4
  if (s % 4 === 0) kick(t, 0.9)
  if (s === 4 || s === 12) clap(t, 0.3)
  if (s % 4 === 2) hit(t, 0.09, 0.15, 6000)
  if (s % 2 === 1) hit(t, 0.03, 0.05, 8000)
  if (s in BASS_PAT) tone(mtof(ch.b + BASS_PAT[s]), t, STEP * 1.5, 'sawtooth', 0.2, { cut: 750, drive: true })
  if (s === 3 || s === 6 || s === 11) ch.t.forEach((m) => tone(mtof(m), t, STEP * 1.1, 'sawtooth', 0.04, { cut: 2600, pump: true, rev: 0.3 }))   // chord stabs
  if (s === 0) ch.t.forEach((m) => pad(mtof(m - 12), t, STEP * 16, 0.03, 700))
  if (b && s in RIFF) tone(mtof(ch.t[RIFF[s]] + 12), t, STEP * 1.8, 'triangle', 0.1, { echo: 0.5, rev: 0.3, cut: 4000 })
}

const STATIONS = [{ name: 'NEON DRIVE', bpm: 106, play: neon }, { name: 'MIDNIGHT TRAP', bpm: 140, play: trap }, { name: 'SUNSET FUNK', bpm: 120, play: funk }]

// ---------- engine ----------
function playStation(i) {
  stIdx = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length
  const S = STATIONS[stIdx]
  STEP = 60 / S.bpm / 4; delay.delayTime.value = STEP * 3
  stepNo = 0; next = ctx.currentTime + 0.1; label = S.name
  emit()
}
function tick() {
  const S = STATIONS[stIdx]
  while (next < ctx.currentTime + 0.18) {
    S.play(next, stepNo); next += STEP; stepNo++
    if (stepNo >= 16 * 32) { playStation(stIdx + 1); return }       // radio auto-switches after 32 bars
  }
}
function playTrack(i) {
  if (!tracks.length) return
  ti = ((i % tracks.length) + tracks.length) % tracks.length
  el.src = '/music/' + tracks[ti].file
  el.play().catch(() => {})
  label = tracks[ti].title || tracks[ti].file
  emit()
}
function apply() {
  if (!ctx) return
  const t = ctx.currentTime, k = real ? 1.5 : 1
  const level = !on ? 0 : last.passed ? 0.08 : (last.car ? 0.5 : 0.34) * k
  master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(level, t, 0.25)
  filter.frequency.cancelScheduledValues(t)
  filter.frequency.setTargetAtTime(last.panel ? 700 : last.car ? 14000 : 2800, t, 0.3)   // muffled on foot / reading a panel
}
async function start() {
  if (started) return
  started = true
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  master = ctx.createGain(); master.gain.value = 0
  filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 14000
  const comp = ctx.createDynamicsCompressor()
  bus = ctx.createGain(); padBus = ctx.createGain(); padBus.connect(bus)
  bus.connect(filter); filter.connect(master); master.connect(comp); comp.connect(ctx.destination)
  delay = ctx.createDelay(1); const fb = ctx.createGain(); fb.gain.value = 0.35
  delay.connect(fb); fb.connect(delay); delay.connect(bus)
  // reverb: generated impulse response
  const L = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, L, ctx.sampleRate)
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < L; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 2.6) }
  const conv = ctx.createConvolver(); conv.buffer = ir
  revIn = ctx.createGain(); const rg = ctx.createGain(); rg.gain.value = 0.5
  revIn.connect(conv); conv.connect(rg); rg.connect(bus)
  // soft-clip curve for 808 / bass warmth
  shaper = ctx.createWaveShaper()
  const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; cv[i] = Math.tanh(x * 2.4) }
  shaper.curve = cv
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

  try {   // optional real songs
    const r = await fetch('/music/playlist.json')
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      const j = await r.json()
      tracks = Array.isArray(j) ? j.filter((x) => x && x.file) : []
    }
  } catch (e) { /* no playlist */ }
  if (tracks.length) {
    real = true
    el = new Audio(); el.crossOrigin = 'anonymous'
    el.addEventListener('ended', () => playTrack(ti + 1))
    ctx.createMediaElementSource(el).connect(bus)
    playTrack(0)
  } else {
    playStation(0)
    timer = setInterval(tick, 30)
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume() })
  if (ctx.state === 'suspended') ctx.resume()
  apply()
}

export const music = {
  arm() {   // call once: starts the music on the player's first key press / click
    if (armed) return
    armed = true
    const go = () => { start(); window.removeEventListener('keydown', go); window.removeEventListener('pointerdown', go) }
    window.addEventListener('keydown', go); window.addEventListener('pointerdown', go)
  },
  toggle() { on = !on; if (!started) start(); apply(); emit() },
  next() { if (!started || !ctx) return; real ? playTrack(ti + 1) : playStation(stIdx + 1) },
  isOn: () => on,
  getName: () => label,
  subscribe(f) { listeners.add(f); return () => listeners.delete(f) },
  // car-radio feel: louder in the car, muffled on foot / in a panel, ducked for MISSION PASSED
  mood(car, panel, passed) {
    if (last.car === car && last.panel === panel && last.passed === passed) return
    last = { car, panel, passed }; apply()
  },
}
