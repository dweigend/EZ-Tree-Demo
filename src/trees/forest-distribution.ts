/**
 * Creates deterministic tree placements from the shared physical zone populations.
 * It selects cached positions and species; TreeSystem owns LODs, capacity, and rendering.
 */

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
  selectPopulationType,
  type LandscapeZoneWeights,
} from '../ecology/landscape-zones';
import { getChunkBounds } from '../world/chunk-coordinates';
import type { TreeSpecies } from './tree-templates';

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
  private readonly allVariantIndices: number[] = [];
  private readonly zones = createLandscapeZoneWeights();
  private readonly surface: LandscapeSurfaceSample = {
    x: 0,
    z: 0,
    heightMeters: 0,
    slopeDegrees: 0,
  };
  private readonly lattice: PopulationLattice;
  private readonly variantIndices: Record<TreeSpecies, number[]> = {
    ash: [],
    aspen: [],
    oak: [],
    pine: [],
  };

  public constructor(
    private readonly heightField: HeightField,
    seed: number,
    variants: readonly { readonly species: TreeSpecies }[],
  ) {
    if (variants.length === 0) throw new Error('Forest distribution requires tree variants.');
    this.lattice = createPopulationLattice(getMaximumPopulationDensityPerHectare('trees'), seed);
    variants.forEach((variant, index) => {
      this.variantIndices[variant.species].push(index);
      this.allVariantIndices.push(index);
    });
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
    const density = Math.min(authoredDensity, VEGETATION.maximumTreeDensityPerHectare);
    if (candidate.densityRankPerHectare >= density) return null;
    const species = selectPopulationType(this.zones, 'trees', unitRandom(hashCoordinates(candidate.hash, 19, 23)));
    if (!species) return null;
    return this.buildPlacement(candidate, species);
  }

  private sampleZones(x: number, z: number): LandscapeZoneWeights {
    this.surface.x = x;
    this.surface.z = z;
    this.surface.heightMeters = this.heightField.getHeight(x, z);
    this.surface.slopeDegrees = this.heightField.getSlopeDegrees(x, z);
    return writeLandscapeZoneWeights(this.heightField, this.surface, this.zones);
  }

  private buildPlacement(candidate: PopulationCandidate, species: TreeSpecies): TreePlacement {
    const hash = candidate.hash;
    return {
      x: candidate.x,
      y: this.surface.heightMeters,
      z: candidate.z,
      rotation: unitRandom(hashCoordinates(hash, 3, 5)) * Math.PI * 2,
      scale: 0.82 + unitRandom(hashCoordinates(hash, 17, 19)) * 0.38,
      widthScale: 0.9 + unitRandom(hashCoordinates(hash, 61, 67)) * 0.22,
      depthScale: 0.9 + unitRandom(hashCoordinates(hash, 71, 73)) * 0.2,
      variant: this.chooseVariant(species, hash),
      windPhase: unitRandom(hashCoordinates(hash, 37, 41)) * Math.PI * 2,
      windStrength: 0.72 + unitRandom(hashCoordinates(hash, 43, 47)) * 0.48,
      tint: unitRandom(hashCoordinates(hash, 53, 59)),
    };
  }

  private chooseVariant(species: TreeSpecies, hash: number): number {
    const candidates = this.variantIndices[species];
    const pool = candidates.length > 0 ? candidates : this.allVariantIndices;
    return pool[hashCoordinates(hash, 29, 31) % pool.length] ?? 0;
  }
}
