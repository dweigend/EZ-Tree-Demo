/**
 * Creates reusable geometry variants from official EZ-Tree presets and derives their LODs at startup.
 * No tree generation occurs after construction; runtime trees are GPU instances only.
 */

import { Tree } from '@dgreenheck/ez-tree';
import { MeshStandardMaterial } from 'three';
import { hashCoordinates } from '../core/random';
import type { WindUniforms } from '../wind/wind-field';
import { createBranchMaterial, createLeafMaterial } from './tree-materials';
import {
  createHedgeLods,
  createTreeLods,
  type TreeGeometryPair,
  type TreeLod,
} from './tree-geometry';
import {
  createVariedTreePreset,
  HEDGE_TEMPLATES,
  TREE_TEMPLATES,
  type TreeSpecies,
  type TreePresetSize,
  type TreeTemplate,
} from './tree-templates';
import { getBarkMaps, type TreeTextureAssets } from './tree-textures';

export type { TreeGeometryPair, TreeLod } from './tree-geometry';

export interface TreeVariant {
  readonly presetId: TreeTemplate['id'];
  readonly species: TreeSpecies;
  readonly size: TreePresetSize;
  readonly lods: Readonly<Record<TreeLod, TreeGeometryPair>>;
  readonly branchMaterial: MeshStandardMaterial;
  readonly leafMaterial: MeshStandardMaterial;
  readonly height: number;
}

interface VariantBuildContext {
  readonly seed: number;
  readonly wind: WindUniforms;
  readonly textures: TreeTextureAssets;
}

export function createTreeVariants(wind: WindUniforms, seed: number, textures: TreeTextureAssets): TreeVariant[] {
  return TREE_TEMPLATES.map((template, index) => {
    return createVariant(template, { seed: variantSeed(seed, index), wind, textures });
  });
}

export function createHedgeVariants(wind: WindUniforms, seed: number, textures: TreeTextureAssets): TreeVariant[] {
  return HEDGE_TEMPLATES.map((template, index) => {
    return createVariant(template, { seed: variantSeed(seed, index), wind, textures });
  });
}

function createVariant(template: TreeTemplate, context: VariantBuildContext): TreeVariant {
  const options = createVariedTreePreset(template, context.seed);
  const tree = new Tree();
  tree.options.copy(options as Tree['options']);
  applyTextures(tree, options, context.textures);
  tree.generate();
  const branchSource = requireStandardMaterial(tree.branchesMesh.material);
  const leafSource = requireStandardMaterial(tree.leavesMesh.material);
  const variant = {
    presetId: template.id,
    species: template.species,
    size: template.size,
    height: template.height,
    branchMaterial: createBranchMaterial(branchSource),
    leafMaterial: createLeafMaterial(leafSource, context.wind, tree.options.leaves.roundedNormals),
    lods: template.kind === 'hedge' ? createHedgeLods(tree) : createTreeLods(tree),
  } satisfies TreeVariant;
  disposeGeneratedTree(tree);
  return variant;
}

function variantSeed(seed: number, index: number): number {
  return 1 + (hashCoordinates(seed, index, 0x61c88647) % 65_534);
}

function applyTextures(tree: Tree, preset: ReturnType<typeof createVariedTreePreset>, textures: TreeTextureAssets): void {
  const bark = getBarkMaps(textures, preset);
  tree.options.bark.maps.color = bark.color;
  tree.options.bark.maps.normal = bark.normal;
  tree.options.bark.maps.roughness = bark.roughness;
  tree.options.leaves.map = textures.leaves[preset.leaves.type];
}

function requireStandardMaterial(material: Tree['branchesMesh']['material']): MeshStandardMaterial {
  if (Array.isArray(material) || !(material instanceof MeshStandardMaterial)) {
    throw new Error('EZ-Tree returned an unsupported material type.');
  }
  return material;
}

function disposeGeneratedTree(tree: Tree): void {
  tree.branchesMesh.geometry.dispose();
  tree.leavesMesh.geometry.dispose();
  const branchMaterial = requireStandardMaterial(tree.branchesMesh.material);
  const leafMaterial = requireStandardMaterial(tree.leavesMesh.material);
  branchMaterial.dispose();
  leafMaterial.dispose();
  tree.clear();
}
