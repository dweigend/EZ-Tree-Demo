/**
 * Verifies the complete local EZ-Tree preset copy and bounded procedural shape variation.
 */

import { describe, expect, test } from 'bun:test';
import { Tree, TreePreset } from '@dgreenheck/ez-tree';
import {
  createVariedTreePreset,
  HEDGE_TEMPLATES,
  TREE_PRESET_CATALOG,
  TREE_TEMPLATES,
  type TreePresetData,
} from '../src/trees/tree-templates';

const LOCAL_ROOT = 'src/trees/presets';
const PRESET_FILES = {
  'Ash Small': 'ash_small.json', 'Ash Medium': 'ash_medium.json', 'Ash Large': 'ash_large.json',
  'Aspen Small': 'aspen_small.json', 'Aspen Medium': 'aspen_medium.json', 'Aspen Large': 'aspen_large.json',
  'Bush 1': 'bush_1.json', 'Bush 2': 'bush_2.json', 'Bush 3': 'bush_3.json',
  'Oak Small': 'oak_small.json', 'Oak Medium': 'oak_medium.json', 'Oak Large': 'oak_large.json',
  'Pine Small': 'pine_small.json', 'Pine Medium': 'pine_medium.json', 'Pine Large': 'pine_large.json',
  Trellis: 'trellis.json',
} as const;

describe('local EZ-Tree preset catalog', () => {
  test('contains exact copies of all 16 official presets', async () => {
    expect(TREE_PRESET_CATALOG).toHaveLength(16);
    for (const [name, file] of Object.entries(PRESET_FILES)) {
      const local = await Bun.file(`${LOCAL_ROOT}/${file}`).json();
      expect(local).toEqual(TreePreset[name as keyof typeof TreePreset]);
    }
  });

  test('uses the current website generator API with skeleton-based LOD creation', () => {
    expect(typeof Tree.prototype.createGeometry).toBe('function');
    expect(typeof Tree.prototype.generateLODs).toBe('function');
    expect(Tree.defaultLODLevels).toHaveLength(3);
  });

  test('activates small, medium, and large slots for every tree species', () => {
    expect(TREE_TEMPLATES).toHaveLength(12);
    expect(TREE_TEMPLATES.map((template) => `${template.species}:${template.size}`)).toEqual([
      'ash:small', 'ash:medium', 'ash:large',
      'aspen:small', 'aspen:medium', 'aspen:large',
      'oak:small', 'oak:medium', 'oak:large',
      'pine:small', 'pine:medium', 'pine:large',
    ]);
    expect(HEDGE_TEMPLATES.map((template) => template.id)).toEqual(['bush-1', 'bush-2', 'bush-3', 'trellis']);
  });

  test('varies shape without changing topology budgets', () => {
    for (const template of TREE_PRESET_CATALOG) {
      const varied = createVariedTreePreset(template, 42_424);
      expect(varied.seed).not.toBe(template.preset.seed);
      expect(varied.branch.children).toEqual(template.preset.branch.children);
      expect(varied.branch.sections).toEqual(template.preset.branch.sections);
      expect(varied.branch.segments).toEqual(template.preset.branch.segments);
      expectRatiosWithin(varied.branch.angle, template.preset.branch.angle, 0.05);
      expectRatiosWithin(varied.branch.gnarliness, template.preset.branch.gnarliness, 0.05);
      expectRatiosWithin(varied.branch.length, template.preset.branch.length, 0.05);
      expect(varied.leaves.size / template.preset.leaves.size).toBeWithin(0.92, 1.08);
      if (varied.trellis.enabled) expect(varied.trellis.visible).toBeFalse();
    }
  });
});

function expectRatiosWithin(
  varied: TreePresetData['branch']['angle'],
  source: TreePresetData['branch']['angle'],
  amount: number,
): void {
  for (const key of Object.keys(source)) {
    const level = key as keyof typeof source;
    const sourceValue = source[level];
    const variedValue = varied[level];
    if (sourceValue === undefined || variedValue === undefined || sourceValue === 0) continue;
    expect(variedValue / sourceValue).toBeWithin(1 - amount, 1 + amount);
  }
}
