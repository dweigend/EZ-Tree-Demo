# Vendored EZ-Tree runtime

This package is the unmodified ES-module library build produced from the official
[`dgreenheck/ez-tree`](https://github.com/dgreenheck/ez-tree) repository at commit
`dcf309bd86bd521083d9c70f01f2de45fdc7c457` (2026-07-16).

It is pinned locally because npm release 1.1.0 predates the generator used by the current
`eztree.dev` app. In particular, the website source includes skeleton-based `createGeometry()` and
`generateLODs()`, rounded leaf normals, caller-supplied PBR maps, and updated presets that are absent
from the published package build. The bundle was produced with the upstream `npm run build:lib`
workflow. No project-specific code is added here.

The application uses the library generator only. The separate editor UI, scene, camera, export,
and demo environment remain upstream and are intentionally not duplicated into the landscape.
