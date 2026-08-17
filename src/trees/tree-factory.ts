/**
 * Creates ten reusable EZ-Tree geometry variants and their derived LODs at startup.
 * No tree generation occurs after construction; runtime trees are GPU instances only.
 */

import { Tree } from '@dgreenheck/ez-tree';
import { BufferAttribute, BufferGeometry, Matrix4, MeshPhongMaterial } from 'three';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import type { WindUniforms } from '../wind/wind-field';
import { createBranchMaterial, createLeafMaterial } from './tree-materials';

export type TreeLod = 'near' | 'middle' | 'far';

export interface TreeGeometryPair {
  readonly branches: BufferGeometry;
  readonly leaves: BufferGeometry;
}

export interface TreeVariant {
  readonly lods: Readonly<Record<TreeLod, TreeGeometryPair>>;
  readonly branchMaterial: MeshPhongMaterial;
  readonly leafMaterial: MeshPhongMaterial;
  readonly height: number;
}

const VARIANT_SOURCES = [
  ['Oak Medium', 10_301, 15.5],
  ['Oak Medium', 21_173, 17.5],
  ['Oak Small', 37_019, 11.5],
  ['Ash Medium', 44_029, 18.5],
  ['Ash Small', 51_061, 12.5],
  ['Aspen Medium', 63_097, 17],
  ['Aspen Small', 71_101, 12],
  ['Pine Medium', 83_111, 19.5],
  ['Pine Medium', 91_127, 16.5],
  ['Pine Small', 101_141, 12.5],
] as const;

export function createTreeVariants(wind: WindUniforms): TreeVariant[] {
  return VARIANT_SOURCES.map(([preset, seed, height]) => createVariant(preset, seed, height, wind));
}

function createVariant(preset: string, seed: number, height: number, wind: WindUniforms): TreeVariant {
  const tree = new Tree();
  tree.loadPreset(preset);
  tree.options.seed = seed;
  reduceTreeComplexity(tree);
  tree.generate();
  const near = normalisePair(tree.branchesMesh.geometry, tree.leavesMesh.geometry);
  const branchSource = requirePhongMaterial(tree.branchesMesh.material);
  const leafSource = requirePhongMaterial(tree.leavesMesh.material);
  const variant = {
    height,
    branchMaterial: createBranchMaterial(branchSource, wind),
    leafMaterial: createLeafMaterial(leafSource, wind),
    lods: createLods(near),
  } satisfies TreeVariant;
  disposeGeneratedTree(tree);
  return variant;
}

function normalisePair(branchSource: BufferGeometry, leafSource: BufferGeometry): TreeGeometryPair {
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

function createLods(near: TreeGeometryPair): Readonly<Record<TreeLod, TreeGeometryPair>> {
  return {
    near,
    middle: { branches: simplify(near.branches, 0.48), leaves: thinLeaves(inflateLeafCards(near.leaves, 1.35), 2) },
    far: { branches: simplify(near.branches, 0.12), leaves: thinLeaves(inflateLeafCards(near.leaves, 1.9), 5) },
  };
}

function reduceTreeComplexity(tree: Tree): void {
  const branch = tree.options.branch;
  branch.children[0] = Math.min(branch.children[0], 7);
  branch.children[1] = Math.min(branch.children[1], 4);
  branch.children[2] = Math.min(branch.children[2], 3);
  branch.sections[0] = Math.min(branch.sections[0], 9);
  branch.sections[1] = Math.min(branch.sections[1], 6);
  branch.sections[2] = Math.min(branch.sections[2], 4);
  branch.sections[3] = Math.min(branch.sections[3], 3);
  branch.segments[0] = Math.min(branch.segments[0], 7);
  branch.segments[1] = Math.min(branch.segments[1], 5);
  branch.segments[2] = Math.min(branch.segments[2], 4);
  branch.segments[3] = 3;
  tree.options.leaves.count = Math.min(tree.options.leaves.count, 14);
  tree.options.leaves.size *= 1.18;
}

function inflateLeafCards(source: BufferGeometry, factor: number): BufferGeometry {
  const geometry = source.clone();
  const positions = geometry.getAttribute('position');
  for (let start = 0; start + 3 < positions.count; start += 4) {
    const centerX = (positions.getX(start) + positions.getX(start + 1) + positions.getX(start + 2) + positions.getX(start + 3)) / 4;
    const centerY = (positions.getY(start) + positions.getY(start + 1) + positions.getY(start + 2) + positions.getY(start + 3)) / 4;
    const centerZ = (positions.getZ(start) + positions.getZ(start + 1) + positions.getZ(start + 2) + positions.getZ(start + 3)) / 4;
    for (let vertex = start; vertex < start + 4; vertex += 1) {
      positions.setXYZ(
        vertex,
        centerX + (positions.getX(vertex) - centerX) * factor,
        centerY + (positions.getY(vertex) - centerY) * factor,
        centerZ + (positions.getZ(vertex) - centerZ) * factor,
      );
    }
  }
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}

function simplify(source: BufferGeometry, retainedFraction: number): BufferGeometry {
  const geometry = source.clone();
  const vertexCount = geometry.getAttribute('position').count;
  const removeCount = Math.max(0, Math.floor(vertexCount * (1 - retainedFraction)));
  if (removeCount === 0) return geometry;
  try {
    source.computeVertexNormals();
    return new SimplifyModifier().modify(source.clone(), removeCount);
  } catch {
    return geometry;
  }
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

function requirePhongMaterial(material: Tree['branchesMesh']['material']): MeshPhongMaterial {
  if (Array.isArray(material) || !(material instanceof MeshPhongMaterial)) {
    throw new Error('EZ-Tree returned an unsupported material type.');
  }
  return material;
}

function disposeGeneratedTree(tree: Tree): void {
  tree.branchesMesh.geometry.dispose();
  tree.leavesMesh.geometry.dispose();
  const branchMaterial = requirePhongMaterial(tree.branchesMesh.material);
  const leafMaterial = requirePhongMaterial(tree.leavesMesh.material);
  branchMaterial.dispose();
  leafMaterial.dispose();
  tree.clear();
}
