/**
 * Owns the project-local copy of every official EZ-Tree 1.1 preset and its world metadata.
 * Preset topology is immutable; deterministic variation only changes bounded shape parameters.
 */

import ashLarge from './presets/ash_large.json';
import ashMedium from './presets/ash_medium.json';
import ashSmall from './presets/ash_small.json';
import aspenLarge from './presets/aspen_large.json';
import aspenMedium from './presets/aspen_medium.json';
import aspenSmall from './presets/aspen_small.json';
import bush1 from './presets/bush_1.json';
import bush2 from './presets/bush_2.json';
import bush3 from './presets/bush_3.json';
import oakLarge from './presets/oak_large.json';
import oakMedium from './presets/oak_medium.json';
import oakSmall from './presets/oak_small.json';
import pineLarge from './presets/pine_large.json';
import pineMedium from './presets/pine_medium.json';
import pineSmall from './presets/pine_small.json';
import trellis from './presets/trellis.json';
import { hashCoordinates, signedRandom } from '../core/random';

export type TreeSpecies = 'ash' | 'aspen' | 'oak' | 'pine';
export type TreePresetKind = 'tree' | 'hedge';
export type TreePresetSize = 'small' | 'medium' | 'large' | 'shrub';
export type TreePresetId =
  | 'ash-small'
  | 'ash-medium'
  | 'ash-large'
  | 'aspen-small'
  | 'aspen-medium'
  | 'aspen-large'
  | 'oak-small'
  | 'oak-medium'
  | 'oak-large'
  | 'pine-small'
  | 'pine-medium'
  | 'pine-large'
  | 'bush-1'
  | 'bush-2'
  | 'bush-3'
  | 'trellis';

type BranchLevel = '0' | '1' | '2' | '3';

export interface TreePresetData {
  seed: number;
  type: string;
  bark: Record<string, unknown>;
  branch: {
    angle: Partial<Record<BranchLevel, number>>;
    children: Partial<Record<BranchLevel, number>>;
    gnarliness: Partial<Record<BranchLevel, number>>;
    length: Partial<Record<BranchLevel, number>>;
    sections: Partial<Record<BranchLevel, number>>;
    segments: Partial<Record<BranchLevel, number>>;
    [key: string]: unknown;
  };
  leaves: {
    size: number;
    count: number;
    [key: string]: unknown;
  };
  trellis: {
    enabled: boolean;
    visible?: boolean;
    [key: string]: unknown;
  };
}

export interface TreeTemplate {
  readonly id: TreePresetId;
  readonly name: string;
  readonly species: TreeSpecies;
  readonly kind: TreePresetKind;
  readonly size: TreePresetSize;
  readonly height: number;
  readonly preset: TreePresetData;
}

const tree = (
  id: TreePresetId,
  name: string,
  species: TreeSpecies,
  size: TreePresetSize,
  height: number,
  preset: unknown,
): TreeTemplate => ({ id, name, species, kind: 'tree', size, height, preset: preset as TreePresetData });

const hedge = (id: TreePresetId, name: string, height: number, preset: unknown): TreeTemplate => ({
  id,
  name,
  species: 'ash',
  kind: 'hedge',
  size: 'shrub',
  height,
  preset: preset as TreePresetData,
});

export const TREE_PRESET_CATALOG: readonly TreeTemplate[] = [
  tree('ash-small', 'Ash Small', 'ash', 'small', 11, ashSmall),
  tree('ash-medium', 'Ash Medium', 'ash', 'medium', 18, ashMedium),
  tree('ash-large', 'Ash Large', 'ash', 'large', 25, ashLarge),
  tree('aspen-small', 'Aspen Small', 'aspen', 'small', 12, aspenSmall),
  tree('aspen-medium', 'Aspen Medium', 'aspen', 'medium', 19, aspenMedium),
  tree('aspen-large', 'Aspen Large', 'aspen', 'large', 27, aspenLarge),
  tree('oak-small', 'Oak Small', 'oak', 'small', 10, oakSmall),
  tree('oak-medium', 'Oak Medium', 'oak', 'medium', 18, oakMedium),
  tree('oak-large', 'Oak Large', 'oak', 'large', 26, oakLarge),
  tree('pine-small', 'Pine Small', 'pine', 'small', 14, pineSmall),
  tree('pine-medium', 'Pine Medium', 'pine', 'medium', 22, pineMedium),
  tree('pine-large', 'Pine Large', 'pine', 'large', 30, pineLarge),
  hedge('bush-1', 'Bush 1', 2.6, bush1),
  hedge('bush-2', 'Bush 2', 3.0, bush2),
  hedge('bush-3', 'Bush 3', 3.3, bush3),
  hedge('trellis', 'Trellis', 3.6, trellis),
] as const;

export const TREE_TEMPLATES = TREE_PRESET_CATALOG.filter(
  (template) => template.kind === 'tree' && template.size === 'medium',
);

export const HEDGE_TEMPLATES = TREE_PRESET_CATALOG.filter((template) => template.kind === 'hedge');

export function createVariedTreePreset(template: TreeTemplate, seed: number): TreePresetData {
  const preset = structuredClone(template.preset);
  preset.seed = 1 + (seed % 65_534);
  varyLevels(preset.branch.angle, seed, 0x1a2b, 0.05);
  varyLevels(preset.branch.gnarliness, seed, 0x3c4d, 0.05);
  varyLevels(preset.branch.length, seed, 0x5e6f, 0.05);
  preset.leaves.size *= variationFactor(seed, 0x7a8b, 0.08);
  if (preset.trellis.enabled) preset.trellis.visible = false;
  return preset;
}

function varyLevels(
  values: Partial<Record<BranchLevel, number>>,
  seed: number,
  salt: number,
  amount: number,
): void {
  for (const level of ['0', '1', '2', '3'] as const) {
    const value = values[level];
    if (value === undefined) continue;
    values[level] = value * variationFactor(seed, salt + Number(level), amount);
  }
}

function variationFactor(seed: number, salt: number, amount: number): number {
  return 1 + signedRandom(hashCoordinates(seed, salt, 0x9e37)) * amount;
}
