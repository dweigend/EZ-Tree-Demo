/**
 * Fixed-capacity terrain streaming window.
 * Reuses chunk meshes around the camera so world growth never allocates during flight.
 */

import { Group, MeshStandardMaterial, Vector3 } from 'three';
import { TERRAIN } from '../config';
import type { HeightField } from './height-field';
import { TerrainChunk } from './terrain-chunk';

export class TerrainSystem {
  public readonly group = new Group();
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

  public constructor(private readonly heightField: HeightField) {
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    const diameter = TERRAIN.chunkRadius * 2 + 1;
    for (let index = 0; index < diameter * diameter; index += 1) {
      const chunk = new TerrainChunk(this.heightField, material);
      this.chunks.push(chunk);
      this.group.add(chunk.mesh);
    }
  }

  public update(position: Vector3): boolean {
    const nextX = Math.floor((position.x + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
    const nextZ = Math.floor((position.z + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
    if (nextX === this.centerX && nextZ === this.centerZ) return false;
    this.centerX = nextX;
    this.centerZ = nextZ;
    this.scheduleChunks();
    if (!this.initialised) {
      while (this.pendingAssignments.length > 0) this.processNextAssignment();
      this.initialised = true;
    }
    return true;
  }

  public processStreaming(): void {
    this.processNextAssignment();
  }

  public dispose(): void {
    this.chunks.forEach((chunk) => chunk.dispose());
    const material = this.chunks[0]?.mesh.material;
    material?.dispose();
    this.group.clear();
  }

  private scheduleChunks(): void {
    const desired = this.getDesiredCoordinates();
    const recycled = this.releaseMissingChunks(desired);
    for (const [key, coordinates] of desired) {
      if (this.activeChunks.has(key)) continue;
      const chunk = recycled.pop();
      if (!chunk) throw new Error('Terrain chunk pool exhausted.');
      this.activeChunks.set(key, chunk);
      this.pendingAssignments.push({ key, chunk, x: coordinates.x, z: coordinates.z });
    }
  }

  private processNextAssignment(): void {
    const assignment = this.pendingAssignments.shift();
    if (!assignment || this.activeChunks.get(assignment.key) !== assignment.chunk) return;
    assignment.chunk.assign(assignment.x, assignment.z);
  }

  private getDesiredCoordinates(): Map<string, { readonly x: number; readonly z: number }> {
    const desired = new Map<string, { readonly x: number; readonly z: number }>();
    for (let z = -TERRAIN.chunkRadius; z <= TERRAIN.chunkRadius; z += 1) {
      for (let x = -TERRAIN.chunkRadius; x <= TERRAIN.chunkRadius; x += 1) {
        const coordinate = { x: this.centerX + x, z: this.centerZ + z };
        desired.set(`${coordinate.x}:${coordinate.z}`, coordinate);
      }
    }
    return desired;
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
