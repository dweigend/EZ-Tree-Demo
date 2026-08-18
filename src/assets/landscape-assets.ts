/**
 * Loads and owns the local EZ-Tree landscape assets used by instanced runtime systems.
 * Model transforms are baked once at startup; consumers clone geometry and materials as needed.
 */

import { BufferGeometry, ClampToEdgeWrapping, Mesh, MeshStandardMaterial, Object3D, SRGBColorSpace, Texture, TextureLoader } from 'three';
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
  readonly roughness: readonly [number, number, number, number];
  readonly atlasSize: number;
}

export interface LandscapeAssets {
  readonly ground: GroundTextureAssets;
  readonly grass: InstancedModelAsset;
  readonly flowers: readonly [InstancedModelAsset, InstancedModelAsset, InstancedModelAsset];
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
    const [ground, grass, white, yellow, blue, rock1, rock2, rock3] = await Promise.all([
      loadGroundTextures(),
      loadModel(modelLoader, `${VEGETATION_PATH}/grass.glb`),
      loadModel(modelLoader, `${VEGETATION_PATH}/flower_white.glb`),
      loadModel(modelLoader, `${VEGETATION_PATH}/flower_yellow.glb`),
      loadModel(modelLoader, `${VEGETATION_PATH}/flower_blue.glb`),
      loadModel(modelLoader, `${ROCK_PATH}/rock1.glb`),
      loadModel(modelLoader, `${ROCK_PATH}/rock2.glb`),
      loadModel(modelLoader, `${ROCK_PATH}/rock3.glb`),
    ]);
    return { ground, grass, flowers: [white, yellow, blue], rocks: [rock1, rock2, rock3] };
  } finally {
    dracoLoader.dispose();
  }
}

export function disposeLandscapeAssets(assets: LandscapeAssets): void {
  const textures = new Set<Texture>(Object.values(assets.ground));
  const models = [assets.grass, ...assets.flowers, ...assets.rocks];
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
    loadGroundTexture(loader, `${palettePath}/normal.png`, false),
    loadTerrainPalette(`${TERRAIN_PATH}/palette.json`),
  ]);
  return { albedoAtlas, normalAtlas, roughness: metadata.roughness, atlasSize: metadata.atlasSize[QUALITY_PROFILE.name] };
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
  readonly roughness: readonly [number, number, number, number];
  readonly atlasSize: Readonly<Record<'desktop' | 'pico90', number>>;
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
  return isRoughnessTuple(candidate.roughness) && isAtlasSize(candidate.atlasSize);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isRoughnessTuple(value: unknown): value is TerrainPaletteMetadata['roughness'] {
  if (!Array.isArray(value) || value.length !== 4) return false;
  return value.every((entry) => typeof entry === 'number');
}

function isAtlasSize(value: unknown): value is TerrainPaletteMetadata['atlasSize'] {
  if (!isRecord(value)) return false;
  return value.desktop === 2_048 && value.pico90 === 1_024;
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
