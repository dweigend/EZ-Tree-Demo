# Third-party asset attribution

This directory contains the vegetation, rock, and ground assets used by the landscape prototype.
The files are kept local so the runtime has no external asset dependency.

## EZ-Tree demo assets

Source: [dgreenheck/ez-tree](https://github.com/dgreenheck/ez-tree), revision
`dcf309bd86bd521083d9c70f01f2de45fdc7c457`.

The following files are copied from `src/app/public/` in the official repository:

- `vegetation/grass.glb`
- `vegetation/flower_white.glb`
- `vegetation/flower_yellow.glb`
- `vegetation/flower_blue.glb`
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

The files under `terrain/palette-desktop/` and `terrain/palette-pico/` are currently derived from
the three listed EZ-Tree terrain textures. `terrain/palette.json` records this placeholder status.
When regenerated through GPT Image and PATINA, the corresponding prompt, seed and Fal result metadata
must remain beside the source material before this attribution note is updated.

## Draco decoder

The local decoder files under `draco/` are copied from the installed Three.js package and originate
from [Google Draco](https://github.com/google/draco). Draco is licensed under Apache License 2.0;
the complete license is included in `licenses/DRACO-APACHE-2.0.txt`.
