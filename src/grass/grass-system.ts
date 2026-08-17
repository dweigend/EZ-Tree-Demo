/**
 * Camera-bounded instanced grass field with GPU blade bending.
 * Stable world-grid sampling prevents swimming while distance thinning keeps one draw call bounded.
 */

import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshPhongMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { VEGETATION } from '../config';
import type { InstancedModelAsset } from '../assets/landscape-assets';
import { hashCoordinates, signedRandom, unitRandom } from '../core/random';
import type { HeightField } from '../terrain/height-field';
import type { WindUniforms } from '../wind/wind-field';
import { WIND_NOISE_GLSL } from '../wind/shader-chunks';

const GRASS_DARK = new Color('#b1c08d');
const GRASS_LIGHT = new Color('#ded39a');
const IDENTITY_ROTATION = new Quaternion();
const GRASS_CANDIDATES_PER_FRAME = 800;

interface GrassBuildJob {
  readonly target: Vector3;
  readonly minX: number;
  readonly maxX: number;
  readonly maxZ: number;
  currentX: number;
  currentZ: number;
  count: number;
}

export class GrassSystem {
  public readonly mesh: InstancedMesh<BufferGeometry, MeshPhongMaterial>;
  public visibleBladeCount = 0;
  private readonly rotation: InstancedBufferAttribute;
  private readonly phase: InstancedBufferAttribute;
  private readonly strength: InstancedBufferAttribute;
  private readonly lastAnchor = new Vector3(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
  private readonly transform = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly color = new Color();
  private buildJob: GrassBuildJob | null = null;

  public constructor(
    private readonly heightField: HeightField,
    private readonly seed: number,
    wind: WindUniforms,
    asset: InstancedModelAsset,
  ) {
    const geometry = asset.geometry.clone();
    this.rotation = new InstancedBufferAttribute(new Float32Array(VEGETATION.grassCapacity), 1);
    this.phase = new InstancedBufferAttribute(new Float32Array(VEGETATION.grassCapacity), 1);
    this.strength = new InstancedBufferAttribute(new Float32Array(VEGETATION.grassCapacity), 1);
    this.rotation.setUsage(DynamicDrawUsage);
    this.phase.setUsage(DynamicDrawUsage);
    this.strength.setUsage(DynamicDrawUsage);
    geometry.setAttribute('aRotation', this.rotation);
    geometry.setAttribute('aWindPhase', this.phase);
    geometry.setAttribute('aWindStrength', this.strength);
    const sourceMaterial = asset.materials[0];
    if (!sourceMaterial) throw new Error('Grass asset has no material.');
    this.mesh = new InstancedMesh(geometry, createGrassMaterial(sourceMaterial, wind), VEGETATION.grassCapacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.receiveShadow = true;
  }

  public update(cameraPosition: Vector3): void {
    const distance = Math.hypot(cameraPosition.x - this.lastAnchor.x, cameraPosition.z - this.lastAnchor.z);
    if (!this.buildJob && distance >= VEGETATION.grassRefreshDistance) this.startBuild(cameraPosition);
    this.processBuildJob();
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }

  private startBuild(cameraPosition: Vector3): void {
    const radiusInCells = Math.ceil(VEGETATION.grassRadius / VEGETATION.grassSpacing);
    const centerX = Math.round(cameraPosition.x / VEGETATION.grassSpacing);
    const centerZ = Math.round(cameraPosition.z / VEGETATION.grassSpacing);
    this.buildJob = {
      target: new Vector3(cameraPosition.x, 0, cameraPosition.z),
      minX: centerX - radiusInCells,
      maxX: centerX + radiusInCells,
      currentX: centerX - radiusInCells,
      currentZ: centerZ - radiusInCells,
      maxZ: centerZ + radiusInCells,
      count: 0,
    };
  }

  private processBuildJob(): void {
    const job = this.buildJob;
    if (!job) return;
    for (let processed = 0; processed < GRASS_CANDIDATES_PER_FRAME; processed += 1) {
      if (job.currentZ > job.maxZ || job.count >= VEGETATION.grassCapacity) {
        this.completeBuild(job);
        return;
      }
      if (this.tryAddBlade(job.currentX, job.currentZ, job.target, job.count)) job.count += 1;
      job.currentX += 1;
      if (job.currentX <= job.maxX) continue;
      job.currentX = job.minX;
      job.currentZ += 1;
    }
  }

  private completeBuild(job: GrassBuildJob): void {
    this.visibleBladeCount = job.count;
    this.lastAnchor.copy(job.target);
    this.buildJob = null;
    this.finaliseBuffers();
  }

  private tryAddBlade(cellX: number, cellZ: number, cameraPosition: Vector3, index: number): boolean {
    const hash = hashCoordinates(this.seed, cellX, cellZ);
    const worldX = (cellX + signedRandom(hashCoordinates(hash, 3, 7)) * 0.42) * VEGETATION.grassSpacing;
    const worldZ = (cellZ + signedRandom(hashCoordinates(hash, 11, 13)) * 0.42) * VEGETATION.grassSpacing;
    const distance = Math.hypot(worldX - cameraPosition.x, worldZ - cameraPosition.z);
    const height = this.getAcceptedHeight(worldX, worldZ, distance, hash);
    if (height === null) return false;
    this.writeBlade(index, worldX, worldZ, height, hash);
    return true;
  }

  private getAcceptedHeight(x: number, z: number, distance: number, hash: number): number | null {
    if (distance > VEGETATION.grassRadius) return null;
    const height = this.heightField.getHeight(x, z);
    if (height > 205 || height < -38 || this.heightField.getSlope(x, z) > 0.82) return null;
    const distanceRatio = distance / VEGETATION.grassRadius;
    const distanceKeep = distanceRatio < 0.62 ? 1 : Math.max(0.08, 1 - (distanceRatio - 0.62) / 0.38);
    const moisture = this.heightField.getMoisture(x, z, height);
    const ecology = 0.12 + this.heightField.getGroundCover(x, z, moisture) * 0.88;
    return unitRandom(hashCoordinates(hash, 17, 19)) < ecology * distanceKeep ? height : null;
  }

  private writeBlade(index: number, x: number, z: number, y: number, hash: number): void {
    const height = 0.9 + unitRandom(hashCoordinates(hash, 23, 29)) * 0.5;
    const width = 0.42 + unitRandom(hashCoordinates(hash, 31, 37)) * 0.24;
    this.position.set(x, y - 0.03, z);
    this.scale.set(width, height, width);
    this.transform.compose(this.position, IDENTITY_ROTATION, this.scale);
    this.mesh.setMatrixAt(index, this.transform);
    this.rotation.setX(index, unitRandom(hashCoordinates(hash, 41, 43)) * Math.PI * 2);
    this.phase.setX(index, unitRandom(hashCoordinates(hash, 47, 53)) * Math.PI * 2);
    this.strength.setX(index, 0.72 + unitRandom(hashCoordinates(hash, 59, 61)) * 0.5);
    this.color.copy(GRASS_DARK).lerp(GRASS_LIGHT, unitRandom(hashCoordinates(hash, 67, 71)));
    this.mesh.setColorAt(index, this.color);
  }

  private finaliseBuffers(): void {
    this.mesh.count = this.visibleBladeCount;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor && (this.mesh.instanceColor.needsUpdate = true);
    this.rotation.needsUpdate = true;
    this.phase.needsUpdate = true;
    this.strength.needsUpdate = true;
    if (this.visibleBladeCount > 0) this.mesh.computeBoundingSphere();
  }
}

function createGrassMaterial(source: MeshStandardMaterial, wind: WindUniforms): MeshPhongMaterial {
  const material = new MeshPhongMaterial({
    map: source.map,
    color: '#dce7b8',
    emissive: '#42673b',
    emissiveIntensity: 0.15,
    alphaTest: 0.45,
    shininess: 1,
    side: DoubleSide,
    vertexColors: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.time;
    shader.uniforms.uGlobalWindDirection = wind.direction;
    shader.uniforms.uGlobalWindAmplitude = wind.amplitude;
    shader.uniforms.uGlobalGust = wind.gust;
    shader.uniforms.uGlobalWindScale = wind.spatialScale;
    shader.vertexShader = `${grassDeclarations}\n${WIND_NOISE_GLSL}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', grassBendShader);
  };
  material.customProgramCacheKey = () => 'endless-wilds-grass-v1';
  return material;
}

const grassDeclarations = /* glsl */ `
attribute float aRotation;
attribute float aWindPhase;
attribute float aWindStrength;
uniform float uTime;
uniform vec2 uGlobalWindDirection;
uniform float uGlobalWindAmplitude;
uniform float uGlobalGust;
uniform float uGlobalWindScale;
`;

const grassBendShader = /* glsl */ `
vec3 transformed = vec3(position);
float cosine = cos(aRotation);
float sine = sin(aRotation);
transformed.xz = mat2(cosine, -sine, sine, cosine) * transformed.xz;
vec4 bladeRoot = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float heightFactor = uv.y * uv.y;
float spatialPhase = windPhaseAt(bladeRoot.xz, uTime, uGlobalWindScale, uGlobalWindDirection);
float localGust = windGustAt(bladeRoot.xz, uTime, uGlobalWindScale, uGlobalWindDirection);
float wave = 0.62 * sin(uTime * 0.72 + aWindPhase + spatialPhase * 6.2831)
  + 0.25 * sin(uTime * 1.43 + aWindPhase * 1.8)
  + 0.13 * sin(uTime * 2.91 + spatialPhase * 3.7);
transformed.xz += uGlobalWindDirection * wave * heightFactor * aWindStrength
  * uGlobalWindAmplitude * uGlobalGust * localGust * 1.35;
`;
