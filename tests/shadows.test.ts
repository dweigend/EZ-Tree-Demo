/**
 * Verifies stable directional-shadow placement and wind-aware alpha-cutout depth materials.
 */

import { describe, expect, test } from 'bun:test';
import {
  DirectionalLight,
  MeshStandardMaterial,
  PerspectiveCamera,
  RGBADepthPacking,
  Scene,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import { RENDERING } from '../src/config';
import { createGrassMaterial } from '../src/grass/grass-material';
import { DirectionalShadowSnapper } from '../src/rendering/directional-shadow-snapper';
import { Environment } from '../src/rendering/environment';
import { createWindDepthMaterial } from '../src/rendering/wind-depth-material';

describe('directional shadows', () => {
  test('snaps the light-plane axes while preserving depth along the light direction', () => {
    const snapper = new DirectionalShadowSnapper(new Vector3(0, 0, 1), 10, 10);
    const result = snapper.snap(new Vector3(2.6, 4.4, 9), new Vector3());

    expect(result.toArray()).toEqual([2, 4, 9]);
  });

  test('copies alpha cutout and vertex deformation into RGBA depth rendering', () => {
    const map = new Texture();
    const alphaMap = new Texture();
    const source = new MeshStandardMaterial({ alphaMap, alphaTest: 0.42, map });
    const compile = source.onBeforeCompile;
    source.customProgramCacheKey = () => 'surface-wind';

    const depth = createWindDepthMaterial(source);

    expect(depth.depthPacking).toBe(RGBADepthPacking);
    expect(depth.map).toBe(map);
    expect(depth.alphaMap).toBe(alphaMap);
    expect(depth.alphaTest).toBe(0.42);
    expect(depth.onBeforeCompile).toBe(compile);
    expect(depth.customProgramCacheKey()).toBe('wind-depth-surface-wind');

    depth.dispose();
    source.dispose();
    map.dispose();
    alphaMap.dispose();
  });

  test('configures and disposes the bounded directional shadow map', () => {
    const scene = new Scene();
    const environment = new Environment(scene);
    const sun = scene.getObjectByProperty('isDirectionalLight', true) as DirectionalLight;
    const camera = new PerspectiveCamera();
    const map = new WebGLRenderTarget(1, 1);
    let disposed = false;
    map.addEventListener('dispose', () => {
      disposed = true;
    });
    sun.shadow.map = map;

    environment.update(camera);

    expect(sun.shadow.mapSize.toArray()).toEqual([RENDERING.shadowMapSize, RENDERING.shadowMapSize]);
    expect(sun.shadow.camera.left).toBe(-RENDERING.shadowDistance);
    expect(sun.shadow.camera.right).toBe(RENDERING.shadowDistance);
    expect(sun.shadow.camera.top).toBe(RENDERING.shadowDistance);
    expect(sun.shadow.camera.bottom).toBe(-RENDERING.shadowDistance);
    expect(sun.shadow.camera.near).toBe(20);
    expect(sun.shadow.camera.far).toBe(780);
    expect(sun.shadow.camera.projectionMatrix.elements[0]).toBeCloseTo(1 / RENDERING.shadowDistance);
    expect(sun.shadow.bias).toBe(-0.00002);
    expect(sun.shadow.normalBias).toBe(0.04);

    environment.dispose();
    expect(disposed).toBe(true);
  });

  test('keeps grass on the standard PBR material path', () => {
    const source = new MeshStandardMaterial();
    const grass = createGrassMaterial(source, {
      time: { value: 0 },
      direction: { value: new Vector2(1, 0) },
      amplitude: { value: 0.5 },
      gust: { value: 1 },
      spatialScale: { value: 80 },
    });

    expect(grass.isMeshStandardMaterial).toBe(true);
    expect(grass.metalness).toBe(0);
    expect(grass.roughness).toBe(1);

    grass.dispose();
    source.dispose();
  });
});
