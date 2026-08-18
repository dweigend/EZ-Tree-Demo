/**
 * Shared habitat sampling for the existing landscape distributions and terrain colour.
 * It owns only common ecology fields; concrete placement thresholds remain with their distributions.
 */

import { MathUtils, type Vector4 } from 'three';
import type { HeightField } from '../core/height-field';

export interface LandscapeSurfaceSample {
  x: number;
  z: number;
  height: number;
  slope: number;
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

export function writeLandscapeMaterialWeights(
  heightField: HeightField,
  surface: LandscapeSurfaceSample,
  target: Vector4,
): Vector4 {
  const warpX = (heightField.getNoise01(surface.x * 0.0021 + 73, surface.z * 0.0021 - 31, 2) - 0.5) * 110;
  const warpZ = (heightField.getNoise01(surface.x * 0.0021 - 47, surface.z * 0.0021 + 89, 2) - 0.5) * 110;
  const moisture = getMoisture(heightField, surface.x + warpX, surface.z + warpZ, surface.height);
  const woodland = getWoodland(heightField, surface.x + warpX, surface.z + warpZ);
  const flatness = 1 - MathUtils.smoothstep(surface.slope, 0.08, 0.62);
  const lowland = 1 - MathUtils.smoothstep(surface.height, 35, 125);
  const highland = MathUtils.smoothstep(surface.height, 95, 210);
  const valley = moisture * lowland * flatness;
  const forest = woodland * (0.38 + moisture * 0.62) * flatness;
  const exposed = Math.max(MathUtils.smoothstep(surface.slope, 0.22, 0.72), highland * (1 - moisture * 0.45));
  const meadow = (1 - forest * 0.78) * flatness * (0.42 + moisture * 0.38) * (1 - valley * 0.55);
  return normaliseWeights(target.set(meadow + 0.02, valley + 0.01, forest + 0.01, exposed + 0.01));
}

function normaliseWeights(weights: Vector4): Vector4 {
  const total = weights.x + weights.y + weights.z + weights.w;
  return total > 0 ? weights.multiplyScalar(1 / total) : weights.set(1, 0, 0, 0);
}
