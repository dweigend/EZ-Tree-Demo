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
  readonly maximumTreeDensityPerHectare: number;
  readonly treeLod: readonly [number, number, number];
  readonly grassRadius: number;
  readonly meadowPatchCapacity: number;
  readonly grassTuftCapacity: number;
  readonly rockDistance: number;
  readonly pixelRatioCap: number;
  readonly shadowDistance: number;
  readonly shadowMapSize: number;
  readonly leafShadows: boolean;
  readonly xrFramebufferScale: number;
  readonly xrFoveation: number;
}

// Keep quality immutable so hot render paths contain no adaptive-quality branches or allocation churn.
const PROFILES: Readonly<Record<QualityProfileName, QualityProfile>> = {
  desktop: {
    name: 'desktop',
    viewDistance: 1_050,
    terrainRadius: 3,
    terrainSegments: 32,
    treeBatchCapacity: 700,
    maximumTreeDensityPerHectare: 24,
    treeLod: [85, 300, 720],
    grassRadius: 200,
    meadowPatchCapacity: 60,
    grassTuftCapacity: 220,
    rockDistance: 525,
    pixelRatioCap: 1.5,
    shadowDistance: 170,
    shadowMapSize: 2_048,
    leafShadows: true,
    xrFramebufferScale: 1,
    xrFoveation: 0,
  },
  pico90: {
    name: 'pico90',
    viewDistance: 720,
    terrainRadius: 2,
    terrainSegments: 24,
    treeBatchCapacity: 480,
    maximumTreeDensityPerHectare: 20,
    treeLod: [45, 180, 400],
    grassRadius: 120,
    meadowPatchCapacity: 16,
    grassTuftCapacity: 90,
    rockDistance: 280,
    pixelRatioCap: 1,
    shadowDistance: 90,
    shadowMapSize: 1_024,
    leafShadows: true,
    xrFramebufferScale: 0.75,
    xrFoveation: 1,
  },
};

const parameters = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
export const QUALITY_PROFILE = PROFILES[parseQualityProfileName(parameters.get('profile'))];
export const BENCHMARK_MODE = parseBenchmarkMode(parameters.get('benchmark'));
const variantStressMode = parameters.get('variantStress') === '1';
const desktopDistance = readNumberParameter(parameters, 'distance', QUALITY_PROFILE.viewDistance, 720, 1_500);
const viewDistance = QUALITY_PROFILE.name === 'desktop' ? desktopDistance : QUALITY_PROFILE.viewDistance;
const fogDensity = readNumberParameter(parameters, 'fog', 1.25 / viewDistance, 0.0008, 0.0026);
const relief = readNumberParameter(parameters, 'relief', 1, 0.7, 1.4);
const startX = readNumberParameter(parameters, 'x', 0, -10_000, 10_000);
const startZ = readNumberParameter(parameters, 'z', 120, -10_000, 10_000);
const startAltitude = readNumberParameter(parameters, 'altitude', 62, 4, 200);

export const LANDSCAPE_VIEW = {
  distance: viewDistance,
  relief,
  startX,
  startZ,
  startAltitude,
} as const;

export const TERRAIN = {
  chunkSize: 320,
  chunkRadius: QUALITY_PROFILE.terrainRadius,
  segments: QUALITY_PROFILE.terrainSegments,
  normalSampleDistance: 2.5,
} as const;

export const VEGETATION = {
  placementCacheSize: 96,
  treeBatchCapacity: QUALITY_PROFILE.treeBatchCapacity,
  maximumTreeDensityPerHectare: QUALITY_PROFILE.maximumTreeDensityPerHectare,
  nearDistance: QUALITY_PROFILE.treeLod[0],
  middleDistance: QUALITY_PROFILE.treeLod[1],
  farDistance: QUALITY_PROFILE.treeLod[2],
  grassRadius: QUALITY_PROFILE.grassRadius,
  meadowPatchCapacity: QUALITY_PROFILE.meadowPatchCapacity,
  grassTuftCapacity: QUALITY_PROFILE.grassTuftCapacity,
  grassRefreshDistance: QUALITY_PROFILE.name === 'pico90' ? 55 : 70,
  rockBatchCapacity: QUALITY_PROFILE.name === 'pico90' ? 420 : 600,
  rockDistance: QUALITY_PROFILE.rockDistance,
  hedgeBatchCapacity: QUALITY_PROFILE.name === 'pico90' ? 180 : 420,
  hedgeNearDistance: QUALITY_PROFILE.name === 'pico90' ? 35 : 55,
  hedgeFarDistance: QUALITY_PROFILE.name === 'pico90' ? 260 : 480,
  leafShadows: QUALITY_PROFILE.leafShadows,
} as const;

export const RENDERING = {
  fogDensity,
  cameraFar: viewDistance + 180,
  pixelRatioCap: QUALITY_PROFILE.pixelRatioCap,
  shadowDistance: QUALITY_PROFILE.shadowDistance,
  shadowMapSize: QUALITY_PROFILE.shadowMapSize,
  xrEnabled: QUALITY_PROFILE.name === 'pico90',
  xrFramebufferScale: QUALITY_PROFILE.xrFramebufferScale,
  xrFoveation: QUALITY_PROFILE.xrFoveation,
  xrTargetFrameRate: 90,
} as const;

export const VARIANT_GENERATION = {
  initialDelayMs: variantStressMode ? 500 : QUALITY_PROFILE.name === 'pico90' ? 60_000 : 30_000,
  intervalMs: variantStressMode ? 2_000 : QUALITY_PROFILE.name === 'pico90' ? 60_000 : 30_000,
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
