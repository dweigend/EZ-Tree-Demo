# EZ-Tree World

Experimental WebGL2 prototype of a practically endless, procedurally generated landscape with freely controlled flight, streamed terrain chunks, and instanced vegetation made from licensed assets.

## Getting started

```bash
bun install
bun run dev
```

Production checks:

```bash
bun run check
bun run build
```

The view distance can be set to a validated value between 720 and 1500 metres at startup. Fog,
the terrain window, and vegetation LOD are derived from it together. `relief` scales the large
hills and valleys between `0.7` and `1.4`:

```text
http://localhost:5173/?distance=900
http://localhost:5173/?distance=1200&fog=0.0014
http://localhost:5173/?distance=900&relief=1.25
```

Two immutable startup profiles keep the quality decision predictable. The PICO profile also
enables the minimal WebXR entry point and requests 90 Hz on supported devices:

```text
http://localhost:5173/?profile=desktop
https://<device-reachable-host>/?profile=pico90
```

Reproducible flight measurements run without Pointer Lock via `benchmark=desktop-flight` or
`benchmark=xr-flight`. Measurements are exposed through `window.__LANDSCAPE_BENCHMARK__`. Flight runs
at 320 m/s. `variantStress=1` shortens the worker interval to two seconds for tests only.

## Controls

- Click: Pointer Lock
- WASD: forward, backward, and sideways movement
- Mouse: look direction
- Space / Shift: ascend / descend
- Mouse wheel: flight speed
- Escape: release Pointer Lock

## Architecture

- `terrain/`: continuous height field, recycled chunks, and eight softly zoned atlas materials
- `ecology/`: six shared continuous zone fields without system-specific placement rules
- `trees/`: all 16 official EZ-Tree presets, four tree slots, hedges, hard LODs, and a variant worker
- `vegetation/`: deterministic rock distribution in three global ground-cover batches
- `grass/`: organic meadow mask, composed patch clusters, and larger tufts in two instancing batches
- `wind/`: shared time, direction, gust, and spatial-phase contract for trees and both grass layers
- `controls/`: isolated Pointer Lock flight controls
- `rendering/`: WebGL2, color management, atmospheric sky, fog, and limited shadows
- `world/`: explicit frame order and lifecycle

All repeated model assets are grouped into a fixed-size `InstancedMesh` for each
geometry/material/LOD combination. Only the matrix, color, and wind values vary per instance.
Terrain chunks remain recycled individual meshes because each chunk carries its own vertex heights and ground weights.

Meadow, wetlands, dry and wet deciduous forest, conifer uplands, and rocky ridges are softly weighted
from elevation, slope, moisture, and woodland. The weights are computed only when a chunk is assigned.
The shader blends continuous macro colors derived from the eight textures with neutral albedo microdetail
and reads normals/roughness only from the dominant zone-appropriate surface cell.
This keeps transitions free of top-N contours while still using one albedo and one surface sample each.

## Building terrain materials

The active palette uses eight local Poly Haven CC0 materials, including Forest Ground 03 for
conifer ground. Sources, authors, tiling, and download URLs are listed in
`assets/source/landscape/terrain-materials/terrain-textures.config.json`. ImageMagick packs them into
a shared 1536² terrain atlas for desktop and PICO:

```bash
bun run assets:all
```

`assets:all` and `assets:atlas` build exclusively from the checked-in source files and require no
network or API access. The previous GPT/PATINA scripts remain available as separate experiments,
but are not part of the active runtime build.

## Tests

```bash
bun run test
bun run check
bun run build
bun run test:browser
```

The browser test checks static dense forest, a 12-second flight at 320 m/s, worker stress, and
the PICO geometry budgets.
Physical PICO-90 approval remains a separate hardware test as described in `docs/PERFORMANCE.md`.

After startup, exactly one Web Worker generates a new, topologically bounded preset variant every
30 seconds on desktop and every 60 seconds on PICO. The main scene accepts only transferred Typed Arrays
and replaces near geometry only after the affected slot was invisible in the previous window. There is
no synchronous fallback. Terrain edges disappear into coordinated fog and sky; forest and ground-cover
data are prioritized in the direction of travel before chunk changes.

## Dependencies

- Three.js
- [EZ-Tree](https://github.com/dgreenheck/ez-tree), MIT License, Daniel Greenheck
- [Poly Pizza](https://poly.pizza/), Grass Patch and Tuft of grass (CC BY 3.0), plus three Quaternius rocks (CC0 1.0)

Vegetation, rock, and ground assets are served locally. Their sources and licenses are documented in
[`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md).

Measured budgets and prioritized next optimizations are listed in [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md).
The current handoff state, performance invariants, and known limitations are documented in
[`docs/HANDOFF.md`](docs/HANDOFF.md).
