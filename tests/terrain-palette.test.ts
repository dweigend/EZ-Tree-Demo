/**
 * Verifies that the shipped terrain atlas metadata exposes eight ordered, bounded material slots.
 */

import { expect, test } from 'bun:test';

test('terrain palette maps eight ordered slots to both atlas sizes', async () => {
  const palette = await Bun.file('public/assets/terrain/palette.json').json();
  expect(palette.slots.map((entry: { slot: string }) => entry.slot)).toEqual([
    'meadow',
    'mud',
    'dryForest',
    'mossForest',
    'forest',
    'pineForest',
    'rock',
    'trail',
  ]);
  expect(palette.roughness).toBeUndefined();
  expect(palette.tileMeters).toEqual([14, 10, 8, 10, 12, 9, 42, 8]);
  expect(palette.atlasColumns).toBe(3);
  expect(palette.atlasSize).toEqual({ desktop: 3072, pico90: 1536 });
  expect(palette.surfaceEncoding).toBe('normal-rgb-roughness-a');
  expect(palette.license).toBe('CC0-1.0');
});
