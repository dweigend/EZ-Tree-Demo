/**
 * Normalises EZ-Tree geometry, derives bounded LODs, and serialises buffers for worker transfer.
 * It has no EZ-Tree or DOM dependency so the same geometry contract works on both threads.
 */

import { BufferAttribute, BufferGeometry, CylinderGeometry, Matrix4 } from 'three';
import type { SerializedGeometry, SerializedGeometryPair, SerializedTreeLods } from './tree-variant-contract';

export type TreeLod = 'near' | 'middle' | 'far';

export interface TreeGeometryPair {
  readonly branches: BufferGeometry;
  readonly leaves: BufferGeometry;
}

export function normaliseTreeGeometry(
  branchSource: BufferGeometry,
  leafSource: BufferGeometry,
): TreeGeometryPair {
  const branches = branchSource.clone();
  const leaves = leafSource.clone();
  branches.computeBoundingBox();
  leaves.computeBoundingBox();
  const height = Math.max(branches.boundingBox?.max.y ?? 1, leaves.boundingBox?.max.y ?? 1);
  const scale = new Matrix4().makeScale(1 / height, 1 / height, 1 / height);
  branches.applyMatrix4(scale);
  leaves.applyMatrix4(scale);
  return { branches, leaves };
}

export function createTreeLods(near: TreeGeometryPair): Readonly<Record<TreeLod, TreeGeometryPair>> {
  return {
    near,
    middle: { branches: createDistanceTrunk(5), leaves: thinLeaves(inflateLeafCards(near.leaves, 1.9), 10) },
    far: { branches: createDistanceTrunk(4), leaves: thinLeaves(inflateLeafCards(near.leaves, 2.7), 20) },
  };
}

export function createHedgeLods(nearSource: TreeGeometryPair): Readonly<Record<TreeLod, TreeGeometryPair>> {
  const treeLods = createTreeLods(nearSource);
  const near = {
    branches: createDistanceTrunk(6),
    leaves: thinLeaves(inflateLeafCards(nearSource.leaves, 1.4), 6),
  };
  const far = {
    branches: createDistanceTrunk(4),
    leaves: thinLeaves(inflateLeafCards(nearSource.leaves, 2.8), 40),
  };
  treeLods.near.branches.dispose();
  treeLods.near.leaves.dispose();
  treeLods.far.branches.dispose();
  treeLods.far.leaves.dispose();
  return { ...treeLods, near, far };
}

export function serializeTreeLods(lods: Readonly<Record<TreeLod, TreeGeometryPair>>): SerializedTreeLods {
  return {
    near: serializePair(lods.near),
    middle: serializePair(lods.middle),
    far: serializePair(lods.far),
  };
}

export function deserializeGeometry(source: SerializedGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(source.position, 3));
  geometry.setAttribute('normal', new BufferAttribute(source.normal, 3));
  geometry.setAttribute('uv', new BufferAttribute(source.uv, 2));
  geometry.setIndex(new BufferAttribute(source.index, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function getTransferables(lods: SerializedTreeLods): Transferable[] {
  const transferables: Transferable[] = [];
  for (const lod of [lods.near, lods.middle, lods.far]) {
    for (const geometry of [lod.branches, lod.leaves]) {
      transferables.push(
        geometry.position.buffer,
        geometry.normal.buffer,
        geometry.uv.buffer,
        geometry.index.buffer,
      );
    }
  }
  return transferables;
}

export function disposeTreeLods(lods: Readonly<Record<TreeLod, TreeGeometryPair>>): void {
  for (const lod of [lods.near, lods.middle, lods.far]) {
    lod.branches.dispose();
    lod.leaves.dispose();
  }
}

function createDistanceTrunk(radialSegments: number): BufferGeometry {
  const trunk = new CylinderGeometry(0.01, 0.032, 0.65, radialSegments, 1, false);
  trunk.translate(0, 0.325, 0);
  return trunk;
}

function inflateLeafCards(source: BufferGeometry, factor: number): BufferGeometry {
  const geometry = source.clone();
  const positions = geometry.getAttribute('position');
  if (!(positions instanceof BufferAttribute)) throw new Error('Leaf cards require a non-interleaved position attribute.');
  for (let start = 0; start + 3 < positions.count; start += 4) inflateLeafCard(positions, start, factor);
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}

function inflateLeafCard(positions: BufferAttribute, start: number, factor: number): void {
  const centerX = getCardCenter(positions, start, 'x');
  const centerY = getCardCenter(positions, start, 'y');
  const centerZ = getCardCenter(positions, start, 'z');
  for (let vertex = start; vertex < start + 4; vertex += 1) {
    positions.setXYZ(
      vertex,
      centerX + (positions.getX(vertex) - centerX) * factor,
      centerY + (positions.getY(vertex) - centerY) * factor,
      centerZ + (positions.getZ(vertex) - centerZ) * factor,
    );
  }
}

function getCardCenter(attribute: BufferAttribute, start: number, axis: 'x' | 'y' | 'z'): number {
  const read = axis === 'x' ? attribute.getX.bind(attribute) : axis === 'y' ? attribute.getY.bind(attribute) : attribute.getZ.bind(attribute);
  return (read(start) + read(start + 1) + read(start + 2) + read(start + 3)) / 4;
}

function thinLeaves(source: BufferGeometry, stride: number): BufferGeometry {
  const geometry = source.clone();
  const sourceIndex = source.index;
  if (!sourceIndex) return geometry;
  const cardPairSize = 12;
  const selected: number[] = [];
  for (let offset = 0; offset < sourceIndex.count; offset += cardPairSize * stride) {
    const end = Math.min(offset + cardPairSize, sourceIndex.count);
    for (let index = offset; index < end; index += 1) selected.push(sourceIndex.getX(index));
  }
  geometry.setIndex(new BufferAttribute(new Uint32Array(selected), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function serializePair(pair: TreeGeometryPair): SerializedGeometryPair {
  return { branches: serializeGeometry(pair.branches), leaves: serializeGeometry(pair.leaves) };
}

function serializeGeometry(geometry: BufferGeometry): SerializedGeometry {
  const position = requireFloatAttribute(geometry, 'position');
  const normal = requireFloatAttribute(geometry, 'normal');
  const uv = requireFloatAttribute(geometry, 'uv');
  const index = geometry.index?.array;
  if (!(index instanceof Uint16Array || index instanceof Uint32Array)) {
    throw new Error('Generated tree geometry requires a Uint16 or Uint32 index.');
  }
  return { position, normal, uv, index };
}

function requireFloatAttribute(geometry: BufferGeometry, name: string): Float32Array {
  const array = geometry.getAttribute(name)?.array;
  if (!(array instanceof Float32Array)) throw new Error(`Generated tree geometry requires Float32 ${name}.`);
  return array;
}
