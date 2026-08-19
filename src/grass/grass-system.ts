/**
 * Renders camera-bounded grass populations sampled from the shared zone catalog and world lattice.
 * Placement is cached between refreshes; geometry, capacity, and GPU wind remain local responsibilities.
 */

import {
  Color,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type InstancedMesh,
} from 'three';
import { VEGETATION } from '../config';
import type { InstancedModelAsset } from '../assets/landscape-assets';
import { hashCoordinates, unitRandom } from '../core/random';
import { writeLandscapeZoneWeights, type LandscapeSurfaceSample } from '../ecology/landscape-ecology';
import {
  createPopulationLattice,
  getPopulationCandidate,
  getPopulationCellRange,
  type PopulationLattice,
} from '../ecology/landscape-population';
import {
  createLandscapeZoneWeights,
  getMaximumPopulationDensityPerHectare,
  getPopulationDensityPerHectare,
  selectPopulationType,
} from '../ecology/landscape-zones';
import {
  createDynamicInstancedMesh,
  createDynamicScalarAttribute,
  finaliseInstancedMesh,
} from '../rendering/update-instanced-attributes';
import { createWindDepthMaterial } from '../rendering/wind-depth-material';
import type { HeightField } from '../core/height-field';
import type { WindUniforms } from '../wind/wind-field';
import { createGrassMaterial, prepareGrassGeometry, prepareMeadowGeometry } from './grass-material';

const GRASS_DARK = new Color('#93a47a');
const GRASS_LIGHT = new Color('#c6bb88');
const IDENTITY_ROTATION = new Quaternion();
const GRASS_CANDIDATES_PER_FRAME = 160;

interface GrassBatch {
  readonly mesh: InstancedMesh<BufferGeometry, MeshStandardMaterial | MeshStandardMaterial[]>;
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
  private readonly lattice: PopulationLattice;
  private readonly zones = createLandscapeZoneWeights();
  private readonly surface: LandscapeSurfaceSample = {
    x: 0,
    z: 0,
    heightMeters: 0,
    slopeDegrees: 0,
  };
  private buildJob: GrassBuildJob | null = null;

  public constructor(dependencies: GrassSystemDependencies) {
    this.heightField = dependencies.heightField;
    this.lattice = createPopulationLattice(getMaximumPopulationDensityPerHectare('grass'), dependencies.seed);
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
    // Reuse the previous meadow window until movement makes its distribution visibly stale.
    if (!this.buildJob && distance >= VEGETATION.grassRefreshDistance) this.startBuild(cameraPosition);
    this.processBuildJob();
  }

  public dispose(): void {
    for (const batch of [this.patchBatch, this.tuftBatch]) {
      batch.mesh.geometry.dispose();
      const materials = Array.isArray(batch.mesh.material) ? batch.mesh.material : [batch.mesh.material];
      materials.forEach((material) => material.dispose());
      batch.mesh.customDepthMaterial?.dispose();
    }
    this.group.clear();
  }

  private startBuild(cameraPosition: Vector3): void {
    const radius = VEGETATION.grassRadius;
    const range = getPopulationCellRange(this.lattice, {
      minimumX: cameraPosition.x - radius,
      maximumX: cameraPosition.x + radius,
      minimumZ: cameraPosition.z - radius,
      maximumZ: cameraPosition.z + radius,
    });
    this.buildJob = {
      target: new Vector3(cameraPosition.x, 0, cameraPosition.z),
      minX: range.minimumX,
      maxX: range.maximumX,
      currentX: range.minimumX,
      currentZ: range.minimumZ,
      maxZ: range.maximumZ,
      patchCount: 0,
      tuftCount: 0,
    };
  }

  private processBuildJob(): void {
    const job = this.buildJob;
    if (!job) return;
    // The fixed candidate budget spreads noise and height sampling over frames without changing final density.
    for (let processed = 0; processed < GRASS_CANDIDATES_PER_FRAME; processed += 1) {
      if (job.currentZ > job.maxZ || this.areBatchesFull(job)) {
        this.completeBuild(job);
        return;
      }
      this.tryAddGrassCell(job);
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

  private tryAddGrassCell(job: GrassBuildJob): void {
    const candidate = getPopulationCandidate(this.lattice, job.currentX, job.currentZ);
    if (Math.hypot(candidate.x - job.target.x, candidate.z - job.target.z) > VEGETATION.grassRadius) return;
    const heightMeters = this.heightField.getHeight(candidate.x, candidate.z);
    this.surface.x = candidate.x;
    this.surface.z = candidate.z;
    this.surface.heightMeters = heightMeters;
    this.surface.slopeDegrees = this.heightField.getSlopeDegrees(candidate.x, candidate.z);
    writeLandscapeZoneWeights(this.heightField, this.surface, this.zones);
    const density = getPopulationDensityPerHectare(this.zones, 'grass');
    if (candidate.densityRankPerHectare >= density) return;
    const kind = selectPopulationType(this.zones, 'grass', unitRandom(hashCoordinates(candidate.hash, 19, 23)));
    const placement = {
      x: candidate.x,
      y: heightMeters,
      z: candidate.z,
      hash: candidate.hash,
      strength: density / this.lattice.maximumDensityPerHectare,
    } satisfies MeadowPlacement;
    if (kind === 'meadowPatch' && job.patchCount < VEGETATION.meadowPatchCapacity) {
      this.writePatch(job.patchCount, placement);
      job.patchCount += 1;
    }
    if (kind === 'grassTuft' && job.tuftCount < VEGETATION.grassTuftCapacity) {
      this.writeTuft(job.tuftCount, placement);
      job.tuftCount += 1;
    }
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

  private writeTuft(index: number, placement: MeadowPlacement): void {
    const width = 1.5 + unitRandom(hashCoordinates(placement.hash, 103, 107)) * 1.5;
    const height = 1.15 + unitRandom(hashCoordinates(placement.hash, 109, 113)) * 1.55;
    this.writeInstance(this.tuftBatch, index, {
      x: placement.x,
      z: placement.z,
      y: placement.y - 0.03,
      hash: placement.hash,
      width,
      height,
      windStrength: 0.82,
    });
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = createWindDepthMaterial(grassMaterials[0]!);
    return { mesh, rotation, phase, strength };
  }

  private finaliseBatch(batch: GrassBatch, count: number): void {
    finaliseInstancedMesh(batch.mesh, count, batch.rotation, batch.phase, batch.strength);
  }

  private areBatchesFull(job: GrassBuildJob): boolean {
    return job.patchCount >= VEGETATION.meadowPatchCapacity && job.tuftCount >= VEGETATION.grassTuftCapacity;
  }
}
