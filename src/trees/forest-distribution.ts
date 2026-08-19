/**
 * Redistributes zone-authored mean tree densities into deterministic clearings and local stands.
 * It owns placement, species, variants, and caching; TreeSystem owns capacity and rendering.
 */

import { MathUtils } from 'three';
import { VEGETATION } from '../config';
import type { HeightField } from '../core/height-field';
import { hashCoordinates, unitRandom } from '../core/random';
import { writeLandscapeZoneWeights, type LandscapeSurfaceSample } from '../ecology/landscape-ecology';
import {
  createPopulationLattice,
  getPopulationCandidate,
  getPopulationCellRange,
  isInsidePopulationBounds,
  type PopulationCandidate,
  type PopulationLattice,
} from '../ecology/landscape-population';
import {
  createLandscapeZoneWeights,
  getMaximumPopulationDensityPerHectare,
  getPopulationDensityPerHectare,
  getTreePattern,
  selectPopulationType,
  type LandscapeZoneWeights,
  type TreePattern,
} from '../ecology/landscape-zones';
import { getChunkBounds } from '../world/chunk-coordinates';
import type { TreePresetSize, TreeSize, TreeSpecies } from './tree-templates';

interface TreeVisualVariant {
  readonly species: TreeSpecies;
  readonly size: TreePresetSize;
}

interface TreeCohortPattern {
  readonly sizeWeights: Readonly<Record<TreeSize, number>>;
  readonly cohortMeters: number;
  readonly cohesion: number;
  readonly salt: number;
}

interface TreeClusterPattern {
  readonly patchMeters: number;
  readonly clearingShare: number;
  readonly denseShare: number;
  readonly clearingMultiplier: number;
  readonly backgroundMultiplier: number;
  readonly denseMultiplier: number;
  readonly salt: number;
}

const TREE_SIZES = ['small', 'medium', 'large'] as const satisfies readonly TreeSize[];
const TREE_SPECIES = ['ash', 'aspen', 'oak', 'pine'] as const satisfies readonly TreeSpecies[];
const TREE_CANDIDATE_DENSITY_PER_HECTARE = 72;
const MAXIMUM_AUTHORED_TREE_DENSITY = getMaximumPopulationDensityPerHectare('trees');
const SPECIES_PATCH_METERS = 82;
const SPECIES_PATCH_COHESION = 0.78;
const TREE_PATTERNS: Readonly<Record<TreePattern, TreeClusterPattern>> = {
  scattered: createClusterPattern({
    patchMeters: 190,
    clearingShare: 0.4,
    denseShare: 0.18,
    denseMultiplier: 2.5,
    salt: 0x1871,
  }),
  grove: createClusterPattern({
    patchMeters: 120,
    clearingShare: 0.36,
    denseShare: 0.24,
    denseMultiplier: 2.75,
    salt: 0x2982,
  }),
  closed: createClusterPattern({
    patchMeters: 170,
    clearingShare: 0.28,
    denseShare: 0.25,
    denseMultiplier: 2.4,
    salt: 0x3a93,
  }),
  coniferStand: createClusterPattern({
    patchMeters: 145,
    clearingShare: 0.32,
    denseShare: 0.25,
    denseMultiplier: 2.65,
    salt: 0x4ba4,
  }),
};
/**
 * Morphology only: zones still own species and density.
 * Aspen forms tight young clonal groups, pine stronger even-aged stands, ash mixed cohorts,
 * and oak looser mature groups with more large silhouettes.
 */
const TREE_COHORTS: Readonly<Record<TreeSpecies, TreeCohortPattern>> = {
  ash: {
    sizeWeights: { small: 0.24, medium: 0.55, large: 0.21 },
    cohortMeters: 58,
    cohesion: 0.58,
    salt: 0x4a91,
  },
  aspen: {
    sizeWeights: { small: 0.36, medium: 0.5, large: 0.14 },
    cohortMeters: 44,
    cohesion: 0.82,
    salt: 0x5ba2,
  },
  oak: {
    sizeWeights: { small: 0.12, medium: 0.48, large: 0.4 },
    cohortMeters: 92,
    cohesion: 0.46,
    salt: 0x6cb3,
  },
  pine: {
    sizeWeights: { small: 0.28, medium: 0.52, large: 0.2 },
    cohortMeters: 72,
    cohesion: 0.84,
    salt: 0x7dc4,
  },
};

export interface TreePlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: number;
  readonly scale: number;
  readonly widthScale: number;
  readonly depthScale: number;
  readonly variant: number;
  readonly windPhase: number;
  readonly windStrength: number;
  readonly tint: number;
}

export class ForestDistribution {
  private readonly cache = new Map<string, TreePlacement[]>();
  private readonly zones = createLandscapeZoneWeights();
  private readonly surface: LandscapeSurfaceSample = {
    x: 0,
    z: 0,
    heightMeters: 0,
    slopeDegrees: 0,
  };
  private readonly lattice: PopulationLattice;
  private readonly variantIndices = createVariantIndices();

  public constructor(
    private readonly heightField: HeightField,
    seed: number,
    variants: readonly TreeVisualVariant[],
    private readonly maximumDensityPerHectare = VEGETATION.maximumTreeDensityPerHectare,
  ) {
    if (variants.length === 0) throw new Error('Forest distribution requires tree variants.');
    this.lattice = createPopulationLattice(TREE_CANDIDATE_DENSITY_PER_HECTARE, seed);
    variants.forEach((variant, index) => {
      if (variant.size === 'shrub') throw new Error('Forest distribution cannot place shrub variants as trees.');
      this.variantIndices[variant.species][variant.size].push(index);
    });
    for (const species of TREE_SPECIES) {
      if (TREE_SIZES.every((size) => this.variantIndices[species][size].length === 0)) {
        throw new Error(`Forest distribution requires a ${species} variant.`);
      }
    }
  }

  public getChunkPlacements(chunkX: number, chunkZ: number): TreePlacement[] {
    const key = `${chunkX}:${chunkZ}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const placements = this.createChunkPlacements(chunkX, chunkZ);
    this.cache.set(key, placements);
    if (this.cache.size > VEGETATION.placementCacheSize) this.cache.delete(this.cache.keys().next().value!);
    return placements;
  }

  private createChunkPlacements(chunkX: number, chunkZ: number): TreePlacement[] {
    const bounds = getChunkBounds(chunkX, chunkZ);
    const range = getPopulationCellRange(this.lattice, bounds);
    const placements: TreePlacement[] = [];
    for (let cellZ = range.minimumZ; cellZ <= range.maximumZ; cellZ += 1) {
      for (let cellX = range.minimumX; cellX <= range.maximumX; cellX += 1) {
        const candidate = getPopulationCandidate(this.lattice, cellX, cellZ);
        if (!isInsidePopulationBounds(candidate, bounds)) continue;
        const placement = this.createPlacement(candidate);
        if (placement) placements.push(placement);
      }
    }
    return placements;
  }

  private createPlacement(candidate: PopulationCandidate): TreePlacement | null {
    this.sampleZones(candidate.x, candidate.z);
    const authoredDensity = getPopulationDensityPerHectare(this.zones, 'trees');
    const meanDensity = Math.min(authoredDensity, this.maximumDensityPerHectare);
    const localDensity = meanDensity * this.getClusterMultiplier(candidate);
    if (candidate.densityRankPerHectare >= localDensity) return null;
    const species = this.chooseSpecies(candidate);
    if (!species) return null;
    return this.buildPlacement(candidate, species, authoredDensity);
  }

  private getClusterMultiplier(candidate: PopulationCandidate): number {
    const pattern = TREE_PATTERNS[getTreePattern(this.zones)];
    const fieldX = (candidate.x + candidate.z * 0.37) / pattern.patchMeters;
    const fieldZ = (candidate.z - candidate.x * 0.29) / pattern.patchMeters;
    const patchX = Math.floor(fieldX);
    const patchZ = Math.floor(fieldZ);
    const blendX = sharpenedSmoothstep(fieldX - patchX);
    const blendZ = sharpenedSmoothstep(fieldZ - patchZ);
    const lower = MathUtils.lerp(
      getPatchMultiplier(this.lattice.seed, { x: patchX, z: patchZ }, pattern),
      getPatchMultiplier(this.lattice.seed, { x: patchX + 1, z: patchZ }, pattern),
      blendX,
    );
    const upper = MathUtils.lerp(
      getPatchMultiplier(this.lattice.seed, { x: patchX, z: patchZ + 1 }, pattern),
      getPatchMultiplier(this.lattice.seed, { x: patchX + 1, z: patchZ + 1 }, pattern),
      blendX,
    );
    return MathUtils.lerp(lower, upper, blendZ);
  }

  private chooseSpecies(candidate: PopulationCandidate): TreeSpecies | null {
    const individual = unitRandom(hashCoordinates(candidate.hash, 19, 23));
    const patch = this.getPatchSelection(candidate, SPECIES_PATCH_METERS, 0x39a7);
    const joinsPatch = unitRandom(hashCoordinates(candidate.hash, 83, 89)) < SPECIES_PATCH_COHESION;
    return selectPopulationType(this.zones, 'trees', joinsPatch ? patch : individual);
  }

  private sampleZones(x: number, z: number): LandscapeZoneWeights {
    this.surface.x = x;
    this.surface.z = z;
    this.surface.heightMeters = this.heightField.getHeight(x, z);
    this.surface.slopeDegrees = this.heightField.getSlopeDegrees(x, z);
    return writeLandscapeZoneWeights(this.heightField, this.surface, this.zones);
  }

  private buildPlacement(candidate: PopulationCandidate, species: TreeSpecies, density: number): TreePlacement {
    const hash = candidate.hash;
    return {
      x: candidate.x,
      y: this.surface.heightMeters,
      z: candidate.z,
      rotation: unitRandom(hashCoordinates(hash, 3, 5)) * Math.PI * 2,
      scale: 0.82 + unitRandom(hashCoordinates(hash, 17, 19)) * 0.38,
      widthScale: 0.9 + unitRandom(hashCoordinates(hash, 61, 67)) * 0.22,
      depthScale: 0.9 + unitRandom(hashCoordinates(hash, 71, 73)) * 0.2,
      variant: this.chooseVariant(candidate, species, density),
      windPhase: unitRandom(hashCoordinates(hash, 37, 41)) * Math.PI * 2,
      windStrength: 0.72 + unitRandom(hashCoordinates(hash, 43, 47)) * 0.48,
      tint: unitRandom(hashCoordinates(hash, 53, 59)),
    };
  }

  private chooseVariant(candidate: PopulationCandidate, species: TreeSpecies, density: number): number {
    const size = this.chooseTreeSize(candidate, species, density);
    const exactPool = this.variantIndices[species][size];
    const pool = exactPool.length > 0
      ? exactPool
      : TREE_SIZES.flatMap((candidateSize) => this.variantIndices[species][candidateSize]);
    return pool[hashCoordinates(candidate.hash, 29, 31) % pool.length]!;
  }

  private chooseTreeSize(candidate: PopulationCandidate, species: TreeSpecies, density: number): TreeSize {
    const pattern = TREE_COHORTS[species];
    const cohortSelection = this.getCohortSelection(candidate, pattern);
    const sparseMaturity = 1 - density / MAXIMUM_AUTHORED_TREE_DENSITY;
    const slopeStunting = MathUtils.smoothstep(this.surface.slopeDegrees, 10, 30);
    const selection = MathUtils.clamp(
      cohortSelection + sparseMaturity * 0.17 - slopeStunting * 0.34,
      0,
      0.999_999,
    );
    if (selection < pattern.sizeWeights.small) return 'small';
    if (selection < pattern.sizeWeights.small + pattern.sizeWeights.medium) return 'medium';
    return 'large';
  }

  private getCohortSelection(candidate: PopulationCandidate, pattern: TreeCohortPattern): number {
    const individual = unitRandom(hashCoordinates(candidate.hash, 97, 101));
    const patch = this.getPatchSelection(candidate, pattern.cohortMeters, pattern.salt);
    return MathUtils.lerp(individual, patch, pattern.cohesion);
  }

  private getPatchSelection(candidate: PopulationCandidate, patchMeters: number, salt: number): number {
    const patchX = Math.floor((candidate.x + candidate.z * 0.37) / patchMeters);
    const patchZ = Math.floor((candidate.z - candidate.x * 0.29) / patchMeters);
    return unitRandom(hashCoordinates(this.lattice.seed, patchX, patchZ, salt));
  }
}

function createVariantIndices(): Record<TreeSpecies, Record<TreeSize, number[]>> {
  return {
    ash: { small: [], medium: [], large: [] },
    aspen: { small: [], medium: [], large: [] },
    oak: { small: [], medium: [], large: [] },
    pine: { small: [], medium: [], large: [] },
  };
}

function createClusterPattern(
  values: Pick<TreeClusterPattern, 'patchMeters' | 'clearingShare' | 'denseShare' | 'denseMultiplier' | 'salt'>,
): TreeClusterPattern {
  const clearingMultiplier = 0;
  const backgroundShare = 1 - values.clearingShare - values.denseShare;
  const backgroundMultiplier = (
    1 - values.clearingShare * clearingMultiplier - values.denseShare * values.denseMultiplier
  ) / backgroundShare;
  return {
    ...values,
    clearingMultiplier,
    backgroundMultiplier,
  };
}

function getPatchMultiplier(
  seed: number,
  coordinate: { readonly x: number; readonly z: number },
  pattern: TreeClusterPattern,
): number {
  const field = unitRandom(hashCoordinates(seed, coordinate.x, coordinate.z, pattern.salt));
  if (field < pattern.clearingShare) return pattern.clearingMultiplier;
  if (field < pattern.clearingShare + pattern.denseShare) return pattern.denseMultiplier;
  return pattern.backgroundMultiplier;
}

function sharpenedSmoothstep(value: number): number {
  const first = value * value * (3 - 2 * value);
  const second = first * first * (3 - 2 * first);
  return second * second * (3 - 2 * second);
}
