/**
 * Verifies the typed runtime catalog and the eight local Poly Haven terrain material sources.
 */

import { expect, test } from 'bun:test';
import { LANDSCAPE_ASSET_CATALOG } from '../src/assets/landscape-asset-catalog';
import { TERRAIN_TEXTURE_CONFIG, TERRAIN_TILE_METERS } from '../src/terrain/terrain-texture-config';

test('terrain config maps eight ordered slots to complete local PBR sources', async () => {
  expect(TERRAIN_TEXTURE_CONFIG.materials.map(({ slot }) => slot)).toEqual([
    'meadow',
    'mud',
    'dryForest',
    'mossForest',
    'forest',
    'pineForest',
    'rock',
    'trail',
  ]);
  expect(TERRAIN_TILE_METERS).toHaveLength(8);
  for (const material of TERRAIN_TEXTURE_CONFIG.materials) {
    expect(Object.keys(material.maps).sort()).toEqual(['basecolor', 'height', 'normal', 'roughness']);
    for (const mapName of ['basecolor', 'normal', 'height', 'roughness'] as const) {
      const localMap = `assets/source/landscape/terrain-materials/polyhaven/${material.asset}/${getFilename(mapName)}`;
      expect(await Bun.file(localMap).exists()).toBe(true);
      expect(material.maps[mapName]).toStartWith('https://dl.polyhaven.org/');
    }
  }
});

test('runtime catalog owns one shared terrain atlas without palette metadata fetches', async () => {
  expect(LANDSCAPE_ASSET_CATALOG.terrain).toEqual({
    albedo: '/assets/landscape/terrain/albedo.webp',
    surface: '/assets/landscape/terrain/surface.webp',
    atlasSize: 1536,
  });
  expect(await Bun.file(toPublicPath(LANDSCAPE_ASSET_CATALOG.terrain.albedo)).exists()).toBe(true);
  expect(await Bun.file(toPublicPath(LANDSCAPE_ASSET_CATALOG.terrain.surface)).exists()).toBe(true);
  expect(await Bun.file('public/assets/landscape/terrain/desktop/albedo.webp').exists()).toBe(false);
  expect(await Bun.file('public/assets/landscape/terrain/pico90/albedo.webp').exists()).toBe(false);
  expect(await Bun.file('public/assets/landscape/terrain/palette.json').exists()).toBe(false);
});

test('zone palette keeps habitat identities visually distinct', () => {
  expect(TERRAIN_TEXTURE_CONFIG.zones.meadow).toEqual([
    { surface: 'meadow', coveragePercent: 96 },
    { surface: 'forest', coveragePercent: 4 },
  ]);
  expect(TERRAIN_TEXTURE_CONFIG.zones.wetLowland).toContainEqual({ surface: 'mud', coveragePercent: 50 });
  expect(TERRAIN_TEXTURE_CONFIG.baseColors.meadow[1]).toBeGreaterThan(
    TERRAIN_TEXTURE_CONFIG.baseColors.mud[1] * 3,
  );
});

function getFilename(mapName: 'basecolor' | 'normal' | 'height' | 'roughness'): string {
  return mapName === 'height' ? 'height.jpg' : `${mapName}.jpg`;
}

function toPublicPath(url: string): string {
  return `public${url}`;
}
