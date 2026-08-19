/**
 * Creates reusable geometry variants from official EZ-Tree presets and derives their LODs at startup.
 * No tree generation occurs after construction; runtime trees are GPU instances only.
 */

import { Tree } from '@dgreenheck/ez-tree';
import { MeshPhongMaterial } from 'three';
import { hashCoordinates } from '../core/random';
import type { WindUniforms } from '../wind/wind-field';
import { createBranchMaterial, createLeafMaterial } from './tree-materials';
import {
  createHedgeLods,
  createTreeLods,
  normaliseTreeGeometry,
  type TreeGeometryPair,
  type TreeLod,
} from './tree-geometry';
import {
  createVariedTreePreset,
  HEDGE_TEMPLATES,
  TREE_TEMPLATES,
  type TreeSpecies,
  type TreeTemplate,
} from './tree-templates';

export type { TreeGeometryPair, TreeLod } from './tree-geometry';

export interface TreeVariant {
  readonly presetId: TreeTemplate['id'];
  readonly species: TreeSpecies;
  readonly lods: Readonly<Record<TreeLod, TreeGeometryPair>>;
  readonly branchMaterial: MeshPhongMaterial;
  readonly leafMaterial: MeshPhongMaterial;
  readonly height: number;
}

export function createTreeVariants(wind: WindUniforms, seed: number): TreeVariant[] {
  return TREE_TEMPLATES.map((template, index) => createVariant(template, variantSeed(seed, index), wind));
}

export function createHedgeVariant(wind: WindUniforms, seed: number): TreeVariant {
  const template = HEDGE_TEMPLATES[0];
  if (!template) throw new Error('Hedge generation requires at least one preset.');
  return createVariant(template, variantSeed(seed, 0), wind);
}

function createVariant(template: TreeTemplate, seed: number, wind: WindUniforms): TreeVariant {
  const options = createVariedTreePreset(template, seed);
  // EZ-Tree's runtime accepts preset data, but 1.1.0 types require its mutable TreeOptions class.
  const tree = new Tree(options as Tree['options']);
  tree.generate();
  const near = normaliseTreeGeometry(tree.branchesMesh.geometry, tree.leavesMesh.geometry);
  const branchSource = requirePhongMaterial(tree.branchesMesh.material);
  const leafSource = requirePhongMaterial(tree.leavesMesh.material);
  const variant = {
    presetId: template.id,
    species: template.species,
    height: template.height,
    branchMaterial: createBranchMaterial(branchSource),
    leafMaterial: createLeafMaterial(leafSource, wind),
    lods: template.kind === 'hedge' ? createHedgeLods(near) : createTreeLods(near),
  } satisfies TreeVariant;
  disposeGeneratedTree(tree);
  return variant;
}

function variantSeed(seed: number, index: number): number {
  return 1 + (hashCoordinates(seed, index, 0x61c88647) % 65_534);
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
