/**
 * Deterministically derives sparse rocks from terrain chunks.
 * Cached data contains only placement values and is shared by the global instanced render batches.
 */

import { MathUtils, Vector3 } from 'three';
import { TERRAIN, VEGETATION } from '../config';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import type { HeightField } from '../core/height-field';

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

  public constructor(
    private readonly heightField: HeightField,
    private readonly seed: number,
  ) {}

  public getChunkPlacements(chunkX: number, chunkZ: number): GroundCoverPlacements {
    const key = `${chunkX}:${chunkZ}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const placements = { rocks: this.createRocks(chunkX, chunkZ) } satisfies GroundCoverPlacements;
    this.cache.set(key, placements);
    if (this.cache.size > VEGETATION.placementCacheSize) this.cache.delete(this.cache.keys().next().value!);
    return placements;
  }

  private createRocks(chunkX: number, chunkZ: number): RockPlacement[] {
    const rocks: RockPlacement[] = [];
    const cells = Math.floor(TERRAIN.chunkSize / VEGETATION.rockSpacing);
    for (let z = 0; z < cells; z += 1) {
      for (let x = 0; x < cells; x += 1) {
        const placement = this.createRock(chunkX, chunkZ, x, z, cells);
        if (placement) rocks.push(placement);
      }
    }
    return rocks;
  }

  private createRock(chunkX: number, chunkZ: number, cellX: number, cellZ: number, cells: number): RockPlacement | null {
    const hash = hashCoordinates(this.seed, chunkX * cells + cellX, chunkZ * cells + cellZ, 0x8a31);
    const x = this.getWorldCoordinate(chunkX, cellX, hash, cells, VEGETATION.rockSpacing);
    const z = this.getWorldCoordinate(chunkZ, cellZ, hash, cells, VEGETATION.rockSpacing);
    const height = this.heightField.getHeight(x, z);
    this.heightField.getNormal(x, z, this.normal);
    const slope = Math.hypot(this.normal.x, this.normal.z) / Math.max(this.normal.y, 0.01);
    const cluster = this.heightField.getNoise01((x - 430) * 0.0032, (z + 210) * 0.0032, 2);
    const highland = MathUtils.smoothstep(height, 55, 195);
    const rugged = MathUtils.smoothstep(slope, 0.18, 0.82);
    const probability = 0.08 + cluster * 0.18 + highland * 0.25 + rugged * 0.32;
    if (unitRandom(hashCoordinates(hash, 71, 73)) >= probability) return null;
    return this.buildRock(x, z, height, hash);
  }

  private buildRock(x: number, z: number, y: number, hash: number): RockPlacement {
    const scale = 0.38 + unitRandom(hashCoordinates(hash, 79, 83)) ** 1.7 * 1.08;
    return {
      x,
      y: y - scale * 0.52,
      z,
      rotation: unitRandom(hashCoordinates(hash, 89, 97)) * Math.PI * 2,
      scale,
      variant: hashCoordinates(hash, 101, 103) % 3,
      normal: [this.normal.x, this.normal.y, this.normal.z],
      tint: unitRandom(hashCoordinates(hash, 107, 109)),
    };
  }

  private getWorldCoordinate(chunk: number, cell: number, hash: number, cells: number, spacing: number): number {
    const chunkStart = chunk * TERRAIN.chunkSize - TERRAIN.chunkSize / 2;
    const jitter = signedRandom(hashCoordinates(hash, cell, 0x51d3)) * spacing * VEGETATION.jitterRatio;
    return chunkStart + (cell + 0.5) * (TERRAIN.chunkSize / cells) + jitter;
  }
}
