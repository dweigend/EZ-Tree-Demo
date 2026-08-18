/**
 * Defines shared chunk-window coordinate and prefetch-order policies for terrain and vegetation consumers.
 * Data loading, caching, rendering, and lifecycle remain in their systems.
 */

import { TERRAIN } from '../config';

export interface ChunkCoordinate {
  readonly key: string;
  readonly x: number;
  readonly z: number;
}

export interface HorizontalDirection {
  readonly x: number;
  readonly z: number;
}

export const getChunkIndex = (worldCoordinate: number): number => Math.floor((worldCoordinate + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);

export class ChunkPrefetchQueue {
  private centerX = Number.NaN;
  private centerZ = Number.NaN;
  private readonly queue: ChunkCoordinate[] = [];

  public constructor(private readonly radius: number) {}

  public next(position: HorizontalDirection, direction: HorizontalDirection): ChunkCoordinate | undefined {
    const centerX = getChunkIndex(position.x);
    const centerZ = getChunkIndex(position.z);
    if (centerX !== this.centerX || centerZ !== this.centerZ) {
      this.centerX = centerX;
      this.centerZ = centerZ;
      this.queue.length = 0;
      this.queue.push(...prioritiseChunkDirection(getChunkRing(centerX, centerZ, this.radius), centerX, centerZ, direction));
    }
    return this.queue.shift();
  }
}

export function getChunkSquare(centerX: number, centerZ: number, radius: number): ChunkCoordinate[] {
  const coordinates: ChunkCoordinate[] = [];
  for (let z = -radius; z <= radius; z += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      coordinates.push(createCoordinate(centerX + x, centerZ + z));
    }
  }
  return coordinates;
}

export function getChunkRing(centerX: number, centerZ: number, radius: number): ChunkCoordinate[] {
  return getChunkSquare(centerX, centerZ, radius).filter(
    (coordinate) => Math.max(Math.abs(coordinate.x - centerX), Math.abs(coordinate.z - centerZ)) === radius,
  );
}

export function getChunkViewWindow(
  centerX: number,
  centerZ: number,
  radius: number,
  direction: HorizontalDirection,
  safetyRadius = 1,
): ChunkCoordinate[] {
  return getChunkSquare(centerX, centerZ, radius).filter((coordinate) => {
    const x = coordinate.x - centerX;
    const z = coordinate.z - centerZ;
    if (Math.max(Math.abs(x), Math.abs(z)) <= safetyRadius) return true;
    const distance = Math.hypot(x, z);
    const directionLength = Math.hypot(direction.x, direction.z);
    if (distance === 0 || directionLength === 0) return true;
    return (x * direction.x + z * direction.z) / (distance * directionLength) >= -0.15;
  });
}

export function prioritiseChunkDirection(
  coordinates: readonly ChunkCoordinate[],
  centerX: number,
  centerZ: number,
  direction: HorizontalDirection,
): ChunkCoordinate[] {
  return [...coordinates].sort((left, right) => {
    const forwardDifference = getForwardScore(right, centerX, centerZ, direction) - getForwardScore(left, centerX, centerZ, direction);
    return forwardDifference || getDistanceScore(left, centerX, centerZ) - getDistanceScore(right, centerX, centerZ);
  });
}

function createCoordinate(x: number, z: number): ChunkCoordinate {
  return { key: `${x}:${z}`, x, z };
}

function getForwardScore(coordinate: ChunkCoordinate, centerX: number, centerZ: number, direction: HorizontalDirection): number {
  return (coordinate.x - centerX) * direction.x + (coordinate.z - centerZ) * direction.z;
}

function getDistanceScore(coordinate: ChunkCoordinate, centerX: number, centerZ: number): number {
  return Math.hypot(coordinate.x - centerX, coordinate.z - centerZ);
}
