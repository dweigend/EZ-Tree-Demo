/**
 * Creates dynamic scalar attributes and finalises populated InstancedMesh buffers.
 * It follows Three.js update-range and bounding-sphere requirements without owning render-system state.
 */

import { DynamicDrawUsage, InstancedBufferAttribute, type BufferAttribute, type InstancedMesh } from 'three';

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
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, itemCount * attribute.itemSize);
  attribute.needsUpdate = true;
}
