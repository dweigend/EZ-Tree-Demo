/**
 * Public runtime diagnostics contract and compact display formatting.
 * Collection stays in WorldRuntime; this module contains only data shape and presentation.
 */

import type { LandscapeConfig } from '../config';

export interface LandscapeDiagnostics {
  fps: number;
  frameTimeMs: number;
  peakFrameTimeMs: number;
  drawCalls: number;
  triangles: number;
  trees: number;
  grassBlades: number;
  flowers: number;
  rocks: number;
  hedgeShrubs: number;
  lakes: number;
  activeChunks: number;
  detailedChunks: number;
  geometries: number;
  textures: number;
  position: readonly [number, number, number];
  speed: number;
  viewDistance: number;
  relief: number;
  seed: string;
}

export function createLandscapeDiagnostics(config: LandscapeConfig): LandscapeDiagnostics {
  return {
    fps: 0,
    frameTimeMs: 0,
    peakFrameTimeMs: 0,
    drawCalls: 0,
    triangles: 0,
    trees: 0,
    grassBlades: 0,
    flowers: 0,
    rocks: 0,
    hedgeShrubs: 0,
    lakes: 0,
    activeChunks: 0,
    detailedChunks: 0,
    geometries: 0,
    textures: 0,
    position: [0, 0, 0],
    speed: 0,
    viewDistance: config.view.distance,
    relief: config.view.relief,
    seed: config.seed,
  };
}

export function formatLandscapeDiagnostics(value: LandscapeDiagnostics): string {
  const triangles = Math.round(value.triangles / 1_000);
  const frame = `${value.fps} FPS · ${value.frameTimeMs}/${value.peakFrameTimeMs} ms`;
  const render = `${value.drawCalls} calls · ${triangles}k tris`;
  const plants = `${value.trees} trees · ${value.hedgeShrubs} shrubs · ${value.grassBlades.toLocaleString()} grass`;
  const accents = `${value.flowers} flowers · ${value.rocks} rocks · ${value.lakes} lakes`;
  const world = `${value.activeChunks}/${value.detailedChunks} chunks · ${value.viewDistance} m · r${value.relief.toFixed(2)}`;
  return `${frame} · ${render}\n${plants} · ${accents} · ${world}`;
}
