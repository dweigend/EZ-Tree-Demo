/**
 * Fixed-capacity terrain streaming window.
 * Reuses chunk meshes around the camera so world growth never allocates during flight.
 */

import { Group, Vector3 } from 'three';
import type { GroundTextureAssets } from '../assets/landscape-assets';
import { TERRAIN } from '../config';
import {
  getChunkIndex,
  getChunkSquare,
  prioritiseChunkDirection,
  type ChunkCoordinate,
  type HorizontalDirection,
} from '../world/chunk-coordinates';
import type { HeightField } from '../core/height-field';
import { TerrainChunk } from './terrain-chunk';
import { createTerrainMaterial } from './terrain-material';

export class TerrainSystem {
  public readonly group = new Group();
  public get activeChunkCount(): number {
    return this.activeChunks.size;
  }
  private readonly chunks: TerrainChunk[] = [];
  private readonly activeChunks = new Map<string, TerrainChunk>();
  private readonly pendingAssignments: Array<{
    readonly key: string;
    readonly chunk: TerrainChunk;
    readonly x: number;
    readonly z: number;
  }> = [];
  private initialised = false;
  private centerX = Number.NaN;
  private centerZ = Number.NaN;

  public constructor(heightField: HeightField, textures: GroundTextureAssets) {
    const material = createTerrainMaterial(textures);
    const diameter = TERRAIN.chunkRadius * 2 + 1;
    // Allocate the complete window once; reassignment mutates buffers instead of creating meshes during flight.
    for (let index = 0; index < diameter * diameter; index += 1) {
      const chunk = new TerrainChunk(heightField, material);
      this.chunks.push(chunk);
      this.group.add(chunk.mesh);
    }
  }

  public updateChunkWindow(position: Vector3, viewDirection: HorizontalDirection): boolean {
    const nextX = getChunkIndex(position.x);
    const nextZ = getChunkIndex(position.z);
    if (nextX === this.centerX && nextZ === this.centerZ) return false;
    this.centerX = nextX;
    this.centerZ = nextZ;
    this.scheduleChunks(viewDirection);
    if (!this.initialised) {
      while (this.pendingAssignments.length > 0) this.processNextAssignment();
      this.initialised = true;
    }
    return true;
  }

  public processNextChunk(): void {
    // One assignment per idle frame bounds terrain resampling spikes after a window shift.
    this.processNextAssignment();
  }

  public dispose(): void {
    this.chunks.forEach((chunk) => chunk.dispose());
    const material = this.chunks[0]?.mesh.material;
    material?.dispose();
    this.group.clear();
  }

  private scheduleChunks(viewDirection: HorizontalDirection): void {
    const desired = this.getDesiredCoordinates(viewDirection);
    const recycled = this.releaseMissingChunks(desired);
    for (const [key, coordinates] of desired) {
      if (this.activeChunks.has(key)) continue;
      const chunk = recycled.pop();
      if (!chunk) throw new Error('Terrain chunk pool exhausted.');
      this.activeChunks.set(key, chunk);
      this.pendingAssignments.push({
        key,
        chunk,
        x: coordinates.x,
        z: coordinates.z,
      });
    }
  }

  private processNextAssignment(): void {
    const assignment = this.pendingAssignments.shift();
    if (!assignment || this.activeChunks.get(assignment.key) !== assignment.chunk) return;
    assignment.chunk.assign(assignment.x, assignment.z);
  }

  private getDesiredCoordinates(viewDirection: HorizontalDirection): Map<string, ChunkCoordinate> {
    const square = getChunkSquare(this.centerX, this.centerZ, TERRAIN.chunkRadius);
    const prioritised = prioritiseChunkDirection(square, this.centerX, this.centerZ, viewDirection);
    return new Map(prioritised.map((coordinate) => [coordinate.key, coordinate]));
  }

  private releaseMissingChunks(desired: ReadonlyMap<string, unknown>): TerrainChunk[] {
    const recycled: TerrainChunk[] = [];
    for (const [key, chunk] of this.activeChunks) {
      if (desired.has(key)) continue;
      this.activeChunks.delete(key);
      recycled.push(chunk);
    }
    if (this.activeChunks.size === 0) recycled.push(...this.chunks.filter((chunk) => !recycled.includes(chunk)));
    return recycled;
  }
}
