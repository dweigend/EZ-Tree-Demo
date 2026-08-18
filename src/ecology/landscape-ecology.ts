/**
 * Shared habitat sampling for the existing landscape distributions and terrain colour.
 * It owns only common ecology fields; concrete placement thresholds remain with their distributions.
 */

import { MathUtils } from 'three';
import type { HeightField } from '../core/height-field';

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
