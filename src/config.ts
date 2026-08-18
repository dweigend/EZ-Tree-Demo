/**
 * Typed landscape configuration and URL overrides.
 * This is the single tuning surface; runtime systems consume immutable values and never parse URLs.
 */

export interface LandscapeFeatures {
  readonly trees: boolean;
  readonly grass: boolean;
  readonly flowers: boolean;
  readonly rocks: boolean;
  readonly hedges: boolean;
  readonly lakes: boolean;
  readonly surface: boolean;
}

export interface LandscapeConfig {
  readonly seed: string;
  readonly features: LandscapeFeatures;
  readonly view: {
    readonly distance: number;
    readonly fogDensity: number;
    readonly relief: number;
  };
  readonly terrain: {
    readonly chunkSize: number;
    readonly chunkRadius: number;
    readonly segments: number;
    readonly normalSampleDistance: number;
  };
  readonly vegetation: {
    readonly forestDensity: number;
    readonly grassDensity: number;
    readonly treeBatchCapacity: number;
    readonly treeSpacing: number;
    readonly nearDistance: number;
    readonly middleDistance: number;
    readonly farDistance: number;
    readonly grassRadius: number;
    readonly grassSpacing: number;
    readonly grassCapacity: number;
    readonly grassRefreshDistance: number;
    readonly flowerBatchCapacity: number;
    readonly flowerSpacing: number;
    readonly flowerDistance: number;
    readonly rockBatchCapacity: number;
    readonly rockSpacing: number;
    readonly rockDistance: number;
  };
  readonly rendering: {
    readonly fogDensity: number;
    readonly cameraFar: number;
    readonly pixelRatioCap: number;
    readonly shadowDistance: number;
    readonly shadowMapSize: number;
  };
}

const DEFAULT_VIEW_DISTANCE = 1_050;
const FEATURE_NAMES = ['trees', 'grass', 'flowers', 'rocks', 'hedges', 'lakes', 'surface'] as const;

export function createLandscapeConfig(parameters = new URLSearchParams()): LandscapeConfig {
  const distance = readNumber(parameters, 'distance', DEFAULT_VIEW_DISTANCE, 720, 1_500);
  const fogDensity = readNumber(parameters, 'fog', 1.7 / distance, 0.0008, 0.0026);
  const relief = readNumber(parameters, 'relief', 1, 0.7, 1.4);
  const forestDensity = readNumber(parameters, 'forestDensity', 1, 0.5, 1.5);
  const grassDensity = readNumber(parameters, 'grassDensity', 1, 0.5, 1.5);
  const features = readFeatures(parameters);

  return {
    seed: parameters.get('seed')?.trim() || 'endless-wilds-2026',
    features,
    view: { distance, fogDensity, relief },
    terrain: {
      chunkSize: 320,
      chunkRadius: Math.max(2, Math.min(4, Math.round(distance / 320))),
      segments: 32,
      normalSampleDistance: 2.5,
    },
    vegetation: {
      forestDensity,
      grassDensity,
      treeBatchCapacity: 420,
      treeSpacing: 19,
      nearDistance: 110,
      middleDistance: distance * 0.34,
      farDistance: distance * 0.74,
      grassRadius: 200,
      grassSpacing: 1.25,
      grassCapacity: 44_000,
      grassRefreshDistance: 70,
      flowerBatchCapacity: 420,
      flowerSpacing: 9,
      flowerDistance: 260,
      rockBatchCapacity: 320,
      rockSpacing: 19,
      rockDistance: distance * 0.5,
    },
    rendering: {
      fogDensity,
      cameraFar: distance + 180,
      pixelRatioCap: 1.5,
      shadowDistance: 170,
      shadowMapSize: 1_536,
    },
  };
}

function readFeatures(parameters: URLSearchParams): LandscapeFeatures {
  const features = Object.fromEntries(FEATURE_NAMES.map((name) => [name, readToggle(parameters, name)]));
  return features as unknown as LandscapeFeatures;
}

function readToggle(parameters: URLSearchParams, name: string): boolean {
  return parameters.get(name) !== '0';
}

function readNumber(
  parameters: URLSearchParams,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const rawValue = parameters.get(name);
  if (rawValue === null) return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, value));
}

const browserParameters = typeof window === 'undefined'
  ? new URLSearchParams()
  : new URLSearchParams(window.location.search);

export const CONFIG = createLandscapeConfig(browserParameters);

// Compatibility aliases keep the migration local while CONFIG remains the documented public tuning surface.
export const WORLD_SEED = CONFIG.seed;
export const LANDSCAPE_VIEW = CONFIG.view;
export const TERRAIN = CONFIG.terrain;
export const VEGETATION = CONFIG.vegetation;
export const RENDERING = CONFIG.rendering;
