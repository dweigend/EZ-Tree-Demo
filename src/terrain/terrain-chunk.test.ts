/** Guards that streamed terrain surface cover comes from the shared ecology field. */

import { describe, expect, test } from 'bun:test';
import { MeshStandardMaterial } from 'three';
import { TERRAIN, WORLD_SEED } from '../config';
import { EcologyField, createEcologySample } from '../ecology/ecology-field';
import { HeightField } from './height-field';
import { TerrainChunk } from './terrain-chunk';

describe('TerrainChunk', () => {
  test('writes ecology meadow strength into its ground-cover attribute', () => {
    const heightField = new HeightField(WORLD_SEED);
    const ecologyField = new EcologyField(WORLD_SEED);
    const material = new MeshStandardMaterial();
    const chunk = new TerrainChunk(heightField, ecologyField, material);
    chunk.assign(0, 0);

    const positions = chunk.mesh.geometry.getAttribute('position');
    const cover = chunk.mesh.geometry.getAttribute('aGroundCover');
    const x = positions.getX(0);
    const z = positions.getZ(0);
    const height = heightField.getHeight(x, z);
    const step = TERRAIN.normalSampleDistance;
    const dx = heightField.getHeight(x + step, z) - heightField.getHeight(x - step, z);
    const dz = heightField.getHeight(x, z + step) - heightField.getHeight(x, z - step);
    const site = {
      x,
      z,
      height,
      slope: Math.hypot(dx, dz) / (step * 2),
      moisture: heightField.getMoisture(x, z, height),
    };
    const expected = ecologyField.sample(site, createEcologySample()).meadow;

    expect(cover.getX(0)).toBeCloseTo(expected, 6);
    chunk.dispose();
    material.dispose();
  });
});
