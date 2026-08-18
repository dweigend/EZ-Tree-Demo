/**
 * Camera-bounded meadow patches and grass tufts with shared GPU wind.
 * A deterministic habitat mask forms small organic meadows instead of uniform ground coverage.
 */

import {
  Color,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  MathUtils,
  Matrix4,
  MeshPhongMaterial,
  type MeshStandardMaterial,
  Quaternion,
  Vector3,
  type InstancedMesh,
} from 'three';
import { VEGETATION } from '../config';
import type { InstancedModelAsset } from '../assets/landscape-assets';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import { getGroundCover, getWoodland } from '../ecology/landscape-ecology';
import {
  createDynamicInstancedMesh,
  createDynamicScalarAttribute,
  finaliseInstancedMesh,
} from '../rendering/update-instanced-attributes';
import type { HeightField } from '../core/height-field';
import type { WindUniforms } from '../wind/wind-field';
import { createGrassMaterial, prepareGrassGeometry, prepareMeadowGeometry } from './grass-material';

const GRASS_DARK = new Color('#93a47a');
const GRASS_LIGHT = new Color('#c6bb88');
const IDENTITY_ROTATION = new Quaternion();
const GRASS_CANDIDATES_PER_FRAME = 160;

interface GrassBatch {
  readonly mesh: InstancedMesh<BufferGeometry, MeshPhongMaterial | MeshPhongMaterial[]>;
  readonly rotation: InstancedBufferAttribute;
  readonly phase: InstancedBufferAttribute;
  readonly strength: InstancedBufferAttribute;
}

interface GrassBatchSource {
  readonly geometry: BufferGeometry;
  readonly materials: readonly MeshStandardMaterial[];
  readonly capacity: number;
}

interface GrassInstance {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  readonly windStrength: number;
  readonly hash: number;
}

interface MeadowCandidate {
  readonly x: number;
  readonly z: number;
  readonly cameraPosition: Vector3;
  readonly hash: number;
}

interface MeadowPlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly hash: number;
  readonly strength: number;
}

export interface GrassSystemDependencies {
  readonly heightField: HeightField;
  readonly seed: number;
  readonly wind: WindUniforms;
  readonly meadowPatch: InstancedModelAsset;
  readonly grassTuft: InstancedModelAsset;
}

interface GrassBuildJob {
  readonly target: Vector3;
  readonly minX: number;
  readonly maxX: number;
  readonly maxZ: number;
  currentX: number;
  currentZ: number;
  patchCount: number;
  tuftCount: number;
}

export class GrassSystem {
  public readonly group = new Group();
  public get visiblePatchCount(): number {
    return this.patchBatch.mesh.count;
  }
  public get visibleTuftCount(): number {
    return this.tuftBatch.mesh.count;
  }
  private readonly patchBatch: GrassBatch;
  private readonly tuftBatch: GrassBatch;
  private readonly lastAnchor = new Vector3(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
  private readonly transform = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly color = new Color();
  private readonly heightField: HeightField;
  private readonly seed: number;
  private buildJob: GrassBuildJob | null = null;

  public constructor(dependencies: GrassSystemDependencies) {
    this.heightField = dependencies.heightField;
    this.seed = dependencies.seed;
    this.patchBatch = this.createBatch(
      {
        geometry: prepareMeadowGeometry(dependencies.meadowPatch.geometry),
        materials: dependencies.meadowPatch.materials.slice(0, 1),
        capacity: VEGETATION.meadowPatchCapacity,
      },
      dependencies.wind,
    );
    this.tuftBatch = this.createBatch(
      {
        geometry: prepareGrassGeometry(dependencies.grassTuft.geometry),
        materials: dependencies.grassTuft.materials.slice(0, 1),
        capacity: VEGETATION.grassTuftCapacity,
      },
      dependencies.wind,
    );
    this.group.add(this.patchBatch.mesh, this.tuftBatch.mesh);
  }

  public update(cameraPosition: Vector3): void {
    const distance = Math.hypot(cameraPosition.x - this.lastAnchor.x, cameraPosition.z - this.lastAnchor.z);
    if (!this.buildJob && distance >= VEGETATION.grassRefreshDistance) this.startBuild(cameraPosition);
    this.processBuildJob();
  }

  public dispose(): void {
    for (const batch of [this.patchBatch, this.tuftBatch]) {
      batch.mesh.geometry.dispose();
      const materials = Array.isArray(batch.mesh.material) ? batch.mesh.material : [batch.mesh.material];
      materials.forEach((material) => material.dispose());
    }
    this.group.clear();
  }

  private startBuild(cameraPosition: Vector3): void {
    const radiusInCells = Math.ceil(VEGETATION.grassRadius / VEGETATION.meadowSpacing);
    const centerX = Math.round(cameraPosition.x / VEGETATION.meadowSpacing);
    const centerZ = Math.round(cameraPosition.z / VEGETATION.meadowSpacing);
    this.buildJob = {
      target: new Vector3(cameraPosition.x, 0, cameraPosition.z),
      minX: centerX - radiusInCells,
      maxX: centerX + radiusInCells,
      currentX: centerX - radiusInCells,
      currentZ: centerZ - radiusInCells,
      maxZ: centerZ + radiusInCells,
      patchCount: 0,
      tuftCount: 0,
    };
  }

  private processBuildJob(): void {
    const job = this.buildJob;
    if (!job) return;
    for (let processed = 0; processed < GRASS_CANDIDATES_PER_FRAME; processed += 1) {
      if (job.currentZ > job.maxZ || this.areBatchesFull(job)) {
        this.completeBuild(job);
        return;
      }
      this.tryAddMeadowCell(job);
      job.currentX += 1;
      if (job.currentX <= job.maxX) continue;
      job.currentX = job.minX;
      job.currentZ += 1;
    }
  }

  private completeBuild(job: GrassBuildJob): void {
    this.lastAnchor.copy(job.target);
    this.buildJob = null;
    this.finaliseBatch(this.patchBatch, job.patchCount);
    this.finaliseBatch(this.tuftBatch, job.tuftCount);
  }

  private tryAddMeadowCell(job: GrassBuildJob): void {
    const hash = hashCoordinates(this.seed, job.currentX, job.currentZ);
    const x = this.getJitteredCoordinate(job.currentX, hash, [3, 7]);
    const z = this.getJitteredCoordinate(job.currentZ, hash, [11, 13]);
    const strength = this.getAcceptedMeadowStrength({ x, z, cameraPosition: job.target, hash });
    if (strength === null) return;
    const height = this.heightField.getHeight(x, z);
    if (job.patchCount < VEGETATION.meadowPatchCapacity) {
      this.writePatch(job.patchCount, { x, z, y: height, hash, strength });
      job.patchCount += 1;
    }
    if (job.tuftCount >= VEGETATION.grassTuftCapacity) return;
    if (unitRandom(hashCoordinates(hash, 73, 79)) > 0.38 + strength * 0.48) return;
    if (this.writeNearbyTuft(job.tuftCount, { x, z, y: height, hash, strength })) job.tuftCount += 1;
  }

  private getAcceptedMeadowStrength(candidate: MeadowCandidate): number | null {
    const { x, z, cameraPosition, hash } = candidate;
    const distance = Math.hypot(x - cameraPosition.x, z - cameraPosition.z);
    if (distance > VEGETATION.grassRadius) return null;
    const height = this.heightField.getHeight(x, z);
    const slope = this.heightField.getSlope(x, z);
    if (height > 185 || height < -34 || slope > 0.68) return null;
    const distanceRatio = distance / VEGETATION.grassRadius;
    const distanceKeep = distanceRatio < 0.72 ? 1 : Math.max(0.12, 1 - (distanceRatio - 0.72) / 0.28);
    const cover = getGroundCover(this.heightField, x, z, height);
    const island = this.heightField.getNoise01((x - 130) * 0.009, (z + 270) * 0.009, 2);
    const edge = this.heightField.getNoise01((x + 310) * 0.021, (z - 190) * 0.021, 1);
    const woodland = getWoodland(this.heightField, x, z);
    const openGround = 1 - MathUtils.smoothstep(woodland, 0.64, 0.88);
    const flatness = 1 - MathUtils.smoothstep(slope, 0.22, 0.68);
    const organicMask = cover * 0.42 + island * 0.43 + edge * 0.15;
    const strength = MathUtils.smoothstep(organicMask, 0.5, 0.72) * flatness * (0.62 + openGround * 0.38);
    return unitRandom(hashCoordinates(hash, 17, 19)) < strength * distanceKeep ? strength : null;
  }

  private writePatch(index: number, placement: MeadowPlacement): void {
    const width = 1.28 + unitRandom(hashCoordinates(placement.hash, 23, 29)) * 0.38;
    const height = 0.72 + unitRandom(hashCoordinates(placement.hash, 31, 37)) * 0.42 + placement.strength * 0.14;
    this.writeInstance(this.patchBatch, index, {
      ...placement,
      y: placement.y - 0.05,
      width,
      height,
      windStrength: 0.68,
    });
  }

  private writeNearbyTuft(index: number, placement: MeadowPlacement): boolean {
    const angle = unitRandom(hashCoordinates(placement.hash, 83, 89)) * Math.PI * 2;
    const distance = 2.8 + unitRandom(hashCoordinates(placement.hash, 97, 101)) * 4.8;
    const tuftX = placement.x + Math.cos(angle) * distance;
    const tuftZ = placement.z + Math.sin(angle) * distance;
    if (this.heightField.getSlope(tuftX, tuftZ) > 0.72) return false;
    const tuftHeight = this.heightField.getHeight(tuftX, tuftZ);
    const width = 1.5 + unitRandom(hashCoordinates(placement.hash, 103, 107)) * 1.5;
    const height = 1.15 + unitRandom(hashCoordinates(placement.hash, 109, 113)) * 1.55;
    this.writeInstance(this.tuftBatch, index, {
      x: tuftX,
      z: tuftZ,
      y: tuftHeight - 0.03,
      hash: placement.hash,
      width,
      height,
      windStrength: 0.82,
    });
    return true;
  }

  private writeInstance(batch: GrassBatch, index: number, instance: GrassInstance): void {
    this.position.set(instance.x, instance.y, instance.z);
    this.scale.set(instance.width, instance.height, instance.width);
    this.transform.compose(this.position, IDENTITY_ROTATION, this.scale);
    batch.mesh.setMatrixAt(index, this.transform);
    batch.rotation.setX(index, unitRandom(hashCoordinates(instance.hash, 41, 43)) * Math.PI * 2);
    batch.phase.setX(index, unitRandom(hashCoordinates(instance.hash, 47, 53)) * Math.PI * 2);
    batch.strength.setX(index, instance.windStrength + unitRandom(hashCoordinates(instance.hash, 59, 61)) * 0.38);
    this.color.copy(GRASS_DARK).lerp(GRASS_LIGHT, unitRandom(hashCoordinates(instance.hash, 67, 71)));
    batch.mesh.setColorAt(index, this.color);
  }

  private createBatch(source: GrassBatchSource, wind: WindUniforms): GrassBatch {
    const rotation = createDynamicScalarAttribute(source.capacity);
    const phase = createDynamicScalarAttribute(source.capacity);
    const strength = createDynamicScalarAttribute(source.capacity);
    source.geometry.setAttribute('aRotation', rotation);
    source.geometry.setAttribute('aWindPhase', phase);
    source.geometry.setAttribute('aWindStrength', strength);
    if (source.materials.length === 0) throw new Error('Grass asset has no material.');
    const grassMaterials = source.materials.map((material) => createGrassMaterial(material, wind));
    const material = grassMaterials.length === 1 ? grassMaterials[0]! : grassMaterials;
    const mesh = createDynamicInstancedMesh(
      source.geometry,
      material,
      source.capacity,
    );
    mesh.receiveShadow = true;
    return { mesh, rotation, phase, strength };
  }

  private finaliseBatch(batch: GrassBatch, count: number): void {
    finaliseInstancedMesh(batch.mesh, count, batch.rotation, batch.phase, batch.strength);
  }

  private getJitteredCoordinate(cell: number, hash: number, salts: readonly [number, number]): number {
    const jitter = signedRandom(hashCoordinates(hash, salts[0], salts[1])) * VEGETATION.grassJitterRatio;
    return (cell + jitter) * VEGETATION.meadowSpacing;
  }

  private areBatchesFull(job: GrassBuildJob): boolean {
    return job.patchCount >= VEGETATION.meadowPatchCapacity && job.tuftCount >= VEGETATION.grassTuftCapacity;
  }
}
