/**
 * Verifies deterministic, normalized terrain material weights in absolute world coordinates.
 */

import { describe, expect, test } from 'bun:test';
import { Vector4 } from 'three';
import { WORLD_SEED } from '../src/config';
import { HeightField } from '../src/core/height-field';
import { writeLandscapeMaterialWeights, type LandscapeSurfaceSample } from '../src/ecology/landscape-ecology';

const heightField = new HeightField(WORLD_SEED, 1);

describe('landscape material weights', () => {
  test('are deterministic and normalized', () => {
    const surface = createSurface(320, -640);
    const first = writeLandscapeMaterialWeights(heightField, surface, new Vector4());
    const second = writeLandscapeMaterialWeights(heightField, { ...surface }, new Vector4());
    expect(second.toArray()).toEqual(first.toArray());
    expect(first.x + first.y + first.z + first.w).toBeCloseTo(1, 6);
    for (const weight of first.toArray()) expect(weight).toBeWithin(0, 1);
  });

  test('does not depend on chunk ownership at a shared border', () => {
    const border = createSurface(160, 0);
    const fromLeftChunk = writeLandscapeMaterialWeights(heightField, border, new Vector4());
    const fromRightChunk = writeLandscapeMaterialWeights(heightField, border, new Vector4());
    expect(fromRightChunk.toArray()).toEqual(fromLeftChunk.toArray());
  });
});

function createSurface(x: number, z: number): LandscapeSurfaceSample {
  const height = heightField.getHeight(x, z);
  return { x, z, height, slope: heightField.getSlope(x, z) };
}
