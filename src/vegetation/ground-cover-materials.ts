/**
 * Creates shared rock materials for instanced ground-cover batches.
 * Imported PBR maps are retained while colour variation is supplied per instance.
 */

import { MeshStandardMaterial } from 'three';

export function createRockMaterial(source: MeshStandardMaterial): MeshStandardMaterial {
  const material = source.clone();
  material.roughness = 0.94;
  material.metalness = 0;
  material.vertexColors = true;
  return material;
}
