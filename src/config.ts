/**
 * Shared tuning constants for the landscape prototype.
 * Centralises visual and performance budgets without introducing runtime configuration machinery.
 */

export const WORLD_SEED = 'endless-wilds-2026';

export const TERRAIN = {
  chunkSize: 320,
  chunkRadius: 3,
  segments: 32,
  normalSampleDistance: 2.5,
} as const;

export const VEGETATION = {
  treeBatchCapacity: 640,
  treeSpacing: 14.5,
  nearDistance: 175,
  middleDistance: 460,
  farDistance: 900,
  grassRadius: 250,
  grassSpacing: 2.75,
  grassCapacity: 34_000,
  grassRefreshDistance: 70,
} as const;

export const RENDERING = {
  fogDensity: 0.00125,
  cameraFar: 1_400,
  pixelRatioCap: 1.5,
  shadowDistance: 170,
  shadowMapSize: 1_536,
} as const;
