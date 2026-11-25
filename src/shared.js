export const carPos = { x: 0, z: 0 }          // active entity (for shadows)
export const SUN = [90, 24, 70]               // low sun = golden hour (sunset)
export const LINES = [-200, -100, 0, 100, 200] // city road lines (grid, every 100 units)
export const traffic = []                     // NPC car positions (for collisions)
export const mission = { step: -1, timeLeft: 0 }   // runtime mission state (countdown) kept out of React
export const atm = { sunColor: '#ff7a4a', sunI: 2.6 }   // live atmosphere values (written by Atmosphere, read by Sun)
export const mapWp = { on: false, x: 0, z: 0 }   // waypoint set by clicking the big map

// ---- v12: police case, weapons, mouse-look ----
export const crowd = []                      // pedestrians (filled by Crowd): { x, z, down, group }
export const cops = []                       // police cars: { x, z, h, v, hp, dead, mode, axis, L, t, dir, cd }
export const law = { evade: 0, bust: 0, minD: 999, shove: null }
export const cam = { yaw: 0, pitch: 0.28, idle: 0, aim: 0, shake: 0 }   // mouse / stick camera angles
export const fxq = []                        // visual effect requests (tracers, flashes, explosions) read by Combat.jsx
export const wp = { mag: [0, 12, 30, 6, 1], reload: 0, cd: 0, idx: 0, infinite: false }   // weapon runtime state
export const worldRef = { colliders: [] }    // city colliders (set by App) for bullets and police cars

// ---- v13: touch controls (filled by TouchControls.jsx, read by the Controller every frame) ----
export const touch = { mx: 0, my: 0, lx: 0, ly: 0, fire: false, firePress: false, aim: false, jump: false, f: false }
