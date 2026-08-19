/**
 * Verifies deterministic tree placement and exclusive ownership on the shared world lattice.
 */

import { describe, expect, test } from 'bun:test';
import { TERRAIN, WORLD_SEED } from '../src/config';
import { HeightField } from '../src/core/height-field';
import { hashString } from '../src/core/random';
import { ForestDistribution } from '../src/trees/forest-distribution';

const variants = [{ species: 'ash' }, { species: 'aspen' }, { species: 'oak' }, { species: 'pine' }] as const;
const distribution = new ForestDistribution(new HeightField(WORLD_SEED, 1), hashString('forest-test'), variants);

describe('forest distribution', () => {
  test('is deterministic and physically bounded for cached world chunks', () => {
    const first = distribution.getChunkPlacements(0, 0);
    const second = distribution.getChunkPlacements(0, 0);
    expect(second).toEqual(first);
    const chunkHectares = TERRAIN.chunkSize ** 2 / 10_000;
    expect(first.length).toBeLessThanOrEqual(Math.ceil(chunkHectares * 24));
  });

  test('assigns each absolute-world candidate to one chunk only', () => {
    const left = distribution.getChunkPlacements(0, 0);
    const right = distribution.getChunkPlacements(1, 0);
    const leftKeys = new Set(left.map(positionKey));
    expect(right.some((placement) => leftKeys.has(positionKey(placement)))).toBeFalse();
  });
});

function positionKey(placement: { readonly x: number; readonly z: number }): string {
  return `${placement.x}:${placement.z}`;
}
