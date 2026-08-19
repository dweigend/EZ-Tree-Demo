/**
 * Loads and owns the local EZ-Tree landscape assets used by instanced runtime systems.
 * Model transforms are baked once at startup; consumers clone geometry and materials as needed.
 */

import {
  BufferGeometry,
  ClampToEdgeWrapping,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { QUALITY_PROFILE } from '../config';
import { TERRAIN_TILE_METERS } from '../terrain/terrain-texture-config';
import {
  getRequiredBarkTextureRequests,
  type TreeBarkMaps,
  type TreeBarkTextureRequest,
  type TreeTextureAssets,
} from '../trees/tree-textures';
import type { TreeSpecies } from '../trees/tree-templates';
import { LANDSCAPE_ASSET_CATALOG } from './landscape-asset-catalog';

export interface InstancedModelAsset {
  readonly geometry: BufferGeometry;
  readonly materials: readonly MeshStandardMaterial[];
}

export interface GroundTextureAssets {
  readonly albedoAtlas: Texture;
  readonly surfaceAtlas: Texture;
  readonly tileMeters: TerrainLayerValues;
  readonly atlasSize: number;
  readonly parallaxMeters: number;
}

export type TerrainLayerValues = readonly [number, number, number, number, number, number, number, number];

export interface LandscapeAssets {
  readonly ground: GroundTextureAssets;
  readonly trees: TreeTextureAssets;
  readonly meadowPatch: InstancedModelAsset;
  readonly grassTuft: InstancedModelAsset;
  readonly rocks: readonly [InstancedModelAsset, InstancedModelAsset, InstancedModelAsset];
}

interface ModelPart {
  readonly geometry: BufferGeometry;
  readonly material: MeshStandardMaterial;
}

export async function loadLandscapeAssets(): Promise<LandscapeAssets> {
  const modelLoader = new GLTFLoader();
  const models = LANDSCAPE_ASSET_CATALOG.models;
  const [ground, trees, meadowPatch, grassTuft, rock1, rock2, rock3] = await Promise.all([
    loadGroundTextures(),
    loadTreeTextures(),
    loadModel(modelLoader, models.meadowPatch),
    loadModel(modelLoader, models.grassTuft),
    loadModel(modelLoader, models.rocks[0]),
    loadModel(modelLoader, models.rocks[1]),
    loadModel(modelLoader, models.rocks[2]),
  ]);
  return { ground, trees, meadowPatch, grassTuft, rocks: [rock1, rock2, rock3] };
}

export function disposeLandscapeAssets(assets: LandscapeAssets): void {
  const textures = new Set<Texture>([assets.ground.albedoAtlas, assets.ground.surfaceAtlas]);
  for (const maps of assets.trees.bark.values()) textures.add(maps.color).add(maps.normal).add(maps.roughness);
  for (const texture of Object.values(assets.trees.leaves)) textures.add(texture);
  const models = [assets.meadowPatch, assets.grassTuft, ...assets.rocks];
  for (const model of models) {
    model.geometry.dispose();
    for (const material of model.materials) {
      collectMaterialTextures(material, textures);
      material.dispose();
    }
  }
  textures.forEach((texture) => texture.dispose());
}

async function loadGroundTextures(): Promise<GroundTextureAssets> {
  const loader = new TextureLoader();
  const atlas = LANDSCAPE_ASSET_CATALOG.terrain[QUALITY_PROFILE.name];
  const [albedoAtlas, surfaceAtlas] = await Promise.all([
    loadGroundTexture(loader, atlas.albedo, true),
    loadGroundTexture(loader, atlas.surface, false),
  ]);
  return {
    albedoAtlas,
    surfaceAtlas,
    tileMeters: TERRAIN_TILE_METERS,
    atlasSize: atlas.atlasSize,
    parallaxMeters: atlas.parallaxMeters,
  };
}

async function loadTreeTextures(): Promise<TreeTextureAssets> {
  const loader = new TextureLoader();
  const barkEntries = await Promise.all(
    getRequiredBarkTextureRequests().map(async (request) => [request.key, await loadBarkMaps(loader, request)] as const),
  );
  const leafEntries = await Promise.all(
    (['ash', 'aspen', 'oak', 'pine'] as const).map(async (species) => {
      const texture = await loadTreeTexture(loader, LANDSCAPE_ASSET_CATALOG.trees.leaves[species], true, true);
      return [species, texture] as const;
    }),
  );
  return {
    bark: new Map(barkEntries),
    leaves: Object.fromEntries(leafEntries) as Record<TreeSpecies, Texture>,
  };
}

async function loadBarkMaps(loader: TextureLoader, request: TreeBarkTextureRequest): Promise<TreeBarkMaps> {
  const asset = LANDSCAPE_ASSET_CATALOG.trees.bark[request.type];
  const [color, normal, roughness] = await Promise.all([
    loadTreeTexture(loader, asset.albedo, true),
    loadTreeTexture(loader, asset.normal, false),
    loadTreeTexture(loader, asset.roughness, false),
  ]);
  return { color, normal, roughness };
}

async function loadTreeTexture(
  loader: TextureLoader,
  url: string,
  colorTexture: boolean,
  premultiplyAlpha = false,
): Promise<Texture> {
  const texture = await loader.loadAsync(url);
  texture.anisotropy = 4;
  texture.premultiplyAlpha = premultiplyAlpha;
  if (colorTexture) texture.colorSpace = SRGBColorSpace;
  return texture;
}

async function loadGroundTexture(loader: TextureLoader, url: string, colorTexture: boolean): Promise<Texture> {
  const texture = await loader.loadAsync(url);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = 4;
  if (colorTexture) texture.colorSpace = SRGBColorSpace;
  return texture;
}

async function loadModel(loader: GLTFLoader, url: string): Promise<InstancedModelAsset> {
  const gltf = await loader.loadAsync(url);
  const parts = collectModelParts(gltf.scene);
  if (parts.length === 0) throw new Error(`Landscape asset contains no mesh: ${url}`);
  return mergeModelParts(parts, url);
}

function collectModelParts(root: Object3D): ModelPart[] {
  const parts: ModelPart[] = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (Array.isArray(object.material)) throw new Error(`Unsupported material array in ${object.name}.`);
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    parts.push({ geometry, material: requireStandardMaterial(object.material, object.name).clone() });
  });
  return parts;
}

function mergeModelParts(parts: readonly ModelPart[], url: string): InstancedModelAsset {
  if (parts.length === 1) return { geometry: parts[0]!.geometry, materials: [parts[0]!.material] };
  const geometry = mergeGeometries(parts.map((part) => part.geometry), true);
  if (!geometry) throw new Error(`Landscape asset primitives are incompatible: ${url}`);
  parts.forEach((part) => part.geometry.dispose());
  return { geometry, materials: parts.map((part) => part.material) };
}

function requireStandardMaterial(material: unknown, name: string): MeshStandardMaterial {
  if (!(material instanceof MeshStandardMaterial)) throw new Error(`Unsupported material in landscape asset: ${name}`);
  return material;
}

function collectMaterialTextures(material: MeshStandardMaterial, textures: Set<Texture>): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
}
