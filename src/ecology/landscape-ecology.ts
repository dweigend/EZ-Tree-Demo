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

const FLAT_SLOPE_FADE_DEGREES = [5, 32] as const;
const ROCK_SLOPE_FADE_DEGREES = [10, 32] as const;
const TRAIL_SLOPE_FADE_DEGREES = [10, 30] as const;
const LOWLAND_HEIGHT_FADE_METERS = [35, 125] as const;
const HIGHLAND_HEIGHT_FADE_METERS = [72, 190] as const;
const WET_LOWLAND_FADE = [0.44, 0.78] as const;
const FOREST_FADE = [0.38, 0.8] as const;
const CONIFER_FOREST_FADE = [0.34, 0.72] as const;

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
  const broadleaf = forest * (1 - factors.highland * 0.72) * (1 - wetLowland * 0.35);

  target.rockyRidge = rockyRidge + 0.005;
  target.wetLowland = wetLowland * (1 - rockyRidge * 0.7) + 0.005;
  target.coniferHighland = getConiferAffinity(factors) + 0.005;
  target.moistBroadleaf = broadleaf * factors.moisture + 0.005;
  target.dryBroadleaf = broadleaf * (1 - factors.moisture) + 0.005;
  target.meadow = getMeadowAffinity(factors, { forest, rockyRidge, wetLowland }) + 0.01;
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

/** Rocky ridges emerge from either steep slopes or exposed, comparatively dry highlands. */
function getRockyRidgeAffinity(factors: EcologyFactors): number {
  return Math.max(factors.slopeRock, factors.highland * (1 - factors.moisture * 0.42));
}

/** Wet lowlands require moisture, low elevation, and terrain flat enough to retain water. */
function getWetLowlandAffinity(factors: EcologyFactors, rockyRidge: number): number {
  const wetness = smoothstep(factors.moisture * factors.lowland, WET_LOWLAND_FADE);
  return wetness * factors.flatness * (1 - rockyRidge * 0.2);
}

/** Broad forest potential follows the shared woodland field and avoids exposed rock. */
function getForestAffinity(factors: EcologyFactors, rockyRidge: number): number {
  return smoothstep(factors.woodland, FOREST_FADE) * factors.flatness * (1 - rockyRidge * 0.8);
}

/** Conifers favour wooded highlands, modest slopes, and drier sites. */
function getConiferAffinity(factors: EcologyFactors): number {
  return (
    smoothstep(factors.woodland, CONIFER_FOREST_FADE) *
    factors.highland *
    (0.35 + factors.flatness * 0.65) *
    (1 - factors.slopeRock * 0.55) *
    (0.58 + (1 - factors.moisture) * 0.42)
  );
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

const materialZoneScratch = createLandscapeZoneWeights();
const terrainCoverageScratch = createTerrainCoverage();
