/**
 * Validates and exposes the editable terrain texture catalog shared by atlas generation and runtime zoning.
 * Texture choice, scale, base colour, and zone coverage live in the JSON config; rendering code only consumes it.
 */

import sourceConfig from '../../assets/source/terrain-materials/terrain-textures.config.json';
import type { LandscapeZoneId } from '../ecology/landscape-zones';

export const TERRAIN_SURFACE_IDS = [
  'meadow',
  'mud',
  'dryForest',
  'mossForest',
  'forest',
  'pineForest',
  'rock',
  'trail',
] as const;

export type TerrainSurfaceId = (typeof TERRAIN_SURFACE_IDS)[number];
export type TerrainBaseColor = readonly [number, number, number];

export interface TerrainZoneCoverage {
  readonly surface: Exclude<TerrainSurfaceId, 'trail'>;
  readonly coveragePercent: number;
}

export interface TerrainMaterialConfig {
  readonly slot: TerrainSurfaceId;
  readonly asset: string;
  readonly name: string;
  readonly author: string;
  readonly tileMeters: number;
  readonly maps: Readonly<Record<'basecolor' | 'normal' | 'roughness', string>>;
}

export interface TerrainTextureConfig {
  readonly license: 'CC0-1.0';
  readonly licenseUrl: string;
  readonly baseColors: Readonly<Record<TerrainSurfaceId, TerrainBaseColor>>;
  readonly zones: Readonly<Record<LandscapeZoneId, readonly TerrainZoneCoverage[]>>;
  readonly materials: readonly TerrainMaterialConfig[];
}

validateTerrainTextureConfig(sourceConfig);

export const TERRAIN_TEXTURE_CONFIG = sourceConfig as unknown as TerrainTextureConfig;
export const TERRAIN_ZONE_COVERAGE = TERRAIN_TEXTURE_CONFIG.zones;
export const TERRAIN_TILE_METERS = TERRAIN_TEXTURE_CONFIG.materials.map(
  (material) => material.tileMeters,
) as [number, number, number, number, number, number, number, number];

function validateTerrainTextureConfig(value: unknown): asserts value is TerrainTextureConfig {
  if (!isRecord(value)) throw new Error('Terrain texture config must be an object.');
  validateMaterials(value.materials);
  validateBaseColors(value.baseColors);
  validateZones(value.zones);
}

function validateMaterials(value: unknown): void {
  if (!Array.isArray(value) || value.length !== TERRAIN_SURFACE_IDS.length) {
    throw new Error('Terrain texture config must define eight ordered materials.');
  }
  value.forEach((material, index) => {
    if (!isRecord(material) || material.slot !== TERRAIN_SURFACE_IDS[index]) {
      throw new Error(`Terrain texture slot ${index} is invalid.`);
    }
  });
}

function validateBaseColors(value: unknown): void {
  if (!isRecord(value)) throw new Error('Terrain base colours are missing.');
  for (const surface of TERRAIN_SURFACE_IDS) {
    const color = value[surface];
    if (!Array.isArray(color) || color.length !== 3 || color.some((entry) => !isUnitNumber(entry))) {
      throw new Error(`Terrain base colour ${surface} is invalid.`);
    }
  }
}

function validateZones(value: unknown): void {
  if (!isRecord(value)) throw new Error('Terrain zone coverage is missing.');
  for (const [zone, coverage] of Object.entries(value)) validateZoneCoverage(zone, coverage);
}

function validateZoneCoverage(zone: string, value: unknown): void {
  if (!Array.isArray(value)) throw new Error(`Terrain zone ${zone} must be an array.`);
  const total = value.reduce((sum, entry) => {
    if (!isRecord(entry) || entry.surface === 'trail' || typeof entry.coveragePercent !== 'number') {
      throw new Error(`Terrain zone ${zone} contains an invalid surface.`);
    }
    return sum + entry.coveragePercent;
  }, 0);
  if (Math.abs(total - 100) > 0.001) throw new Error(`Terrain zone ${zone} must total 100 percent.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isUnitNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
