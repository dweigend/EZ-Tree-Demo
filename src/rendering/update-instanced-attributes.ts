/**
 * Creates fixed-capacity InstancedMesh batches and finalises their populated buffer prefixes.
 * It follows Three.js update-range and bounding-sphere requirements without owning render-system state.
 */

import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  type BufferAttribute,
  type BufferGeometry,
  type Material,
} from 'three';

export function createDynamicInstancedMesh<
  TGeometry extends BufferGeometry,
  TMaterial extends Material | Material[],
>(geometry: TGeometry, material: TMaterial, capacity: number): InstancedMesh<TGeometry, TMaterial> {
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.count = 0;
  return mesh;
}

export function createDynamicScalarAttribute(capacity: number): InstancedBufferAttribute {
  return new InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage);
}

export function finaliseInstancedMesh(mesh: InstancedMesh, count: number, ...attributes: Array<BufferAttribute | undefined>): void {
  mesh.count = count;
  if (count === 0) return;
  updateAttributePrefix(mesh.instanceMatrix, count);
  if (mesh.instanceColor) updateAttributePrefix(mesh.instanceColor, count);
  for (const attribute of attributes) if (attribute) updateAttributePrefix(attribute, count);
  mesh.computeBoundingSphere();
}

function updateAttributePrefix(attribute: BufferAttribute, itemCount: number): void {
  // Capacity stays fixed, but only populated instance data crosses the CPU-GPU boundary after a rebuild.
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, itemCount * attribute.itemSize);
  attribute.needsUpdate = true;
}
