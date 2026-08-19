/**
 * Verifies the complete local EZ-Tree preset copy and bounded procedural shape variation.
 */

import { describe, expect, test } from 'bun:test';
import {
  createVariedTreePreset,
  HEDGE_TEMPLATES,
  TREE_PRESET_CATALOG,
  TREE_TEMPLATES,
  type TreePresetData,
} from '../src/trees/tree-templates';

const SOURCE_ROOT = 'node_modules/@dgreenheck/ez-tree/src/lib/presets';
const LOCAL_ROOT = 'src/trees/presets';
const FILES = [
  'ash_small.json',
  'ash_medium.json',
  'ash_large.json',
  'aspen_small.json',
  'aspen_medium.json',
  'aspen_large.json',
  'bush_1.json',
  'bush_2.json',
  'bush_3.json',
  'oak_small.json',
  'oak_medium.json',
  'oak_large.json',
  'pine_small.json',
  'pine_medium.json',
  'pine_large.json',
  'trellis.json',
] as const;

describe('local EZ-Tree preset catalog', () => {
  test('contains exact copies of all 16 official presets', async () => {
    expect(TREE_PRESET_CATALOG).toHaveLength(16);
    for (const file of FILES) {
      const local = await Bun.file(`${LOCAL_ROOT}/${file}`).json();
      const source = await Bun.file(`${SOURCE_ROOT}/${file}`).json();
      expect(local).toEqual(source);
    }
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
