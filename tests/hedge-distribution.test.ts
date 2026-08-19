/**
 * Verifies deterministic hedge cohorts, physical density, chunk ownership, gaps, and slope alignment.
 */

import { describe, expect, test } from 'bun:test';
import { TERRAIN, WORLD_SEED } from '../src/config';
import { HeightField } from '../src/core/height-field';
import { hashString } from '../src/core/random';
import { getTrailEnvelope, writeLandscapeZoneWeights } from '../src/ecology/landscape-ecology';
import {
  createLandscapeZoneWeights,
  getHedgeRowMetersPerHectare,
  getHedgeShrubSpacingMeters,
} from '../src/ecology/landscape-zones';
import { HedgeDistribution, type HedgePlacement } from '../src/trees/hedge-distribution';

const heightField = new HeightField(WORLD_SEED, 1);
const distribution = new HedgeDistribution(heightField, hashString('hedge-test'), 4);

describe('hedge distribution', () => {
  test('is deterministic, bounded, safe, and exclusively owned', () => {
    const first = distribution.getChunkPlacements(0, 0);
    const second = distribution.getChunkPlacements(0, 0);
    expect(second).toEqual(first);
    expect(first.length).toBeLessThanOrEqual(420);
    for (const placement of first) {
      expect(isOwnedByChunk(placement, 0, 0)).toBeTrue();
      expect(placement.variant).toBeWithin(0, 4);
      const slopeDegrees = heightField.getSlopeDegrees(placement.x, placement.z);
      expect(slopeDegrees).toBeLessThanOrEqual(20);
      expect(
        getTrailEnvelope({
          x: placement.x,
          z: placement.z,
          heightMeters: placement.y,
          slopeDegrees,
        }),
      ).toBeLessThanOrEqual(0.08);
    }
    expect(collectChunks(-2, 2).some((placements) => placements.length > 0)).toBeTrue();
  });

  test('keeps cohort points unique across chunk borders', () => {
    const placements = collectChunks(-3, 3).flat();
    const keys = placements.map((placement) => `${placement.rowId}:${placement.pointIndex}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('forms gapped two-dimensional cohorts with non-cyclic variant mixing', () => {
    const rows = groupByRow(collectChunks(-4, 4).flat());
    const organicCohort = [...rows.values()].find((placements) => {
      return placements.length >= 10
        && new Set(placements.map((placement) => placement.variant)).size >= 3
        && hasSpatialGap(placements)
        && hasTwoDimensionalSpread(placements);
    });
    expect(organicCohort).toBeDefined();
    const variants = organicCohort!.map((placement) => placement.variant);
    expect(variants.some((variant, index) => index > 1 && variant === variants[index - 1])).toBeTrue();
  });

  test('keeps total shrub density within ten percent of the authored row density', () => {
    const placements = collectChunks(-6, 6).flat();
    const expectedCount = estimateExpectedHedgeCount(-6, 6);
    expect(placements.length / expectedCount).toBeWithin(0.9, 1.1);
    expect(new Set(placements.map((placement) => placement.pattern))).toEqual(
      new Set(['fieldHedge', 'brokenRow', 'thicket', 'slopeGroup']),
    );
  });

  test('aligns slope groups with the local terrain contour', () => {
    const rows = groupByRow(collectChunks(-6, 6).flat());
    const alignments = [...rows.values()]
      .filter((placements) => placements[0]?.pattern === 'slopeGroup' && placements.length >= 6)
      .map(getContourAlignment)
      .filter((alignment) => alignment !== null)
      .sort((left, right) => left - right);
    expect(alignments.length).toBeGreaterThan(3);
    expect(alignments[Math.floor(alignments.length / 2)]!).toBeGreaterThan(0.8);
  });
});

function collectChunks(minimum: number, maximum: number): HedgePlacement[][] {
  const chunks: HedgePlacement[][] = [];
  for (let z = minimum; z <= maximum; z += 1) {
    for (let x = minimum; x <= maximum; x += 1) chunks.push(distribution.getChunkPlacements(x, z));
  }
  return chunks;
}

function groupByRow(placements: readonly HedgePlacement[]): Map<string, HedgePlacement[]> {
  const rows = new Map<string, HedgePlacement[]>();
  for (const placement of placements) {
    const row = rows.get(placement.rowId) ?? [];
    row.push(placement);
    rows.set(placement.rowId, row);
  }
  return rows;
}

function hasSpatialGap(placements: readonly HedgePlacement[]): boolean {
  const ordered = [...placements].sort((left, right) => left.pointIndex - right.pointIndex);
  return ordered.some((placement, index) => {
    const next = ordered[index + 1];
    return next ? Math.hypot(next.x - placement.x, next.z - placement.z) > 8 : false;
  });
}

function hasTwoDimensionalSpread(placements: readonly HedgePlacement[]): boolean {
  const first = placements[0]!;
  const farthest = [...placements].sort((left, right) => distance(right, first) - distance(left, first))[0]!;
  const lineLength = distance(first, farthest);
  if (lineLength === 0) return false;
  return placements.some((placement) => {
    const area = Math.abs(
      (farthest.x - first.x) * (placement.z - first.z)
      - (farthest.z - first.z) * (placement.x - first.x),
    );
    return area / lineLength > 4;
  });
}

function estimateExpectedHedgeCount(minimumChunk: number, maximumChunk: number): number {
  const minimum = minimumChunk * TERRAIN.chunkSize - TERRAIN.chunkSize / 2;
  const maximum = maximumChunk * TERRAIN.chunkSize + TERRAIN.chunkSize / 2;
  const sampleSize = 80;
  const zones = createLandscapeZoneWeights();
  let expected = 0;
  for (let z = minimum + sampleSize / 2; z < maximum; z += sampleSize) {
    for (let x = minimum + sampleSize / 2; x < maximum; x += sampleSize) {
      const surface = {
        x,
        z,
        heightMeters: heightField.getHeight(x, z),
        slopeDegrees: heightField.getSlopeDegrees(x, z),
      };
      writeLandscapeZoneWeights(heightField, surface, zones);
      expected += getHedgeRowMetersPerHectare(zones)
        / getHedgeShrubSpacingMeters(zones)
        * sampleSize ** 2
        / 10_000;
    }
  }
  return expected;
}

function getContourAlignment(placements: readonly HedgePlacement[]): number | null {
  const centerX = average(placements.map((placement) => placement.x));
  const centerZ = average(placements.map((placement) => placement.z));
  const covariance = getCovariance(placements, centerX, centerZ);
  const direction = 0.5 * Math.atan2(2 * covariance.xz, covariance.xx - covariance.zz);
  const sampleDistance = 5;
  const gradientX = heightField.getHeight(centerX + sampleDistance, centerZ)
    - heightField.getHeight(centerX - sampleDistance, centerZ);
  const gradientZ = heightField.getHeight(centerX, centerZ + sampleDistance)
    - heightField.getHeight(centerX, centerZ - sampleDistance);
  const gradientLength = Math.hypot(gradientX, gradientZ);
  if (gradientLength < 0.08) return null;
  return Math.abs((Math.cos(direction) * gradientZ - Math.sin(direction) * gradientX) / gradientLength);
}

function getCovariance(placements: readonly HedgePlacement[], centerX: number, centerZ: number) {
  let xx = 0;
  let zz = 0;
  let xz = 0;
  for (const placement of placements) {
    const x = placement.x - centerX;
    const z = placement.z - centerZ;
    xx += x * x;
    zz += z * z;
    xz += x * z;
  }
  return { xx, zz, xz };
}

function distance(left: HedgePlacement, right: HedgePlacement): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isOwnedByChunk(placement: HedgePlacement, chunkX: number, chunkZ: number): boolean {
  return ownerKey(placement) === `${chunkX}:${chunkZ}`;
}

function ownerKey(placement: HedgePlacement): string {
  const x = Math.floor((placement.x + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
  const z = Math.floor((placement.z + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
  return `${x}:${z}`;
}
