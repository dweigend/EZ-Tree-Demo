/**
 * Camera-bounded instanced grass field with GPU blade bending.
 * Stable world-grid sampling prevents swimming while distance thinning keeps one draw call bounded.
 */

import {
  Color,
  DynamicDrawUsage,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshPhongMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { VEGETATION } from '../config';
import type { InstancedModelAsset } from '../assets/landscape-assets';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import { updateAttributePrefix } from '../rendering/update-instanced-attributes';
import type { HeightField } from '../terrain/height-field';
import type { WindUniforms } from '../wind/wind-field';
import { createGrassMaterial, prepareGrassGeometry } from './grass-material';

const GRASS_DARK = new Color('#b1c08d');
const GRASS_LIGHT = new Color('#ded39a');
const IDENTITY_ROTATION = new Quaternion();
const GRASS_CANDIDATES_PER_FRAME = 800;

interface GrassBuildJob {
  readonly target: Vector3;
  readonly minX: number;
  readonly maxX: number;
  readonly maxZ: number;
  currentX: number;
  currentZ: number;
  count: number;
}

export class GrassSystem {
  public readonly mesh: InstancedMesh<BufferGeometry, MeshPhongMaterial>;
  public get visibleBladeCount(): number {
    return this.mesh.count;
  }
  private readonly rotation: InstancedBufferAttribute;
  private readonly phase: InstancedBufferAttribute;
  private readonly strength: InstancedBufferAttribute;
  private readonly lastAnchor = new Vector3(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
  private readonly transform = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly color = new Color();
  private buildJob: GrassBuildJob | null = null;

  public constructor(
    private readonly heightField: HeightField,
    private readonly seed: number,
    wind: WindUniforms,
    asset: InstancedModelAsset,
  ) {
    const geometry = prepareGrassGeometry(asset.geometry);
    this.rotation = new InstancedBufferAttribute(new Float32Array(VEGETATION.grassCapacity), 1);
    this.phase = new InstancedBufferAttribute(new Float32Array(VEGETATION.grassCapacity), 1);
    this.strength = new InstancedBufferAttribute(new Float32Array(VEGETATION.grassCapacity), 1);
    this.rotation.setUsage(DynamicDrawUsage);
    this.phase.setUsage(DynamicDrawUsage);
    this.strength.setUsage(DynamicDrawUsage);
    geometry.setAttribute('aRotation', this.rotation);
    geometry.setAttribute('aWindPhase', this.phase);
    geometry.setAttribute('aWindStrength', this.strength);
    const sourceMaterial = asset.materials[0];
    if (!sourceMaterial) throw new Error('Grass asset has no material.');
    this.mesh = new InstancedMesh(geometry, createGrassMaterial(sourceMaterial, wind), VEGETATION.grassCapacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.receiveShadow = true;
  }

  public update(cameraPosition: Vector3): void {
    const distance = Math.hypot(cameraPosition.x - this.lastAnchor.x, cameraPosition.z - this.lastAnchor.z);
    if (!this.buildJob && distance >= VEGETATION.grassRefreshDistance) this.startBuild(cameraPosition);
    this.processBuildJob();
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }

  private startBuild(cameraPosition: Vector3): void {
    const radiusInCells = Math.ceil(VEGETATION.grassRadius / VEGETATION.grassSpacing);
    const centerX = Math.round(cameraPosition.x / VEGETATION.grassSpacing);
    const centerZ = Math.round(cameraPosition.z / VEGETATION.grassSpacing);
    this.buildJob = {
      target: new Vector3(cameraPosition.x, 0, cameraPosition.z),
      minX: centerX - radiusInCells,
      maxX: centerX + radiusInCells,
      currentX: centerX - radiusInCells,
      currentZ: centerZ - radiusInCells,
      maxZ: centerZ + radiusInCells,
      count: 0,
    };
  }

  private processBuildJob(): void {
    const job = this.buildJob;
    if (!job) return;
    for (let processed = 0; processed < GRASS_CANDIDATES_PER_FRAME; processed += 1) {
      if (job.currentZ > job.maxZ || job.count >= VEGETATION.grassCapacity) {
        this.completeBuild(job);
        return;
      }
      if (this.tryAddBlade(job.currentX, job.currentZ, job.target, job.count)) job.count += 1;
      job.currentX += 1;
      if (job.currentX <= job.maxX) continue;
      job.currentX = job.minX;
      job.currentZ += 1;
    }
  }

  private completeBuild(job: GrassBuildJob): void {
    this.lastAnchor.copy(job.target);
    this.buildJob = null;
    this.finaliseBuffers(job.count);
  }

  private tryAddBlade(cellX: number, cellZ: number, cameraPosition: Vector3, index: number): boolean {
    const hash = hashCoordinates(this.seed, cellX, cellZ);
    const worldX = (cellX + signedRandom(hashCoordinates(hash, 3, 7)) * 0.42) * VEGETATION.grassSpacing;
    const worldZ = (cellZ + signedRandom(hashCoordinates(hash, 11, 13)) * 0.42) * VEGETATION.grassSpacing;
    const distance = Math.hypot(worldX - cameraPosition.x, worldZ - cameraPosition.z);
    const height = this.getAcceptedHeight(worldX, worldZ, distance, hash);
    if (height === null) return false;
    this.writeBlade(index, worldX, worldZ, height, hash);
    return true;
  }

  private getAcceptedHeight(x: number, z: number, distance: number, hash: number): number | null {
    if (distance > VEGETATION.grassRadius) return null;
    const height = this.heightField.getHeight(x, z);
    if (height > 205 || height < -38 || this.heightField.getSlope(x, z) > 0.82) return null;
    const distanceRatio = distance / VEGETATION.grassRadius;
    const distanceKeep = distanceRatio < 0.62 ? 1 : Math.max(0.08, 1 - (distanceRatio - 0.62) / 0.38);
    const moisture = this.heightField.getMoisture(x, z, height);
    const cover = this.heightField.getGroundCover(x, z, moisture);
    const meadow = MathUtils.smoothstep(cover, 0.3, 0.76);
    const patch = this.heightField.getNoise(x - 130, z + 270, 0.012, 2) * 0.5 + 0.5;
    const patchDensity = MathUtils.smoothstep(patch, 0.28, 0.72);
    const woodland = this.heightField.getNoise(x + 240, z - 170, 0.00185, 3) * 0.5 + 0.5;
    const forestShade = MathUtils.smoothstep(woodland, 0.68, 0.88);
    const ecology = (0.04 + meadow * 0.78) * (0.16 + patchDensity * 0.84) * (1 - forestShade * 0.52);
    return unitRandom(hashCoordinates(hash, 17, 19)) < ecology * distanceKeep ? height : null;
  }

  private writeBlade(index: number, x: number, z: number, y: number, hash: number): void {
    const height = 0.9 + unitRandom(hashCoordinates(hash, 23, 29)) * 0.5;
    const width = 0.42 + unitRandom(hashCoordinates(hash, 31, 37)) * 0.24;
    this.position.set(x, y - 0.03, z);
    this.scale.set(width, height, width);
    this.transform.compose(this.position, IDENTITY_ROTATION, this.scale);
    this.mesh.setMatrixAt(index, this.transform);
    this.rotation.setX(index, unitRandom(hashCoordinates(hash, 41, 43)) * Math.PI * 2);
    this.phase.setX(index, unitRandom(hashCoordinates(hash, 47, 53)) * Math.PI * 2);
    this.strength.setX(index, 0.72 + unitRandom(hashCoordinates(hash, 59, 61)) * 0.5);
    this.color.copy(GRASS_DARK).lerp(GRASS_LIGHT, unitRandom(hashCoordinates(hash, 67, 71)));
    this.mesh.setColorAt(index, this.color);
  }

  private finaliseBuffers(count: number): void {
    this.mesh.count = count;
    if (count === 0) return;
    updateAttributePrefix(this.mesh.instanceMatrix, count);
    if (this.mesh.instanceColor) updateAttributePrefix(this.mesh.instanceColor, count);
    updateAttributePrefix(this.rotation, count);
    updateAttributePrefix(this.phase, count);
    updateAttributePrefix(this.strength, count);
    this.mesh.computeBoundingSphere();
  }
}
