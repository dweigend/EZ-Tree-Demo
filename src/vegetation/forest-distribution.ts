/**
 * Deterministic ecological placement for clustered forests and isolated trees.
 * Height, slope, moisture, and multiple noise scales decide density without owning render objects.
 */

import { MathUtils } from 'three';
import { TERRAIN, VEGETATION } from '../config';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import type { HeightField } from '../terrain/height-field';
import type { TreeSize, TreeSpecies } from '../trees/tree-templates';

export interface TreeVariantProfile {
  readonly species: TreeSpecies;
  readonly size: TreeSize;
}

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
  private readonly variantIndices = new Map<string, number>();

  public constructor(
    private readonly heightField: HeightField,
    private readonly seed: number,
    variants: readonly TreeVariantProfile[],
  ) {
    if (variants.length === 0) throw new Error('Forest distribution requires tree variants.');
    variants.forEach((variant, index) => this.variantIndices.set(variantKey(variant.species, variant.size), index));
  }

  public getChunkPlacements(chunkX: number, chunkZ: number): TreePlacement[] {
    const key = `${chunkX}:${chunkZ}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const placements: TreePlacement[] = [];
    const cells = Math.floor(TERRAIN.chunkSize / VEGETATION.treeSpacing);
    for (let z = 0; z < cells; z += 1) {
      for (let x = 0; x < cells; x += 1) {
        const placement = this.createPlacement(chunkX, chunkZ, x, z, cells);
        if (placement) placements.push(placement);
      }
    }
    this.cache.set(key, placements);
    this.trimCache();
    return placements;
  }

  private trimCache(): void {
    if (this.cache.size <= 96) return;
    const oldestKey = this.cache.keys().next().value as string | undefined;
    if (oldestKey) this.cache.delete(oldestKey);
  }

  private createPlacement(chunkX: number, chunkZ: number, cellX: number, cellZ: number, cells: number): TreePlacement | null {
    const cellHash = hashCoordinates(this.seed, chunkX * cells + cellX, chunkZ * cells + cellZ);
    const x = this.getWorldCoordinate(chunkX, cellX, cellHash, 0x25f3);
    const z = this.getWorldCoordinate(chunkZ, cellZ, cellHash, 0x74a9);
    const height = this.heightField.getHeight(x, z);
    const slope = this.heightField.getSlope(x, z);
    const moisture = this.heightField.getMoisture(x, z, height);
    if (!this.acceptsSite(x, z, height, slope, moisture, cellHash)) return null;
    return this.buildPlacement(x, z, height, slope, moisture, cellHash);
  }

  private getWorldCoordinate(chunk: number, cell: number, hash: number, salt: number): number {
    const chunkStart = chunk * TERRAIN.chunkSize - TERRAIN.chunkSize / 2;
    const jitter = signedRandom(hashCoordinates(hash, cell, salt)) * VEGETATION.treeSpacing * 0.42;
    return chunkStart + (cell + 0.5) * VEGETATION.treeSpacing + jitter;
  }

  private acceptsSite(x: number, z: number, height: number, slope: number, moisture: number, hash: number): boolean {
    const cluster = this.heightField.getNoise(x + 240, z - 170, 0.00185, 3) * 0.5 + 0.5;
    const grove = this.heightField.getNoise(x - 90, z + 310, 0.0048, 2) * 0.5 + 0.5;
    const clearing = MathUtils.smoothstep(this.heightField.getNoise(x + 70, z + 20, 0.009, 2) * 0.5 + 0.5, 0.72, 0.9);
    const altitude = MathUtils.smoothstep(height, -35, 24) * (1 - MathUtils.smoothstep(height, 148, 225));
    const slopeFitness = 1 - MathUtils.smoothstep(slope, 0.38, 1.05);
    const forestCore = MathUtils.smoothstep(cluster, 0.46, 0.72) * (0.36 + moisture * 0.48);
    const forestEdge = MathUtils.smoothstep(grove, 0.58, 0.82) * 0.2;
    const isolatedChance = unitRandom(hashCoordinates(hash, 11, 29)) > 0.965 ? 0.16 : 0;
    const probability = (forestCore + forestEdge) * altitude * slopeFitness * (1 - clearing * 0.9) * 2.35 + isolatedChance;
    return unitRandom(hashCoordinates(hash, 7, 13)) < probability;
  }

  private buildPlacement(x: number, z: number, y: number, slope: number, moisture: number, hash: number): TreePlacement {
    return {
      x,
      y,
      z,
      rotation: unitRandom(hashCoordinates(hash, 3, 5)) * Math.PI * 2,
      scale: 0.82 + unitRandom(hashCoordinates(hash, 17, 19)) * 0.38,
      widthScale: 0.9 + unitRandom(hashCoordinates(hash, 61, 67)) * 0.22,
      depthScale: 0.9 + unitRandom(hashCoordinates(hash, 71, 73)) * 0.2,
      variant: this.chooseVariant(x, z, y, slope, moisture, hash),
      windPhase: unitRandom(hashCoordinates(hash, 37, 41)) * Math.PI * 2,
      windStrength: 0.72 + unitRandom(hashCoordinates(hash, 43, 47)) * 0.48,
      tint: unitRandom(hashCoordinates(hash, 53, 59)),
    };
  }

  private chooseVariant(x: number, z: number, height: number, slope: number, moisture: number, hash: number): number {
    const species = this.chooseSpecies(x, z, height, slope, moisture);
    const size = this.chooseSize(slope, hash);
    return this.variantIndices.get(variantKey(species, size)) ?? 0;
  }

  private chooseSpecies(x: number, z: number, height: number, slope: number, moisture: number): TreeSpecies {
    const broadBiome = this.heightField.getNoise(x - 610, z + 370, 0.00085, 3) * 0.5 + 0.5;
    const localBiome = this.heightField.getNoise(x + 190, z - 430, 0.0045, 2) * 0.5 + 0.5;
    const biome = broadBiome * 0.72 + localBiome * 0.28;
    const highland = MathUtils.smoothstep(height, 58, 175);
    const pineAffinity = highland * 0.62 + MathUtils.smoothstep(slope, 0.32, 0.8) * 0.18 + (1 - moisture) * 0.16;
    if (biome < pineAffinity) return 'pine';
    const wetland = moisture * 0.68 + biome * 0.32;
    if (wetland > 0.7) return 'aspen';
    if (wetland > 0.53) return 'ash';
    return 'oak';
  }

  private chooseSize(slope: number, hash: number): TreeSize {
    const size = unitRandom(hashCoordinates(hash, 23, 31)) + MathUtils.smoothstep(slope, 0.35, 0.85) * 0.18;
    if (size < 0.26) return 'large';
    if (size < 0.73) return 'medium';
    return 'small';
  }
}

function variantKey(species: TreeSpecies, size: TreeSize): string {
  return `${species}:${size}`;
}
