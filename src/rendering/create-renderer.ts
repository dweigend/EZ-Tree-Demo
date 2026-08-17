/**
 * WebGL2 renderer factory with the project's colour, tone-mapping, and shadow defaults.
 * It rejects WebGL1 explicitly and keeps device-pixel cost bounded for stable desktop performance.
 */

import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { RENDERING } from '../config';

export function createRenderer(): WebGLRenderer {
  const context = document.createElement('canvas').getContext('webgl2', {
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  if (!context) throw new Error('This prototype requires WebGL2.');

  const renderer = new WebGLRenderer({ canvas: context.canvas, context, antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDERING.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  return renderer;
}
