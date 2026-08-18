/**
 * Verifies stable forest candidates so lower-density profiles remain subsets of desktop placement.
 */

import { describe, expect, test } from 'bun:test';
import { WORLD_SEED } from '../src/config';
import { HeightField } from '../src/core/height-field';
import { hashString } from '../src/core/random';
import { acceptsTreeDensity, ForestDistribution } from '../src/trees/forest-distribution';

const variants = [{ species: 'aspen' }, { species: 'oak' }, { species: 'pine' }] as const;
const distribution = new ForestDistribution(new HeightField(WORLD_SEED, 1), hashString('forest-test'), variants);

describe('forest density ranking', () => {
  test('is deterministic and bounded for cached world chunks', () => {
    const first = distribution.getChunkPlacements(0, 0);
    const second = distribution.getChunkPlacements(0, 0);
    expect(second).toEqual(first);
    for (const tree of first) expect(tree.densityRank).toBeWithin(0, 1);
  });

  test('PICO density is a strict subset of desktop density', () => {
    const ranks = [0.1, 0.74, 0.85, 0.851, 0.9];
    const desktop = ranks.filter((rank) => acceptsTreeDensity(rank, 1));
    const pico = ranks.filter((rank) => acceptsTreeDensity(rank, 0.85));
    expect(desktop).toEqual(ranks);
    expect(pico).toEqual([0.1, 0.74, 0.85]);
  });
});
