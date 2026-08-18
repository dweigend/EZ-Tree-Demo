/**
 * Verifies that the shipped terrain atlas metadata exposes exactly four bounded material slots.
 */

import { expect, test } from 'bun:test';

test('terrain palette maps four ordered slots to both atlas sizes', async () => {
  const palette = await Bun.file('public/assets/terrain/palette.json').json();
  expect(palette.slots.map((entry: { slot: string }) => entry.slot)).toEqual(['meadow', 'valley', 'forest', 'exposed']);
  expect(palette.roughness).toHaveLength(4);
  expect(palette.atlasSize).toEqual({ desktop: 2048, pico90: 1024 });
});
