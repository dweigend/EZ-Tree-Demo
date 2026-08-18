/**
 * Immutable startup configuration for desktop and PICO landscape profiles.
 * Query parameters select one bounded profile; runtime systems never mutate quality budgets.
 */

export const WORLD_SEED = 'endless-wilds-2026';

export type QualityProfileName = 'desktop' | 'pico90';
export type BenchmarkMode = 'desktop-flight' | 'xr-flight' | null;

interface QualityProfile {
  readonly name: QualityProfileName;
  readonly viewDistance: number;
  readonly terrainRadius: number;
  readonly terrainSegments: number;
  readonly treeBatchCapacity: number;
  readonly treeDensity: number;
  readonly treeLod: readonly [number, number, number];
  readonly grassRadius: number;
  readonly grassSpacing: number;
  readonly grassCapacity: number;
  readonly flowerDistance: number;
  readonly rockDistance: number;
  readonly pixelRatioCap: number;
  readonly shadowDistance: number;
  readonly shadowMapSize: number;
  readonly leafShadows: boolean;
  readonly blendTerrainNormals: boolean;
  readonly xrFramebufferScale: number;
  readonly xrFoveation: number;
}

const PROFILES: Readonly<Record<QualityProfileName, QualityProfile>> = {
  desktop: {
    name: 'desktop',
    viewDistance: 1_050,
    terrainRadius: 3,
    terrainSegments: 32,
    treeBatchCapacity: 320,
    treeDensity: 1,
    treeLod: [110, 360, 780],
    grassRadius: 200,
    grassSpacing: 1.25,
    grassCapacity: 44_000,
    flowerDistance: 260,
    rockDistance: 525,
    pixelRatioCap: 1.5,
    shadowDistance: 170,
    shadowMapSize: 1_536,
    leafShadows: true,
    blendTerrainNormals: true,
    xrFramebufferScale: 1,
    xrFoveation: 0,
  },
  pico90: {
    name: 'pico90',
    viewDistance: 720,
    terrainRadius: 2,
    terrainSegments: 24,
    treeBatchCapacity: 240,
    treeDensity: 0.65,
    treeLod: [70, 220, 480],
    grassRadius: 120,
    grassSpacing: 1.5,
    grassCapacity: 18_000,
    flowerDistance: 160,
    rockDistance: 280,
    pixelRatioCap: 1,
    shadowDistance: 90,
    shadowMapSize: 1_024,
    leafShadows: false,
    blendTerrainNormals: false,
    xrFramebufferScale: 0.75,
    xrFoveation: 1,
  },
};

const parameters = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
export const QUALITY_PROFILE = PROFILES[parseQualityProfileName(parameters.get('profile'))];
export const BENCHMARK_MODE = parseBenchmarkMode(parameters.get('benchmark'));
const desktopDistance = readNumberParameter(parameters, 'distance', QUALITY_PROFILE.viewDistance, 720, 1_500);
const viewDistance = QUALITY_PROFILE.name === 'desktop' ? desktopDistance : QUALITY_PROFILE.viewDistance;
const fogDensity = readNumberParameter(parameters, 'fog', 1.7 / viewDistance, 0.0008, 0.0026);
const relief = readNumberParameter(parameters, 'relief', 1, 0.7, 1.4);

export const LANDSCAPE_VIEW = {
  distance: viewDistance,
  relief,
} as const;

export const TERRAIN = {
  chunkSize: 320,
  chunkRadius: QUALITY_PROFILE.terrainRadius,
  segments: QUALITY_PROFILE.terrainSegments,
  normalSampleDistance: 2.5,
} as const;

export const VEGETATION = {
  jitterRatio: 0.42,
  placementCacheSize: 96,
  treeBatchCapacity: QUALITY_PROFILE.treeBatchCapacity,
  treeDensity: QUALITY_PROFILE.treeDensity,
  treeSpacing: 18,
  nearDistance: QUALITY_PROFILE.treeLod[0],
  middleDistance: QUALITY_PROFILE.treeLod[1],
  farDistance: QUALITY_PROFILE.treeLod[2],
  grassRadius: QUALITY_PROFILE.grassRadius,
  grassSpacing: QUALITY_PROFILE.grassSpacing,
  grassCapacity: QUALITY_PROFILE.grassCapacity,
  grassRefreshDistance: QUALITY_PROFILE.name === 'pico90' ? 55 : 70,
  flowerBatchCapacity: QUALITY_PROFILE.name === 'pico90' ? 240 : 320,
  flowerSpacing: 11,
  flowerDistance: QUALITY_PROFILE.flowerDistance,
  rockBatchCapacity: QUALITY_PROFILE.name === 'pico90' ? 180 : 240,
  rockSpacing: 24,
  rockDistance: QUALITY_PROFILE.rockDistance,
  leafShadows: QUALITY_PROFILE.leafShadows,
} as const;

export const RENDERING = {
  fogDensity,
  cameraFar: viewDistance + 180,
  pixelRatioCap: QUALITY_PROFILE.pixelRatioCap,
  shadowDistance: QUALITY_PROFILE.shadowDistance,
  shadowMapSize: QUALITY_PROFILE.shadowMapSize,
  blendTerrainNormals: QUALITY_PROFILE.blendTerrainNormals,
  xrEnabled: QUALITY_PROFILE.name === 'pico90',
  xrFramebufferScale: QUALITY_PROFILE.xrFramebufferScale,
  xrFoveation: QUALITY_PROFILE.xrFoveation,
  xrTargetFrameRate: 90,
} as const;

export function parseQualityProfileName(value: string | null): QualityProfileName {
  return value === 'pico90' ? 'pico90' : 'desktop';
}

export function parseBenchmarkMode(value: string | null): BenchmarkMode {
  if (value === 'desktop-flight' || value === 'xr-flight') return value;
  return null;
}

function readNumberParameter(
  values: URLSearchParams,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const rawValue = values.get(name);
  if (rawValue === null) return fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}
