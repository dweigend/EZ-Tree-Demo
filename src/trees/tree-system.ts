/**
 * Renders fixed-capacity instanced trees and hedges with template-faithful EZ-Tree LODs.
 * Streaming rebuilds only instance prefixes; no render object or placement is allocated per frame.
 */

import { Color, InstancedBufferAttribute, Matrix4, Object3D, Quaternion, Vector3, type InstancedMesh } from 'three';
import { TERRAIN, VEGETATION } from '../config';
import {
  createDynamicInstancedMesh,
  createDynamicScalarAttribute,
  finaliseInstancedMesh,
} from '../rendering/update-instanced-attributes';
import { ChunkPrefetchQueue, getChunkIndex, getChunkViewWindow, type HorizontalDirection } from '../world/chunk-coordinates';
import type { ForestDistribution, TreePlacement } from './forest-distribution';
import type { HedgeDistribution, HedgePlacement } from './hedge-distribution';
import type { TreeGeometryPair, TreeLod, TreeVariant } from './tree-factory';
import type { GeneratedVariantUpdate } from './tree-variant-generator';
import type { TreePresetId, TreeSpecies } from './tree-templates';
import type { TreeVariantSlot } from './tree-variant-contract';

interface TreeBatch {
  readonly branches: InstancedMesh;
  readonly leaves: InstancedMesh;
  readonly phase: InstancedBufferAttribute;
  readonly strength: InstancedBufferAttribute;
  count: number;
}

interface TreeRenderWindow {
  readonly position: Vector3;
  readonly direction: HorizontalDirection;
}

interface PositionedPlacement {
  readonly x: number;
  readonly z: number;
}

export interface TreeSystemOptions {
  readonly variants: readonly TreeVariant[];
  readonly forest: ForestDistribution;
  readonly hedgeVariants: readonly TreeVariant[];
  readonly hedges: HedgeDistribution;
}

const LODS: readonly TreeLod[] = ['near', 'middle', 'far'];
const HEDGE_LODS: readonly TreeLod[] = ['near', 'far'];
const VIEW_CONE_COSINE = 0;
const LEAF_COLORS: Readonly<Record<TreeSpecies, readonly [Color, Color]>> = {
  ash: [new Color('#96bd7f'), new Color('#c5d995')],
  aspen: [new Color('#a8c984'), new Color('#d4df9d')],
  oak: [new Color('#88b06e'), new Color('#b3c982')],
  pine: [new Color('#789a69'), new Color('#9cb27a')],
};
const HEDGE_DARK = new Color('#c4d7b8');
const HEDGE_LIGHT = new Color('#eef0c9');
const BARK_DARK = new Color('#e8e0d6');
const BARK_LIGHT = new Color('#fffaf0');

export class TreeSystem {
  public readonly group = new Object3D();
  public visibleTreeCount = 0;
  public visibleHedgeCount = 0;
  public activeChunkCount = 0;
  private readonly variants: readonly TreeVariant[];
  private readonly forest: ForestDistribution;
  private readonly hedgeVariants: readonly TreeVariant[];
  private readonly hedges: HedgeDistribution;
  private readonly treeBatches: TreeBatch[][];
  private readonly hedgeBatches: TreeBatch[][];
  private readonly presetIndices: ReadonlyMap<TreePresetId, number>;
  private readonly hedgePresetIndices: ReadonlyMap<TreePresetId, number>;
  private readonly activeHeights: number[];
  private readonly activePresetIds: string[];
  private readonly stagedVariants = new Map<TreeVariantSlot, GeneratedVariantUpdate>();
  private readonly activeHedgeHeights: number[];
  private readonly activeHedgePresetIds: string[];
  private readonly transform = new Matrix4();
  private readonly rotation = new Quaternion();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly leafColor = new Color();
  private readonly barkColor = new Color();
  private readonly prefetchQueue = new ChunkPrefetchQueue(TERRAIN.chunkRadius + 1);

  public constructor(options: TreeSystemOptions) {
    this.variants = options.variants;
    this.forest = options.forest;
    this.hedgeVariants = options.hedgeVariants;
    this.hedges = options.hedges;
    this.presetIndices = new Map(this.variants.map((variant, index) => [variant.presetId, index]));
    this.hedgePresetIndices = new Map(this.hedgeVariants.map((variant, index) => [variant.presetId, index]));
    this.activeHeights = this.variants.map((variant) => variant.height);
    this.activePresetIds = this.variants.map((variant) => variant.presetId);
    this.activeHedgeHeights = this.hedgeVariants.map((variant) => variant.height);
    this.activeHedgePresetIds = this.hedgeVariants.map((variant) => variant.presetId);
    this.treeBatches = this.variants.map((variant) => LODS.map((lod) => this.createBatch(variant, lod, VEGETATION.treeBatchCapacity)));
    this.hedgeBatches = this.hedgeVariants.map((variant) => {
      return HEDGE_LODS.map((lod) => this.createBatch(variant, lod, VEGETATION.hedgeBatchCapacity));
    });
  }

  public rebuild(cameraPosition: Vector3, viewDirection: HorizontalDirection): void {
    this.resetBatches();
    this.applyStagedVariants();
    this.fillStreamingWindow(cameraPosition, viewDirection);
    this.finaliseBatches();
  }

  public prefetchNextChunk(cameraPosition: Vector3, viewDirection: HorizontalDirection): void {
    const coordinate = this.prefetchQueue.next(cameraPosition, viewDirection);
    if (!coordinate) return;
    this.forest.getChunkPlacements(coordinate.x, coordinate.z);
    this.hedges.getChunkPlacements(coordinate.x, coordinate.z);
  }

  public stageVariant(update: GeneratedVariantUpdate): void {
    const previous = this.stagedVariants.get(update.slot);
    if (previous) this.disposeLods(previous.lods);
    this.stagedVariants.set(update.slot, update);
  }

  public get activeVariantNames(): string {
    return [...this.activePresetIds, ...this.activeHedgePresetIds.map((id) => `hedge:${id}`)].join(',');
  }

  public dispose(): void {
    for (const batches of this.treeBatches) this.disposeBatches(batches);
    for (const batches of this.hedgeBatches) this.disposeBatches(batches);
    for (const variant of [...this.variants, ...this.hedgeVariants]) {
      variant.branchMaterial.dispose();
      variant.leafMaterial.dispose();
    }
    for (const update of this.stagedVariants.values()) this.disposeLods(update.lods);
    this.stagedVariants.clear();
    this.group.clear();
  }

  private fillStreamingWindow(cameraPosition: Vector3, viewDirection: HorizontalDirection): void {
    const centerX = getChunkIndex(cameraPosition.x);
    const centerZ = getChunkIndex(cameraPosition.z);
    const coordinates = getChunkViewWindow(centerX, centerZ, TERRAIN.chunkRadius, viewDirection);
    const renderWindow = { position: cameraPosition, direction: viewDirection } satisfies TreeRenderWindow;
    this.activeChunkCount = coordinates.length;
    for (const coordinate of coordinates) {
      for (const placement of this.forest.getChunkPlacements(coordinate.x, coordinate.z)) {
        this.addTreePlacement(placement, renderWindow);
      }
      for (const placement of this.hedges.getChunkPlacements(coordinate.x, coordinate.z)) {
        this.addHedgePlacement(placement, renderWindow);
      }
    }
  }

  private addTreePlacement(placement: TreePlacement, renderWindow: TreeRenderWindow): void {
    const distance = getDistance(placement, renderWindow.position);
    if (!this.isInRenderWindow(placement, renderWindow, distance)) return;
    const variant = this.variants[placement.variant];
    const lodIndex = this.getTreeLodIndex(distance);
    if (!variant || lodIndex === null) return;
    const batch = this.treeBatches[placement.variant]?.[lodIndex];
    if (!batch || batch.count >= VEGETATION.treeBatchCapacity) return;
    const height = this.activeHeights[placement.variant] ?? variant.height;
    this.writeTreeInstance(batch, variant, placement, height);
    batch.count += 1;
    this.visibleTreeCount += 1;
  }

  private addHedgePlacement(placement: HedgePlacement, renderWindow: TreeRenderWindow): void {
    const distance = getDistance(placement, renderWindow.position);
    if (!this.isInRenderWindow(placement, renderWindow, distance)) return;
    const lodIndex = distance < VEGETATION.hedgeNearDistance ? 0 : 1;
    const batch = distance < VEGETATION.hedgeFarDistance ? this.hedgeBatches[placement.variant]?.[lodIndex] : undefined;
    if (!batch || batch.count >= VEGETATION.hedgeBatchCapacity) return;
    this.writeHedgeInstance(batch, placement, this.activeHedgeHeights[placement.variant] ?? 1);
    batch.count += 1;
    this.visibleHedgeCount += 1;
  }

  private isInRenderWindow(
    placement: PositionedPlacement,
    renderWindow: TreeRenderWindow,
    distance: number,
  ): boolean {
    if (distance < VEGETATION.nearDistance) return true;
    const { direction, position } = renderWindow;
    const directionLength = Math.hypot(direction.x, direction.z);
    if (directionLength === 0 || distance === 0) return true;
    const x = placement.x - position.x;
    const z = placement.z - position.z;
    return (x * direction.x + z * direction.z) / (distance * directionLength) >= VIEW_CONE_COSINE;
  }

  private writeTreeInstance(
    batch: TreeBatch,
    variant: TreeVariant,
    placement: TreePlacement,
    activeHeight: number,
  ): void {
    const worldHeight = activeHeight * placement.scale;
    this.writeTransform(batch, placement, worldHeight, placement.widthScale, placement.depthScale, 0.12);
    this.writeWind(batch, placement.windPhase, placement.windStrength);
    this.writeTreeColors(batch, variant.species, placement.tint);
  }

  private writeHedgeInstance(batch: TreeBatch, placement: HedgePlacement, activeHeight: number): void {
    const worldHeight = activeHeight * placement.scale;
    this.writeTransform(batch, placement, worldHeight, placement.widthScale, placement.depthScale, 0.04);
    this.writeWind(batch, placement.windPhase, placement.windStrength);
    const index = batch.count;
    this.leafColor.copy(HEDGE_DARK).lerp(HEDGE_LIGHT, 0.18 + placement.tint * 0.55);
    this.barkColor.copy(BARK_DARK).lerp(BARK_LIGHT, 0.16 + placement.tint * 0.32);
    batch.leaves.setColorAt(index, this.leafColor);
    batch.branches.setColorAt(index, this.barkColor);
  }

  private writeTransform(
    batch: TreeBatch,
    placement: TreePlacement | HedgePlacement,
    height: number,
    widthScale: number,
    depthScale: number,
    groundInset: number,
  ): void {
    this.position.set(placement.x, placement.y - groundInset, placement.z);
    this.rotation.setFromAxisAngle(Object3D.DEFAULT_UP, placement.rotation);
    this.scale.set(height * widthScale, height, height * depthScale);
    this.transform.compose(this.position, this.rotation, this.scale);
    batch.branches.setMatrixAt(batch.count, this.transform);
    batch.leaves.setMatrixAt(batch.count, this.transform);
  }

  private writeWind(batch: TreeBatch, phase: number, strength: number): void {
    batch.phase.setX(batch.count, phase);
    batch.strength.setX(batch.count, strength);
  }

  private writeTreeColors(batch: TreeBatch, species: TreeSpecies, tint: number): void {
    const [leafDark, leafLight] = LEAF_COLORS[species];
    this.leafColor.copy(leafDark).lerp(leafLight, 0.18 + tint * 0.64);
    this.barkColor.copy(BARK_DARK).lerp(BARK_LIGHT, 0.22 + tint * 0.5);
    batch.leaves.setColorAt(batch.count, this.leafColor);
    batch.branches.setColorAt(batch.count, this.barkColor);
  }

  private getTreeLodIndex(distance: number): number | null {
    if (distance < VEGETATION.nearDistance) return 0;
    if (distance < VEGETATION.middleDistance) return 1;
    return distance < VEGETATION.farDistance ? 2 : null;
  }

  private createBatch(variant: TreeVariant, lod: TreeLod, capacity: number): TreeBatch {
    const geometry = variant.lods[lod];
    const branches = createDynamicInstancedMesh(geometry.branches, variant.branchMaterial, capacity);
    const leaves = createDynamicInstancedMesh(geometry.leaves, variant.leafMaterial, capacity);
    const phase = createDynamicScalarAttribute(capacity);
    const strength = createDynamicScalarAttribute(capacity);
    leaves.geometry.setAttribute('aWindPhase', phase);
    leaves.geometry.setAttribute('aWindStrength', strength);
    branches.castShadow = lod === 'near';
    leaves.castShadow = VEGETATION.leafShadows && lod === 'near';
    this.group.add(branches, leaves);
    return { branches, leaves, phase, strength, count: 0 };
  }

  private applyStagedVariants(): void {
    for (const [slot, update] of this.stagedVariants) {
      const treeIndex = this.presetIndices.get(slot);
      const hedgeIndex = this.hedgePresetIndices.get(slot);
      if (treeIndex !== undefined) this.activateTreeVariant(treeIndex, update);
      else if (hedgeIndex !== undefined) this.activateHedgeVariant(hedgeIndex, update);
      else this.disposeLods(update.lods);
      this.stagedVariants.delete(slot);
    }
  }

  private activateTreeVariant(index: number, update: GeneratedVariantUpdate): void {
    const batches = this.treeBatches[index];
    if (!batches) return this.disposeLods(update.lods);
    this.replaceBatchLods(batches, update.lods, LODS);
    this.activeHeights[index] = update.height;
    this.activePresetIds[index] = update.presetId;
  }

  private activateHedgeVariant(index: number, update: GeneratedVariantUpdate): void {
    const batches = this.hedgeBatches[index];
    if (!batches) return this.disposeLods(update.lods);
    this.replaceBatchLods(batches, update.lods, HEDGE_LODS);
    update.lods.middle.branches.dispose();
    update.lods.middle.leaves.dispose();
    this.activeHedgeHeights[index] = update.height;
    this.activeHedgePresetIds[index] = update.presetId;
  }

  private replaceBatchLods(
    batches: readonly TreeBatch[],
    lods: Readonly<Record<TreeLod, TreeGeometryPair>>,
    lodOrder: readonly TreeLod[],
  ): void {
    lodOrder.forEach((lod, index) => {
      const batch = batches[index];
      if (batch) this.replaceBatchGeometry(batch, lods[lod]);
    });
  }

  private replaceBatchGeometry(batch: TreeBatch, geometry: TreeGeometryPair): void {
    geometry.leaves.setAttribute('aWindPhase', batch.phase);
    geometry.leaves.setAttribute('aWindStrength', batch.strength);
    batch.branches.geometry.dispose();
    batch.leaves.geometry.dispose();
    batch.branches.geometry = geometry.branches;
    batch.leaves.geometry = geometry.leaves;
  }

  private resetBatches(): void {
    this.visibleTreeCount = 0;
    this.visibleHedgeCount = 0;
    for (const batches of this.treeBatches) for (const batch of batches) batch.count = 0;
    for (const batches of this.hedgeBatches) for (const batch of batches) batch.count = 0;
  }

  private finaliseBatches(): void {
    for (const batches of this.treeBatches) for (const batch of batches) this.finaliseBatch(batch);
    for (const batches of this.hedgeBatches) for (const batch of batches) this.finaliseBatch(batch);
  }

  private finaliseBatch(batch: TreeBatch): void {
    finaliseInstancedMesh(batch.branches, batch.count);
    finaliseInstancedMesh(batch.leaves, batch.count, batch.phase, batch.strength);
  }

  private disposeBatches(batches: readonly TreeBatch[]): void {
    for (const batch of batches) {
      batch.branches.geometry.dispose();
      batch.leaves.geometry.dispose();
    }
  }

  private disposeLods(lods: Readonly<Record<TreeLod, TreeGeometryPair>>): void {
    for (const lod of LODS) {
      lods[lod].branches.dispose();
      lods[lod].leaves.dispose();
    }
  }
}

function getDistance(placement: PositionedPlacement, cameraPosition: Vector3): number {
  return Math.hypot(placement.x - cameraPosition.x, placement.z - cameraPosition.z);
}
