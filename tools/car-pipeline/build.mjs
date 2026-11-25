import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { normals, flatten, weld, simplify, join, prune, dedup, textureCompress, meshopt, transformMesh, getBounds } from '@gltf-transform/functions'
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'fs'

const [,, input, out, removeRe, ratioArg, errArg, texArg, mode = 'hero', fracArg = '0.01'] = process.argv
const ratio = +ratioArg, error = +errArg, tex = +texArg
await MeshoptSimplifier.ready; await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(input)
const root = doc.getRoot()
const triCount = () => root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() / 3 : 0), 0), 0)
console.log('read; tris', Math.round(triCount()))

// 0) drop interior / hidden parts by node name (before flattening, so group names still exist)
{
  const re = new RegExp(removeRe, 'i'); let removed = 0
  const kill = (n) => { for (const c of n.listChildren()) kill(c); n.setMesh(null); removed++ }
  for (const n of root.listNodes()) if (re.test(n.getName())) kill(n)
  console.log('removed parts', removed)
  await doc.transform(prune())
  console.log('after removal tris', Math.round(triCount()))
}
// 1) bake every node transform into the vertices (flatten first, then apply + reset each node)
await doc.transform(flatten())
const used = new Map()
for (const n of root.listNodes()) { const m = n.getMesh(); if (m) used.set(m, (used.get(m) || 0) + 1) }
for (const n of root.listNodes()) {
  const m = n.getMesh(); if (!m) continue
  let mesh = m
  if (used.get(m) > 1) { mesh = m.clone(); n.setMesh(mesh); used.set(m, used.get(m) - 1) }   // shared mesh: give this node its own copy
  transformMesh(mesh, n.getMatrix())
  n.setTranslation([0, 0, 0]); n.setRotation([0, 0, 0, 1]); n.setScale([1, 1, 1])
}
console.log('baked')
{ // where are the front / rear parts? (to find which way the car faces)
  const cen = {}
  for (const n of root.listNodes()) { const m = n.getMesh(); if (!m || !/front.?bumper|rear.?bumper|head.?light|tail.?light|plate|grille|grid|exhaust|hood|bonnet/i.test(n.getName())) continue
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]
    for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), mn = a.getMin([]), mx = a.getMax([]); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], mn[k]); hi[k] = Math.max(hi[k], mx[k]) } }
    cen[n.getName().replace(/_\d+$/, '').slice(0, 22)] = [(lo[2] + hi[2]) / 2, (lo[0] + hi[0]) / 2].map((v) => +v.toFixed(4))
  }
  console.log('CENTROIDS (z,x):', JSON.stringify(cen).slice(0, 900))
}

// 2b) drop tiny parts (screws, badges, wires...) - they cost draw calls and are invisible from the game camera
{
  const b = getBounds(root.listScenes()[0]), L = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]), thr = L * +fracArg
  let dropped = 0
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const a = p.getAttribute('POSITION'), mn = a.getMin([]), mx = a.getMax([])
    if (Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) < thr) { m.removePrimitive(p); p.dispose(); dropped++ }
  }
  console.log('tiny primitives dropped', dropped)
}
// 3) materials: paint becomes a plain tintable material; glass becomes dark tinted glass (the interior is gone)
for (const m of root.listMaterials()) {
  const nm = m.getName()
  if (/^car_?paint$/i.test(nm)) { m.setName('PAINT'); m.setBaseColorTexture(null); m.setBaseColorFactor([1, 1, 1, 1]); m.setMetallicFactor(0.35); m.setRoughnessFactor(0.3); m.setMetallicRoughnessTexture(null); m.setNormalTexture(null); m.setOcclusionTexture(null) }
  else if (/glass|window/i.test(nm) && !/light|red|lens|bulb|indicator|fog|gauge/i.test(nm)) { m.setName('GLASS'); m.setBaseColorTexture(null); m.setBaseColorFactor([0.02, 0.04, 0.06, 0.9]); m.setAlphaMode('BLEND'); m.setMetallicFactor(0.9); m.setRoughnessFactor(0.06); m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setDoubleSided(false) }
}
if (mode === 'traffic') {   // few shared materials -> few draw calls
  const mk = (name, c, met, rough, em) => { const m = doc.createMaterial(name).setBaseColorFactor([...c, 1]).setMetallicFactor(met).setRoughnessFactor(rough); if (em) { m.setEmissiveFactor(em) } return m }
  const C = { PAINT: root.listMaterials().find((m) => m.getName() === 'PAINT'), GLASS: root.listMaterials().find((m) => m.getName() === 'GLASS'),
    CHROME: mk('CHROME', [0.85, 0.86, 0.88], 1, 0.22), DARK: mk('DARK', [0.06, 0.065, 0.075], 0.1, 0.7), HEAD: mk('HEAD', [1, 0.97, 0.85], 0, 0.3, [1, 0.95, 0.75]), TAIL: mk('TAIL', [0.9, 0.05, 0.05], 0, 0.4, [0.9, 0.05, 0.08]) }
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const old = p.getMaterial(), nm = old ? old.getName() : ''
    if (nm === 'PAINT' || nm === 'GLASS') continue
    const k = /tail|brake_?l|ref_red|red_glass|taillight|_re$|_re_|custom_re/i.test(nm) ? 'TAIL' : /head|lens|bulb|glow|indicator|ref_orange|ref_white|light_glass|fog/i.test(nm) ? 'HEAD' : /chrome|metal|alum|rim|trim|disc|steel|silver|stripes/i.test(nm) ? 'CHROME' : 'DARK'
    p.setMaterial(C[k])
  }
}
if (mode === 'hero') {   // triangle-soup meshes (split normals/UVs) cannot be simplified -> strip UVs/normals, weld by position, recompute smooth normals later
  const guess = (nm, c) => /carbon/i.test(nm) ? [0.07, 0.075, 0.085, 1, 0.5, 0.35] : /chrome/i.test(nm) ? [0.85, 0.86, 0.88, 1, 1, 0.18] : /alloy|brushed|silver|metal(?!_black)/i.test(nm) ? [0.62, 0.64, 0.68, 1, 1, 0.3] : /tyre|rubber|tire/i.test(nm) ? [0.03, 0.03, 0.035, 1, 0, 0.9] : /black|plastic|int|base/i.test(nm) ? [0.04, 0.042, 0.05, 1, 0.2, 0.55] : null
  for (const m of root.listMaterials()) {
    const g = m.getBaseColorTexture() ? guess(m.getName(), m.getBaseColorFactor()) : null
    m.setBaseColorTexture(null); m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null); m.setEmissiveTexture(null)
    if (g && m.getName() !== 'GLASS' && m.getName() !== 'PAINT') { m.setBaseColorFactor([g[0], g[1], g[2], g[3]]); m.setMetallicFactor(g[4]); m.setRoughnessFactor(g[5]) }
    else if (!m.getBaseColorTexture() && m.getName() !== 'GLASS' && m.getName() !== 'PAINT' && /tyre|rubber|tire/i.test(m.getName())) m.setBaseColorFactor([0.03, 0.03, 0.035, 1])
  }
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) for (const sem of p.listSemantics()) if (sem !== 'POSITION') p.setAttribute(sem, null)
}
await doc.transform(weld())
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: false }))
console.log('simplified, tris', Math.round(triCount()))
if (mode === 'hero') await doc.transform(normals({ overwrite: true }))
await doc.transform(join({ keepMeshes: false, keepNamed: false }), prune(), dedup())
console.log('joined; meshes', root.listMeshes().length, 'prims', root.listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0), 'tris', Math.round(triCount()))

// 4) dump vertices for orientation previews (before compression)
{
  const pts = []
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), mat = p.getMaterial(), bc = mat ? mat.getBaseColorFactor() : [0.5, 0.5, 0.5, 1]
    const step = Math.max(1, Math.floor(pos.getCount() / 6000)), v = [0, 0, 0]
    for (let i = 0; i < pos.getCount(); i += step) { pos.getElement(i, v); pts.push(v[0], v[1], v[2], bc[0], bc[1], bc[2], mat && mat.getName() === 'GLASS' ? 1 : 0) }
  }
  fs.writeFileSync(out + '_pts.bin', Buffer.from(new Float32Array(pts).buffer))
}
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 80 }))
fs.writeFileSync(out + '_stage.json', JSON.stringify({ bounds: getBounds(root.listScenes()[0]) }))
await io.write(out + '_stage.glb', doc)      // uncompressed intermediate (final = normalised + meshopt in finalize.mjs)
console.log('done', (fs.statSync(out + '_stage.glb').size / 1e6).toFixed(1), 'MB', JSON.stringify(getBounds(root.listScenes()[0])))
