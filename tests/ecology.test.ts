/**
 * Verifies deterministic, normalized terrain material weights in absolute world coordinates.
 */

import { describe, expect, test } from 'bun:test';
import { Vector3, Vector4 } from 'three';
import { WORLD_SEED } from '../src/config';
import { HeightField } from '../src/core/height-field';
import {
  writeLandscapeMaterialWeights,
  type LandscapeMaterialWeights,
  type LandscapeSurfaceSample,
} from '../src/ecology/landscape-ecology';

const heightField = new HeightField(WORLD_SEED, 1);

describe('landscape material weights', () => {
  test('are deterministic and normalized', () => {
    const surface = createSurface(320, -640);
    const first = writeLandscapeMaterialWeights(heightField, surface, createWeights());
    const second = writeLandscapeMaterialWeights(heightField, { ...surface }, createWeights());
    expect(toArray(second)).toEqual(toArray(first));
    expect(toArray(first).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 6);
    for (const weight of toArray(first)) expect(weight).toBeWithin(0, 1);
  });

  test('does not depend on chunk ownership at a shared border', () => {
    const border = createSurface(160, 0);
    const fromLeftChunk = writeLandscapeMaterialWeights(heightField, border, createWeights());
    const fromRightChunk = writeLandscapeMaterialWeights(heightField, border, createWeights());
    expect(toArray(fromRightChunk)).toEqual(toArray(fromLeftChunk));
  });

  test('generates dominant examples for every terrain zone', () => {
    const maxima = Array<number>(7).fill(0);
    for (let z = -2_000; z <= 2_000; z += 80) {
      for (let x = -2_000; x <= 2_000; x += 80) {
        const weights = toArray(writeLandscapeMaterialWeights(heightField, createSurface(x, z), createWeights()));
        weights.forEach((weight, index) => {
          maxima[index] = Math.max(maxima[index]!, weight);
        });
      }
    }
    maxima.forEach((maximum) => expect(maximum).toBeGreaterThan(0.16));
  });
});

function createWeights(): LandscapeMaterialWeights {
  return { first: new Vector4(), second: new Vector3() };
}

function toArray(weights: LandscapeMaterialWeights): number[] {
  return [...weights.first.toArray(), ...weights.second.toArray()];
}

function createSurface(x: number, z: number): LandscapeSurfaceSample {
  const height = heightField.getHeight(x, z);
  return { x, z, height, slope: heightField.getSlope(x, z) };
}
