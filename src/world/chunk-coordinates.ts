/**
 * Defines shared chunk-window coordinate policies for terrain and vegetation consumers.
 * It owns coordinate selection only; streaming, caching, rendering, and lifecycle remain in their systems.
 */

export interface ChunkCoordinate {
  readonly key: string;
  readonly x: number;
  readonly z: number;
}

export interface HorizontalDirection {
  readonly x: number;
  readonly z: number;
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
  return getChunkSquare(centerX, centerZ, radius).filter((coordinate) => (
    Math.max(Math.abs(coordinate.x - centerX), Math.abs(coordinate.z - centerZ)) === radius
  ));
}

export function prioritiseChunkDirection(
  coordinates: readonly ChunkCoordinate[],
  centerX: number,
  centerZ: number,
  direction: HorizontalDirection,
): ChunkCoordinate[] {
  return [...coordinates].sort((left, right) => {
    const forwardDifference = getForwardScore(right, centerX, centerZ, direction)
      - getForwardScore(left, centerX, centerZ, direction);
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
