/**
 * Evaluates continuous landscape-zone weights from deterministic world-space terrain signals.
 * It decides where zones occur; landscape-zones.ts declares what those zones contain.
 */

import { MathUtils, type Vector4 } from 'three';
import type { HeightField } from '../core/height-field';
import {
  createLandscapeZoneWeights,
  createTerrainCoverage,
  LANDSCAPE_ZONE_IDS,
  writeTerrainCoverage,
  type LandscapeZoneWeights,
} from './landscape-zones';

const FLAT_SLOPE_FADE_DEGREES = [6, 36] as const;
const ROCK_SLOPE_FADE_DEGREES = [18, 42] as const;
const TRAIL_SLOPE_FADE_DEGREES = [10, 30] as const;
const LOWLAND_HEIGHT_FADE_METERS = [28, 105] as const;
const HIGHLAND_HEIGHT_FADE_METERS = [48, 132] as const;
const WET_LOWLAND_FADE = [0.54, 0.82] as const;
const FOREST_FADE = [0.4, 0.58] as const;
const MOIST_FOREST_FADE = [0.56, 0.72] as const;
const CONIFER_HIGHLAND_FADE = [0.08, 0.5] as const;
const ZONE_CONTRAST = 2.4;

export interface LandscapeSurfaceSample {
  x: number;
  z: number;
  heightMeters: number;
  slopeDegrees: number;
}

export interface LandscapeMaterialWeights {
  readonly first: Vector4;
  readonly second: Vector4;
}

interface EcologyFactors {
  readonly moisture: number;
  readonly woodland: number;
  readonly flatness: number;
  readonly lowland: number;
  readonly highland: number;
  readonly slopeRock: number;
}

interface ZoneAffinities {
  readonly forest: number;
  readonly rockyRidge: number;
  readonly wetLowland: number;
}

/**
 * Writes six soft zone affinities for one terrain site into a reusable target.
 * Consumers call this while creating cached placements or resampling terrain, never per rendered instance.
 */
export function writeLandscapeZoneWeights(
  heightField: HeightField,
  surface: LandscapeSurfaceSample,
  target: LandscapeZoneWeights,
): LandscapeZoneWeights {
  const factors = getEcologyFactors(heightField, surface);
  const rockyRidge = getRockyRidgeAffinity(factors);
  const wetLowland = getWetLowlandAffinity(factors, rockyRidge);
  const forest = getForestAffinity(factors, rockyRidge);
  const availableGround = (1 - rockyRidge) * (1 - wetLowland);
  const coniferShare = getConiferShare(factors);
  const broadleaf = forest * (1 - coniferShare) * availableGround;
  const conifer = forest * coniferShare * availableGround;
  const moistShare = smoothstep(factors.moisture, MOIST_FOREST_FADE);

  target.rockyRidge = shapeZoneAffinity(rockyRidge);
  target.wetLowland = shapeZoneAffinity(wetLowland * (1 - rockyRidge));
  target.coniferHighland = shapeZoneAffinity(conifer);
  target.moistBroadleaf = shapeZoneAffinity(broadleaf * moistShare);
  target.dryBroadleaf = shapeZoneAffinity(broadleaf * (1 - moistShare));
  target.meadow = shapeZoneAffinity(getMeadowAffinity(factors, { forest, rockyRidge, wetLowland }));
  return normaliseZones(target);
}

/** Converts zone-authored ground coverage into the eight fixed terrain-atlas channels. */
export function writeLandscapeMaterialWeights(
  heightField: HeightField,
  surface: LandscapeSurfaceSample,
  target: LandscapeMaterialWeights,
): LandscapeMaterialWeights {
  const zones = writeLandscapeZoneWeights(heightField, surface, materialZoneScratch);
  const coverage = writeTerrainCoverage(zones, terrainCoverageScratch);
  const trail = getTrailEnvelope(surface) * (1 - zones.wetLowland * 0.55) * (1 - zones.rockyRidge * 0.38) * 0.95;
  target.first.set(coverage.meadow, coverage.mud, coverage.dryForest, coverage.mossForest);
  target.second.set(coverage.forest, coverage.pineForest, coverage.rock, trail);
  return normaliseMaterials(target);
}

/** Returns the soft mask for the repeated path overlay at a sampled terrain site. */
export function getTrailEnvelope(surface: LandscapeSurfaceSample): number {
  const along = surface.x * 0.72 + surface.z * 0.69;
  const across = surface.x * -0.69 + surface.z * 0.72;
  const warp = Math.sin(across * 0.011 + 0.7) * 38 + Math.sin(across * 0.027 - 1.1) * 14;
  const spacingMeters = 310;
  const repeated = (((along + warp + spacingMeters * 0.5) % spacingMeters) + spacingMeters) % spacingMeters;
  const distanceMeters = Math.abs(repeated - spacingMeters * 0.5);
  const path = 1 - MathUtils.smoothstep(distanceMeters, 3, 28);
  return path * (1 - smoothstep(surface.slopeDegrees, TRAIL_SLOPE_FADE_DEGREES));
}

function getEcologyFactors(heightField: HeightField, surface: LandscapeSurfaceSample): EcologyFactors {
  const warped = getWarpedEcologySample(heightField, surface);
  return {
    ...warped,
    flatness: 1 - smoothstep(surface.slopeDegrees, FLAT_SLOPE_FADE_DEGREES),
    lowland: 1 - smoothstep(surface.heightMeters, LOWLAND_HEIGHT_FADE_METERS),
    highland: smoothstep(surface.heightMeters, HIGHLAND_HEIGHT_FADE_METERS),
    slopeRock: smoothstep(surface.slopeDegrees, ROCK_SLOPE_FADE_DEGREES),
  };
}

/** Rocky ridges emerge from steep slopes or genuinely exposed, unwooded highlands. */
function getRockyRidgeAffinity(factors: EcologyFactors): number {
  const exposedHighland = factors.highland * (1 - factors.woodland) * (0.55 + (1 - factors.moisture) * 0.45);
  return Math.max(factors.slopeRock, exposedHighland);
}

/** Wet lowlands require moisture, low elevation, and terrain flat enough to retain water. */
function getWetLowlandAffinity(factors: EcologyFactors, rockyRidge: number): number {
  const wetness = smoothstep(factors.moisture * factors.lowland, WET_LOWLAND_FADE);
  return wetness * factors.flatness * (1 - rockyRidge * 0.2);
}

/** Broad forest potential follows the shared woodland field and avoids exposed rock. */
function getForestAffinity(factors: EcologyFactors, rockyRidge: number): number {
  const terrainSuitability = 0.42 + factors.flatness * 0.58;
  return smoothstep(factors.woodland, FOREST_FADE) * terrainSuitability * (1 - rockyRidge);
}

/** Highland forest becomes coniferous without turning every high site into bare rock. */
function getConiferShare(factors: EcologyFactors): number {
  const elevation = smoothstep(factors.highland, CONIFER_HIGHLAND_FADE);
  return elevation * (0.72 + (1 - factors.moisture) * 0.28);
}

/** Meadows fill flat, open land left by forests, wetlands, and exposed rock. */
function getMeadowAffinity(factors: EcologyFactors, affinities: ZoneAffinities): number {
  return (1 - affinities.forest * 0.92)
    * factors.flatness
    * (1 - affinities.rockyRidge * 0.86)
    * (1 - affinities.wetLowland * 0.7);
}

function getWarpedEcologySample(
  heightField: HeightField,
  surface: LandscapeSurfaceSample,
): Pick<EcologyFactors, 'moisture' | 'woodland'> {
  const warpX = (heightField.getNoise01(surface.x * 0.0021 + 73, surface.z * 0.0021 - 31, 2) - 0.5) * 110;
  const warpZ = (heightField.getNoise01(surface.x * 0.0021 - 47, surface.z * 0.0021 + 89, 2) - 0.5) * 110;
  return {
    moisture: getMoisture(heightField, surface.x + warpX, surface.z + warpZ, surface.heightMeters),
    woodland: getWoodland(heightField, surface.x + warpX, surface.z + warpZ),
  };
}

function getMoisture(heightField: HeightField, x: number, z: number, heightMeters: number): number {
  const broad = heightField.getNoise01(x * 0.0011 + 81, z * 0.0011 - 57, 3);
  const drainage = 1 - MathUtils.smoothstep(heightMeters, 92, 205);
  return MathUtils.clamp(broad * 0.72 + drainage * 0.28, 0, 1);
}

function getWoodland(heightField: HeightField, x: number, z: number): number {
  return heightField.getNoise01((x + 240) * 0.00185, (z - 170) * 0.00185, 3);
}

function normaliseZones(weights: LandscapeZoneWeights): LandscapeZoneWeights {
  const total = LANDSCAPE_ZONE_IDS.reduce((sum, zoneId) => sum + weights[zoneId], 0);
  if (total <= 0) return Object.assign(weights, createLandscapeZoneWeights(), { meadow: 1 });
  for (const zoneId of LANDSCAPE_ZONE_IDS) weights[zoneId] /= total;
  return weights;
}

function normaliseMaterials(weights: LandscapeMaterialWeights): LandscapeMaterialWeights {
  const first = weights.first;
  const second = weights.second;
  const total = first.x + first.y + first.z + first.w + second.x + second.y + second.z + second.w;
  if (total <= 0) {
    first.set(1, 0, 0, 0);
    second.set(0, 0, 0, 0);
    return weights;
  }
  first.multiplyScalar(1 / total);
  second.multiplyScalar(1 / total);
  return weights;
}

function smoothstep(value: number, range: readonly [number, number]): number {
  return MathUtils.smoothstep(value, range[0], range[1]);
}

function shapeZoneAffinity(value: number): number {
  return value ** ZONE_CONTRAST;
}

const materialZoneScratch = createLandscapeZoneWeights();
const terrainCoverageScratch = createTerrainCoverage();
