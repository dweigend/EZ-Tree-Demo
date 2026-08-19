/**
 * Requests silhouette-preserving EZ-Tree LODs, normalises them once, and serialises worker buffers.
 * LOD detail mirrors the official generator defaults; this module never invents replacement tree shapes.
 */

import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import type { SerializedGeometry, SerializedGeometryPair, SerializedTreeLods } from './tree-variant-contract';

export type TreeLod = 'near' | 'middle' | 'far';

export interface TreeGeometryPair {
  readonly branches: BufferGeometry;
  readonly leaves: BufferGeometry;
}

interface TreeLodDetail {
  readonly sectionStride?: number;
  readonly segmentFactor?: number;
  readonly leafStride?: number;
  readonly leafScale?: number;
  readonly billboard?: string;
}

interface EzTreeGeometrySource {
  createGeometry(detail?: TreeLodDetail): TreeGeometryPair;
}

const EZ_TREE_LOD_DETAIL: Readonly<Record<TreeLod, TreeLodDetail>> = {
  near: {},
  middle: { sectionStride: 3, segmentFactor: 0.75, leafStride: 2, leafScale: 1.25 },
  far: { sectionStride: 6, segmentFactor: 0.4, leafStride: 2, leafScale: 1.3, billboard: 'single' },
};

export function createTreeLods(source: EzTreeGeometrySource): Readonly<Record<TreeLod, TreeGeometryPair>> {
  const lods = {
    near: source.createGeometry(EZ_TREE_LOD_DETAIL.near),
    middle: source.createGeometry(EZ_TREE_LOD_DETAIL.middle),
    far: source.createGeometry(EZ_TREE_LOD_DETAIL.far),
  };
  return normaliseTreeLods(lods);
}

export function createHedgeLods(source: EzTreeGeometrySource): Readonly<Record<TreeLod, TreeGeometryPair>> {
  return createTreeLods(source);
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

export function deserializeTreeLods(source: SerializedTreeLods): Readonly<Record<TreeLod, TreeGeometryPair>> {
  return {
    near: deserializePair(source.near),
    middle: deserializePair(source.middle),
    far: deserializePair(source.far),
  };
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

function serializePair(pair: TreeGeometryPair): SerializedGeometryPair {
  return { branches: serializeGeometry(pair.branches), leaves: serializeGeometry(pair.leaves) };
}

function deserializePair(source: SerializedGeometryPair): TreeGeometryPair {
  return { branches: deserializeGeometry(source.branches), leaves: deserializeGeometry(source.leaves) };
}

function normaliseTreeLods(
  lods: Readonly<Record<TreeLod, TreeGeometryPair>>,
): Readonly<Record<TreeLod, TreeGeometryPair>> {
  const height = getTreeHeight(lods.near);
  const scale = new Matrix4().makeScale(1 / height, 1 / height, 1 / height);
  for (const lod of LOD_VALUES) {
    lods[lod].branches.applyMatrix4(scale);
    lods[lod].leaves.applyMatrix4(scale);
  }
  return lods;
}

function getTreeHeight(pair: TreeGeometryPair): number {
  pair.branches.computeBoundingBox();
  pair.leaves.computeBoundingBox();
  return Math.max(pair.branches.boundingBox?.max.y ?? 1, pair.leaves.boundingBox?.max.y ?? 1, 0.001);
}

const LOD_VALUES = ['near', 'middle', 'far'] as const satisfies readonly TreeLod[];

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
