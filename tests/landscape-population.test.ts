/**
 * Verifies deterministic physical density candidates and exclusive spatial ownership.
 */

import { describe, expect, test } from 'bun:test';
import {
  createPopulationLattice,
  getPopulationCandidate,
  getPopulationCellRange,
  isInsidePopulationBounds,
  type PopulationBounds,
} from '../src/ecology/landscape-population';

const lattice = createPopulationLattice(24, 123_456);

describe('landscape population lattice', () => {
  test('derives a deterministic physical cell size and density rank', () => {
    expect(lattice.cellSizeMeters).toBeCloseTo(Math.sqrt(10_000 / 24), 8);
    const first = getPopulationCandidate(lattice, 4, -7);
    const second = getPopulationCandidate(lattice, 4, -7);
    expect(second).toEqual(first);
    expect(first.densityRankPerHectare).toBeWithin(0, 24);
  });

  test('keeps adjacent ownership sets disjoint at chunk borders', () => {
    const left = collectHashes({
      minimumX: -160,
      maximumX: 160,
      minimumZ: -160,
      maximumZ: 160,
    });
    const right = collectHashes({
      minimumX: 160,
      maximumX: 480,
      minimumZ: -160,
      maximumZ: 160,
    });
    expect([...right].some((hash) => left.has(hash))).toBeFalse();
  });

  test('lower physical limits are stable subsets of higher limits', () => {
    const ranks = [
      ...collectCandidates({
        minimumX: -500,
        maximumX: 500,
        minimumZ: -500,
        maximumZ: 500,
      }),
    ].map((candidate) => candidate.densityRankPerHectare);
    const desktop = ranks.filter((rank) => rank < 24);
    const pico = ranks.filter((rank) => rank < 20);
    expect(pico.every((rank) => desktop.includes(rank))).toBeTrue();
    expect(pico.length).toBeLessThan(desktop.length);
  });
});

function collectHashes(bounds: PopulationBounds): Set<number> {
  return new Set([...collectCandidates(bounds)].map((candidate) => candidate.hash));
}

function* collectCandidates(bounds: PopulationBounds) {
  const range = getPopulationCellRange(lattice, bounds);
  for (let z = range.minimumZ; z <= range.maximumZ; z += 1) {
    for (let x = range.minimumX; x <= range.maximumX; x += 1) {
      const candidate = getPopulationCandidate(lattice, x, z);
      if (isInsidePopulationBounds(candidate, bounds)) yield candidate;
    }
  }
}
