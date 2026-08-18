/** Verifies deterministic meadow clustering without adding grass draw batches. */

import { describe, expect, test } from 'bun:test';
import { Matrix4, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import type { InstancedModelAsset } from '../assets/landscape-assets';
import { VEGETATION, WORLD_SEED } from '../config';
import { hashString } from '../core/random';
import { EcologyField } from '../ecology/ecology-field';
import { HeightField } from '../terrain/height-field';
import { WindField } from '../wind/wind-field';
import { GrassSystem } from './grass-system';

const CAMERA_POSITION = new Vector3(0, 0, 120);
const BIN_SIZE = 20;
const BUILD_CANDIDATES_PER_FRAME = 800;

interface MeadowMetrics {
  readonly emptyBins: number;
  readonly densestBin: number;
}

describe('GrassSystem', () => {
  test('concentrates fewer blades into dense meadow patches', () => {
    const asset = createGrassAsset();
    const system = new GrassSystem({
      heightField: new HeightField(WORLD_SEED),
      ecologyField: new EcologyField(WORLD_SEED),
      seed: hashString(`${WORLD_SEED}:grass`),
      wind: new WindField().uniforms,
      asset,
    });

    finishBuild(system);
    const metrics = measureMeadowBins(system);

    expect(system.mesh.isInstancedMesh).toBe(true);
    expect(system.visibleBladeCount).toBeGreaterThan(6_000);
    expect(system.visibleBladeCount).toBeLessThan(12_000);
    expect(metrics.emptyBins).toBeGreaterThan(100);
    expect(metrics.densestBin).toBeGreaterThan(150);
    system.dispose();
    asset.geometry.dispose();
    asset.materials[0]?.dispose();
  });
});

function createGrassAsset(): InstancedModelAsset {
  const geometry = new PlaneGeometry(1, 2);
  geometry.translate(0, 1, 0);
  return { geometry, materials: [new MeshStandardMaterial()] };
}

function finishBuild(system: GrassSystem): void {
  const radiusInCells = Math.ceil(VEGETATION.grassRadius / VEGETATION.grassSpacing);
  const candidateCount = (radiusInCells * 2 + 1) ** 2;
  const requiredFrames = Math.ceil(candidateCount / BUILD_CANDIDATES_PER_FRAME) + 1;
  for (let frame = 0; frame < requiredFrames; frame += 1) system.update(CAMERA_POSITION);
}

function measureMeadowBins(system: GrassSystem): MeadowMetrics {
  const occupied = new Map<string, number>();
  const transform = new Matrix4();
  for (let index = 0; index < system.visibleBladeCount; index += 1) {
    system.mesh.getMatrixAt(index, transform);
    const key = getBinKey(transform.elements[12]!, transform.elements[14]!);
    occupied.set(key, (occupied.get(key) ?? 0) + 1);
  }
  const counts = getVisibleBinKeys().map((key) => occupied.get(key) ?? 0);
  return {
    emptyBins: counts.filter((count) => count === 0).length,
    densestBin: Math.max(...counts),
  };
}

function getVisibleBinKeys(): string[] {
  const binsPerAxis = VEGETATION.grassRadius * 2 / BIN_SIZE;
  const keys: string[] = [];
  for (let z = 0; z < binsPerAxis; z += 1) {
    for (let x = 0; x < binsPerAxis; x += 1) {
      const localX = (x + 0.5) * BIN_SIZE - VEGETATION.grassRadius;
      const localZ = (z + 0.5) * BIN_SIZE - VEGETATION.grassRadius;
      if (Math.hypot(localX, localZ) <= VEGETATION.grassRadius - BIN_SIZE / 2) keys.push(`${x}:${z}`);
    }
  }
  return keys;
}

function getBinKey(x: number, z: number): string {
  const localX = x - CAMERA_POSITION.x + VEGETATION.grassRadius;
  const localZ = z - CAMERA_POSITION.z + VEGETATION.grassRadius;
  return `${Math.floor(localX / BIN_SIZE)}:${Math.floor(localZ / BIN_SIZE)}`;
}
