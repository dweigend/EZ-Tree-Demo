/**
 * Fixed-capacity instanced tree renderer with ten EZ-Tree variants and three distance bands.
 * Rebuilds batch data only when terrain streaming advances; no Object3D is created per tree.
 */

import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { TERRAIN, VEGETATION } from '../config';
import type { ForestDistribution, TreePlacement } from '../vegetation/forest-distribution';
import type { TreeGeometryPair, TreeLod, TreeVariant } from './tree-factory';

interface TreeBatch {
  readonly branches: InstancedMesh;
  readonly leaves: InstancedMesh;
  readonly phase: InstancedBufferAttribute;
  readonly strength: InstancedBufferAttribute;
  count: number;
}

const LODS: readonly TreeLod[] = ['near', 'middle', 'far'];
const WHITE = new Color('#ffffff');
const LEAF_DARK = new Color('#d1deb7');
const LEAF_LIGHT = new Color('#f2edcf');
const BARK_DARK = new Color('#c8c0b4');
const BARK_LIGHT = new Color('#eee3d5');

export class TreeSystem {
  public readonly group = new Object3D();
  public visibleTreeCount = 0;
  private readonly batches: TreeBatch[][];
  private readonly transform = new Matrix4();
  private readonly rotation = new Quaternion();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly leafColor = new Color();
  private readonly barkColor = new Color();
  private prefetchCenterX = Number.NaN;
  private prefetchCenterZ = Number.NaN;
  private readonly prefetchQueue: Array<readonly [number, number]> = [];

  public constructor(private readonly variants: readonly TreeVariant[], private readonly distribution: ForestDistribution) {
    this.batches = variants.map((variant) => LODS.map((lod) => this.createBatch(variant, lod)));
  }

  public rebuild(cameraPosition: Vector3): void {
    this.resetBatches();
    const centerX = Math.floor((cameraPosition.x + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
    const centerZ = Math.floor((cameraPosition.z + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
    this.fillStreamingWindow(centerX, centerZ, cameraPosition);
    this.finaliseBatches();
  }

  public prepareStreaming(cameraPosition: Vector3): void {
    const centerX = Math.floor((cameraPosition.x + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
    const centerZ = Math.floor((cameraPosition.z + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
    if (centerX !== this.prefetchCenterX || centerZ !== this.prefetchCenterZ) {
      this.prefetchCenterX = centerX;
      this.prefetchCenterZ = centerZ;
      this.fillPrefetchQueue(centerX, centerZ);
    }
    const coordinate = this.prefetchQueue.shift();
    if (coordinate) this.distribution.getChunkPlacements(coordinate[0], coordinate[1]);
  }

  public dispose(): void {
    for (const variantBatches of this.batches) {
      for (const batch of variantBatches) {
        batch.branches.geometry.dispose();
        batch.leaves.geometry.dispose();
      }
    }
    for (const variant of this.variants) {
      variant.branchMaterial.dispose();
      variant.leafMaterial.dispose();
    }
    this.group.clear();
  }

  private fillStreamingWindow(centerX: number, centerZ: number, cameraPosition: Vector3): void {
    for (let z = -TERRAIN.chunkRadius; z <= TERRAIN.chunkRadius; z += 1) {
      for (let x = -TERRAIN.chunkRadius; x <= TERRAIN.chunkRadius; x += 1) {
        const placements = this.distribution.getChunkPlacements(centerX + x, centerZ + z);
        for (const placement of placements) this.addPlacement(placement, cameraPosition);
      }
    }
  }

  private fillPrefetchQueue(centerX: number, centerZ: number): void {
    this.prefetchQueue.length = 0;
    const radius = TERRAIN.chunkRadius + 1;
    for (let offset = -radius; offset <= radius; offset += 1) {
      this.prefetchQueue.push([centerX + offset, centerZ - radius], [centerX + offset, centerZ + radius]);
    }
    for (let offset = -radius + 1; offset < radius; offset += 1) {
      this.prefetchQueue.push([centerX - radius, centerZ + offset], [centerX + radius, centerZ + offset]);
    }
  }

  private addPlacement(placement: TreePlacement, cameraPosition: Vector3): void {
    const distance = Math.hypot(placement.x - cameraPosition.x, placement.z - cameraPosition.z);
    const lodIndex = this.getLodIndex(distance);
    if (lodIndex < 0) return;
    const variant = this.variants[placement.variant];
    const batch = this.batches[placement.variant]?.[lodIndex];
    if (!variant || !batch || batch.count >= VEGETATION.treeBatchCapacity) return;
    this.writeInstance(batch, variant, placement);
    batch.count += 1;
    this.visibleTreeCount += 1;
  }

  private writeInstance(batch: TreeBatch, variant: TreeVariant, placement: TreePlacement): void {
    const index = batch.count;
    const worldHeight = variant.height * placement.scale;
    this.position.set(placement.x, placement.y - 0.12, placement.z);
    this.rotation.setFromAxisAngle(Object3D.DEFAULT_UP, placement.rotation);
    this.scale.setScalar(worldHeight);
    this.transform.compose(this.position, this.rotation, this.scale);
    batch.branches.setMatrixAt(index, this.transform);
    batch.leaves.setMatrixAt(index, this.transform);
    batch.phase.setX(index, placement.windPhase);
    batch.strength.setX(index, placement.windStrength);
    this.writeInstanceColors(batch, index, placement.tint);
  }

  private writeInstanceColors(batch: TreeBatch, index: number, tint: number): void {
    this.leafColor.copy(LEAF_DARK).lerp(LEAF_LIGHT, 0.25 + tint * 0.52).lerp(WHITE, 0.06);
    this.barkColor.copy(BARK_DARK).lerp(BARK_LIGHT, tint * 0.48).lerp(WHITE, 0.08);
    batch.leaves.setColorAt(index, this.leafColor);
    batch.branches.setColorAt(index, this.barkColor);
  }

  private getLodIndex(distance: number): number {
    if (distance < VEGETATION.nearDistance) return 0;
    if (distance < VEGETATION.middleDistance) return 1;
    if (distance < VEGETATION.farDistance) return 2;
    return -1;
  }

  private createBatch(variant: TreeVariant, lod: TreeLod): TreeBatch {
    const geometry = variant.lods[lod];
    const branches = this.createInstancedMesh(geometry.branches, variant.branchMaterial);
    const leaves = this.createInstancedMesh(geometry.leaves, variant.leafMaterial);
    const phase = new InstancedBufferAttribute(new Float32Array(VEGETATION.treeBatchCapacity), 1);
    const strength = new InstancedBufferAttribute(new Float32Array(VEGETATION.treeBatchCapacity), 1);
    phase.setUsage(DynamicDrawUsage);
    strength.setUsage(DynamicDrawUsage);
    branches.geometry.setAttribute('aWindPhase', phase);
    branches.geometry.setAttribute('aWindStrength', strength);
    leaves.geometry.setAttribute('aWindPhase', phase);
    leaves.geometry.setAttribute('aWindStrength', strength);
    branches.castShadow = lod === 'near';
    leaves.castShadow = lod === 'near';
    this.group.add(branches, leaves);
    return { branches, leaves, phase, strength, count: 0 };
  }

  private createInstancedMesh(geometry: TreeGeometryPair['branches'], material: TreeVariant['branchMaterial']): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, VEGETATION.treeBatchCapacity);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.count = 0;
    return mesh;
  }

  private resetBatches(): void {
    this.visibleTreeCount = 0;
    for (const batches of this.batches) for (const batch of batches) batch.count = 0;
  }

  private finaliseBatches(): void {
    for (const batches of this.batches) {
      for (const batch of batches) this.finaliseBatch(batch);
    }
  }

  private finaliseBatch(batch: TreeBatch): void {
    batch.branches.count = batch.count;
    batch.leaves.count = batch.count;
    batch.branches.instanceMatrix.needsUpdate = true;
    batch.leaves.instanceMatrix.needsUpdate = true;
    batch.branches.instanceColor && (batch.branches.instanceColor.needsUpdate = true);
    batch.leaves.instanceColor && (batch.leaves.instanceColor.needsUpdate = true);
    batch.phase.needsUpdate = true;
    batch.strength.needsUpdate = true;
    if (batch.count === 0) return;
    batch.branches.computeBoundingSphere();
    batch.leaves.computeBoundingSphere();
  }
}
