/**
 * Loads and owns the local EZ-Tree landscape assets used by instanced runtime systems.
 * Model transforms are baked once at startup; consumers clone geometry and materials as needed.
 */

import { BufferGeometry, Mesh, MeshStandardMaterial, Object3D, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface InstancedModelAsset {
  readonly geometry: BufferGeometry;
  readonly materials: readonly MeshStandardMaterial[];
}

export interface GroundTextureAssets {
  readonly grass: Texture;
  readonly dirtColor: Texture;
  readonly dirtNormal: Texture;
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
  const [grass, dirtColor, dirtNormal] = await Promise.all([
    loadGroundTexture(loader, `${TERRAIN_PATH}/grass.jpg`, true),
    loadGroundTexture(loader, `${TERRAIN_PATH}/dirt_color.jpg`, true),
    loadGroundTexture(loader, `${TERRAIN_PATH}/dirt_normal.jpg`, false),
  ]);
  return { grass, dirtColor, dirtNormal };
}

async function loadGroundTexture(loader: TextureLoader, url: string, colorTexture: boolean): Promise<Texture> {
  const texture = await loader.loadAsync(url);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
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
