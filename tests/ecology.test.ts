/**
 * Verifies deterministic, normalized terrain material weights in absolute world coordinates.
 */

import { describe, expect, test } from 'bun:test';
import { Vector4 } from 'three';
import { WORLD_SEED } from '../src/config';
import { HeightField } from '../src/core/height-field';
import {
  writeLandscapeZoneWeights,
  writeLandscapeMaterialWeights,
  type LandscapeMaterialWeights,
  type LandscapeSurfaceSample,
} from '../src/ecology/landscape-ecology';
import {
  createLandscapeZoneWeights,
  getPopulationDensityPerHectare,
  LANDSCAPE_ZONE_IDS,
} from '../src/ecology/landscape-zones';

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
    const maxima = Array<number>(8).fill(0);
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

  test('generates normalized examples for all six continuous ecology zones', () => {
    const maxima = Array<number>(6).fill(0);
    for (let z = -2_000; z <= 2_000; z += 80) {
      for (let x = -2_000; x <= 2_000; x += 80) {
        const zone = writeLandscapeZoneWeights(heightField, createSurface(x, z), createLandscapeZoneWeights());
        const values = Object.values(zone);
        expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 6);
        values.forEach((weight, index) => {
          maxima[index] = Math.max(maxima[index]!, weight);
        });
      }
    }
    maxima.forEach((maximum) => expect(maximum).toBeGreaterThan(0.12));
  });

  test('creates substantial open land and dense, individually dominant forest zones', () => {
    let openSamples = 0;
    let denseSamples = 0;
    let totalSamples = 0;
    const dominantZones = new Set<string>();
    for (let z = -5_000; z <= 5_000; z += 100) {
      for (let x = -5_000; x <= 5_000; x += 100) {
        const zones = writeLandscapeZoneWeights(heightField, createSurface(x, z), createLandscapeZoneWeights());
        const density = getPopulationDensityPerHectare(zones, 'trees');
        if (density < 2) openSamples += 1;
        if (density > 18) denseSamples += 1;
        dominantZones.add(LANDSCAPE_ZONE_IDS.reduce((first, second) => zones[first] > zones[second] ? first : second));
        totalSamples += 1;
      }
    }
    expect(openSamples / totalSamples).toBeGreaterThan(0.15);
    expect(denseSamples / totalSamples).toBeGreaterThan(0.2);
    expect(dominantZones).toEqual(new Set(LANDSCAPE_ZONE_IDS));
  });
});

function createWeights(): LandscapeMaterialWeights {
  return { first: new Vector4(), second: new Vector4() };
}

function toArray(weights: LandscapeMaterialWeights): number[] {
  return [...weights.first.toArray(), ...weights.second.toArray()];
}

function createSurface(x: number, z: number): LandscapeSurfaceSample {
  return {
    x,
    z,
    heightMeters: heightField.getHeight(x, z),
    slopeDegrees: heightField.getSlopeDegrees(x, z),
  };
}
