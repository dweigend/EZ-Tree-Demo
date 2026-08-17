/**
 * Defines shared chunk-window coordinate policies for terrain and vegetation consumers.
 * It owns coordinate selection only; streaming, caching, rendering, and lifecycle remain in their systems.
 */

export interface ChunkCoordinate {
  readonly key: string;
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

function createCoordinate(x: number, z: number): ChunkCoordinate {
  return { key: `${x}:${z}`, x, z };
}
