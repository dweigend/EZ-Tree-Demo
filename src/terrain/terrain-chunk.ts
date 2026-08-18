/**
 * Reusable terrain chunk mesh backed by one fixed-resolution geometry.
 * It resamples a continuous HeightField when reassigned and shares its material with all chunks.
 */

import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { TERRAIN } from '../config';
import type { HeightField } from './height-field';

export class TerrainChunk {
  public readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly positions: BufferAttribute;
  private readonly normals: BufferAttribute;
  private readonly groundCover: BufferAttribute;

  public constructor(private readonly heightField: HeightField, material: MeshStandardMaterial) {
    const geometry = new PlaneGeometry(TERRAIN.chunkSize, TERRAIN.chunkSize, TERRAIN.segments, TERRAIN.segments);
    geometry.rotateX(-Math.PI / 2);
    this.positions = geometry.getAttribute('position') as BufferAttribute;
    this.normals = geometry.getAttribute('normal') as BufferAttribute;
    this.positions.setUsage(DynamicDrawUsage);
    this.normals.setUsage(DynamicDrawUsage);
    this.groundCover = new BufferAttribute(new Float32Array(this.positions.count), 1).setUsage(DynamicDrawUsage);
    geometry.setAttribute('aGroundCover', this.groundCover);
    this.mesh = new Mesh(geometry, material);
    this.mesh.receiveShadow = true;
  }

  public assign(coordinateX: number, coordinateZ: number): void {
    this.mesh.position.set(coordinateX * TERRAIN.chunkSize, 0, coordinateZ * TERRAIN.chunkSize);
    this.resampleGeometry();
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
  }

  private resampleGeometry(): void {
    for (let index = 0; index < this.positions.count; index += 1) {
      this.writeSurfaceVertex(index);
    }
    this.positions.needsUpdate = true;
    this.normals.needsUpdate = true;
    this.groundCover.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }

  private writeSurfaceVertex(index: number): void {
    const worldX = this.mesh.position.x + this.positions.getX(index);
    const worldZ = this.mesh.position.z + this.positions.getZ(index);
    const step = TERRAIN.normalSampleDistance;
    const height = this.heightField.getHeight(worldX, worldZ);
    const dx = this.heightField.getHeight(worldX + step, worldZ) - this.heightField.getHeight(worldX - step, worldZ);
    const dz = this.heightField.getHeight(worldX, worldZ + step) - this.heightField.getHeight(worldX, worldZ - step);
    const inverseLength = 1 / Math.hypot(dx, step * 2, dz);
    const moisture = this.heightField.getMoisture(worldX, worldZ, height);
    this.positions.setY(index, height);
    this.normals.setXYZ(index, -dx * inverseLength, step * 2 * inverseLength, -dz * inverseLength);
    this.groundCover.setX(index, this.heightField.getGroundCover(worldX, worldZ, moisture));
  }
}
