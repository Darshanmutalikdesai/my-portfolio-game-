import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { transformMesh, getBounds, meshopt, prune } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import fs from 'fs'
const [,, input, output, lengthArg] = process.argv
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(input), root = doc.getRoot(), scene = root.listScenes()[0]
let b = getBounds(scene)
const len = b.max[2] - b.min[2], s = +lengthArg / len
const cx = (b.max[0] + b.min[0]) / 2, cz = (b.max[2] + b.min[2]) / 2
const M = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -s * cx, -s * b.min[1], -s * cz, 1]
for (const m of root.listMeshes()) transformMesh(m, M)
await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
b = getBounds(scene)
await io.write(output, doc)
console.log(output, (fs.statSync(output).size / 1e6).toFixed(2) + ' MB', 'scale', s.toFixed(3), 'bounds', JSON.stringify(b.min.map((v) => +v.toFixed(2))), JSON.stringify(b.max.map((v) => +v.toFixed(2))))
