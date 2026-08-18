<!--
Purpose: Defines the verified implementation state and the remaining physical-device acceptance gate.
Context: Dense forests, fixed quality profiles, four terrain materials, and benchmark evidence now share one lifecycle.
Boundary: Desktop evidence and generated placeholders do not claim PATINA quality or physical PICO acceptance.
-->

# Landscape implementation handoff

## Implemented

- immutable `desktop` and `pico90` startup profiles;
- minimal WebXR entry with local-floor tracking, fixed foveation, framebuffer scale and 90 Hz request;
- three reusable EZ-Tree silhouettes instead of eight, hard LODs, no far branches and one shared far crown;
- deterministic tree density ranks, making PICO placement a stable subset of desktop placement;
- four normalized terrain weights in absolute world coordinates and a fixed 2×2 material atlas;
- three texture samples on PICO, four on desktop, with offline roughness constants;
- ten GPT/PATINA candidate definitions plus credential-gated generation and atlas scripts;
- Bun unit tests and Playwright static, flight and PICO-profile performance tests.

## Verified locally

`bun run test`, `bun run check`, `bun run build`, `bun run test:browser` and `git diff --check` are the
required local gate. Current measured values are recorded in `docs/PERFORMANCE.md`.

## Remaining external gates

The environment did not provide `OPENAI_API_KEY` or `FAL_KEY`. Runtime atlases therefore contain the
documented placeholder material until `bun run assets:all` successfully produces and validates all ten
candidates. Generated GPT references are project sources and should be reviewed before committing.

Physical PICO 4 validation is also still required. A desktop browser cannot establish 90 Hz, thermal
stability, comfort, stereo quality or reliable WebXR enter/exit behavior.

## KISS boundary

Do not add a biome manager, material registry, runtime palette switching, adaptive quality controller,
crossfade LODs or regional tree batches without a measured failure in the current implementation. KTX2
remains evidence-gated; the fixed PNG/WebP atlases are sufficient for the present memory and load budget.
