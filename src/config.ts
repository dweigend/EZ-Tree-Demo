/**
 * Shared tuning constants for the landscape prototype.
 * Centralises visual and performance budgets without introducing runtime configuration machinery.
 */

export const WORLD_SEED = 'endless-wilds-2026';

const DEFAULT_VIEW_DISTANCE = 1_050;
const viewDistance = readNumberParameter('distance', DEFAULT_VIEW_DISTANCE, 720, 1_500);
const fogDensity = readNumberParameter('fog', 1.7 / viewDistance, 0.0008, 0.0026);
const relief = readNumberParameter('relief', 1, 0.7, 1.4);

export const LANDSCAPE_VIEW = {
  distance: viewDistance,
  relief,
} as const;

export const TERRAIN = {
  chunkSize: 320,
  chunkRadius: Math.max(2, Math.min(4, Math.round(viewDistance / 320))),
  segments: 32,
  normalSampleDistance: 2.5,
} as const;

export const VEGETATION = {
  jitterRatio: 0.42,
  placementCacheSize: 96,
  treeBatchCapacity: 320,
  treeSpacing: 22,
  nearDistance: 110,
  middleDistance: viewDistance * 0.34,
  farDistance: viewDistance * 0.74,
  grassRadius: 200,
  grassSpacing: 1.25,
  grassCapacity: 44_000,
  grassRefreshDistance: 70,
  flowerBatchCapacity: 320,
  flowerSpacing: 11,
  flowerDistance: 260,
  rockBatchCapacity: 240,
  rockSpacing: 24,
  rockDistance: viewDistance * 0.5,
} as const;

export const RENDERING = {
  fogDensity,
  cameraFar: viewDistance + 180,
  pixelRatioCap: 1.5,
  shadowDistance: 170,
  shadowMapSize: 1_536,
} as const;

function readNumberParameter(name: string, fallback: number, minimum: number, maximum: number): number {
  const rawValue = new URLSearchParams(window.location.search).get(name);
  if (rawValue === null) return fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}
