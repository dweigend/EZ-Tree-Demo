# Third-party asset attribution

The project keeps third-party landscape originals under `assets/source/landscape/` and deploys the
runtime copies under `public/assets/landscape/`, so the application has no external asset dependency.

## EZ-Tree demo assets

Source: [dgreenheck/ez-tree](https://github.com/dgreenheck/ez-tree), revision
`dcf309bd86bd521083d9c70f01f2de45fdc7c457`.

The tree texture originals under `assets/source/landscape/trees/` are copied from
`src/app/public/` in the official repository:

- `trees/bark/bark-001/`
- `trees/bark/bark-002/`
- `trees/bark/bark-003/`
- `trees/leaves/{ash,aspen,oak,pine}-albedo-alpha.png`

EZ-Tree is Copyright (c) 2024 Daniel Greenheck and licensed under the MIT License. The complete
license is included in `assets/source/landscape/licenses/EZ-TREE-MIT.txt`. Texture provenance is
documented in `assets/source/landscape/licenses/EZ-TREE-TEXTURES.md`.

The official generator build from the same revision is pinned under `vendor/ez-tree/`, because the
current website generator has not yet been published as a newer npm version. Bark textures originate
from ambientCG and are CC0; leaf textures are covered by the EZ-Tree project license.

## Poly Pizza rock assets

- `models/rock-medium-a.glb`: ["Rock Medium" by Quaternius](https://poly.pizza/m/KZdEP3uUpa), CC0 1.0.
- `models/rock-small.glb`: ["Rock" by Quaternius](https://poly.pizza/m/4MUaQTcDdc), CC0 1.0.
- `models/rock-medium-b.glb`: ["Rock Medium" by Quaternius](https://poly.pizza/m/s1OJ3bBzqc), CC0 1.0.

All three files are unmodified source downloads. They contain 244, 162, and 342 triangles. Runtime code
only normalises their diameter and instances them; it does not decimate or rewrite their watertight topology.

## Poly Pizza grass assets

- `models/meadow-patch.glb`: ["Grass Patch" by Danni Bittman](https://poly.pizza/m/dz_TvM39dC7),
  licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- `models/grass-tuft.glb`: ["Tuft of grass" by Poly by Google](https://poly.pizza/m/3tyh15Fbmsx),
  licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

Both files are unmodified source downloads. Runtime normalisation, instancing, colour variation, and
wind deformation happen in code without producing derivative asset files.

## Poly Haven terrain materials

The source maps under `assets/source/landscape/terrain-materials/polyhaven/` and the derived atlases
under `public/assets/landscape/terrain/{desktop,pico90}/` use these Poly Haven assets:

- [Leafy Grass](https://polyhaven.com/a/leafy_grass), Charlotte Baglioni
- [Brown Mud 02](https://polyhaven.com/a/brown_mud_02), Rob Tuytel
- [Dry Decay Leaves](https://polyhaven.com/a/dry_decay_leaves), Amal Kumar
- [Forest Leaves 02](https://polyhaven.com/a/forest_leaves_02), Rob Tuytel
- [Forest Ground 01](https://polyhaven.com/a/forrest_ground_01), Rob Tuytel
- [Forest Ground 03](https://polyhaven.com/a/forrest_ground_03), Rob Tuytel
- [Rocky Terrain 03](https://polyhaven.com/a/rocky_terrain_03), Amal Kumar
- [Rocky Trail](https://polyhaven.com/a/rocky_trail), Amal Kumar

All eight assets are licensed under [CC0](https://polyhaven.com/license). The checked-in source
manifest preserves the exact 1K download URLs and material order. Each material mirrors diffuse,
OpenGL normal, displacement/height, and roughness maps. The runtime surface atlases pack normal X/Y
into RG, height into B, and roughness into A; normal Z is reconstructed in the terrain shader.
