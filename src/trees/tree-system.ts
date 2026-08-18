/**
 * Fixed-capacity instanced tree renderer with preset-based EZ-Tree variants and three distance bands.
 * Rebuilds batch data only when terrain streaming advances; no Object3D is created per tree.
 */

import { Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { TERRAIN, VEGETATION } from '../config';
import { createDynamicScalarAttribute, finaliseInstancedMesh } from '../rendering/update-instanced-attributes';
import { ChunkPrefetchQueue, getChunkIndex, getChunkViewWindow, type HorizontalDirection } from '../world/chunk-coordinates';
import type { ForestDistribution, TreePlacement } from './forest-distribution';
import type { TreeGeometryPair, TreeLod, TreeVariant } from './tree-factory';
import type { TreeSpecies } from './tree-templates';

interface TreeBatch {
  readonly branches: InstancedMesh;
  readonly leaves: InstancedMesh;
  readonly phase: InstancedBufferAttribute;
  readonly strength: InstancedBufferAttribute;
  count: number;
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
  private readonly prefetchQueue = new ChunkPrefetchQueue(TERRAIN.chunkRadius + 1);

  public constructor(
    private readonly variants: readonly TreeVariant[],
    private readonly distribution: ForestDistribution,
  ) {
    this.batches = variants.map((variant) => LODS.map((lod) => this.createBatch(variant, lod)));
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
    const centerX = getChunkIndex(cameraPosition.x);
    const centerZ = getChunkIndex(cameraPosition.z);
    const coordinates = getChunkViewWindow(centerX, centerZ, TERRAIN.chunkRadius, viewDirection);
    this.activeChunkCount = coordinates.length;
    for (const coordinate of coordinates) {
      const placements = this.distribution.getChunkPlacements(coordinate.x, coordinate.z);
      for (const placement of placements) this.addPlacement(placement, cameraPosition);
    }
  }

  private addPlacement(placement: TreePlacement, cameraPosition: Vector3): void {
    const distance = Math.hypot(placement.x - cameraPosition.x, placement.z - cameraPosition.z);
    const variant = this.variants[placement.variant];
    const lodIndex = this.getLodIndex(distance);
    const batch = lodIndex === null ? undefined : this.batches[placement.variant]?.[lodIndex];
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
    this.scale.set(worldHeight * placement.widthScale, worldHeight, worldHeight * placement.depthScale);
    this.transform.compose(this.position, this.rotation, this.scale);
    batch.branches.setMatrixAt(index, this.transform);
    batch.leaves.setMatrixAt(index, this.transform);
    batch.phase.setX(index, placement.windPhase);
    batch.strength.setX(index, placement.windStrength);
    this.writeInstanceColors(batch, index, variant.species, placement.tint);
  }

  private writeInstanceColors(batch: TreeBatch, index: number, species: TreeSpecies, tint: number): void {
    const [leafDark, leafLight] = LEAF_COLORS[species];
    this.leafColor.copy(leafDark).lerp(leafLight, 0.18 + tint * 0.64);
    this.barkColor.copy(BARK_DARK).lerp(BARK_LIGHT, 0.22 + tint * 0.5);
    batch.leaves.setColorAt(index, this.leafColor);
    batch.branches.setColorAt(index, this.barkColor);
  }

  private getLodIndex(distance: number): number | null {
    if (distance < VEGETATION.nearDistance) return 0;
    if (distance < VEGETATION.middleDistance) return 1;
    return distance < VEGETATION.farDistance ? 2 : null;
  }

  private createBatch(variant: TreeVariant, lod: TreeLod): TreeBatch {
    const geometry = variant.lods[lod];
    const branches = this.createInstancedMesh(geometry.branches, variant.branchMaterial);
    const leaves = this.createInstancedMesh(geometry.leaves, variant.leafMaterial);
    const phase = createDynamicScalarAttribute(VEGETATION.treeBatchCapacity);
    const strength = createDynamicScalarAttribute(VEGETATION.treeBatchCapacity);
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
      for (const batch of batches) {
        finaliseInstancedMesh(batch.branches, batch.count);
        finaliseInstancedMesh(batch.leaves, batch.count, batch.phase, batch.strength);
      }
    }
  }
}
