/** Verifies the bounded world-space shader additions used by the shared terrain material. */

import { describe, expect, test } from 'bun:test';
import { Texture } from 'three';
import { createTerrainMaterial } from './terrain-material';

describe('createTerrainMaterial', () => {
  test('uses an independent world varying and one macro texture sample', () => {
    const textures = { grass: new Texture(), dirtColor: new Texture(), dirtNormal: new Texture() };
    const material = createTerrainMaterial(textures);
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <worldpos_vertex>',
      fragmentShader: '#include <map_fragment>\n#include <normal_fragment_maps>',
    };

    material.onBeforeCompile(shader as never, {} as never);

    expect(shader.vertexShader).toContain('(modelMatrix * vec4(transformed, 1.0)).xyz');
    expect(shader.vertexShader).not.toContain('vTerrainWorldPosition = worldPosition.xyz');
    expect(shader.fragmentShader).toContain('texture2D(uDirtTexture, macroTerrainUv)');
    expect(shader.fragmentShader.match(/texture2D\(/g)).toHaveLength(4);
    expect(shader.uniforms.uGrassTexture?.value).toBe(textures.grass);
    expect(shader.uniforms.uDirtTexture?.value).toBe(textures.dirtColor);
    material.dispose();
  });
});
