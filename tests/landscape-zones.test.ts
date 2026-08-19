/**
 * Verifies the authored zone catalog, physical units, and soft property blending.
 */

import { describe, expect, test } from 'bun:test';
import {
  createLandscapeZoneWeights,
  createTerrainCoverage,
  getHedgeRowMetersPerHectare,
  getMaximumPopulationDensityPerHectare,
  getPopulationDensityPerHectare,
  LANDSCAPE_ZONES,
  LANDSCAPE_ZONE_IDS,
  selectPopulationType,
  writeTerrainCoverage,
  type LandscapeZoneId,
} from '../src/ecology/landscape-zones';

describe('landscape zone catalog', () => {
  test('defines complete, non-negative zone contents with full ground coverage', () => {
    expect(Object.keys(LANDSCAPE_ZONES)).toEqual([...LANDSCAPE_ZONE_IDS]);
    for (const zone of Object.values(LANDSCAPE_ZONES)) {
      expect(zone.treePattern.length).toBeGreaterThan(0);
      expect(zone.hedges.pattern.length).toBeGreaterThan(0);
      expect(zone.ground.reduce((total, entry) => total + entry.coveragePercent, 0)).toBe(100);
      for (const population of [zone.trees, zone.grass, zone.rocks]) {
        expect(population.every((entry) => entry.instancesPerHectare >= 0)).toBeTrue();
        expect(new Set(population.map((entry) => entry.type)).size).toBe(population.length);
      }
      expect(zone.hedges.rowMetersPerHectare).toBeGreaterThanOrEqual(0);
      expect(zone.hedges.shrubSpacingMeters).toBeGreaterThan(0);
    }
    expect(new Set(Object.values(LANDSCAPE_ZONES).map((zone) => zone.treePattern))).toEqual(
      new Set(['scattered', 'grove', 'closed', 'coniferStand']),
    );
    expect(new Set(Object.values(LANDSCAPE_ZONES).map((zone) => zone.hedges.pattern))).toEqual(
      new Set(['fieldHedge', 'brokenRow', 'thicket', 'slopeGroup']),
    );
  });

  test('exposes authored physical densities for pure zones', () => {
    const meadow = pureZone('meadow');
    expect(getPopulationDensityPerHectare(meadow, 'trees')).toBe(1);
    expect(getPopulationDensityPerHectare(meadow, 'grass')).toBe(16);
    expect(getPopulationDensityPerHectare(meadow, 'rocks')).toBe(3);
    expect(getHedgeRowMetersPerHectare(meadow)).toBe(20);
    expect(writeTerrainCoverage(meadow, createTerrainCoverage())).toEqual({
      meadow: 0.96,
      mud: 0,
      dryForest: 0,
      mossForest: 0,
      forest: 0.04,
      pineForest: 0,
      rock: 0,
    });
  });

  test('blends densities and selects types from the same zone data', () => {
    const weights = createLandscapeZoneWeights();
    weights.meadow = 0.5;
    weights.dryBroadleaf = 0.5;
    expect(getPopulationDensityPerHectare(weights, 'trees')).toBe(12.5);
    expect(getPopulationDensityPerHectare(weights, 'grass')).toBe(10.5);
    expect(selectPopulationType(pureZone('dryBroadleaf'), 'trees', 0)).toBe('oak');
    expect(selectPopulationType(pureZone('dryBroadleaf'), 'trees', 0.99)).toBe('ash');
    expect(getMaximumPopulationDensityPerHectare('trees')).toBe(24);
    expect(getMaximumPopulationDensityPerHectare('grass')).toBe(16);
    expect(getMaximumPopulationDensityPerHectare('rocks')).toBe(24);
  });
});

function pureZone(zoneId: LandscapeZoneId) {
  return Object.assign(createLandscapeZoneWeights(), { [zoneId]: 1 });
}
