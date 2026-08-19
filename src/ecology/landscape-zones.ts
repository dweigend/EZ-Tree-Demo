/**
 * Declares what each continuous landscape zone contains.
 * Physical population units live here; spatial sampling and rendering budgets remain separate.
 */

import type { TreeSpecies } from '../trees/tree-templates';
import {
  TERRAIN_SURFACE_IDS,
  TERRAIN_ZONE_COVERAGE,
  type TerrainSurfaceId,
  type TerrainZoneCoverage,
} from '../terrain/terrain-texture-config';

export const LANDSCAPE_ZONE_IDS = [
  'meadow',
  'wetLowland',
  'dryBroadleaf',
  'moistBroadleaf',
  'coniferHighland',
  'rockyRidge',
] as const;

export type LandscapeZoneId = (typeof LANDSCAPE_ZONE_IDS)[number];
export { TERRAIN_SURFACE_IDS };
export type { TerrainSurfaceId };
export type GrassKind = 'meadowPatch' | 'grassTuft';
export type RockKind = 'rock';
export type TreePattern = 'scattered' | 'grove' | 'closed' | 'coniferStand';
export type HedgePattern = 'fieldHedge' | 'brokenRow' | 'thicket' | 'slopeGroup';
export type AreaPopulationKind = 'trees' | 'grass' | 'rocks';
export type AreaPopulationType = TreeSpecies | GrassKind | RockKind;

export interface LandscapeZoneWeights {
  meadow: number;
  wetLowland: number;
  dryBroadleaf: number;
  moistBroadleaf: number;
  coniferHighland: number;
  rockyRidge: number;
}

export interface PopulationEntry<Type extends string> {
  readonly type: Type;
  readonly instancesPerHectare: number;
}

export type GroundCoverage = TerrainZoneCoverage;

export interface HedgePopulation {
  readonly type: 'shrubRow';
  readonly pattern: HedgePattern;
  readonly rowMetersPerHectare: number;
  readonly shrubSpacingMeters: number;
}

export interface LandscapeZoneDefinition {
  readonly ground: readonly GroundCoverage[];
  readonly treePattern: TreePattern;
  readonly trees: readonly PopulationEntry<TreeSpecies>[];
  readonly grass: readonly PopulationEntry<GrassKind>[];
  readonly rocks: readonly PopulationEntry<RockKind>[];
  readonly hedges: HedgePopulation;
}

export interface TerrainCoverage {
  meadow: number;
  mud: number;
  dryForest: number;
  mossForest: number;
  forest: number;
  pineForest: number;
  rock: number;
}

/** Open, flat ground with isolated oaks and the highest grass density. */
const meadow = {
  ground: TERRAIN_ZONE_COVERAGE.meadow,
  treePattern: 'scattered',
  trees: [population('oak', 1)],
  grass: [population('meadowPatch', 4), population('grassTuft', 12)],
  rocks: [population('rock', 3)],
  hedges: hedge('fieldHedge', 20),
} as const satisfies LandscapeZoneDefinition;

/** Moist, flat lowlands with aspen, ash, mud, and soft forest litter. */
const wetLowland = {
  ground: TERRAIN_ZONE_COVERAGE.wetLowland,
  treePattern: 'grove',
  trees: [population('aspen', 8), population('ash', 3)],
  grass: [population('meadowPatch', 3), population('grassTuft', 8)],
  rocks: [population('rock', 2)],
  hedges: hedge('thicket', 30),
} as const satisfies LandscapeZoneDefinition;

/** Dry woodland dominated by oaks with sparse grass and occasional rocks. */
const dryBroadleaf = {
  ground: TERRAIN_ZONE_COVERAGE.dryBroadleaf,
  treePattern: 'closed',
  trees: [population('oak', 22), population('ash', 2)],
  grass: [population('meadowPatch', 1), population('grassTuft', 4)],
  rocks: [population('rock', 5)],
  hedges: hedge('brokenRow', 25),
} as const satisfies LandscapeZoneDefinition;

/** Moist deciduous woodland shared by ash, aspen, and a few oaks. */
const moistBroadleaf = {
  ground: TERRAIN_ZONE_COVERAGE.moistBroadleaf,
  treePattern: 'grove',
  trees: [population('ash', 12), population('aspen', 10), population('oak', 2)],
  grass: [population('meadowPatch', 1), population('grassTuft', 5)],
  rocks: [population('rock', 3)],
  hedges: hedge('thicket', 25),
} as const satisfies LandscapeZoneDefinition;

/** Elevated conifer woodland with exposed rock and little ground vegetation. */
const coniferHighland = {
  ground: TERRAIN_ZONE_COVERAGE.coniferHighland,
  treePattern: 'coniferStand',
  trees: [population('pine', 22)],
  grass: [population('meadowPatch', 0.5), population('grassTuft', 3)],
  rocks: [population('rock', 12)],
  hedges: hedge('slopeGroup', 5),
} as const satisfies LandscapeZoneDefinition;

/** High or steep exposed terrain with rocks, rare pines, and no hedges. */
const rockyRidge = {
  ground: TERRAIN_ZONE_COVERAGE.rockyRidge,
  treePattern: 'scattered',
  trees: [population('pine', 2)],
  grass: [population('grassTuft', 1)],
  rocks: [population('rock', 24)],
  hedges: hedge('slopeGroup', 0),
} as const satisfies LandscapeZoneDefinition;

export const LANDSCAPE_ZONES = {
  meadow,
  wetLowland,
  dryBroadleaf,
  moistBroadleaf,
  coniferHighland,
  rockyRidge,
} as const satisfies Readonly<Record<LandscapeZoneId, LandscapeZoneDefinition>>;

export function createLandscapeZoneWeights(): LandscapeZoneWeights {
  return {
    meadow: 0,
    wetLowland: 0,
    dryBroadleaf: 0,
    moistBroadleaf: 0,
    coniferHighland: 0,
    rockyRidge: 0,
  };
}

export function createTerrainCoverage(): TerrainCoverage {
  return {
    meadow: 0,
    mud: 0,
    dryForest: 0,
    mossForest: 0,
    forest: 0,
    pineForest: 0,
    rock: 0,
  };
}

/** Blends authored ground percentages with the continuous zone weights. */
export function writeTerrainCoverage(weights: LandscapeZoneWeights, target: TerrainCoverage): TerrainCoverage {
  for (const surface of TERRAIN_SURFACE_IDS) {
    if (surface !== 'trail') target[surface] = 0;
  }
  for (const zoneId of LANDSCAPE_ZONE_IDS) {
    for (const entry of LANDSCAPE_ZONES[zoneId].ground) {
      target[entry.surface] += weights[zoneId] * entry.coveragePercent * 0.01;
    }
  }
  return target;
}

/** Returns the physical density produced by the current soft zone mixture. */
export function getPopulationDensityPerHectare(
  weights: LandscapeZoneWeights,
  populationKind: AreaPopulationKind,
): number {
  let density = 0;
  for (const zoneId of LANDSCAPE_ZONE_IDS) {
    density += weights[zoneId] * sumPopulation(LANDSCAPE_ZONES[zoneId][populationKind]);
  }
  return density;
}

export function getMaximumPopulationDensityPerHectare(populationKind: AreaPopulationKind): number {
  return Math.max(...LANDSCAPE_ZONE_IDS.map((zoneId) => sumPopulation(LANDSCAPE_ZONES[zoneId][populationKind])));
}

/** Chooses a concrete type only after a deterministic candidate passed its density test. */
export function selectPopulationType(
  weights: LandscapeZoneWeights,
  populationKind: 'trees',
  selection: number,
): TreeSpecies | null;
export function selectPopulationType(
  weights: LandscapeZoneWeights,
  populationKind: 'grass',
  selection: number,
): GrassKind | null;
export function selectPopulationType(
  weights: LandscapeZoneWeights,
  populationKind: 'rocks',
  selection: number,
): RockKind | null;
export function selectPopulationType(
  weights: LandscapeZoneWeights,
  populationKind: AreaPopulationKind,
  selection: number,
): AreaPopulationType | null {
  const total = getPopulationDensityPerHectare(weights, populationKind);
  if (total <= 0) return null;
  let remaining = selection * total;
  for (const zoneId of LANDSCAPE_ZONE_IDS) {
    const zoneWeight = weights[zoneId];
    for (const entry of LANDSCAPE_ZONES[zoneId][populationKind]) {
      remaining -= zoneWeight * entry.instancesPerHectare;
      if (remaining <= 0) return entry.type;
    }
  }
  return null;
}

export function getHedgeRowMetersPerHectare(weights: LandscapeZoneWeights): number {
  return LANDSCAPE_ZONE_IDS.reduce(
    (total, zoneId) => total + weights[zoneId] * LANDSCAPE_ZONES[zoneId].hedges.rowMetersPerHectare,
    0,
  );
}

export function getHedgeShrubSpacingMeters(weights: LandscapeZoneWeights): number {
  const rowMeters = getHedgeRowMetersPerHectare(weights);
  if (rowMeters <= 0) return meadow.hedges.shrubSpacingMeters;
  const weightedSpacing = LANDSCAPE_ZONE_IDS.reduce((total, zoneId) => {
    const hedges = LANDSCAPE_ZONES[zoneId].hedges;
    return total + weights[zoneId] * hedges.rowMetersPerHectare * hedges.shrubSpacingMeters;
  }, 0);
  return weightedSpacing / rowMeters;
}

export function getTreePattern(weights: LandscapeZoneWeights): TreePattern {
  return LANDSCAPE_ZONES[getDominantZone(weights)].treePattern;
}

export function getHedgePattern(weights: LandscapeZoneWeights): HedgePattern {
  return LANDSCAPE_ZONES[getDominantZone(weights)].hedges.pattern;
}

function population<Type extends string>(type: Type, instancesPerHectare: number): PopulationEntry<Type> {
  return { type, instancesPerHectare };
}

function hedge(pattern: HedgePattern, rowMetersPerHectare: number): HedgePopulation {
  return { type: 'shrubRow', pattern, rowMetersPerHectare, shrubSpacingMeters: 3.5 };
}

function sumPopulation(entries: readonly PopulationEntry<string>[]): number {
  return entries.reduce((total, entry) => total + entry.instancesPerHectare, 0);
}

function getDominantZone(weights: LandscapeZoneWeights): LandscapeZoneId {
  return LANDSCAPE_ZONE_IDS.reduce((dominant, zoneId) => {
    return weights[zoneId] > weights[dominant] ? zoneId : dominant;
  });
}
