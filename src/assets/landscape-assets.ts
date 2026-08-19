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
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { QUALITY_PROFILE } from '../config';

export interface InstancedModelAsset {
  readonly geometry: BufferGeometry;
  readonly materials: readonly MeshStandardMaterial[];
}

export interface GroundTextureAssets {
  readonly albedoAtlas: Texture;
  readonly normalAtlas: Texture;
  readonly tileMeters: TerrainLayerValues;
  readonly atlasSize: number;
}

export type TerrainLayerValues = readonly [number, number, number, number, number, number, number, number];

export interface LandscapeAssets {
  readonly ground: GroundTextureAssets;
  readonly meadowPatch: InstancedModelAsset;
  readonly grassTuft: InstancedModelAsset;
  readonly rocks: readonly [InstancedModelAsset, InstancedModelAsset, InstancedModelAsset];
}

interface ModelPart {
  readonly geometry: BufferGeometry;
  readonly material: MeshStandardMaterial;
}

const VEGETATION_PATH = '/assets/vegetation';
const ROCK_PATH = '/assets/rocks';
const TERRAIN_PATH = '/assets/terrain';

export async function loadLandscapeAssets(): Promise<LandscapeAssets> {
  const dracoLoader = new DRACOLoader().setDecoderPath('/assets/draco/');
  const modelLoader = new GLTFLoader().setDRACOLoader(dracoLoader);
  try {
    const [ground, meadowPatch, grassTuft, rock1, rock2, rock3] = await Promise.all([
      loadGroundTextures(),
      loadModel(modelLoader, `${VEGETATION_PATH}/grass-patch.glb`),
      loadModel(modelLoader, `${VEGETATION_PATH}/grass-tuft.glb`),
      loadModel(modelLoader, `${ROCK_PATH}/rock1.glb`),
      loadModel(modelLoader, `${ROCK_PATH}/rock2.glb`),
      loadModel(modelLoader, `${ROCK_PATH}/rock3.glb`),
    ]);
    return { ground, meadowPatch, grassTuft, rocks: [rock1, rock2, rock3] };
  } finally {
    dracoLoader.dispose();
  }
}

export function disposeLandscapeAssets(assets: LandscapeAssets): void {
  const textures = new Set<Texture>([assets.ground.albedoAtlas, assets.ground.normalAtlas]);
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
  const paletteName = QUALITY_PROFILE.name === 'pico90' ? 'palette-pico' : 'palette-desktop';
  const palettePath = `${TERRAIN_PATH}/${paletteName}`;
  const [albedoAtlas, normalAtlas, metadata] = await Promise.all([
    loadGroundTexture(loader, `${palettePath}/albedo.webp`, true),
    loadGroundTexture(loader, `${palettePath}/normal.webp`, false),
    loadTerrainPalette(`${TERRAIN_PATH}/palette.json`),
  ]);
  return {
    albedoAtlas,
    normalAtlas,
    tileMeters: metadata.tileMeters,
    atlasSize: metadata.atlasSize[QUALITY_PROFILE.name],
  };
}

async function loadGroundTexture(loader: TextureLoader, url: string, colorTexture: boolean): Promise<Texture> {
  const texture = await loader.loadAsync(url);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = 4;
  if (colorTexture) texture.colorSpace = SRGBColorSpace;
  return texture;
}

interface TerrainPaletteMetadata {
  readonly tileMeters: TerrainLayerValues;
  readonly atlasColumns: 3;
  readonly atlasSize: Readonly<Record<'desktop' | 'pico90', number>>;
  readonly surfaceEncoding: 'normal-rgb-roughness-a';
}

async function loadTerrainPalette(url: string): Promise<TerrainPaletteMetadata> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load terrain palette metadata: ${response.status}`);
  const value: unknown = await response.json();
  if (!isTerrainPaletteMetadata(value)) throw new Error('Terrain palette metadata is invalid.');
  return value;
}

function isTerrainPaletteMetadata(value: unknown): value is TerrainPaletteMetadata {
  if (!isRecord(value)) return false;
  const candidate = value as Partial<TerrainPaletteMetadata>;
  return (
    isTerrainLayerValues(candidate.tileMeters) &&
    candidate.atlasColumns === 3 &&
    candidate.surfaceEncoding === 'normal-rgb-roughness-a' &&
    isAtlasSize(candidate.atlasSize)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isTerrainLayerValues(value: unknown): value is TerrainLayerValues {
  if (!Array.isArray(value) || value.length !== 8) return false;
  return value.every((entry) => typeof entry === 'number');
}

function isAtlasSize(value: unknown): value is TerrainPaletteMetadata['atlasSize'] {
  if (!isRecord(value)) return false;
  return value.desktop === 3_072 && value.pico90 === 1_536;
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
