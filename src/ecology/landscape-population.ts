/**
 * Converts physical per-hectare densities into one deterministic absolute-world candidate lattice.
 * It owns candidate coordinates only; zone contents and render capacity stay with their domain owners.
 */

import { hashCoordinates, signedRandom, unitRandom } from '../core/random';

export const SQUARE_METERS_PER_HECTARE = 10_000;
const POSITION_JITTER_RATIO = 0.42;

export interface PopulationLattice {
  readonly maximumDensityPerHectare: number;
  readonly cellSizeMeters: number;
  readonly seed: number;
}

export interface PopulationBounds {
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumZ: number;
  readonly maximumZ: number;
}

export interface PopulationCellRange {
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumZ: number;
  readonly maximumZ: number;
}

export interface PopulationCandidate {
  readonly x: number;
  readonly z: number;
  readonly hash: number;
  readonly densityRankPerHectare: number;
}

export function createPopulationLattice(maximumDensityPerHectare: number, seed: number): PopulationLattice {
  if (maximumDensityPerHectare <= 0) throw new Error('Population density must be greater than zero.');
  return {
    maximumDensityPerHectare,
    cellSizeMeters: Math.sqrt(SQUARE_METERS_PER_HECTARE / maximumDensityPerHectare),
    seed,
  };
}

export function getPopulationCellRange(lattice: PopulationLattice, bounds: PopulationBounds): PopulationCellRange {
  const margin = lattice.cellSizeMeters * POSITION_JITTER_RATIO;
  return {
    minimumX: Math.floor((bounds.minimumX - margin) / lattice.cellSizeMeters),
    maximumX: Math.ceil((bounds.maximumX + margin) / lattice.cellSizeMeters),
    minimumZ: Math.floor((bounds.minimumZ - margin) / lattice.cellSizeMeters),
    maximumZ: Math.ceil((bounds.maximumZ + margin) / lattice.cellSizeMeters),
  };
}

/** Samples one stable candidate; callers decide ownership and ecological acceptance. */
export function getPopulationCandidate(lattice: PopulationLattice, cellX: number, cellZ: number): PopulationCandidate {
  const hash = hashCoordinates(lattice.seed, cellX, cellZ);
  const jitterDistance = lattice.cellSizeMeters * POSITION_JITTER_RATIO;
  const x = (cellX + 0.5) * lattice.cellSizeMeters + signedRandom(hashCoordinates(hash, 3, 5)) * jitterDistance;
  const z = (cellZ + 0.5) * lattice.cellSizeMeters + signedRandom(hashCoordinates(hash, 7, 11)) * jitterDistance;
  return {
    x,
    z,
    hash,
    densityRankPerHectare: unitRandom(hashCoordinates(hash, 13, 17)) * lattice.maximumDensityPerHectare,
  };
}

export function isInsidePopulationBounds(candidate: PopulationCandidate, bounds: PopulationBounds): boolean {
  return (
    candidate.x >= bounds.minimumX &&
    candidate.x < bounds.maximumX &&
    candidate.z >= bounds.minimumZ &&
    candidate.z < bounds.maximumZ
  );
}
