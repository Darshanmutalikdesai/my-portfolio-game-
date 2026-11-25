import { create } from 'zustand'
import { ZONES } from './data'

let bannerTimer
export const CAR_COLORS = ['#d4161f', '#ff77b0', '#ffd24d', '#19e8ff', '#1b1b22', '#f4f1ea', '#a64bff', '#7dff6b']
// step = how many chapters are unlocked (ZONES[step] is the current mission; step === ZONES.length means all done)
export const useGame = create((set, get) => ({
  zone: null, panel: null, mode: 'car', nearCar: false,
  step: 0, got: [], fast: false, banner: null, passed: false,
  started: false, help: false, tod: 'sunset', rain: false, nitro: false, moon: false, colorIdx: 0, tp: null,
  wanted: 0, hits: 0, weapon: 0, cash: 1500, pad: false, lock: false,
  fly: false, monster: false, tiny: false, phantom: false, disco: false, snow: false, ghost: false, slow: false, gold: false, mapOpen: false,
  setWeapon: (weapon) => set({ weapon }),
  nextWeapon: (d) => set((s) => ({ weapon: (s.weapon + d + 5) % 5 })),
  setPad: (pad) => set({ pad }),
  toggleMap: () => set((s) => ({ mapOpen: !s.mapOpen })),
  setSize: (k) => set((s) => (k === 'monster' ? { monster: !s.monster, tiny: false } : { tiny: !s.tiny, monster: false })),
  start: () => set({ started: true }),
  setZone: (zone) => set({ zone }),
  setMode: (mode) => set({ mode }),
  setNear: (nearCar) => set({ nearCar }),
  // only chapters that are already unlocked can be opened
  open: () => set((s) => {
    if (s.passed) return {}
    if (s.wanted > 0) { get().say('🚨 CLOSE THE CASE FIRST · lose the police or get busted'); return {} }   // an open police case blocks the portfolio
 const i = ZONES.findIndex((z) => z.id === s.zone); return i >= 0 && i < s.step ? { panel: s.zone } : {} }),
  close: () => set({ panel: null }),
  collect: (i) => set((s) => (s.got.includes(i) ? {} : { got: [...s.got, i] })),
  resetOrbs: () => set({ got: [] }),
  setFast: (fast) => set({ fast }),
  toggleHelp: () => set((s) => ({ help: !s.help })),
  clearTp: () => set({ tp: null }),
  say: (msg) => { set({ banner: msg }); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => set({ banner: null }), 3800) },
  unlock: (i) => {
    if (get().step !== i) return
    if (i === ZONES.length - 1) {
      // last chapter: full-screen "MISSION PASSED" first, then the final panel opens
      set({ step: i + 1, got: [], fast: false, panel: null, passed: true, banner: null })
      clearTimeout(bannerTimer)
      setTimeout(() => set({ passed: false, panel: ZONES[i].id }), 6000)
      return
    }
    set({ step: i + 1, got: [], fast: false, panel: ZONES[i].id })
    get().say('CHAPTER UNLOCKED · ' + ZONES[i].title)
  },
  // ---- cheats (typed on the keyboard, see cheats.js) ----
  unlockAll: () => set({ step: ZONES.length, got: [], fast: false, panel: null }),
  toggle: (k) => set((s) => ({ [k]: !s[k] })),
  setTod: (tod) => set({ tod }),
  paint: () => set((s) => ({ colorIdx: (s.colorIdx + 1) % CAR_COLORS.length, gold: false })),
  teleport: (x, z) => set({ tp: { x, z } }),
}))
