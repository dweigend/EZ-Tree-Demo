/**
 * Renders deterministic flowers and rocks through six fixed-capacity global InstancedMeshes.
 * Batches rebuild only with the existing terrain window and never create per-instance Object3Ds.
 */

import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Material,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import type { InstancedModelAsset, LandscapeAssets } from '../assets/landscape-assets';
import { TERRAIN, VEGETATION } from '../config';
import { createDynamicScalarAttribute, finaliseInstancedMesh } from '../rendering/update-instanced-attributes';
import { ChunkPrefetchQueue, getChunkIndex, getChunkViewWindow, type HorizontalDirection } from '../world/chunk-coordinates';
import type { WindUniforms } from '../wind/wind-field';
import type { FlowerPlacement, GroundCoverDistribution, RockPlacement } from './ground-cover-distribution';
import { createFlowerMaterial, createRockMaterial } from './ground-cover-materials';

interface GroundCoverBatch {
  readonly mesh: InstancedMesh<BufferGeometry, Material | Material[]>;
  readonly phase?: InstancedBufferAttribute;
  readonly strength?: InstancedBufferAttribute;
  count: number;
}

const UP = new Vector3(0, 1, 0);
const WHITE = new Color('#ffffff');
const FLOWER_DARK = new Color('#d9dec8');
const FLOWER_LIGHT = new Color('#ffffff');
const ROCK_DARK = new Color('#9b9488');
const ROCK_LIGHT = new Color('#c3b9a8');

export class GroundCoverSystem {
  public readonly group = new Group();
  public visibleFlowerCount = 0;
  public visibleRockCount = 0;
  private readonly flowerBatches: GroundCoverBatch[];
  private readonly rockBatches: GroundCoverBatch[];
  private readonly batches: readonly GroundCoverBatch[];
  private readonly transform = new Matrix4();
  private readonly rotation = new Quaternion();
  private readonly yaw = new Quaternion();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly normal = new Vector3();
  private readonly color = new Color();
  private readonly prefetchQueue = new ChunkPrefetchQueue(TERRAIN.chunkRadius + 1);

  public constructor(
    assets: LandscapeAssets,
    private readonly distribution: GroundCoverDistribution,
    wind: WindUniforms,
  ) {
    this.flowerBatches = assets.flowers.map((asset) => this.createFlowerBatch(asset, wind));
    this.rockBatches = assets.rocks.map((asset) => this.createRockBatch(asset));
    this.batches = [...this.flowerBatches, ...this.rockBatches];
  }

  public rebuild(cameraPosition: Vector3, viewDirection: HorizontalDirection): void {
    this.resetBatches();
    this.fillStreamingWindow(cameraPosition, viewDirection);
    this.finaliseBatches();
  }

  public prefetchNextChunk(cameraPosition: Vector3, viewDirection: HorizontalDirection): void {
    const coordinate = this.prefetchQueue.next(cameraPosition, viewDirection);
    if (coordinate) this.distribution.getChunkPlacements(coordinate.x, coordinate.z);
  }

  public dispose(): void {
    for (const batch of this.batches) {
      batch.mesh.geometry.dispose();
      const materials = Array.isArray(batch.mesh.material) ? batch.mesh.material : [batch.mesh.material];
      materials.forEach((material) => material.dispose());
    }
    this.group.clear();
  }

  private fillStreamingWindow(cameraPosition: Vector3, viewDirection: HorizontalDirection): void {
    const centerX = getChunkIndex(cameraPosition.x);
    const centerZ = getChunkIndex(cameraPosition.z);
    for (const coordinate of getChunkViewWindow(centerX, centerZ, TERRAIN.chunkRadius, viewDirection)) {
      const placements = this.distribution.getChunkPlacements(coordinate.x, coordinate.z);
      placements.flowers.forEach((placement) => this.addFlower(placement, cameraPosition));
      placements.rocks.forEach((placement) => this.addRock(placement, cameraPosition));
    }
  }

  private addFlower(placement: FlowerPlacement, cameraPosition: Vector3): void {
    if (this.horizontalDistance(placement, cameraPosition) > VEGETATION.flowerDistance) return;
    const batch = this.flowerBatches[placement.variant];
    if (!batch || batch.count >= VEGETATION.flowerBatchCapacity) return;
    const index = batch.count;
    this.position.set(placement.x, placement.y - 0.02, placement.z);
    this.rotation.setFromAxisAngle(UP, placement.rotation);
    this.scale.setScalar(placement.scale);
    this.transform.compose(this.position, this.rotation, this.scale);
    batch.mesh.setMatrixAt(index, this.transform);
    batch.phase?.setX(index, placement.windPhase);
    batch.strength?.setX(index, placement.windStrength);
    this.color.copy(FLOWER_DARK).lerp(FLOWER_LIGHT, 0.45 + placement.tint * 0.55);
    batch.mesh.setColorAt(index, this.color);
    batch.count += 1;
    this.visibleFlowerCount += 1;
  }

  private addRock(placement: RockPlacement, cameraPosition: Vector3): void {
    if (this.horizontalDistance(placement, cameraPosition) > VEGETATION.rockDistance) return;
    const batch = this.rockBatches[placement.variant];
    if (!batch || batch.count >= VEGETATION.rockBatchCapacity) return;
    const index = batch.count;
    this.normal.fromArray(placement.normal);
    this.rotation.setFromUnitVectors(UP, this.normal);
    this.yaw.setFromAxisAngle(this.normal, placement.rotation);
    this.rotation.premultiply(this.yaw);
    this.position.set(placement.x, placement.y, placement.z);
    this.scale.set(placement.scale * 1.08, placement.scale * 0.82, placement.scale);
    this.transform.compose(this.position, this.rotation, this.scale);
    batch.mesh.setMatrixAt(index, this.transform);
    this.color
      .copy(ROCK_DARK)
      .lerp(ROCK_LIGHT, placement.tint * 0.55)
      .lerp(WHITE, 0.04);
    batch.mesh.setColorAt(index, this.color);
    batch.count += 1;
    this.visibleRockCount += 1;
  }

  private createFlowerBatch(asset: InstancedModelAsset, wind: WindUniforms): GroundCoverBatch {
    const geometry = asset.geometry.clone();
    const phase = createDynamicScalarAttribute(VEGETATION.flowerBatchCapacity);
    const strength = createDynamicScalarAttribute(VEGETATION.flowerBatchCapacity);
    geometry.setAttribute('aWindPhase', phase);
    geometry.setAttribute('aWindStrength', strength);
    const materials = asset.materials.map((material) => createFlowerMaterial(material, wind));
    const mesh = this.createMesh(geometry, materials, VEGETATION.flowerBatchCapacity);
    this.group.add(mesh);
    return { mesh, phase, strength, count: 0 };
  }

  private createRockBatch(asset: InstancedModelAsset): GroundCoverBatch {
    const materials = asset.materials.map(createRockMaterial);
    const mesh = this.createMesh(asset.geometry.clone(), materials, VEGETATION.rockBatchCapacity);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return { mesh, count: 0 };
  }

  private createMesh(
    geometry: BufferGeometry,
    materials: Material[],
    capacity: number,
  ): InstancedMesh<BufferGeometry, Material | Material[]> {
    const material = materials.length === 1 ? materials[0]! : materials;
    const mesh = new InstancedMesh<BufferGeometry, Material | Material[]>(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.count = 0;
    return mesh;
  }

  private resetBatches(): void {
    this.visibleFlowerCount = 0;
    this.visibleRockCount = 0;
    for (const batch of this.batches) batch.count = 0;
  }

  private finaliseBatches(): void {
    for (const batch of this.batches) finaliseInstancedMesh(batch.mesh, batch.count, batch.phase, batch.strength);
  }

  private horizontalDistance(placement: { readonly x: number; readonly z: number }, cameraPosition: Vector3): number {
    return Math.hypot(placement.x - cameraPosition.x, placement.z - cameraPosition.z);
  }
}
