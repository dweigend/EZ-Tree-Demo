/**
 * Samples continuous landscape zones shared by terrain, trees, hedges, and ground cover.
 * It owns ecological affinities only; each consumer keeps its own placement and rendering policy.
 */

import { MathUtils, type Vector4 } from 'three';
import type { HeightField } from '../core/height-field';

export interface LandscapeSurfaceSample {
  x: number;
  z: number;
  height: number;
  slope: number;
}

export interface LandscapeZoneWeights {
  meadow: number;
  wetLowland: number;
  dryBroadleaf: number;
  moistBroadleaf: number;
  coniferHighland: number;
  rockyRidge: number;
}

export interface LandscapeMaterialWeights {
  readonly first: Vector4;
  readonly second: Vector4;
}

export function createLandscapeZoneWeights(): LandscapeZoneWeights {
  return { meadow: 0, wetLowland: 0, dryBroadleaf: 0, moistBroadleaf: 0, coniferHighland: 0, rockyRidge: 0 };
}

export function getMoisture(heightField: HeightField, x: number, z: number, height: number): number {
  const broad = heightField.getNoise01(x * 0.0011 + 81, z * 0.0011 - 57, 3);
  const drainage = 1 - MathUtils.smoothstep(height, 92, 205);
  return MathUtils.clamp(broad * 0.72 + drainage * 0.28, 0, 1);
}

export function getGroundCover(heightField: HeightField, x: number, z: number, height: number): number {
  const moisture = getMoisture(heightField, x, z, height);
  const meadow = heightField.getNoise01((x - 210) * 0.0052, (z + 80) * 0.0052, 2);
  return MathUtils.clamp(meadow * 0.66 + moisture * 0.34, 0, 1);
}

export function getWoodland(heightField: HeightField, x: number, z: number): number {
  return heightField.getNoise01((x + 240) * 0.00185, (z - 170) * 0.00185, 3);
}

export function writeLandscapeZoneWeights(
  heightField: HeightField,
  surface: LandscapeSurfaceSample,
  target: LandscapeZoneWeights,
): LandscapeZoneWeights {
  const warped = getWarpedEcologySample(heightField, surface);
  const flatness = 1 - MathUtils.smoothstep(surface.slope, 0.08, 0.62);
  const lowland = 1 - MathUtils.smoothstep(surface.height, 35, 125);
  const highland = MathUtils.smoothstep(surface.height, 72, 190);
  const slopeRock = MathUtils.smoothstep(surface.slope, 0.18, 0.62);
  const rockyRidge = Math.max(slopeRock, highland * (1 - warped.moisture * 0.42));
  const wetLowland = MathUtils.smoothstep(warped.moisture * lowland, 0.44, 0.78) * flatness;
  const forest = MathUtils.smoothstep(warped.woodland, 0.38, 0.8) * flatness * (1 - rockyRidge * 0.8);
  const broadleaf = forest * (1 - highland * 0.72) * (1 - wetLowland * 0.35);
  const conifer = MathUtils.smoothstep(warped.woodland, 0.34, 0.72)
    * highland
    * (0.35 + flatness * 0.65)
    * (1 - slopeRock * 0.55)
    * (0.58 + (1 - warped.moisture) * 0.42);

  target.rockyRidge = rockyRidge + 0.005;
  target.wetLowland = wetLowland * (1 - rockyRidge * 0.7) + 0.005;
  target.coniferHighland = conifer + 0.005;
  target.moistBroadleaf = broadleaf * warped.moisture + 0.005;
  target.dryBroadleaf = broadleaf * (1 - warped.moisture) + 0.005;
  target.meadow = (1 - forest * 0.92) * flatness * (1 - rockyRidge * 0.86) * (1 - wetLowland * 0.7) + 0.01;
  return normaliseZones(target);
}

export function writeLandscapeMaterialWeights(
  heightField: HeightField,
  surface: LandscapeSurfaceSample,
  target: LandscapeMaterialWeights,
): LandscapeMaterialWeights {
  const zones = writeLandscapeZoneWeights(heightField, surface, materialZoneScratch);
  const trail = getTrailEnvelope(surface) * (1 - zones.wetLowland * 0.55) * (1 - zones.rockyRidge * 0.38) * 0.95;
  target.first.set(
    zones.meadow * 0.72 + 0.005,
    zones.wetLowland * 0.72,
    zones.dryBroadleaf * 0.68,
    zones.moistBroadleaf * 0.7 + zones.wetLowland * 0.15,
  );
  target.second.set(
    zones.meadow * 0.28 + zones.wetLowland * 0.13 + zones.dryBroadleaf * 0.32 + zones.moistBroadleaf * 0.3,
    zones.coniferHighland * 0.82,
    zones.rockyRidge * 0.9 + zones.coniferHighland * 0.18,
    trail,
  );
  return normaliseMaterials(target);
}

export function getTrailEnvelope(surface: LandscapeSurfaceSample): number {
  const along = surface.x * 0.72 + surface.z * 0.69;
  const across = surface.x * -0.69 + surface.z * 0.72;
  const warp = Math.sin(across * 0.011 + 0.7) * 38 + Math.sin(across * 0.027 - 1.1) * 14;
  const spacing = 310;
  const repeated = ((along + warp + spacing * 0.5) % spacing + spacing) % spacing;
  const distance = Math.abs(repeated - spacing * 0.5);
  const path = 1 - MathUtils.smoothstep(distance, 3, 28);
  return path * (1 - MathUtils.smoothstep(surface.slope, 0.18, 0.58));
}

function getWarpedEcologySample(
  heightField: HeightField,
  surface: LandscapeSurfaceSample,
): { readonly moisture: number; readonly woodland: number } {
  const warpX = (heightField.getNoise01(surface.x * 0.0021 + 73, surface.z * 0.0021 - 31, 2) - 0.5) * 110;
  const warpZ = (heightField.getNoise01(surface.x * 0.0021 - 47, surface.z * 0.0021 + 89, 2) - 0.5) * 110;
  return {
    moisture: getMoisture(heightField, surface.x + warpX, surface.z + warpZ, surface.height),
    woodland: getWoodland(heightField, surface.x + warpX, surface.z + warpZ),
  };
}

function normaliseZones(weights: LandscapeZoneWeights): LandscapeZoneWeights {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return Object.assign(weights, createLandscapeZoneWeights(), { meadow: 1 });
  for (const key of Object.keys(weights) as (keyof LandscapeZoneWeights)[]) weights[key] /= total;
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

const materialZoneScratch = createLandscapeZoneWeights();
