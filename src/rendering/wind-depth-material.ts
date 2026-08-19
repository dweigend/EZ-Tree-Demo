/**
 * Creates an alpha-cutout depth material that reuses a surface material's vertex deformation hook.
 * The caller owns the returned GPU material and must dispose it with the shadow-casting mesh.
 */

import { MeshDepthMaterial, RGBADepthPacking, type MeshStandardMaterial } from 'three';

export function createWindDepthMaterial(source: MeshStandardMaterial): MeshDepthMaterial {
  const material = new MeshDepthMaterial({
    alphaMap: source.alphaMap,
    alphaTest: source.alphaTest,
    depthPacking: RGBADepthPacking,
    map: source.map,
    side: source.side,
  });
  material.onBeforeCompile = source.onBeforeCompile;
  material.customProgramCacheKey = () => `wind-depth-${source.customProgramCacheKey()}`;
  return material;
}
