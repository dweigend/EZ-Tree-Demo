/**
 * Generates deterministic curved hedge rows in absolute macro-cells and assigns each shrub to one terrain chunk.
 * It owns placement only; geometry, LODs, and GPU capacity remain TreeSystem responsibilities.
 */

import { VEGETATION } from '../config';
import type { HeightField } from '../core/height-field';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import { SQUARE_METERS_PER_HECTARE } from '../ecology/landscape-population';
import {
  createLandscapeZoneWeights,
  getHedgeRowMetersPerHectare,
  getHedgeShrubSpacingMeters,
  type LandscapeZoneWeights,
} from '../ecology/landscape-zones';
import { getTrailEnvelope, writeLandscapeZoneWeights, type LandscapeSurfaceSample } from '../ecology/landscape-ecology';
import { getChunkBounds } from '../world/chunk-coordinates';

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

interface HedgePoint {
  readonly index: number;
  readonly progress: number;
  readonly x: number;
  readonly z: number;
}

const MACRO_CELL_SIZE_METERS = 160;
const HECTARES_PER_MACRO_CELL = MACRO_CELL_SIZE_METERS ** 2 / SQUARE_METERS_PER_HECTARE;
const MINIMUM_ROW_LENGTH_METERS = 90;
const ROW_LENGTH_VARIATION_METERS = 85;
const ROW_REACH_METERS = MINIMUM_ROW_LENGTH_METERS + ROW_LENGTH_VARIATION_METERS;
const ROW_CENTER_JITTER_METERS = 24;
const MAXIMUM_HEDGE_SLOPE_DEGREES = 20;

export class HedgeDistribution {
  private readonly cache = new Map<string, HedgePlacement[]>();
  private readonly zones = createLandscapeZoneWeights();
  private readonly surface: LandscapeSurfaceSample = {
    x: 0,
    z: 0,
    heightMeters: 0,
    slopeDegrees: 0,
  };

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
    const minimumMacroX = Math.floor((bounds.minimumX - ROW_REACH_METERS) / MACRO_CELL_SIZE_METERS);
    const maximumMacroX = Math.floor((bounds.maximumX + ROW_REACH_METERS) / MACRO_CELL_SIZE_METERS);
    const minimumMacroZ = Math.floor((bounds.minimumZ - ROW_REACH_METERS) / MACRO_CELL_SIZE_METERS);
    const maximumMacroZ = Math.floor((bounds.maximumZ + ROW_REACH_METERS) / MACRO_CELL_SIZE_METERS);
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
    const centerX =
      (macroX + 0.5) * MACRO_CELL_SIZE_METERS + signedRandom(hashCoordinates(hash, 7, 11)) * ROW_CENTER_JITTER_METERS;
    const centerZ =
      (macroZ + 0.5) * MACRO_CELL_SIZE_METERS + signedRandom(hashCoordinates(hash, 13, 17)) * ROW_CENTER_JITTER_METERS;
    const zones = this.sampleZones(centerX, centerZ);
    const length = MINIMUM_ROW_LENGTH_METERS + unitRandom(hashCoordinates(hash, 29, 31)) * ROW_LENGTH_VARIATION_METERS;
    const targetMeters = getHedgeRowMetersPerHectare(zones) * HECTARES_PER_MACRO_CELL;
    if (unitRandom(hashCoordinates(hash, 3, 5)) * length >= targetMeters) return null;
    const shrubSpacing = getHedgeShrubSpacingMeters(zones);
    return {
      id: `${macroX}:${macroZ}`,
      hash,
      centerX,
      centerZ,
      angle: unitRandom(hashCoordinates(hash, 19, 23)) * Math.PI * 2,
      length,
      bend: signedRandom(hashCoordinates(hash, 37, 41)) * 13,
      pointCount: Math.max(2, Math.round(length / shrubSpacing) + 1),
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
      const placement = this.createPlacement(row, { index: pointIndex, progress, x, z });
      if (placement) target.push(placement);
    }
  }

  private createPlacement(row: HedgeRow, point: HedgePoint): HedgePlacement | null {
    this.sampleZones(point.x, point.z);
    if (!this.acceptsSite()) return null;
    const hash = hashCoordinates(row.hash, point.index, 0x713d);
    const curveRotation = Math.cos(point.progress * Math.PI) * row.bend * 0.011;
    return {
      rowId: row.id,
      pointIndex: point.index,
      x: point.x,
      y: this.surface.heightMeters,
      z: point.z,
      rotation: row.angle + curveRotation + signedRandom(hashCoordinates(hash, 3, 5)) * 0.08,
      scale: 0.82 + unitRandom(hashCoordinates(hash, 7, 11)) * 0.36,
      widthScale: 1.05 + unitRandom(hashCoordinates(hash, 13, 17)) * 0.3,
      depthScale: 0.62 + unitRandom(hashCoordinates(hash, 19, 23)) * 0.24,
      windPhase: unitRandom(hashCoordinates(hash, 29, 31)) * Math.PI * 2,
      windStrength: 0.55 + unitRandom(hashCoordinates(hash, 37, 41)) * 0.35,
      tint: unitRandom(hashCoordinates(hash, 43, 47)),
    };
  }

  private sampleZones(x: number, z: number): LandscapeZoneWeights {
    this.surface.x = x;
    this.surface.z = z;
    this.surface.heightMeters = this.heightField.getHeight(x, z);
    this.surface.slopeDegrees = this.heightField.getSlopeDegrees(x, z);
    return writeLandscapeZoneWeights(this.heightField, this.surface, this.zones);
  }

  private acceptsSite(): boolean {
    if (this.surface.slopeDegrees > MAXIMUM_HEDGE_SLOPE_DEGREES) return false;
    if (getTrailEnvelope(this.surface) > 0.08) return false;
    return getHedgeRowMetersPerHectare(this.zones) > 0;
  }
}

function isInsideChunk(x: number, z: number, bounds: ReturnType<typeof getChunkBounds>): boolean {
  return x >= bounds.minimumX && x < bounds.maximumX && z >= bounds.minimumZ && z < bounds.maximumZ;
}
