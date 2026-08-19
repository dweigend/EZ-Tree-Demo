/**
 * Renders fixed-capacity instanced trees and hedges with shared distance LODs.
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
import { acceptsTreeDensity, type ForestDistribution, type TreePlacement } from './forest-distribution';
import type { HedgeDistribution, HedgePlacement } from './hedge-distribution';
import type { TreeLod, TreeVariant } from './tree-factory';
import type { GeneratedVariantUpdate } from './tree-variant-generator';
import type { TreeSpecies } from './tree-templates';
import type { TreeVariantSlot } from './tree-variant-contract';

interface TreeBatch {
  readonly branches: InstancedMesh;
  readonly leaves: InstancedMesh;
  readonly phase: InstancedBufferAttribute;
  readonly strength: InstancedBufferAttribute;
  count: number;
}

interface BranchBatch {
  readonly mesh: InstancedMesh;
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
  readonly hedgeVariant: TreeVariant;
  readonly hedges: HedgeDistribution;
}

const LODS: readonly TreeLod[] = ['near', 'middle', 'far'];
const SHARED_DISTANCE_VARIANT_INDEX = 1;
const VIEW_CONE_COSINE = 0;
const LEAF_COLORS: Readonly<Record<TreeSpecies, readonly [Color, Color]>> = {
  ash: [new Color('#b9d39f'), new Color('#e4e7a8')],
  aspen: [new Color('#c9dcaa'), new Color('#eff0b4')],
  oak: [new Color('#bed09b'), new Color('#e1d39d')],
  pine: [new Color('#b2c8a6'), new Color('#d8d6a2')],
};
const HEDGE_DARK = new Color('#75975f');
const HEDGE_LIGHT = new Color('#b1bc76');
const BARK_DARK = new Color('#d2c7b9');
const BARK_LIGHT = new Color('#f6e8d2');

export class TreeSystem {
  public readonly group = new Object3D();
  public visibleTreeCount = 0;
  public visibleHedgeCount = 0;
  public activeChunkCount = 0;
  private readonly variants: readonly TreeVariant[];
  private readonly forest: ForestDistribution;
  private readonly hedgeVariant: TreeVariant;
  private readonly hedges: HedgeDistribution;
  private readonly treeBatches: TreeBatch[][];
  private readonly hedgeBatches: readonly [TreeBatch, TreeBatch];
  private readonly sharedNearBranches: BranchBatch;
  private readonly speciesIndices: Readonly<Record<TreeSpecies, number>>;
  private readonly activeHeights: number[];
  private readonly activePresetIds: string[];
  private readonly stagedVariants = new Map<TreeVariantSlot, GeneratedVariantUpdate>();
  private activeHedgeHeight: number;
  private activeHedgePresetId: string;
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
    this.hedgeVariant = options.hedgeVariant;
    this.hedges = options.hedges;
    this.speciesIndices = this.createSpeciesIndices();
    this.activeHeights = this.variants.map((variant) => variant.height);
    this.activePresetIds = this.variants.map((variant) => variant.presetId);
    this.activeHedgeHeight = this.hedgeVariant.height;
    this.activeHedgePresetId = this.hedgeVariant.presetId;
    this.treeBatches = this.variants.map((variant) => LODS.map((lod) => this.createBatch(variant, lod, VEGETATION.treeBatchCapacity)));
    this.sharedNearBranches = this.createSharedNearBranches();
    for (const batches of this.treeBatches) batches[0]!.branches.visible = false;
    this.hedgeBatches = [
      this.createBatch(this.hedgeVariant, 'near', VEGETATION.hedgeBatchCapacity),
      this.createBatch(this.hedgeVariant, 'far', VEGETATION.hedgeBatchCapacity),
    ];
    for (const batch of this.hedgeBatches) batch.branches.visible = false;
  }

  public rebuild(cameraPosition: Vector3, viewDirection: HorizontalDirection): void {
    this.applyStagedVariants();
    this.resetBatches();
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
    this.stagedVariants.get(update.slot)?.leaves.dispose();
    this.stagedVariants.set(update.slot, update);
  }

  public get activeVariantNames(): string {
    return [...this.activePresetIds, `hedge:${this.activeHedgePresetId}`].join(',');
  }

  public dispose(): void {
    for (const batches of this.treeBatches) this.disposeBatches(batches);
    this.disposeBatches(this.hedgeBatches);
    for (const variant of [...this.variants, this.hedgeVariant]) {
      variant.branchMaterial.dispose();
      variant.leafMaterial.dispose();
    }
    for (const update of this.stagedVariants.values()) update.leaves.dispose();
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
    if (!acceptsTreeDensity(placement.densityRank, VEGETATION.treeDensity)) return;
    const distance = getDistance(placement, renderWindow.position);
    if (!this.isInRenderWindow(placement, renderWindow, distance)) return;
    const variant = this.variants[placement.variant];
    const lodIndex = this.getTreeLodIndex(distance);
    if (!variant || lodIndex === null) return;
    const batchIndex = lodIndex === 0 ? placement.variant : SHARED_DISTANCE_VARIANT_INDEX;
    const batch = this.treeBatches[batchIndex]?.[lodIndex];
    if (!batch || batch.count >= VEGETATION.treeBatchCapacity) return;
    const height = this.activeHeights[placement.variant] ?? variant.height;
    this.writeTreeInstance(batch, variant, placement, height);
    if (lodIndex === 0) this.writeSharedNearBranch();
    batch.count += 1;
    this.visibleTreeCount += 1;
  }

  private addHedgePlacement(placement: HedgePlacement, renderWindow: TreeRenderWindow): void {
    const distance = getDistance(placement, renderWindow.position);
    if (!this.isInRenderWindow(placement, renderWindow, distance)) return;
    const lodIndex = distance < VEGETATION.hedgeNearDistance ? 0 : 1;
    const batch = distance < VEGETATION.hedgeFarDistance ? this.hedgeBatches[lodIndex] : undefined;
    if (!batch || batch.count >= VEGETATION.hedgeBatchCapacity) return;
    this.writeHedgeInstance(batch, placement);
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

  private writeHedgeInstance(batch: TreeBatch, placement: HedgePlacement): void {
    const worldHeight = this.activeHedgeHeight * placement.scale;
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

  private writeSharedNearBranch(): void {
    const batch = this.sharedNearBranches;
    if (batch.count >= VEGETATION.treeBatchCapacity) return;
    batch.mesh.setMatrixAt(batch.count, this.transform);
    batch.mesh.setColorAt(batch.count, this.barkColor);
    batch.count += 1;
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

  private createSharedNearBranches(): BranchBatch {
    const variant = this.variants[SHARED_DISTANCE_VARIANT_INDEX] ?? this.variants[0];
    if (!variant) throw new Error('Tree rendering requires at least one variant.');
    const mesh = createDynamicInstancedMesh(
      variant.lods.near.branches,
      variant.branchMaterial,
      VEGETATION.treeBatchCapacity,
    );
    mesh.castShadow = true;
    this.group.add(mesh);
    return { mesh, count: 0 };
  }

  private createSpeciesIndices(): Readonly<Record<TreeSpecies, number>> {
    return {
      ash: this.getSpeciesIndex('ash'),
      aspen: this.getSpeciesIndex('aspen'),
      oak: this.getSpeciesIndex('oak'),
      pine: this.getSpeciesIndex('pine'),
    };
  }

  private getSpeciesIndex(species: TreeSpecies): number {
    const index = this.variants.findIndex((variant) => variant.species === species);
    if (index < 0) throw new Error(`Tree rendering is missing the ${species} slot.`);
    return index;
  }

  private applyStagedVariants(): void {
    for (const [slot, update] of this.stagedVariants) {
      const batch = slot === 'hedge' ? this.hedgeBatches[0] : this.treeBatches[this.speciesIndices[slot]]?.[0];
      if (!batch || batch.count > 0) continue;
      update.leaves.setAttribute('aWindPhase', batch.phase);
      update.leaves.setAttribute('aWindStrength', batch.strength);
      batch.leaves.geometry.dispose();
      batch.leaves.geometry = update.leaves;
      this.activateStagedMetadata(slot, update);
      this.stagedVariants.delete(slot);
    }
  }

  private activateStagedMetadata(slot: TreeVariantSlot, update: GeneratedVariantUpdate): void {
    if (slot === 'hedge') {
      this.activeHedgeHeight = update.height;
      this.activeHedgePresetId = update.presetId;
      return;
    }
    const index = this.speciesIndices[slot];
    this.activeHeights[index] = update.height;
    this.activePresetIds[index] = update.presetId;
  }

  private resetBatches(): void {
    this.visibleTreeCount = 0;
    this.visibleHedgeCount = 0;
    this.sharedNearBranches.count = 0;
    for (const batches of this.treeBatches) for (const batch of batches) batch.count = 0;
    for (const batch of this.hedgeBatches) batch.count = 0;
  }

  private finaliseBatches(): void {
    for (const batches of this.treeBatches) for (const batch of batches) this.finaliseBatch(batch);
    for (const batch of this.hedgeBatches) this.finaliseBatch(batch);
    finaliseInstancedMesh(this.sharedNearBranches.mesh, this.sharedNearBranches.count);
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
}

function getDistance(placement: PositionedPlacement, cameraPosition: Vector3): number {
  return Math.hypot(placement.x - cameraPosition.x, placement.z - cameraPosition.z);
}
