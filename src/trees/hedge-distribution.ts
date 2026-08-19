/**
 * Generates deterministic curved hedge rows in absolute macro-cells and assigns each shrub to one terrain chunk.
 * It owns placement only; geometry, LODs, and GPU capacity remain TreeSystem responsibilities.
 */

import { TERRAIN, VEGETATION } from '../config';
import type { HeightField } from '../core/height-field';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import {
  createLandscapeZoneWeights,
  getTrailEnvelope,
  writeLandscapeZoneWeights,
  type LandscapeSurfaceSample,
} from '../ecology/landscape-ecology';

export interface HedgePlacement {
  readonly rowId: string;
  readonly pointIndex: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: number;
  readonly scale: number;
  readonly widthScale: number;
  readonly depthScale: number;
  readonly windPhase: number;
  readonly windStrength: number;
  readonly tint: number;
}

interface HedgeRow {
  readonly id: string;
  readonly hash: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly angle: number;
  readonly length: number;
  readonly bend: number;
  readonly pointCount: number;
}

const MACRO_CELL_SIZE = 160;
const ROW_REACH = 110;

export class HedgeDistribution {
  private readonly cache = new Map<string, HedgePlacement[]>();
  private readonly zones = createLandscapeZoneWeights();
  private readonly surface: LandscapeSurfaceSample = { x: 0, z: 0, height: 0, slope: 0 };

  public constructor(
    private readonly heightField: HeightField,
    private readonly seed: number,
  ) {}

  public getChunkPlacements(chunkX: number, chunkZ: number): HedgePlacement[] {
    const key = `${chunkX}:${chunkZ}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const placements = this.createChunkPlacements(chunkX, chunkZ);
    this.cache.set(key, placements);
    if (this.cache.size > VEGETATION.placementCacheSize) this.cache.delete(this.cache.keys().next().value!);
    return placements;
  }

  private createChunkPlacements(chunkX: number, chunkZ: number): HedgePlacement[] {
    const bounds = getChunkBounds(chunkX, chunkZ);
    const placements: HedgePlacement[] = [];
    const minimumMacroX = Math.floor((bounds.minimumX - ROW_REACH) / MACRO_CELL_SIZE);
    const maximumMacroX = Math.floor((bounds.maximumX + ROW_REACH) / MACRO_CELL_SIZE);
    const minimumMacroZ = Math.floor((bounds.minimumZ - ROW_REACH) / MACRO_CELL_SIZE);
    const maximumMacroZ = Math.floor((bounds.maximumZ + ROW_REACH) / MACRO_CELL_SIZE);
    for (let macroZ = minimumMacroZ; macroZ <= maximumMacroZ; macroZ += 1) {
      for (let macroX = minimumMacroX; macroX <= maximumMacroX; macroX += 1) {
        const row = this.createRow(macroX, macroZ);
        if (row) this.appendRowPlacements(row, bounds, placements);
      }
    }
    return placements;
  }

  private createRow(macroX: number, macroZ: number): HedgeRow | null {
    const hash = hashCoordinates(this.seed, macroX, macroZ);
    if (unitRandom(hashCoordinates(hash, 3, 5)) > 0.58) return null;
    return {
      id: `${macroX}:${macroZ}`,
      hash,
      centerX: (macroX + 0.5) * MACRO_CELL_SIZE + signedRandom(hashCoordinates(hash, 7, 11)) * 24,
      centerZ: (macroZ + 0.5) * MACRO_CELL_SIZE + signedRandom(hashCoordinates(hash, 13, 17)) * 24,
      angle: unitRandom(hashCoordinates(hash, 19, 23)) * Math.PI * 2,
      length: 90 + unitRandom(hashCoordinates(hash, 29, 31)) * 85,
      bend: signedRandom(hashCoordinates(hash, 37, 41)) * 13,
      pointCount: 28 + (hashCoordinates(hash, 43, 47) % 20),
    };
  }

  private appendRowPlacements(
    row: HedgeRow,
    bounds: ReturnType<typeof getChunkBounds>,
    target: HedgePlacement[],
  ): void {
    const forwardX = Math.cos(row.angle);
    const forwardZ = Math.sin(row.angle);
    const sideX = -forwardZ;
    const sideZ = forwardX;
    for (let pointIndex = 0; pointIndex < row.pointCount; pointIndex += 1) {
      if (unitRandom(hashCoordinates(row.hash, pointIndex, 0x51af)) < 0.14) continue;
      const progress = pointIndex / (row.pointCount - 1);
      const along = (progress - 0.5) * row.length;
      const across = Math.sin(progress * Math.PI) * row.bend;
      const x = row.centerX + forwardX * along + sideX * across;
      const z = row.centerZ + forwardZ * along + sideZ * across;
      if (!isInsideChunk(x, z, bounds)) continue;
      const placement = this.createPlacement(row, pointIndex, progress, x, z);
      if (placement) target.push(placement);
    }
  }

  private createPlacement(
    row: HedgeRow,
    pointIndex: number,
    progress: number,
    x: number,
    z: number,
  ): HedgePlacement | null {
    const y = this.heightField.getHeight(x, z);
    const slope = this.heightField.getSlope(x, z);
    this.updateSurface(x, z, y, slope);
    writeLandscapeZoneWeights(this.heightField, this.surface, this.zones);
    if (!this.acceptsSite()) return null;
    const hash = hashCoordinates(row.hash, pointIndex, 0x713d);
    const curveRotation = Math.cos(progress * Math.PI) * row.bend * 0.011;
    return {
      rowId: row.id,
      pointIndex,
      x,
      y,
      z,
      rotation: row.angle + curveRotation + signedRandom(hashCoordinates(hash, 3, 5)) * 0.08,
      scale: 0.82 + unitRandom(hashCoordinates(hash, 7, 11)) * 0.36,
      widthScale: 1.05 + unitRandom(hashCoordinates(hash, 13, 17)) * 0.3,
      depthScale: 0.62 + unitRandom(hashCoordinates(hash, 19, 23)) * 0.24,
      windPhase: unitRandom(hashCoordinates(hash, 29, 31)) * Math.PI * 2,
      windStrength: 0.55 + unitRandom(hashCoordinates(hash, 37, 41)) * 0.35,
      tint: unitRandom(hashCoordinates(hash, 43, 47)),
    };
  }

  private updateSurface(x: number, z: number, height: number, slope: number): void {
    this.surface.x = x;
    this.surface.z = z;
    this.surface.height = height;
    this.surface.slope = slope;
  }

  private acceptsSite(): boolean {
    if (this.surface.slope > 0.34 || this.zones.rockyRidge > 0.42) return false;
    if (getTrailEnvelope(this.surface) > 0.08) return false;
    const forest = this.zones.dryBroadleaf + this.zones.moistBroadleaf + this.zones.coniferHighland;
    const meadowEdge = this.zones.meadow * forest * 4;
    const moistureEdge = this.zones.wetLowland * (this.zones.meadow + forest) * 2.5;
    return meadowEdge + moistureEdge > 0.055;
  }
}

function getChunkBounds(chunkX: number, chunkZ: number) {
  const halfSize = TERRAIN.chunkSize / 2;
  return {
    minimumX: chunkX * TERRAIN.chunkSize - halfSize,
    maximumX: chunkX * TERRAIN.chunkSize + halfSize,
    minimumZ: chunkZ * TERRAIN.chunkSize - halfSize,
    maximumZ: chunkZ * TERRAIN.chunkSize + halfSize,
  } as const;
}

function isInsideChunk(x: number, z: number, bounds: ReturnType<typeof getChunkBounds>): boolean {
  return x >= bounds.minimumX && x < bounds.maximumX && z >= bounds.minimumZ && z < bounds.maximumZ;
}
