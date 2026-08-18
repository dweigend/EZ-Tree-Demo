<!--
Purpose: Defines the verified interim baseline and the narrow scope for the next landscape iteration.
Context: The first shared-ecology experiment regressed both visual density and frame stability.
Boundary: This is evidence and sequencing guidance, not a specification for a new framework.
-->

# Landscape checkpoint handoff

## Verified interim state

The unsuccessful ecology, clustering, lake-rendering, and expanded configuration experiment was
reverted through Git. The source now matches `ea4fd88` except for one focused runtime improvement:

- tree prefetch, ground-cover prefetch, and terrain streaming alternate in a three-step round robin;
- Three.js compiles scene shaders before the animation loop starts.

This restores the denser known-good ground layer and removes unused feature contracts, duplicate
placement rules, and higher candidate densities introduced by the experiment.

## Evidence

Desktop Chromium, 1280×720, default seed and view, 12-second forward flight at 220 m/s:

| Metric | Checkpoint |
|---|---:|
| average frame time | 10.68 ms |
| p99 frame time | 19.2 ms |
| maximum frame time | 22.9 ms |
| frames over 20 ms | 4 |
| draw calls after flight | 60 |
| triangles after flight | 1.28 M |

Static default view after warm-up: 287 trees, 15,227 grass instances, 264 flowers, 205 rocks,
60 draw calls, and 2.03 M triangles. These browser measurements are comparative desktop evidence,
not WebXR acceptance.

Validation commands:

```bash
bun run check
bun run build
git diff --check
```

## Known visual issue

Trees remain the weakest layer: crowns look thin at normal flight distance and the forest lacks
convincing dense groups. This predates the reverted ecology experiment and should be the first,
isolated visual task in the next iteration.

## Next iteration: strict KISS sequence

1. Freeze one camera position, screenshot, and frame-time budget.
2. Improve only the existing official EZ-Tree preset selection and leaf LOD silhouette. Do not add
   another distribution system in the same change.
3. Measure and checkpoint.
4. Adjust only the existing forest probability field to create denser cores and larger clearings.
5. Measure and checkpoint.
6. Cluster grass, flowers, and rocks one owner at a time. Reuse `HeightField` noise and delete the
   previous owner-local rule when a shared rule replaces it.

Do not reintroduce feature managers, generic schedulers, unused toggles, a second world lifecycle,
or a broad ecology abstraction before a single layer proves the need. Every new placement pass must
replace existing work and show a visual improvement without exceeding the checkpoint frame budget.
