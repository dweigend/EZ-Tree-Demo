/**
 * Deterministic ecological placement for clustered forests and isolated trees.
 * Height, slope, moisture, and multiple noise scales decide density without owning render objects.
 */

import { MathUtils } from 'three';
import { TERRAIN, VEGETATION } from '../config';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import type { HeightField } from '../terrain/height-field';

export interface TreePlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: number;
  readonly scale: number;
  readonly variant: number;
  readonly windPhase: number;
  readonly windStrength: number;
  readonly tint: number;
}

export class ForestDistribution {
  private readonly cache = new Map<string, TreePlacement[]>();

  public constructor(private readonly heightField: HeightField, private readonly seed: number) {}

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
    const surface = this.heightField.getSurface(x, z);
    if (!this.acceptsSite(x, z, surface.height, surface.slope, surface.moisture, cellHash)) return null;
    return this.buildPlacement(x, z, surface.height, cellHash);
  }

  private getWorldCoordinate(chunk: number, cell: number, hash: number, salt: number): number {
    const chunkStart = chunk * TERRAIN.chunkSize - TERRAIN.chunkSize / 2;
    const jitter = signedRandom(hashCoordinates(hash, cell, salt)) * VEGETATION.treeSpacing * 0.42;
    return chunkStart + (cell + 0.5) * VEGETATION.treeSpacing + jitter;
  }

  private acceptsSite(x: number, z: number, height: number, slope: number, moisture: number, hash: number): boolean {
    const cluster = this.heightField.getNoise(x + 240, z - 170, 0.00185, 3) * 0.5 + 0.5;
    const grove = this.heightField.getNoise(x - 90, z + 310, 0.0048, 2) * 0.5 + 0.5;
    const altitude = MathUtils.smoothstep(height, -35, 24) * (1 - MathUtils.smoothstep(height, 148, 225));
    const slopeFitness = 1 - MathUtils.smoothstep(slope, 0.38, 1.05);
    const ecology = cluster * 0.48 + grove * 0.18 + moisture * 0.34;
    const isolatedChance = unitRandom(hashCoordinates(hash, 11, 29)) > 0.94 ? 0.22 : 0;
    const probability = Math.max(0, ecology - 0.37) * 2.75 * altitude * slopeFitness + isolatedChance;
    return unitRandom(hashCoordinates(hash, 7, 13)) < probability;
  }

  private buildPlacement(x: number, z: number, y: number, hash: number): TreePlacement {
    return {
      x,
      y,
      z,
      rotation: unitRandom(hashCoordinates(hash, 3, 5)) * Math.PI * 2,
      scale: 0.76 + unitRandom(hashCoordinates(hash, 17, 19)) * 0.46,
      variant: hashCoordinates(hash, 23, 31) % VEGETATION.treeVariantCount,
      windPhase: unitRandom(hashCoordinates(hash, 37, 41)) * Math.PI * 2,
      windStrength: 0.72 + unitRandom(hashCoordinates(hash, 43, 47)) * 0.48,
      tint: unitRandom(hashCoordinates(hash, 53, 59)),
    };
  }
}
