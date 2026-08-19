/**
 * Reusable terrain chunk mesh backed by one fixed-resolution geometry.
 * It resamples a continuous HeightField when reassigned and shares its material with all chunks.
 */

import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  Vector4,
} from 'three';
import { TERRAIN } from '../config';
import {
  writeLandscapeMaterialWeights,
  type LandscapeMaterialWeights,
  type LandscapeSurfaceSample,
} from '../ecology/landscape-ecology';
import type { HeightField } from '../core/height-field';

export class TerrainChunk {
  public readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly positions: BufferAttribute;
  private readonly normals: BufferAttribute;
  private readonly materialWeightsA: BufferAttribute;
  private readonly materialWeightsB: BufferAttribute;
  private readonly normal = new Vector3();
  private readonly weights: LandscapeMaterialWeights = { first: new Vector4(), second: new Vector4() };
  private readonly surface: LandscapeSurfaceSample = { x: 0, z: 0, height: 0, slope: 0 };

  public constructor(
    private readonly heightField: HeightField,
    material: MeshStandardMaterial,
  ) {
    const geometry = new PlaneGeometry(TERRAIN.chunkSize, TERRAIN.chunkSize, TERRAIN.segments, TERRAIN.segments);
    geometry.rotateX(-Math.PI / 2);
    this.positions = geometry.getAttribute('position') as BufferAttribute;
    this.normals = geometry.getAttribute('normal') as BufferAttribute;
    this.positions.setUsage(DynamicDrawUsage);
    this.normals.setUsage(DynamicDrawUsage);
    this.materialWeightsA = new BufferAttribute(new Float32Array(this.positions.count * 4), 4).setUsage(
      DynamicDrawUsage,
    );
    this.materialWeightsB = new BufferAttribute(new Float32Array(this.positions.count * 4), 4).setUsage(
      DynamicDrawUsage,
    );
    geometry.setAttribute('aMaterialWeightsA', this.materialWeightsA);
    geometry.setAttribute('aMaterialWeightsB', this.materialWeightsB);
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
    this.materialWeightsA.needsUpdate = true;
    this.materialWeightsB.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }

  private writeSurfaceVertex(index: number): void {
    const worldX = this.mesh.position.x + this.positions.getX(index);
    const worldZ = this.mesh.position.z + this.positions.getZ(index);
    const height = this.heightField.getHeight(worldX, worldZ);
    this.heightField.getNormal(worldX, worldZ, this.normal, TERRAIN.normalSampleDistance);
    this.positions.setY(index, height);
    this.normals.setXYZ(index, this.normal.x, this.normal.y, this.normal.z);
    this.surface.x = worldX;
    this.surface.z = worldZ;
    this.surface.height = height;
    this.surface.slope = 1 - this.normal.y;
    writeLandscapeMaterialWeights(this.heightField, this.surface, this.weights);
    this.materialWeightsA.setXYZW(
      index,
      this.weights.first.x,
      this.weights.first.y,
      this.weights.first.z,
      this.weights.first.w,
    );
    this.materialWeightsB.setXYZW(
      index,
      this.weights.second.x,
      this.weights.second.y,
      this.weights.second.z,
      this.weights.second.w,
    );
  }
}
