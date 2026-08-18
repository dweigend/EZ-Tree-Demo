/**
 * Camera-bounded instanced grass field with GPU blade bending.
 * Stable world-grid sampling prevents swimming while distance thinning keeps one draw call bounded.
 */

import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshPhongMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { InstancedModelAsset } from '../assets/landscape-assets';
import { VEGETATION } from '../config';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import { createEcologySample, type EcologyField, type EcologySample } from '../ecology/ecology-field';
import { updateAttributePrefix } from '../rendering/update-instanced-attributes';
import type { HeightField } from '../terrain/height-field';
import type { WindUniforms } from '../wind/wind-field';
import { createGrassMaterial, prepareGrassGeometry } from './grass-material';

const GRASS_EDGE = new Color('#aeb886');
const GRASS_CORE = new Color('#c9cf8f');
const GRASS_HIGHLIGHT = new Color('#e0d49a');
const IDENTITY_ROTATION = new Quaternion();
const GRASS_CANDIDATES_PER_FRAME = 800;
const MEADOW_DENSITY_END = 0.08;
const MEADOW_DENSITY_MAX = 0.92;

interface GrassBuildJob {
  readonly target: Vector3;
  readonly minX: number;
  readonly maxX: number;
  readonly maxZ: number;
  currentX: number;
  currentZ: number;
  count: number;
}

interface GrassSystemDependencies {
  readonly heightField: HeightField;
  readonly ecologyField: EcologyField;
  readonly seed: number;
  readonly wind: WindUniforms;
  readonly asset: InstancedModelAsset;
}

interface GrassPlacement {
  x: number;
  z: number;
  height: number;
  meadowStrength: number;
  hash: number;
}

interface MutableTerrainSite {
  x: number;
  z: number;
  height: number;
  slope: number;
  moisture: number;
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
  private readonly ecologySample: EcologySample = createEcologySample();
  private readonly terrainSite: MutableTerrainSite = {
    x: 0,
    z: 0,
    height: 0,
    slope: 0,
    moisture: 0,
  };
  private readonly placement: GrassPlacement = { x: 0, z: 0, height: 0, meadowStrength: 0, hash: 0 };
  private readonly heightField: HeightField;
  private readonly ecologyField: EcologyField;
  private readonly seed: number;
  private buildJob: GrassBuildJob | null = null;

  public constructor(dependencies: GrassSystemDependencies) {
    const { heightField, ecologyField, seed, wind, asset } = dependencies;
    this.heightField = heightField;
    this.ecologyField = ecologyField;
    this.seed = seed;
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
    const material = createGrassMaterial(sourceMaterial, wind);
    this.mesh = new InstancedMesh(geometry, material, VEGETATION.grassCapacity);
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
      if (this.tryAddBlade(job)) job.count += 1;
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

  private tryAddBlade(job: GrassBuildJob): boolean {
    const placement = this.createPlacement(job.currentX, job.currentZ);
    if (!this.acceptsPlacement(placement, job.target)) return false;
    this.writeBlade(job.count, placement);
    return true;
  }

  private createPlacement(cellX: number, cellZ: number): GrassPlacement {
    const hash = hashCoordinates(this.seed, cellX, cellZ);
    const jitterX = signedRandom(hashCoordinates(hash, 3, 7)) * 0.42;
    const jitterZ = signedRandom(hashCoordinates(hash, 11, 13)) * 0.42;
    this.placement.x = (cellX + jitterX) * VEGETATION.grassSpacing;
    this.placement.z = (cellZ + jitterZ) * VEGETATION.grassSpacing;
    this.placement.hash = hash;
    return this.placement;
  }

  private acceptsPlacement(placement: GrassPlacement, cameraPosition: Vector3): boolean {
    const { x, z, hash } = placement;
    const distance = Math.hypot(x - cameraPosition.x, z - cameraPosition.z);
    if (distance > VEGETATION.grassRadius) return false;
    const height = this.heightField.getHeight(x, z);
    const slope = this.heightField.getSlope(x, z);
    if (height > 205 || height < -38 || slope > 0.82) return false;
    this.writeTerrainSite(placement, height, slope);
    const meadow = this.ecologyField.sample(this.terrainSite, this.ecologySample).meadow;
    placement.height = height;
    placement.meadowStrength = getMeadowStrength(meadow);
    const baseDensity = placement.meadowStrength * MEADOW_DENSITY_MAX;
    const density = Math.min(0.98, baseDensity * VEGETATION.grassDensity);
    return unitRandom(hashCoordinates(hash, 17, 19)) < density * getDistanceKeep(distance);
  }

  private writeTerrainSite(placement: GrassPlacement, height: number, slope: number): void {
    this.terrainSite.x = placement.x;
    this.terrainSite.z = placement.z;
    this.terrainSite.height = height;
    this.terrainSite.slope = slope;
    this.terrainSite.moisture = this.heightField.getMoisture(placement.x, placement.z, height);
  }

  private writeBlade(index: number, placement: GrassPlacement): void {
    const { x, z, height: groundHeight, meadowStrength, hash } = placement;
    const heightVariation = unitRandom(hashCoordinates(hash, 23, 29)) * 0.38;
    const widthVariation = unitRandom(hashCoordinates(hash, 31, 37)) * 0.2;
    const height = 0.72 + meadowStrength * 0.22 + heightVariation;
    const width = 0.36 + meadowStrength * 0.08 + widthVariation;
    this.position.set(x, groundHeight - 0.03, z);
    this.scale.set(width, height, width);
    this.transform.compose(this.position, IDENTITY_ROTATION, this.scale);
    this.mesh.setMatrixAt(index, this.transform);
    this.rotation.setX(index, unitRandom(hashCoordinates(hash, 41, 43)) * Math.PI * 2);
    this.phase.setX(index, unitRandom(hashCoordinates(hash, 47, 53)) * Math.PI * 2);
    this.strength.setX(index, 0.72 + unitRandom(hashCoordinates(hash, 59, 61)) * 0.5);
    this.color.copy(GRASS_EDGE).lerp(GRASS_CORE, meadowStrength);
    this.color.lerp(GRASS_HIGHLIGHT, unitRandom(hashCoordinates(hash, 67, 71)) * 0.24);
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

function getMeadowStrength(meadow: number): number {
  return MathUtils.smoothstep(meadow, 0, MEADOW_DENSITY_END);
}

function getDistanceKeep(distance: number): number {
  const ratio = distance / VEGETATION.grassRadius;
  if (ratio < 0.62) return 1;
  return Math.max(0.08, 1 - (ratio - 0.62) / 0.38);
}
