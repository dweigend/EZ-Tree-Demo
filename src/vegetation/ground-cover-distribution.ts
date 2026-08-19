/**
 * Creates deterministic rock placements from the shared physical zone populations.
 * It caches placement data only; GroundCoverSystem owns model variants and GPU batches.
 */

import { MathUtils, Vector3 } from 'three';
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
} from '../ecology/landscape-zones';
import { getChunkBounds } from '../world/chunk-coordinates';

interface GroundPlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: number;
  readonly scale: number;
  readonly variant: number;
  readonly tint: number;
}

export interface RockPlacement extends GroundPlacement {
  readonly normal: readonly [number, number, number];
}

export interface GroundCoverPlacements {
  readonly rocks: readonly RockPlacement[];
}

export class GroundCoverDistribution {
  private readonly cache = new Map<string, GroundCoverPlacements>();
  private readonly normal = new Vector3();
  private readonly zones = createLandscapeZoneWeights();
  private readonly surface: LandscapeSurfaceSample = {
    x: 0,
    z: 0,
    heightMeters: 0,
    slopeDegrees: 0,
  };
  private readonly lattice: PopulationLattice;

  public constructor(
    private readonly heightField: HeightField,
    seed: number,
  ) {
    this.lattice = createPopulationLattice(getMaximumPopulationDensityPerHectare('rocks'), seed);
  }

  public getChunkPlacements(chunkX: number, chunkZ: number): GroundCoverPlacements {
    const key = `${chunkX}:${chunkZ}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const placements = {
      rocks: this.createRocks(chunkX, chunkZ),
    } satisfies GroundCoverPlacements;
    this.cache.set(key, placements);
    if (this.cache.size > VEGETATION.placementCacheSize) this.cache.delete(this.cache.keys().next().value!);
    return placements;
  }

  private createRocks(chunkX: number, chunkZ: number): RockPlacement[] {
    const bounds = getChunkBounds(chunkX, chunkZ);
    const range = getPopulationCellRange(this.lattice, bounds);
    const rocks: RockPlacement[] = [];
    for (let cellZ = range.minimumZ; cellZ <= range.maximumZ; cellZ += 1) {
      for (let cellX = range.minimumX; cellX <= range.maximumX; cellX += 1) {
        const candidate = getPopulationCandidate(this.lattice, cellX, cellZ);
        if (!isInsidePopulationBounds(candidate, bounds)) continue;
        const rock = this.createRock(candidate);
        if (rock) rocks.push(rock);
      }
    }
    return rocks;
  }

  private createRock(candidate: PopulationCandidate): RockPlacement | null {
    const { x, z } = candidate;
    const heightMeters = this.heightField.getHeight(x, z);
    this.heightField.getNormal(x, z, this.normal);
    this.surface.x = x;
    this.surface.z = z;
    this.surface.heightMeters = heightMeters;
    this.surface.slopeDegrees = MathUtils.radToDeg(Math.acos(MathUtils.clamp(this.normal.y, -1, 1)));
    writeLandscapeZoneWeights(this.heightField, this.surface, this.zones);
    if (candidate.densityRankPerHectare >= getPopulationDensityPerHectare(this.zones, 'rocks')) return null;
    return this.buildRock(candidate, heightMeters);
  }

  private buildRock(candidate: PopulationCandidate, heightMeters: number): RockPlacement {
    const hash = candidate.hash;
    const scale = 0.38 + unitRandom(hashCoordinates(hash, 79, 83)) ** 1.7 * 1.08;
    return {
      x: candidate.x,
      y: heightMeters - scale * 0.52,
      z: candidate.z,
      rotation: unitRandom(hashCoordinates(hash, 89, 97)) * Math.PI * 2,
      scale,
      variant: hashCoordinates(hash, 101, 103) % 3,
      normal: [this.normal.x, this.normal.y, this.normal.z],
      tint: unitRandom(hashCoordinates(hash, 107, 109)),
    };
  }
}
