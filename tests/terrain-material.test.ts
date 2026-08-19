/**
 * Verifies the terrain shader contract without starting WebGL or loading runtime textures.
 */

import { expect, test } from 'bun:test';
import { Texture } from 'three';
import type { GroundTextureAssets } from '../src/assets/landscape-assets';
import { createTerrainMaterial } from '../src/terrain/terrain-material';

test('terrain shader keeps height detail and strong trail overlay on the shared atlas', () => {
  const textures: GroundTextureAssets = {
    albedoAtlas: new Texture(),
    surfaceAtlas: new Texture(),
    tileMeters: [8, 10, 8, 10, 12, 9, 42, 8],
    atlasSize: 1_536,
  };
  const material = createTerrainMaterial(textures);
  const shader = {
    uniforms: {},
    vertexShader: '#include <worldpos_vertex>',
    fragmentShader: [
      '#include <map_fragment>',
      '#include <roughnessmap_fragment>',
      '#include <normal_fragment_maps>',
    ].join('\n'),
  } as Parameters<typeof material.onBeforeCompile>[0];

  material.onBeforeCompile(shader, undefined as never);

  expect(material.normalScale.toArray()).toEqual([0.85, 0.85]);
  expect(shader.uniforms.uTerrainParallaxMeters).toBeUndefined();
  expect(shader.fragmentShader).toContain('sqrt(max(1.0 - dot(uvNormal, uvNormal)');
  expect(shader.fragmentShader).toContain('getTerrainHeightMix');
  expect(shader.fragmentShader).toContain('smoothstep(8.0, 20.0, distanceToTrail)');
  expect(shader.fragmentShader).toContain('baseLuminance * 1.24');
  expect(shader.fragmentShader).not.toContain('getTerrainParallaxUv');

  material.dispose();
  textures.albedoAtlas.dispose();
  textures.surfaceAtlas.dispose();
});
