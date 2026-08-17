/**
 * Reusable terrain chunk mesh backed by one fixed-resolution geometry.
 * It resamples a continuous HeightField when reassigned and shares its material with all chunks.
 */

import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { TERRAIN } from '../config';
import type { HeightField } from './height-field';

const LOWLAND = new Color('#5d7847');
const HIGHLAND = new Color('#73785c');
const ROCK = new Color('#77766f');
const DRY_GRASS = new Color('#8d8b58');

export class TerrainChunk {
  public readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  public coordinateX = Number.NaN;
  public coordinateZ = Number.NaN;
  private readonly positions: BufferAttribute;
  private readonly normals: BufferAttribute;
  private readonly colors: BufferAttribute;

  public constructor(private readonly heightField: HeightField, material: MeshStandardMaterial) {
    const geometry = new PlaneGeometry(TERRAIN.chunkSize, TERRAIN.chunkSize, TERRAIN.segments, TERRAIN.segments);
    geometry.rotateX(-Math.PI / 2);
    this.positions = geometry.getAttribute('position') as BufferAttribute;
    this.normals = geometry.getAttribute('normal') as BufferAttribute;
    this.colors = new BufferAttribute(new Float32Array(this.positions.count * 3), 3);
    geometry.setAttribute('color', this.colors);
    this.mesh = new Mesh(geometry, material);
    this.mesh.receiveShadow = true;
  }

  public assign(coordinateX: number, coordinateZ: number): void {
    this.coordinateX = coordinateX;
    this.coordinateZ = coordinateZ;
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
    this.colors.needsUpdate = true;
    this.mesh.geometry.computeBoundingBox();
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
    this.positions.setY(index, height);
    this.normals.setXYZ(index, -dx * inverseLength, step * 2 * inverseLength, -dz * inverseLength);
    this.writeColor(index, height, Math.hypot(dx, dz) / (step * 2), this.heightField.getMoisture(worldX, worldZ, height));
  }

  private writeColor(index: number, height: number, slope: number, moisture: number): void {
    const elevation = Math.min(Math.max((height - 30) / 165, 0), 1);
    const rockMix = Math.min(Math.max((slope - 0.42) / 0.7, 0), 1);
    const base = DRY_GRASS.clone().lerp(LOWLAND, moisture * 0.78).lerp(HIGHLAND, elevation * 0.62);
    base.lerp(ROCK, rockMix * (0.4 + elevation * 0.6));
    this.colors.setXYZ(index, base.r, base.g, base.b);
  }
}
