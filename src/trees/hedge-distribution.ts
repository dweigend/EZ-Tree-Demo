/**
 * Distributes deterministic gapped hedge cohorts and two-dimensional shrub groups in absolute world space.
 * It owns placement only; geometry, LODs, and GPU capacity remain TreeSystem responsibilities.
 */

import { VEGETATION } from '../config';
import type { HeightField } from '../core/height-field';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import { SQUARE_METERS_PER_HECTARE } from '../ecology/landscape-population';
import {
  createLandscapeZoneWeights,
  getHedgePattern,
  getHedgeRowMetersPerHectare,
  getHedgeShrubSpacingMeters,
  type HedgePattern,
  type LandscapeZoneWeights,
} from '../ecology/landscape-zones';
import { getTrailEnvelope, writeLandscapeZoneWeights, type LandscapeSurfaceSample } from '../ecology/landscape-ecology';
import { getChunkBounds } from '../world/chunk-coordinates';

export interface HedgePlacement {
  readonly rowId: string;
  readonly pointIndex: number;
  readonly pattern: HedgePattern;
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
  readonly variant: number;
}

interface HedgeCohort {
  readonly id: string;
  readonly hash: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly angle: number;
  readonly pattern: HedgePattern;
  readonly pointCount: number;
  readonly groupCount: number;
  readonly baseVariant: number;
}

interface HedgePoint {
  readonly index: number;
  readonly x: number;
  readonly z: number;
  readonly rotation: number;
}

const MACRO_CELL_SIZE_METERS = 160;
const HECTARES_PER_MACRO_CELL = MACRO_CELL_SIZE_METERS ** 2 / SQUARE_METERS_PER_HECTARE;
const COHORT_REACH_METERS = 150;
const ROW_CENTER_JITTER_METERS = 24;
const MAXIMUM_HEDGE_SLOPE_DEGREES = 20;
const SITE_ATTEMPTS = 10;

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
    private readonly variantCount = 1,
  ) {
    if (variantCount < 1) throw new Error('Hedge distribution requires at least one visual variant.');
  }

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
    const minimumMacroX = Math.floor((bounds.minimumX - COHORT_REACH_METERS) / MACRO_CELL_SIZE_METERS);
    const maximumMacroX = Math.floor((bounds.maximumX + COHORT_REACH_METERS) / MACRO_CELL_SIZE_METERS);
    const minimumMacroZ = Math.floor((bounds.minimumZ - COHORT_REACH_METERS) / MACRO_CELL_SIZE_METERS);
    const maximumMacroZ = Math.floor((bounds.maximumZ + COHORT_REACH_METERS) / MACRO_CELL_SIZE_METERS);
    for (let macroZ = minimumMacroZ; macroZ <= maximumMacroZ; macroZ += 1) {
      for (let macroX = minimumMacroX; macroX <= maximumMacroX; macroX += 1) {
        const cohort = this.createCohort(macroX, macroZ);
        if (cohort) this.appendCohortPlacements(cohort, bounds, placements);
      }
    }
    return placements;
  }

  private createCohort(macroX: number, macroZ: number): HedgeCohort | null {
    const hash = hashCoordinates(this.seed, macroX, macroZ);
    const centerX =
      (macroX + 0.5) * MACRO_CELL_SIZE_METERS + signedRandom(hashCoordinates(hash, 7, 11)) * ROW_CENTER_JITTER_METERS;
    const centerZ =
      (macroZ + 0.5) * MACRO_CELL_SIZE_METERS + signedRandom(hashCoordinates(hash, 13, 17)) * ROW_CENTER_JITTER_METERS;
    const zones = this.sampleZones(centerX, centerZ);
    const shrubSpacing = getHedgeShrubSpacingMeters(zones);
    const targetCount = getHedgeRowMetersPerHectare(zones) * HECTARES_PER_MACRO_CELL / shrubSpacing;
    const pointCount = stochasticRound(targetCount, unitRandom(hashCoordinates(hash, 3, 5)));
    if (pointCount === 0) return null;
    const pattern = getHedgePattern(zones);
    return {
      id: `${macroX}:${macroZ}`,
      hash,
      centerX,
      centerZ,
      angle: this.getCohortAngle(pattern, { x: centerX, z: centerZ }, hash),
      pattern,
      pointCount,
      groupCount: getGroupCount(pattern, hash),
      baseVariant: hash % this.variantCount,
    };
  }

  private getCohortAngle(
    pattern: HedgePattern,
    center: { readonly x: number; readonly z: number },
    hash: number,
  ): number {
    const fallback = unitRandom(hashCoordinates(hash, 19, 23)) * Math.PI * 2;
    if (pattern !== 'slopeGroup') return fallback;
    const sampleDistance = 5;
    const gradientX = this.heightField.getHeight(center.x + sampleDistance, center.z)
      - this.heightField.getHeight(center.x - sampleDistance, center.z);
    const gradientZ = this.heightField.getHeight(center.x, center.z + sampleDistance)
      - this.heightField.getHeight(center.x, center.z - sampleDistance);
    if (Math.hypot(gradientX, gradientZ) < 0.08) return fallback;
    return Math.atan2(-gradientX, gradientZ);
  }

  private appendCohortPlacements(
    cohort: HedgeCohort,
    bounds: ReturnType<typeof getChunkBounds>,
    target: HedgePlacement[],
  ): void {
    for (let pointIndex = 0; pointIndex < cohort.pointCount; pointIndex += 1) {
      const placement = this.findPlacement(cohort, pointIndex);
      if (placement && isInsideChunk(placement.x, placement.z, bounds)) target.push(placement);
    }
  }

  private findPlacement(cohort: HedgeCohort, pointIndex: number): HedgePlacement | null {
    for (let attempt = 0; attempt < SITE_ATTEMPTS; attempt += 1) {
      const point = createHedgePoint(cohort, pointIndex, attempt);
      const placement = this.createPlacement(cohort, point);
      if (placement) return placement;
    }
    return null;
  }

  private createPlacement(cohort: HedgeCohort, point: HedgePoint): HedgePlacement | null {
    this.sampleZones(point.x, point.z);
    if (!this.acceptsSite()) return null;
    const hash = hashCoordinates(cohort.hash, point.index, 0x713d);
    return {
      rowId: cohort.id,
      pointIndex: point.index,
      pattern: cohort.pattern,
      x: point.x,
      y: this.surface.heightMeters,
      z: point.z,
      rotation: point.rotation + signedRandom(hashCoordinates(hash, 3, 5)) * 0.12,
      scale: 0.82 + unitRandom(hashCoordinates(hash, 7, 11)) * 0.36,
      widthScale: 1.05 + unitRandom(hashCoordinates(hash, 13, 17)) * 0.3,
      depthScale: 0.62 + unitRandom(hashCoordinates(hash, 19, 23)) * 0.24,
      windPhase: unitRandom(hashCoordinates(hash, 29, 31)) * Math.PI * 2,
      windStrength: 0.55 + unitRandom(hashCoordinates(hash, 37, 41)) * 0.35,
      tint: unitRandom(hashCoordinates(hash, 43, 47)),
      variant: chooseHedgeVariant(cohort, point.index, this.variantCount),
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

function createHedgePoint(cohort: HedgeCohort, pointIndex: number, attempt: number): HedgePoint {
  const point = cohort.pattern === 'fieldHedge' || cohort.pattern === 'brokenRow'
    ? createSegmentPoint(cohort, pointIndex)
    : createGroupPoint(cohort, pointIndex);
  const retryRadius = attempt * 4;
  const hash = hashCoordinates(cohort.hash, pointIndex, attempt, 0x51af);
  return {
    ...point,
    x: point.x + signedRandom(hashCoordinates(hash, 3, 5)) * retryRadius,
    z: point.z + signedRandom(hashCoordinates(hash, 7, 11)) * retryRadius,
  };
}

function createSegmentPoint(cohort: HedgeCohort, pointIndex: number): HedgePoint {
  const groupCapacity = Math.ceil(cohort.pointCount / cohort.groupCount);
  const groupIndex = Math.min(Math.floor(pointIndex / groupCapacity), cohort.groupCount - 1);
  const localIndex = pointIndex - groupIndex * groupCapacity;
  const pointsInGroup = Math.min(groupCapacity, cohort.pointCount - groupIndex * groupCapacity);
  const localProgress = pointsInGroup <= 1 ? 0.5 : localIndex / (pointsInGroup - 1);
  const broken = cohort.pattern === 'brokenRow';
  const stride = (groupCapacity - 1) * 2.6 + (broken ? 16 : 10);
  const along = (groupIndex - (cohort.groupCount - 1) * 0.5) * stride + (localProgress - 0.5) * (pointsInGroup - 1) * 2.6;
  const hash = hashCoordinates(cohort.hash, pointIndex, 0x62bf);
  const across = signedRandom(hashCoordinates(hash, 3, 5)) * (broken ? 4.5 : 2.4);
  return projectPoint(cohort, pointIndex, { along, across, rotation: cohort.angle });
}

function createGroupPoint(cohort: HedgeCohort, pointIndex: number): HedgePoint {
  const groupIndex = pointIndex % cohort.groupCount;
  const groupOffset = groupIndex - (cohort.groupCount - 1) * 0.5;
  const hash = hashCoordinates(cohort.hash, pointIndex, 0x73cf);
  const radius = Math.sqrt(unitRandom(hashCoordinates(hash, 3, 5)));
  const angle = unitRandom(hashCoordinates(hash, 7, 11)) * Math.PI * 2;
  const alongRadius = cohort.pattern === 'thicket' ? 11 : 15;
  const acrossRadius = cohort.pattern === 'thicket' ? 9 : 6;
  const along = groupOffset * 18 + Math.cos(angle) * radius * alongRadius;
  const across = Math.sin(groupIndex * 2.1) * 7 + Math.sin(angle) * radius * acrossRadius;
  const rotation = cohort.pattern === 'slopeGroup' ? cohort.angle : cohort.angle + angle;
  return projectPoint(cohort, pointIndex, { along, across, rotation });
}

function projectPoint(
  cohort: HedgeCohort,
  pointIndex: number,
  offset: { readonly along: number; readonly across: number; readonly rotation: number },
): HedgePoint {
  const forwardX = Math.cos(cohort.angle);
  const forwardZ = Math.sin(cohort.angle);
  return {
    index: pointIndex,
    x: cohort.centerX + forwardX * offset.along - forwardZ * offset.across,
    z: cohort.centerZ + forwardZ * offset.along + forwardX * offset.across,
    rotation: offset.rotation,
  };
}

function getGroupCount(pattern: HedgePattern, hash: number): number {
  const minimum = pattern === 'fieldHedge' ? 2 : pattern === 'brokenRow' ? 3 : 2;
  const variation = pattern === 'fieldHedge' ? 2 : 3;
  return minimum + (hashCoordinates(hash, 43, 47) % variation);
}

function stochasticRound(value: number, selection: number): number {
  const floor = Math.floor(value);
  return floor + (selection < value - floor ? 1 : 0);
}

function chooseHedgeVariant(cohort: HedgeCohort, pointIndex: number, variantCount: number): number {
  if (variantCount === 1) return 0;
  const hash = hashCoordinates(cohort.hash, pointIndex, 0x84df);
  const selection = unitRandom(hashCoordinates(hash, 3, 5));
  if (selection < 0.55) return cohort.baseVariant;
  if (selection < 0.82) return (cohort.baseVariant + 1) % variantCount;
  return hashCoordinates(hash, 7, 11) % variantCount;
}

function isInsideChunk(x: number, z: number, bounds: ReturnType<typeof getChunkBounds>): boolean {
  return x >= bounds.minimumX && x < bounds.maximumX && z >= bounds.minimumZ && z < bounds.maximumZ;
}
