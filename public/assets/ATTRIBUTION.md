# Third-party asset attribution

This directory contains the vegetation, rock, and ground assets used by the landscape prototype.
The files are kept local so the runtime has no external asset dependency.

## EZ-Tree demo assets

Source: [dgreenheck/ez-tree](https://github.com/dgreenheck/ez-tree), revision
`dcf309bd86bd521083d9c70f01f2de45fdc7c457`.

The following files are copied from `src/app/public/` in the official repository:

- `rocks/rock1.glb`
- `rocks/rock2.glb`
- `rocks/rock3.glb`
- `terrain/grass.jpg`
- `terrain/dirt_color.jpg`
- `terrain/dirt_normal.jpg`

EZ-Tree is Copyright (c) 2024 Daniel Greenheck and licensed under the MIT License. The complete
license is included in `licenses/EZ-TREE-MIT.txt`. Texture provenance is documented in
`licenses/EZ-TREE-TEXTURES.md`.

Tree bark and leaf textures are consumed from the installed `@dgreenheck/ez-tree` package rather
than duplicated here. Bark textures originate from ambientCG and are CC0; leaf textures are
covered by the EZ-Tree project license.

## Poly Pizza grass assets

- `vegetation/grass-patch.glb`: ["Grass Patch" by Danni Bittman](https://poly.pizza/m/dz_TvM39dC7),
  licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- `vegetation/grass-tuft.glb`: ["Tuft of grass" by Poly by Google](https://poly.pizza/m/3tyh15Fbmsx),
  licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

Both files are unmodified source downloads. Runtime normalisation, instancing, colour variation, and
wind deformation happen in code without producing derivative asset files.

## Poly Haven terrain materials

The source maps under `assets/source/terrain-materials/polyhaven/` and the derived atlases under
`terrain/palette-desktop/` and `terrain/palette-pico/` use these Poly Haven assets:

- [Sparse Grass](https://polyhaven.com/a/sparse_grass), Amal Kumar
- [Brown Mud 02](https://polyhaven.com/a/brown_mud_02), Rob Tuytel
- [Dry Decay Leaves](https://polyhaven.com/a/dry_decay_leaves), Amal Kumar
- [Forest Leaves 02](https://polyhaven.com/a/forest_leaves_02), Rob Tuytel
- [Forest Ground 01](https://polyhaven.com/a/forrest_ground_01), Rob Tuytel
- [Rocky Terrain 03](https://polyhaven.com/a/rocky_terrain_03), Amal Kumar
- [Rocky Trail](https://polyhaven.com/a/rocky_trail), Amal Kumar

All seven assets are licensed under [CC0](https://polyhaven.com/license). The checked-in source
manifest preserves the exact download URLs and material order. The runtime atlases contain resized
base-colour maps. Their surface atlases pack tangent-space normals into RGB and the corresponding
spatial roughness maps into alpha, preserving both properties without another runtime texture sample.

## Draco decoder

The local decoder files under `draco/` are copied from the installed Three.js package and originate
from [Google Draco](https://github.com/google/draco). Draco is licensed under Apache License 2.0;
the complete license is included in `licenses/DRACO-APACHE-2.0.txt`.
