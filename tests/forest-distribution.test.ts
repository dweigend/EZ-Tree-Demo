/**
 * Verifies deterministic tree placement and exclusive ownership on the shared world lattice.
 */

import { describe, expect, test } from 'bun:test';
import { TERRAIN, WORLD_SEED } from '../src/config';
import { HeightField } from '../src/core/height-field';
import { hashString } from '../src/core/random';
import { ForestDistribution, type TreePlacement } from '../src/trees/forest-distribution';
import type { TreeSize, TreeSpecies } from '../src/trees/tree-templates';

const species = ['ash', 'aspen', 'oak', 'pine'] as const satisfies readonly TreeSpecies[];
const sizes = ['small', 'medium', 'large'] as const satisfies readonly TreeSize[];
const variants = species.flatMap((treeSpecies) => sizes.map((size) => ({ species: treeSpecies, size })));
const heightField = new HeightField(WORLD_SEED, 1);
const distribution = new ForestDistribution(heightField, hashString('forest-test'), variants);

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

  test('uses distinct size cohorts while keeping every placement on its species template', () => {
    const placements = getPlacements(-4, 4);
    const representedSizes = new Set(placements.map((placement) => variants[placement.variant]?.size));
    expect(representedSizes).toEqual(new Set(sizes));
    expect(placements.every((placement) => variants[placement.variant] !== undefined)).toBeTrue();

    const neighbours = analyseNeighbourPatterns(placements);
    expect(neighbours.cohortPairs).toBeGreaterThan(100);
    expect(neighbours.matchingCohorts / neighbours.cohortPairs).toBeGreaterThan(0.48);
    expect(neighbours.matchingSpecies / neighbours.nearbyPairs).toBeGreaterThan(
      getGlobalSpeciesBaseline(placements) + 0.08,
    );

    const slopes = analyseSlopePattern(placements);
    expect(slopes.steepTrees).toBeGreaterThan(50);
    expect(slopes.steepSizeAverage).toBeLessThan(slopes.flatSizeAverage);
  });
});

interface NeighbourPatternStats {
  readonly nearbyPairs: number;
  readonly matchingSpecies: number;
  readonly cohortPairs: number;
  readonly matchingCohorts: number;
}

interface SlopePatternStats {
  readonly steepTrees: number;
  readonly flatSizeAverage: number;
  readonly steepSizeAverage: number;
}

function getPlacements(minimumChunk: number, maximumChunk: number): TreePlacement[] {
  const placements: TreePlacement[] = [];
  for (let chunkZ = minimumChunk; chunkZ <= maximumChunk; chunkZ += 1) {
    for (let chunkX = minimumChunk; chunkX <= maximumChunk; chunkX += 1) {
      placements.push(...distribution.getChunkPlacements(chunkX, chunkZ));
    }
  }
  return placements;
}

function analyseNeighbourPatterns(placements: readonly TreePlacement[]): NeighbourPatternStats {
  const stats = { nearbyPairs: 0, matchingSpecies: 0, cohortPairs: 0, matchingCohorts: 0 };
  for (let index = 0; index < placements.length; index += 1) {
    const first = placements[index]!;
    const firstVariant = variants[first.variant]!;
    for (let otherIndex = index + 1; otherIndex < placements.length; otherIndex += 1) {
      const second = placements[otherIndex]!;
      const distance = Math.hypot(first.x - second.x, first.z - second.z);
      if (distance > 82) continue;
      stats.nearbyPairs += 1;
      const secondVariant = variants[second.variant]!;
      if (firstVariant.species !== secondVariant.species) continue;
      stats.matchingSpecies += 1;
      if (distance > 55) continue;
      stats.cohortPairs += 1;
      if (firstVariant.size === secondVariant.size) stats.matchingCohorts += 1;
    }
  }
  return stats;
}

function getGlobalSpeciesBaseline(placements: readonly TreePlacement[]): number {
  return species.reduce((total, treeSpecies) => {
    const count = placements.filter((placement) => variants[placement.variant]!.species === treeSpecies).length;
    return total + (count / placements.length) ** 2;
  }, 0);
}

function analyseSlopePattern(placements: readonly TreePlacement[]): SlopePatternStats {
  const flatSizes: number[] = [];
  const steepSizes: number[] = [];
  for (const placement of placements) {
    const size = sizes.indexOf(variants[placement.variant]!.size);
    const slope = heightField.getSlopeDegrees(placement.x, placement.z);
    if (slope < 8) flatSizes.push(size);
    if (slope > 20) steepSizes.push(size);
  }
  return {
    steepTrees: steepSizes.length,
    flatSizeAverage: average(flatSizes),
    steepSizeAverage: average(steepSizes),
  };
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function positionKey(placement: { readonly x: number; readonly z: number }): string {
  return `${placement.x}:${placement.z}`;
}
