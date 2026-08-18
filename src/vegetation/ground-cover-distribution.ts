/**
 * Deterministically derives sparse flowers and rocks from terrain chunks.
 * Cached data contains only placement values and is shared by the global instanced render batches.
 */

import { MathUtils, Vector3 } from 'three';
import { TERRAIN, VEGETATION } from '../config';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import type { HeightField } from '../terrain/height-field';

export interface FlowerPlacement {
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

export interface RockPlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: number;
  readonly scale: number;
  readonly variant: number;
  readonly normal: readonly [number, number, number];
  readonly tint: number;
}

export interface GroundCoverPlacements {
  readonly flowers: readonly FlowerPlacement[];
  readonly rocks: readonly RockPlacement[];
}

export class GroundCoverDistribution {
  private readonly cache = new Map<string, GroundCoverPlacements>();
  private readonly normal = new Vector3();

  public constructor(private readonly heightField: HeightField, private readonly seed: number) {}

  public getChunkPlacements(chunkX: number, chunkZ: number): GroundCoverPlacements {
    const key = `${chunkX}:${chunkZ}`;
    const cached = this.cache.get(key);
    if (cached) return this.touchCache(key, cached);
    const placements = {
      flowers: this.createFlowers(chunkX, chunkZ),
      rocks: this.createRocks(chunkX, chunkZ),
    } satisfies GroundCoverPlacements;
    this.cache.set(key, placements);
    this.trimCache();
    return placements;
  }

  private createFlowers(chunkX: number, chunkZ: number): FlowerPlacement[] {
    const flowers: FlowerPlacement[] = [];
    const cells = Math.floor(TERRAIN.chunkSize / VEGETATION.flowerSpacing);
    for (let z = 0; z < cells; z += 1) {
      for (let x = 0; x < cells; x += 1) {
        const placement = this.createFlower(chunkX, chunkZ, x, z, cells);
        if (placement) flowers.push(placement);
      }
    }
    return flowers;
  }

  private createFlower(chunkX: number, chunkZ: number, cellX: number, cellZ: number, cells: number): FlowerPlacement | null {
    const hash = hashCoordinates(this.seed, chunkX * cells + cellX, chunkZ * cells + cellZ, 0x4f11);
    const x = this.getWorldCoordinate(chunkX, cellX, hash, cells, VEGETATION.flowerSpacing);
    const z = this.getWorldCoordinate(chunkZ, cellZ, hash, cells, VEGETATION.flowerSpacing);
    const height = this.heightField.getHeight(x, z);
    if (height < -30 || height > 155) return null;
    const slope = this.heightField.getSlope(x, z);
    if (slope > 0.56) return null;
    const moisture = this.heightField.getMoisture(x, z, height);
    const cover = this.heightField.getGroundCover(x, z, moisture);
    const woodland = this.heightField.getNoise(x + 240, z - 170, 0.00185, 3) * 0.5 + 0.5;
    const forestEdge = 1 - Math.abs(woodland - 0.56) * 2;
    const denseForest = MathUtils.smoothstep(woodland, 0.7, 0.9);
    const probability = MathUtils.smoothstep(cover, 0.34, 0.76)
      * (0.24 + Math.max(0, forestEdge) * 0.13) * (1 - denseForest * 0.72);
    if (unitRandom(hashCoordinates(hash, 7, 13)) >= probability) return null;
    return this.buildFlower(x, z, height, hash);
  }

  private buildFlower(x: number, z: number, y: number, hash: number): FlowerPlacement {
    return {
      x,
      y,
      z,
      rotation: unitRandom(hashCoordinates(hash, 17, 19)) * Math.PI * 2,
      scale: 0.7 + unitRandom(hashCoordinates(hash, 23, 29)) * 0.65,
      variant: hashCoordinates(hash, 31, 37) % 3,
      windPhase: unitRandom(hashCoordinates(hash, 41, 43)) * Math.PI * 2,
      windStrength: 0.6 + unitRandom(hashCoordinates(hash, 47, 53)) * 0.45,
      tint: unitRandom(hashCoordinates(hash, 59, 61)),
    };
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
    const cluster = this.heightField.getNoise(x - 430, z + 210, 0.0032, 2) * 0.5 + 0.5;
    const highland = MathUtils.smoothstep(height, 55, 195);
    const rugged = MathUtils.smoothstep(slope, 0.18, 0.82);
    const probability = 0.055 + cluster * 0.13 + highland * 0.2 + rugged * 0.28;
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
    const jitter = signedRandom(hashCoordinates(hash, cell, 0x51d3)) * spacing * 0.42;
    return chunkStart + (cell + 0.5) * (TERRAIN.chunkSize / cells) + jitter;
  }

  private touchCache(key: string, placements: GroundCoverPlacements): GroundCoverPlacements {
    this.cache.delete(key);
    this.cache.set(key, placements);
    return placements;
  }

  private trimCache(): void {
    if (this.cache.size <= 96) return;
    const oldestKey = this.cache.keys().next().value as string | undefined;
    if (oldestKey) this.cache.delete(oldestKey);
  }
}
