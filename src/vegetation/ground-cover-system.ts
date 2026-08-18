/**
 * Renders deterministic rocks through three fixed-capacity global InstancedMeshes.
 * Batches rebuild only with the existing terrain window and never create per-instance Object3Ds.
 */

import {
  BufferGeometry,
  Color,
  Group,
  Material,
  Matrix4,
  Quaternion,
  Vector3,
  type InstancedMesh,
} from 'three';
import type { InstancedModelAsset, LandscapeAssets } from '../assets/landscape-assets';
import { TERRAIN, VEGETATION } from '../config';
import { createDynamicInstancedMesh, finaliseInstancedMesh } from '../rendering/update-instanced-attributes';
import { ChunkPrefetchQueue, getChunkIndex, getChunkViewWindow, type HorizontalDirection } from '../world/chunk-coordinates';
import type { GroundCoverDistribution, RockPlacement } from './ground-cover-distribution';
import { createRockMaterial } from './ground-cover-materials';

interface GroundCoverBatch {
  readonly mesh: InstancedMesh<BufferGeometry, Material | Material[]>;
  count: number;
}

const UP = new Vector3(0, 1, 0);
const WHITE = new Color('#ffffff');
const ROCK_DARK = new Color('#9b9488');
const ROCK_LIGHT = new Color('#c3b9a8');
const ROCK_TARGET_DIAMETER = 2;

export class GroundCoverSystem {
  public readonly group = new Group();
  public visibleRockCount = 0;
  private readonly rockBatches: GroundCoverBatch[];
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
  ) {
    this.rockBatches = assets.rocks.map((asset) => this.createRockBatch(asset));
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
    for (const batch of this.rockBatches) {
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
      placements.rocks.forEach((placement) => this.addRock(placement, cameraPosition));
    }
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

  private createRockBatch(asset: InstancedModelAsset): GroundCoverBatch {
    const materials = asset.materials.map(createRockMaterial);
    const material = materials.length === 1 ? materials[0]! : materials;
    const mesh = createDynamicInstancedMesh(
      prepareRockGeometry(asset.geometry),
      material,
      VEGETATION.rockBatchCapacity,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return { mesh, count: 0 };
  }

  private resetBatches(): void {
    this.visibleRockCount = 0;
    for (const batch of this.rockBatches) batch.count = 0;
  }

  private finaliseBatches(): void {
    for (const batch of this.rockBatches) finaliseInstancedMesh(batch.mesh, batch.count);
  }

  private horizontalDistance(placement: { readonly x: number; readonly z: number }, cameraPosition: Vector3): number {
    return Math.hypot(placement.x - cameraPosition.x, placement.z - cameraPosition.z);
  }
}

function prepareRockGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = source.clone();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) throw new Error('Rock geometry has no bounds.');
  const diameter = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
  if (diameter <= Number.EPSILON) throw new Error('Rock geometry has no horizontal extent.');
  // Normalize once at startup; the source is already low-poly, so runtime decimation cannot reopen UV seams.
  const scale = ROCK_TARGET_DIAMETER / diameter;
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
