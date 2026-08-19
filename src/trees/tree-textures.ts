/**
 * Connects current EZ-Tree preset texture identifiers to locally loaded PBR maps.
 * Geometry generation stays serializable; texture objects are attached only on the main thread.
 */

import type { Texture } from 'three';
import {
  TREE_PRESET_CATALOG,
  type BarkTextureId,
  type TreePresetData,
  type TreeSpecies,
} from './tree-templates';

export interface TreeBarkMaps {
  readonly color: Texture;
  readonly normal: Texture;
  readonly roughness: Texture;
}

export interface TreeTextureAssets {
  readonly bark: ReadonlyMap<string, TreeBarkMaps>;
  readonly leaves: Readonly<Record<TreeSpecies, Texture>>;
}

export interface TreeBarkTextureRequest {
  readonly key: string;
  readonly type: BarkTextureId;
  readonly scale: TreePresetData['bark']['textureScale'];
}

export function getRequiredBarkTextureRequests(): readonly TreeBarkTextureRequest[] {
  const requests = new Map<string, TreeBarkTextureRequest>();
  for (const template of TREE_PRESET_CATALOG) {
    const { type, textureScale } = template.preset.bark;
    const key = getBarkTextureKey(type, textureScale);
    requests.set(key, { key, type, scale: textureScale });
  }
  return [...requests.values()];
}

export function getBarkMaps(assets: TreeTextureAssets, preset: TreePresetData): TreeBarkMaps {
  const key = getBarkTextureKey(preset.bark.type, preset.bark.textureScale);
  const maps = assets.bark.get(key);
  if (!maps) throw new Error(`Missing EZ-Tree bark texture set: ${key}`);
  return maps;
}

function getBarkTextureKey(type: BarkTextureId, scale: TreePresetData['bark']['textureScale']): string {
  return `${type}:${scale.x}:${scale.y}`;
}
