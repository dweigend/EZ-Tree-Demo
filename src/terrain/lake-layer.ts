/**
 * Renders nearby deterministic macro lakes as one bounded instanced mesh.
 * Ecology chooses lake footprints and HeightField owns basin height; reflections and terrain streaming stay outside this layer.
 */

import {
  CircleGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import {
  createMacroFeatureSample,
  type EcologyField,
  type MacroFeatureSample,
} from '../ecology/ecology-field';
import { updateAttributePrefix } from '../rendering/update-instanced-attributes';
import type { HorizontalDirection } from '../world/chunk-coordinates';
import type { HeightField } from './height-field';

const LAKE_CAPACITY = 8;
const MACRO_FEATURE_CELL_SIZE = 800;
const SEARCH_CELL_RADIUS = 2;
const SEARCH_CELL_DIAMETER = SEARCH_CELL_RADIUS * 2 + 1;
const LAKE_SURFACE_OFFSET = 0.04;
const UP = new Vector3(0, 1, 0);

interface LakePlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly priority: number;
}

export class LakeLayer {
  public readonly mesh: InstancedMesh<CircleGeometry, MeshStandardMaterial>;

  public get visibleLakeCount(): number {
    return this.mesh.count;
  }

  private readonly macroFeature = createMacroFeatureSample();
  private readonly transform = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3();

  public constructor(
    private readonly heightField: HeightField,
    private readonly ecologyField: EcologyField,
  ) {
    this.mesh = new InstancedMesh(createLakeGeometry(), createLakeMaterial(), LAKE_CAPACITY);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
  }

  public rebuild(cameraPosition: Vector3, viewDirection?: HorizontalDirection): void {
    const placements = this.collectPlacements(cameraPosition, viewDirection);
    const count = Math.min(placements.length, LAKE_CAPACITY);
    for (let index = 0; index < count; index += 1) {
      this.writePlacement(index, placements[index]!);
    }
    this.mesh.count = count;
    if (count === 0) return;
    updateAttributePrefix(this.mesh.instanceMatrix, count);
    this.mesh.computeBoundingSphere();
  }

  public dispose(): void {
    this.mesh.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }

  private collectPlacements(cameraPosition: Vector3, viewDirection?: HorizontalDirection): LakePlacement[] {
    const centerCellX = Math.floor(cameraPosition.x / MACRO_FEATURE_CELL_SIZE);
    const centerCellZ = Math.floor(cameraPosition.z / MACRO_FEATURE_CELL_SIZE);
    const placements: LakePlacement[] = [];
    const cellCount = SEARCH_CELL_DIAMETER * SEARCH_CELL_DIAMETER;
    for (let index = 0; index < cellCount; index += 1) {
      const offsetX = index % SEARCH_CELL_DIAMETER - SEARCH_CELL_RADIUS;
      const offsetZ = Math.floor(index / SEARCH_CELL_DIAMETER) - SEARCH_CELL_RADIUS;
      const placement = this.sampleCell(centerCellX + offsetX, centerCellZ + offsetZ, cameraPosition, viewDirection);
      if (placement) placements.push(placement);
    }
    return placements.sort((left, right) => left.priority - right.priority);
  }

  private sampleCell(
    cellX: number,
    cellZ: number,
    cameraPosition: Vector3,
    viewDirection?: HorizontalDirection,
  ): LakePlacement | null {
    const sampleX = (cellX + 0.5) * MACRO_FEATURE_CELL_SIZE;
    const sampleZ = (cellZ + 0.5) * MACRO_FEATURE_CELL_SIZE;
    const feature = this.ecologyField.sampleMacroFeature(sampleX, sampleZ, this.macroFeature);
    if (feature.kind !== 'lake') return null;
    return this.createPlacement(feature, cameraPosition, viewDirection);
  }

  private createPlacement(
    feature: MacroFeatureSample,
    cameraPosition: Vector3,
    viewDirection?: HorizontalDirection,
  ): LakePlacement {
    return {
      x: feature.centerX,
      y: this.heightField.getLakeSurfaceHeight(feature) + LAKE_SURFACE_OFFSET,
      z: feature.centerZ,
      rotation: feature.rotation,
      radiusX: feature.length * 0.46,
      radiusZ: feature.length * 0.3,
      priority: getViewPriority(feature, cameraPosition, viewDirection),
    };
  }

  private writePlacement(index: number, placement: LakePlacement): void {
    this.position.set(placement.x, placement.y, placement.z);
    this.rotation.setFromAxisAngle(UP, placement.rotation);
    this.scale.set(placement.radiusX, 1, placement.radiusZ);
    this.transform.compose(this.position, this.rotation, this.scale);
    this.mesh.setMatrixAt(index, this.transform);
  }
}

function getViewPriority(
  feature: MacroFeatureSample,
  cameraPosition: Vector3,
  viewDirection?: HorizontalDirection,
): number {
  const offsetX = feature.centerX - cameraPosition.x;
  const offsetZ = feature.centerZ - cameraPosition.z;
  const distance = Math.hypot(offsetX, offsetZ);
  const directionLength = viewDirection ? Math.hypot(viewDirection.x, viewDirection.z) : 0;
  if (!viewDirection || directionLength === 0) return distance;
  const forwardDistance = (offsetX * viewDirection.x + offsetZ * viewDirection.z) / directionLength;
  return distance - forwardDistance * 0.2;
}

function createLakeGeometry(): CircleGeometry {
  const geometry = new CircleGeometry(1, 28);
  const positions = geometry.getAttribute('position');
  for (let index = 1; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const shorelineVariation = 1 + Math.sin(Math.atan2(y, x) * 5) * 0.055;
    positions.setXY(index, x * shorelineVariation, y * shorelineVariation);
  }
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createLakeMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: '#6f9fa5',
    emissive: '#17383e',
    emissiveIntensity: 0.08,
    metalness: 0,
    roughness: 0.24,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
}
