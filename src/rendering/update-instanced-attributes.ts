/**
 * Marks only the populated prefix of a dynamic instance attribute for upload.
 * It wraps Three.js update ranges; ownership and allocation stay with each render system.
 */

import type { BufferAttribute } from 'three';

export function updateAttributePrefix(attribute: BufferAttribute, itemCount: number): void {
  if (itemCount <= 0) return;
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, itemCount * attribute.itemSize);
  attribute.needsUpdate = true;
}
