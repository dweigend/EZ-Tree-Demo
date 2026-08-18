/**
 * Deterministically places clustered forest trees and low hedge shrubs in terrain chunks.
 * EcologyField owns habitat shapes; this module owns only tree candidate ranks and render placement values.
 */

import { MathUtils } from 'three';
import { CONFIG, TERRAIN, VEGETATION } from '../config';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import {
  type EcologyField,
  type EcologySample,
  type MacroFeatureSample,
  createEcologySample,
  createMacroFeatureSample,
} from '../ecology/ecology-field';
import type { HeightField } from '../terrain/height-field';
import type { TreeForm, TreeSpecies } from '../trees/tree-templates';

const CACHE_LIMIT = 96;
const FOREST_PROBABILITY_SCALE = 0.68;
const FOREST_FRINGE_PROBABILITY_SCALE = 0.28;
const FOREST_TREES_PER_CHUNK = 80;
const HEDGE_SPACING = 7;
const HEDGE_PROBABILITY_SCALE = 0.86;

export interface TreeVariantProfile {
  readonly species: TreeSpecies;
  readonly form: TreeForm;
  readonly height: number;
}

export interface TreePlacement {
  readonly kind: TreeForm;
  readonly rank: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: number;
  readonly scale: number;
  readonly widthScale: number;
  readonly depthScale: number;
  readonly variant: number;
  readonly windPhase: number;
  readonly windStrength: number;
  readonly tint: number;
}

interface PlacementGrid {
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly cells: number;
  readonly step: number;
  readonly startX: number;
  readonly startZ: number;
}

interface MutableTreeSite {
  x: number;
  z: number;
  height: number;
  slope: number;
  moisture: number;
}

export class ForestDistribution {
  private readonly cache = new Map<string, TreePlacement[]>();
  private readonly ecologySample: EcologySample = createEcologySample();
  private readonly macroFeature: MacroFeatureSample = createMacroFeatureSample();
  private readonly site: MutableTreeSite = { x: 0, z: 0, height: 0, slope: 0, moisture: 0 };
  private readonly treeVariantIndices: Record<TreeSpecies, number[]> = createSpeciesIndex();
  private readonly shrubVariantIndices: number[] = [];

  public constructor(
    private readonly heightField: HeightField,
    private readonly ecologyField: EcologyField,
    private readonly seed: number,
    variants: readonly TreeVariantProfile[],
  ) {
    if (variants.length === 0) throw new Error('Forest distribution requires tree variants.');
    this.indexVariants(variants);
  }

  public getChunkPlacements(chunkX: number, chunkZ: number): TreePlacement[] {
    const key = `${chunkX}:${chunkZ}`;
    const cached = this.cache.get(key);
    if (cached) return this.touchCache(key, cached);
    const placements = this.createChunkPlacements(chunkX, chunkZ);
    this.cache.set(key, placements);
    this.trimCache();
    return placements;
  }

  private indexVariants(variants: readonly TreeVariantProfile[]): void {
    variants.forEach((variant, index) => {
      if (variant.form === 'shrub') {
        this.shrubVariantIndices.push(index);
        return;
      }
      this.treeVariantIndices[variant.species].push(index);
    });
    for (const indices of Object.values(this.treeVariantIndices)) {
      indices.sort((left, right) => variants[left]!.height - variants[right]!.height);
    }
  }

  private createChunkPlacements(chunkX: number, chunkZ: number): TreePlacement[] {
    const placements: TreePlacement[] = [];
    if (CONFIG.features.trees) this.appendForestTrees(placements, createGrid(chunkX, chunkZ, VEGETATION.treeSpacing));
    if (CONFIG.features.hedges && this.shrubVariantIndices.length > 0) this.appendHedgeShrubs(placements, chunkX, chunkZ);
    return placements;
  }

  private appendForestTrees(placements: TreePlacement[], grid: PlacementGrid): void {
    const candidates: TreePlacement[] = [];
    for (let cellZ = 0; cellZ < grid.cells; cellZ += 1) {
      for (let cellX = 0; cellX < grid.cells; cellX += 1) {
        const placement = this.createForestTree(grid, cellX, cellZ);
        if (placement) candidates.push(placement);
      }
    }
    candidates.sort((left, right) => left.rank - right.rank);
    placements.push(...candidates.slice(0, FOREST_TREES_PER_CHUNK));
  }

  private createForestTree(grid: PlacementGrid, cellX: number, cellZ: number): TreePlacement | null {
    const hash = this.writeCoordinates(grid, cellX, cellZ, 0x25f3);
    this.sampleTerrainSite();
    if (this.site.height < -35 || this.site.height > 225) return null;
    const ecology = this.ecologyField.sample(this.site, this.ecologySample);
    if (ecology.hedge > 0.16 || ecology.lake > 0.08) return null;
    const probability = this.getForestProbability(ecology.forest);
    const rank = unitRandom(hashCoordinates(hash, 7, 13));
    if (rank >= probability) return null;
    return this.buildTreePlacement(hash, rank);
  }

  private getForestProbability(forest: number): number {
    const clusteredCore = forest ** 4 * FOREST_PROBABILITY_SCALE;
    const softFringe = forest ** 2 * (1 - forest) * FOREST_FRINGE_PROBABILITY_SCALE;
    return Math.min(0.92, (clusteredCore + softFringe) * VEGETATION.forestDensity);
  }

  private appendHedgeShrubs(placements: TreePlacement[], chunkX: number, chunkZ: number): void {
    if (!this.chunkMayContainHedge(chunkX, chunkZ)) return;
    const grid = createGrid(chunkX, chunkZ, HEDGE_SPACING);
    for (let cellZ = 0; cellZ < grid.cells; cellZ += 1) {
      for (let cellX = 0; cellX < grid.cells; cellX += 1) {
        const placement = this.createHedgeShrub(grid, cellX, cellZ);
        if (placement) placements.push(placement);
      }
    }
  }

  private createHedgeShrub(grid: PlacementGrid, cellX: number, cellZ: number): TreePlacement | null {
    const hash = this.writeCoordinates(grid, cellX, cellZ, 0x7b21);
    const feature = this.ecologyField.sampleMacroFeature(this.site.x, this.site.z, this.macroFeature);
    if (feature.kind !== 'hedge' || feature.influence <= 0.18) return null;
    const probability = feature.influence * HEDGE_PROBABILITY_SCALE;
    const rank = unitRandom(hashCoordinates(hash, 17, 29));
    if (rank >= probability) return null;
    this.sampleTerrainSite();
    if (this.site.height < -35 || this.site.height > 180 || this.site.slope > 0.72) return null;
    const ecology = this.ecologyField.sample(this.site, this.ecologySample);
    if (ecology.lake > 0.05 || ecology.rock > 0.82) return null;
    return this.buildShrubPlacement(hash, rank);
  }

  private chunkMayContainHedge(chunkX: number, chunkZ: number): boolean {
    const centerX = chunkX * TERRAIN.chunkSize;
    const centerZ = chunkZ * TERRAIN.chunkSize;
    const inset = TERRAIN.chunkSize * 0.499;
    for (const x of [centerX - inset, centerX + inset]) {
      for (const z of [centerZ - inset, centerZ + inset]) {
        if (this.ecologyField.sampleMacroFeature(x, z, this.macroFeature).kind === 'hedge') return true;
      }
    }
    return false;
  }

  private writeCoordinates(grid: PlacementGrid, cellX: number, cellZ: number, salt: number): number {
    const worldCellX = grid.chunkX * grid.cells + cellX;
    const worldCellZ = grid.chunkZ * grid.cells + cellZ;
    const hash = hashCoordinates(this.seed, worldCellX, worldCellZ, salt);
    const jitterX = signedRandom(hashCoordinates(hash, 3, 5)) * grid.step * 0.42;
    const jitterZ = signedRandom(hashCoordinates(hash, 7, 11)) * grid.step * 0.42;
    this.site.x = grid.startX + (cellX + 0.5) * grid.step + jitterX;
    this.site.z = grid.startZ + (cellZ + 0.5) * grid.step + jitterZ;
    return hash;
  }

  private sampleTerrainSite(): void {
    this.site.height = this.heightField.getHeight(this.site.x, this.site.z);
    this.site.slope = this.heightField.getSlope(this.site.x, this.site.z);
    this.site.moisture = this.heightField.getMoisture(this.site.x, this.site.z, this.site.height);
  }

  private buildTreePlacement(hash: number, rank: number): TreePlacement {
    return {
      kind: 'tree',
      rank,
      x: this.site.x,
      y: this.site.height,
      z: this.site.z,
      rotation: unitRandom(hashCoordinates(hash, 31, 37)) * Math.PI * 2,
      scale: 0.86 + unitRandom(hashCoordinates(hash, 41, 43)) * 0.34,
      widthScale: 0.9 + unitRandom(hashCoordinates(hash, 47, 53)) * 0.22,
      depthScale: 0.9 + unitRandom(hashCoordinates(hash, 59, 61)) * 0.2,
      variant: this.chooseTreeVariant(hash),
      windPhase: unitRandom(hashCoordinates(hash, 67, 71)) * Math.PI * 2,
      windStrength: 0.72 + unitRandom(hashCoordinates(hash, 73, 79)) * 0.48,
      tint: unitRandom(hashCoordinates(hash, 83, 89)),
    };
  }

  private buildShrubPlacement(hash: number, rank: number): TreePlacement {
    return {
      kind: 'shrub',
      rank,
      x: this.site.x,
      y: this.site.height,
      z: this.site.z,
      rotation: unitRandom(hashCoordinates(hash, 31, 37)) * Math.PI * 2,
      scale: 0.78 + unitRandom(hashCoordinates(hash, 41, 43)) * 0.34,
      widthScale: 1.15 + unitRandom(hashCoordinates(hash, 47, 53)) * 0.38,
      depthScale: 0.9 + unitRandom(hashCoordinates(hash, 59, 61)) * 0.3,
      variant: this.shrubVariantIndices[hashCoordinates(hash, 67, 71) % this.shrubVariantIndices.length]!,
      windPhase: unitRandom(hashCoordinates(hash, 73, 79)) * Math.PI * 2,
      windStrength: 0.55 + unitRandom(hashCoordinates(hash, 83, 89)) * 0.34,
      tint: unitRandom(hashCoordinates(hash, 97, 101)),
    };
  }

  private chooseTreeVariant(hash: number): number {
    const candidates = this.treeVariantIndices[this.chooseSpecies()];
    if (candidates.length === 0) return 0;
    const heightRank = unitRandom(hashCoordinates(hash, 103, 107));
    const index = heightRank < 0.78 ? candidates.length - 1 : 0;
    return candidates[index]!;
  }

  private chooseSpecies(): TreeSpecies {
    const highland = MathUtils.smoothstep(this.site.height, 58, 175);
    const pineAffinity = highland * 0.66 + MathUtils.smoothstep(this.site.slope, 0.32, 0.8) * 0.2
      + (1 - this.site.moisture) * 0.18;
    if (pineAffinity > 0.58) return 'pine';
    if (this.site.moisture > 0.7) return 'aspen';
    if (this.site.moisture > 0.53) return 'ash';
    return 'oak';
  }

  private touchCache(key: string, placements: TreePlacement[]): TreePlacement[] {
    this.cache.delete(key);
    this.cache.set(key, placements);
    return placements;
  }

  private trimCache(): void {
    if (this.cache.size <= CACHE_LIMIT) return;
    const oldestKey = this.cache.keys().next().value as string | undefined;
    if (oldestKey) this.cache.delete(oldestKey);
  }
}

function createGrid(chunkX: number, chunkZ: number, spacing: number): PlacementGrid {
  const cells = Math.max(1, Math.floor(TERRAIN.chunkSize / spacing));
  return {
    chunkX,
    chunkZ,
    cells,
    step: TERRAIN.chunkSize / cells,
    startX: chunkX * TERRAIN.chunkSize - TERRAIN.chunkSize / 2,
    startZ: chunkZ * TERRAIN.chunkSize - TERRAIN.chunkSize / 2,
  };
}

function createSpeciesIndex(): Record<TreeSpecies, number[]> {
  return { ash: [], aspen: [], oak: [], pine: [] };
}
