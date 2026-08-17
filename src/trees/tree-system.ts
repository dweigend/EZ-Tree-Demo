/**
 * Fixed-capacity instanced tree renderer with preset-based EZ-Tree variants and three distance bands.
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
import {
  getChunkRing,
  getChunkViewWindow,
  prioritiseChunkDirection,
  type ChunkCoordinate,
  type HorizontalDirection,
} from '../world/chunk-coordinates';
import type { ForestDistribution, TreePlacement } from '../vegetation/forest-distribution';
import type { TreeGeometryPair, TreeLod, TreeVariant } from './tree-factory';
import type { TreeSpecies } from './tree-templates';

interface TreeBatch {
  readonly branches: InstancedMesh;
  readonly leaves: InstancedMesh;
  readonly phase: InstancedBufferAttribute;
  readonly strength: InstancedBufferAttribute;
  readonly fade: InstancedBufferAttribute;
  count: number;
}

interface LodBlend {
  readonly index: number;
  readonly opacity: number;
}

const LODS: readonly TreeLod[] = ['near', 'middle', 'far'];
const LEAF_COLORS: Readonly<Record<TreeSpecies, readonly [Color, Color]>> = {
  ash: [new Color('#c4d3ae'), new Color('#f1e8bd')],
  aspen: [new Color('#c9dcaa'), new Color('#eff0b4')],
  oak: [new Color('#bed09b'), new Color('#e1d39d')],
  pine: [new Color('#b2c8a6'), new Color('#d8d6a2')],
};
const BARK_DARK = new Color('#d2c7b9');
const BARK_LIGHT = new Color('#f6e8d2');
const NEAR_BLEND_WIDTH = 18;
const MIDDLE_BLEND_WIDTH = 36;

export class TreeSystem {
  public readonly group = new Object3D();
  public visibleTreeCount = 0;
  public activeChunkCount = 0;
  private readonly batches: TreeBatch[][];
  private readonly transform = new Matrix4();
  private readonly rotation = new Quaternion();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly leafColor = new Color();
  private readonly barkColor = new Color();
  private prefetchCenterX = Number.NaN;
  private prefetchCenterZ = Number.NaN;
  private readonly prefetchQueue: ChunkCoordinate[] = [];

  public constructor(private readonly variants: readonly TreeVariant[], private readonly distribution: ForestDistribution) {
    this.batches = variants.map((variant) => LODS.map((lod) => this.createBatch(variant, lod)));
  }

  public rebuild(cameraPosition: Vector3, viewDirection: HorizontalDirection): void {
    this.resetBatches();
    this.fillStreamingWindow(cameraPosition, viewDirection);
    this.finaliseBatches();
  }

  public prepareStreaming(cameraPosition: Vector3, viewDirection: HorizontalDirection): void {
    const centerX = Math.floor((cameraPosition.x + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
    const centerZ = Math.floor((cameraPosition.z + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
    if (centerX !== this.prefetchCenterX || centerZ !== this.prefetchCenterZ) {
      this.prefetchCenterX = centerX;
      this.prefetchCenterZ = centerZ;
      this.fillPrefetchQueue(centerX, centerZ, viewDirection);
    }
    const coordinate = this.prefetchQueue.shift();
    if (coordinate) this.distribution.getChunkPlacements(coordinate.x, coordinate.z);
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

  private fillStreamingWindow(cameraPosition: Vector3, viewDirection: HorizontalDirection): void {
    const centerX = Math.floor((cameraPosition.x + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
    const centerZ = Math.floor((cameraPosition.z + TERRAIN.chunkSize / 2) / TERRAIN.chunkSize);
    const coordinates = getChunkViewWindow(centerX, centerZ, TERRAIN.chunkRadius, viewDirection);
    this.activeChunkCount = coordinates.length;
    for (const coordinate of coordinates) {
      const placements = this.distribution.getChunkPlacements(coordinate.x, coordinate.z);
      for (const placement of placements) this.addPlacement(placement, cameraPosition);
    }
  }

  private fillPrefetchQueue(centerX: number, centerZ: number, viewDirection: HorizontalDirection): void {
    this.prefetchQueue.length = 0;
    const ring = getChunkRing(centerX, centerZ, TERRAIN.chunkRadius + 1);
    this.prefetchQueue.push(...prioritiseChunkDirection(ring, centerX, centerZ, viewDirection));
  }

  private addPlacement(placement: TreePlacement, cameraPosition: Vector3): void {
    const distance = Math.hypot(placement.x - cameraPosition.x, placement.z - cameraPosition.z);
    const variant = this.variants[placement.variant];
    const blends = this.getLodBlends(distance);
    if (!variant || blends.length === 0) return;
    for (const blend of blends) this.addLodInstance(variant, placement, blend);
    this.visibleTreeCount += 1;
  }

  private addLodInstance(variant: TreeVariant, placement: TreePlacement, blend: LodBlend): void {
    const batch = this.batches[placement.variant]?.[blend.index];
    if (!batch || batch.count >= VEGETATION.treeBatchCapacity) return;
    this.writeInstance(batch, variant, placement, blend.opacity);
    batch.count += 1;
  }

  private writeInstance(batch: TreeBatch, variant: TreeVariant, placement: TreePlacement, opacity: number): void {
    const index = batch.count;
    const worldHeight = variant.height * placement.scale;
    this.position.set(placement.x, placement.y - 0.12, placement.z);
    this.rotation.setFromAxisAngle(Object3D.DEFAULT_UP, placement.rotation);
    this.scale.set(worldHeight * placement.widthScale, worldHeight, worldHeight * placement.depthScale);
    this.transform.compose(this.position, this.rotation, this.scale);
    batch.branches.setMatrixAt(index, this.transform);
    batch.leaves.setMatrixAt(index, this.transform);
    batch.phase.setX(index, placement.windPhase);
    batch.strength.setX(index, placement.windStrength);
    batch.fade.setX(index, opacity);
    this.writeInstanceColors(batch, index, variant.species, placement.tint);
  }

  private writeInstanceColors(batch: TreeBatch, index: number, species: TreeSpecies, tint: number): void {
    const [leafDark, leafLight] = LEAF_COLORS[species];
    this.leafColor.copy(leafDark).lerp(leafLight, 0.18 + tint * 0.64);
    this.barkColor.copy(BARK_DARK).lerp(BARK_LIGHT, 0.22 + tint * 0.5);
    batch.leaves.setColorAt(index, this.leafColor);
    batch.branches.setColorAt(index, this.barkColor);
  }

  private getLodBlends(distance: number): LodBlend[] {
    if (distance >= VEGETATION.farDistance) return [];
    const nearBlend = blendAt(distance, VEGETATION.nearDistance, NEAR_BLEND_WIDTH);
    if (nearBlend) return [{ index: 0, opacity: 1 - nearBlend }, { index: 1, opacity: nearBlend }];
    if (distance < VEGETATION.nearDistance) return [{ index: 0, opacity: 1 }];
    const middleBlend = blendAt(distance, VEGETATION.middleDistance, MIDDLE_BLEND_WIDTH);
    if (middleBlend) return [{ index: 1, opacity: 1 - middleBlend }, { index: 2, opacity: middleBlend }];
    return [{ index: distance < VEGETATION.middleDistance ? 1 : 2, opacity: 1 }];
  }

  private createBatch(variant: TreeVariant, lod: TreeLod): TreeBatch {
    const geometry = variant.lods[lod];
    const branches = this.createInstancedMesh(geometry.branches, variant.branchMaterial);
    const leaves = this.createInstancedMesh(geometry.leaves, variant.leafMaterial);
    const phase = new InstancedBufferAttribute(new Float32Array(VEGETATION.treeBatchCapacity), 1);
    const strength = new InstancedBufferAttribute(new Float32Array(VEGETATION.treeBatchCapacity), 1);
    const fade = new InstancedBufferAttribute(new Float32Array(VEGETATION.treeBatchCapacity), 1);
    phase.setUsage(DynamicDrawUsage);
    strength.setUsage(DynamicDrawUsage);
    fade.setUsage(DynamicDrawUsage);
    branches.geometry.setAttribute('aWindPhase', phase);
    branches.geometry.setAttribute('aWindStrength', strength);
    leaves.geometry.setAttribute('aWindPhase', phase);
    leaves.geometry.setAttribute('aWindStrength', strength);
    branches.geometry.setAttribute('aLodFade', fade);
    leaves.geometry.setAttribute('aLodFade', fade);
    branches.castShadow = lod === 'near';
    leaves.castShadow = lod === 'near';
    this.group.add(branches, leaves);
    return { branches, leaves, phase, strength, fade, count: 0 };
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
    batch.fade.needsUpdate = true;
    if (batch.count === 0) return;
    batch.branches.computeBoundingSphere();
    batch.leaves.computeBoundingSphere();
  }
}

function blendAt(distance: number, threshold: number, width: number): number | null {
  const start = threshold - width;
  const end = threshold + width;
  if (distance <= start || distance >= end) return null;
  return (distance - start) / (end - start);
}
