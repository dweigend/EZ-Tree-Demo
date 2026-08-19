/**
 * Defines every shipped landscape asset URL and the shared terrain atlas.
 * Source material choices stay in terrain-texture-config; this catalog only owns runtime files.
 */

import type { BarkTextureId, TreeSpecies } from '../trees/tree-templates';

export interface TerrainAtlasAsset {
  readonly albedo: string;
  readonly surface: string;
  readonly atlasSize: number;
}

interface TreeMapAsset {
  readonly albedo: string;
  readonly normal: string;
  readonly roughness: string;
}

interface LandscapeAssetCatalog {
  readonly terrain: TerrainAtlasAsset;
  readonly trees: {
    readonly bark: Readonly<Record<BarkTextureId, TreeMapAsset>>;
    readonly leaves: Readonly<Record<TreeSpecies, string>>;
  };
  readonly models: {
    readonly meadowPatch: string;
    readonly grassTuft: string;
    readonly rocks: readonly [string, string, string];
  };
}

const ASSET_ROOT = '/assets/landscape';

export const LANDSCAPE_ASSET_CATALOG = {
  terrain: {
    albedo: `${ASSET_ROOT}/terrain/albedo.webp`,
    surface: `${ASSET_ROOT}/terrain/surface.webp`,
    atlasSize: 1_536,
  },
  trees: {
    bark: {
      Bark001: createTreeMapAsset('bark/bark-001'),
      Bark002: createTreeMapAsset('bark/bark-002'),
      Bark003: createTreeMapAsset('bark/bark-003'),
    },
    leaves: {
      ash: `${ASSET_ROOT}/trees/leaves/ash-albedo-alpha.png`,
      aspen: `${ASSET_ROOT}/trees/leaves/aspen-albedo-alpha.png`,
      oak: `${ASSET_ROOT}/trees/leaves/oak-albedo-alpha.png`,
      pine: `${ASSET_ROOT}/trees/leaves/pine-albedo-alpha.png`,
    },
  },
  models: {
    meadowPatch: `${ASSET_ROOT}/models/meadow-patch.glb`,
    grassTuft: `${ASSET_ROOT}/models/grass-tuft.glb`,
    rocks: [
      `${ASSET_ROOT}/models/rock-medium-a.glb`,
      `${ASSET_ROOT}/models/rock-small.glb`,
      `${ASSET_ROOT}/models/rock-medium-b.glb`,
    ],
  },
} as const satisfies LandscapeAssetCatalog;

function createTreeMapAsset(directory: string): TreeMapAsset {
  const root = `${ASSET_ROOT}/trees/${directory}`;
  return {
    albedo: `${root}/albedo.jpg`,
    normal: `${root}/normal-gl.jpg`,
    roughness: `${root}/roughness.jpg`,
  };
}
