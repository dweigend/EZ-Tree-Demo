/**
 * Verifies deterministic hedge rows, exclusive chunk ownership, safe sites, curves, and intentional gaps.
 */

import { describe, expect, test } from 'bun:test';
import { TERRAIN, WORLD_SEED } from '../src/config';
import { HeightField } from '../src/core/height-field';
import { hashString } from '../src/core/random';
import { getTrailEnvelope } from '../src/ecology/landscape-ecology';
import { HedgeDistribution, type HedgePlacement } from '../src/trees/hedge-distribution';

const heightField = new HeightField(WORLD_SEED, 1);
const distribution = new HedgeDistribution(heightField, hashString('hedge-test'));

describe('hedge distribution', () => {
  test('is deterministic, bounded, and exclusively owned by its chunk', () => {
    const first = distribution.getChunkPlacements(0, 0);
    const second = distribution.getChunkPlacements(0, 0);
    expect(second).toEqual(first);
    expect(first.length).toBeWithin(1, 420);
    for (const placement of first) {
      expect(isOwnedByChunk(placement, 0, 0)).toBeTrue();
      const slope = heightField.getSlope(placement.x, placement.z);
      expect(slope).toBeLessThanOrEqual(0.34);
      expect(getTrailEnvelope({ ...placement, height: placement.y, slope })).toBeLessThanOrEqual(0.08);
    }
  });

  test('continues macro rows across chunk borders without duplicate shrubs', () => {
    const chunks = collectChunks(-2, 2);
    const rows = groupByRow(chunks.flat());
    const spanning = [...rows.values()].find((placements) => {
      const chunksForRow = new Set(placements.map((placement) => ownerKey(placement)));
      return chunksForRow.size > 1;
    });
    expect(spanning).toBeDefined();
    const keys = spanning!.map((placement) => `${placement.rowId}:${placement.pointIndex}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('contains gentle curvature and deterministic gaps', () => {
    const rows = groupByRow(collectChunks(-3, 3).flat());
    const organicRow = [...rows.values()].find((placements) => {
      if (placements.length < 8) return false;
      const ordered = [...placements].sort((left, right) => left.pointIndex - right.pointIndex);
      const rotationRange = Math.max(...ordered.map((placement) => placement.rotation))
        - Math.min(...ordered.map((placement) => placement.rotation));
      const hasGap = ordered.some((placement, index) => {
        const next = ordered[index + 1];
        return next ? next.pointIndex - placement.pointIndex > 1 : false;
      });
      return rotationRange > 0.02 && hasGap;
    });
    expect(organicRow).toBeDefined();
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

function isOwnedByChunk(placement: HedgePlacement, chunkX: number, chunkZ: number): boolean {
  return ownerKey(placement) === `${chunkX}:${chunkZ}`;
}

function ownerKey(placement: HedgePlacement): string {
  const x = Math.floor((placement.x + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
  const z = Math.floor((placement.z + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
  return `${x}:${z}`;
}
