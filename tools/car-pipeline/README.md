# Convert a heavy car model for the web

```bash
mkdir work && cd work && npm init -y && npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
cp ../tools/car-pipeline/*.mjs ../tools/car-pipeline/preview.py .
# FBX? convert first:  FBX2glTF --binary -i car.fbx -o car   (https://github.com/facebookincubator/FBX2glTF/releases)

# 1) clean + simplify   build.mjs <in.glb> <name> <regex of parts to delete> <ratio> <error> <texture px> <hero|traffic> <min part size>
node --max-old-space-size=8000 build.mjs car.glb mycar 'COCKPIT|Engine|WIPER|SUSP_' 0.05 0.05 1024 hero 0.006
#    hero    = one nice car (keeps many materials, strips UV/normals so it simplifies well, recomputes smooth normals)
#    traffic = tiny + few draw calls (merges to PAINT / GLASS / CHROME / DARK / HEAD / TAIL)
# 2) look at mycar_prev.png (python3 preview.py mycar) to see which way the car faces; the game needs FRONT = +Z, UP = +Y
# 3) scale + centre + compress   finalize.mjs <in_stage.glb> <out.glb> <real length in metres>
node finalize.mjs mycar_stage.glb ../public/models/mycar.glb 4.7
```
The body paint material must be called `Carpaint` / `CarPaint` (it is renamed `PAINT`) so the paint cheats and random traffic colours work.
