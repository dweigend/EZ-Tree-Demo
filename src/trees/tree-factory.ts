/**
 * Creates ten reusable EZ-Tree geometry variants and their derived LODs at startup.
 * No tree generation occurs after construction; runtime trees are GPU instances only.
 */

import { Tree, TreePreset } from '@dgreenheck/ez-tree';
import { BufferAttribute, BufferGeometry, MathUtils, Matrix4, MeshPhongMaterial } from 'three';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
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
  ['Oak Large', 10_301, 22],
  ['Oak Medium', 21_173, 17.5],
  ['Oak Small', 37_019, 11.5],
  ['Ash Large', 44_029, 23],
  ['Ash Medium', 51_061, 18.5],
  ['Aspen Large', 63_097, 22],
  ['Aspen Small', 71_101, 12],
  ['Pine Large', 83_111, 25],
  ['Pine Medium', 91_127, 16.5],
  ['Pine Small', 101_141, 12.5],
] as const;

export function createTreeVariants(wind: WindUniforms): TreeVariant[] {
  return VARIANT_SOURCES.map(([preset, seed, height]) => createVariant(preset, seed, height, wind));
}

function createVariant(preset: keyof typeof TreePreset, seed: number, height: number, wind: WindUniforms): TreeVariant {
  // EZ-Tree accepts preset JSON at runtime, but its constructor type incorrectly requires TreeOptions.copy().
  const options = structuredClone(TreePreset[preset]) as Tree['options'];
  options.seed = seed;
  varyTreeOptions(options, seed);
  reduceTreeComplexity(options);
  const tree = new Tree(options);
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

function varyTreeOptions(options: Tree['options'], seed: number): void {
  varyBranchStructure(options, seed);
  const leaves = options.leaves;
  leaves.angle = MathUtils.clamp(leaves.angle + randomSigned(seed, 47) * 14, 8, 78);
  leaves.count = Math.max(5, Math.round(leaves.count * randomScale(seed, 53, 0.78, 1.28)));
  leaves.size *= randomScale(seed, 59, 0.82, 1.32);
  leaves.sizeVariance = MathUtils.clamp(leaves.sizeVariance + randomSigned(seed, 61) * 0.18, 0.3, 0.9);
}

function varyBranchStructure(options: Tree['options'], seed: number): void {
  const branch = options.branch;
  branch.angle[1] *= randomScale(seed, 3, 0.78, 1.22);
  branch.angle[2] *= randomScale(seed, 5, 0.8, 1.2);
  branch.angle[3] *= randomScale(seed, 7, 0.82, 1.18);
  branch.length[1] *= randomScale(seed, 11, 0.76, 1.28);
  branch.length[2] *= randomScale(seed, 13, 0.72, 1.3);
  branch.start[1] = MathUtils.clamp(branch.start[1] + randomSigned(seed, 17) * 0.12, 0.08, 0.76);
  branch.start[2] = MathUtils.clamp(branch.start[2] + randomSigned(seed, 19) * 0.12, 0.04, 0.78);
  branch.gnarliness[0] += randomSigned(seed, 23) * 0.08;
  branch.gnarliness[1] += randomSigned(seed, 29) * 0.11;
  branch.twist[1] += randomSigned(seed, 31) * 0.24;
  branch.force.direction.x = randomSigned(seed, 37) * 0.22;
  branch.force.direction.z = randomSigned(seed, 41) * 0.22;
  branch.force.strength += randomSigned(seed, 43) * 0.018;
}

function reduceTreeComplexity(options: Tree['options']): void {
  const branch = options.branch;
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
  options.leaves.count = Math.min(options.leaves.count, 20);
  options.leaves.size *= 1.12;
}

function randomScale(seed: number, salt: number, minimum: number, maximum: number): number {
  return MathUtils.lerp(minimum, maximum, unitRandom(hashCoordinates(seed, salt, 0)));
}

function randomSigned(seed: number, salt: number): number {
  return signedRandom(hashCoordinates(seed, salt, 0));
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
  const vertexCount = source.getAttribute('position').count;
  const removeCount = Math.max(0, Math.floor(vertexCount * (1 - retainedFraction)));
  if (removeCount === 0) return source.clone();
  try {
    source.computeVertexNormals();
    return new SimplifyModifier().modify(source, removeCount);
  } catch {
    return source.clone();
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
