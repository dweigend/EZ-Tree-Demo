/**
 * Creates reusable geometry variants from official EZ-Tree presets and derives their LODs at startup.
 * No tree generation occurs after construction; runtime trees are GPU instances only.
 */

import { Tree, TreePreset } from '@dgreenheck/ez-tree';
import { BufferAttribute, BufferGeometry, Matrix4, MeshPhongMaterial } from 'three';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { hashCoordinates } from '../core/random';
import type { WindUniforms } from '../wind/wind-field';
import { createBranchMaterial, createLeafMaterial } from './tree-materials';
import { TREE_TEMPLATES, type TreeSpecies, type TreeTemplate } from './tree-templates';

export type TreeLod = 'near' | 'middle' | 'far';

export interface TreeGeometryPair {
  readonly branches: BufferGeometry;
  readonly leaves: BufferGeometry;
}

export interface TreeVariant {
  readonly species: TreeSpecies;
  readonly lods: Readonly<Record<TreeLod, TreeGeometryPair>>;
  readonly branchMaterial: MeshPhongMaterial;
  readonly leafMaterial: MeshPhongMaterial;
  readonly height: number;
}

export function createTreeVariants(wind: WindUniforms, seed: number): TreeVariant[] {
  return TREE_TEMPLATES.map((template, index) => createVariant(template, variantSeed(seed, index), wind));
}

function createVariant(template: TreeTemplate, seed: number, wind: WindUniforms): TreeVariant {
  const options = structuredClone(TreePreset[template.preset]);
  options.seed = seed;
  // EZ-Tree's runtime accepts preset data, but 1.1.0 types require its mutable TreeOptions class.
  const tree = new Tree(options as Tree['options']);
  tree.generate();
  const near = normalisePair(tree.branchesMesh.geometry, tree.leavesMesh.geometry);
  const branchSource = requirePhongMaterial(tree.branchesMesh.material);
  const leafSource = requirePhongMaterial(tree.leavesMesh.material);
  const variant = {
    species: template.species,
    height: template.height,
    branchMaterial: createBranchMaterial(branchSource),
    leafMaterial: createLeafMaterial(leafSource, wind),
    lods: createLods(near),
  } satisfies TreeVariant;
  disposeGeneratedTree(tree);
  return variant;
}

function variantSeed(seed: number, index: number): number {
  return 1 + (hashCoordinates(seed, index, 0x61c88647) % 65_534);
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
