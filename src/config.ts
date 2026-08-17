/**
 * Shared tuning constants for the landscape prototype.
 * Centralises visual and performance budgets without introducing runtime configuration machinery.
 */

export const WORLD_SEED = 'endless-wilds-2026';

const DEFAULT_VIEW_DISTANCE = 1_050;
const viewDistance = readNumberParameter('distance', DEFAULT_VIEW_DISTANCE, 720, 1_500);
const fogDensity = readNumberParameter('fog', 1.7 / viewDistance, 0.0008, 0.0026);

export const LANDSCAPE_VIEW = {
  distance: viewDistance,
  fogDensity,
} as const;

export const TERRAIN = {
  chunkSize: 320,
  chunkRadius: Math.max(2, Math.min(4, Math.round(viewDistance / 320))),
  segments: 32,
  normalSampleDistance: 2.5,
} as const;

export const VEGETATION = {
  treeBatchCapacity: 640,
  treeSpacing: 18,
  nearDistance: 175,
  middleDistance: viewDistance * 0.4,
  farDistance: viewDistance * 0.74,
  grassRadius: 200,
  grassSpacing: 1.25,
  grassCapacity: 44_000,
  grassRefreshDistance: 70,
  flowerBatchCapacity: 240,
  flowerSpacing: 12,
  flowerDistance: 230,
  rockBatchCapacity: 180,
  rockSpacing: 30,
  rockDistance: viewDistance * 0.48,
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
